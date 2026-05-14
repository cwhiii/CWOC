# Contact Editor

Contacts have name fields (prefix, given, middle, surname, suffix), phone, email, address, social/web, security (Signal, PGP), and context (organization, social context).

- **Notes** — Markdown notes field for free-form text about the contact
- **Tags** — Tags for contacts, auto-prefixed with "Contact/" (shared with the general tag system)
- **Suffixes** — Text suffixes (Jr., Sr., Esq., Ph.D., M.D.) listed before numeric suffixes (I–X)
- **Signal Message** — When a contact has Signal enabled and a username or phone number entered, a "Signal" button appears that opens Signal to start a conversation with that person
- **Contact Vault** — Toggle "Share to Vault" to make a contact visible to all users on the server. Vault contacts from other users appear in a separate "🏛️ Contact Vault" section on the People page and can be edited by anyone with access.
- **Deleted Contacts (Trash)** — Deleted contacts are soft-deleted and can be restored from the Trash button on the People page. From the contact trash page you can restore or permanently delete contacts.
- **Dates on Calendar** — Each date entry (Birthday, Anniversary, etc.) has a calendar icon toggle. When enabled (default), the date generates an annual all-day event on the calendar showing the person's name and age. Double-click a birthday event to open the contact editor. These entries appear in search results and across all calendar views (Week, Day, Month, Itinerary, Year)
- **PGP Key Validation** — The Security zone has a "Validate Key" button next to the PGP public key textarea. It checks the key using OpenPGP.js and shows the user ID, algorithm, and fingerprint if valid
- **Private PGP Key (Profile only)** — In your own profile (not contacts or other users' profiles), the Security zone includes a "Private PGP Key" section. It is locked by default and requires your account password to view or edit. The private key is encrypted at rest on the server and never returned in normal API responses. Use Unlock to view/edit, Save to store, Lock to hide again, or Remove to delete it permanently

---

**See also:** [Sharing](/frontend/html/help.html#sharing) · [Maps](/maps) · [Email](/frontend/html/help.html#email)
