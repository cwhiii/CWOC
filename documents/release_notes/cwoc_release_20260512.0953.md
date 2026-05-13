# Release 20260512.0953

Fixed contact editor date fields still loading as Jan 1 2026. Added a custom parseDate function to Flatpickr that handles both ISO format (YYYY-MM-DD from the database) and display format (YYYY-Mon-DD from user input). Used an IIFE closure to properly capture the date value for each setTimeout callback, preventing variable hoisting issues across multiple date entries.
