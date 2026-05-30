# Technical Design Document

## Overview

This document describes the technical design for the Auth & Users module of C.W.'s O-POD. The module provides user registration, authentication via session tokens, session lifecycle management, user profile CRUD, and data isolation through user-scoped database queries. It is implemented as a set of FastAPI services and middleware that all other modules depend on for identity and access control.

The design uses server-side sessions stored in PostgreSQL, with session tokens delivered via HTTP-only cookies. Passwords are hashed with bcrypt. A FastAPI dependency (middleware) protects all API routes and injects the authenticated user context into request handlers. A user-scoped query base class ensures that all database operations are automatically filtered by the authenticated user's ID.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Frontend (SvelteKit)                      │
│         Login / Register / Profile UI                       │
└──────────────────────────┬──────────────────────────────────┘
                           │ HTTP (cookies)
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                  FastAPI Application                         │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │           Auth Middleware (Dependency)                │   │
│  │  - Extracts session_token from cookie                │   │
│  │  - Validates session in DB                           │   │
│  │  - Updates last_active / extends expiry              │   │
│  │  - Injects current_user into request                 │   │
│  └──────────────────────┬──────────────────────────────┘   │
│                          │                                   │
│  ┌───────────────────┐  │  ┌────────────────────────────┐  │
│  │   Auth Router      │  │  │   User Router              │  │
│  │  POST /register    │  │  │  GET  /user/profile        │  │
│  │  POST /login       │  │  │  PATCH /user/profile       │  │
│  │  POST /logout      │  │  │                            │  │
│  └────────┬──────────┘  │  └─────────────┬──────────────┘  │
│           │              │                │                   │
│  ┌────────▼──────────┐  │  ┌─────────────▼──────────────┐  │
│  │   AuthService      │  │  │   UserService              │  │
│  │  - register()      │  │  │  - get_profile()           │  │
│  │  - login()         │  │  │  - update_profile()        │  │
│  │  - logout()        │  │  │                            │  │
│  │  - validate()      │  │  │                            │  │
│  └────────┬──────────┘  │  └─────────────┬──────────────┘  │
│           │              │                │                   │
│  ┌────────▼──────────────▼────────────────▼──────────────┐  │
│  │              Database Layer (SQLAlchemy)               │  │
│  │  - User model                                         │  │
│  │  - Session model                                      │  │
│  │  - UserScopedQuery base                               │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Request Flow

1. Client sends request with `session_token` cookie
2. Auth middleware extracts token, queries `sessions` table
3. If valid and not expired: updates `last_active`, extends `expires_at`, injects `current_user`
4. If invalid/expired: returns 401 Unauthorized
5. Route handler executes with access to `current_user.id`
6. Any database queries use `UserScopedQuery` which auto-filters by `user_id`

## Components and Interfaces

### AuthService

**Location:** `backend/app/services/auth_service.py`

**Responsibility:** Handles user registration, login, logout, and session validation.

```python
class AuthService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def register(self, email: str, password: str) -> tuple[User, Session]:
        """
        Register a new user account.
        - Validates email format and password length (>= 8 chars)
        - Normalizes email to lowercase
        - Hashes password with bcrypt (cost factor 12)
        - Creates user record
        - Creates session and returns (user, session)
        - Raises AuthError if email already exists (generic message)
        """

    async def login(self, email: str, password: str) -> Session:
        """
        Authenticate user and create session.
        - Looks up user by lowercase email
        - Verifies password with bcrypt constant-time comparison
        - Creates new session with token from secrets.token_urlsafe(32)
        - Sets expires_at to now + 30 minutes
        - Returns session
        - Raises AuthError with generic message on failure
        """

    async def logout(self, session_token: str) -> None:
        """
        Destroy a session.
        - Deletes session record by token
        - Idempotent: no error if token doesn't exist
        """

    async def validate_session(self, session_token: str) -> User | None:
        """
        Validate a session token and return the associated user.
        - Queries session by token
        - Checks expires_at > now
        - If valid: updates last_active, extends expires_at by 30 min
        - Returns User or None
        - Deletes session if expired
        """

    async def cleanup_expired_sessions(self) -> int:
        """
        Delete all sessions where expires_at < now.
        Returns count of deleted sessions.
        """
```

### UserService

**Location:** `backend/app/services/user_service.py`

**Responsibility:** User profile retrieval and updates.

```python
class UserService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_profile(self, user_id: UUID) -> UserProfile:
        """
        Return user profile data: email, display_name, created_at.
        Never includes password_hash.
        """

    async def update_profile(self, user_id: UUID, data: ProfileUpdate) -> UserProfile:
        """
        Update user profile fields.
        - Currently supports: display_name (max 100 chars)
        - Validates field lengths
        - Returns updated profile
        """
```

### Auth Middleware (FastAPI Dependency)

**Location:** `backend/app/middleware/auth.py`

**Responsibility:** Protects routes by validating session tokens and injecting the current user.

```python
async def get_current_user(
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> User:
    """
    FastAPI dependency that:
    1. Extracts session_token from request cookies
    2. Calls AuthService.validate_session(token)
    3. If valid: returns User object
    4. If invalid: raises HTTPException(401, "Authentication required")

    Used as: current_user: User = Depends(get_current_user)
    """
```

**Excluded routes** (do not require auth):
- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/health`

### UserScopedQuery

**Location:** `backend/app/services/scoped_query.py`

**Responsibility:** Provides a base for all database queries that automatically scopes by user_id.

```python
class UserScopedQuery:
    def __init__(self, db: AsyncSession, user_id: UUID):
        self.db = db
        self.user_id = user_id

    def base_query(self, model: type[Base]) -> Select:
        """
        Returns a SELECT query pre-filtered by user_id.
        Usage: query = self.base_query(BookProject).where(...)
        """
        return select(model).where(model.user_id == self.user_id)

    async def get_by_id(self, model: type[Base], resource_id: UUID) -> Base | None:
        """
        Get a single resource by ID, scoped to user.
        Returns None if not found OR belongs to another user (same behavior).
        """

    async def create(self, instance: Base) -> Base:
        """
        Insert a new record, automatically setting user_id.
        """
        instance.user_id = self.user_id
        self.db.add(instance)
        await self.db.flush()
        return instance
```

### Auth Router

**Location:** `backend/app/routers/auth.py`

```python
router = APIRouter(prefix="/api/auth", tags=["auth"])

@router.post("/register", response_model=UserResponse, status_code=201)
async def register(body: RegisterRequest, db: AsyncSession = Depends(get_db)):
    """
    Register a new user.
    Request: {email: str, password: str}
    Response: {id, email, display_name} + Set-Cookie header
    Errors: 400 (validation), 409 mapped to generic 400 (email exists)
    """

@router.post("/login", response_model=UserResponse)
async def login(body: LoginRequest, db: AsyncSession = Depends(get_db)):
    """
    Authenticate and create session.
    Request: {email: str, password: str}
    Response: {id, email, display_name} + Set-Cookie header
    Errors: 401 "Invalid email or password"
    """

@router.post("/logout", status_code=204)
async def logout(request: Request, db: AsyncSession = Depends(get_db)):
    """
    Destroy current session.
    Clears session cookie.
    Always returns 204 (idempotent).
    """
```

### User Router

**Location:** `backend/app/routers/user.py`

```python
router = APIRouter(prefix="/api/user", tags=["user"])

@router.get("/profile", response_model=UserProfileResponse)
async def get_profile(current_user: User = Depends(get_current_user)):
    """
    Get authenticated user's profile.
    Response: {email, display_name, created_at}
    """

@router.patch("/profile", response_model=UserProfileResponse)
async def update_profile(
    body: ProfileUpdateRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Update authenticated user's profile.
    Request: {display_name?: str}
    Response: {email, display_name, created_at}
    Errors: 400 (validation - display_name too long)
    """
```

## Data Models

### Users Table

```sql
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    display_name VARCHAR(100),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_users_email ON users (email);
```

### Sessions Table

```sql
CREATE TABLE sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token VARCHAR(255) NOT NULL UNIQUE,
    expires_at TIMESTAMPTZ NOT NULL,
    last_active TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_sessions_token ON sessions (token);
CREATE INDEX idx_sessions_user_id ON sessions (user_id);
CREATE INDEX idx_sessions_expires_at ON sessions (expires_at);
```

### SQLAlchemy Models

```python
# backend/app/models/user.py
class User(Base, TimestampMixin):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    display_name: Mapped[str | None] = mapped_column(String(100), nullable=True)


class Session(Base):
    __tablename__ = "sessions"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    token: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    last_active: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
```

### Pydantic Schemas

```python
# backend/app/schemas/auth.py
class RegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8)

class LoginRequest(BaseModel):
    email: EmailStr
    password: str

class UserResponse(BaseModel):
    id: UUID
    email: str
    display_name: str | None

class UserProfileResponse(BaseModel):
    email: str
    display_name: str | None
    created_at: datetime

class ProfileUpdateRequest(BaseModel):
    display_name: str | None = Field(default=None, max_length=100)
```

## Correctness Properties

### Property 1: Password Never Stored in Plaintext

For any user record in the database, the `password_hash` field must always contain a bcrypt hash (starting with `$2b$`) and never the original plaintext password. No API response, log entry, or error message shall contain a plaintext password or the password_hash value.

**Validates: Requirements 8.1, 8.2, 8.3**

### Property 2: Session Token Unpredictability

Every session token is generated using `secrets.token_urlsafe(32)`, producing 256 bits of cryptographic randomness. No two sessions shall have the same token. Given a valid session token, it must be computationally infeasible to predict any other valid session token.

**Validates: Requirements 2.3, 2.5**

### Property 3: Session Expiry Enforcement

For any session where `expires_at < current_time`, the auth middleware must reject the request with 401 and delete the session. No expired session shall grant access to any protected resource. The sliding window extends expiry on each valid request, but never beyond 30 minutes from the last activity.

**Validates: Requirements 3.1, 3.2**

### Property 4: User Data Isolation

For any authenticated request by user A, all database queries must include a `WHERE user_id = A.id` filter. No API endpoint shall return, modify, or delete data where `user_id != current_user.id`. Attempting to access another user's resource by ID returns 404, not 403.

**Validates: Requirements 7.2, 7.3, 7.4, 7.5**

### Property 5: Generic Error Messages for Auth Failures

Registration with an existing email and login with incorrect credentials must return identical error response structures and HTTP status codes that do not reveal whether the email exists in the system. Response timing must not vary significantly between "email not found" and "password incorrect" cases (bcrypt's constant-time comparison ensures this for login).

**Validates: Requirements 1.4, 2.2**

### Property 6: Idempotent Logout

Calling logout with an invalid, expired, or already-deleted session token must succeed (return 204) without error. Logout must be safe to call multiple times with the same token.

**Validates: Requirements 4.1, 4.2, 4.3**

### Property 7: Cookie Security Attributes

All session cookies set by the application must have: HttpOnly=true (prevents JavaScript access), Secure=true (in production, ensures HTTPS-only transmission), SameSite=Lax (prevents CSRF from cross-origin requests), Path=/api (limits cookie scope to API routes).

**Validates: Requirements 2.5**

## Error Handling

| Scenario | HTTP Status | Response Body | Notes |
|----------|-------------|---------------|-------|
| Registration with invalid email/short password | 400 | `{"detail": "Validation error", "errors": [...]}` | Specific field errors returned |
| Registration with existing email | 400 | `{"detail": "Registration failed. Please check your input and try again."}` | Generic message, no email leak |
| Login with wrong credentials | 401 | `{"detail": "Invalid email or password"}` | Same message for missing email or wrong password |
| Request without session cookie | 401 | `{"detail": "Authentication required"}` | No distinction between missing/invalid/expired |
| Request with expired session | 401 | `{"detail": "Authentication required"}` | Session deleted server-side |
| Request with invalid session token | 401 | `{"detail": "Authentication required"}` | Same as expired |
| Profile update with invalid data | 400 | `{"detail": "Validation error", "errors": [...]}` | Field-specific errors |
| Access to another user's resource | 404 | `{"detail": "Not found"}` | Never reveals resource exists for other user |
| Internal server error | 500 | `{"detail": "Internal server error"}` | No stack traces in production |

### Error Response Schema

```python
class ErrorResponse(BaseModel):
    detail: str
    errors: list[FieldError] | None = None

class FieldError(BaseModel):
    field: str
    message: str
```

## Testing Strategy

### Unit Tests

- **AuthService.register:** Verify bcrypt hashing, email normalization, duplicate email handling, validation errors
- **AuthService.login:** Verify correct password succeeds, wrong password fails, nonexistent email fails, timing consistency
- **AuthService.validate_session:** Verify valid session returns user, expired session returns None and is deleted, unknown token returns None
- **AuthService.logout:** Verify session deletion, idempotent behavior
- **UserService.get_profile:** Verify correct fields returned, password_hash excluded
- **UserService.update_profile:** Verify display_name update, length validation
- **UserScopedQuery:** Verify queries always include user_id filter, cross-user access returns None

### Integration Tests

- **POST /api/auth/register:** Full request/response cycle with cookie verification
- **POST /api/auth/login:** Successful login sets cookie, failed login returns 401
- **POST /api/auth/logout:** Cookie cleared, subsequent requests fail
- **GET /api/user/profile:** Returns profile for authenticated user, 401 for unauthenticated
- **PATCH /api/user/profile:** Updates display_name, validates constraints
- **Session expiry:** Verify requests fail after 30 minutes of inactivity
- **Data isolation:** Create two users, verify user A cannot access user B's resources

### Security Tests

- Verify password_hash never appears in any API response
- Verify session cookie has correct security attributes
- Verify timing of login responses doesn't leak email existence
- Verify expired sessions are properly cleaned up
- Verify brute-force resistance (bcrypt cost factor makes attempts slow)

