# Data Directory

This directory holds seed data that gets imported during `install.sh`.

## gutenberg_catalog.csv

A pre-built export of the Gutenberg book catalog (~75,000 books, ~15-20 MB).

If this file exists, `install.sh` will import it directly into the database
instead of waiting 1-2 hours for the background sync from Gutendex.

### How to generate it:

1. Go to **Settings > Book Catalog Cache** in the CWOPOD web UI
2. Click **📥 Export Cache (CSV)**
3. Place the downloaded `gutenberg_catalog.csv` file in this directory
4. Commit it to the repo

On the next deploy, `install.sh` will detect and import it automatically.
