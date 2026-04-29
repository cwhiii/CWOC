# Aesthetic
1940s +magic aesthetic. Parchment and ivory. 

EXPLAIN WITHOUT WRITING CODE how you'll fix each issue. 

Implement those changes. Then double check to ensure you ACTUALLY resolved each, and didn't break or change anything else. 
# ToDo / Fix Me

Make Omni Chits key

Type, Criteria (Has) 
Reminder = Title and notification.
Event (calendar) = Start & end dates.
Task = Due date OR??? (checkbox for it that gets enabled automatically when due date entered?)
Note = Note 
Project = Project Master checkbox enabled. 
Checklist = checklist items

# Make Work
Zones: 
 - [ ] Notes (markdown)
 - [x] Weather ✅ 2025-06-16
	 - [x] ALL ✅ 2025-06-16
	 - [ ] Fix: formatting
 - [x] Location (WHERE'D Google come from?!?) ✅ 2025-06-16
	 - [ ] Need: HTTPS to allow getting location.
 - [ ] Tags  (ALL)
	 - [ ] one that's the Primary Tag, which auto colors the chit. 
 - [ ] People  (ALL)
 - [x] Checklists (most functions) ✅ 2025-06-30
 - [ ] Alerts (ALL)
 - [ ] Health Indicators (ALL & BLANK)
 - [ ] Colors (ALL)
 - [ ] Projects (ALL)
- [ ] ALL UI functionality
- [ ] Month view: Fill in pre-& post days. (so the full square of dates is filled in.)
- [ ] Main view: fileter for status: have an option for NO status. 
- [ ] Calendar/Day view doesn't work. 
- [ ] Make: Calendar: 7 day view.
- [ ] Notification based on start time, location, and TOTAL DRIVE TIME
- [ ] Hide end date unless 
- [x] fix cancel check. ✅ 2025-06-18
- [ ] add the icons for each type of shit to the view button
- [ ] When switching to task, then back to anything else, the sort-by dropdown doesnt go back to a week-changer (or whatevr;s appliable)
- [ ] Extract the make new tags/colors code, and use it in chit editor?
- [ ] On editor: Hotkey ESC to exit.
- [ ] Indicators View should just be charts of trends , etc. 
- [ ] Crete functionality to handle reoccuring chits

# Misc Thoughts
Event by quantity of TIME, NOT chronological time.

So it starts at 8:90,and goes for 5 minutes. But if you snooze it,, it slides the event. Until you start it. (cello practice, writing, etc).


Chit is Task based on checklist. When checklist is complete, task maemrked complete. For daily activities such as :

- Take vitamins 

- Write something 

- Do exersices

Great for reoccurring task. 

  
  
  

Option to auto-archive reoccurring events based on compltion. Once complete, archive it to hide it from view.

## Bugs
- [ ] Projects filter doesn't do anything when clicked.

## Things to make and fix and do 

- [x] ALSO< make each status collapseable, Use the same collapseing technique as on the projexts zone. ✅ 2025-05-26
- [ ] Weather: flag for heavy winds, like precipitation.
- [ ] Status: NA / -.
- [ ] Jitter: give reminders a jitter time. This makes the reminders go off +/- X minutes, so you don't get 12 reminders all a the same time.  End user configurable, and an option on chits to enable or disable Jitter. (enabled by default once it's been set by the universal setting. Perhaps segregated by what flavor the chit was originally created as? (no jitter for timers, for example)) 
- [ ] Add a Starred or Favorite status to tags, so those always show up at the top of the list.
- [ ] Let's go back to thte people zoen. When a person is added, it should use a modal, like alerts do. Enter a name via styping (with an auto-generated drop down of existing people as they type), and a multi-select of the people types (not a drop down, the full list should be visible).
- [ ] FIx the filters in People, alerts, and projects, to show the sections (people roles, project statuses, and alert types, depending on which zone is being filtered). It should have a multi-select menu appear, touching the button, that has the list of the things, and shows/hides the thigns as they are selcted & deselected in real-time. 
- [ ] universally unique installation instance ID 
- [ ] Tidy everything, alignment, etc. 
- [ ] Notes are all saving to a single line. 
- [ ] Add Hotkey to indent & unindent chick list items
- [ ] Weather bar tranparant shouldnt; when color removed. 
- [ ] standardized all the zones in a single class
- [ ] add hotkeys to jump to and expand each individual Zone.
- [ ] hide weather CONTENTS unless chit has a location & a date. (option in settings for default weather location of home.) 
- [ ] setting for Home/default address. 
- [ ] auto-generated individual QR codes per CHit.
- [ ] add a view called declined events
- [ ] Busy / free status for chits.
- [ ] Fix: hotkeys
- [x] Types of People: ✅ 2025-05-28
	- [ ] Owners
	- [ ] Stakeholders
	- [ ] Editors
	- [ ] Assignees
	- [ ] Guests
	- [ ] Followers
- [ ] Option to Hide/Stealth a chit from All other Users.
- [ ] Multi-ower-view, for wall stations/common areas.
- [ ] Profile filds for the focset & updated time of forecast, high, low, procopitation (style and quantity), weather code, 
- [ ] Settings page: mapping service, chit groups (like different Google calendars, via a tags? )
- [ ] UI control to filter by chit group. And the backend to support it. 
- [ ] Fragments to github. 
- [ ] Export fragment to iCal event
- [ ] Show events by map
- [ ] Biometric notification triggers (When you;ve waked 10k steps, add "Buy shoes" to the shoppping list)
- [ ] Make a new zone (bottom of the left column). 
	- [ ] This is basically a check-list like way to view a kanban board. (other more kanban like views to be created LATER.)
	- [ ] Give it the button: Project Master. 
	- [ ] If it's a master, it's essentially the whole board. If it's not, it;s either a column, or an item in a column. 
	- [ ] It will display other (sub)-chits. It will display those chit Title's , status, & due date.
	- [ ] If Master is enabled, those chits can have sub-chits. If it;s not, have a drop down to select which Project/chit is this one's master. 
	- [ ] Sub-chits should be drag& drop able.
- [ ] Draging SHOULD change statuses of knaban/projects. 
- [ ] Project: checkbox and new zone for project and high tasks that are in projects checkbox filter
- [ ] Users
	- [ ] add a user section to the settings
	- [ ] user management
	- [ ] 
- [ ] Master project checkbox and new zone for project and high tasks that are in projects checkbox filter
- [ ] assignment to people is a thing. Also, each View has multiple modes. Show that on the reference. Sort & filtering under modes? Nested in the ref?
- [ ] Notifications from:
	- [ ] Proximity to other person
	- [ ] Time
	- [ ] Weather
	- [ ] Your Geolocation
	- [ ] *Someone Else's* Geolocation
	- [ ] bio: steps, heart rate, cycle state.
- [ ] able to save a search as a one click button, Shown in the sidebar.
- [ ] random sort order (for recipes, etc).
- [ ] View: rolling circular chits: Show only the next task in the Project. Once it's marked off, show the next one.When they're done, repeat them. (clean tghe kitchen, clean the bathroom, clean the...)
- [ ] have a Wall View for persistent displays (kiosks)
- [ ] An upcoming tasks View
- [ ] A Stands For:
	- [ ] Automations (If this, then that)
	- [ ] Appointments (from other people)
	- [ ] Archive
- [ ] Context switching based on time schedule and hiding chits
- [ ] hide events based on tags / schedule and or other criteria.
- [ ] Working Days/hours and days. (week vs awork week)
- [ ] Schedule appointment hours and days.
- [ ] Audit logs
- [ ] add a shared chit View
- [ ] Chits Assigned to Me.
- [ ] Import from & export to .csv files      
- [x] Move Pinned & Archived to be up in linw ith the label for Title (to the right of of). Change them so they are icons that change to indicate if they are active or not. ✅ 2025-05-24
- [ ] The Heath Indicators zone IS LITERALLY UNUSABLE GARBAGE BECAUSE The Buttons in the main section of the Health Zone when clIcked on, COLLAPSE THE WHOLE ZONR. FIX THIS!!!
- [x] Make the "All Day" and it's CHECKBOX on the left colm, direclty to the right of the "Start Date & Time" time input. ✅ 2025-05-24
- [ ] Tags in teh active zone are STILL expanding to fix the avialable space. They should not, They should be sized how they were before, just large enough to fit their text.
- [ ] The active Tags area STILL FRELLING overflows the Tags zone. . FIX THIS SO IT DOESN"T OVERFLOW! Make this Input STAY WITHIN the TAGS ZONE.
- [x] I can no longer expand parant tags to show rhwir children. ✅ 2025-05-24
- [x] Make the all day checkbox (when checked) HIDE the sytart & end times, not just disable them. ✅ 2025-05-24
- [x] The Archive & pineed controls should be DIRECTLY to the right of the Title label, probably INSIDE <label for="title">Title</label>. Or JUST BARELy outside it. WAAAY to the left of the weather blob. ✅ 2025-05-24
- [x] Also, add titles to those 2 controls. ✅ 2025-05-24
- [x] ALSO, THE archived (non-active) doesn't have an idcon, just a broken box. Also, when trying to untoggle that control, the whole page locks up. ✅ 2025-05-24
- [ ] Move reoccurance to be level with Start Date & Time. Move everything under it up to match. 
- [x] Put Dates into a Zone. Expanded by default. ✅ 2025-05-24
- [ ] The unarchiveed icon isunavalable. use a different icon for that. 
- [ ] Can't save health indicators. 
- [ ] ## Reproduction
- [ ] Are you dense? ALL ZONES SHOULD START COLLAPSED, other than Dates, & NOtes.

  

Not only did you ignore this (FIX IT!), now zones can't be collapsed or expanded. FIX TAHT TOO. Basically, all the code stuff isn't executing.

  

the very top header (Chit Editor, save buttons, etc), should not change color when a colt it picked.

  

The ACTIVE TAGS portion of the tags zone should be placed to the right of the tag-picking tools.

  

Individual tags, once slected are expanding like balloons to fill all avilable space, bit should ONLY be the minimum zise needed to wrap the text.


- [x] tags : ✅ 2025-05-24
	- [x] make it an area or Zone. ✅ 2025-05-24
	- [x] search to add ✅ 2025-05-24
	- [x] expandable tree to click through to add. ✅ 2025-05-24
	- [x] prime tags list to click & add: roo 3recentrecent, top 3 most used   3 favorites. ✅ 2025-05-24
	- [x] that all on the left, ✅ 2025-05-24
	- [x] the right: the tags on the Chit. ✅ 2025-05-24
---

## General Features
Color based on color. Unless none specified. Then use color of first (colored) tag.) set the first one apart visually to show it's where the colors coming from. 

Every Chit can have multiple Alerts just like thick enough multiple checkbox items. On the alarms view it shows every chat that has an alarm, and that all of its alarm says sub items, just like the checklist you will show the multiple checklist items on every chit. 

IS AM ALAM JUST a persistent /nagging notification? 



Alerts. 
Persistent/nag/alarm mode? (force acknowledgement)

Customizable with sounds. 

Create based on:
- Arbitrary Time 
- Start 
	- X, Units Before/After 
	- Add another? 
- Due
	- X, Units Before/After
	- Add another?
	- Only if undone? (checkmark, default.)
New setting: default sound / snooze length for each priority. 

Notification message is the Chit's Title. 
Can override/add to it. Always starts with title, but can Append Bonus Title. 



- [ ] **Home Page**:
	- [ ] Header stays visible at all times
	- [ ] Header image inline with title and more compact
	- [ ] When a day/week/X Days calendar loads, scroll to half an hour before the current time.
	- [ ] Make view match other in terms of logos in style & placement
	- [ ] Home Page: Sidebar sort order: title, start date, due date, manual.
	- [ ] **New Mode**: **X Days** 
		- [ ] with text input, days wrap if narrow
		- [ ] Build in **UI**.
		- [ ] Build Backend
		- [ ] Build in Primary Home.
	- [ ] Weather as full Chits like week mode. 
	- [ ] **Sidebar** button/filter: go to archived (& hide archived in views)
	- [ ] **All Views** 
		- [ ] Auto-hide fields based on toggles/buttons depending on view opened from
	- [ ] Way to see ALL Chits
	- [ ] Calendars: Show the current time as a LINE across the smaller Modes, whic updates every minute. 
	- [ ] Calendars: Set default scroll time to 05:30.
- [ ] **Chit Editor:** 
	- [ ] Button: Move checklist into note, move note to checklist
	- [ ] **Export**:
		- [ ] Download or Copy to Clipboard (as Markdown):  notes, checklists.
		- [ ] Export Chit to iCal event.
	- [ ] Chits need Busy/Free/Unspecified status (especially for calendar events)
	- [ ] Project Master checkbox (makes it show up in sidebar Kanban Projects)
	- [ ] Checkbox to show/hide fields by category.
	- [ ] Incorporate Tags.
	- [ ] Chit owner field (UUID + friendly name + username)
	- [ ] Adding people - mention, tag, contributor (see chit, edit chit)
	- [ ] Fields for forecast focus & updated time of forecast, high, low, precipitation, weather code.
- [ ] **Tags**: 
	- [ ] System/Calendars, System/~~Indicators~~, etc.
	- [ ] Backend.
- [ ] **Indicators**:
	- [ ] Tabbing bug
	- [ ] symptom tracker: muitliselesy 
	- [ ] Cycle doesn't hide/show correctly
	- [x] NEW SECTION: Medical Indicators (PB, glucose, weight, height, etc.) ✅ 2025-05-15
	- [ ] Settings: Add to list of show/hide icons
	- [x] Add to UI. ✅ 2025-05-15
	- [ ] Integrate with backend
- [ ] **Checklists
	- [ ] Create Fragments.
	- [ ] Integrate on backend.
- [ ] **Settings**:
	- [ ] ==Male/female toggle (hide menstrual)==
	- [ ] Default Filters (search)
		- [ ] Term setting - tag: hidden, secret Tag
		- [ ] One for each view
	- [ ] Visual indicator on calendar if chit is a sub-chit. Show/hide.
	- [ ] Additional/custom Statuses.
	- [ ] Chit Groups (like different Google calendars via tags)
	- [x] Create a Menu for Creating and Coloring Labels ✅ 2025-05-15
- [ ] **UI**
	- [ ] Hotkey: create Chit with submenu for each type (e.g., C→X for Views, C→R for Raw Chit, C→N for hidden fields)
	- [ ] Flicking Filters doesn't open the Filters modal.
	- [ ] _Create New_ by chit type, current view, other.
- [ ] **Alarms**
	- [x] Build a **clock** view Fragment for **alarms**. ✅ 2025-05-16
	- [ ] Checkbox for *Delete After Dismissal*. 
	- [ ] Chaiond variable length itienrs: 5 min, then 4 min, then 4 again, 
	- [ ] Bugs: 
		- [ ] when looping, it pings continually instead of just once per cycle.
	- [ ] Alarm snoozing. (options: 1, 3, 5, 10 more minutes)
	- [ ] Timer Snoozing. (options: 1, 3, 5, 10 more minutes)
	- [ ] **Settings**: Snooze length. 1, 3, 5, 10 minutes. (then reove from modal.)
	- [ ] Build Backend.
	- [x] Alarm view options in Settings: ✅ 2025-05-16
		- [x] digital, ✅ 2025-05-15
		- [x] 12 hour ✅ 2025-05-15
		- [x] 24 hour ✅ 2025-05-15
		- [x] metric Numbers ✅ 2025-05-15
		- [x] Metric Bar ✅ 2025-05-16
		- [x] Analog ✅ 2025-05-16
		- [x] expandable/collapsible; remembers state with default ✅ 2025-05-15
	- [ ] Bug: Enable button is greyed out with te rest of the row on disabled alarms.
	- [ ] Build **alerts and notifications** fragments
		- [ ] Make it work on the backend.
		- [ ] Alarms have start time, notification
- [ ] Alarms & notifications visible on calendar and Alarm View
	- [x] Settings to make optional. ✅ 2025-05-16
	- [ ] Fronend.
	- [ ] Backend.
- [ ] **Help** 
	- [ ] texts for all features, philosophy, visual indicators, calendar alarms, sub-chits, etc.
	- [ ] Make a fragment.
	- [ ] Integrate in to UI.
	- [ ] Integrate into Backend.
- [ ]  **Notes**:
	- [ ] Keep raw text in edit mode (show as HTML but keep markdown syntax).
	- [ ] Count raw characters ignoring HTML tags for cursor movement.
	- [ ] Side-by-side notes view (2 chits full-edit for copy/paste/reference)
	- [ ] Show all notes with content, like Google Keep.
	- [ ] Show title & full note field.
	- [ ] Quick edits in place.
	- [ ] Use colors for background.
- [ ] **Tags:**
	- [ ] Update everywhere: **Tags**, not **Labels**.
	- [ ] **Sub-tags**: 
		- [ ] Calendars/Work, Calendars/Personal, etc. System labels not rename-able.
- [ ] Improve **Recurring** Chits:
	- [ ] Number sub-chits
	- [ ] New field for sub-chits: list of chit IDs
	- [ ] Better-than-Google calendar-quality recurrence.
	- [ ] Status handling for **Recurring Chits**:
		- [ ] If Status: todo, reoccurs MWF, alarms @ 10,14,18 hr
		- [ ] When done, status done or incomplete, mark archived
		- [ ] Reporting success rate % of completed goals
- [ ] Weather in everything with a date:
	- [x] Forecast ✅ 2025-05-15
	- [x] Build Fragment ✅ 2025-05-15
	- [ ] Backend
	- [ ] Frontend.
- [ ] **Tasks, Calendar, Notes views**: manual order option (make default)
- [ ] Extract all code from fragments, merge with main
- [ ] Task at due date: mark complete? Reschedule?
- [ ] **Infrastructure**: 
	- [ ] User management:
		- [ ] Login (initially trusted users with user switcher)
	- [ ] Extract all styles from fragments, merge with main
	- [ ] Local device storage with Server Sync
	- [ ] Integrate with Home Assistant (external access?)
		- [ ] Fragment integration through HACS
	- [ ] Make accessible off-network (complex mode)
	- [ ] Make available off-network for general users
	- [ ] Make phone app
	- [ ] Phone app local store changes + sync
- [ ] **Reports System**
- [ ] **Goals System** (tasks with completion % targets, grading, success/failure/abandoned)
- [ ] Fragments to GitHub
- [ ]  **Weather**
	- [x] Build Weather Fragment ✅ 2025-05-12
	- [ ] Integrate Weather Fragment
	- [ ] Weather import on events (location & time/date, forecast & reported)
- [ ] **Mapping** 
	- [x] Build Mapping Fragment ✅ 2025-05-12
	- [ ] Integrate Mapping Fragment
- [ ] **Hotkeys** 
	- [x] Create Hotkeys ✅ 2025-05-12
	- [ ] Clicking the Filters doesn't open the Filters modal
	- [ ] Integrate Hotkeys fragment

---

## Dream List

Auto report notes & lists (as Markdown) to a dor every time they're saved. (and import from when saved) to sync with Obsidian. 

- [ ] Emails in Chits
  - [ ] Blocked: Macbook firewall configs
  - [ ] Files: /Secondary Data/Development/CWOC Prototypes/CWOC Email/
  - [ ] Gmail password
  - [ ] Workgroup chat link
  - [ ] Access (localhost:3334)
  - [ ] Server: uvicorn app.email_client:app --host 0.0.0.0 --port 3334 --log-level debug
  - [ ] E2E Encryption 
- [x] Medical ✅ 2025-05-18
  - [x] New area for medical logs and records ✅ 2025-05-18
  - [x] BP, weight, glucose, caffeine tracking ✅ 2025-05-18

---

# Done

- [x] Replace Placeholder Icons with Actual Images ✅ 2025-05-12  
  - Mentioned in updates April 22, 2025  
  - Replaced placeholders like /static/notes.png with real images  
- [x] Implement Reoccurring Chits ✅ 2025-05-12  
  - Added support for recurring events (weekly meetings, etc.)  
- [x] Enhance Views ✅ 2025-05-12  
  - Added month/day views alongside week view, improved visual layout  
---
# Table Schema
ALTER TABLE chits ADD COLUMN description TEXT; -- Or map to note ALTER TABLE chits ADD COLUMN all_day BOOLEAN DEFAULT 0; ALTER TABLE chits ADD COLUMN labels TEXT; -- Store as JSON array ALTER TABLE chits ADD COLUMN checklist TEXT; -- Store as JSON array ALTER TABLE chits ADD COLUMN color TEXT; ALTER TABLE chits ADD COLUMN status TEXT; ALTER TABLE chits ADD COLUMN start_datetime TEXT; ALTER TABLE chits ADD COLUMN end_datetime TEXT; ALTER TABLE chits ADD COLUMN due_date TEXT; -- Optional, for tasks sorting


---

# Help Texts
- [ ] Shift+Enter for detailed tag modal. 
- [ ] Referece list for Main controls. 

# To make updates

**Copy updated files to server (Zamonia):** 
```
scp -o PubkeyAuthentication=no backend/main.py root@192.168.1.111:/app/backend/main.py && scp -r -o PubkeyAuthentication=no frontend/ root@192.168.1.111:/app/

![[Obsidian Files/Attachments/styles.css]]```

**Run the app:**
```
source /app/venv/bin/activate && cd /app && (pkill -f 'uvicorn' || true) && uvicorn backend.main:app --host 0.0.0.0 --port 3333 --reload --log-level debug
```

**Access the app:** 
```
http://192.168.1.111:3333/
```

# C.W.'s Omni Chits 
# Commands
## Init at login: 
```
source /app/venv/bin/activate && cd /app && (pkill -f 'uvicorn' || true) && uvicorn backend.main:app --host 0.0.0.0 --port 3333 --reload --log-level debug
```

## Kill, restart: 
```
pkill -f 'uvicorn' && cd /app && source /app/venv/bin/activate && uvicorn backend.main:app --host 0.0.0.0 --port 3333 --reload --log-level debug
```

## Restart: 
```
uvicorn backend.main:app --host 0.0.0.0 --port 3333 --reload --log-level debug
```

## Upload: Frontend
```
cd ~/Personal/Secondary\ Data/Development/CWOC/frontend/ && scp -o PubkeyAuthentication=no * root@192.168.1.111:/app/frontend/
```

## Upload: ALL
```
cd ~/Personal/Secondary\ Data/Development/CWOC/ && rsync -av --exclude="*.rsls" -e "ssh -o PubkeyAuthentication=no" ./ root@192.168.1.111:/app/
```

## Set Permissions, All in app: 
```

find /app -type d -exec chmod 755 {} \; -o -type f -exec chmod 644 {} \; && chmod 755 /app/venv/bin/*

```

 

# Steps: 
1. On Proxmox, create an LXC: 
	1. Ubuntu 24.10, 
	2. Cores: 2
	3. 1GB RAM
	4. 16GB storage
	5. IP: 192.168.1.111
2. Updates, etc. 
	1. apt-get update
	2. apt-get upgrade
	3. apt-get install -y python3 python3-venv python3-pip
	4. apt install curl
	5. apt install net-tools
	6. apt install sqlite3 -y
3. To start Server: 
	1. cd /app && /app/venv/bin/uvicorn backend.main:app --host 0.0.0.0 --port 3333 --reload



## 3: Dependancies
```
mkdir -p /app/{backend,frontend,static,data}
cd /app
```


## Allow SSH
```
sed -i 's/^#\?PermitRootLogin.*/PermitRootLogin yes/; s/^#\?PasswordAuthentication.*/PasswordAuthentication yes/' /etc/ssh/sshd_config && systemctl restart ssh

```

## 4: Creating App: 

### **Create /app/backend/main.py**:

```
cat << 'EOF' > /app/frontend/index.html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>C.W.'s Omni Chits</title>
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/flatpickr/dist/flatpickr.min.css">
    <script src="https://cdn.jsdelivr.net/npm/flatpickr"></script>
    <style>
        body {
            background-image: url('/static/parchment.jpg');
            background-size: cover;
            font-family: 'Courier New', Courier, monospace;
            color: #333;
            margin: 0;
            padding: 20px;
        }
        h1 {
            font-size: 2.5em;
            border-bottom: 2px solid #8b4513;
            margin-bottom: 20px;
            text-align: center;
        }
        .header {
            position: relative;
            z-index: 1;
        }
        .logo {
            display: block;
            margin: 0 auto 10px;
            width: 100px;
            height: 100px;
        }
        .top-bar {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 20px;
        }
        .week-nav {
            display: flex;
            align-items: center;
            margin-right: 20px;
        }
        .week-nav button {
            background: none;
            border: none;
            font-size: 1.2em;
            cursor: pointer;
            margin: 0 5px;
        }
        .week-range {
            font-size: 1em;
            margin: 0 10px;
        }
        .search-bar {
            flex-grow: 1;
            margin: 0 10px;
        }
        .search-bar input {
            width: 100%;
            padding: 5px;
            font-family: 'Courier New', Courier, monospace;
            border: 1px solid #8b4513;
            background-color: #fefae0;
        }
        .create-chit {
            padding: 5px 10px;
            background-color: #e0d4b5;
            border: 1px solid #8b4513;
            cursor: pointer;
        }
        .status-filter {
            margin-left: 10px;
        }
        .tabs {
            display: flex;
            margin-bottom: 20px;
        }
        .tab {
            padding: 10px 20px;
            background-color: #e0d4b5;
            border: 1px solid #8b4513;
            cursor: pointer;
            margin-right: 5px;
        }
        .tab.active {
            background-color: #d2b48c;
        }
        .chit-list {
            background-color: #fffaf0;
            padding: 20px;
            border: 1px solid #8b4513;
        }
        .week-view {
            display: grid;
            grid-template-columns: 60px repeat(7, 1fr); /* 60px for hour column */
            gap: 5px;
            position: relative;
        }
        .day-column {
            border: 1px solid #d3d3d3;
            padding: 5px;
            background-color: #fefae0;
            min-height: 1440px; /* 24 hours * 60px */
            position: relative;
        }
        .day-header {
            text-align: center;
            font-weight: bold;
            padding: 5px;
            background-color: #e0d4b5;
            border-bottom: 1px solid #8b4513;
        }
        .hour-column {
            grid-column: 1;
            position: relative;
            height: 1440px; /* 24 hours * 60px */
        }
        .hour-block {
            height: 60px; /* 1 hour = 60px */
            border-bottom: 1px solid #d3d3d3;
            text-align: right;
            padding-right: 5px;
            font-size: 0.8em;
            position: absolute;
            width: 100%;
        }
        .all-day-section {
            background-color: #fffacd;
            padding: 5px;
            margin-bottom: 5px;
        }
        .all-day-event {
            display: block;
            padding: 2px;
            border-bottom: 1px solid #d3d3d3;
        }
        .all-day-event.multi-day {
            grid-column: span var(--span);
            background-color: #ffe4b5;
        }
        .timed-event {
            position: absolute;
            padding: 2px;
            border: 1px solid #8b4513;
            background-color: var(--event-bg-color);
            width: calc(100% - 10px);
            box-sizing: border-box;
        }
        .chit {
            border-bottom: 1px solid #d3d3d3;
            padding: 10px 0;
        }
        .chit:last-child {
            border-bottom: none;
        }
        .chit h3 {
            margin: 0;
            font-size: 1.2em;
        }
        .chit p {
            margin: 5px 0;
        }
        .chit .labels {
            margin: 5px 0;
        }
        .chit .label {
            display: inline-block;
            margin-right: 10px;
        }
        .chit .label img {
            width: 3em;
            height: 3em;
            vertical-align: middle;
            margin-right: 5px;
        }
        .chit a {
            color: #8b4513;
            text-decoration: underline;
            cursor: pointer;
        }
        .sidebar {
            position: fixed;
            left: -200px;
            top: 160px; /* Adjust based on header height (logo: 100px, h1: ~40px, padding: 20px) */
            width: 200px;
            height: calc(100% - 160px); /* Stop below header */
            background-color: #e0d4b5;
            border-right: 1px solid #8b4513;
            padding: 20px;
            transition: left 0.3s;
            z-index: 0; /* Ensure sidebar is below header */
        }
        .sidebar.active {
            left: 0;
        }
        .toggle-sidebar {
            padding: 5px 10px;
            background-color: #e0d4b5;
            border: 1px solid #8b4513;
            cursor: pointer;
            position: fixed;
            top: 10px;
            left: 10px;
            z-index: 2; /* Above sidebar */
        }
    </style>
</head>
<body>
    <button class="toggle-sidebar" onclick="toggleSidebar()">Toggle Sidebar</button>
    <div class="sidebar" id="sidebar">
        <h2>Sidebar</h2>
        <!-- Sidebar content can go here -->
    </div>
    <div class="header">
        <img src="/static/cwod_logo.png" alt="C.W.'s Omni Chits Logo" class="logo">
        <h1>C.W.'s Omni Chits</h1>
    </div>
    <div class="top-bar">
        <div class="week-nav" id="week-nav">
            <button onclick="previousWeek()">◄</button>
            <span class="week-range" id="week-range"></span>
            <button onclick="nextWeek()">►</button>
        </div>
        <div class="tabs">
            <div class="tab active" onclick="filterChits('Calendar')">Calendar</div>
            <div class="tab" onclick="filterChits('Checklists')">Checklists</div>
            <div class="tab" onclick="filterChits('Alarms')">Alarms</div>
            <div class="tab" onclick="filterChits('Projects')">Projects</div>
            <div class="tab" onclick="filterChits('Tasks')">Tasks</div>
            <div class="tab" onclick="filterChits('Notes')">Notes</div>
        </div>
        <div class="search-bar">
            <input type="text" id="search" placeholder="Search Chits..." onkeyup="searchChits()">
        </div>
        <button class="create-chit" onclick="window.location.href='/editor'">Create Chit</button>
        <div class="status-filter">
            <select id="status-filter" onchange="filterByStatus()">
                <option value="">Status Filter</option>
                <option value="ToDo">ToDo</option>
                <option value="In Progress">In Progress</nimi>
                <option value="Blocked">Blocked</option>
                <option value="Complete">Complete</option>
            </select>
        </div>
    </div>
    <div class="chit-list" id="chit-list">
        <!-- Chits will be populated here -->
    </div>

    <script>
        let currentTab = 'Calendar';
        let chits = [];
        let currentWeekStart = null;

        // TODO: Create a menu for creating and coloring labels

        function toggleSidebar() {
            const sidebar = document.getElementById('sidebar');
            sidebar.classList.toggle('active');
        }

        function getWeekStart(date) {
            const d = new Date(date);
            const day = d.getDay();
            const diff = (day + 1) % 7; // Adjust so Saturday is the start (Saturday = 6, Sunday = 0 -> diff to Saturday)
            d.setDate(d.getDate() - diff);
            d.setHours(0, 0, 0, 0); // Start of the day
            return d;
        }

        function formatDate(date) {
            const options = { month: 'short', day: 'numeric' };
            return date.toLocaleDateString('en-US', options);
        }

        function formatTime(date) {
            return date.toISOString().slice(11, 16); // 24-hour format: HH:mm
        }

        function formatWeekRange(start, end) {
            const startStr = formatDate(start);
            const endStr = formatDate(end);
            const year = start.getFullYear();
            return `${startStr} - ${endStr}, ${year}`;
        }

        function getPastelColor(label) {
            // Simple hash function to generate a consistent pastel color based on the label
            let hash = 0;
            for (let i = 0; i < label.length; i++) {
                hash = label.charCodeAt(i) + ((hash << 5) - hash);
            }
            const r = (hash & 0xFF) % 128 + 127; // Keep in pastel range (127-255)
            const g = ((hash >> 8) & 0xFF) % 128 + 127;
            const b = ((hash >> 16) & 0xFF) % 128 + 127;
            return `rgb(${r}, ${g}, ${b})`;
        }

        function previousWeek() {
            currentWeekStart.setDate(currentWeekStart.getDate() - 7);
            displayChits();
        }

        function nextWeek() {
            currentWeekStart.setDate(currentWeekStart.getDate() + 7);
            displayChits();
        }

        function fetchChits() {
            fetch('/api/chits')
                .then(response => response.json())
                .then(data => {
                    chits = data;
                    currentWeekStart = getWeekStart(new Date());
                    displayChits();
                })
                .catch(err => {
                    console.error('Error fetching chits:', err);
                    alert('Failed to load chits. Check console for details.');
                });
        }

        function displayChits() {
            const chitList = document.getElementById('chit-list');
            const searchQuery = document.getElementById('search').value.toLowerCase();
            const statusFilter = document.getElementById('status-filter').value;
            const weekNav = document.getElementById('week-nav');

            // Update week navigation visibility
            weekNav.style.display = currentTab === 'Calendar' ? 'flex' : 'none';
            if (currentTab === 'Calendar') {
                const weekEnd = new Date(currentWeekStart);
                weekEnd.setDate(weekEnd.getDate() + 6);
                document.getElementById('week-range').textContent = formatWeekRange(currentWeekStart, weekEnd);
            }

            // Filter chits based on tab, search, and status
            let filteredChits = chits.filter(chit => {
                const matchesTab = chit.labels && chit.labels.includes(currentTab);
                const matchesSearch = chit.title.toLowerCase().includes(searchQuery) || (chit.note && chit.note.toLowerCase().includes(searchQuery));
                const matchesStatus = !statusFilter || chit.status === statusFilter;
                return matchesTab && matchesSearch && matchesStatus;
            });

            chitList.innerHTML = '';

            if (currentTab === 'Calendar') {
                // Week view for Calendar tab
                const weekView = document.createElement('div');
                weekView.className = 'week-view';

                // Create day columns (Saturday to Friday)
                const days = [];
                for (let i = 0; i < 7; i++) {
                    const day = new Date(currentWeekStart);
                    day.setDate(day.getDate() + i);
                    days.push(day);
                }

                // Filter chits for Calendar view (must have start_datetime)
                const calendarChits = filteredChits.filter(chit => chit.start_datetime);

                // Separate all-day/multi-day and timed events
                const allDayEvents = [];
                const timedEvents = [];

                calendarChits.forEach(chit => {
                    const startDate = new Date(chit.start_datetime);
                    const endDate = chit.end_datetime ? new Date(chit.end_datetime) : startDate;
                    const isAllDay = chit.start_datetime.endsWith('T00:00:00.000Z');

                    if (isAllDay || chit.end_datetime) {
                        allDayEvents.push({ chit, startDate, endDate });
                    } else {
                        timedEvents.push({ chit, startDate, endDate });
                    }
                });

                // Render all-day events first (spanning multiple columns if needed)
                const allDayRow = document.createElement('div');
                allDayRow.className = 'week-view';

                // Empty hour column for all-day row
                const allDayHourColumn = document.createElement('div');
                allDayHourColumn.className = 'hour-column';
                allDayRow.appendChild(allDayHourColumn);

                days.forEach((day, dayIndex) => {
                    const dayColumn = document.createElement('div');
                    dayColumn.className = 'day-column';
                    const dayHeader = document.createElement('div');
                    dayHeader.className = 'day-header';
                    dayHeader.textContent = `${day.toLocaleDateString('en-US', { weekday: 'short' })} ${formatDate(day)}`;
                    dayColumn.appendChild(dayHeader);

                    const allDaySection = document.createElement('div');
                    allDaySection.className = 'all-day-section';

                    allDayEvents.forEach(event => {
                        const eventStart = new Date(event.startDate);
                        const eventEnd = new Date(event.endDate);
                        eventStart.setHours(0, 0, 0, 0);
                        eventEnd.setHours(23, 59, 59, 999);

                        const dayStart = new Date(day);
                        dayStart.setHours(0, 0, 0, 0);
                        const dayEnd = new Date(day);
                        dayEnd.setHours(23, 59, 59, 999);

                        if (eventStart <= dayEnd && eventEnd >= dayStart) {
                            if (dayIndex === 0 || dayStart.getTime() === eventStart.getTime()) {
                                // Calculate span for multi-day events
                                let span = 1;
                                if (event.end_datetime) {
                                    const diffTime = eventEnd - eventStart;
                                    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                                    span = Math.min(diffDays, 7 - dayIndex);
                                }

                                const eventDiv = document.createElement('div');
                                eventDiv.className = 'all-day-event';
                                if (span > 1) {
                                    eventDiv.classList.add('multi-day');
                                    eventDiv.style.setProperty('--span', span);
                                }
                                const startTime = formatTime(new Date(event.startDate));
                                const endTime = event.end_datetime ? formatTime(new Date(event.endDate)) : startTime;
                                const bgColor = event.chit.labels.length > 0 ? getPastelColor(event.chit.labels[0]) : '#e0d4b5';
                                eventDiv.style.backgroundColor = bgColor;
                                eventDiv.innerHTML = `
                                    <strong>${event.chit.title}</strong> (${startTime} - ${endTime})
                                    <div class="labels">
                                        ${event.chit.labels.map(label => {
                                            if (label === 'Notes') {
                                                return `<span class="label"><img src="/static/notes.png" alt="Notes Icon">Notes</span>`;
                                            } else if (label === 'Calendar') {
                                                return `<span class="label"><img src="/static/calendar.png" alt="Calendar Icon">Calendar</span>`;
                                            } else if (label === 'Checklists') {
                                                return `<span class="label"><img src="/static/checklists.png" alt="Checklists Icon">Checklists</span>`;
                                            } else if (label === 'Alarms') {
                                                return `<span class="label"><img src="/static/alarms.png" alt="Alarms Icon">Alarms</span>`;
                                            } else if (label === 'Projects') {
                                                return `<span class="label"><img src="/static/projects.png" alt="Projects Icon">Projects</span>`;
                                            } else if (label === 'Tasks') {
                                                return `<span class="label"><img src="/static/tasks.png" alt="Tasks Icon">Tasks</span>`;
                                            }
                                            return `<span class="label">${label}</span>`;
                                        }).join('')}
                                    </div>
                                    <a href="/chit/${event.chit.id}">Edit</a>
                                `;
                                allDaySection.appendChild(eventDiv);
                            }
                        }
                    });

                    dayColumn.appendChild(allDaySection);
                    allDayRow.appendChild(dayColumn);
                });

                // Render timed events with hour blocks
                const timedRow = document.createElement('div');
                timedRow.className = 'week-view';

                // Hour column
                const hourColumn = document.createElement('div');
                hourColumn.className = 'hour-column';
                for (let hour = 0; hour < 24; hour++) {
                    const hourBlock = document.createElement('div');
                    hourBlock.className = 'hour-block';
                    hourBlock.style.top = `${hour * 60}px`;
                    hourBlock.textContent = `${hour.toString().padStart(2, '0')}:00`;
                    hourColumn.appendChild(hourBlock);
                }
                timedRow.appendChild(hourColumn);

                days.forEach(day => {
                    const dayColumn = document.createElement('div');
                    dayColumn.className = 'day-column';

                    const dayStart = new Date(day);
                    dayStart.setHours(0, 0, 0, 0);
                    const dayEnd = new Date(day);
                    dayEnd.setHours(23, 59, 59, 999);

                    const dayEvents = timedEvents
                        .filter(event => {
                            const eventDate = new Date(event.startDate);
                            return eventDate >= dayStart && eventDate <= dayEnd;
                        })
                        .sort((a, b) => new Date(a.startDate) - new Date(b.startDate));

                    dayEvents.forEach(event => {
                        const eventDiv = document.createElement('div');
                        eventDiv.className = 'timed-event';
                        const startDate = new Date(event.startDate);
                        const endDate = event.endDate ? new Date(event.endDate) : new Date(startDate.getTime() + 60 * 60 * 1000); // Default to 1 hour if no end time
                        const startHour = startDate.getHours() + startDate.getMinutes() / 60;
                        const endHour = endDate.getHours() + endDate.getMinutes() / 60;
                        const top = startHour * 60; // 1 hour = 60px
                        const height = (endHour - startHour) * 60;
                        eventDiv.style.top = `${top}px`;
                        eventDiv.style.height = `${height}px`;
                        const startTime = formatTime(startDate);
                        const endTime = event.end_datetime ? formatTime(endDate) : formatTime(new Date(startDate.getTime() + 60 * 60 * 1000));
                        const bgColor = event.chit.labels.length > 0 ? getPastelColor(event.chit.labels[0]) : '#e0d4b5';
                        eventDiv.style.setProperty('--event-bg-color', bgColor);
                        eventDiv.innerHTML = `
                            <strong>${event.chit.title}</strong> (${startTime} - ${endTime})
                            <div class="labels">
                                ${event.chit.labels.map(label => {
                                    if (label === 'Notes') {
                                        return `<span class="label"><img src="/static/notes.png" alt="Notes Icon">Notes</span>`;
                                    } else if (label === 'Calendar') {
                                        return `<span class="label"><img src="/static/calendar.png" alt="Calendar Icon">Calendar</span>`;
                                    } else if (label === 'Checklists') {
                                        return `<span class="label"><img src="/static/checklists.png" alt="Checklists Icon">Checklists</span>`;
                                    } else if (label === 'Alarms') {
                                        return `<span class="label"><img src="/static/alarms.png" alt="Alarms Icon">Alarms</span>`;
                                    } else if (label === 'Projects') {
                                        return `<span class="label"><img src="/static/projects.png" alt="Projects Icon">Projects</span>`;
                                    } else if (label === 'Tasks') {
                                        return `<span class="label"><img src="/static/tasks.png" alt="Tasks Icon">Tasks</span>`;
                                    }
                                    return `<span class="label">${label}</span>`;
                                }).join('')}
                            </div>
                            <a href="/chit/${event.chit.id}">Edit</a>
                        `;
                        dayColumn.appendChild(eventDiv);
                    });

                    timedRow.appendChild(dayColumn);
                });

                chitList.appendChild(allDayRow);
                chitList.appendChild(timedRow);
            } else {
                // List view for other tabs
                filteredChits.forEach(chit => {
                    const chitDiv = document.createElement('div');
                    chitDiv.className = 'chit';
                    chitDiv.innerHTML = `
                        <h3>${chit.title}</h3>
                        ${chit.start_datetime ? `<p>Start: ${new Date(chit.start_datetime).toISOString().replace(/T/, ' ').slice(0, 16)}Z</p>` : ''}
                        <div class="labels">
                            ${chit.labels.map(label => {
                                if (label === 'Notes') {
                                    return `<span class="label"><img src="/static/notes.png" alt="Notes Icon">Notes</span>`;
                                } else if (label === 'Calendar') {
                                    return `<span class="label"><img src="/static/calendar.png" alt="Calendar Icon">Calendar</span>`;
                                } else if (label === 'Checklists') {
                                    return `<span class="label"><img src="/static/checklists.png" alt="Checklists Icon">Checklists</span>`;
                                } else if (label === 'Alarms') {
                                    return `<span class="label"><img src="/static/alarms.png" alt="Alarms Icon">Alarms</span>`;
                                } else if (label === 'Projects') {
                                    return `<span class="label"><img src="/static/projects.png" alt="Projects Icon">Projects</span>`;
                                } else if (label === 'Tasks') {
                                    return `<span class="label"><img src="/static/tasks.png" alt="Tasks Icon">Tasks</span>`;
                                }
                                return `<span class="label">${label}</span>`;
                            }).join('')}
                        </div>
                        <a href="/chit/${chit.id}">Edit</a>
                    `;
                    chitList.appendChild(chitDiv);
                });
            }

            // Update tab heading
            const tabs = document.querySelectorAll('.tab');
            tabs.forEach(tab => {
                if (tab.textContent === currentTab) {
                    tab.classList.add('active');
                } else {
                    tab.classList.remove('active');
                }
            });
        }

        function filterChits(tab) {
            currentTab = tab;
            displayChits();
        }

        function searchChits() {
            displayChits();
        }

        function filterByStatus() {
            displayChits();
        }

        // Initial fetch
        fetchChits();
    </script>
</body>
</html>
EOF
```

### Create /app/frontend/editor.html

```
cat << 'EOF' > /app/frontend/editor.html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Chit Editor - C.W.'s Omni Chits</title>
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/flatpickr/dist/flatpickr.min.css">
    <script src="https://cdn.jsdelivr.net/npm/flatpickr"></script>
    <style>
        body {
            background-image: url('/static/parchment.jpg');
            background-size: cover;
            font-family: 'Courier New', Courier, monospace;
            color: #333;
            margin: 0;
            padding: 20px;
        }
        h1 {
            font-size: 2.5em;
            border-bottom: 2px solid #8b4513;
            margin-bottom: 20px;
        }
        .editor {
            background-color: #fffaf0;
            padding: 20px;
            border: 1px solid #8b4513;
        }
        .field {
            margin-bottom: 15px;
        }
        label {
            display: block;
            font-weight: bold;
            margin-bottom: 5px;
        }
        input, textarea, select {
            width: 100%;
            padding: 5px;
            font-family: 'Courier New', Courier, monospace;
            border: 1px solid #8b4513;
            background-color: #fefae0;
        }
        textarea {
            height: 100px;
        }
        .checkbox-group {
            margin-top: 5px;
        }
        button {
            padding: 10px 20px;
            background-color: #e0d4b5;
            border: 1px solid #8b4513;
            cursor: pointer;
            font-family: 'Courier New', Courier, monospace;
            margin-right: 10px;
        }
        button.delete {
            background-color: #ff6347;
            color: white;
        }
    </style>
</head>
<body>
    <h1>Chit Editor</h1>
    <div class="editor">
        <div class="field">
            <label>Pinned</label>
            <div class="checkbox-group">
                <input type="checkbox" id="pinned">
                <label for="pinned">Pinned</label>
            </div>
        </div>
        <div class="field">
            <label for="title">Title</label>
            <input type="text" id="title" required>
        </div>
        <div class="field">
            <label for="note">Note</label>
            <textarea id="note"></textarea>
        </div>
        <div class="field">
            <label for="labels">Labels (comma-separated)</label>
            <input type="text" id="labels" placeholder="Work, Family">
        </div>
        <div class="field">
            <label for="start_datetime">Start Date</label>
            <input type="text" id="start_datetime" placeholder="Select Date">
        </div>
        <div class="field">
            <label for="start_time">Start Time</label>
            <input type="text" id="start_time" placeholder="Select Time">
        </div>
        <div class="field">
            <label for="end_datetime">End Date</label>
            <input type="text" id="end_datetime" placeholder="Select Date">
        </div>
        <div class="field">
            <label for="end_time">End Time</label>
            <input type="text" id="end_time" placeholder="Select Time">
        </div>
        <div class="field">
            <label for="due_datetime">Due Date</label>
            <input type="text" id="due_datetime" placeholder="Select Date">
        </div>
        <div class="field">
            <label for="due_time">Due Time</label>
            <input type="text" id="due_time" placeholder="Select Time">
        </div>
        <div class="field">
            <label for="status">Status</label>
            <select id="status">
                <option value="ToDo" selected>ToDo</option>
                <option value="In Progress">In Progress</option>
                <option value="Blocked">Blocked</option>
                <option value="Complete">Complete</option>
            </select>
        </div>
        <div class="field">
            <label for="priority">Priority</label>
            <select id="priority">
                <option value="High">High</option>
                <option value="Medium" selected>Medium</option>
                <option value="Low">Low</option>
            </select>
        </div>
        <div class="field">
            <label for="checklist">Checklist (JSON format: [{"text": "Item", "done": false}])</label>
            <textarea id="checklist"></textarea>
        </div>
        <div class="field">
            <label>Alarm</label>
            <div class="checkbox-group">
                <input type="checkbox" id="alarm">
                <label for="alarm">Enable Alarm</label>
            </div>
        </div>
        <div class="field">
            <label>Notification</label>
            <div class="checkbox-group">
                <input type="checkbox" id="notification">
                <label for="notification">Enable Notification</label>
            </div>
        </div>
        <div class="field">
            <label for="recurrence">Recurrence</label>
            <select id="recurrence">
                <option value="">None</option>
                <option value="Hourly">Hourly</option>
                <option value="Daily">Daily</option>
                <option value="Weekly">Weekly</option>
                <option value="Monthly">Monthly</option>
                <option value="Yearly">Yearly</option>
            </select>
        </div>
        <div class="field">
            <label for="location">Location</label>
            <input type="text" id="location" placeholder="123 Main St">
        </div>
        <div class="field">
            <label for="color">Color (Hex Code)</label>
            <input type="text" id="color" placeholder="#FF0000">
        </div>
        <div class="field">
            <label for="people">People (comma-separated)</label>
            <input type="text" id="people" placeholder="Alice, Bob">
        </div>
        <div class="field">
            <label>Archived</label>
            <div class="checkbox-group">
                <input type="checkbox" id="archived">
                <label for="archived">Archive</label>
            </div>
        </div>
        <button onclick="saveChit()">Save</button>
        <button onclick="window.location.href='/'">Cancel</button>
        <button class="delete" onclick="deleteChit()">Delete</button>
    </div>

    <script>
        // Initialize Flatpickr for date and time pickers
        flatpickr("#start_datetime", { dateFormat: "Y-m-d" });
        flatpickr("#start_time", { enableTime: true, noCalendar: true, dateFormat: "H:i", time_24hr: true, minuteIncrement: 1 });
        flatpickr("#end_datetime", { dateFormat: "Y-m-d" });
        flatpickr("#end_time", { enableTime: true, noCalendar: true, dateFormat: "H:i", time_24hr: true, minuteIncrement: 1 });
        flatpickr("#due_datetime", { dateFormat: "Y-m-d" });
        flatpickr("#due_time", { enableTime: true, noCalendar: true, dateFormat: "H:i", time_24hr: true, minuteIncrement: 1 });

        // Load existing chit if editing
        const chitId = new URLSearchParams(window.location.search).get('id');
        if (chitId) {
            fetch(`/api/chits/${chitId}`)
                .then(response => response.json())
                .then(chit => {
                    document.getElementById('pinned').checked = chit.pinned || false;
                    document.getElementById('title').value = chit.title || '';
                    document.getElementById('note').value = chit.note || '';
                    document.getElementById('labels').value = (chit.labels || []).join(', ');
                    if (chit.start_datetime) {
                        const [date, time] = chit.start_datetime.split('T');
                        document.getElementById('start_datetime').value = date;
                        document.getElementById('start_time').value = time ? time.split(':').slice(0, 2).join(':') : '';
                    }
                    if (chit.end_datetime) {
                        const [date, time] = chit.end_datetime.split('T');
                        document.getElementById('end_datetime').value = date;
                        document.getElementById('end_time').value = time ? time.split(':').slice(0, 2).join(':') : '';
                    }
                    if (chit.due_datetime) {
                        const [date, time] = chit.due_datetime.split('T');
                        document.getElementById('due_datetime').value = date;
                        document.getElementById('due_time').value = time ? time.split(':').slice(0, 2).join(':') : '';
                    }
                    document.getElementById('status').value = chit.status || 'ToDo';
                    document.getElementById('priority').value = chit.priority || 'Medium';
                    document.getElementById('checklist').value = chit.checklist ? JSON.stringify(chit.checklist) : '';
                    document.getElementById('alarm').checked = chit.alarm || false;
                    document.getElementById('notification').checked = chit.notification || false;
                    document.getElementById('recurrence').value = chit.recurrence || '';
                    document.getElementById('location').value = chit.location || '';
                    document.getElementById('color').value = chit.color || '';
                    document.getElementById('people').value = (chit.people || []).join(', ');
                    document.getElementById('archived').checked = chit.archived || false;
                })
                .catch(err => {
                    console.error('Error loading chit:', err);
                    alert('Failed to load chit. Check console for details.');
                });
        }

        function saveChit() {
            console.log('Saving chit...');
            const startDate = document.getElementById('start_datetime').value;
            const startTime = document.getElementById('start_time').value;
            const endDate = document.getElementById('end_datetime').value;
            const endTime = document.getElementById('end_time').value;
            const dueDate = document.getElementById('due_datetime').value;
            const dueTime = document.getElementById('due_time').value;

            const chit = {
                title: document.getElementById('title').value,
                note: document.getElementById('note').value,
                labels: document.getElementById('labels').value.split(',').map(label => label.trim()).filter(label => label),
                start_datetime: startDate && startTime ? `${startDate}T${startTime}:00Z` : null,
                end_datetime: endDate && endTime ? `${endDate}T${endTime}:00Z` : null,
                due_datetime: dueDate && dueTime ? `${dueDate}T${dueTime}:00Z` : null,
                completed_datetime: document.getElementById('status').value === 'Complete' ? (new Date().toISOString()) : null,
                status: document.getElementById('status').value,
                priority: document.getElementById('priority').value,
                checklist: document.getElementById('checklist').value ? JSON.parse(document.getElementById('checklist').value) : null,
                alarm: document.getElementById('alarm').checked,
                notification: document.getElementById('notification').checked,
                recurrence: document.getElementById('recurrence').value || null,
                recurrence_id: chitId ? (document.getElementById('recurrence').value ? chitId : null) : (document.getElementById('recurrence').value ? crypto.randomUUID() : null),
                location: document.getElementById('location').value || null,
                color: document.getElementById('color').value || null,
                people: document.getElementById('people').value.split(',').map(person => person.trim()).filter(person => person),
                pinned: document.getElementById('pinned').checked,
                archived: document.getElementById('archived').checked,
                deleted: false
            };

            console.log('Chit data:', chit);
            const method = chitId ? 'PUT' : 'POST';
            const url = chitId ? `/api/chits/${chitId}` : '/api/chits';

            fetch(url, {
                method: method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(chit)
            })
                .then(response => {
                    console.log('Response status:', response.status);
                    if (!response.ok) {
                        throw new Error(`HTTP error! status: ${response.status}`);
                    }
                    return response.json();
                })
                .then(data => {
                    console.log('Save successful:', data);
                    window.location.href = '/';
                })
                .catch(err => {
                    console.error('Error saving chit:', err);
                    alert('Failed to save chit. Check console for details.');
                });
        }

        function deleteChit() {
            if (!chitId) {
                alert('No chit to delete.');
                return;
            }
            if (!confirm('Are you sure you want to delete this chit?')) {
                return;
            }
            fetch(`/api/chits/${chitId}`, {
                method: 'DELETE'
            })
                .then(response => {
                    if (!response.ok) {
                        throw new Error(`HTTP error! status: ${response.status}`);
                    }
                    return response.json();
                })
                .then(() => {
                    window.location.href = '/';
                })
                .catch(err => {
                    console.error('Error deleting chit:', err);
                    alert('Failed to delete chit. Check console for details.');
                });
        }
    </script>
</body>
</html>
EOF
```


### Create /app/.env
```
cat << 'EOF' > /app/.env
PORT=3333
DB_PATH=/app/data/app.db
LOG_LEVEL=info
EOF
```

### Create /app/start.sh
```
cat << 'EOF' > /app/start.sh
#!/bin/bash
cd "$(dirname "$0")"
source venv/bin/activate
uvicorn backend.main:app --host 0.0.0.0 --port ${PORT:-3333}
EOF
chmod +x /app/start.sh
```

### Create /app/requirements.txt
```
cat << 'EOF' > /app/requirements.txt
fastapi
uvicorn
python-dotenv
pydantic
EOF
```

```
chmod +x /app/start.sh
```

## Random settings to do: 
```
sed -i 's|href="[^"]*styles.css"|href="/styles.css"|' /app/frontend/index.html
```

## Next Steps
### **Set Up Virtual Environment**
```
cd /app
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

### **Ensure Permissions**
```
mkdir -p /app/data
chown $(whoami):$(whoami) /app/data
chmod 755 /app/data
```

### Run the App
```
./start.sh
```

### Now You're up!
That's all. Let's build it. 

---
# Detailed Build

## Enhanced Frontend
```
cat << 'EOF' > /app/frontend/index.html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>C.W.'s Omni Diary</title>
    <style>
        body {
            background-color: #f4ecd8; /* Parchment background */
            font-family: 'Courier New', Courier, monospace; /* Typewriter font */
            color: #333;
            margin: 0;
            padding: 20px;
        }
        h1 {
            text-align: center;
            font-size: 2.5em;
            margin-bottom: 20px;
            border-bottom: 2px solid #8b4513; /* Brown ink underline */
        }
        .tabs {
            display: flex;
            border-bottom: 1px solid #8b4513;
            margin-bottom: 20px;
        }
        .tab {
            padding: 10px 20px;
            cursor: pointer;
            background-color: #e0d4b5;
            border: 1px solid #8b4513;
            border-bottom: none;
            margin-right: 5px;
        }
        .tab.active {
            background-color: #f4ecd8;
            font-weight: bold;
        }
        .tab-content {
            display: none;
            padding: 20px;
            background-color: #fffaf0;
            border: 1px solid #8b4513;
            min-height: 300px;
        }
        .tab-content.active {
            display: block;
        }
        .chit {
            margin-bottom: 15px;
            padding: 10px;
            background-color: #fefae0;
            border-left: 4px solid #8b4513;
        }
        .checklist-item {
            margin-left: 20px;
            color: #555;
        }
    </style>
</head>
<body>
    <h1>C.W.'s Omni Diary</h1>
    <div class="tabs">
        <div class="tab active" onclick="showTab('calendar')">Calendar</div>
        <div class="tab" onclick="showTab('projects')">Projects</div>
        <div class="tab" onclick="showTab('tasks')">Tasks</div>
        <div class="tab" onclick="showTab('alarms')">Alarms</div>
        <div class="tab" onclick="showTab('notes')">Notes</div>
        <div class="tab" onclick="showTab('checklists')">Checklists</div>
    </div>
    <div id="calendar" class="tab-content active">
        <h2>Calendar</h2>
        <div id="calendar-chits"></div>
    </div>
    <div id="projects" class="tab-content">
        <h2>Projects</h2>
        <div id="projects-chits"></div>
    </div>
    <div id="tasks" class="tab-content">
        <h2>Tasks</h2>
        <div id="tasks-chits"></div>
    </div>
    <div id="alarms" class="tab-content">
        <h2>Alarms</h2>
        <div id="alarms-chits"></div>
    </div>
    <div id="notes" class="tab-content">
        <h2>Notes</h2>
        <div id="notes-chits"></div>
    </div>
    <div id="checklists" class="tab-content">
        <h2>Checklists</h2>
        <div id="checklists-chits"></div>
    </div>

    <script>
        let chits = [];

        // Fetch chits on page load
        fetch('/api/chits')
            .then(response => response.json())
            .then(data => {
                chits = data;
                renderChits();
            })
            .catch(err => {
                console.error('Error fetching chits:', err);
                document.querySelectorAll('.tab-content').forEach(tab => {
                    tab.innerHTML += '<p>Error loading chits.</p>';
                });
            });

        // Show selected tab
        function showTab(tabId) {
            document.querySelectorAll('.tab').forEach(tab => tab.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
            document.querySelector(`.tab[onclick="showTab('${tabId}')"]`).classList.add('active');
            document.getElementById(tabId).classList.add('active');
            renderChits();
        }

        // Render chits based on active tab
        function renderChits() {
            const activeTab = document.querySelector('.tab-content.active').id;
            let html = '';

            if (activeTab === 'calendar') {
                const calendarChits = chits.filter(chit => chit.due_datetime);
                html = calendarChits.length ? calendarChits.map(chit => `
                    <div class="chit">
                        <strong>${chit.title}</strong><br>
                        Due: ${chit.due_datetime}
                        ${chit.description ? `<p>${chit.description}</p>` : ''}
                    </div>
                `).join('') : '<p>No calendar events.</p>';
                document.getElementById('calendar-chits').innerHTML = html;
            } else if (activeTab === 'projects') {
                document.getElementById('projects-chits').innerHTML = '<p>Projects tab coming soon.</p>';
            } else if (activeTab === 'tasks') {
                document.getElementById('tasks-chits').innerHTML = '<p>Tasks tab coming soon.</p>';
            } else if (activeTab === 'alarms') {
                document.getElementById('alarms-chits').innerHTML = '<p>Alarms tab coming soon.</p>';
            } else if (activeTab === 'notes') {
                document.getElementById('notes-chits').innerHTML = '<p>Notes tab coming soon.</p>';
            } else if (activeTab === 'checklists') {
                const checklistChits = chits.filter(chit => chit.checklist && chit.checklist.length > 0);
                html = checklistChits.length ? checklistChits.map(chit => `
                    <div class="chit">
                        <strong>${chit.title}</strong>
                        ${chit.description ? `<p>${chit.description}</p>` : ''}
                        <ul>
                            ${chit.checklist.map(item => `
                                <li class="checklist-item">
                                    ${item.text} (${item.done ? 'Done' : 'Pending'})
                                    ${item.chit_id ? `<br>Nested chit ID: ${item.chit_id}` : ''}
                                </li>
                            `).join('')}
                        </ul>
                    </div>
                `).join('') : '<p>No checklists.</p>';
                document.getElementById('checklists-chits').innerHTML = html;
            }
        }
    </script>
</body>
</html>
EOF
```










---
# Information


Hotkeys: 
c(L) CAPTN


## Chit Properties Table

| Property             | Type          | Note                                                                                                                                                                     | Reason/Use                                                                                                                                                                                                                                         |
|----------------------|---------------|--------------------------------------------------------------------------------------------------------------------------------------------------------------------------|----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| ID                   | String        | Unique identifier (e.g., UUID).                                                                                                                                          | Identifies chits for SQLite storage, API operations (e.g., /api/chits/{id}), and linking.                                                                                                                                                          |
| Title                | String        | Short name (e.g., "Team Meeting").                                                                                                                                       | User-facing label displayed in all tabs/views (e.g., Calendar events, Kanban cards).                                                                                                                                                               |
| Description          | Text          | Optional markdown text.                                                                                                                                                  | Provides context (e.g., task details, note content); stored as TEXT in SQLite.                                                                                                                                                                     |
| Due Date/Time        | Datetime      | Optional timestamp (e.g., 2025-04-21 14:00).                                                                                                                             | Schedules chits in Calendar tab; triggers alarms; sorts in Tasks/Checklists tabs; stored as DATETIME in SQLite.                                                                                                                                    |
| Recurrence           | Object        | JSON object (e.g., {frequency: "weekly", interval: 1, end_date: null}).                                                                                                  | Enables repeating chits in Calendar/Tasks/Checklists tabs; serialized as JSON in SQLite, per your cyclical task interest (March 4, 2025).                                                                                                          |
| Priority             | String        | Enum: High, Medium, Low, None.                                                                                                                                           | Prioritizes chits for sorting/filtering in Tasks/Projects/Checklists tabs; stored as VARCHAR.                                                                                                                                                      |
| Status               | String        | Enum: To-Do, In Progress, Done, Cancelled.                                                                                                                               | Tracks completion for Tasks tab (To-Do/Done), Projects tab (Kanban progress), Checklists tab; stored as VARCHAR.                                                                                                                                   |
| Tags                 | Array[String] | List of labels (e.g., ["Work", "Urgent"]).                                                                                                                               | Categorizes chits for filtering across tabs; stored as JSON in SQLite, per your organization needs (March 5, 2025).                                                                                                                                |
| Children Chit IDs    | Array[String] | List of child chit IDs; empty if none.                                                                                                                                   | Defines hierarchy (e.g., Kanban board → columns → cards) for Projects tab or nested checklists; stored as JSON in SQLite.                                                                                                                          |
| Linked Chits         | Array[String] | IDs of related chits.                                                                                                                                                    | Enables bidirectional linking (e.g., task to event); stored as JSON for API queries.                                                                                                                                                               |
| Group IDs            | Array[String] | IDs of groups (e.g., ["Work", "Personal"]); empty if none.                                                                                                               | Organizes chits into Google Calendar-like groups for filtering in all tabs; stored as JSON in SQLite.                                                                                                                                              |
| Attachments          | Array[Object] | List of file metadata (e.g., [{name: "doc.pdf", path: "./static/doc.pdf"}]).                                                                                             | Stores references to files in /static/; supports documents/images for chits; stored as JSON in SQLite.                                                                                                                                             |
| Alarm Settings       | Array[Object] | Notification details (e.g., [{time: "2025-04-21 13:45", sound: "bell", ha_trigger: true}]).                                                                              | Configures alarms for Alarms tab; triggers Home Assistant actions; stored as JSON in SQLite.                                                                                                                                                       |
| Color                | String        | Hex code or predefined (e.g., "#FF5733").                                                                                                                                | Customizes visuals in Notes tab (grid), Projects tab (Kanban cards), Checklists tab; stored as VARCHAR for 1940s aesthetic.                                                                                                                        |
| Created Date/Time    | Datetime      | Timestamp of creation.                                                                                                                                                   | Tracks history for auditing/sorting; stored as DATETIME in SQLite.                                                                                                                                                                                 |
| Modified Date/Time   | Datetime      | Timestamp of last edit.                                                                                                                                                  | Supports syncing and change tracking; stored as DATETIME, critical for Proxmox (March 15, 2025).                                                                                                                                                   |
| Location             | String        | Optional place (e.g., "Conference Room").                                                                                                                                | Adds context for Calendar/Tasks/Checklists tabs; stored as TEXT.                                                                                                                                                                                   |
| Sequence             | Integer       | Order within parent (e.g., 1, 2, 3).                                                                                                                                     | Orders chits in Projects tab (Kanban columns/cards), Tasks tab (lists), Checklists tab (items); stored as INTEGER, per your Kanban focus (March 4, 2025).                                                                                          |
| Duration             | Integer       | Minutes or hours (e.g., 60 for 1 hour).                                                                                                                                  | Specifies length for Calendar tab scheduling/time blocking; stored as INTEGER.                                                                                                                                                                     |
| Visibility           | String        | Enum: Private, Shared, Public.                                                                                                                                           | Controls collaboration access (e.g., shared Kanban boards); stored as VARCHAR.                                                                                                                                                                     |
| Pinned               | Boolean       | True/false; default false.                                                                                                                                               | Pins chits for quick access in Notes tab (starred notes), Tasks tab (key tasks), Checklists tab; stored as BOOLEAN.                                                                                                                                |
| Notes Content        | Text          | Optional rich text or markdown.                                                                                                                                          | Supports note-taking in Notes tab (Google Keep-style) or details in other tabs; stored as TEXT.                                                                                                                                                    |
| Completion Date/Time | Datetime      | Timestamp when marked Done; null if incomplete.                                                                                                                          | Tracks completion for Tasks tab (Done view), Projects tab (Kanban), Checklists tab; stored as DATETIME.                                                                                                                                            |
| Custom Fields        | Object        | Key-value pairs (e.g., {budget: "500", category: "Marketing"}).                                                                                                          | Allows user-defined attributes; stored as JSON in SQLite for flexibility.                                                                                                                                                                          |
| Sync Status          | String        | Enum: Synced, Pending, Offline.                                                                                                                                          | Manages offline mode and syncing in Proxmox; stored as VARCHAR, per your Proxmox context (March 15, 2025).                                                                                                                                         |
| Home Assistant ID    | String        | Unique ID for Home Assistant; null if not linked.                                                                                                                        | Links chits to Home Assistant entities for automation (e.g., task triggers light); stored as VARCHAR, per your automation interest (April 20, 2025, 05:32).                                                                                        |
| Progress             | Float         | Percentage (0.0 to 1.0); optional.                                                                                                                                       | Tracks progress in Tasks tab, Projects tab (Kanban cards), Checklists tab; stored as REAL.                                                                                                                                                         |
| Dependencies         | Array[String] | IDs of chits that must be completed first.                                                                                                                               | Manages dependencies in Tasks/Projects/Checklists tabs; stored as JSON in SQLite.                                                                                                                                                                  |
| Time Estimate        | Integer       | Estimated minutes or hours (e.g., 120 for 2 hours).                                                                                                                      | Plans workload in Tasks/Projects/Checklists tabs; stored as INTEGER.                                                                                                                                                                               |
| Checklist            | Array[Object] | List of checklist items (e.g., [{text: "Buy materials", done: true, chit_id: null, sequence: 1}, {text: "Plan meeting", done: false, chit_id: "uuid123", sequence: 2}]). | Adds checklist functionality to any chit; displays in Checklists tab (primary), Tasks, Projects, Notes, Calendar tabs; supports nesting via chit_id; sequence orders items; stored as JSON in SQLite, per your checklist interest (March 5, 2025). |

---

## Notes on Updates

- **Checklists Tab Integration**: The Checklist property supports the new Checklists tab, which displays chits with non-empty Checklist arrays, showing items with text, done status, and optional chit_id for nested checklists. The sequence field within each checklist item ensures item ordering, aligning with your Kanban sequencing focus (March 4, 2025).
- **Universal Chits**: No Type or Role properties; all chits are identical, with behavior driven by properties (e.g., Due Date/Time for Calendar, Children Chit IDs for Projects, Checklist for Checklists) and tab context, per your vision (April 20, 2025, 17:10).
- **Tab/View Coverage**:
    - **Calendar**: Shows chits with Due Date/Time; checklists visible in details.
    - **Projects**: Renders chits with Children Chit IDs as Kanban boards/columns/cards; checklists on cards.
    - **Tasks**: Lists chits with Status (To-Do/Done); checklists for actionable chits.
    - **Alarms**: Shows chits with Alarm Settings; checklists for context.
    - **Notes**: Displays chits with Notes Content; checklists as to-do items.
    - **Checklists**: Highlights chits with Checklist, showing items with check-off options and nested chits.


---

## 📁 **Project Layout**
/app
├── backend/
│   └── main.py            # FastAPI app
├── frontend/
│   └── index.html         # Simple UI
├── static/                # CSS, icons, images (optional)
├── data/
│   └── app.db             # SQLite DB (or JSON later)
├── .env                   # Environment config
├── start.sh               # Startup script
├── requirements.txt       # Python deps
└── README.md              # Notes for yourself

---

## 🔍 **File-by-file Breakdown**

### 🔹 `main.py`

- Loads `.env`
- Serves `index.html` at `/`
- Exposes one or more basic API routes    
- Optional: connects to DB or writes to file

---
### 🔹 `.env`

PORT=3333
DB_PATH=./data/app.db
LOG_LEVEL=info

---

### 🔹 `start.sh`
#!/bin/bash
cd "$(dirname "$0")"
source venv/bin/activate
uvicorn backend.main:app --host 0.0.0.0 --port ${PORT:-8080}


---

### 🔹 `requirements.txt`
fastapi
uvicorn
python-dotenv

---
### 🔹 `index.html`

Super simple page to test the backend is alive.





---
# Additional Notes / Definitions of Parts

Chronological View  
Priority View  
Manual View  
  
  
C.W.'s Omni Chits  
CWOC  
  
change the order of the tabs/views to C CAPTN  
  
  
  
All views: Can have multiple "Labels" visible or hidden. A label is how Chits are grouped. Like Work, Family, Personal, Reoccurring, etc. Each view defaults to certain "System Labels." (The name on the view?)  
  
  
C CAPTN Tabs/Views  
  
CALENDAR:  
- Shows all Chits in chronological order, with calendar-like display options (schedule, day, week, month, year, custom)  
- Any Chit with a Start Date or Due Date property value.  
- Sidebar Contents: mini-month calendar.  
-  
  
  
CHECKLISTS:  
-  
- Any Chit with items in the Checklist property. These can be Text or sub-chits. (an icon/button on each line to make a sub-chit from the plain text entry.)  
- How's that different from a kanban column? It's not. They are just kanban columns that aren't in a project.  
- Each sub-Chit has an "Expand" icon/button that which clicked brings up the sub-Chit for editing.  
- can have its display order changed to allow sorting, but remembers "Manual Order." as an option to sort by. So it'll need a proper rigor this. Is this per view? Or order across all views? Seems like it needs a per-meiw option.  
-  
  
  
ALARMS:  
- You are nagged by notifications on a device until you acknowledge. Typically with sound & or Note.  
- Any Chit with Alarm property == True.  
- Sidebar Contents: One Off, Reoccurring, Hide Past Alarms.  
- at some point in the future this should also have a clock (including metric time!), a stop watch, and Timers.  
  
  
PROJECTS:  
- Kanban boards.  
- Any Chit with System Label property == project. (Sub-chits cannot have the Project System Label.)  
- Columns are just Checklists. Is there a limit on sub-tasks on kanban boards? Should there be?  
- Sidebar Contents: list of all Chits with the System Label "Project."  
- kanban columns need a type? Todo, In progress, blocked, completed (and then each colum can be custome, but then you can interact with them programmatically.) Or should ALL Chits have this? Useful for many things. Perhaps a Status property? This could then also have Event, etc. But not sure of this is getting messy with this. No. No eve y. Just statuses. Or status types.  
  
TASKS:  
- Status property: add a "-" (null) value.
- Any Chit with a status property with a value !=NULL, or which has a due date shows up in the Task view.
- Sidebar Contents: 
	- a filer to show/hide chits in each status. Multi-select. 
	- Chits with sub-chits, show/hide Projects.  
  
  
NOTES:  
- Any chit with a value in the Note property. {This can't be right. Basically everything will have a note...} Just Chits with no date or project associations?  
- Sidebar Contents:  
  
  
  
  
  
  
  
Alarm vs notification vs reminder  
  
NOTIFICATION: you are notified on a device one time with Note & chime.  
  
How to handle reoccurring tasks?  
  
All Views include sidebar with list of Labels. Select all labels you want visible in the view, like showong/hiding calendars in Google.  
  
Will need a Chit-Editor interface.  
  
Start Date property vs Due Date property:  
- Anything with a Start Date must also have an End Date Property.  
- Chits with Due Date  
- Can Chits have both an end date and a due date? Yes. Overdue items have an  
- items with a due date also have a Completed Date. (which starts out null).  
  
  
Need a searchbar  
Need a create new chit button at the top.  
  
(C)L CAPTN : hotkeys to jump to the right View.  
  
Chits with dates need:  
- time Zones  
- All Day option  
- reoccurance options  
-  
  
  
  
Info menus like CWESST.  
  
Any chit can have:  
- Multiple alarms or notifications.  
- a color  
- attachments  
- people list.  
- be pinned  
- be archived  
- be deleted  
- Title  
- Markdown support in Note. Property.  
- notes can have links to other Chits, so each chit needs a URL directly associated with their ID.  
-  
  
  
One calendar view should be HSKE view for the calendar. 😁  
  
Device: physical or browser device.


---

# ==ASSOCIATED SYSTEM==
Object & Inventory Tracking 
-  
- Accessable in a new Zone in Chits. 
- Can have a chit associated with them (For notes, etc). 
- Properties: 
	- price paid
	- Durable or consumable 
	- Quantity on-hand. 
	- Location (address, building, shelf, crate section) 
	- current value. 
	- date value updated 
	- notes
	- replace when consumed? 
	- date acquired 
	- expiration date
- Import from & export to .csv files# ==ASSOCIATED SYSTEM==
Object & Inventory Tracking 
-  
- Accessable in a new Zone in Chits. 
- Can have a chit associated with them (For notes, etc). 
- Properties: 
	- price paid
	- Durable or consumable 
	- Quantity on-hand. 
	- Location (address, building, shelf, crate section) 
	- current value. 
	- date value updated 
	- notes
	- replace when consumed? 
	- date acquired 
	- expiration date
- Import from & export to .csv files