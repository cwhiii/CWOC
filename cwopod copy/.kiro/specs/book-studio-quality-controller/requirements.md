# Requirements: Quality Controller Module

## Introduction

The Quality Controller module performs optional LLM-based typo detection on ingested book texts with user review. It scans text for typographical errors only — misspellings, transposed characters, and repeated words — and presents suspected typos for user approval before applying corrections.

**CRITICAL CONSTRAINT:** This module must ONLY detect typos. It must NEVER alter word choice, phrasing, grammar, style, or meaning. It must NOT flag archaic spellings, regional spelling variants, or intentional stylistic choices.

## Glossary

- **Quality_Controller**: The module that performs optional LLM-based typo detection on ingested texts
- **TypoScanner**: The component that chunks text and sends it to the AI Engine for typo detection
- **CorrectionReview**: The component that manages the user's review of detected typos (accept/reject)
- **AI_Engine**: The configurable AI subsystem used for text analysis (see AI Engine module spec)
- **Typo**: A typographical error limited to: misspellings, transposed characters, or repeated words
- **Working Copy**: The mutable copy of the book text where accepted corrections are applied; the original text is never modified

## Requirements

### Requirement 1: Typo Scanning

**User Story:** As a user, I want the system to scan my book text for typos, so that I can identify and fix obvious typographical errors before printing.

#### Acceptance Criteria

1.1 WHEN typo correction is enabled for a project, THE Quality_Controller SHALL scan the full text of the project and produce a complete list of suspected typos

1.2 EACH entry in the typo list SHALL include: the original word, the suggested correction, and the surrounding sentence providing context for the suspected typo

1.3 THE Quality_Controller SHALL report the character position of each suspected typo within the full text to enable precise correction application

1.4 THE Quality_Controller SHALL process the scan as a background task and report progress to the user, as scanning may take several minutes for long texts

1.5 IF the AI Engine fails or times out during scanning, THEN THE Quality_Controller SHALL report the error to the user and allow them to retry the scan

### Requirement 2: Strict Typo-Only Detection

**User Story:** As a user, I want the system to only flag actual typos and not alter the author's writing style, so that the original text's voice and meaning are preserved.

#### Acceptance Criteria

2.1 THE Quality_Controller SHALL limit detections to typographical errors only: misspellings, transposed characters (e.g., "teh" → "the"), and repeated words (e.g., "the the")

2.2 THE Quality_Controller SHALL NOT flag or suggest changes to: archaic spellings (e.g., "colour", "connexion", "shew"), regional spelling variants (e.g., British vs. American English), intentional stylistic choices, or dialect

2.3 THE Quality_Controller SHALL NOT alter word choice, phrasing, grammar, style, or meaning under any circumstances

2.4 THE Quality_Controller SHALL NOT suggest rewording sentences, changing punctuation for style reasons, or modifying sentence structure

2.5 THE system prompt sent to the AI Engine SHALL explicitly enumerate what constitutes a typo and what does not, including concrete examples of each category

### Requirement 3: Correction Review

**User Story:** As a user, I want to review each suggested correction individually and decide whether to accept or reject it, so that I maintain full control over what changes are made to the text.

#### Acceptance Criteria

3.1 WHEN the typo list is presented, THE Quality_Controller SHALL allow the user to accept or reject each individual correction independently

3.2 WHEN the typo list is presented, THE Quality_Controller SHALL provide a bulk "accept all" action that marks all pending corrections as accepted

3.3 WHEN the typo list is presented, THE Quality_Controller SHALL provide a bulk "reject all" action that marks all pending corrections as rejected

3.4 THE Quality_Controller SHALL persist the accept/reject status of each correction so the user can review and change decisions before applying

3.5 THE Quality_Controller SHALL display corrections with sufficient context (the surrounding sentence) for the user to make an informed decision

### Requirement 4: Original Text Preservation

**User Story:** As a user, I want the original text to always be preserved unchanged, so that I can revert corrections or re-scan at any time.

#### Acceptance Criteria

4.1 THE Quality_Controller SHALL never modify the original text file (original_text_path on the project)

4.2 WHEN corrections are applied, THE Quality_Controller SHALL write the corrected text to a separate working copy (working_text_path) while preserving the original

4.3 IF all corrections are rejected, THE original text SHALL remain the text passed to downstream processing

4.4 THE Quality_Controller SHALL allow re-scanning a project, which clears previous corrections and produces a fresh list

### Requirement 5: Apply Corrections

**User Story:** As a user, I want to apply my accepted corrections and have the corrected text flow into the typesetting pipeline, so that my printed book reflects the fixes I approved.

#### Acceptance Criteria

5.1 WHEN the user confirms the final set of accepted corrections, THE Quality_Controller SHALL apply all accepted corrections to the text and save the result as the working copy

5.2 THE Quality_Controller SHALL pass the working copy (or original if no corrections were accepted) to the Typeset_Engine for downstream processing

5.3 THE Quality_Controller SHALL apply corrections in reverse position order to prevent position shifts from invalidating subsequent corrections

5.4 IF applying a correction fails due to a position mismatch (text at position doesn't match expected original), THEN THE Quality_Controller SHALL skip that correction, log the mismatch, and continue applying remaining corrections

### Requirement 6: Skip for High-Quality Sources

**User Story:** As a user, I want the typo correction step to be skipped by default for professionally curated sources, so that I don't waste time reviewing texts that are already high quality.

#### Acceptance Criteria

6.1 WHERE a project's source is marked as high-quality (e.g., source_type is "standard_ebooks"), THE Quality_Controller SHALL default the typo correction step to skipped

6.2 THE user SHALL be able to override the skip default and enable typo scanning for any source, including high-quality sources

6.3 WHERE typo correction is skipped, THE Quality_Controller SHALL pass the original text directly to the Typeset_Engine without modification

### Requirement 7: Optional Step

**User Story:** As a user, I want to be able to skip the typo correction step entirely, so that I can proceed directly to typesetting when I don't need typo detection.

#### Acceptance Criteria

7.1 THE Quality_Controller step SHALL be optional in the book production workflow — the user can skip it with a single action

7.2 WHEN the user skips typo correction, THE system SHALL proceed to the next workflow step using the original text unchanged

7.3 THE user SHALL be able to return to the typo correction step later if they change their mind, without losing other workflow progress
