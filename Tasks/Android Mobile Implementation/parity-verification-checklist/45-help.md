# Help

**Category:** Standalone Pages
**Item #:** 45
**Code Verified:** ✅
**User Verified:** ⬜

## Functions, Buttons, Controls & Inputs

### Page Layout
- [ ] help-content container — main content wrapper
- [ ] help-body — content area (index or article)
- [ ] help-breadcrumb — navigation breadcrumb (hidden on index)
- [ ] help-search-results — search results container (hidden by default)

### Search
- [ ] help-search-input (text input) — "Search all help topics..." search field
- [ ] help-search-btn — "Search" button
- [ ] _doSearch() — performs full-text search across all help documents
- [ ] Search results display: title + highlighted snippet per result
- [ ] Click on search result → loads that document
- [ ] _highlightTerms(text, terms) — highlights matching terms in snippets
- [ ] Enter key in search input triggers search

### Navigation
- [ ] breadcrumb-home link — "📖 Help Index" (returns to index)
- [ ] breadcrumb-current — shows current article title
- [ ] _showIndex() — renders the help index (table of contents)
- [ ] _loadDoc(filename) — loads and renders a specific help document
- [ ] Hash-based navigation — URL hash (#slug) loads specific document
- [ ] hashchange event listener — handles browser back/forward navigation
- [ ] Cross-reference links (data-doc attribute) — click loads another help doc

### Index / Table of Contents
- [ ] _buildTocHtml() — builds the full table of contents HTML
- [ ] _buildCategoryHtml(cat) — builds HTML for a single category section
- [ ] Categories with document links organized by topic
- [ ] Click on any topic → loads that document

### Document Rendering
- [ ] _renderMarkdown(md) — converts markdown to HTML using marked.js library
- [ ] _processDocLinks(container) — converts [text](link) patterns to clickable links
- [ ] _addBackToTopLinks(container) — adds "↑ Back to top" links after sections
- [ ] Handles internal links (other help docs) and external links
- [ ] Settings deep-links — links to specific settings tabs/sections

### Helper Functions
- [ ] _getTitleForFile(filename) — resolves filename to display title
- [ ] _escHtml(str) — escapes HTML entities for safe display

### Initialization
- [ ] _init() — main initialization function
- [ ] Fetches document index from GET /api/docs
- [ ] Wires search button and Enter key handler
- [ ] Wires breadcrumb home click
- [ ] Checks URL hash for initial document to load
- [ ] Falls back to showing index if no hash

### API Integration
- [ ] GET /api/docs — returns list of available help documents
- [ ] GET /api/docs/:filename — returns markdown content of a specific document

### Markdown Features (via marked.js)
- [ ] Headers (h1–h6)
- [ ] Bold, italic, strikethrough
- [ ] Code blocks and inline code
- [ ] Links (internal and external)
- [ ] Lists (ordered and unordered)
- [ ] Tables
- [ ] Blockquotes
- [ ] Images

### Styling
- [ ] Parchment theme consistent with rest of app
- [ ] Sticky search bar at top
- [ ] Scrollable content area
- [ ] Search result cards with hover effects
- [ ] Breadcrumb navigation with dotted underline links
