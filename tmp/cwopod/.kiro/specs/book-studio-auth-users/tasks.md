# Implementation Plan: Auth & Users Module

## Overview

This plan implements the Auth & Users module for C.W.'s O-POD, providing user registration, session-based authentication, profile management, and user-scoped data isolation. The module is built on FastAPI with SQLAlchemy async, bcrypt for password hashing, and HTTP-only cookies for session delivery.

Technology: Python 3.11+, FastAPI, SQLAlchemy (async), bcrypt, PostgreSQL, pytest + pytest-asyncio for testing.

## Tasks

- [x] 1. Implement AuthService (register, login, logout, validate_session)
  - [x] 1.1 Create AuthService class with register method
    - Create `backend/app/services/auth_service.py`
    - Implement `register(email, password)` method:
      - Validate email format (contains @ and domain with dot)
      - Validate password length >= 8 characters
      - Normalize email to lowercase
      - Hash password with `bcrypt.hashpw()` using cost factor 12
      - Insert user record into database
      - Handle duplicate email with generic error message ("Registration failed. Please check your input and try again.")
      - Create session via `_create_session()` helper
      - Return (User, Session) tuple
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 8.1_

  - [x] 1.2 Implement login method
    - Implement `login(email, password)` method:
      - Normalize email to lowercase
      - Query user by email
      - If user not found: raise AuthError("Invalid email or password")
      - Verify password with `bcrypt.checkpw()` (constant-time comparison)
      - If password wrong: raise AuthError("Invalid email or password")
      - Create session via `_create_session()` helper
      - Return Session
    - _Requirements: 2.1, 2.2, 2.4, 8.4_

  - [x] 1.3 Implement session creation helper
    - Implement `_create_session(user_id)` private method:
      - Generate token with `secrets.token_urlsafe(32)`
      - Set `expires_at` to `datetime.utcnow() + timedelta(minutes=30)`
      - Set `last_active` to `datetime.utcnow()`
      - Insert session record
      - Return Session object
    - _Requirements: 2.3, 2.4_

  - [x] 1.4 Implement validate_session method
    - Implement `validate_session(session_token)` method:
      - Query session by token
      - If not found: return None
      - If `expires_at < now`: delete session, return None
      - Update `last_active` to now
      - Update `expires_at` to now + 30 minutes (sliding window)
      - Query and return associated User
    - _Requirements: 3.1, 3.2, 3.3_

  - [x] 1.5 Implement logout and cleanup methods
    - Implement `logout(session_token)` method:
      - Delete session record by token
      - No error if token doesn't exist (idempotent)
    - Implement `cleanup_expired_sessions()` method:
      - Delete all sessions where `expires_at < now`
      - Return count of deleted sessions
    - _Requirements: 4.1, 4.2, 4.3, 3.4_

- [x] 2. Implement session middleware (FastAPI dependency)
  - [x] 2.1 Create get_current_user dependency
    - Create `backend/app/middleware/auth.py`
    - Implement `get_current_user(request, db)` async function:
      - Extract `session_token` from `request.cookies`
      - If no cookie: raise HTTPException(401, "Authentication required")
      - Call `AuthService.validate_session(token)`
      - If None returned: raise HTTPException(401, "Authentication required")
      - Return User object
    - _Requirements: 5.1, 5.2, 5.3, 5.4_

  - [x] 2.2 Create optional auth dependency for public routes
    - Implement `get_optional_user(request, db)` for routes that work with or without auth
    - Returns User | None (does not raise on missing/invalid session)
    - _Requirements: 5.1_

- [x] 3. Implement auth router endpoints (register, login, logout)
  - [x] 3.1 Create Pydantic schemas for auth
    - Create `backend/app/schemas/auth.py`
    - Define: `RegisterRequest`, `LoginRequest`, `UserResponse`, `ErrorResponse`
    - RegisterRequest: email (EmailStr), password (str, min_length=8)
    - LoginRequest: email (EmailStr), password (str)
    - UserResponse: id (UUID), email (str), display_name (str | None)
    - _Requirements: 1.2, 1.3, 1.6_

  - [x] 3.2 Implement register endpoint
    - Update `backend/app/routers/auth.py`
    - `POST /api/auth/register`:
      - Parse RegisterRequest body
      - Call AuthService.register()
      - Set session cookie on response (HttpOnly, Secure, SameSite=Lax, Path=/api)
      - Return UserResponse with 201 status
      - Handle AuthError → 400 with generic message
    - _Requirements: 1.1, 1.4, 1.5, 1.6, 2.5_

  - [x] 3.3 Implement login endpoint
    - `POST /api/auth/login`:
      - Parse LoginRequest body
      - Call AuthService.login()
      - Set session cookie on response (same attributes as register)
      - Return UserResponse with 200 status
      - Handle AuthError → 401 "Invalid email or password"
    - _Requirements: 2.1, 2.2, 2.5_

  - [x] 3.4 Implement logout endpoint
    - `POST /api/auth/logout`:
      - Extract session_token from cookies
      - Call AuthService.logout(token)
      - Clear session cookie in response (set empty value, max_age=0)
      - Return 204 No Content
      - No error if no valid session (idempotent)
    - _Requirements: 4.1, 4.2, 4.3_

- [x] 4. Implement UserService and profile endpoints
  - [x] 4.1 Create UserService
    - Create `backend/app/services/user_service.py`
    - Implement `get_profile(user_id)`:
      - Query user by ID
      - Return UserProfileResponse (email, display_name, created_at)
      - Never include password_hash in response
    - Implement `update_profile(user_id, data)`:
      - Validate display_name max 100 characters
      - Update user record
      - Return updated UserProfileResponse
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 8.3_

  - [x] 4.2 Create user router with profile endpoints
    - Create `backend/app/routers/user.py`
    - Create Pydantic schemas: `UserProfileResponse`, `ProfileUpdateRequest`
    - `GET /api/user/profile`:
      - Depends on get_current_user
      - Call UserService.get_profile(current_user.id)
      - Return UserProfileResponse
    - `PATCH /api/user/profile`:
      - Depends on get_current_user
      - Parse ProfileUpdateRequest body
      - Call UserService.update_profile(current_user.id, data)
      - Return updated UserProfileResponse
    - _Requirements: 6.1, 6.2, 6.3, 6.4_

  - [x] 4.3 Register routers in FastAPI app
    - Update `backend/app/main.py` to include auth and user routers
    - Ensure auth middleware is applied to all routes except register, login, and health
    - _Requirements: 5.1_

- [x] 5. Implement user-scoped query helper
  - [x] 5.1 Create UserScopedQuery class
    - Create `backend/app/services/scoped_query.py`
    - Implement `UserScopedQuery(db, user_id)`:
      - `base_query(model)`: returns `select(model).where(model.user_id == self.user_id)`
      - `get_by_id(model, resource_id)`: queries by ID with user_id filter, returns None if not found or wrong user
      - `create(instance)`: sets `instance.user_id = self.user_id`, adds to session, flushes
      - `list_all(model, **filters)`: returns all records for user with optional additional filters
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5_

  - [x] 5.2 Create get_scoped_query FastAPI dependency
    - Implement `get_scoped_query(current_user, db)` dependency that returns a configured UserScopedQuery instance
    - Other routers can use: `scoped: UserScopedQuery = Depends(get_scoped_query)`
    - _Requirements: 7.2, 7.3_

- [x] 6. Write unit tests for auth flows
  - [x] 6.1 Test AuthService.register
    - Test successful registration creates user with bcrypt hash
    - Test email is normalized to lowercase
    - Test duplicate email returns generic error (not revealing email exists)
    - Test password < 8 chars is rejected
    - Test invalid email format is rejected
    - Test session is created on successful registration
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 8.1_

  - [x] 6.2 Test AuthService.login
    - Test successful login with correct credentials returns session
    - Test login with wrong password returns generic error
    - Test login with nonexistent email returns same generic error
    - Test session token is cryptographically random (not predictable)
    - Test session expires_at is set to 30 minutes from now
    - _Requirements: 2.1, 2.2, 2.3, 2.4_

  - [x] 6.3 Test AuthService.validate_session
    - Test valid session returns user and extends expiry
    - Test expired session returns None and is deleted from DB
    - Test unknown token returns None
    - Test last_active is updated on valid request
    - _Requirements: 3.1, 3.2, 3.3_

  - [x] 6.4 Test AuthService.logout
    - Test logout deletes session from database
    - Test logout with nonexistent token does not raise error
    - Test subsequent validate_session with deleted token returns None
    - _Requirements: 4.1, 4.2, 4.3_

  - [x] 6.5 Test UserService
    - Test get_profile returns correct fields without password_hash
    - Test update_profile updates display_name
    - Test update_profile rejects display_name > 100 characters
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 8.3_

  - [x] 6.6 Test UserScopedQuery
    - Test base_query includes user_id filter
    - Test get_by_id returns None for resource belonging to different user
    - Test create sets user_id automatically
    - _Requirements: 7.2, 7.3, 7.4, 7.5_

- [x] 7. Write integration tests for auth endpoints
  - [x] 7.1 Test registration endpoint
    - Test POST /api/auth/register with valid data returns 201 and sets cookie
    - Test cookie has HttpOnly, Secure, SameSite=Lax, Path=/api attributes
    - Test registration with existing email returns 400 with generic message
    - Test registration with invalid email returns 400 with field error
    - Test registration with short password returns 400 with field error
    - _Requirements: 1.1, 1.4, 1.5, 1.6, 2.5_

  - [x] 7.2 Test login endpoint
    - Test POST /api/auth/login with valid credentials returns 200 and sets cookie
    - Test login with wrong password returns 401 "Invalid email or password"
    - Test login with nonexistent email returns 401 "Invalid email or password"
    - _Requirements: 2.1, 2.2, 2.5_

  - [x] 7.3 Test logout endpoint
    - Test POST /api/auth/logout clears cookie and returns 204
    - Test subsequent requests with cleared session return 401
    - Test logout without valid session returns 204 (idempotent)
    - _Requirements: 4.1, 4.2, 4.3_

  - [x] 7.4 Test session expiry
    - Test request with expired session returns 401
    - Test active session extends expiry (sliding window)
    - Test expired session is deleted from database
    - _Requirements: 3.1, 3.2_

  - [x] 7.5 Test profile endpoints
    - Test GET /api/user/profile returns profile for authenticated user
    - Test GET /api/user/profile returns 401 for unauthenticated request
    - Test PATCH /api/user/profile updates display_name
    - Test PATCH /api/user/profile rejects display_name > 100 chars
    - _Requirements: 6.1, 6.2, 6.3, 6.4_

  - [x] 7.6 Test data isolation
    - Create two users with separate sessions
    - Verify user A cannot access user B's resources via direct ID
    - Verify accessing another user's resource returns 404 (not 403)
    - Verify user-scoped queries only return own data
    - _Requirements: 7.2, 7.4, 7.5_

  - [x] 7.7 Test security properties
    - Verify password_hash never appears in any response body
    - Verify error messages don't reveal email existence
    - Verify session tokens are unique across all sessions
    - _Requirements: 8.2, 8.3, 1.4, 2.2_

## Notes

- The existing `backend/app/models/user.py` already defines User and Session models — implementation should use and extend these rather than creating new ones
- The existing `backend/app/routers/auth.py` has placeholder endpoints — these will be replaced with full implementations
- bcrypt cost factor of 12 provides ~250ms hash time, which is acceptable for login/register but prevents brute-force attacks
- Session cleanup can be triggered by a periodic Celery task or a simple cron job hitting an admin endpoint
- The UserScopedQuery pattern will be used by all other modules (Source Service, Cover Service, etc.) for data isolation

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2", "1.3"] },
    { "id": 1, "tasks": ["1.4", "1.5"] },
    { "id": 2, "tasks": ["2.1", "2.2", "3.1"] },
    { "id": 3, "tasks": ["3.2", "3.3", "3.4"] },
    { "id": 4, "tasks": ["4.1", "4.2"] },
    { "id": 5, "tasks": ["4.3", "5.1"] },
    { "id": 6, "tasks": ["5.2"] },
    { "id": 7, "tasks": ["6.1", "6.2", "6.3", "6.4", "6.5", "6.6"] },
    { "id": 8, "tasks": ["7.1", "7.2", "7.3", "7.4", "7.5", "7.6", "7.7"] }
  ]
}
```

