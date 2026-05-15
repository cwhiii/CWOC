#!/usr/bin/env python3
"""Update Settings links in help docs to include tab/section hashes."""
import os
import re

HELP_DIR = "/Users/cwhiii/Personal/Misc/Development/CWOC/src/help"

# Patterns to replace: "Settings](/frontend/html/settings.html) → Section"
# becomes: "Settings → Section](/frontend/html/settings.html#hash)"
# The idea: the whole "Settings → Section" phrase becomes the link text,
# and the URL includes the hash for deep-linking.

REPLACEMENTS = [
    # Email tab
    (r'\[Settings\]\(/frontend/html/settings\.html\) → Email → Accounts', '[Settings → Email → Accounts](/frontend/html/settings.html#email)'),
    (r'\[Settings\]\(/frontend/html/settings\.html\) → Email → Signature', '[Settings → Email → Signature](/frontend/html/settings.html#email)'),
    (r'\[Settings\]\(/frontend/html/settings\.html\) → Email → Syncing', '[Settings → Email → Syncing](/frontend/html/settings.html#email)'),
    (r'\[Settings\]\(/frontend/html/settings\.html\) → Email', '[Settings → Email](/frontend/html/settings.html#email)'),
    (r'\[Settings\]\(/frontend/html/settings\.html\) → Badges', '[Settings → Badges](/frontend/html/settings.html#badges)'),
    # Admin tab
    (r'\[Settings\]\(/frontend/html/settings\.html\) → Data Management', '[Settings → Data Management](/frontend/html/settings.html#data-management)'),
    (r'\[Settings\]\(/frontend/html/settings\.html\) → Data → Audit Log Limits', '[Settings → Data → Audit Log Limits](/frontend/html/settings.html#data-management)'),
    (r'\[Settings\]\(/frontend/html/settings\.html\) → Data → Audit Log', '[Settings → Data → Audit Log](/frontend/html/settings.html#data-management)'),
    (r'\[Settings\]\(/frontend/html/settings\.html\) → Data', '[Settings → Data](/frontend/html/settings.html#data-management)'),
    (r'\[Settings\]\(/frontend/html/settings\.html\) → Dependent Apps → Ntfy', '[Settings → Dependent Apps → Ntfy](/frontend/html/settings.html#dependent-apps)'),
    (r'\[Settings\]\(/frontend/html/settings\.html\) → Dependent Apps', '[Settings → Dependent Apps](/frontend/html/settings.html#dependent-apps)'),
    (r'\[Settings\]\(/frontend/html/settings\.html\) → Home Assistant', '[Settings → Home Assistant](/frontend/html/settings.html#home-assistant)'),
    (r'\[Settings\]\(/frontend/html/settings\.html\) → Tools → Kiosk', '[Settings → Tools → Kiosk](/frontend/html/settings.html#kiosk)'),
    (r'\[Settings\]\(/frontend/html/settings\.html\) → Kiosk', '[Settings → Kiosk](/frontend/html/settings.html#kiosk)'),
    # Views tab
    (r'\[Settings\]\(/frontend/html/settings\.html\) → 🔮 Omni View', '[Settings → 🔮 Omni View](/frontend/html/settings.html#omni-view)'),
    (r'\[Settings\]\(/frontend/html/settings\.html\) → Omni View', '[Settings → Omni View](/frontend/html/settings.html#omni-view)'),
    (r'\[Settings\]\(/frontend/html/settings\.html\) → 🗺️ Map Settings', '[Settings → 🗺️ Map Settings](/frontend/html/settings.html#map-settings)'),
    (r'\[Settings\]\(/frontend/html/settings\.html\) → Map Settings', '[Settings → Map Settings](/frontend/html/settings.html#map-settings)'),
    (r'\[Settings\]\(/frontend/html/settings\.html\) → Habits', '[Settings → Habits](/frontend/html/settings.html#habits)'),
    (r'\[Settings\]\(/frontend/html/settings\.html\) → Period Options', '[Settings → Period Options](/frontend/html/settings.html#periods)'),
    # General tab
    (r'\[Settings\]\(/frontend/html/settings\.html\) → General', '[Settings → General](/frontend/html/settings.html#general)'),
    (r'\[Settings\]\(/frontend/html/settings\.html\) → Custom Filters & Sorting', '[Settings → Custom Filters & Sorting](/frontend/html/settings.html#custom-filters)'),
    (r'\[Settings\]\(/frontend/html/settings\.html\) → Custom Filters', '[Settings → Custom Filters](/frontend/html/settings.html#custom-filters)'),
    (r'\[Settings\]\(/frontend/html/settings\.html\) → Visual Indicators', '[Settings → Visual Indicators](/frontend/html/settings.html#visual-indicators)'),
    (r'\[Settings\]\(/frontend/html/settings\.html\) → Clocks', '[Settings → Clocks](/frontend/html/settings.html#clocks)'),
    (r'\[Settings\]\(/frontend/html/settings\.html\) → Unit System', '[Settings → Unit System](/frontend/html/settings.html#unit-system)'),
    (r'\[Settings\]\(/frontend/html/settings\.html\) → Chit Options', '[Settings → Chit Options](/frontend/html/settings.html#general)'),
    (r'\[Settings\]\(/frontend/html/settings\.html\) → 📱 Install as App', '[Settings → 📱 Install as App](/frontend/html/settings.html#install-app)'),
    # Collections tab
    (r'\[Settings\]\(/frontend/html/settings\.html\) → Saved Locations', '[Settings → Saved Locations](/frontend/html/settings.html#saved-locations)'),
    (r'\[Settings\]\(/frontend/html/settings\.html\) → Tag Editor', '[Settings → Tag Editor](/frontend/html/settings.html#tags)'),
    # Ntfy (in admin)
    (r'\[Settings\]\(/frontend/html/settings\.html\) → Ntfy', '[Settings → Ntfy](/frontend/html/settings.html#dependent-apps)'),
]

def process_file(filepath):
    with open(filepath, "r", encoding="utf-8") as f:
        content = f.read()
    
    original = content
    for pattern, replacement in REPLACEMENTS:
        content = re.sub(pattern, replacement, content)
    
    if content != original:
        with open(filepath, "w", encoding="utf-8") as f:
            f.write(content)
        print(f"  Updated: {os.path.basename(filepath)}")
    else:
        print(f"  No changes: {os.path.basename(filepath)}")

def main():
    print("Fixing Settings deep-links...")
    for fname in sorted(os.listdir(HELP_DIR)):
        if fname.endswith(".md"):
            process_file(os.path.join(HELP_DIR, fname))
    print("Done!")

if __name__ == "__main__":
    main()
