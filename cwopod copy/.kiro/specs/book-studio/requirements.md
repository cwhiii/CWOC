# Requirements Document

## Introduction

C.W.'s Open Print-On-Demand (C.W.'s O-POD) is a multi-user web application that transforms public domain texts into professionally formatted, print-ready physical books. The system ingests texts from public domain sources (Project Gutenberg, Standard Ebooks) or user uploads, applies optional typo correction, generates AI-powered cover art, typesets the interior to trade paperback standards, and submits orders to print-on-demand services. The goal is a near-one-click experience that handles the entire pipeline from source text to shipped book.

## Glossary

- **CWOPOD**: The complete web application system
- **Source_Fetcher**: Module responsible for searching, discovering, and downloading public domain texts from supported sources
- **Typeset_Engine**: Module that converts ingested text into print-ready PDF interiors using Pandoc and LaTeX/Typst
- **Cover_Generator**: Module that produces AI-generated cover art, manages the cover builder interface, and assembles final print-ready covers
- **Print_Service_Integrator**: Module that interfaces with print-on-demand providers (Lulu xPress, BookVault, KDP Print) for pricing, ISBN management, and order submission
- **Collection_Manager**: Module that manages the user's bookshelf, batch ordering, and book lifecycle
- **Quality_Controller**: Module that performs optional LLM-based typo detection on ingested texts
- **AI_Engine**: Configurable subsystem providing LLM and image generation capabilities via local models or external API keys
- **Cover_Builder**: The drag-and-drop interface where users assemble cover images with title/author overlays using templates
- **Attribution_Page**: A dedicated page included in every book featuring source metadata, QR codes, and provenance information
- **Info_Page**: A front-matter page in every book containing a link and QR code to the C.W.'s O-POD tool itself
- **Bookshelf**: The collection view where a user's completed book projects are stored and managed
- **Print_Provider**: An external print-on-demand service (Lulu xPress, BookVault, or KDP Print)

## Requirements

### Requirement 1: Source Search and Discovery

**User Story:** As a user, I want to search for public domain books across multiple sources from within the tool, so that I can find and select texts to turn into printed books without leaving the application.

#### Acceptance Criteria

1. WHEN a user enters a search query of at least 2 characters, THE Source_Fetcher SHALL search title, author, and subject fields across all enabled sources (Project Gutenberg, Standard Ebooks) and return up to 50 matching results within 10 seconds
2. WHEN search results are displayed, THE Source_Fetcher SHALL indicate which sources have a given title available
3. WHEN search results are displayed, THE Source_Fetcher SHALL show a quality label for each source indicating its curation level (e.g., Standard Ebooks labeled as professionally curated and formatted)
4. THE Source_Fetcher SHALL support adding new source providers without requiring changes to the search interface
5. WHEN a user selects a search result, THE Source_Fetcher SHALL download the full text in EPUB or plain text format and associated metadata (title, author, publication date, language, and source URL) from the chosen source within 30 seconds
6. IF a search query returns no matching results from any enabled source, THEN THE Source_Fetcher SHALL display a message indicating no results were found and suggest refining the query
7. IF an enabled source is unreachable during a search, THEN THE Source_Fetcher SHALL return results from the remaining available sources and indicate which sources could not be reached
8. IF a download fails or times out after selection, THEN THE Source_Fetcher SHALL notify the user of the failure and allow the user to retry the download

### Requirement 2: User Document Upload

**User Story:** As a user, I want to upload my own documents in common formats, so that I can create printed books from texts I already have.

#### Acceptance Criteria

1. THE Source_Fetcher SHALL accept uploads in EPUB, DOCX, plain text, and PDF formats with a maximum file size of 200 MB per document
2. WHEN an EPUB file containing embedded illustrations is uploaded, THE Source_Fetcher SHALL preserve all images and their placement within the text
3. WHEN a document is uploaded, THE Source_Fetcher SHALL extract available metadata (title, author, publication date) from the file
4. IF an uploaded file is in an unsupported format, THEN THE Source_Fetcher SHALL reject the upload and display the list of supported formats
5. IF an uploaded file in a supported format cannot be parsed due to corruption or encoding errors, THEN THE Source_Fetcher SHALL reject the upload and display an error message indicating the file is unreadable
6. IF no metadata fields are present in the uploaded file, THEN THE Source_Fetcher SHALL accept the upload and leave the metadata fields (title, author, publication date) empty for manual entry
7. WHEN a document upload and extraction completes successfully, THE Source_Fetcher SHALL display a confirmation indicating the document title (or filename if title metadata is absent) and the number of extracted pages or sections

### Requirement 3: Optional Typo Correction

**User Story:** As a user, I want the system to optionally detect and suggest typo corrections in ingested texts, so that I can fix obvious errors without altering the author's original writing.

#### Acceptance Criteria

1. WHEN typo correction is enabled for a book, THE Quality_Controller SHALL scan the full text and produce a list of suspected typos, where each entry includes the original word, the suggested correction, and the surrounding sentence for context
2. THE Quality_Controller SHALL limit corrections to typographical errors only (misspellings, transposed characters, repeated words) and SHALL NOT flag archaic spellings, regional spelling variants, or intentional stylistic choices, and SHALL NOT alter word choice, phrasing, grammar style, or meaning
3. WHEN the typo list is presented, THE Quality_Controller SHALL allow the user to accept or reject each individual correction
4. WHEN the typo list is presented, THE Quality_Controller SHALL provide bulk accept-all and reject-all actions
5. WHERE a source is marked as high-quality (e.g., Standard Ebooks), THE CWOPOD SHALL default the typo correction step to skipped, with the user able to override
6. THE Quality_Controller SHALL preserve the complete original text for any corrections that are rejected
7. WHEN the user confirms the final set of accepted corrections, THE Quality_Controller SHALL apply the accepted changes to the book text and pass the corrected text to the Typeset_Engine for downstream processing

### Requirement 4: Attribution and Source Page

**User Story:** As a user, I want every printed book to include proper attribution to the digital source, so that readers know where the text came from and can access the original online.

#### Acceptance Criteria

1. THE Typeset_Engine SHALL include a dedicated Attribution_Page in the back matter of every generated book
2. THE Attribution_Page SHALL display: source name, source URL, a QR code encoding the source URL, original publisher name, original publication year, and the edition or version identifier of the digital text used
3. IF one or more metadata fields (source name, source URL, original publisher, original publication year, or edition identifier) are unavailable from the source, THEN THE Attribution_Page SHALL omit those fields and display only the metadata that is available
4. THE Typeset_Engine SHALL NOT strip or hide source-provided license or legal text (e.g., Project Gutenberg license text) and SHALL include it on the Attribution_Page or as a separate page immediately following the Attribution_Page
5. THE Typeset_Engine SHALL include an Info_Page in the front matter of every book containing a printed URL and a QR code linking to the C.W.'s O-POD application
6. WHEN a source provides structured metadata fields (title, author, source name, source URL, original publisher, original publication year, edition identifier, and license text), THE Attribution_Page SHALL include all provided fields

### Requirement 5: AI Cover Art Generation

**User Story:** As a user, I want the system to generate cover art options based on the book's content, so that I can create a professional cover without needing design skills.

#### Acceptance Criteria

1. WHEN cover generation is initiated, THE Cover_Generator SHALL use the AI_Engine to analyze the book text and produce 10 spoiler-free image prompts based on scenes or themes within 120 seconds
2. THE Cover_Generator SHALL ensure generated prompts do not reveal plot twists, endings, or major spoilers
3. WHEN prompts are ready, THE Cover_Generator SHALL use the AI_Engine to generate candidate cover images from each prompt at a minimum resolution of 1600×2400 pixels in PNG or JPEG format
4. WHEN the user requests regeneration of an individual image, THE Cover_Generator SHALL allow the user to edit the associated prompt text and generate a new image from the modified prompt, up to a maximum of 20 regenerations per cover generation session
5. THE Cover_Generator SHALL allow the user to upload their own cover images as alternatives to AI-generated options, accepting PNG or JPEG files up to 25 MB with a minimum resolution of 1600×2400 pixels
6. IF the AI_Engine fails to generate prompts or images, THEN THE Cover_Generator SHALL display an error message indicating the failure reason and allow the user to retry the generation

### Requirement 6: Cover Builder and Templates

**User Story:** As a user, I want to assemble my book cover using a drag-and-drop interface with professional templates, so that I can create a print-ready cover with proper formatting.

#### Acceptance Criteria

1. THE Cover_Builder SHALL provide a drag-and-drop interface where users place cover images onto a cover layout, supporting JPEG, PNG, and TIFF formats with a minimum resolution of 300 DPI and a maximum file size of 50 MB per image
2. THE Cover_Builder SHALL overlay title and author text on the cover using a template system with at least 5 pre-built templates offering distinct positioning and style combinations for title and author text
3. THE Cover_Builder SHALL allow users to customize text position, font, size (between 8pt and 200pt), color, and effects (drop shadow, outline, and opacity) within a template, with title text supporting up to 100 characters and author text supporting up to 60 characters
4. THE Cover_Builder SHALL generate the final cover as a print-ready PDF with 3mm bleed margins on all edges, CMYK color space, and a minimum output resolution of 300 DPI
5. WHEN a cover is assembled, THE Cover_Builder SHALL display a preview showing front cover, spine, and back cover as they will appear in print, with spine width calculated based on page count and paper stock selection
6. IF a user uploads an image with resolution below 300 DPI or in an unsupported format, THEN THE Cover_Builder SHALL display an error message indicating the issue and prevent the image from being placed on the cover layout
7. IF a user attempts to generate a print-ready PDF and required cover elements (front cover image, title text, author text) are missing, THEN THE Cover_Builder SHALL display a message indicating which elements are missing and prevent PDF generation

### Requirement 7: Back Cover Generation

**User Story:** As a user, I want the system to generate a professional back cover with a synopsis, so that my printed book looks complete and polished.

#### Acceptance Criteria

1. WHEN back cover generation is initiated, THE Cover_Generator SHALL use the AI_Engine to produce a spoiler-free synopsis of 100 to 250 words for the back cover within 30 seconds
2. IF the AI_Engine fails to generate a synopsis within 30 seconds or returns an error, THEN THE Cover_Generator SHALL display an error message indicating the generation failed and allow the user to retry or manually enter back cover copy
3. WHEN back cover copy is generated, THE Cover_Generator SHALL allow the user to edit or replace the generated text up to a maximum of 500 words
4. THE Cover_Generator SHALL include a link and QR code to the C.W.'s O-POD application on the back cover, with the QR code sized at a minimum of 2 cm × 2 cm to ensure scannability
5. THE Cover_Generator SHALL apply a back matter layout to the back cover content that includes the synopsis text area, the QR code, and the application link arranged in a top-to-bottom reading order

### Requirement 8: Interior Typesetting

**User Story:** As a user, I want the book interior to be professionally typeset in trade paperback format, so that the printed result looks like a commercially published book.

#### Acceptance Criteria

1. THE Typeset_Engine SHALL generate print-ready PDF interiors using Pandoc with LaTeX or Typst, with all fonts embedded and images at a minimum resolution of 300 DPI
2. THE Typeset_Engine SHALL format books in trade paperback dimensions as specified by the selected Print_Provider, with margins, gutter spacing, and bleed conforming to that provider's submission requirements
3. WHEN the source text contains chapter divisions, THE Typeset_Engine SHALL detect chapters, start each chapter on a recto (right-hand) page, and apply chapter heading formatting
4. THE Typeset_Engine SHALL generate front matter including a half-title page, a title page, and a copyright page, with front matter pages numbered in roman numerals and body text in arabic numerals
5. WHEN the source text contains illustrations, THE Typeset_Engine SHALL include images at or near their original placement relative to surrounding text within the typeset output
6. THE Typeset_Engine SHALL produce output that conforms to the trim size and margin requirements of the selected Print_Provider
7. THE Typeset_Engine SHALL include running headers displaying the book title on verso (left-hand) pages and the current chapter title on recto (right-hand) pages, with page numbers in the footer
8. IF the source text cannot be processed into a valid PDF, THEN THE Typeset_Engine SHALL notify the user with an error message indicating the cause of the failure and preserve the source text unchanged

### Requirement 9: Print Service Integration

**User Story:** As a user, I want to submit my book to print-on-demand services directly from the tool, so that I can order physical copies without manual file handling.

#### Acceptance Criteria

1. THE Print_Service_Integrator SHALL support Lulu xPress, BookVault, and KDP Print as Print_Providers
2. THE Print_Service_Integrator SHALL allow each user to store API credentials for each Print_Provider and set a default Print_Provider that can be overridden per book
3. WHEN a book has a valid interior PDF and a valid cover PDF generated, THE Print_Service_Integrator SHALL consider the book ready for printing and enable the print submission workflow
4. WHEN a book is ready for printing, THE Print_Service_Integrator SHALL display pricing estimates from the selected Print_Provider before the user commits to an order
5. IF pricing estimate retrieval fails, THEN THE Print_Service_Integrator SHALL display an error message indicating the reason for failure and allow the user to retry or select a different Print_Provider
6. WHEN Lulu xPress or BookVault is selected and the user confirms the order, THE Print_Service_Integrator SHALL submit the order via the provider's API and display a confirmation including the provider's order identifier upon success
7. WHEN KDP Print is selected, THE Print_Service_Integrator SHALL generate the required files (interior PDF, cover PDF) and provide instructions for manual upload to KDP
8. IF an order submission fails, THEN THE Print_Service_Integrator SHALL display the error details and allow the user to retry up to 3 attempts or select a different Print_Provider

### Requirement 10: ISBN Management

**User Story:** As a user, I want to optionally assign an ISBN to my book, so that I can have a formally cataloged publication when desired.

#### Acceptance Criteria

1. THE Print_Service_Integrator SHALL provide an optional ISBN toggle for each book project
2. WHERE ISBN is enabled and the user selects Lulu's free ISBN program, THE Print_Service_Integrator SHALL request and assign an ISBN through Lulu's API and display the assigned ISBN to the user upon successful assignment
3. WHERE ISBN is enabled and the user provides their own ISBN, THE Print_Service_Integrator SHALL validate that the supplied ISBN conforms to ISBN-13 format (13 digits with valid check digit) before accepting it for the book
4. WHEN no ISBN option is selected, THE Print_Service_Integrator SHALL proceed without an ISBN
5. IF the user provides an ISBN that does not conform to ISBN-13 format, THEN THE Print_Service_Integrator SHALL reject the input, display an error message indicating the format requirement, and retain the user's entered value for correction
6. IF the Lulu API ISBN request fails or does not respond within 30 seconds, THEN THE Print_Service_Integrator SHALL display an error message indicating the ISBN could not be obtained and allow the user to retry or proceed without an ISBN

### Requirement 11: Bookshelf and Collection Management

**User Story:** As a user, I want a library view of all my completed book projects, so that I can manage my collection and reorder books easily.

#### Acceptance Criteria

1. THE Collection_Manager SHALL display all completed book projects in a Bookshelf view, showing a maximum of 50 books per page with pagination controls when the collection exceeds 50 books
2. THE Collection_Manager SHALL allow users to select between 2 and 20 books from the Bookshelf for batch ordering
3. WHEN a batch order is submitted, THE Collection_Manager SHALL submit all selected books as a single shipment to the Print_Provider where supported (Lulu xPress)
4. WHEN a batch order is submitted to a provider that does not support multi-title shipments, THE Collection_Manager SHALL submit individual orders and display a notification indicating that separate orders were placed per title along with the count of orders created
5. THE Collection_Manager SHALL display the status of each book project (draft, ready to print, ordered, shipped)
6. THE Collection_Manager SHALL allow users to reorder books in the Bookshelf view via drag-and-drop, and SHALL persist the custom order across sessions
7. IF a batch order submission fails, THEN THE Collection_Manager SHALL display an error message indicating which titles failed, preserve the user's selection, and allow the user to retry the submission

### Requirement 12: AI Engine Configuration

**User Story:** As a user, I want to configure which AI models the system uses for text and image generation, so that I can use local models or my own API subscriptions.

#### Acceptance Criteria

1. THE AI_Engine SHALL default to using local models for both text generation and image generation tasks when no external API key is configured for that task type
2. THE AI_Engine SHALL allow each user to configure external API keys (OpenAI, Anthropic, or other supported providers) independently for text generation and image generation task types
3. WHEN an external API key is configured for a task type, THE AI_Engine SHALL use the configured external provider for that task type while continuing to use the existing configuration for other task types
4. WHEN a user submits an API key configuration, THE AI_Engine SHALL validate that the key is a non-empty string of at most 256 characters before saving the configuration
5. IF a configured AI provider does not respond within 30 seconds or returns an error, THEN THE AI_Engine SHALL notify the user with a message indicating the failure reason and SHALL offer the option to retry the request or fall back to the local model, without automatically switching providers
6. THE AI_Engine SHALL store API key configurations per user and SHALL NOT expose one user's keys to another user

### Requirement 13: Multi-User Access and Deployment

**User Story:** As an administrator, I want the application to support multiple users with isolated data, so that it can be deployed as a shared service or public website.

#### Acceptance Criteria

1. THE CWOPOD SHALL support a minimum of 50 concurrent authenticated users, each with their own book projects and configurations stored separately such that no shared state exists between user accounts
2. THE CWOPOD SHALL support deployment as a self-hosted server, an LXC container on Proxmox, or a public-facing website
3. WHEN a user attempts to access book projects or settings, THE CWOPOD SHALL require the user to authenticate with valid credentials before granting access
4. IF a user provides invalid credentials, THEN THE CWOPOD SHALL deny access, display an error message indicating authentication failure, and not reveal whether the username or password was incorrect
5. THE CWOPOD SHALL ensure one user cannot access another user's book projects, configurations, or API keys through any interface or API endpoint
6. IF an authenticated user session is inactive for more than 30 minutes, THEN THE CWOPOD SHALL expire the session and require re-authentication before granting further access

### Requirement 14: Near-One-Click User Experience

**User Story:** As a user, I want the workflow from source text to printed book to be as simple as possible, so that I can produce books without specialized publishing knowledge.

#### Acceptance Criteria

1. THE CWOPOD SHALL provide a guided workflow that progresses through the following steps in order: source selection, typo correction, typesetting, cover creation, and print submission, where the user is required to make no more than one decision per step to advance (selecting a source, confirming or skipping typo corrections, confirming or skipping cover customization, and confirming the print order)
2. THE CWOPOD SHALL apply defaults at each step such that a user can advance from source selection to print submission without entering any customization, and the resulting book is valid for submission to the selected Print_Provider
3. WHEN a user has a default Print_Provider configured, THE CWOPOD SHALL pre-select that provider in the print submission step
4. THE CWOPOD SHALL allow users to skip optional steps (typo correction, cover customization) with a single action per step and proceed using the system-applied defaults
5. THE CWOPOD SHALL display the current step and total number of remaining steps throughout the workflow so the user can track progress toward print submission
6. IF a user leaves the workflow before completing print submission, THEN THE CWOPOD SHALL preserve all completed step outputs so the user can resume the workflow from the last completed step without re-doing prior work
