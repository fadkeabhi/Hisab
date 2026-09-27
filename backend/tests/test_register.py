from datetime import timedelta

from conftest import login

from app.db import now
from app.routers.attendance import shop_today


def test_historical_team_register_permissions_and_membership_dates(client, setup_shop):
    owner, shop, worker, worker_auth = setup_shop
    db = client.app.state.db
    today = shop_today(db.shops.find_one({"_id": shop}))
    yesterday = str(today - timedelta(days=1))
    db.memberships.update_one({"_id": worker}, {"$set": {"created_at": now() - timedelta(days=60)}})
    result = client.put(
        f"/api/shops/{shop}/workers/{worker}/attendance",
        headers=owner,
        json={"date": yesterday, "status": "HALF_DAY", "note": "Left early"},
    )
    assert result.status_code == 200
    manager = client.post(
        f"/api/shops/{shop}/managers",
        headers=owner,
        json={"name": "Ravi", "mobile": "+919876543212"},
    ).json()
    manager_auth = login(client, "+919876543212", "MANAGER")
    endpoint = f"/api/shops/{shop}/attendance/register?day={yesterday}"
    for auth in (owner, manager_auth):
        response = client.get(endpoint, headers=auth)
        assert response.status_code == 200
        rows = response.json()["rows"]
        assert len(rows) == 1  # Manager joined today, not yesterday.
        assert rows[0]["worker"]["id"] == worker
        assert rows[0]["attendance"]["status"] == "HALF_DAY"
        assert rows[0]["can_mark"] is False
    db.memberships.update_one({"_id": manager["id"]}, {"$set": {"created_at": now() - timedelta(days=60)}})
    rows = client.get(endpoint, headers=owner).json()["rows"]
    assert len(rows) == 2
    assert next(r for r in rows if r["worker"]["id"] == manager["id"])["attendance"]["status"] == "NOT_MARKED"
    # Deactivation preserves recorded history.
    db.memberships.update_one({"_id": worker}, {"$set": {"active": False}})
    assert len(client.get(endpoint, headers=owner).json()["rows"]) == 2
    assert client.get(endpoint, headers=worker_auth).status_code == 403
    outsider = login(client, "+919876543219")
    assert client.get(endpoint, headers=outsider).status_code == 403
    future = str(today + timedelta(days=1))
    assert client.get(f"/api/shops/{shop}/attendance/register?day={future}", headers=owner).status_code == 422
    assert client.get(f"/api/shops/{shop}/attendance/register?day=bad", headers=owner).status_code == 422
