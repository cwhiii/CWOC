# Release 20260513.2112

Fixed the loading spinner still appearing when returning from the editor. The spinner now only shows when there's no cached data in localStorage at all (true first load). Added error resilience to cache rendering so even if the full render fails early, the chits array gets populated to suppress the spinner.
