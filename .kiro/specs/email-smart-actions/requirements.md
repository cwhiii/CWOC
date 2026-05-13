# Requirements Document

## Introduction

Email Smart Action Buttons generalizes the existing hardcoded tracking/flight detection in the email dashboard into a configurable, extensible system. The system detects actionable items in emails (packages, flights, hotels, rental cars, events, restaurants, orders, rideshares) and renders launcher buttons on email cards. Users can customize detection by enabling/disabling built-in detectors, adding custom detectors, and controlling display behavior. The existing `shared-smart-links.js` registry pattern is the foundation — this spec covers the remaining gaps: user configuration, custom detectors, improved detection accuracy, and a settings UI.

## Glossary

- **Detector**: A rule definition that matches patterns in email text and produces an actionable link. Each detector has a category, keywords, regex, URL template, and display metadata.
- **Detector_Registry**: The in-memory array of all active detector definitions (built-in and custom) used by the detection engine.
- **Smart_Link**: The output of a successful detector match — contains category, name, code, URL, icon, and label.
- **Detection_Engine**: The function that runs all active detectors against an email chit's text fields and returns an array of Smart_Links.
- **Custom_Detector**: A user-defined detector created through the settings UI, stored in the backend database.
- **Category**: A grouping label for detectors (Package, Flight, Hotel, Rental, Event, Restaurant, Transit, Order, Custom).
- **Keyword_Gate**: An optional array of regex patterns that must match before the main extraction regex is attempted. Reduces false positives for detectors with generic number formats.
- **URL_Template**: A URL string containing `{code}` placeholder that gets replaced with the extracted match value.
- **Settings_API**: The backend REST endpoint for persisting user preferences related to smart action configuration.

## Requirements

### Requirement 1: Built-in Detector Coverage

**User Story:** As a user, I want the system to detect a comprehensive set of actionable email types out of the box, so that I get useful action buttons without any configuration.

#### Acceptance Criteria

1. THE Detector_Registry SHALL include built-in detectors for Package tracking (UPS, FedEx, USPS, DHL, Amazon, UniUni, OnTrac, LaserShip), Flights, Hotels (Marriott, Hilton, IHG, Hyatt, Airbnb, Booking.com, VRBO), Rental Cars (Enterprise, Hertz, Avis/Budget, Turo), Events (Ticketmaster, Eventbrite, AXS, StubHub, SeatGeek), Restaurants (OpenTable, Resy), Transit (Uber, Lyft), and Orders (Amazon, Apple, Best Buy, Walmart, Target)
2. WHEN a built-in detector matches an email, THE Detection_Engine SHALL return a Smart_Link with the correct category, provider name, extracted code, resolved URL, icon path, and button label
3. WHEN multiple detectors from different categories match the same email, THE Detection_Engine SHALL return one Smart_Link per matching category up to the configured maximum

### Requirement 2: Detection Engine Accuracy

**User Story:** As a user, I want the detection to be accurate with minimal false positives, so that action buttons are trustworthy and useful.

#### Acceptance Criteria

1. WHEN a detector has a Keyword_Gate defined, THE Detection_Engine SHALL only attempt the extraction regex if at least one keyword pattern matches the email text
2. WHEN a detector has no Keyword_Gate (null keywords), THE Detection_Engine SHALL attempt the extraction regex directly against the email text
3. THE Detection_Engine SHALL scan the concatenation of the email title, email_subject, email_body_text, and email_from fields for matches
4. WHEN multiple detectors within the same category could match, THE Detection_Engine SHALL use only the highest-priority (lowest priority number) match for that category
5. WHEN a detector defines a custom _extract function, THE Detection_Engine SHALL use that function to derive the code from the regex match groups instead of using the default first capture group

### Requirement 3: Multiple Results Per Email

**User Story:** As a user, I want to see action buttons for all actionable items in an email (e.g., a travel itinerary with both a flight and hotel), so that I can access each service directly.

#### Acceptance Criteria

1. THE Detection_Engine SHALL support returning multiple Smart_Links from a single email, one per distinct category
2. THE Detection_Engine SHALL accept a configurable maxResults parameter that limits the total number of Smart_Links returned
3. WHEN the number of matches exceeds maxResults, THE Detection_Engine SHALL return the matches ordered by detector priority across all categories

### Requirement 4: User-Configurable Custom Detectors

**User Story:** As a user, I want to create my own custom detectors for services not covered by the built-in set, so that I can get action buttons for any recurring actionable email type.

#### Acceptance Criteria

1. WHEN a user creates a Custom_Detector through the settings UI, THE Settings_API SHALL persist the detector definition to the database
2. THE Custom_Detector definition SHALL include: name, category, keyword patterns (as text), extraction regex (as text), URL template with {code} placeholder, button label, and icon selection
3. WHEN the email dashboard loads, THE Detection_Engine SHALL include all active Custom_Detectors in the Detector_Registry alongside built-in detectors
4. WHEN a user edits an existing Custom_Detector, THE Settings_API SHALL update the stored definition and THE Detection_Engine SHALL use the updated definition on next email render
5. WHEN a user deletes a Custom_Detector, THE Settings_API SHALL remove the definition and THE Detection_Engine SHALL no longer include that detector in matching

### Requirement 5: Enable/Disable Detectors

**User Story:** As a user, I want to enable or disable individual built-in detectors or entire categories, so that I only see action buttons for services I actually use.

#### Acceptance Criteria

1. WHEN a user disables a specific detector in settings, THE Detection_Engine SHALL skip that detector during matching
2. WHEN a user disables an entire category in settings, THE Detection_Engine SHALL skip all detectors in that category during matching
3. WHEN the settings page loads, THE Settings_UI SHALL display all built-in detectors grouped by category with toggle controls for each detector and each category
4. THE Settings_API SHALL persist detector enable/disable preferences to the database
5. WHEN no preferences have been saved, THE Detection_Engine SHALL treat all built-in detectors as enabled by default

### Requirement 6: Action Button Rendering

**User Story:** As a user, I want action buttons to be visually clear, consistent with the parchment theme, and easy to tap on mobile, so that I can quickly access the linked service.

#### Acceptance Criteria

1. WHEN Smart_Links are detected for an email card, THE Email_Card_Renderer SHALL display a button for each Smart_Link showing the provider icon and button label
2. WHEN a user clicks an action button, THE Email_Card_Renderer SHALL open the Smart_Link URL in a new browser tab
3. THE action buttons SHALL have a minimum tap target of 44x44 CSS pixels for mobile accessibility
4. WHEN an action button's icon file fails to load, THE Email_Card_Renderer SHALL display a fallback category icon or text-only label
5. THE action button click event SHALL NOT propagate to the parent email card (preventing unintended card selection or navigation)

### Requirement 7: Settings UI for Smart Actions

**User Story:** As a user, I want a dedicated section in settings to manage smart action detectors, so that I can configure which detectors are active and create custom ones.

#### Acceptance Criteria

1. THE Settings_Page SHALL include a "Smart Actions" section that displays all detector categories and their detectors
2. WHEN a user opens the Smart Actions settings section, THE Settings_UI SHALL show each category as a collapsible group with a category-level toggle and individual detector toggles within
3. WHEN a user clicks "Add Custom Detector," THE Settings_UI SHALL display a form with fields for name, category, keywords, regex pattern, URL template, label, and icon
4. THE Settings_UI SHALL validate that the regex pattern field contains a valid regular expression before allowing save
5. THE Settings_UI SHALL validate that the URL template contains the {code} placeholder before allowing save
6. WHEN a user saves custom detector settings, THE Settings_UI SHALL provide visual confirmation of successful save

### Requirement 8: Data Persistence

**User Story:** As a user, I want my smart action preferences and custom detectors to persist across sessions, so that I don't have to reconfigure them each time.

#### Acceptance Criteria

1. THE Settings_API SHALL store smart action preferences (enabled/disabled states) as a JSON field in the user settings
2. THE Settings_API SHALL store Custom_Detector definitions as JSON in the database
3. WHEN the frontend loads, THE Detection_Engine SHALL fetch the current preferences and custom detectors from the Settings_API and configure the Detector_Registry accordingly
4. IF the Settings_API is unreachable during load, THEN THE Detection_Engine SHALL use all built-in detectors with default enabled states

### Requirement 9: Order Confirmation Detection

**User Story:** As a user, I want order confirmation emails to show action buttons linking to order status pages, so that I can quickly check on purchases.

#### Acceptance Criteria

1. THE Detector_Registry SHALL include detectors for major e-commerce order confirmations (Amazon, Apple, Best Buy, Walmart, Target)
2. WHEN an order confirmation email matches, THE Detection_Engine SHALL extract the order number and produce a Smart_Link to the retailer's order status page
3. WHEN the email sender domain matches a known retailer AND the email contains order-related keywords, THE Detection_Engine SHALL attempt order number extraction using the retailer-specific regex pattern
