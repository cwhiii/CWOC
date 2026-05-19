# Login

**Category:** Standalone Pages
**Item #:** 55
**Code Verified:** ⬜
**User Verified:** ⬜

## Functions, Buttons, Controls & Inputs

### Login Card
- [ ] Logo image (/static/cwod_logo.png) — 80×80px circular
- [ ] Title "C.W.'s Omni Chits" — uppercase, letter-spaced

### Login Form (#loginForm)
- [ ] Username input (#username) — type="text", autocomplete="username", required, autofocus
- [ ] Password input (#password) — type="password", autocomplete="current-password", required
- [ ] Error message display (#loginError) — role="alert", aria-live="polite", hidden by default
- [ ] Log In button (#loginBtn) — type="submit", uppercase styled

### Instance Name Display
- [ ] Instance name div (#login-instance-name) — italic, shown below login card when configured

### Welcome Message
- [ ] Welcome message div (#login-welcome-message) — markdown-rendered, shown below login card when configured
- [ ] Styled as a second card matching login card appearance

### Functions — Welcome Message Loading
- [ ] IIFE fetches /api/auth/login-message
- [ ] Renders message via marked.parse() (markdown)
- [ ] Shows instance_name if present in response

### Functions — Login Form Submission
- [ ] form submit event handler (preventDefault)
- [ ] showError(message) — displays error with .visible class
- [ ] clearError() — hides error message
- [ ] Form validation — checks both username and password are non-empty
- [ ] Button state management — disabled + "Logging in…" text during request
- [ ] async POST /api/auth/login with JSON body {username, password}
- [ ] On success (200):
  - [ ] Checks localStorage for cwoc_auth_return URL
  - [ ] Redirects to stored return URL or dashboard (/)
  - [ ] Removes stored return URL from localStorage
- [ ] On 429 — "Too many login attempts" error
- [ ] On 401 — "Invalid username or password" error
- [ ] On other errors — "An unexpected error occurred" error
- [ ] On network error — "Unable to reach the server" error
- [ ] Finally block — re-enables button, restores "Log In" text

### External Dependencies
- [ ] marked.js (CDN) — for rendering welcome message markdown
- [ ] marked.use({ breaks: true }) — enables line breaks in markdown

### Styling Notes
- [ ] Self-hosted Lora variable font (no shared-page.css dependency)
- [ ] Parchment background image
- [ ] Gradient login card with gold radial overlay
- [ ] Custom focus styles with brown shadow
- [ ] Gradient submit button with hover/active states
- [ ] Mobile responsive (smaller padding/font at 480px)

### Security Features
- [ ] autocomplete attributes for password managers
- [ ] Rate limiting feedback (429 response handling)
- [ ] No password visibility toggle
- [ ] Return URL stored in localStorage (cwoc_auth_return)

### PWA
- [ ] PWA manifest link
- [ ] Apple touch icon
- [ ] Theme color meta tag
- [ ] pwa-register.js script
