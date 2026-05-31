# Implementation Plan: Print & Order Service Module

## Overview

This plan covers the implementation of the Print & Order Service module, which integrates C.W.'s O-POD with print-on-demand providers (Lulu xPress, BookVault, KDP Print) for pricing, order submission, ISBN management, and order tracking. The module uses a strategy pattern with provider-specific adapters, implements retry logic with exponential backoff, and stores credentials securely using Fernet encryption.

Technology: Python/FastAPI, httpx for async HTTP, SQLAlchemy for persistence, Fernet for encryption (shared utility), pytest for testing.

## Tasks

- [x] 1. Define PrintProviderAdapter interface and data classes
  - [x] 1.1 Create PrintProviderAdapter ABC and supporting data classes
    - Create `backend/app/services/print_service/__init__.py`
    - Create `backend/app/services/print_service/base.py` with:
      - `BookSpec` dataclass (project_id, title, author, interior_pdf_path, cover_pdf_path, page_count, trim dimensions, paper_type, color_interior, quantity, isbn)
      - `PricingEstimate` dataclass (unit_cost, shipping_cost, total_cost, currency, provider, details)
      - `OrderSubmissionResult` dataclass (success, provider_order_id, error_message, is_retryable)
      - `OrderStatusResult` dataclass (provider_order_id, status, tracking_number, tracking_url, estimated_delivery)
      - `PrintProviderAdapter` ABC with abstract methods: `get_pricing()`, `submit_order()`, `get_order_status()`
      - `ProviderError` exception class with message, provider name, is_timeout, is_retryable flags
    - _Requirements: 1.4_

- [x] 2. Implement LuluAdapter
  - [x] 2.1 Create LuluAdapter with OAuth2 authentication
    - Create `backend/app/services/print_service/adapters/lulu.py`
    - Implement `_authenticate()` method: POST to Lulu OAuth2 token endpoint with client_credentials grant type, cache token until expiry
    - Implement token refresh logic: re-authenticate when token is expired or about to expire (within 60s)
    - Configure httpx client with 30-second timeout for all requests
    - _Requirements: 2.1, 9.4_

  - [x] 2.2 Implement LuluAdapter pricing and order submission
    - Implement `get_pricing()`: POST to `/print-job-cost-calculations/` with line_items and shipping_address, parse response into PricingEstimate
    - Implement `submit_order()`: POST to `/print-jobs/` with line_items array (supports multi-title), shipping_address, and contact_email; return OrderSubmissionResult with provider order ID
    - Implement `get_order_status()`: GET `/print-jobs/{id}/` and map Lulu status to OrderStatusResult
    - Handle HTTP errors: 401 → re-authenticate and retry once; 4xx → ProviderError(is_retryable=False); 5xx → ProviderError(is_retryable=True); timeout → ProviderError(is_timeout=True, is_retryable=True)
    - _Requirements: 4.1, 5.1, 5.3, 8.4, 9.4_

  - [x] 2.3 Implement LuluAdapter ISBN request
    - Implement `request_free_isbn()`: POST to `/isbns/` with book title, contributors, and format details
    - Parse response to extract assigned ISBN-13
    - Handle timeout (30s) and errors: return None with error message on failure
    - _Requirements: 7.3, 7.6_

- [x] 3. Implement BookVaultAdapter
  - [x] 3.1 Create BookVaultAdapter with API key authentication
    - Create `backend/app/services/print_service/adapters/bookvault.py`
    - Implement API key header injection (X-API-Key) for all requests
    - Configure httpx client with 30-second timeout
    - Implement `get_pricing()`: POST to `/v1/quotes` with product specification and destination, parse into PricingEstimate
    - Implement `submit_order()`: POST to `/v1/orders` with single product specification (only processes first book_spec); return OrderSubmissionResult
    - Implement `get_order_status()`: GET `/v1/orders/{id}` and map BookVault status to OrderStatusResult
    - Handle HTTP errors: 4xx → ProviderError(is_retryable=False); 5xx → ProviderError(is_retryable=True); timeout → ProviderError(is_timeout=True, is_retryable=True)
    - _Requirements: 4.1, 5.2, 5.4, 8.4, 9.4_

- [x] 4. Implement KDPAdapter
  - [x] 4.1 Create KDPAdapter with file generation and local pricing
    - Create `backend/app/services/print_service/adapters/kdp.py`
    - Implement `get_pricing()`: Calculate estimated cost locally using KDP's published pricing formula (fixed cost + per-page cost × page_count), varying by trim size and color/BW; return PricingEstimate with note that this is an estimate
    - Implement `submit_order()`: Package interior PDF and cover PDF into a ZIP archive with KDP naming conventions; generate step-by-step upload instructions as markdown text; return OrderSubmissionResult(success=True) with instructions
    - Implement `get_order_status()`: Return a static status indicating manual tracking is required for KDP orders
    - Ensure NO network API calls are made for order submission
    - _Requirements: 6.1, 6.2, 6.3_

- [x] 5. Implement ISBNManager
  - [x] 5.1 Create ISBNManager with validation and Lulu ISBN integration
    - Create `backend/app/services/print_service/isbn.py`
    - Implement `validate_isbn13()`:
      - Strip hyphens and spaces from input
      - Verify exactly 13 digits remain
      - Compute check digit: sum first 12 digits with alternating weights 1, 3; check_digit = (10 - (sum % 10)) % 10
      - Compare computed check digit with 13th digit
      - Return (is_valid, error_message) tuple
    - Implement `request_lulu_isbn()`:
      - Accept LuluAdapter instance and BookSpec
      - Call lulu_adapter.request_free_isbn()
      - Return (isbn, error_message) tuple
      - Handle ProviderError and return user-friendly error message
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6_

- [x] 6. Implement credential storage endpoints
  - [x] 6.1 Create CredentialService and API endpoints
    - Create `backend/app/services/print_service/credentials.py` with CredentialService class
    - Implement `store_credentials()`: serialize credentials dict to JSON, encrypt with `encrypt_value()`, upsert ProviderCredential record
    - Implement `get_credentials()`: query ProviderCredential, decrypt with `decrypt_value()`, deserialize JSON
    - Implement `delete_credentials()`: delete ProviderCredential record for provider
    - Implement `list_configured_providers()`: return list of provider names with stored credentials
    - Create `backend/app/routers/print_credentials.py` with FastAPI router:
      - GET `/api/print/credentials` → list configured providers (boolean status per provider)
      - POST `/api/print/credentials` → store credentials for a provider
      - DELETE `/api/print/credentials/{provider}` → delete credentials for a provider
    - All endpoints require authentication and are user-scoped
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_

- [x] 7. Create pricing endpoint
  - [x] 7.1 Implement GET /api/print/pricing endpoint
    - Create `backend/app/routers/print_orders.py` with FastAPI router
    - Implement GET `/api/print/pricing` accepting query params: project_id, provider, shipping address fields
    - Validate print readiness: check that project has both interior_pdf_path and cover_pdf_path set and files exist
    - Resolve provider adapter using CredentialService to get decrypted credentials
    - Call adapter.get_pricing() with BookSpec constructed from project data
    - Return PricingResponse on success
    - Return 400 with clear message if project is not print-ready
    - Return 502 with error details if provider pricing call fails (timeout, auth, network)
    - Enforce 30-second timeout
    - _Requirements: 3.1, 3.2, 4.1, 4.2, 4.3, 9.1_

- [x] 8. Create order submission endpoint with retry logic
  - [x] 8.1 Implement OrderService with retry logic
    - Create `backend/app/services/print_service/order_service.py` with OrderService class
    - Implement `submit_order()`:
      - Validate print readiness for all project_ids
      - Handle ISBN: if isbn_option="user_provided", validate with ISBNManager; if isbn_option="lulu_free", request via ISBNManager
      - Resolve adapter from provider + credentials
      - Attempt submission with retry: max 3 attempts, exponential backoff (1s, 2s, 4s)
      - Only retry on ProviderError(is_retryable=True); fail immediately on non-retryable errors
      - On success: create PrintOrder + OrderItem records, set status to SUBMITTED
      - On failure after retries: create PrintOrder with status FAILED, store error details
      - For BookVault multi-title: loop and submit individual orders per book
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 7.3, 7.4_

  - [x] 8.2 Implement POST /api/print/orders endpoint
    - Add POST `/api/print/orders` to the print_orders router
    - Accept OrderCreateRequest body (project_ids, provider, shipping_address, isbn_option, user_isbn, quantity)
    - Validate ISBN if user_isbn provided (return 422 on invalid)
    - Call OrderService.submit_order()
    - Return OrderResponse with order details and provider_order_id on success
    - Return 400 for print readiness failures
    - Return 502 for provider submission failures (after retries exhausted)
    - _Requirements: 5.1, 5.2, 5.5, 5.6, 7.4, 7.5, 9.2_

- [x] 9. Create order status and listing endpoints
  - [x] 9.1 Implement GET /api/print/orders and GET /api/print/orders/{id}
    - Add GET `/api/print/orders` to the print_orders router:
      - Return paginated list of user's orders (default 20 per page)
      - Include order status, provider, total_price, created_at
      - Support page and per_page query params
    - Add GET `/api/print/orders/{id}` to the print_orders router:
      - Return full order details including items (project_id, title per item)
      - Optionally refresh status from provider API (if provider_order_id exists and status is not terminal)
      - Return 404 if order not found or belongs to different user
    - Register print_orders and print_credentials routers in FastAPI app (`backend/app/main.py`)
    - _Requirements: 8.1, 8.2, 8.3, 8.4_

- [x] 10. Write unit tests for ISBN validation and adapter logic
  - [x] 10.1 Write ISBNManager unit tests
    - Test: valid ISBN-13 "978-0-306-40615-7" passes validation (with hyphens)
    - Test: valid ISBN-13 "9780306406157" passes validation (without hyphens)
    - Test: invalid check digit "9780306406158" fails validation
    - Test: too short "978030640615" (12 digits) fails validation
    - Test: too long "97803064061577" (14 digits) fails validation
    - Test: non-numeric "978030640615X" fails validation
    - Test: empty string fails validation
    - Test: ISBN with spaces "978 0 306 40615 7" passes validation
    - Test: all-zeros "0000000000000" with correct check digit passes
    - _Requirements: 7.4, 7.5_

  - [x] 10.2 Write LuluAdapter unit tests with mocked HTTP
    - Test: successful OAuth2 token acquisition
    - Test: token refresh on expiry
    - Test: successful pricing request returns PricingEstimate
    - Test: successful multi-title order submission returns order ID
    - Test: successful ISBN request returns ISBN string
    - Test: timeout raises ProviderError(is_timeout=True, is_retryable=True)
    - Test: 401 error triggers re-authentication
    - Test: 5xx error raises ProviderError(is_retryable=True)
    - Test: 400 error raises ProviderError(is_retryable=False)
    - Use respx or httpx.MockTransport for HTTP mocking
    - _Requirements: 5.1, 5.3, 7.3, 9.4_

  - [x] 10.3 Write BookVaultAdapter unit tests with mocked HTTP
    - Test: API key header is included in all requests
    - Test: successful pricing request returns PricingEstimate
    - Test: successful single-title order submission returns order ID
    - Test: timeout raises ProviderError(is_timeout=True, is_retryable=True)
    - Test: 5xx error raises ProviderError(is_retryable=True)
    - Test: 4xx error raises ProviderError(is_retryable=False)
    - _Requirements: 5.2, 5.4, 9.4_

  - [x] 10.4 Write KDPAdapter unit tests
    - Test: get_pricing() returns calculated estimate without network calls
    - Test: submit_order() generates ZIP file with correct contents
    - Test: submit_order() returns instructions text
    - Test: submit_order() makes no HTTP requests (mock httpx to verify no calls)
    - Test: get_order_status() returns manual tracking status
    - _Requirements: 6.1, 6.2, 6.3_

  - [x] 10.5 Write OrderService retry logic unit tests
    - Test: successful submission on first attempt (no retry)
    - Test: transient failure then success on second attempt
    - Test: three transient failures exhausts retries, order marked FAILED
    - Test: non-retryable error fails immediately without retry (attempt count = 1)
    - Test: exponential backoff timing (1s, 2s, 4s between attempts)
    - Test: BookVault multi-title submits individual orders per book
    - Test: order and items are persisted to database on success
    - _Requirements: 5.5, 5.6, 9.2_

- [x] 11. Write integration tests for pricing and order flow
  - [x] 11.1 Write pricing endpoint integration tests
    - Test: authenticated request with valid project returns pricing response
    - Test: request for project without interior PDF returns 400 with "not print-ready" message
    - Test: request for project without cover PDF returns 400 with "not print-ready" message
    - Test: request with missing credentials returns error indicating credentials needed
    - Test: provider timeout returns 502 with timeout error message
    - Test: unauthenticated request returns 401
    - Test: user cannot get pricing for another user's project
    - _Requirements: 3.1, 3.2, 4.1, 4.3, 9.1_

  - [x] 11.2 Write order submission integration tests
    - Test: full order flow — pricing → submission → order persisted with SUBMITTED status
    - Test: order with user-provided valid ISBN succeeds
    - Test: order with invalid ISBN returns 422 with format error
    - Test: order with lulu_free ISBN option calls ISBN API before submission
    - Test: retry behavior with mocked transient failures (verify 3 attempts max)
    - Test: failed order is persisted with FAILED status
    - Test: KDP order returns success with instructions (no API submission)
    - Test: unauthenticated request returns 401
    - _Requirements: 5.1, 5.2, 5.5, 7.3, 7.4, 7.5, 9.2_

  - [x] 11.3 Write order listing and detail integration tests
    - Test: list orders returns paginated results for authenticated user
    - Test: list orders does not include other users' orders
    - Test: order detail returns items with project info
    - Test: order detail returns 404 for non-existent order
    - Test: order detail returns 404 for another user's order
    - _Requirements: 8.1, 8.2, 8.3_

  - [x] 11.4 Write credential endpoint integration tests
    - Test: store credentials encrypts and persists to database
    - Test: stored credentials are not plaintext in database
    - Test: list providers shows correct configured status
    - Test: delete credentials removes the record
    - Test: user cannot access another user's credentials
    - Test: unauthenticated request returns 401
    - _Requirements: 2.1, 2.2, 2.4, 2.5_

## Notes

- All HTTP calls use `httpx.AsyncClient` for async compatibility with FastAPI
- The existing `app/utils/encryption.py` (Fernet-based) is reused for credential encryption; no new encryption code needed
- The existing `app/models/order.py` and `app/models/credentials.py` models are already defined and match the design
- Tests should use `pytest-asyncio` for async test support and `respx` for HTTP mocking
- The OrderService is instantiated per-request with the current user's ID and database session
- KDP pricing uses locally stored rate tables (no API call) since KDP does not provide a pricing API
- Lulu OAuth2 tokens are cached in-memory per adapter instance; a new adapter is created per request so tokens are not shared across users
- For multi-title BookVault orders, the OrderService creates separate PrintOrder records per book since BookVault only supports single-title orders

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["2.1", "3.1", "4.1", "5.1"] },
    { "id": 2, "tasks": ["2.2", "2.3"] },
    { "id": 3, "tasks": ["6.1"] },
    { "id": 4, "tasks": ["7.1"] },
    { "id": 5, "tasks": ["8.1"] },
    { "id": 6, "tasks": ["8.2", "9.1"] },
    { "id": 7, "tasks": ["10.1", "10.2", "10.3", "10.4", "10.5"] },
    { "id": 8, "tasks": ["11.1", "11.2", "11.3", "11.4"] }
  ]
}
```
