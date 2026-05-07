## Release 20260506.1842

Fixed paginate email setting not persisting. The `paginate_email` field was missing from the settings save endpoint's INSERT OR REPLACE statement, so it was being reset to NULL on every save. Now properly included in both the settings dict and the SQL INSERT.
