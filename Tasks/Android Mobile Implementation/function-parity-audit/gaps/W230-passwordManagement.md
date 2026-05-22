# W230-232: Password Management

## What the web functions do
W230-232 handle password change functionality in the user profile:
- Opening a password change modal/form
- Validating current password + new password + confirmation
- Submitting password change to the server (PUT /api/auth/users/{id}/password)

## What exists on Android
- Profile mode exists in ContactEditorScreen (isProfileMode)
- Login screen handles authentication
- No password change UI in the profile or settings

## What's missing
1. No "Change Password" UI anywhere in the Android app
2. No password change form (current password + new password + confirm)
3. No API call to PUT /api/auth/users/{id}/password from the app
4. Users must change their password from the web app
