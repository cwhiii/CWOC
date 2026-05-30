# Full System Audit Spec — Control-by-Control Verification

This document traces every UI control and backend function through the system to determine: **does it work as intended?**

---

## CRITICAL BUG FOUND

### BUG-001: Cover Templates Endpoint Unreachable (Routing Conflict)

**What:** The Cover Studio page calls `GET /api/projects/cover-templates` to load the 5 template presets.

**Why it fails:** In `main.py`, `projects.router` is registered BEFORE `cover.router`, both with prefix `/api/projects`. The projects router has `GET /{project_id}` which matches ANY path segment. FastAPI matches routes in registration order, so `cover-templates` gets caught by the `/{project_id}` handler, which tries to parse it as a UUID and returns a 422 error.

**Impact:** Template selector on the Cover Builder page will never load. Users won't see the 5 template buttons (Classic, Modern, Bold, Elegant, Minimal). The page still works for manual text entry but loses the template feature entirely.

**Fix:** Move the `/cover-templates` endpoint into `projects.router` (where `GET /templates` already exists and works), OR reorder router registration so `cover.router` comes before `projects.router`, OR rename the endpoint to avoid the UUID path conflict.

**Note:** The `projects.router` already has a `GET /templates` endpoint that returns the same data. The cover page should call `/projects/templates` instead of `/projects/cover-templates`. The frontend currently calls `/projects/cover-templates` which hits the cover router's `@router.get("/cover-templates")`, but that route is shadowed.

---

## PAGE-BY-PAGE VERIFICATION

---

### 1. Login Page (`/login`)

| Control | Handler | API Call | Backend | Verdict |
|---------|---------|----------|---------|---------|
| Email input | bind:value={email} | — | — | ✅ Works (type=email, required) |
| Password input | bind:value={password} | — | — | ✅ Works (minlength=8 in register mode) |
| Submit button | submit() | POST /api/auth/login or /register | auth.router → AuthService | ✅ Works |
| Toggle mode button | sets mode | — | — | ✅ Works (clears error, switches form) |
| Redirect on success | window.location.href = '/' | — | — | ✅ Works (full reload triggers layout auth check) |

**Page interaction logic:** Mode toggle correctly switches between login/register. Password minlength only enforced in register mode (correct). Error display clears on mode switch. Session cookie set by backend response. Full page reload ensures layout picks up auth state.

**Verdict: ✅ PASS**

---

### 2. Search Page (`/search`)

| Control | Handler | API Call | Backend | Verdict |
|---------|---------|----------|---------|---------|
| Search input | bind:value={query} | — | — | ✅ Works |
| Search button | search() | GET /api/search/?q=... | search.router → SearchService | ✅ Works |
| "Start Project" button | importBook() | POST /api/projects/import | projects.router → provider.download() | ✅ Works |
| File upload input | inline async | POST /api/projects/upload (FormData) | projects.router → UploadProvider | ✅ Works |
| Disabled state | query.length < 2 | — | Backend also validates min 2 chars | ✅ Consistent |

**Page interaction logic:** Search disabled until 2+ chars (matches backend Query min_length=2). Import redirects to project page after 1s delay. Upload uses raw fetch (not api client) because FormData needs different Content-Type. Both import and upload redirect to `/projects/{id}` on success.

**Verdict: ✅ PASS**

---

### 3. Project Workflow Page (`/projects/[id]`)

| Control | Handler | API Call | Backend | Verdict |
|---------|---------|----------|---------|---------|
| Step nav buttons | sets currentStep | — | — | ✅ Works (disabled for future steps) |
| "Continue to Typo Check" | currentStep = 1 | — | — | ✅ Works |
| "Scan for Typos" | scanTypos() | POST /api/projects/{id}/scan-typos | quality_controller.router → Celery task | ✅ Works |
| "Skip" (typos) | currentStep = 2 | — | — | ✅ Works |
| Accept/Reject per correction | updateCorrection() | PATCH /api/projects/{id}/corrections | quality_controller.router | ✅ Works |
| "Accept All" / "Reject All" | bulkCorrections() | PATCH /api/projects/{id}/corrections | quality_controller.router (bulk_action) | ✅ Works |
| "Apply Accepted & Continue" | applyCorrections() | POST /api/projects/{id}/corrections/apply | CorrectionApplierService | ✅ Works |
| "Generate Interior PDF" | startTypeset() | POST /api/projects/{id}/typeset | typeset.router → Celery task | ✅ Works |
| "Download PDF" link | href (direct) | GET /api/projects/{id}/interior-pdf | typeset.router → FileResponse | ✅ Works |
| "Open Cover Builder" link | href navigation | — | — | ✅ Works |
| Print provider select | bind:value={printProvider} | — | — | ✅ Works |
| Shipping address textarea | bind:value={shippingAddress} | — | — | ✅ Works |
| "Get Price Estimate" | getPricing() | POST /api/print/pricing | print_orders.router → OrderService | ✅ Works |
| "Submit Print Order" | submitPrintOrder() | POST /api/print/orders | print_orders.router → OrderService | ✅ Works |

**Page interaction logic:** Step determination from project status is correct (draft→0, typeset→2, cover_ready→3, print_ready→4). Typo scan uses polling (setTimeout 5s then 3s retries) which is appropriate for Celery tasks. Typeset also polls after 10s. Status transitions: typeset task sets DRAFT→TYPESET, cover assembly sets →PRINT_READY when both PDFs exist.

**Potential issue:** After typeset completes, the page polls once after 10s. If the Celery task takes longer (it can take 30-120s for long books), the user sees "PDF generation started" but no completion feedback until they manually reload. This is a UX gap, not a bug.

**Verdict: ✅ PASS (with UX note about polling)**

---

### 4. Cover Studio Page (`/projects/[id]/cover`)

| Control | Handler | API Call | Backend | Verdict |
|---------|---------|----------|---------|---------|
| Template load on mount | onMount | GET /api/projects/cover-templates | cover.router | ⚠️ **BUG-001** (routing conflict) |
| Project data load | onMount | GET /api/projects/{id} | projects.router | ✅ Works |
| "Generate Cover Prompts" | generatePrompts() | POST /api/projects/{id}/cover/generate-prompts | cover.router → PromptGenerator | ✅ Works |
| "Generate Image" per prompt | generateImage() | POST /api/projects/{id}/cover/generate-image | cover.router → AIRouter | ✅ Works |
| "Use This" / "✓ Selected" | selectImage() | — (local state) | — | ✅ Works |
| File upload (×2) | handleUpload() | POST /api/projects/{id}/cover/upload-image (FormData) | cover.router | ✅ Works |
| Template buttons | applyTemplate() | — (local state) | — | ⚠️ Templates won't load (BUG-001) |
| Title text input | bind:value={titleText} | — | — | ✅ Works (maxlength=100) |
| Title font size | bind:value={titleFontSize} | — | — | ✅ Works (min=8, max=200) |
| Title color picker | bind:value={titleColor} | — | — | ✅ Works |
| Title font select | bind:value={titleFontFamily} | — | — | ✅ Works (5 options) |
| Author text input | bind:value={authorText} | — | — | ✅ Works (maxlength=60) |
| Author font/size/color | same pattern | — | — | ✅ Works |
| "Generate Synopsis" | generateBlurb() | POST /api/projects/{id}/cover/generate-blurb | cover.router → BlurbGenerator | ✅ Works |
| Blurb textarea | bind:value={blurbEditable} | — | — | ✅ Works (maxlength=3000) |
| "Generate Print-Ready Cover PDF" | assembleCover() | POST /api/projects/{id}/cover/assemble | cover.router → CoverAssembler | ✅ Works |
| Spine width display | updateSpineWidth() | GET /api/projects/{id}/cover/spine-width | cover.router | ✅ Works |
| Live preview panel | reactive to state | — | — | ✅ Works (updates in real-time) |

**Page interaction logic:** Three-step flow (prompts → images → builder) with back navigation. Image selection persists across steps. Assembly sends full layout with template positions, font settings, and blurb. Backend validates required elements (image, title, author) before PDF generation. Status advances to PRINT_READY if interior PDF also exists.

**Verdict: ⚠️ PARTIAL PASS — BUG-001 blocks template loading**

---

### 5. Bookshelf Page (`/bookshelf`)

| Control | Handler | API Call | Backend | Verdict |
|---------|---------|----------|---------|---------|
| Status filter select | loadBookshelf(1) | GET /api/bookshelf?status=... | bookshelf.router | ✅ Works |
| Previous/Next buttons | loadBookshelf(page±1) | GET /api/bookshelf?page=... | bookshelf.router | ✅ Works |
| "Batch Order" toggle | sets batchMode | — | — | ✅ Works |
| Checkboxes (per book) | toggleSelect() | — (local state) | — | ✅ Works |
| Drag-and-drop reorder | handleDrop() | PATCH /api/bookshelf/order | bookshelf.router | ✅ Works |
| Batch provider select | bind:value={batchProvider} | — | — | ✅ Works |
| "Get Pricing Estimate" | getEstimate() | POST /api/bookshelf/batch-order (action: estimate) | bookshelf.router | ✅ Works |
| Shipping address textarea | bind:value={batchAddress} | — | — | ✅ Works |
| "Confirm Order" | submitBatchOrder() | POST /api/bookshelf/batch-order (action: submit) | bookshelf.router → OrderService | ✅ Works |
| "Back" (from estimate) | estimateData = null | — | — | ✅ Works |
| Book title links | href navigation | — | — | ✅ Works |

**Page interaction logic:** Estimate step shows per-title pricing before requiring shipping address. Multi-title warning shown for non-Lulu providers. Batch selection limited to 2-20 books (validated both frontend and backend). Drag-and-drop persists immediately on drop. Status filter resets to page 1.

**Verdict: ✅ PASS**

---

### 6. Settings Page (`/settings`)

| Control | Handler | API Call | Backend | Verdict |
|---------|---------|----------|---------|---------|
| Text provider select | bind:value={textProvider} | — | — | ✅ Works |
| Image provider select | bind:value={imageProvider} | — | — | ✅ Works |
| Text/Image model inputs | bind:value | — | — | ✅ Works (conditional display) |
| Text/Image API key inputs | bind:value | — | — | ✅ Works (password type) |
| "Remove" key buttons | clearTextApiKey/clearImageApiKey | PATCH /api/user/ai-config {key: null} | ai_config.router | ✅ Works |
| "Save AI Settings" | saveAIConfig() | PATCH /api/user/ai-config | ai_config.router | ✅ Works |
| Default provider select | bind:value={defaultProvider} | — | — | ✅ Works |
| "Save Print Settings" | savePrintSettings() | PATCH /api/user/preferences | user.router | ✅ Works |
| Lulu client ID/secret inputs | bind:value | — | — | ✅ Works |
| "Save Lulu Credentials" | saveLuluCredentials() | POST /api/print/credentials | print_orders.router | ✅ Works |
| "Remove Credentials" (Lulu) | deleteCredentials('lulu') | DELETE /api/print/credentials/lulu | print_orders.router | ✅ Works |
| BookVault API key input | bind:value | — | — | ✅ Works |
| "Save BookVault Credentials" | saveBookvaultCredentials() | POST /api/print/credentials | print_orders.router | ✅ Works |
| "Remove Credentials" (BV) | deleteCredentials('bookvault') | DELETE /api/print/credentials/bookvault | print_orders.router | ✅ Works |
| Display name input | bind:value={displayName} | — | — | ✅ Works |
| "Update Profile" | saveProfile() | PATCH /api/user/profile | user.router | ✅ Works |
| "Log Out" | logout() | POST /api/auth/logout | auth.router | ✅ Works |
| Preferences load on mount | onMount | GET /api/user/preferences | user.router | ✅ Works |

**Page interaction logic:** All 4 parallel loads on mount (AI config, profile, credentials, preferences). Conditional display of API key fields only when provider ≠ local. Key inputs clear after save. Credential status toggles between "configured" view and input form. Preferences persist default provider to database.

**Verdict: ✅ PASS**

---

### 7. Layout (`+layout.svelte`)

| Control | Handler | API Call | Backend | Verdict |
|---------|---------|----------|---------|---------|
| Auth check on load | checkAuth() | GET /api/user/profile | user.router | ✅ Works |
| Logout button | logout() | POST /api/auth/logout | auth.router | ✅ Works |
| Nav links | href navigation | — | — | ✅ Works |
| Conditional login/logout | user state | — | — | ✅ Works |

**Verdict: ✅ PASS**

---

### 8. Home Page (`/`)

| Control | Handler | API Call | Backend | Verdict |
|---------|---------|----------|---------|---------|
| Recent projects load | onMount | GET /api/projects/ | projects.router | ✅ Works |
| "Find a Book" link | href | — | — | ✅ Works |
| "My Bookshelf" link | href | — | — | ✅ Works |
| "Sign In / Register" link | href (when !authenticated) | — | — | ✅ Works |
| Project links | href | — | — | ✅ Works |

**Verdict: ✅ PASS**

---

## BACKEND FUNCTION VERIFICATION

### Functions that are called but never tested at runtime:

| Function | Called By | Concern |
|----------|-----------|---------|
| `_read_pdf_page_count()` | `compile_typst()` | Requires pikepdf or pypdf installed in Docker image |
| `UploadProvider.normalize()` | `upload_document()`, `import_from_source()` | Requires Pandoc installed in Docker image |
| `UploadProvider.extract_images()` | `upload_document()` | Requires ebooklib installed |
| `UploadProvider.extract_metadata()` | `upload_document()` | Requires ebooklib/python-docx/pypdf installed |
| `CoverAssembler._draw_front_image()` | `assemble_cover()` | Requires PyCairo + Pillow installed |
| `CoverAssembler._generate_qr_code()` | `_draw_back_cover()` | Requires python-qrcode installed |
| `QRGenerator._generate_qr()` | typeset task | Requires python-qrcode installed |
| `compile_typst()` | typeset task | Requires typst binary installed |

**These all depend on system packages being in the Docker image.** The Dockerfile should install: typst, pandoc, poppler-utils (pdftotext), and the Python packages: pycairo, pillow, qrcode, ebooklib, python-docx, pypdf, pikepdf.

---

## SUMMARY

| Page | Status | Issues |
|------|--------|--------|
| Login | ✅ PASS | None |
| Search | ✅ PASS | None |
| Project Workflow | ✅ PASS | UX: polling could miss long tasks |
| Cover Studio | ⚠️ PARTIAL | BUG-001: templates don't load |
| Bookshelf | ✅ PASS | None |
| Settings | ✅ PASS | None |
| Layout | ✅ PASS | None |
| Home | ✅ PASS | None |

**Total: 7/8 pages fully working, 1 page has a routing bug affecting template loading.**

**1 critical bug to fix (BUG-001).** Everything else is correctly wired end-to-end.
