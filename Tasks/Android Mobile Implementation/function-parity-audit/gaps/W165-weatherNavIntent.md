# W165-W167: Weather → Calendar Navigation Intent

## What the web feature does
From the weather page, clicking a day block navigates to the Calendar Day view for that date, then flashes/highlights chits at that weather location.

## What exists on Android
Nothing. Weather screen doesn't navigate to calendar.

## Fix needed
Add tap action on weather day cells that navigates to Calendar screen with the selected date and location as parameters.
