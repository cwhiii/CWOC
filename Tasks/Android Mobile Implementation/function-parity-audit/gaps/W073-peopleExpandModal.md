# W73-W74: People Expand Modal

## What the web function does
Opens a full-screen modal for the People zone, allowing more space to manage people, shares, and the contact tree. Useful on mobile where the inline zone is cramped.

## What exists on Android
`showExpandModal` state variable is declared in PeopleZone (line 1283) but is never set to true — no button triggers it and no modal renders when it would be true. It's a stub.

## What's missing
The full-screen people expand modal. The contact browser (W66) partially covers this use case, but the web's expand modal shows the entire people zone (chips + sharing + tree) in a larger view.

## Fix needed
Wire the expand button to set `showExpandModal = true` and render a full-screen Dialog or ModalBottomSheet containing the complete PeopleZone content.
