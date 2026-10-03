# lockedinnn — build plan notes

Supplementary implementation notes that build on the main MVP build plan. Each
section here is additive to Phases 0–7 of the existing build.

## Payment architecture

Payment is direct-pay, no custody: a company pays the talent themselves, and the
platform never holds job money. The mechanics below replace the earlier
"merchant QR" idea.

### Implementation detail: lockedinnn-hosted payment page, not a Juice merchant QR

The QR doesn't need to be MCB's own merchant QR format at all.
lockedinnn generates its own QR, encoding a link to a page it controls.

Example: Sarah registers with payment method MCB, account holder
"Sarah Doe", account number 123456789. The system generates a QR code
containing the URL https://lockedinnn.mu/p/sarah/abc123 (abc123 standing
in for a long random token). When a company scans it, they land on a
lockedinnn-hosted page showing:

  Pay Sarah Doe
  MCB
  Account ending ****6789
  Amount: Rs 5,000
  [Open MCB Juice]
  Reference: JOB-1847

The company completes the transfer themselves inside their own Juice app.

This removes the MCB merchant-QR dependency and onboarding friction
entirely -- any talent with a bank account or Juice number can be paid
this way, no special merchant status required.

Token design: the random string after the username (abc123 in the
example) is the actual security boundary, not the username in the URL.
It must be long and cryptographically random (not sequential or short),
generated fresh per payment request at the moment a company approves a
submission, tied to one specific application/submission so the page
shows exactly that job's amount and reference, and state-aware -- once
talent confirms receipt, the same link flips to "this job is already
paid" instead of showing live payment details. Lookups on this route
must be rate-limited so the token can't be brute-forced.

Schema: a payment_requests table -- id (the token), application_id,
amount_cents, reference_code (short, human-typeable, e.g. JOB-1847,
separate from the secure token), status (pending, viewed, confirmed,
expired), created_at, viewed_at. The masked account number is derived
for display; the full number is read from payout_details only on this
page, never embedded in the QR itself.
