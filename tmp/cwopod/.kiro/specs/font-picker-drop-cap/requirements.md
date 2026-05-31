# Requirements Document

## Introduction

This feature adds a comprehensive Font Picker component and Drop Cap styling to the CWOPOD book typesetting workflow. The Font Picker is a shared UI component used in both the Typeset step (interior PDF) and the Cover Builder (cover PDF). It provides access to curated print-friendly fonts, the full Google Fonts catalog via on-demand download, user-uploaded custom fonts, favorites, and recently-used fonts. The Drop Cap feature allows users to configure a decorative enlarged first letter for each chapter, with controls for font, size (in lines spanned), color, weight, style, and padding. A color cost warning system alerts users when selecting a non-black drop cap color, since this forces the entire interior to color printing at significantly higher cost. Font storage uses a persistent Docker volume, and fonts are served to the frontend via an API endpoint for @font-face injection. The Typst compiler is invoked with `--font-path` to make all managed fonts available during PDF generation.

## Glossary

- **Font_Picker**: A shared UI component (modal/panel) for browsing, searching, previewing, and selecting fonts, used in both the Typeset step and Cover Builder
- **Print_Fonts**: A curated collection of ~30-40 Google Fonts bundled as .ttf files in the source tree, known to work well for printed books
- **Google_Fonts_Catalog**: A static JSON metadata file shipped with the app containing the full Google Fonts catalog (~1,700 families), enabling browsing without an API key
- **Font_Storage**: A persistent Docker volume where downloaded and uploaded fonts are stored, not wiped on rebuild (same treatment as LLM model storage)
- **Font_API**: The backend API endpoint that serves font files to the frontend for @font-face injection and preview rendering
- **Drop_Cap**: A decorative enlarged first letter at the beginning of each chapter, rendered using Typst's placement capabilities or the community `droplet` package
- **Typography_Panel**: The settings panel in the Typeset step (before the "Generate PDF" button) containing body font, chapter heading font, and drop cap configuration
- **Color_Cost_Warning**: A prominent warning displayed when the user selects a non-black drop cap color, explaining the cost impact of switching from B&W to color interior printing
- **Template_Renderer**: The backend service (template_renderer.py) that assembles Typst source from chapters and metadata, currently hardcoding "Libertinus Serif"
- **Cover_Builder**: The existing 3-step cover design studio where fonts are currently selected from a hardcoded dropdown of 7 options

## Requirements

### Requirement 1: Font Picker Component {#requirement-1-font-picker-component}

**User Story:** As a user, I want a comprehensive font picker that lets me browse, search, preview, and select fonts from multiple sources, so that I can choose the perfect typography for my book.

#### Acceptance Criteria

1. THE Font_Picker SHALL display fonts organized into five sections: "Print Fonts", "More Fonts", "Your Fonts", "Favorites", and "Recently Used"
2. THE Font_Picker SHALL render preview text in the actual selected font for each visible font entry, using the phrase "The quick brown fox jumps over the lazy dog" as the default preview string
3. WHEN the user hovers over a font entry, THE Font_Picker SHALL display the font family name in a neutral system font (sans-serif) as a tooltip
4. THE Font_Picker SHALL use a virtualized list that loads @font-face declarations only for font entries currently visible in the viewport, unloading declarations for entries that scroll out of view
5. THE Font_Picker SHALL provide a text search input that filters fonts by family name across all sections, updating results as the user types with a debounce of 200ms
6. THE Font_Picker SHALL provide category filter buttons for: serif, sans-serif, display, handwriting, and monospace; selecting a category SHALL show only fonts matching that category across all sections
7. THE Font_Picker SHALL display a licensing note at the bottom indicating that Google Fonts are open-licensed (SIL OFL / Apache 2.0) and that user-uploaded fonts are the user's responsibility to license
8. WHEN the user clicks a font entry, THE Font_Picker SHALL close and return the selected font family name to the calling context
9. WHEN the user clicks outside the Font_Picker modal or presses Escape, THE Font_Picker SHALL close without making a selection
10. THE Font_Picker SHALL be usable as a shared component in both the Typography_Panel (Typeset step) and the Cover_Builder, accepting a callback function for the selection event

### Requirement 2: Print Fonts Section {#requirement-2-print-fonts-section}

**User Story:** As a user, I want a curated set of print-friendly fonts always available without downloading, so that I can quickly pick a font known to look good in print.

#### Acceptance Criteria

1. THE Font_Picker SHALL include a "Print Fonts" section containing 30 to 40 curated Google Fonts bundled as .ttf files in the application source tree, with each font's category (serif, sans-serif, or display) derived from the Google Fonts catalog metadata
2. THE Print_Fonts SHALL be stored in a location that is not deleted during development rebuilds (same treatment as LLM model files), and SHALL be copied into the Docker image at build time so they are present in the persistent Font_Storage volume
3. THE Print_Fonts SHALL be available for preview and selection without any network request at runtime; the Font_API SHALL serve bundled font files directly from local storage
4. THE Print_Fonts SHALL include a minimum of 10 serif fonts, a minimum of 8 sans-serif fonts, and a minimum of 5 display fonts, all selected for legibility at body text sizes (9pt–14pt) or heading use in printed books
5. IF a bundled Print_Font file is missing or unreadable at runtime, THEN THE Font_Picker SHALL omit that font from the displayed list and THE System SHALL log a warning indicating the missing font file path

### Requirement 3: Google Fonts Catalog Browsing {#requirement-3-google-fonts-catalog-browsing}

**User Story:** As a user, I want to browse the full Google Fonts catalog and download fonts on demand, so that I have access to the widest possible selection.

#### Acceptance Criteria

1. THE Font_Picker SHALL include a "More Fonts" section that lists all font families from the Google_Fonts_Catalog (approximately 1,700 families)
2. THE Google_Fonts_Catalog SHALL be a static JSON metadata file shipped with the application containing for each font family: family name, category, available variants, and the direct download URL for the regular weight .ttf file from fonts.gstatic.com
3. WHEN the user selects a font from the "More Fonts" section that is not already downloaded, THE System SHALL download the .ttf file from fonts.gstatic.com via the backend POST /api/fonts/download endpoint and store it in Font_Storage
4. WHEN a font download is in progress, THE Font_Picker SHALL display a spinner/download indicator on that font entry and disable selection until the download completes
5. IF a font download fails due to network error, THEN THE Font_Picker SHALL display an error message on that font entry and provide a "Retry" button
6. WHEN a Google Font has already been downloaded to Font_Storage, THE Font_Picker SHALL treat it as immediately available (same as Print_Fonts) on subsequent visits, indicated by the absence of a download icon

### Requirement 4: User Font Uploads {#requirement-4-user-font-uploads}

**User Story:** As a user, I want to upload my own font files, so that I can use proprietary or custom fonts in my book.

#### Acceptance Criteria

1. THE Font_Picker SHALL include a "Your Fonts" section listing all fonts the user has uploaded, displaying each font's family name and a preview of the font rendering
2. THE Font_Picker SHALL provide an upload control that accepts .ttf and .otf files, limited to one file per upload action
3. THE System SHALL enforce a maximum file size of 10 MB per uploaded font file
4. IF the user attempts to upload a file larger than 10 MB, THEN THE System SHALL reject the upload and display an error message indicating the size limit
5. IF the user attempts to upload a file with an extension other than .ttf or .otf, THEN THE System SHALL reject the upload and display an error message indicating the accepted formats
6. THE System SHALL NOT perform server-side validation of font file integrity beyond checking file extension and size
7. THE System SHALL store uploaded fonts in Font_Storage, persisted across Docker rebuilds
8. THE System SHALL scope uploaded fonts to the owning user; users SHALL NOT see or use fonts uploaded by other users
9. WHEN a font upload completes successfully, THE System SHALL add the font to the user's "Your Fonts" section immediately and display a success message indicating the font is ready for use
10. IF the user uploads a font file with the same family name as an existing uploaded font, THEN THE System SHALL replace the existing font file with the new upload and display a message indicating the font was updated
11. THE System SHALL enforce a maximum of 50 uploaded fonts per user; IF the user attempts to upload a font that would exceed this limit, THEN THE System SHALL reject the upload and display an error message indicating the maximum number of uploaded fonts has been reached

### Requirement 5: Favorites and Recently Used {#requirement-5-favorites-and-recently-used}

**User Story:** As a user, I want to mark fonts as favorites and see my recently used fonts, so that I can quickly access fonts I use often across devices.

#### Acceptance Criteria

1. THE Font_Picker SHALL include a "Favorites" section listing all fonts the user has marked as favorites, ordered alphabetically by font name
2. THE Font_Picker SHALL provide a toggle (star icon) on each font entry to add or remove the font from favorites
3. THE Font_Picker SHALL include a "Recently Used" section listing fonts the user has recently selected, ordered by most recent first
4. THE System SHALL store favorites and recently-used lists in the database, making them accessible across devices for the same user account
5. WHEN the user selects a font from any section, THE System SHALL add that font to the top of the user's recently-used list, and if the font already exists in the list, THE System SHALL move it to the top rather than creating a duplicate entry
6. THE System SHALL limit the recently-used list to the 20 most recent selections, removing the oldest entry when the limit is exceeded
7. IF the System fails to persist a favorites toggle or recently-used update to the database, THEN THE System SHALL display an error message indicating the change could not be saved and revert the local UI state to reflect the last successfully persisted state

### Requirement 6: Font Storage and Serving Architecture {#requirement-6-font-storage-and-serving-architecture}

**User Story:** As a developer, I want fonts stored persistently and served via API, so that both the frontend (for preview) and the Typst compiler (for PDF generation) can access all managed fonts.

#### Acceptance Criteria

1. THE System SHALL store all managed fonts (Print_Fonts, downloaded Google Fonts, user uploads) in a persistent Docker volume named font_storage that survives container rebuilds, and this volume SHALL be mounted to both the app and worker containers
2. THE Font_API SHALL provide an endpoint that serves individual font files to the frontend for @font-face injection, returning the file with Content-Type `font/ttf` for .ttf files and `font/otf` for .otf files
3. THE Font_API SHALL provide an endpoint that returns a list of all available fonts for the authenticated user, including: Print_Fonts (shared, all users), downloaded Google Fonts (shared, all users), and the requesting user's own uploaded fonts, each entry containing family name, category, source section, and file identifier
4. THE System SHALL invoke the Typst compiler with the `--font-path` flag pointing at the Font_Storage volume mount path so that all managed fonts are available during PDF compilation
5. THE System SHALL store downloaded Google Fonts in .ttf format, as this is the format served by fonts.gstatic.com and works natively in both the Typst compiler and web browsers
6. WHEN a user uploads an .otf file, THE System SHALL store it as-is in Font_Storage (Typst and browsers both support .otf natively)
7. IF a font file is requested from the serving endpoint and the file does not exist in Font_Storage, THEN THE Font_API SHALL return HTTP 404 with an error message indicating the font was not found
8. THE Font_Storage volume SHALL organize fonts into separate subdirectories for Print_Fonts, downloaded Google Fonts, and per-user uploads (one subdirectory per user) to prevent naming collisions between sources

### Requirement 7: Admin Bulk Font Download {#requirement-7-admin-bulk-font-download}

**User Story:** As an admin, I want to download the entire Google Fonts catalog at once, so that all fonts are available locally without per-font download delays.

#### Acceptance Criteria

1. THE System SHALL provide a "Download All Google Fonts" button in the admin Settings page
2. WHEN the admin clicks "Download All Google Fonts", THE System SHALL start a Celery background task that downloads all font families from the Google_Fonts_Catalog, skipping any font family whose .ttf file already exists in Font_Storage
3. IF a bulk download task is already in progress WHEN the admin clicks "Download All Google Fonts", THEN THE System SHALL NOT start a second task and SHALL continue displaying the progress of the existing task
4. WHILE the bulk download task is running, THE Settings page SHALL display real progress (number of fonts downloaded out of total remaining) reported by the backend task via the existing polling pattern, and the "Download All Google Fonts" button SHALL be disabled
5. WHEN the bulk download task completes, THE Settings page SHALL display a success message showing the number of fonts newly downloaded, the number skipped (already present), and the number of failures
6. IF individual font downloads fail during the bulk operation, THEN THE System SHALL skip the failed font, continue with remaining fonts, and include the count of failures and the list of failed family names in the completion report
7. WHEN the admin navigates away from the Settings page and returns while the bulk download task is still running, THE Settings page SHALL resume displaying the current progress of the in-progress task
8. THE bulk-downloaded fonts SHALL persist in Font_Storage across Docker rebuilds

### Requirement 8: Typography Settings Panel {#requirement-8-typography-settings-panel}

**User Story:** As a user, I want a typography settings panel in the Typeset step where I can configure body font, chapter heading font, and drop cap settings before generating my PDF.

#### Acceptance Criteria

1. THE Typography_Panel SHALL appear in the Typeset step before the "Generate PDF" button
2. THE Typography_Panel SHALL include a body font selector that opens the Font_Picker, defaulting to "Libertinus Serif"
3. THE Typography_Panel SHALL include the existing body font size input (already implemented)
4. THE Typography_Panel SHALL include a chapter heading font selector that opens the Font_Picker, defaulting to the currently selected body font
5. THE Typography_Panel SHALL include a chapter heading size input (numeric, in points, range 14 to 72, default 24)
6. THE Typography_Panel SHALL include an expandable "Drop Cap" section containing all drop cap settings as defined in Requirement 9
7. WHEN the user changes any typography setting, THE System SHALL persist the updated value to the book project record via PATCH /api/projects/{id}/print-options within 1 second of the field losing focus or selection completing
8. IF a typography setting save fails due to network error or server rejection, THEN THE System SHALL display an inline error message indicating the setting was not saved and retain the user's entered value in the field so they can retry

### Requirement 9: Drop Cap Configuration {#requirement-9-drop-cap-configuration}

**User Story:** As a user, I want to configure a decorative drop cap for my chapter openings, so that my book has a professional typographic flourish.

#### Acceptance Criteria

1. THE Drop Cap section SHALL include a toggle to enable or disable drop caps (disabled by default)
2. WHEN drop caps are enabled, THE Drop Cap section SHALL display controls for: font (Font_Picker, defaults to body font), size in lines spanned (numeric input, range 2-10, default 3), color (color picker, defaults to black/#000000), weight (normal or bold, default normal), style (normal or italic, default normal), and padding/offset (numeric input in points, range 0-20, default 4.0, for spacing between the drop cap letter and surrounding body text)
3. THE System SHALL apply the same drop cap settings uniformly to all chapters in the book
4. IF the user sets the drop cap size below 2 or above 10, THEN THE System SHALL clamp the value to the nearest valid bound and display the corrected value
5. IF the user sets the padding/offset below 0 or above 20, THEN THE System SHALL clamp the value to the nearest valid bound and display the corrected value
6. THE System SHALL store all drop cap settings on the book project record for use during PDF generation
7. WHEN the user disables the drop cap toggle, THE System SHALL hide the drop cap controls but preserve all configured settings so they are restored if the user re-enables drop caps
8. IF a chapter's first body text character is not a letter (e.g., quotation mark, number, or punctuation), THEN THE System SHALL apply the drop cap styling to the first letter found after any leading non-letter characters, treating the leading characters as normal body text

### Requirement 10: Drop Cap Color Cost Warning {#requirement-10-drop-cap-color-cost-warning}

**User Story:** As a user, I want to be warned when my drop cap color choice will dramatically increase printing costs, so that I can make an informed decision.

#### Acceptance Criteria

1. WHEN the user selects a drop cap color other than black (#000000), THE System SHALL display the Color_Cost_Warning within the Drop Cap section, visually distinct from surrounding controls using a warning-level visual treatment
2. THE Color_Cost_Warning SHALL explain that a non-black drop cap forces the entire interior to be printed as "color", which increases per-page printing cost
3. IF the project's page_count is greater than 0, THEN THE Color_Cost_Warning SHALL display estimated cost differences using the formula: B&W total = (page_count × $0.012) + $0.85, Color total = (page_count × $0.07) + $0.85, with both totals rounded to 2 decimal places
4. IF the project's page_count is null or 0, THEN THE Color_Cost_Warning SHALL display the per-page cost difference without a total estimate, indicating that a page count is not yet available for full calculation
5. THE Color_Cost_Warning SHALL include a concrete example in the format: "⚠️ Color interior increases printing cost significantly. For a [N]-page book: ~$[bw_total] (B&W) → ~$[color_total] (Color)." where N is the project's current page_count and totals are rounded to 2 decimal places
6. IF the project's print provider is set to Lulu, THEN THE Color_Cost_Warning SHALL indicate that Lulu uses real-time API pricing and the exact cost difference will be shown at the Print step; IF the print provider is not yet set, THEN THE System SHALL display the KDP-based estimate as the default
7. WHEN the user changes the drop cap color back to black (#000000), THE System SHALL hide the Color_Cost_Warning
8. WHEN the user saves the Drop Cap settings with a non-black color selected, THE System SHALL set the project's color_interior field to true
9. WHEN the user saves the Drop Cap settings with the color set to black (#000000) AND no other project elements require color interior, THE System SHALL set the project's color_interior field to false

### Requirement 11: Typst Template Integration {#requirement-11-typst-template-integration}

**User Story:** As a developer, I want the template renderer to accept font family names and drop cap settings, so that the generated Typst source uses the user's chosen typography.

#### Acceptance Criteria

1. THE Template_Renderer SHALL accept an optional body font family name parameter and use it in the `#set text(font: ...)` declaration; IF the body font parameter is not provided or is null, THEN THE Template_Renderer SHALL use "Libertinus Serif" as the default
2. THE Template_Renderer SHALL accept an optional chapter heading font family name and heading size, and apply them to the chapter heading text elements that display the chapter title and chapter number label
3. WHEN drop caps are enabled, THE Template_Renderer SHALL generate Typst code that renders the first letter of each chapter's body text as a drop cap using the configured font, lines spanned (2-10), color, weight, style, and padding
4. THE Template_Renderer SHALL produce a valid drop cap rendering where the first letter spans the configured number of text lines and adjacent body text wraps around it without overlapping
5. THE pdf_generator SHALL invoke the Typst compiler with `--font-path` pointing at the Font_Storage volume mount path
6. IF a specified font family is not found in Font_Storage, THEN THE System SHALL log a warning indicating which font family name was not found, and the Typst compiler SHALL fall back to its default font for the affected text elements

### Requirement 12: Cover Builder Font Integration {#requirement-12-cover-builder-font-integration}

**User Story:** As a user, I want the Cover Builder to use the same font picker instead of a hardcoded dropdown, so that I have full font selection for my cover text.

#### Acceptance Criteria

1. THE Cover_Builder SHALL replace the existing hardcoded font dropdown (serif, sans-serif, Garamond, Helvetica, Palatino, Impact, Inter) with the Font_Picker component for both the title font field and the author font field
2. WHEN the user clicks the title font field or the author font field in the Cover_Builder, THE System SHALL open the Font_Picker as a modal, and upon selection SHALL apply the chosen font only to the field that was clicked
3. THE Cover_Builder SHALL display the currently selected font family name in each font field so the user can see which font is active for title and author independently
4. WHEN the user selects a font from the Font_Picker in the Cover_Builder context, THE System SHALL load the font via @font-face from the Font_API and update the cover text preview to render the corresponding text element (title or author) in the selected font
5. THE Cover_Builder SHALL include the selected title and author font family names in the cover assembly payload sent to the backend for PDF generation
6. THE Cover_Builder SHALL use fonts from Font_Storage when generating the cover PDF via PyCairo, resolving the font file path by family name from the Font_Storage directory
7. IF a font selected for the cover is not available in Font_Storage at PDF generation time, THEN THE System SHALL fall back to the first available Print_Font with a serif category, log a warning indicating the missing font family name, and proceed with cover generation using the fallback font

### Requirement 13: Font Backend API {#requirement-13-font-backend-api}

**User Story:** As a developer, I want REST API endpoints for font management, so that the frontend can list, upload, download, and serve fonts.

#### Acceptance Criteria

1. THE Backend SHALL provide `GET /api/fonts` that returns a JSON array of all available fonts for the authenticated user, each entry containing: family name, category, source (print, google, user), and availability status (available or needs-download), ordered alphabetically by family name within each source group
2. THE Backend SHALL provide `POST /api/fonts/upload` that accepts a .ttf or .otf file upload (max 10 MB), stores it in Font_Storage scoped to the user, and returns the font metadata including the assigned font_id
3. THE Backend SHALL provide `POST /api/fonts/download` that accepts a JSON body with a Google Font family name, downloads the .ttf from fonts.gstatic.com, stores it in Font_Storage, and returns the font metadata; IF the family name does not exist in the Google_Fonts_Catalog, THEN THE Backend SHALL return HTTP 404
4. THE Backend SHALL provide `GET /api/fonts/file/{font_id}` that serves the raw font file bytes with Content-Type `font/ttf` for .ttf files and `font/otf` for .otf files; IF the font_id does not exist, THEN THE Backend SHALL return HTTP 404
5. THE Backend SHALL provide `POST /api/fonts/favorites` that accepts a JSON body with a font_identifier and toggles the favorite status (adds if not favorited, removes if already favorited), returning the new favorite state
6. THE Backend SHALL provide `GET /api/fonts/recent` that returns the user's 20 most recently selected fonts, ordered by most recently selected first
7. THE Backend SHALL provide `POST /api/fonts/bulk-download` (admin only) that triggers the Celery task to download all Google Fonts and returns a task_id for progress polling
8. IF a non-admin user calls the bulk-download endpoint, THEN THE Backend SHALL return HTTP 403
9. IF an upload exceeds 10 MB or has an invalid extension, THEN THE Backend SHALL return HTTP 422 with a descriptive error message
10. IF an unauthenticated request is made to any font endpoint, THEN THE Backend SHALL return HTTP 401

### Requirement 14: Typography Data Model {#requirement-14-typography-data-model}

**User Story:** As a developer, I want the book project database model extended to store typography and drop cap settings, so that user choices persist across sessions.

#### Acceptance Criteria

1. THE BookProject model SHALL include fields for: body_font (string, max 200 characters, nullable, default null meaning "Libertinus Serif"), heading_font (string, max 200 characters, nullable, default null meaning same as body_font), heading_size (string, max 10 characters, nullable, default null meaning "16pt")
2. THE BookProject model SHALL include fields for drop cap settings: dropcap_enabled (boolean, default false), dropcap_font (string, max 200 characters, nullable, default null meaning same as body_font), dropcap_lines (integer, default 3, minimum 2, maximum 10), dropcap_color (string, max 20 characters, default "#000000"), dropcap_weight (string, max 20 characters, default "normal"), dropcap_style (string, max 20 characters, default "normal"), dropcap_padding (float, default 4.0 representing points, minimum 0.0, maximum 20.0)
3. THE System SHALL create a database migration adding all fields from criteria 1 and 2 to the book_projects table, and creating the user_fonts, user_font_favorites, and user_font_recent tables
4. THE System SHALL create a user_fonts table storing: id (UUID primary key), user_id (UUID foreign key to users table, indexed), font_family (string, max 200 characters, not null), file_path (string, not null), source (enum: print, google, upload, not null), category (string, max 100 characters), created_at (timestamp with timezone), with a unique constraint on (user_id, font_family)
5. THE System SHALL create a user_font_favorites table storing: id (UUID primary key), user_id (UUID foreign key to users table, indexed), font_identifier (string, max 200 characters, not null), created_at (timestamp with timezone), with a unique constraint on (user_id, font_identifier) to prevent duplicate favorites
6. THE System SHALL create a user_font_recent table storing: id (UUID primary key), user_id (UUID foreign key to users table, indexed), font_identifier (string, max 200 characters, not null), selected_at (timestamp with timezone, updated on each selection), with a unique constraint on (user_id, font_identifier) and a maximum of 20 recent entries retained per user
7. IF a user record is deleted, THEN THE System SHALL cascade-delete all associated rows in user_fonts, user_font_favorites, and user_font_recent tables
