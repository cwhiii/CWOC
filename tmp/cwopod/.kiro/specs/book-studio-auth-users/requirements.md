# Requirements Document

## Introduction

The Auth & Users module provides user registration, authentication, session management, and data isolation for C.W.'s O-POD. It ensures that each user has a private, secure workspace where their book projects, configurations, and credentials are completely isolated from other users. This module is the foundation upon which all other modules depend for identity and access control.

## Glossary

- **AuthService**: The service responsible for user registration, login, logout, and session validation
- **UserService**: The service responsible for user profile management and preferences
- **Session**: A server-side record linking a session token to an authenticated user, with expiry tracking
- **Session_Token**: A cryptographically random string stored in an HTTP-only cookie, used to identify the authenticated user on each request
- **Auth_Middleware**: A FastAPI dependency that extracts and validates the session token from incoming requests, rejecting unauthenticated access
- **User_Scope**: The automatic filtering of all database queries by the authenticated user's ID, ensuring data isolation

## Requirements

### Requirement 1: User Registration

**User Story:** As a new user, I want to create an account with my email and password, so that I can access C.W.'s O-POD and have my own private workspace.

#### Acceptance Criteria

1. WHEN a user submits a registration request with a valid email and password, THE AuthService SHALL create a new user account with the email stored in lowercase and the password hashed using bcrypt with a minimum cost factor of 12
2. THE AuthService SHALL validate that the email conforms to a standard email format (contains @ and a domain with at least one dot) before accepting registration
3. THE AuthService SHALL require passwords to be at least 8 characters in length
4. IF a registration request is submitted with an email that is already registered, THEN THE AuthService SHALL reject the request and return a generic error message that does not reveal whether the email is already in use (e.g., "Registration failed. Please check your input and try again.")
5. WHEN registration succeeds, THE AuthService SHALL automatically log the user in by creating a session and returning the session token in an HTTP-only cookie
6. IF a registration request is submitted with an invalid email format or a password shorter than 8 characters, THEN THE AuthService SHALL reject the request and return a validation error indicating which fields are invalid

### Requirement 2: User Login

**User Story:** As a registered user, I want to log in with my email and password, so that I can access my book projects and settings.

#### Acceptance Criteria

1. WHEN a user submits valid credentials (email and password), THE AuthService SHALL verify the password against the stored bcrypt hash and, upon success, create a new session record and return the session token in an HTTP-only cookie
2. IF a login request is submitted with an email that does not exist or a password that does not match, THEN THE AuthService SHALL reject the request and return a generic error message "Invalid email or password" that does not reveal whether the email exists in the system
3. WHEN a session is created, THE AuthService SHALL generate the session token using `secrets.token_urlsafe(32)` to produce a cryptographically secure random token
4. WHEN a session is created, THE AuthService SHALL set the session expiry to 30 minutes from the current time and record the current time as last_active
5. THE AuthService SHALL set the session cookie with the following attributes: HttpOnly=true, Secure=true (in production), SameSite=Lax, Path=/api

### Requirement 3: Session Management

**User Story:** As an authenticated user, I want my session to remain active while I'm using the application, and expire automatically when I'm inactive, so that my account stays secure.

#### Acceptance Criteria

1. WHEN an authenticated request is received, THE Auth_Middleware SHALL update the session's last_active timestamp and extend expires_at to 30 minutes from the current time (sliding window expiry)
2. IF a request is received with a session token whose expires_at is in the past, THEN THE Auth_Middleware SHALL reject the request with a 401 Unauthorized response and delete the expired session record
3. IF a request is received without a session cookie or with an invalid/unknown session token, THEN THE Auth_Middleware SHALL reject the request with a 401 Unauthorized response
4. THE AuthService SHALL provide a mechanism to delete expired sessions from the database (cleanup), which can be run periodically
5. WHEN a user has multiple active sessions (e.g., from different devices), THE AuthService SHALL manage each session independently so that expiry of one does not affect others

### Requirement 4: User Logout

**User Story:** As an authenticated user, I want to log out so that my session is terminated and no one else can use my browser session.

#### Acceptance Criteria

1. WHEN a user submits a logout request, THE AuthService SHALL delete the session record from the database and clear the session cookie from the response
2. AFTER logout, any subsequent requests using the same session token SHALL be rejected with a 401 Unauthorized response
3. IF a logout request is received without a valid session, THE AuthService SHALL return a successful response without error (idempotent logout)

### Requirement 5: Auth Middleware and Route Protection

**User Story:** As a system administrator, I want all API routes (except registration and login) to require authentication, so that unauthenticated users cannot access any application data or functionality.

#### Acceptance Criteria

1. THE Auth_Middleware SHALL be applied as a FastAPI dependency to all API routes except: POST /api/auth/register, POST /api/auth/login, and GET /api/health
2. WHEN the Auth_Middleware validates a session successfully, it SHALL make the authenticated user's ID available to the route handler via the request state or dependency injection
3. IF the Auth_Middleware rejects a request, THE response SHALL include a JSON body with an error message and a 401 HTTP status code
4. THE Auth_Middleware SHALL NOT reveal any information about why authentication failed beyond "Authentication required" (not distinguishing between missing token, invalid token, or expired session in the response)

### Requirement 6: User Profile Management

**User Story:** As an authenticated user, I want to view and update my profile information, so that I can manage my display name and account settings.

#### Acceptance Criteria

1. WHEN an authenticated user requests their profile, THE UserService SHALL return the user's email, display_name, and created_at timestamp
2. WHEN an authenticated user submits a profile update, THE UserService SHALL allow updating the display_name field (maximum 100 characters)
3. THE UserService SHALL NOT allow changing the email address through the profile update endpoint
4. IF a profile update contains a display_name exceeding 100 characters, THEN THE UserService SHALL reject the update with a validation error

### Requirement 7: Data Isolation

**User Story:** As a user, I want to be certain that no other user can access my book projects, settings, or credentials, so that my data remains private and secure.

#### Acceptance Criteria

1. THE application SHALL include a user_id column on all user-owned database tables (book_projects, ai_configs, provider_credentials, print_orders, corrections, cover_prompts, cover_layouts)
2. THE application SHALL provide a user-scoped query helper that automatically filters all SELECT queries by the authenticated user's user_id, ensuring no cross-user data leakage at the ORM level
3. THE application SHALL enforce user_id scoping on all INSERT operations, automatically setting user_id to the authenticated user's ID
4. THE application SHALL NOT provide any API endpoint that returns data belonging to a different user, regardless of whether the requester knows the resource ID
5. IF a user attempts to access a resource (by ID) that belongs to another user, THEN THE application SHALL return a 404 Not Found response (not 403 Forbidden, to avoid revealing the resource exists)

### Requirement 8: Password Security

**User Story:** As a user, I want my password to be stored securely so that even if the database is compromised, my password cannot be easily recovered.

#### Acceptance Criteria

1. THE AuthService SHALL hash all passwords using bcrypt with a cost factor of at least 12 before storing them in the database
2. THE AuthService SHALL never store, log, or return plaintext passwords in any response, log entry, or error message
3. THE AuthService SHALL never include password_hash in any API response or serialized user object
4. WHEN verifying a password during login, THE AuthService SHALL use bcrypt's constant-time comparison to prevent timing attacks

