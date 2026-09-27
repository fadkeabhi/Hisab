# One cashbook, three ways to record sales

Choose **Hishob → Choose Hishob method** before starting a day, or **Account → Shop settings**. The setting applies to new days only. Existing shops and older records default to **Enter sales** to preserve their calculations. A day keeps its method even when the owner changes the shop setting later.

| Method | Best for | Owner records | Result |
| --- | --- | --- | --- |
| Count cash | A shop without independent sales records | Opening cash, expenses, other cash movements, end-of-day cash count, digital/credit sales if any | Estimated cash sales; cash difference is **not measurable** |
| Enter sales | A notebook or simple daily sales register | Individual sales or one net daily total for each payment type, plus expenses and other cash movements | Expected cash compared with counted cash |
| Use billing totals | A shop with a POS/billing report | Expenses and other cash movements during the day; grand total or payment breakdown at closing | Recorded sales; cash difference only when cash sales can be determined |

The billing mode is manual entry of report totals, not an automatic POS integration. No separate shops/apps or duplicate cashbooks are required.

## One billing close screen

Enter **Total sales from billing**. The old Payment breakdown / Total sales only selector has been removed. If your machine gives separate cash, digital and credit amounts, add them to get its grand total. **I know the totals** is selected by default: enter combined UPI/card receipts for today’s sales. **Today’s unpaid sales** is read-only, derived from individual credit-sale entries less their same-day collections.

`cash sales = billing grand total − UPI/card sales − today’s remaining unpaid sales`

Example: total ₹10,000, digital ₹3,000 and unpaid transactions ₹500 gives cash sales ₹6,500. Count the galla to compare physical cash against the expected amount. Include same-day digital credit collections in the UPI/card sales total, but exclude collections of older dues. Do not subtract unpaid sales from the grand total yourself.

Choose **Not known** if digital totals are unavailable. The app saves the grand total and physical cash but leaves cash sales and the difference unknown. Recorded unpaid entries remain known. Sales without a payment breakdown represent the remaining cash/digital portion, excluding known credit.

## Customer dues

Open **Hishob → Customer dues**, or use **Add transaction → Credit sales (unpaid)** in any method. Record the customer/bill reference, amount and description. For a partly paid bill, record only its unpaid portion as the credit entry; include the paid portion in the normal sales totals. Never enter an old debt as a new sale today.

The register shows the sale date, original amount, received amount, remaining amount and receipt history. Search by customer or description; filter unpaid/part-paid, paid or all. Owners and managers with live Hishob access can view it; collecting payments requires the existing add-transactions permission. A receipt must be entered in today’s open day.

- Receive a partial or full payment by Cash or UPI/card/bank. A zero remaining balance automatically marks the entry Paid.
- A same-day receipt reduces that day’s credit sales. Entry mode shifts the payment to cash/digital sales. Billing/count modes include it in the sales totals supplied/estimated at closing; it is not added twice.
- A later cash receipt adds to Other cash in on the receiving day. A later digital receipt is recorded without changing the galla. Neither increases the receiving day’s sales or rewrites the original closing.
- Cash receipts appear automatically in the cashbook; do not add a second cash-in entry. Split mixed cash/digital payments into separate receipts.
- Receipts are immutable. An uncollected credit entry can be deleted with a reason while its original day is open; its amount cannot be edited in place. Delete/re-add an incorrect unpaid amount before collecting. Once payments exist, the sale cannot be deleted. Customer/description corrections retain the original amount.
- Old manual credit totals in preserved closings have no customer records and cannot be automatically allocated or collected in this register. The close screen identifies a preserved legacy total. No customer balances are invented from those totals.

Payment and cash movement commit together in the receiving day document. Optimistic day revisions and a unique receipt-sequence index prevent duplicate/concurrent over-collection. No replica-set migration or new environment variables are needed.

While a day is open the balance is labelled **Current Galla**, based on recorded cash movements. Billing and cash-count days do not know sales until closing, so they show an unavailable balance with an explanation. **Expected Galla** is used for closing reconciliation.

## The important distinction

Opening cash, expenses and a final cash count alone cannot reveal an independent shortage. Unknown sales and missing money cannot both be solved from the same count. Count cash therefore shows **estimated sales** and an unavailable difference, never a misleading zero difference. An unrecorded withdrawal or expense can make this estimate wrong.

When sales are recorded independently:

```
Expected cash before closing transfers
  = opening cash + cash sales + other cash in
    − cash expenses − cash supplier payments
    − bank/withdrawal entries already recorded

Difference = counted cash − expected cash before closing transfers
```

In the Count cash method:

```
Estimated net cash sales
  = counted cash − opening cash − other cash in
    + cash expenses + cash supplier payments
    + bank/withdrawal entries already recorded
```

UPI/card sales are recorded separately and never increase physical cash. Unpaid credit sales contribute to recorded sales, but not cash. Collection of older customer dues or owner top-ups is **Other cash in**, not today's sales. Digital expenses and supplier payments are recorded with **Paid from → UPI / bank / card** and do not reduce the galla.

Enter customer sale amounts after returns, **including any tax charged**, using the same convention consistently. For cash, use money received for today’s sales; for digital, use the customer sale amount rather than a payout net of fees. Do not use a tax-exclusive revenue figure to reconcile tax-inclusive cash receipts. Sales values are nonnegative; negative-net-sales days, itemized refunds, GST reports, credit balances and payment-settlement reconciliation are outside this cashbook change. These summaries are not profit calculations or statutory revenue reports.

## Count first, then remove cash

At closing:

1. Enter the physical cash count **before** removing any additional money.
2. Review the sales estimate or cash difference. Recorded-sales methods require a note for a shortage/surplus.
3. Enter cash actually being removed for the bank and/or taken home now. Do not repeat transfers already entered during the day. A future plan remains zero until the money is removed.
4. Hishob shows **cash kept for next day** and carries that remaining amount into the next opening.

Closing transfers are cash movements, not expenses, and cannot exceed the counted cash. The saved expected/actual closing cash both represent cash **remaining after** these closing transfers; their difference is unchanged. The original count and both transfers are saved separately with the closing snapshot and audit.

Example: opening ₹1,000, cash expenses ₹500, count ₹5,500 means estimated cash sales ₹5,000. Digital sales ₹2,000 and credit sales ₹300 bring the day's sales to ₹7,300, including the cash estimate. Removing ₹3,000 for the bank and ₹500 for home leaves ₹2,000 for tomorrow. None of these transfers reduces sales or becomes an expense.

## Monthly reports

Open **Hishob → Calendar & sales** and change the month. The report shows:

- Total sales, with **recorded sales** and **estimated cash sales** separate.
- Cash, UPI/card and unpaid-credit sales.
- Sales without a payment breakdown, included in recorded sales and the overall total but not assigned to any payment type. The report identifies how many billing days could not be reconciled. A missing breakdown is never interpreted as zero sales.
- Expenses, supplier payments, bank transfers and withdrawals.
- Closed days included, open days excluded and dates not started. Not-started dates may be shop holidays; they are not assumed to have zero sales.

Only the current version of each closed day counts. Reopening immediately removes that day from the report until it is closed again. Earlier snapshots remain accessible but are never counted twice. Business dates use the shop's timezone. A mixed month can contain all three methods; only the cash-sales portion of Count cash days goes into the estimated subtotal.

## Compatibility, permissions and APIs

- Settings: `hishob_mode = ENTRIES | COUNTED | BILLING` on the existing shop-settings API. Only the owner can change it.
- New days copy that setting. Historical records without a mode are read as `ENTRIES`; no bulk rewrite is required.
- Existing transaction API adds `DIGITAL_SALE`, `CREDIT_SALE` and `payment_method = CASH | DIGITAL` for expenses/supplier payments. Cash/digital-sale entries are rejected in Count cash/Billing modes to prevent counting sales twice; individual CREDIT_SALE entries are allowed in every mode.
- New days set `credit_tracking=true`; close derives unpaid sales from entries. A supplied credit total must match. `billing_input=SPLIT` remains accepted for old clients, but the UI always sends `TOTAL` with the billing grand total. Digital totals may be omitted when unknown. Known manual credit totals from legacy closings are preserved once as an explicit legacy balance, alongside new transaction-based dues. New manual credit totals are rejected; historical snapshots are preserved.
- `GET /api/shops/{shop_id}/hishob/dues?status=OPEN|PAID|ALL&q=...&page=1` returns a paginated register and totals for the active filters.
- `POST /api/shops/{shop_id}/hishob/days/{day_id}/due-payments` takes day revision, source day/entry IDs, amount, CASH or DIGITAL payment method, optional note and an idempotent request ID. It creates an audited DUE_COLLECTION receipt and updates the cashbook atomically.
- `GET /api/shops/{shop_id}/hishob/monthly-summary?month=YYYY-MM` returns decimal-string totals and coverage counts. Owners and managers with live Hishob access can read it; workers and other shops cannot.
- Transaction search cash-in/out totals exclude digital and credit movements. Search covers transaction entries; totals and transfers entered on closing are shown in day details and monthly reports.
- Integer-paise arithmetic, optimistic revisions, transaction idempotency, soft deletion, audit snapshots and owner-only reopening remain in place. Closing transfers replace the previous closing allocation on a correction; they are not appended again.
- Reopening preserves the last count/allocations for review and pre-fills sales from the preserved closing. New totals must be confirmed on close. Already-carried openings on later days are unchanged; correcting those still requires an explicit reason.

No new environment variables or database collections are needed. Startup adds receipt-sequence uniqueness and due lookup indexes; the existing unique shop/date index supports day and month queries.

## Files and validation

Calculation rules: `backend/app/cashbook.py`. API/schema updates: `backend/app/{financial_schemas,schemas}.py`, `backend/app/routers/hishob.py`. Mobile: shop settings, financial types, closing form, day overview, breakdown, calendar/monthly summary and search explanation. Tests: `backend/tests/test_cashbook_modes.py`, `mobile/e2e/cashbook.spec.ts`, plus existing regression suites.

Use the run commands in the root README. Select a method **before creating today's day**; the current open day intentionally keeps its original method. Test expenses paid by cash/digital, a cash shortage in billing mode, bank/home removals, monthly totals, and reopening/correcting a closed day.
