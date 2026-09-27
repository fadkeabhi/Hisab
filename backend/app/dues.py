"""Receipts live in the receiving cashbook day and commit with its balance.

A unique shop-wide receipt sequence prevents concurrent over-collection, even
across two day documents, without requiring a Mongo replica set transaction.
Credit principal cannot be edited; an uncollected open-day entry can be deleted
and re-entered. Deletion reserves the first receipt key, racing safely with payment.
"""

from fastapi import HTTPException


def due_key(day_id, entry_id):
    return f"{day_id}:{entry_id}"


def receipts_for(db, shop_id, key):
    receipts = []
    for day in db.hishob_days.find(
        {"shop_id": shop_id, "due_keys": key}, {"transactions": 1, "cancelled_due_keys": 1}
    ):
        if key in day.get("cancelled_due_keys", []):
            raise HTTPException(409, "This unpaid entry was cancelled. Refresh the register.")
        receipts.extend(
            t for t in day["transactions"] if t.get("due_key") == key and t["type"] == "DUE_COLLECTION"
        )
    return sorted(receipts, key=lambda t: t["receipt_sequence"])


def reserve_receipt(day, key, sequence):
    day.setdefault("due_receipt_keys", []).append(f"{key}:{sequence}")
    if key not in day.setdefault("due_keys", []):
        day["due_keys"].append(key)


def protect_credit_change(db, day, entry, values):
    if entry["type"] == "DUE_COLLECTION":
        raise HTTPException(422, "Payment receipts cannot be edited or deleted.")
    if entry["type"] != "CREDIT_SALE":
        return
    if values is not None:
        if values["type"] != "CREDIT_SALE" or values["amount"] != entry["amount"]:
            raise HTTPException(
                422,
                "An unpaid sale’s amount cannot be changed. Before collecting, delete and re-add it with the correct amount.",
            )
        return
    key = due_key(day["_id"], entry["id"])
    if receipts_for(db, day["shop_id"], key):
        raise HTTPException(422, "This sale has payments and cannot be deleted.")
    reserve_receipt(day, key, 1)
    day.setdefault("cancelled_due_keys", []).append(key)
