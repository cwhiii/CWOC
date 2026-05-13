# C.W.'s Omni Chits (CWOC) — Home Assistant Integration

A custom Home Assistant integration for [C.W.'s Omni Chits](https://github.com/cwhiii/cwoc-ha-integration), a personal task, note, and calendar management system. This integration brings your CWOC data into Home Assistant with real-time sensors and services you can use in automations, dashboards, and scripts.

## Features

### Sensors

| Sensor | Description |
|--------|-------------|
| Total Chits | Total count of all chits |
| Todo | Count of chits with ToDo status |
| In Progress | Count of chits with In Progress status |
| Overdue | Count of overdue chits |
| Inbox | Count of inbox items |
| Tag sensors (dynamic) | One sensor per tag, showing the count of chits with that tag |

### Services

| Service | Description |
|---------|-------------|
| `cwoc.create_chit` | Create a new chit with title, note, tags, status, priority, and due date |
| `cwoc.add_checklist_item` | Add an item to a chit's checklist (by chit ID or title) |
| `cwoc.update_chit` | Update fields on an existing chit (title, note, status, priority) |
| `cwoc.set_chit_status` | Set the status of a chit (ToDo, In Progress, Blocked, Complete) |
| `cwoc.add_tag` | Add a tag to a chit |
| `cwoc.remove_tag` | Remove a tag from a chit |

### Capabilities

- Automatic polling with configurable update interval
- Dynamic tag sensors created automatically based on your tags
- Config flow setup (no YAML editing required)
- Full service support for creating and managing chits from automations

## Installation via HACS

1. Open Home Assistant and go to **HACS** in the sidebar
2. Click the three-dot menu (top right) and select **Custom repositories**
3. Enter the repository URL: `https://github.com/cwhiii/cwoc-ha-integration`
4. Select **Integration** as the category and click **Add**
5. Close the custom repositories dialog
6. Search for **CWOC** in the HACS integrations list
7. Click **Download** and confirm the installation
8. Restart Home Assistant

After restart, the integration will be available to configure.

## Manual Installation

1. Download or clone this repository
2. Copy the `custom_components/cwoc/` directory into your Home Assistant `config/custom_components/` directory
3. Restart Home Assistant

Your directory structure should look like:

```
config/
└── custom_components/
    └── cwoc/
        ├── __init__.py
        ├── manifest.json
        ├── config_flow.py
        ├── const.py
        ├── coordinator.py
        ├── sensor.py
        ├── services.py
        ├── services.yaml
        ├── strings.json
        ├── icons.json
        └── translations/
            └── en.json
```

## Configuration

This integration uses Home Assistant's config flow — no YAML configuration needed.

1. Go to **Settings → Devices & Services**
2. Click **+ Add Integration**
3. Search for **CWOC** and select it
4. Enter your CWOC server details:
   - **URL**: Your CWOC server address (e.g., `http://192.168.1.111:3333`)
   - **Username**: Your CWOC username
   - **Password**: Your CWOC password
5. Click **Submit**

The integration will validate the connection and create sensors automatically.

### Prerequisites

- A running CWOC instance accessible from your Home Assistant server on the local network
- Valid CWOC credentials (username and password)
- Home Assistant 2024.1.0 or newer

## Updating

HACS will automatically notify you when a new version of the CWOC integration is available. To update:

1. Open **HACS** in the sidebar
2. You'll see an update badge if a new version is available
3. Click on the **CWOC** integration
4. Click **Update** and confirm
5. Restart Home Assistant to apply the update

## License

This integration is maintained by [@cwhiii](https://github.com/cwhiii).
