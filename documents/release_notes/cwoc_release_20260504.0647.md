# CWOC Release 20260504.0647

Fixed email expand state not persisting on reply/forward — the expand modal was being removed from the DOM before the navigation check. Now uses a `_emailExpandModalOpen` flag that survives the modal close. Compose from email tab also opens in expanded mode.
