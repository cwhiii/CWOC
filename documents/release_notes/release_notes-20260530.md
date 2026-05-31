## cwoc_server-20260530_1409
Added support for multiple locations per chit. Each chit can now have multiple locations with labels, geocoded coordinates, and a primary location designation. Weather displays for the primary location. Maps page shows all locations with primary markers highlighted. Legacy single-location chits are automatically migrated to the new format.

## cwoc_app-20260530_1409
Added support for multiple locations per chit. Each chit can now have multiple locations with labels, geocoded coordinates, and a primary location designation. Weather displays for the primary location. Legacy single-location chits are automatically migrated to the new format.

## cwoc_server-20260530_0629
Fixed USPS (and other) tracking badges not appearing on email cards when the tracking number appears deep in the email body. The chit list endpoint was truncating `email_body_text` to 200 characters for card rendering — far too short for emails like REI shipping notifications where the tracking number appears ~1,500 characters in. Increased the truncation limit to 3,000 characters, which covers virtually all real-world cases while keeping the payload reasonable.
