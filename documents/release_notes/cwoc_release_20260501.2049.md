## Release 20260501.2049

Fixed desktop project master reorder. The column dragover handlers were correctly skipping during project drags, but no element between the column and the wrapper was calling preventDefault on dragover — so the browser rejected the drop. Added a dragover handler on each projectBox that accepts project reorder drags, ensuring preventDefault is called at the right DOM level for the drop to be accepted.
