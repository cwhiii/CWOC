## CWOC Release 20260502.1828

Added Disable/Enable button for the ntfy service in the Dependent Apps section of Settings. The button toggles ntfy notifications on/off while preserving the server config for easy re-enabling. Status icon shows ⚫ when disabled.

Also fixed independent alert timer ntfy notifications opening to the wrong tab — they now deep-link to the Alarms tab in independent mode instead of whatever tab was last active. Added `?tab=` URL parameter support to the dashboard for this.
