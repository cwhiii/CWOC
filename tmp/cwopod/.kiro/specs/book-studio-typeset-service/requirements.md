# Requirements: Typeset Service Module

## Introduction

The Typeset Service module converts book text into print-ready interior PDFs suitable for trade paperback production. It detects chapter structure, applies professional typesetting via Typst templates, generates front matter (including an Info_Page with QR code) and back matter (including an Attribution_Page with source metadata and QR code), and compiles the final PDF as a background Celery task. Output conforms to the selected print provider's trim, margin, and bleed specifications.

**Pipeline:** Source text → Chapter detection → Template rendering (Typst source) → PDF compilation → Print-ready interior PDF

## Glossary

- **Typeset_Engine**: The module that converts ingested text into print-ready PDF interiors using Typst
- **ChapterDetector**: Component that identifies chapter boundaries in source text via pattern matching and EPUB navigation parsing
- **TemplateRenderer**: Component that assembles parameterized Typst source from detected structure and provider specs
- **PDFGenerator**: Celery background task that compiles Typst source into a final PDF
- **QRGenerator**: Component that creates QR code images for the Info_Page and Attribution_Page
- **Print_Provider**: An external print-on-demand service (Lulu xPress, BookVault, or KDP Print) with specific trim/margin/bleed requirements
- **Info_Page**: A front-matter page containing a URL and QR code linking to the C.W.'s O-POD application
- **Attribution_Page**: A back-matter page displaying source metadata, a QR code to the source, and license text
- **Recto**: A right-hand (odd-numbered) page in a bound book
- **Verso**: A left-hand (even-numbered) page in a bound book
- **Front Matter**: Pages before the body text (half-title, title page, copyright page, Info_Page), numbered in roman numerals
- **Back Matter**: Pages after the body text (Attribution_Page, license text)
- **Trim Size**: The final dimensions of the printed page after cutting
- **Bleed**: The area beyond the trim edge where content extends to allow for cutting tolerance
- **Gutter**: Additional inner margin to account for binding

## Requirements

### Requirement 1: PDF Generation

**User Story:** As a user, I want the system to generate a print-ready interior PDF from my book text, so that I can submit it to a print-on-demand service without manual typesetting.

#### Acceptance Criteria

1.1 THE Typeset_Engine SHALL generate print-ready PDF interiors by compiling Typst source, with all fonts embedded in the output PDF

1.2 THE Typeset_Engine SHALL ensure all images in the output PDF are at a minimum resolution of 300 DPI

1.3 THE Typeset_Engine SHALL execute PDF generation as a Celery background task, reporting progress to the user as compilation may take several minutes for long books

1.4 WHEN PDF generation completes successfully, THE Typeset_Engine SHALL store the resulting PDF at a path associated with the project and update the project record with the interior PDF path

1.5 THE Typeset_Engine SHALL support re-generation of the interior PDF when the user changes provider selection or text is updated, replacing the previous PDF

### Requirement 2: Print Provider Specifications

**User Story:** As a user, I want the interior PDF to conform to my selected print provider's requirements, so that my book is accepted for printing without manual adjustments.

#### Acceptance Criteria

2.1 THE Typeset_Engine SHALL format books in trade paperback dimensions as specified by the selected Print_Provider (Lulu xPress, BookVault, or KDP Print)

2.2 THE Typeset_Engine SHALL apply margins, gutter spacing, and bleed conforming to the selected Print_Provider's submission requirements

2.3 THE Typeset_Engine SHALL produce output that conforms to the trim size of the selected Print_Provider

2.4 THE Typeset_Engine SHALL support at minimum the following trim sizes: 5.5" × 8.5" (Lulu default trade), 5.06" × 7.81" (BookVault B-format), and 5.5" × 8.5" (KDP trade)

2.5 WHEN the user changes the selected Print_Provider, THE Typeset_Engine SHALL allow re-generation of the PDF with the new provider's specifications

### Requirement 3: Chapter Detection

**User Story:** As a user, I want the system to automatically detect chapter boundaries in my book, so that chapters are properly formatted without manual markup.

#### Acceptance Criteria

3.1 THE ChapterDetector SHALL detect chapter divisions using pattern matching for common chapter heading formats including: "CHAPTER I", "CHAPTER 1", "Chapter One", "Chapter 1", "CHAPTER ONE", and numeric-only headings (e.g., "I.", "1.")

3.2 WHEN the source is an EPUB file with navigation or table-of-contents metadata, THE ChapterDetector SHALL use the EPUB nav/toc structure to identify chapter boundaries

3.3 THE ChapterDetector SHALL extract chapter titles from detected headings for use in running headers

3.4 IF no chapter divisions are detected in the source text, THE ChapterDetector SHALL treat the entire text as a single chapter

3.5 THE ChapterDetector SHALL return a structured list of chapters with: chapter number, chapter title, and the text content of each chapter

### Requirement 4: Chapter Formatting

**User Story:** As a user, I want each chapter to start on a right-hand page with proper formatting, so that the book follows professional publishing conventions.

#### Acceptance Criteria

4.1 THE Typeset_Engine SHALL start each chapter on a recto (right-hand) page, inserting a blank verso page if necessary

4.2 THE Typeset_Engine SHALL apply chapter heading formatting to the first page of each chapter, displaying the chapter title prominently

4.3 THE Typeset_Engine SHALL suppress running headers on chapter opening pages, following standard publishing convention

### Requirement 5: Front Matter

**User Story:** As a user, I want the book to include standard front matter pages, so that it looks like a professionally published book.

#### Acceptance Criteria

5.1 THE Typeset_Engine SHALL generate front matter including: a half-title page (book title only), a title page (book title and author), and a copyright page

5.2 THE Typeset_Engine SHALL number front matter pages in roman numerals (i, ii, iii, iv, ...)

5.3 THE Typeset_Engine SHALL include an Info_Page in the front matter containing a printed URL and a QR code linking to the C.W.'s O-POD application

5.4 THE Info_Page QR code SHALL be sized at a minimum of 2 cm × 2 cm to ensure scannability

5.5 THE Typeset_Engine SHALL begin body text page numbering at arabic numeral 1 on the first page of the first chapter

### Requirement 6: Running Headers and Page Numbers

**User Story:** As a user, I want running headers and page numbers throughout the book, so that readers can navigate easily.

#### Acceptance Criteria

6.1 THE Typeset_Engine SHALL include running headers displaying the book title on verso (left-hand) pages

6.2 THE Typeset_Engine SHALL include running headers displaying the current chapter title on recto (right-hand) pages

6.3 THE Typeset_Engine SHALL display page numbers in the footer of each page

6.4 THE Typeset_Engine SHALL suppress running headers on chapter opening pages and front matter pages

### Requirement 7: Attribution Page

**User Story:** As a user, I want every book to include proper attribution to the digital source, so that readers know where the text came from and can access the original online.

#### Acceptance Criteria

7.1 THE Typeset_Engine SHALL include a dedicated Attribution_Page in the back matter of every generated book

7.2 THE Attribution_Page SHALL display: source name, source URL, a QR code encoding the source URL, original publisher name, original publication year, and the edition or version identifier of the digital text used

7.3 IF one or more metadata fields (source name, source URL, original publisher, original publication year, or edition identifier) are unavailable, THEN THE Attribution_Page SHALL omit those fields and display only the metadata that is available

7.4 THE Typeset_Engine SHALL NOT strip or hide source-provided license or legal text and SHALL include it on the Attribution_Page or as a separate page immediately following the Attribution_Page

7.5 THE Attribution_Page QR code SHALL be sized at a minimum of 2 cm × 2 cm to ensure scannability

### Requirement 8: Image Preservation

**User Story:** As a user, I want illustrations from my source text to appear in the printed book at their original positions, so that the reading experience is preserved.

#### Acceptance Criteria

8.1 WHEN the source text contains illustrations, THE Typeset_Engine SHALL include images at or near their original placement relative to surrounding text within the typeset output

8.2 THE Typeset_Engine SHALL ensure all included images meet the minimum 300 DPI resolution requirement for print output

8.3 IF an image in the source text is below 300 DPI, THE Typeset_Engine SHALL include the image at its original resolution and log a warning, rather than omitting it

### Requirement 9: Error Handling

**User Story:** As a user, I want to be notified if typesetting fails, so that I can take corrective action without losing my source text.

#### Acceptance Criteria

9.1 IF the source text cannot be processed into a valid PDF, THEN THE Typeset_Engine SHALL notify the user with an error message indicating the cause of the failure

9.2 THE Typeset_Engine SHALL preserve the source text unchanged regardless of whether PDF generation succeeds or fails

9.3 IF Typst compilation fails, THE Typeset_Engine SHALL include the Typst compiler error output in the error message to aid debugging

9.4 THE Typeset_Engine SHALL allow the user to retry PDF generation after a failure

### Requirement 10: API Access

**User Story:** As a user, I want to trigger typesetting and download the resulting PDF through the application, so that I can generate and retrieve my interior PDF within the workflow.

#### Acceptance Criteria

10.1 THE Typeset_Engine SHALL expose an endpoint to initiate typesetting for a project (POST /api/projects/{id}/typeset)

10.2 THE Typeset_Engine SHALL expose an endpoint to download the generated interior PDF (GET /api/projects/{id}/interior-pdf)

10.3 WHEN typesetting is initiated, THE endpoint SHALL return immediately with a task identifier for progress tracking

10.4 IF a user requests the interior PDF before generation is complete, THE endpoint SHALL return an appropriate status indicating the PDF is not yet available

10.5 THE Typeset_Engine SHALL prevent concurrent typeset tasks for the same project, returning an error if a task is already in progress
