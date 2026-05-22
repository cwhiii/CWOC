# W140-W147: Bundle Tab Drag Reorder

## What the web feature does
Enables drag-and-drop reordering of email bundle tabs in the email view toolbar. Users can rearrange the order of bundle tabs by dragging them.

## What exists on Android
BundleToolbar composable renders bundle tabs but has no drag-to-reorder functionality.

## What's missing
Drag-to-reorder for bundle tabs. The API endpoint for persisting reorder exists (`PUT /api/bundles/reorder`).

## Fix needed
Add drag-to-reorder gesture to bundle tab chips in BundleToolbar, then call BundleRepository to persist the new order.
