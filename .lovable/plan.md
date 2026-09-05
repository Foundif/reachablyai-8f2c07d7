# Wati-style Message Wallet for Coexistence Clients

## Goal
Clients never touch a Meta card. You hold the Meta billing; they buy message credits from you in-app via Razorpay (same keys as subscriptions — it's YOUR account collecting, since you pay Meta). The wallet stops being "dummy" and becomes the real pay-as-you-go meter.

## How clients pay (the Wati model)
1. **Prepaid recharge packs** (already partially built — we make them the only way to send):
   - 1,000 msgs — ₹1,099 · 3,000 — ₹2,999 · 6,000 — ₹5,999 · 10,000 — ₹8,999
   - Paid in-app via Razorpay (UPI/cards/netbanking — client pays you, not Meta).
   - Every new workspace gets a **free 250-message trial pack** so it works before first recharge.
2. **Credit buffer** (already exists): keep sending ~100 msgs past zero, settled on next recharge.
3. **Auto-recharge** (optional toggle): when balance drops below 100, auto-create a Razorpay link for the chosen pack and WhatsApp it to the owner — one tap to top up.

## Making credits real (not dummy)
Today only the inbox single-send charges a credit. Fix the meter everywhere:

- **Charge on every outbound message** — campaigns, automations, webhook triggers, auto-replies — not just inbox sends. Refund automatically if Meta rejects the send (already the pattern in whatsapp-send).
- **Meta-category pricing**: instead of flat 1 credit = 1 message, price by Meta conversation category so you never lose money:
  - Utility template = 1 credit · Marketing template = 2 credits · Service/free-form reply = 1 credit (inbound 24h window).
  - Markup is baked into pack prices (₹1.10/msg avg vs Meta's ~₹0.35–0.88 in India) → ~30–60% margin, like Wati's 20–40%.
- **Inbound messages stay free** for the client (Meta doesn't charge for user-initiated).

## What the client sees
1. **Billing page → Message wallet** section (exists) upgraded:
   - Big balance, "Recharge" button → pack picker → Razorpay checkout → instant credit.
   - Recharge history (credit_transactions) with invoices.
   - Low-balance banner across the app when balance < 100, blocking banner at 0 (buffer off) or buffer exhausted.
2. **Campaigns/bulk send**: pre-flight check shows "This campaign needs ~2,400 credits, you have 1,100 — Recharge" before starting.
3. No card-on-Meta step anywhere; the "No card on Meta needed" badge stays true.

## Build list
1. **Enforce charging everywhere** — call `chargeCredits` in campaign-dispatch, automations, generic-webhook, auto-reply paths (shared helper already exists).
2. **Category-aware pricing** — extend `chargeCredits(admin, ws, msgs, category)`; marketing=2, utility=1, service=1.
3. **Recharge UI** — pack grid + Razorpay checkout on Billing page (functions exist: razorpay-create-order kind='recharge', razorpay-verify credits the wallet); add transaction history list.
4. **Trial grant** — 250 free credits on workspace creation.
5. **Low-balance UX** — global banner + campaign pre-flight credit check.
6. **Auto-recharge link** — toggle in credit settings; sends owner a Razorpay payment link on WhatsApp when balance < 100 (reuses razorpay-create-order).

## Not building (keeps it simple like Wati)
- No monthly invoicing/postpaid — prepaid only.
- No per-category pack splitting — one wallet, category multiplier handles margin.

## Effort
~1 build pass: 4 edge-function touch-ups, 1 Billing UI section, 1 global banner. No new tables needed (message_credits, credit_settings, credit_transactions, packs all exist).
