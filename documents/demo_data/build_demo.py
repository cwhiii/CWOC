#!/usr/bin/env python3
import json

chits = []

def chit(id, title, **kw):
    c = {
        'id': id, 'title': title, 'note': kw.get('note',''),
        'tags': kw.get('tags',[]),
        'start_datetime': kw.get('start'),
        'end_datetime': kw.get('end'),
        'due_datetime': kw.get('due'),
        'completed_datetime': kw.get('completed'),
        'status': kw.get('status'),
        'priority': kw.get('priority'),
        'severity': kw.get('severity'),
        'checklist': kw.get('checklist',[]),
        'alarm': False, 'notification': False,
        'recurrence': kw.get('recurrence'),
        'recurrence_id': None,
        'location': kw.get('location',''),
        'color': kw.get('color','transparent'),
        'people': kw.get('people',[]),
        'pinned': kw.get('pinned',False),
        'archived': kw.get('archived',False),
        'deleted': False,
        'created_datetime': '2026-04-30T08:00:00.000000',
        'modified_datetime': '2026-04-30T08:00:00.000000',
        'is_project_master': kw.get('is_project_master',False),
        'child_chits': kw.get('child_chits',[]),
        'all_day': kw.get('all_day',False),
        'alerts': kw.get('alerts',[
            {'_type':'_notify_flags','at_start':True,'at_due':True}
        ]),
        'recurrence_rule': kw.get('recurrence_rule'),
        'recurrence_exceptions': None,
        'progress_percent': None,
        'time_estimate': None,
        'weather_data': None,
        'health_data': kw.get('health_data'),
    }
    chits.append(c)

# ── 1. Welcome note (pinned) ──
chit('demo-0001', 'Welcome to Omni Chits!', pinned=True, color='#E3B23C',
    tags=['Notes','Demo/Getting Started'],
    note='# What is a Chit?\n\nA **chit** is the universal unit. It can be a calendar event, task, note, checklist, alarm, or project \u2014 all at once.\n\n- Fill in dates \u2192 appears on the **Calendar**\n- Add a status \u2192 shows in **Tasks**\n- Write a note \u2192 it\'s in **Notes**\n- Add checklist items \u2192 it\'s in **Checklists**\n- Set an alarm \u2192 it\'s in **Alerts**\n- Mark as project \u2192 it\'s in **Projects**\n\nPress **R** for the hotkey reference. Press **Shift+R** for the full Help guide.\n\n## The C CAPTN Views\n| Key | View |\n|-----|------|\n| C | Calendar |\n| H | Checklists |\n| A | Alerts |\n| P | Projects |\n| T | Tasks |\n| N | Notes |')

# ── 2. Recurring standup ──
chit('demo-0002', 'Team Standup', color='#6B8299',
    tags=['Calendar','Work/Meetings'],
    start='2026-05-01T14:00:00.000Z', end='2026-05-01T14:30:00.000Z',
    location='Conference Room B',
    people=['Ada Lovelace','Grace Hopper','Alan Turing'],
    recurrence='WEEKLY',
    recurrence_rule={'freq':'WEEKLY','interval':1,'byDay':['MO','TU','WE','TH','FR']},
    alerts=[
        {'_type':'_notify_flags','at_start':True,'at_due':True},
        {'_type':'notification','name':'Standup in 10','offset_minutes':-10,'relative_to':'start','enabled':True}
    ])

# ── 3. All-day multi-day event ──
chit('demo-0003', 'Product Launch Week', color='#C66B6B', all_day=True,
    tags=['Calendar','Work/Projects'],
    priority='High', severity='Critical', status='In Progress',
    start='2026-05-04T04:00:00.000Z', end='2026-05-09T03:59:59.000Z',
    location='Headquarters', people=['Ada Lovelace','Nikola Tesla'], pinned=True,
    note='All hands on deck. Final QA Mon-Wed, marketing blitz Thu, launch party Fri.')

# ── 4. Task: ToDo ──
chit('demo-0004', 'Write API documentation', color='#8A9A5B',
    tags=['Tasks','Work/Engineering'],
    status='ToDo', priority='High', severity='Major',
    due='2026-05-07T20:00:00.000Z', people=['Grace Hopper'],
    note='Cover all endpoints under /api/. Include request and response examples.')

# ── 5. Task: In Progress ──
chit('demo-0005', 'Redesign the settings page', color='#E3B23C',
    tags=['Tasks','Work/Engineering'],
    status='In Progress', priority='Medium', severity='Minor',
    due='2026-05-05T20:00:00.000Z', people=['Alan Turing'],
    note='Consolidate layout. Group related options. Add section headers.')

# ── 6. Task: Blocked ──
chit('demo-0006', 'Deploy to staging server', color='#C66B6B',
    tags=['Tasks','Work/Engineering'],
    status='Blocked', priority='High', severity='Critical',
    due='2026-05-06T20:00:00.000Z', people=['Nikola Tesla'],
    note='Blocked: waiting on the new SSL certificate from IT.')

# ── 7. Task: Complete ──
chit('demo-0007', 'Set up CI/CD pipeline', color='#8A9A5B',
    tags=['Tasks','Work/Engineering'],
    status='Complete', priority='High', severity='Major',
    due='2026-04-28T20:00:00.000Z', completed='2026-04-28T18:30:00.000Z',
    people=['Ada Lovelace'],
    note='GitHub Actions workflow for automated testing and deployment. Done!')

# ── 8. Grocery checklist ──
chit('demo-0008', 'Grocery Run', color='#8B6B99',
    tags=['Checklists','Personal/Errands'],
    checklist=[
        {'id':'cl-01','text':'Dairy','level':0,'checked':False,'parent':None},
        {'id':'cl-02','text':'Milk (whole)','level':1,'checked':False,'parent':'cl-01'},
        {'id':'cl-03','text':'Eggs (dozen)','level':1,'checked':True,'parent':'cl-01'},
        {'id':'cl-04','text':'Butter','level':1,'checked':False,'parent':'cl-01'},
        {'id':'cl-05','text':'Produce','level':0,'checked':False,'parent':None},
        {'id':'cl-06','text':'Apples','level':1,'checked':False,'parent':'cl-05'},
        {'id':'cl-07','text':'Spinach','level':1,'checked':True,'parent':'cl-05'},
        {'id':'cl-08','text':'Carrots','level':1,'checked':False,'parent':'cl-05'},
        {'id':'cl-09','text':'Bakery','level':0,'checked':False,'parent':None},
        {'id':'cl-10','text':'Sourdough loaf','level':1,'checked':False,'parent':'cl-09'},
    ],
    note='Nested checklists! Drag items between lists in the Checklists view.')

# ── 9. Packing checklist with due date ──
chit('demo-0009', 'Trip Packing List', color='#6B8299',
    tags=['Checklists','Calendar','Personal/Travel'],
    due='2026-05-10T12:00:00.000Z', status='ToDo', priority='Medium',
    checklist=[
        {'id':'pk-01','text':'Clothes','level':0,'checked':False,'parent':None},
        {'id':'pk-02','text':'Shirts (5)','level':1,'checked':False,'parent':'pk-01'},
        {'id':'pk-03','text':'Pants (3)','level':1,'checked':False,'parent':'pk-01'},
        {'id':'pk-04','text':'Jacket','level':1,'checked':False,'parent':'pk-01'},
        {'id':'pk-05','text':'Electronics','level':0,'checked':False,'parent':None},
        {'id':'pk-06','text':'Laptop + charger','level':1,'checked':False,'parent':'pk-05'},
        {'id':'pk-07','text':'Phone charger','level':1,'checked':True,'parent':'pk-05'},
        {'id':'pk-08','text':'Headphones','level':1,'checked':False,'parent':'pk-05'},
        {'id':'pk-09','text':'Documents','level':0,'checked':False,'parent':None},
        {'id':'pk-10','text':'Passport','level':1,'checked':False,'parent':'pk-09'},
        {'id':'pk-11','text':'Boarding pass','level':1,'checked':False,'parent':'pk-09'},
    ],
    note='A checklist with a due date shows up in both Checklists AND Calendar views!')

# ── 10. How it works note ──
chit('demo-0010', 'How Omni Chits Works', color='transparent',
    tags=['Notes','Demo/Getting Started'],
    note='# The Unified Chit Model\n\nEvery item is a **chit**. Unlike other tools with separate apps for calendar, tasks, notes, and lists, here everything is one entity.\n\n## Why?\nReal life doesn\'t fit neat categories. A meeting might have action items with a packing list and background notes. In Omni Chits, that\'s just one chit.\n\n## Views\nThe six **C CAPTN** tabs filter chits by what data they contain:\n- **Calendar** \u2014 has dates\n- **Checklists** \u2014 has list items\n- **Alerts** \u2014 has alarms or timers\n- **Projects** \u2014 is a project master\n- **Tasks** \u2014 has a status\n- **Notes** \u2014 has note content\n\n## Try It\n- Double-click empty calendar space to create a timed chit\n- Press **K** to create a new chit\n- Shift+click a calendar event for Quick Edit\n- Use `[[chit title]]` in notes to link to other chits')

# ── 11. Markdown features note ──
chit('demo-0011', 'Markdown Features', color='#4c58f4',
    tags=['Notes','Demo/Features'],
    note='# Markdown in Notes\n\nNotes support full **Markdown** rendering:\n\n## Formatting\n- **Bold** and *italic* and ~~strikethrough~~\n- `inline code` and code blocks\n- [Hyperlinks](https://example.com)\n\n## Lists\n1. Numbered lists\n2. Work great\n   - With nesting\n   - Like this\n\n## Tables\n| Feature | Status |\n|---------|--------|\n| Markdown | Done |\n| Links | Done |\n| Tables | Done |\n\n## Chit Links\nType `[[` in the notes editor to link to other chits. Try: [[Welcome to Omni Chits!]]\n\n> Blockquotes work too.')

# ── 12. Morning workout - recurring with health ──
chit('demo-0012', 'Morning Workout', color='#8A9A5B',
    tags=['Calendar','Personal/Health'],
    start='2026-05-01T11:00:00.000Z', end='2026-05-01T12:00:00.000Z',
    location='Downtown Gym',
    recurrence='WEEKLY',
    recurrence_rule={'freq':'WEEKLY','interval':1,'byDay':['MO','WE','FR']},
    note='Cardio + weights. Health indicators are logged on this chit.',
    health_data={'heart_rate':145,'bp':'120/78','weight':175,'distance':3.2,'spo2':98,'temperature':98.6})

# ── 13. Doctor appointment with health data ──
chit('demo-0013', 'Annual Physical', color='#C66B6B',
    tags=['Calendar','Personal/Health'],
    start='2026-05-08T15:00:00.000Z', end='2026-05-08T16:00:00.000Z',
    location='Springfield Medical Center', people=['Dr. Watson'],
    note='Annual checkup. Bring insurance card. Fasting blood work.',
    health_data={'heart_rate':72,'bp':'118/76','weight':175,'glucose':95,'spo2':99,'temperature':98.4,'height':70})

# ── 14. Lunch with friend ──
chit('demo-0014', 'Lunch with Marie', color='#E3B23C',
    tags=['Calendar','Personal/Social'],
    start='2026-05-02T17:00:00.000Z', end='2026-05-02T18:30:00.000Z',
    location='The Rusty Anchor Cafe', people=['Marie Curie'],
    note='Catch up over lunch. She wants to discuss the new research project.')

# ── 15. Project master ──
chit('demo-0015', 'Website Redesign Project', color='#8A9A5B',
    tags=['Notes'], is_project_master=True,
    child_chits=['demo-0004','demo-0005','demo-0006','demo-0007'],
    note='Master project tracking the website redesign. Child chits show as a Kanban board with ToDo, In Progress, Blocked, and Complete columns.\n\nDrag chits between columns to update their status!')

# ── 16. Alarm chit ──
chit('demo-0016', 'Take Medication', color='#C66B6B',
    tags=['Alarms','Personal/Health'],
    alerts=[
        {'_type':'_notify_flags','at_start':True,'at_due':True},
        {'_type':'alarm','name':'Morning meds','time':'08:00','days':['Mon','Tue','Wed','Thu','Fri','Sat','Sun'],'enabled':True,'recurrence':'none'},
        {'_type':'alarm','name':'Evening meds','time':'20:00','days':['Mon','Tue','Wed','Thu','Fri','Sat','Sun'],'enabled':True,'recurrence':'none'}
    ],
    note='Alarms fire browser notifications with sound. Multiple alarms per chit, each with their own schedule.')

# ── 17. Timer chit ──
chit('demo-0017', 'Focus Session', color='#6B8299',
    tags=['Alarms','Work/Productivity'],
    alerts=[
        {'_type':'_notify_flags','at_start':True,'at_due':True},
        {'_type':'timer','name':'Deep work block','totalSeconds':1500,'loop':False},
        {'_type':'timer','name':'Break','totalSeconds':300,'loop':False}
    ],
    note='Timers count down and alert when done. The Alerts view also has an independent alerts board for quick timers not tied to any chit. Press **!** for the Quick Alert hotkey.')

# ── 18. Book club - monthly recurring ──
chit('demo-0018', 'Book Club', color='#8B6B99',
    tags=['Calendar','Personal/Social'],
    start='2026-05-03T23:00:00.000Z', end='2026-05-04T01:00:00.000Z',
    location='Public Library, Room 204',
    people=['Marie Curie','Rosalind Franklin'],
    note='Monthly book club. Discussing "The Midnight Library." Bring snacks.',
    recurrence='MONTHLY',
    recurrence_rule={'freq':'MONTHLY','interval':1})

# ── 19. Due-date-only task ──
chit('demo-0019', 'Submit quarterly report', color='#E3B23C',
    tags=['Tasks','Calendar','Work/Admin'],
    status='ToDo', priority='High',
    due='2026-05-09T16:00:00.000Z',
    note='Due-date-only chits appear as a clock icon on the calendar. No start/end time, just a deadline.')

# ── 20. Archived chit ──
chit('demo-0020', 'Old project notes (archived)', color='#6B8299',
    tags=['Notes','Work/Projects'], archived=True,
    note='Archived chits are hidden by default. Toggle "Show Archived" in the sidebar filters to see them.')

# ── 21. Weather demo ──
chit('demo-0021', 'Outdoor Team Building', color='#8A9A5B',
    tags=['Calendar','Work/Social'],
    start='2026-05-06T16:00:00.000Z', end='2026-05-06T19:00:00.000Z',
    location='Central Park, New York',
    people=['Ada Lovelace','Alan Turing','Nikola Tesla','Grace Hopper'],
    note='Weather auto-loads when a chit has a location and a date. Press **W** for the weather modal.')

# ── 22. Color demo note ──
chit('demo-0022', 'Custom Colors', color='#D4A574',
    tags=['Notes','Demo/Features'],
    note='# Chit Colors\n\nEvery chit can have its own color from the picker in the editor. Add custom colors in Settings.\n\nColors appear on calendar events, task cards, note cards, and checklist headers:\n- Red (#C66B6B) \u2014 urgent/important\n- Green (#8A9A5B) \u2014 complete/healthy\n- Blue (#6B8299) \u2014 informational\n- Gold (#E3B23C) \u2014 in progress\n- Purple (#8B6B99) \u2014 personal\n- Indigo (#4c58f4) \u2014 reference')

# ── 23. Tags demo note ──
chit('demo-0023', 'Tags and Filtering', color='#4c58f4',
    tags=['Notes','Demo/Features'],
    note='# Hierarchical Tags\n\nTags use `/` for nesting: `Work/Engineering`, `Personal/Health`.\n\nChild tags inherit parent color. Favorites appear at top.\n\n## Filtering\nPress **F** for the filter submenu:\n- **S** \u2014 Status\n- **T** \u2014 Tags\n- **P** \u2014 Priority\n- **E** \u2014 People\n- **Backspace** \u2014 Clear all')

# ── 24. Keyboard shortcuts note ──
chit('demo-0024', 'Keyboard Power User', color='transparent',
    tags=['Notes','Demo/Getting Started'],
    note='# Keyboard Shortcuts\n\n## Tab Switching\n**C** Calendar, **H** Checklists, **A** Alerts, **P** Projects, **T** Tasks, **N** Notes\n\n## Actions\n- **K** \u2014 Create new chit\n- **W** \u2014 Weather modal (Shift+W for full page)\n- **L** \u2014 Clock modal\n- **S** \u2014 Settings\n- **!** \u2014 Quick Alert\n- **`** \u2014 Toggle sidebar\n- **~** \u2014 Toggle top bar\n- **G** \u2014 Global search\n- **V** \u2014 Navigate menu\n\n## Submenus\n- **.** \u2014 Period (calendar view)\n- **F** \u2014 Filters\n- **O** \u2014 Sort order\n\nPress **R** anytime for the full reference overlay!')

# ── 25. Weekend hike with health ──
chit('demo-0025', 'Weekend Hike', color='#8A9A5B',
    tags=['Calendar','Personal/Health','Personal/Social'],
    start='2026-05-03T14:00:00.000Z', end='2026-05-03T18:00:00.000Z',
    location='Blue Ridge Trail', people=['Rosalind Franklin'],
    note='5-mile loop trail. Bring water and snacks.',
    health_data={'distance':5.2,'heart_rate':135})

# ── 26. Sprint planning with checklist ──
chit('demo-0026', 'Sprint Planning', color='#6B8299',
    tags=['Calendar','Work/Meetings','Checklists'],
    start='2026-05-05T15:00:00.000Z', end='2026-05-05T16:30:00.000Z',
    people=['Ada Lovelace','Grace Hopper','Alan Turing','Nikola Tesla'],
    note='Plan the next two-week sprint.',
    checklist=[
        {'id':'sp-01','text':'Review completed stories','level':0,'checked':True,'parent':None},
        {'id':'sp-02','text':'Groom backlog','level':0,'checked':False,'parent':None},
        {'id':'sp-03','text':'Estimate new stories','level':0,'checked':False,'parent':None},
        {'id':'sp-04','text':'Assign owners','level':0,'checked':False,'parent':None},
        {'id':'sp-05','text':'Set sprint goal','level':0,'checked':False,'parent':None},
    ])

# ── 27. Recipe note ──
chit('demo-0027', 'Recipe: Sourdough Bread', color='#D4A574',
    tags=['Notes','Personal/Recipes'],
    note='# Sourdough Bread\n\n## Ingredients\n- 500g bread flour\n- 350g water\n- 100g active starter\n- 10g salt\n\n## Method\n1. Mix flour and water, rest 30 min (autolyse)\n2. Add starter and salt, fold to combine\n3. Bulk ferment 4-6 hours with stretch and folds\n4. Shape and place in banneton\n5. Cold retard 12-16 hours\n6. Bake in Dutch oven at 500F covered 20 min, 450F uncovered 20 min')

# ── 28. Overdue task ──
chit('demo-0028', 'Renew domain registration', color='#C66B6B',
    tags=['Tasks','Work/Admin'],
    status='ToDo', priority='High', severity='Critical',
    due='2026-04-28T20:00:00.000Z',
    note='This task is overdue! With "Highlight Overdue" enabled in Settings, overdue chits get a red border.')

# ── 29. Ideas note ──
chit('demo-0029', 'Hackathon Ideas', color='#8B6B99',
    tags=['Notes','Work/Projects'],
    note='- Real-time collaborative whiteboard\n- AI-powered meeting summarizer\n- Smart home energy dashboard\n- Retro game emulator in the browser\n\nVote on Friday. Winner gets pizza.')

# ── 30. Dentist with notifications ──
chit('demo-0030', 'Dentist Appointment', color='#6B8299',
    tags=['Calendar','Personal/Health'],
    start='2026-05-07T18:00:00.000Z', end='2026-05-07T19:00:00.000Z',
    location='Bright Smile Dental, Suite 300', people=['Dr. Molar'],
    alerts=[
        {'_type':'_notify_flags','at_start':True,'at_due':True},
        {'_type':'notification','name':'Dentist tomorrow','offset_minutes':-1440,'relative_to':'start','enabled':True},
        {'_type':'notification','name':'Leave in 30 min','offset_minutes':-30,'relative_to':'start','enabled':True}
    ],
    note='Notifications fire relative to start or due time. This has a 24-hour and 30-minute reminder.')

# ═══════════════════════════════════════════════════════════════════════════
# Write chits file
# ═══════════════════════════════════════════════════════════════════════════

envelope = {
    'type': 'chits',
    'version': '20260429.1655',
    'exported_at': '2026-04-30T12:00:00.000000Z',
    'instance_id': 'demo-00000000-0000-0000-0000-000000000000',
    'data': chits
}

with open('tmp/demo-chits.json', 'w') as f:
    json.dump(envelope, f, indent=2)

print(f'Generated {len(chits)} demo chits -> tmp/demo-chits.json')

# ═══════════════════════════════════════════════════════════════════════════
# Build userdata file (tags, custom colors, contacts, settings)
# ═══════════════════════════════════════════════════════════════════════════

userdata = {
    'type': 'userdata',
    'version': '20260429.1655',
    'exported_at': '2026-04-30T12:00:00.000000Z',
    'instance_id': 'demo-00000000-0000-0000-0000-000000000000',
    'data': {
        'settings': [{
            'user_id': 'default_user',
            'time_format': '12hour',
            'sex': 'Man',
            'snooze_length': '5 minutes',
            'default_filters': {},
            'alarm_orientation': 'Horizontal',
            'active_clocks': '["24hour","12hour","hst"]',
            'tags': [
                # Demo tags
                {'name': 'Demo', 'color': '#E3B23C', 'favorite': False},
                {'name': 'Demo/Getting Started', 'color': '#E3B23C', 'favorite': True},
                {'name': 'Demo/Features', 'color': '#D4A574', 'favorite': False},
                # Work tags
                {'name': 'Work', 'color': '#6B8299', 'favorite': False},
                {'name': 'Work/Engineering', 'color': '#4682B4', 'favorite': True},
                {'name': 'Work/Meetings', 'color': '#6B8299', 'favorite': False},
                {'name': 'Work/Projects', 'color': '#8A9A5B', 'favorite': False},
                {'name': 'Work/Admin', 'color': '#C66B6B', 'favorite': False},
                {'name': 'Work/Productivity', 'color': '#6B8299', 'favorite': False},
                {'name': 'Work/Social', 'color': '#8A9A5B', 'favorite': False},
                # Personal tags
                {'name': 'Personal', 'color': '#8B6B99', 'favorite': False},
                {'name': 'Personal/Health', 'color': '#C66B6B', 'favorite': True},
                {'name': 'Personal/Social', 'color': '#E3B23C', 'favorite': False},
                {'name': 'Personal/Errands', 'color': '#8B6B99', 'favorite': False},
                {'name': 'Personal/Travel', 'color': '#4c58f4', 'favorite': False},
                {'name': 'Personal/Recipes', 'color': '#D4A574', 'favorite': False},
            ],
            'custom_colors': [
                '#C66B6B', '#E3B23C', '#8A9A5B', '#6B8299',
                '#8B6B99', '#4c58f4', '#D4A574', '#2E8B57',
                '#CD853F', '#708090'
            ],
            'visual_indicators': {
                'alarm': 'always',
                'notification': 'always',
                'timer': 'always',
                'stopwatch': 'always',
                'weather': 'always',
                'people': 'always',
                'indicators': 'always'
            },
            'chit_options': {
                'fade_past_chits': True,
                'highlight_overdue_chits': True,
                'delete_past_alarm_chits': False,
                'show_tab_counts': True
            },
            'calendar_snap': '15',
            'week_start_day': '0',
            'work_start_hour': '8',
            'work_end_hour': '17',
            'work_days': '1,2,3,4,5',
            'enabled_periods': 'Itinerary,Day,Week,Work,SevenDay,Month,Year',
            'custom_days_count': '7',
            'saved_locations': [
                {'label': 'Office', 'address': 'New York, NY', 'is_default': True},
                {'label': 'Gym', 'address': 'Downtown Gym', 'is_default': False},
                {'label': 'Home', 'address': 'Springfield, IL', 'is_default': False}
            ],
            'all_view_start_hour': '0',
            'all_view_end_hour': '24',
            'day_scroll_to_hour': '7',
            'username': 'Demo User',
            'audit_log_max_days': 365,
            'audit_log_max_mb': 1.0,
            'default_notifications': None,
            'unit_system': 'imperial'
        }],
        'contacts': [
            {
                'id': 'demo-contact-001',
                'given_name': 'Ada', 'surname': 'Lovelace',
                'middle_names': '', 'prefix': '', 'suffix': '',
                'display_name': 'Ada Lovelace', 'nickname': '',
                'phones': [{'label': 'Work', 'value': '555-0101'}],
                'emails': [{'label': 'Work', 'value': 'ada@example.com'}],
                'addresses': [{'label': 'Office', 'value': '123 Innovation Blvd'}],
                'call_signs': None, 'x_handles': None,
                'websites': [{'label': 'Portfolio', 'value': 'https://example.com/ada'}],
                'has_signal': True, 'pgp_key': None,
                'favorite': True,
                'created_datetime': '2026-04-30T08:00:00.000000',
                'modified_datetime': '2026-04-30T08:00:00.000000',
                'signal_username': None,
                'color': '#4682B4',
                'organization': 'Engineering Lead',
                'social_context': 'Work colleague',
                'image_url': None,
                'notes': 'Lead engineer on the website redesign project.',
                'tags': ['Work/Engineering']
            },
            {
                'id': 'demo-contact-002',
                'given_name': 'Grace', 'surname': 'Hopper',
                'middle_names': 'M.', 'prefix': 'Rear Admiral', 'suffix': '',
                'display_name': 'Rear Admiral Grace M. Hopper', 'nickname': 'Amazing Grace',
                'phones': [{'label': 'Mobile', 'value': '555-0102'}],
                'emails': [{'label': 'Work', 'value': 'grace@example.com'}],
                'addresses': None, 'call_signs': None, 'x_handles': None,
                'websites': None, 'has_signal': False, 'pgp_key': None,
                'favorite': True,
                'created_datetime': '2026-04-30T08:00:00.000000',
                'modified_datetime': '2026-04-30T08:00:00.000000',
                'signal_username': None,
                'color': '#8A9A5B',
                'organization': 'Documentation Team',
                'social_context': 'Work colleague',
                'image_url': None,
                'notes': 'Handles all API documentation and technical writing.',
                'tags': ['Work/Engineering']
            },
            {
                'id': 'demo-contact-003',
                'given_name': 'Alan', 'surname': 'Turing',
                'middle_names': '', 'prefix': 'Dr.', 'suffix': '',
                'display_name': 'Dr. Alan Turing', 'nickname': '',
                'phones': [{'label': 'Mobile', 'value': '555-0103'}],
                'emails': [{'label': 'Work', 'value': 'alan@example.com'}],
                'addresses': None, 'call_signs': None, 'x_handles': None,
                'websites': None, 'has_signal': True, 'pgp_key': 'ABCD1234',
                'favorite': False,
                'created_datetime': '2026-04-30T08:00:00.000000',
                'modified_datetime': '2026-04-30T08:00:00.000000',
                'signal_username': 'alan.t',
                'color': '#E3B23C',
                'organization': 'Frontend Team',
                'social_context': 'Work colleague',
                'image_url': None,
                'notes': 'Working on the settings page redesign.',
                'tags': ['Work/Engineering']
            },
            {
                'id': 'demo-contact-004',
                'given_name': 'Nikola', 'surname': 'Tesla',
                'middle_names': '', 'prefix': '', 'suffix': '',
                'display_name': 'Nikola Tesla', 'nickname': 'Nik',
                'phones': [{'label': 'Mobile', 'value': '555-0104'}],
                'emails': [{'label': 'Work', 'value': 'nikola@example.com'}],
                'addresses': None, 'call_signs': None, 'x_handles': None,
                'websites': None, 'has_signal': False, 'pgp_key': None,
                'favorite': False,
                'created_datetime': '2026-04-30T08:00:00.000000',
                'modified_datetime': '2026-04-30T08:00:00.000000',
                'signal_username': None,
                'color': '#C66B6B',
                'organization': 'DevOps',
                'social_context': 'Work colleague',
                'image_url': None,
                'notes': 'Handles infrastructure and deployments.',
                'tags': ['Work/Engineering']
            },
            {
                'id': 'demo-contact-005',
                'given_name': 'Marie', 'surname': 'Curie',
                'middle_names': '', 'prefix': 'Dr.', 'suffix': '',
                'display_name': 'Dr. Marie Curie', 'nickname': '',
                'phones': [{'label': 'Personal', 'value': '555-0105'}],
                'emails': [{'label': 'Personal', 'value': 'marie@example.com'}],
                'addresses': [{'label': 'Home', 'value': '42 Research Lane'}],
                'call_signs': None, 'x_handles': None,
                'websites': None, 'has_signal': True, 'pgp_key': None,
                'favorite': True,
                'created_datetime': '2026-04-30T08:00:00.000000',
                'modified_datetime': '2026-04-30T08:00:00.000000',
                'signal_username': None,
                'color': '#8B6B99',
                'organization': 'Research Institute',
                'social_context': 'Friend',
                'image_url': None,
                'notes': 'Lunch buddy. Also in the book club.',
                'tags': ['Personal/Social']
            },
            {
                'id': 'demo-contact-006',
                'given_name': 'Rosalind', 'surname': 'Franklin',
                'middle_names': 'E.', 'prefix': 'Dr.', 'suffix': '',
                'display_name': 'Dr. Rosalind E. Franklin', 'nickname': 'Roz',
                'phones': [{'label': 'Mobile', 'value': '555-0106'}],
                'emails': [{'label': 'Personal', 'value': 'rosalind@example.com'}],
                'addresses': None, 'call_signs': None, 'x_handles': None,
                'websites': None, 'has_signal': False, 'pgp_key': None,
                'favorite': False,
                'created_datetime': '2026-04-30T08:00:00.000000',
                'modified_datetime': '2026-04-30T08:00:00.000000',
                'signal_username': None,
                'color': '#2E8B57',
                'organization': None,
                'social_context': 'Hiking buddy, book club',
                'image_url': None,
                'notes': 'Hiking partner and fellow book club member.',
                'tags': ['Personal/Social','Personal/Health']
            }
        ]
    }
}

with open('tmp/demo-userdata.json', 'w') as f:
    json.dump(userdata, f, indent=2)

print(f'Generated userdata with {len(userdata["data"]["settings"][0]["tags"])} tags, '
      f'{len(userdata["data"]["settings"][0]["custom_colors"])} custom colors, '
      f'{len(userdata["data"]["contacts"])} contacts -> tmp/demo-userdata.json')
