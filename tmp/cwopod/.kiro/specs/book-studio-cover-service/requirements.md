# Requirements Document

## Introduction

The Cover Service module handles AI-powered cover art generation, the interactive cover builder interface, and back cover copy generation for C.W.'s O-POD. It enables users to generate professional cover art from book content analysis, assemble covers using a drag-and-drop editor with templates, and produce print-ready PDF covers with proper bleed, CMYK color space, and spine calculations. The module also generates spoiler-free back cover synopses and includes C.W.'s O-POD branding (QR code and link) on the back cover.

## Glossary

- **Cover_Generator**: The backend component responsible for AI prompt generation, image generation, and blurb generation
- **Cover_Builder**: The frontend drag-and-drop interface where users assemble cover images with title/author overlays using templates
- **PromptGenerator**: Component that analyzes book text via the AI_Engine and produces spoiler-free image prompts
- **ImageGenerator**: Component that uses the AI_Engine to generate candidate cover images from prompts
- **BlurbGenerator**: Component that uses the AI_Engine to produce spoiler-free back cover synopses
- **CoverAssembler**: Backend component that assembles the final print-ready PDF cover using PyCairo (CMYK, bleed, spine)
- **CoverTemplate**: A pre-built layout configuration defining positions and styles for title, author, and other text elements on the cover
- **Spine_Width**: The calculated width of the book spine based on page count and paper stock thickness
- **Bleed**: The 3mm extension beyond the trim edge on all sides, required for print production
- **CMYK**: Cyan-Magenta-Yellow-Key (black) color space required for professional print output
- **AI_Engine**: The configurable AI subsystem (from the AI Engine module) providing text and image generation capabilities
- **Cover_Session**: A single cover generation session within which regeneration limits are tracked

## Requirements

### Requirement 1: AI Cover Prompt Generation

**User Story:** As a user, I want the system to analyze my book's content and generate relevant image prompts, so that I can get cover art ideas that reflect the book's themes without spoiling the story.

#### Acceptance Criteria

1.1 WHEN cover generation is initiated for a book project, THE PromptGenerator SHALL use the AI_Engine to analyze the book text and produce exactly 10 image prompts based on scenes, themes, or imagery from the text within 120 seconds

1.2 THE PromptGenerator SHALL ensure all generated prompts are spoiler-free and do not reveal plot twists, endings, character deaths, or major story revelations

1.3 THE PromptGenerator SHALL generate prompts that describe visual scenes, moods, or symbolic imagery suitable for book cover art (not literal plot descriptions)

1.4 IF the AI_Engine fails to generate prompts within 120 seconds or returns an error, THEN THE PromptGenerator SHALL display an error message indicating the failure reason and allow the user to retry the generation

1.5 IF the AI_Engine returns fewer than 10 prompts, THEN THE PromptGenerator SHALL display the available prompts and indicate that fewer than expected were generated

### Requirement 2: Cover Image Generation

**User Story:** As a user, I want to generate cover images from the AI prompts, so that I have visual options to choose from for my book cover.

#### Acceptance Criteria

2.1 WHEN prompts are ready, THE ImageGenerator SHALL use the AI_Engine to generate one candidate cover image from each prompt at a minimum resolution of 1600×2400 pixels in PNG or JPEG format

2.2 THE ImageGenerator SHALL present all generated candidate images to the user for selection

2.3 WHEN the user requests regeneration of an individual image, THE ImageGenerator SHALL allow the user to edit the associated prompt text before regenerating

2.4 THE ImageGenerator SHALL enforce a maximum of 20 image regenerations per cover generation session

2.5 IF the user has reached the 20-regeneration limit, THEN THE ImageGenerator SHALL display a message indicating the limit has been reached and prevent further regenerations in the current session

2.6 IF the AI_Engine fails to generate an image from a prompt, THEN THE ImageGenerator SHALL display an error message for that specific prompt and allow the user to retry or edit the prompt

### Requirement 3: User Cover Image Upload

**User Story:** As a user, I want to upload my own cover images as alternatives to AI-generated options, so that I can use artwork I already have or commissioned separately.

#### Acceptance Criteria

3.1 THE Cover_Generator SHALL allow the user to upload their own cover images as alternatives to AI-generated options

3.2 THE Cover_Generator SHALL accept uploaded images in PNG or JPEG format only

3.3 THE Cover_Generator SHALL accept uploaded images with a maximum file size of 25 MB

3.4 THE Cover_Generator SHALL require uploaded images to have a minimum resolution of 1600×2400 pixels

3.5 IF a user uploads an image in an unsupported format, THEN THE Cover_Generator SHALL reject the upload and display an error indicating the accepted formats (PNG, JPEG)

3.6 IF a user uploads an image exceeding 25 MB, THEN THE Cover_Generator SHALL reject the upload and display an error indicating the maximum file size

3.7 IF a user uploads an image with resolution below 1600×2400 pixels, THEN THE Cover_Generator SHALL reject the upload and display an error indicating the minimum resolution requirement

### Requirement 4: Cover Builder Interface

**User Story:** As a user, I want a drag-and-drop interface to assemble my book cover with templates, so that I can create a professional-looking cover without design expertise.

#### Acceptance Criteria

4.1 THE Cover_Builder SHALL provide a drag-and-drop canvas interface (using Fabric.js) where users can place and position cover images onto the cover layout

4.2 THE Cover_Builder SHALL support placing images in JPEG, PNG, and TIFF formats with a minimum resolution of 300 DPI and a maximum file size of 50 MB per image on the canvas

4.3 THE Cover_Builder SHALL provide a template system with at least 5 pre-built templates offering distinct positioning and style combinations for title and author text

4.4 THE Cover_Builder SHALL overlay title and author text on the cover image according to the selected template's default positions

4.5 THE Cover_Builder SHALL allow users to customize text properties: position (drag to reposition), font (from available font list), size (between 8pt and 200pt), color (full color picker), and effects (drop shadow, outline, and opacity)

4.6 THE Cover_Builder SHALL enforce a maximum of 100 characters for title text and 60 characters for author text

4.7 IF a user attempts to enter title text exceeding 100 characters, THEN THE Cover_Builder SHALL truncate or prevent input beyond the limit and display the character count

4.8 IF a user attempts to enter author text exceeding 60 characters, THEN THE Cover_Builder SHALL truncate or prevent input beyond the limit and display the character count

### Requirement 5: Print-Ready Cover PDF Generation

**User Story:** As a user, I want the system to generate a print-ready cover PDF with proper specifications, so that my cover meets professional printing requirements.

#### Acceptance Criteria

5.1 THE CoverAssembler SHALL generate the final cover as a print-ready PDF with 3mm bleed margins on all edges

5.2 THE CoverAssembler SHALL output the cover PDF in CMYK color space

5.3 THE CoverAssembler SHALL output the cover PDF at a minimum resolution of 300 DPI

5.4 THE CoverAssembler SHALL calculate spine width based on the book's page count and selected paper stock using the formula: spine_width = (page_count × paper_thickness) + cover_board_thickness

5.5 THE CoverAssembler SHALL produce a single PDF containing front cover, spine, and back cover as a continuous spread

5.6 IF a user attempts to generate a print-ready PDF and required cover elements are missing (front cover image, title text, author text), THEN THE CoverAssembler SHALL display a message indicating which elements are missing and prevent PDF generation

5.7 IF a user has placed an image with resolution below 300 DPI on the cover layout, THEN THE CoverAssembler SHALL display a warning indicating the image may appear pixelated in print and require user confirmation before proceeding

### Requirement 6: Cover Preview

**User Story:** As a user, I want to preview how my cover will look in print before generating the final PDF, so that I can make adjustments before committing.

#### Acceptance Criteria

6.1 WHEN a cover is being assembled, THE Cover_Builder SHALL display a preview showing front cover, spine, and back cover as they will appear in print

6.2 THE Cover_Builder SHALL calculate and display the spine width in the preview based on the book's page count and paper stock selection

6.3 THE Cover_Builder SHALL update the preview in real-time as the user makes changes to the cover layout

### Requirement 7: Back Cover Synopsis Generation

**User Story:** As a user, I want the system to generate a professional back cover synopsis, so that my book has compelling copy without me needing to write it myself.

#### Acceptance Criteria

7.1 WHEN back cover generation is initiated, THE BlurbGenerator SHALL use the AI_Engine to produce a spoiler-free synopsis of 100 to 250 words within 30 seconds

7.2 THE BlurbGenerator SHALL ensure the generated synopsis does not reveal plot twists, endings, or major spoilers

7.3 WHEN back cover copy is generated, THE BlurbGenerator SHALL allow the user to edit or replace the generated text

7.4 THE BlurbGenerator SHALL enforce a maximum of 500 words for back cover copy (whether generated or user-edited)

7.5 IF the AI_Engine fails to generate a synopsis within 30 seconds or returns an error, THEN THE BlurbGenerator SHALL display an error message indicating the generation failed and allow the user to retry or manually enter back cover copy

### Requirement 8: Back Cover Layout and Branding

**User Story:** As a user, I want the back cover to include proper branding and layout, so that my book looks professional and promotes the C.W.'s O-POD platform.

#### Acceptance Criteria

8.1 THE Cover_Generator SHALL include a QR code linking to the C.W.'s O-POD application on the back cover, with the QR code sized at a minimum of 2cm × 2cm to ensure scannability

8.2 THE Cover_Generator SHALL include a printed URL link to the C.W.'s O-POD application on the back cover

8.3 THE Cover_Generator SHALL apply a back cover layout that arranges the synopsis text area, the QR code, and the application link in a top-to-bottom reading order (synopsis at top, QR code below, link at bottom)

8.4 THE CoverAssembler SHALL render the back cover layout elements (synopsis, QR code, link) within the back cover panel of the final PDF spread with proper margins inside the bleed area

</content>
</invoke>