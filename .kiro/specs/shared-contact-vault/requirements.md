# Requirements Document

## Introduction

The Shared Contact Vault is a server-wide contact sharing feature for CWOC. It allows any user to mark individual contacts as "shared to the vault," making those contacts visible and usable by all other users on the same CWOC instance. Each user also gets a per-user setting to control whether new contacts default to shared or private. The vault is read-only for non-owners — only the contact owner can edit or delete a shared contact. This feature extends the existing contacts system (the `contacts` table with `owner_id` scoping) and the existing settings system.

## Glossary

- **Contact_Editor**: The contact editor page (`contact-editor.html`) where users create and edit individual contacts
- **People_Page**: The people/contacts list page (`people.html`) that displays all contacts and users in a browsable list
- **Settings_Page**: The settings page (`settings.html`) where users configure their preferences
- **Contact_Vault**: The server-wide pool of contacts that have been marked as shared by their owners
- **Vault_Checkbox**: The checkbox control in the Contact_Editor that toggles whether a contact is shared to the Contact_Vault
- **Vault_Default_Setting**: The per-user setting that controls whether newly created contacts default to shared or private
- **Contact_Owner**: The user whose `owner_id` matches the contact record — the only user who can edit or delete the contact
- **Vault_Contact**: A contact record where the `shared_to_vault` field is set to true, making it visible to all users
- **Non_Owner_User**: Any authenticated user on the server who is not the Contact_Owner of a given contact

## Requirements

### Requirement 1: Share Contact to Vault via Checkbox

**User Story:** As a user, I want a checkbox in the Contact_Editor to share a contact to the Contact_Vault, so that other users on the server can see that contact's information.

#### Acceptance Criteria

1. WHEN the Contact_Editor loads for an existing contact, THE Contact_Editor SHALL display a Vault_Checkbox reflecting the current `shared_to_vault` state of the contact.
2. WHEN the Contact_Editor loads for a new contact, THE Contact_Editor SHALL set the Vault_Checkbox to the value of the user's Vault_Default_Setting.
3. WHEN the user checks the Vault_Checkbox and saves the contact, THE Contact_Editor SHALL persist `shared_to_vault` as true on the contact record.
4. WHEN the user unchecks the Vault_Checkbox and saves the contact, THE Contact_Editor SHALL persist `shared_to_vault` as false on the contact record.
5. THE Vault_Checkbox SHALL appear in the Context zone of the Contact_Editor, grouped with the Organization and Social Context fields.

### Requirement 2: Vault Default Setting

**User Story:** As a user, I want a setting on the Settings_Page to control whether my new contacts default to shared or private, so that I do not have to manually toggle the checkbox for every contact.

#### Acceptance Criteria

1. THE Settings_Page SHALL display a toggle for the Vault_Default_Setting within the General Settings group.
2. WHEN the Vault_Default_Setting is set to "share," THE Contact_Editor SHALL pre-check the Vault_Checkbox for new contacts.
3. WHEN the Vault_Default_Setting is set to "do not share," THE Contact_Editor SHALL leave the Vault_Checkbox unchecked for new contacts.
4. THE Vault_Default_Setting SHALL default to "do not share" for new users and existing users who have not configured the setting.
5. WHEN the user saves settings with a changed Vault_Default_Setting, THE Settings_Page SHALL persist the new value to the user's settings record.

### Requirement 3: Vault Contacts Visible to All Users

**User Story:** As a user, I want to see contacts shared to the Contact_Vault by other users on the People_Page, so that I can access shared contact information without duplicating entries.

#### Acceptance Criteria

1. WHEN the People_Page loads, THE People_Page SHALL fetch and display Vault_Contacts from all users in addition to the current user's own contacts.
2. THE People_Page SHALL display Vault_Contacts in a dedicated "Shared Vault" section, visually distinct from the user's own contacts.
3. WHEN a search query is entered, THE People_Page SHALL include Vault_Contacts in the search results using the same search fields as the user's own contacts.
4. THE People_Page SHALL display a visual indicator (icon or badge) on each Vault_Contact to identify the Contact_Owner.
5. WHEN the user's own contact is also shared to the vault, THE People_Page SHALL display that contact in the user's own contacts section and omit the duplicate from the Shared Vault section.

### Requirement 4: Read-Only Access for Non-Owners

**User Story:** As a user, I want to view shared vault contacts in read-only mode, so that I can see the information without accidentally modifying another user's contact.

#### Acceptance Criteria

1. WHEN a Non_Owner_User opens a Vault_Contact in the Contact_Editor, THE Contact_Editor SHALL render all fields as read-only.
2. WHEN a Non_Owner_User views a Vault_Contact, THE Contact_Editor SHALL hide the Save, Delete, and Favorite buttons.
3. THE Contact_Editor SHALL display a read-only banner identifying the Contact_Owner when a Non_Owner_User views a Vault_Contact.
4. WHEN a Non_Owner_User attempts to update a Vault_Contact via the API, THE API SHALL return a 403 Forbidden response.
5. WHEN a Non_Owner_User attempts to delete a Vault_Contact via the API, THE API SHALL return a 403 Forbidden response.

### Requirement 5: Backend Data Model for Vault Sharing

**User Story:** As a developer, I want the contact data model to support vault sharing, so that the backend can store and query shared contacts correctly.

#### Acceptance Criteria

1. THE Database SHALL store a `shared_to_vault` boolean field on each contact record, defaulting to false.
2. THE Database migration SHALL add the `shared_to_vault` column to the existing `contacts` table without data loss.
3. WHEN a contact is created with `shared_to_vault` set to true, THE API SHALL persist the value in the database.
4. WHEN a contact is updated with a changed `shared_to_vault` value, THE API SHALL persist the new value and record the change in the audit log.
5. THE Settings Database SHALL store a `vault_default_share` text field on the settings record, defaulting to "0" (do not share).

### Requirement 6: Vault Contacts API Endpoint

**User Story:** As a developer, I want an API endpoint to retrieve vault contacts, so that the frontend can display shared contacts from all users.

#### Acceptance Criteria

1. THE API SHALL provide a `GET /api/contacts/vault` endpoint that returns all contacts where `shared_to_vault` is true.
2. WHEN the vault endpoint is called, THE API SHALL exclude contacts owned by the requesting user from the results.
3. THE API SHALL include the `owner_display_name` field on each returned Vault_Contact so the frontend can identify the Contact_Owner.
4. WHEN the vault endpoint is called with a search query parameter, THE API SHALL filter results using the same search fields as the standard contacts endpoint.
5. IF the requesting user is not authenticated, THEN THE API SHALL return a 401 Unauthorized response.

### Requirement 7: Owner Indicator on Shared Contacts

**User Story:** As a user, I want to see who shared a vault contact, so that I know who to contact if I have questions about the information.

#### Acceptance Criteria

1. THE People_Page SHALL display the Contact_Owner's display name on each Vault_Contact row.
2. THE Contact_Editor SHALL display the Contact_Owner's display name in the read-only banner when a Non_Owner_User views a Vault_Contact.
3. WHEN the Contact_Owner's display name is not available, THE People_Page SHALL fall back to displaying the Contact_Owner's username.

### Requirement 8: Vault Checkbox Reflects Owner's Vault Status

**User Story:** As a contact owner, I want the vault checkbox to accurately reflect whether my contact is currently shared, so that I can manage sharing status at any time.

#### Acceptance Criteria

1. WHEN the Contact_Owner opens an existing contact that is shared to the vault, THE Contact_Editor SHALL display the Vault_Checkbox as checked.
2. WHEN the Contact_Owner opens an existing contact that is not shared to the vault, THE Contact_Editor SHALL display the Vault_Checkbox as unchecked.
3. WHEN the Contact_Owner unchecks the Vault_Checkbox and saves, THE contact SHALL be removed from the Contact_Vault and no longer visible to other users.
