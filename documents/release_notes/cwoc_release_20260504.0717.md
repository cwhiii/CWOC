# CWOC Release 20260504.0717

Fixed four email issues:

1. Compose from email view now opens in expanded mode (increased init delay to 350ms with DOM readiness check).

2. Email expand modal now includes a Subject field between To and Body. Editable for drafts, read-only for received/sent. Syncs back to the editor title field on close.

3. Ntfy notifications for new emails now show subject and sender per email instead of generic "You have new mail." Title line shows count, body shows up to 5 email summaries.

4. Critical fix: synced emails were missing owner_id in the INSERT, so they never appeared in the inbox (the GET /api/chits query filters by owner_id). Added owner_id to _create_email_chit. Existing orphaned emails will need to be deleted and re-synced.
