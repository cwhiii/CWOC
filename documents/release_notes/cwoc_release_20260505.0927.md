# Release 20260505.0927

- "Remove from Project" is no longer an auto-save action. It now marks the editor as unsaved and only executes the removal when you explicitly save. A toast confirms the pending state.
- Fixed "Add to Project" dropdown potentially failing due to non-model fields in the PUT request.
