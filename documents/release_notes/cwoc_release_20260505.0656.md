## Release 20260505.0656

Global search now supports full boolean logic for tag filtering: `&&` (AND, default), `||` (OR), `!` (NOT), and `()` for grouping. Example: `(#work || #personal) && !#done meeting`. Tags match hierarchically — `#parent` finds sub-tags too. Info hint below search bar updated with syntax reference.
