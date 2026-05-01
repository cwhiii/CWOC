# Release 20260501.1543

Fixed: compact view assign badge not updating when a user is set as assigned. The issue was that _onAssignedToChange() skipped re-rendering when the user was already a manager. Now all code paths (including "None" selection and already-manager) call _renderPeopleChips() to ensure the assign badge reflects the current state.
