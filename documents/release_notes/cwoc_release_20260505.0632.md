## Release 20260505.0632

Enhanced global search tag filtering with hierarchy and OR/AND logic. `#parent` now matches sub-tags (e.g. `#Work` finds chits tagged `Work/Projects`). Multiple `#tags` are OR by default; use `&&` between them for AND (e.g. `#work && #urgent`). Can still mix with text: `#work && #urgent meeting`.
