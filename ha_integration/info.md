# C.W.'s Omni Chits (CWOC) — Home Assistant Integration

CWOC is a personal task, note, and calendar management system built around a unified concept called a "chit" — a flexible record that can serve as a task, note, calendar event, checklist, or project. This integration brings your CWOC data into Home Assistant, providing real-time sensors and services to interact with your chits from automations, dashboards, and scripts.

## Sensors

| Sensor | Description |
|--------|-------------|
| Total Chits | Total count of all chits |
| Todo | Count of chits with ToDo status |
| In Progress | Count of chits with In Progress status |
| Overdue | Count of overdue chits |
| Inbox | Count of inbox items |
| Tag sensors (dynamic) | One sensor per tag, showing the count of chits with that tag |

## Services

| Service | Description |
|---------|-------------|
| `cwoc.create_chit` | Create a new chit with title, note, tags, status, priority, and due date |
| `cwoc.add_checklist_item` | Add an item to a chit's checklist (by chit ID or title) |
| `cwoc.update_chit` | Update fields on an existing chit (title, note, status, priority) |
| `cwoc.set_chit_status` | Set the status of a chit (ToDo, In Progress, Blocked, Complete) |
| `cwoc.add_tag` | Add a tag to a chit |
| `cwoc.remove_tag` | Remove a tag from a chit |

## Prerequisites

- A running CWOC instance accessible on your local network
- Valid CWOC credentials (username and password)

## Setup

1. In Home Assistant, go to **Settings → Devices & Services → Add Integration**
2. Search for "CWOC" and select it
3. Enter your CWOC server URL (e.g., `http://192.168.1.111:3333`)
4. Enter your username and password
5. The integration will connect and create sensors automatically

## Requirements

- **Home Assistant**: 2024.1.0 or newer
- **CWOC server**: Must be accessible from your Home Assistant instance on the local network
