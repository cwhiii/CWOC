# User Admin

**Category:** Standalone Pages
**Item #:** 51
**Code Verified:** ⬜
**User Verified:** ⬜

## Functions, Buttons, Controls & Inputs

### State Variables
- [ ] _adminUsers — array of all users from API
- [ ] _resetPasswordUserId — user ID for password reset modal
- [ ] _editUserId — user ID for edit modal
- [ ] _adminMessageDiv — cached DOM reference for message area
- [ ] _userTableWrap — cached DOM reference for table container
- [ ] _createUserModal — cached DOM reference for create modal
- [ ] _resetPasswordModal — cached DOM reference for reset password modal

### Toolbar
- [ ] "Create User" button (#create-user-btn) — opens create user modal (onclick → openCreateUserModal)

### User Table
- [ ] Table columns: Profile Image, Username, Display Name, Email, Status, Role, Actions
- [ ] Status badges — Active (green) / Inactive (red)
- [ ] Role badges — Admin (yellow) / User (brown)
- [ ] Action buttons per row:
  - [ ] Deactivate button (for active users) — onclick → deactivateUser(userId)
  - [ ] Reactivate button (for inactive users) — onclick → reactivateUser(userId)
  - [ ] Edit button — onclick → openEditUserModal(user)
  - [ ] Reset Password button — onclick → openResetPasswordModal(userId, username)

### Functions — Message Helpers
- [ ] _showAdminMessage(text, type) — shows inline success/error message
- [ ] _clearAdminMessage() — clears message area

### Functions — Data Loading
- [ ] _loadUsers() — async GET /api/users, renders table
- [ ] _renderUserTable() — builds table with all user rows and action buttons

### Functions — Create User Modal
- [ ] openCreateUserModal() — clears inputs, shows modal
- [ ] closeCreateUserModal() — hides modal
- [ ] submitCreateUser() — async POST /api/users with username, display_name, password, email, is_admin

### Create User Modal Fields
- [ ] Username input (#new-username) — required
- [ ] Display Name input (#new-display-name) — required
- [ ] Password input (#new-password) — required
- [ ] Email input (#new-email) — optional
- [ ] Administrator checkbox (#new-is-admin)
- [ ] Error display (#create-user-error)
- [ ] Cancel button (onclick → closeCreateUserModal)
- [ ] ✅ Create button (onclick → submitCreateUser)

### Functions — Deactivate / Reactivate
- [ ] deactivateUser(userId) — async PUT /api/users/{id}/deactivate, shows message, reloads
- [ ] reactivateUser(userId) — async PUT /api/users/{id}/reactivate, shows message, reloads

### Functions — Edit User Modal (dynamically created)
- [ ] openEditUserModal(user) — creates and shows edit modal pre-filled with user data
- [ ] closeEditUserModal() — removes edit modal from DOM
- [ ] submitEditUser() — async PUT /api/users/{id} with username, display_name, email, is_admin

### Edit User Modal Fields
- [ ] Username input (#edit-user-username)
- [ ] Display Name input (#edit-user-display-name)
- [ ] Email input (#edit-user-email)
- [ ] Admin checkbox (#edit-user-is-admin)
- [ ] Error display (#edit-user-error)
- [ ] Cancel button (onclick → closeEditUserModal)
- [ ] Save button (onclick → submitEditUser)
- [ ] ESC key closes modal (capture phase)

### Functions — Reset Password Modal
- [ ] openResetPasswordModal(userId, username) — shows modal with user label
- [ ] closeResetPasswordModal() — hides modal, clears state
- [ ] submitResetPassword() — async PUT /api/users/{id}/reset-password with new_password

### Reset Password Modal Fields
- [ ] User label display (#reset-pw-user-label)
- [ ] New Password input (#reset-new-password)
- [ ] Error display (#reset-pw-error)
- [ ] Cancel button (onclick → closeResetPasswordModal)
- [ ] 🔑 Reset button (onclick → submitResetPassword)

### Initialization
- [ ] DOMContentLoaded listener — caches DOM refs, waits for auth, checks admin status, loads users
- [ ] Admin guard — redirects non-admins to dashboard
- [ ] waitForAuth integration

### Mobile Responsive
- [ ] Card-style table layout on mobile (thead hidden, flex-wrap rows)
- [ ] data-label attributes for mobile labels
