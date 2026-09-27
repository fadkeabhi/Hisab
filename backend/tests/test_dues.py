from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta, timezone

import pytest
from conftest import login
from test_cashbook_modes import close, entry, start

from app.routers import hishob


def pay(client, owner, url, day, source, amount, method="CASH", key=None):
    return client.post(
        url + "/due-payments",
        headers=owner,
        json={
            "revision": day["revision"],
            "source_day_id": source["id"],
            "entry_id": source["transactions"][0]["id"],
            "amount": amount,
            "payment_method": method,
            "request_id": key or f"receipt-{day['revision']:06d}",
            "note": "Received",
        },
    )


@pytest.mark.parametrize("mode", ["ENTRIES", "BILLING", "COUNTED"])
def test_same_day_partial_cash_and_digital_payments_reconcile_once(client, setup_shop, mode):
    owner = setup_shop[0]
    base, url, day = start(client, setup_shop, mode)
    source = day = entry(client, owner, url, day, "CREDIT_SALE", "1000")
    response = pay(client, owner, url, day, source, "300")
    assert response.status_code == 201, response.text
    paid = response.json()
    assert paid["entry_credit_sales"] == "700.00"
    assert paid["other_cash_in"] == "0.00"
    # A retry with the same payload/revision does not create another receipt.
    assert pay(client, owner, url, day, source, "300").json()["revision"] == paid["revision"]
    day = paid
    response = pay(client, owner, url, day, source, "200", "DIGITAL")
    assert response.status_code == 201, response.text
    day = response.json()
    dues = client.get(base + "/dues", headers=owner).json()
    assert dues["items"][0]["remaining_amount"] == "500.00"
    assert dues["items"][0]["paid_amount"] == "500.00"
    assert len(dues["items"][0]["payments"]) == 2
    args = {} if mode == "ENTRIES" else {"digital_sales": "200"}
    if mode == "BILLING":
        args.update(billing_input="TOTAL", total_sales="1000")
    result = close(client, owner, url, day, "1300", **args)
    assert result.status_code == 200, result.text
    closed = result.json()
    assert closed["total_sales"] == "1000.00"
    assert closed["cash_sales"] == "300.00" and closed["credit_sales"] == "500.00"
    assert closed["difference"] == (None if mode == "COUNTED" else "0.00")
    assert pay(client, owner, url, closed, source, "500").status_code == 409


def test_older_dues_cash_and_upi_do_not_inflate_sales_or_rewrite_history(client, setup_shop, monkeypatch):
    owner = setup_shop[0]
    clock = datetime(2027, 4, 10, 8, tzinfo=timezone.utc)
    monkeypatch.setattr(hishob, "now", lambda: clock)
    base, url, day = start(client, setup_shop, "BILLING")
    source = day = entry(client, owner, url, day, "CREDIT_SALE", "1000")
    closed = close(
        client, owner, url, day, "1000", billing_input="TOTAL", total_sales="1000", digital_sales="0"
    ).json()
    assert closed["credit_sales"] == "1000.00"
    snapshot = closed["closing_snapshots"]
    clock += timedelta(days=1)
    today = client.post(base + "/days", headers=owner, json={}).json()
    target = base + "/days/" + today["id"]
    response = pay(client, owner, target, today, source, "400")
    assert response.status_code == 201, response.text
    today = response.json()
    assert today["other_cash_in"] == "400.00" and today["entry_credit_sales"] == "0.00"
    today = pay(client, owner, target, today, source, "600", "DIGITAL").json()
    result = close(
        client, owner, target, today, "1400", billing_input="TOTAL", total_sales="0", digital_sales="0"
    )
    assert result.status_code == 200, result.text
    assert result.json()["difference"] == "0.00" and result.json()["total_sales"] == "0.00"
    assert client.get(url, headers=owner).json()["closing_snapshots"] == snapshot
    assert client.get(base + "/dues", headers=owner).json()["items"] == []
    ledger = client.get(base + "/dues?status=PAID", headers=owner).json()
    assert ledger["items"][0]["remaining_amount"] == "0.00"
    report = client.get(base + "/monthly-summary?month=2027-04", headers=owner).json()
    assert report["total_sales"] == "1000.00"
    search = client.get(base + "/transactions?type=DUE_COLLECTION", headers=owner).json()
    assert search["cash_in"] == "400.00"


def test_dues_permissions_invalid_payments_and_immutable_receipts(client, setup_shop):
    owner, shop, _, worker = setup_shop
    base, url, day = start(client, setup_shop)
    source = day = entry(client, owner, url, day, "CREDIT_SALE", "100")
    outsider = login(client, "+919876549999")
    for auth in (worker, outsider):
        assert client.get(base + "/dues", headers=auth).status_code == 403
        assert pay(client, auth, url, day, source, "10").status_code == 403
    for amount in ("0", "101", "-1"):
        assert pay(client, owner, url, day, source, amount).status_code == 422
    # Forged source day in another shop cannot be collected.
    other_shop = client.post("/api/shops", headers=outsider, json={"name": "Other shop"}).json()["id"]
    other_day = client.post(
        f"/api/shops/{other_shop}/hishob/days", headers=outsider, json={"opening_cash": "0"}
    ).json()
    assert pay(client, owner, url, day, {**source, "id": other_day["id"]}, "10").status_code == 404
    client.post(
        f"/api/shops/{shop}/managers", headers=owner, json={"name": "Ravi", "mobile": "+919876543212"}
    )
    manager = login(client, "+919876543212", "MANAGER")
    assert client.get(base + "/dues", headers=manager).status_code == 403
    config = client.get(f"/api/shops/{shop}/settings", headers=owner).json()
    client.put(
        f"/api/shops/{shop}/settings", headers=owner, json={**config, "manager_can_access_hishob": True}
    )
    response = pay(client, manager, url, day, source, "100")
    assert response.status_code == 201, response.text
    day = response.json()
    assert pay(client, owner, url, day, source, "1").status_code == 422
    for transaction in day["transactions"]:
        response = client.post(
            url + f"/transactions/{transaction['id']}/delete",
            headers=owner,
            json={"revision": day["revision"], "reason": "Correction"},
        )
        assert response.status_code == 422
    client.put(f"/api/shops/{shop}/settings", headers=owner, json=config)
    assert client.get(base + "/dues", headers=manager).status_code == 403


def test_payment_races_and_credit_cancellation_are_atomic(client, setup_shop):
    owner = setup_shop[0]
    base, url, day = start(client, setup_shop)
    source = day = entry(client, owner, url, day, "CREDIT_SALE", "100")
    with ThreadPoolExecutor(max_workers=2) as pool:
        responses = list(
            pool.map(lambda i: pay(client, owner, url, day, source, "80", key=f"parallel-{i:05d}"), range(2))
        )
    # A loser may see either a stale revision or the already-reduced balance.
    assert sorted(r.status_code for r in responses) in ([201, 409], [201, 422])
    assert client.get(base + "/dues", headers=owner).json()["summary"]["remaining_amount"] == "20.00"
    day = client.get(url, headers=owner).json()
    day = entry(client, owner, url, day, "CREDIT_SALE", "50")
    new_credit = {**day, "transactions": [day["transactions"][-1]]}
    deletion = client.post(
        url + f"/transactions/{new_credit['transactions'][0]['id']}/delete",
        headers=owner,
        json={"revision": day["revision"], "reason": "Wrong bill"},
    )
    assert deletion.status_code == 200, deletion.text
    assert pay(client, owner, url, deletion.json(), new_credit, "50").status_code == 404


def test_credit_is_derived_and_unknown_digital_keeps_known_dues(client, setup_shop):
    owner = setup_shop[0]
    _, url, day = start(client, setup_shop, "BILLING")
    day = entry(client, owner, url, day, "CREDIT_SALE", "200")
    assert (
        close(
            client,
            owner,
            url,
            day,
            "1000",
            billing_input="TOTAL",
            total_sales="1000",
            digital_sales="0",
            credit_sales="0",
        ).status_code
        == 422
    )
    result = close(client, owner, url, day, "1000", billing_input="TOTAL", total_sales="1000")
    assert result.status_code == 200, result.text
    data = result.json()
    assert data["credit_sales"] == "200.00" and data["cash_sales"] is None
    assert data["unallocated_sales"] == "800.00" and data["difference"] is None


def test_cancellation_racing_next_day_payment_cannot_commit_both(client, setup_shop, monkeypatch):
    from threading import Barrier

    from app import dues as credit_rules
    from app.routers import dues as due_routes

    owner = setup_shop[0]
    clock = datetime(2027, 4, 10, 8, tzinfo=timezone.utc)
    monkeypatch.setattr(hishob, "now", lambda: clock)
    base, url, day = start(client, setup_shop)
    source = day = entry(client, owner, url, day, "CREDIT_SALE", "100")
    clock += timedelta(days=1)
    next_day = client.post(base + "/days", headers=owner, json={"opening_cash": "0"}).json()
    target = base + "/days/" + next_day["id"]
    barrier = Barrier(2)
    original = credit_rules.receipts_for

    def synchronized(*args):
        result = original(*args)
        barrier.wait(timeout=10)
        return result

    monkeypatch.setattr(credit_rules, "receipts_for", synchronized)
    monkeypatch.setattr(due_routes, "receipts_for", synchronized)
    with ThreadPoolExecutor(max_workers=2) as pool:
        payment = pool.submit(pay, client, owner, target, next_day, source, "100")
        cancellation = pool.submit(
            client.post,
            url + f"/transactions/{source['transactions'][0]['id']}/delete",
            headers=owner,
            json={"revision": day["revision"], "reason": "Wrong bill"},
        )
        statuses = [payment.result().status_code, cancellation.result().status_code]
    assert statuses in ([201, 409], [409, 200])
    register = client.get(base + "/dues?status=ALL", headers=owner).json()
    if statuses[0] == 201:
        assert register["items"][0]["remaining_amount"] == "0.00"
    else:
        assert register["items"] == []
        assert client.get(target, headers=owner).json()["transactions"] == []


def test_legacy_manual_credit_is_preserved_once_across_reclosings(client, setup_shop):
    owner = setup_shop[0]
    _, url, day = start(client, setup_shop, "BILLING")
    # Existing pre-upgrade closing: a manual total, without customer transactions.
    db = client.app.state.db
    db.hishob_days.update_one(
        {"_id": day["id"]},
        {
            "$unset": {"credit_tracking": "", "legacy_credit_sales": ""},
            "$set": {"closing_snapshots": [{"credit_sales": 20000, "transactions": []}]},
        },
    )
    day = client.get(url, headers=owner).json()
    assert day["legacy_credit_sales"] == "200.00"
    day = entry(client, owner, url, day, "CREDIT_SALE", "100")
    for _ in range(2):
        result = close(
            client, owner, url, day, "1000", billing_input="TOTAL", total_sales="300", digital_sales="0"
        )
        assert result.status_code == 200, result.text
        closed = result.json()
        assert closed["credit_sales"] == "300.00" and closed["legacy_credit_sales"] == "200.00"
        day = client.post(
            url + "/reopen", headers=owner, json={"revision": closed["revision"], "reason": "Review"}
        ).json()
