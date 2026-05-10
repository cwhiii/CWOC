# CWOC Release 20260509.1829

Added Email Thread Nests — attach any non-email chit to an existing email thread via a nest button in the editor title row. Nested chits appear inline within the email thread's expanded view (both in the Email tab and the editor's thread display), sorted by due date or start date. Includes a thread picker modal for selecting which thread to nest into, backend validation ensuring nest references point to valid email chits, cascade cleanup on permanent deletion, help page documentation, and 11 property-based correctness tests covering all invariants.
