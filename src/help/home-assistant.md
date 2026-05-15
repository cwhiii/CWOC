# Home Assistant Integration

- [Setup Overview](#setup-overview)
- [1. Deploy the HA Custom Integration](#1-deploy-the-ha-custom-integration)
- [2. Add CWOC via HA Integrations Panel](#2-add-cwoc-via-ha-integrations-panel)
- [3. Configure HA Connection in CWOC Settings](#3-configure-ha-connection-in-cwoc-settings)
- [Common Use Cases](#common-use-cases)
- [Webhook Payloads (HA → CWOC)](#webhook-payloads-ha-cwoc)
- [Using fire_ha_event in CWOC Rules](#using-firehaevent-in-cwoc-rules)
- [HA State Change Trigger](#ha-state-change-trigger)


CWOC integrates bidirectionally with **Home Assistant** (HA). You can display chit counts on HA dashboards, create or update chits from HA automations, trigger HA scenes from CWOC rules, and fire HA events when chit state changes.

## Setup Overview

There are two sides to configure: the HA custom integration (runs inside Home Assistant) and the CWOC HA connection (configured in CWOC Settings).

## 1. Deploy the HA Custom Integration

1. Copy the `ha_integration/custom_components/cwoc/` folder from the CWOC repository to your Home Assistant's `config/custom_components/cwoc/` directory. The configurator script (`install/configurinator.sh`) can do this for you.
2. Restart Home Assistant so it discovers the new integration.

## 2. Add CWOC via HA Integrations Panel

1. In Home Assistant, go to **Settings → Devices & Services → Add Integration**.
2. Search for **"CWOC"** and select it.
3. Enter your CWOC server URL (e.g., `http://192.168.1.111:3333`), username, and password.
4. The config flow validates your credentials against CWOC. On success, sensors and services are created automatically.

## 3. Configure HA Connection in CWOC Settings

This step enables CWOC rules to call HA services and fire HA events. Admin-only.

1. Go to **CWOC [Settings → Home Assistant](/frontend/html/settings.html#home-assistant)**.
2. Enter your HA base URL (e.g., `http://192.168.1.100:8123`).
3. Paste a **Long-Lived Access Token** from HA (create one in HA → Profile → Long-Lived Access Tokens).
4. Set the poll interval (default 30 seconds) for state change monitoring.
5. Click **Test Connection** to verify. Save when green.

The **Webhook URL** displayed in this section is what HA automations use to call back into CWOC. Copy it for use in HA automation YAML.

## Common Use Cases

**Chit counts on HA dashboards:** Once the integration is added, sensors like `sensor.cwoc_total_chits`, `sensor.cwoc_todo_count`, `sensor.cwoc_overdue_count`, and `sensor.cwoc_inbox_count` appear automatically. Add them to any HA dashboard card. Per-tag sensors (e.g., `sensor.cwoc_tag_groceries_count`) are also available for tracked tags.

**Creating chits from HA automations:** Use the `cwoc.create_chit` service in any HA automation.

**Triggering HA scenes from CWOC rules:** In the CWOC [Rules Editor](/frontend/html/help.html#cron-triggers), create a rule with a `call_ha_service` action.

**Firing HA events on CWOC state changes:** Use the `fire_ha_event` action in CWOC rules to push events onto the HA event bus.

## Webhook Payloads (HA → CWOC)

HA automations can POST to the CWOC webhook endpoint to create chits, update them, add checklist items, or trigger CWOC rules. The webhook URL format is:

`http://<cwoc-host>:3333/api/ha/webhook?token=<webhook-secret>`

All payloads are JSON with an `action` field. The optional `user_id` field targets a specific CWOC user (defaults to the admin who configured HA).

**Supported actions:**

- **create_chit** — Create a new chit with title, note, tags, status, priority, due_datetime
- **add_checklist_item** — Append an item to an existing chit's checklist (by chit_id or chit_title)
- **update_chit** — Update fields on an existing chit
- **trigger_rule** — Fire the `ha_webhook` trigger in the CWOC rules engine

## Using fire_ha_event in CWOC Rules

The `fire_ha_event` action in the CWOC rules engine POSTs an event to the HA event bus. Template placeholders (`{chit_title}`, `{chit_status}`, `{rule_name}`, `{entity_id}`) are substituted from the triggering context before the event is fired.

Suggested event types: `cwoc_chit_created`, `cwoc_chit_updated`, `cwoc_email_received`, `cwoc_status_changed`, `cwoc_tag_added`.

## HA State Change Trigger

CWOC can poll HA entity states and fire rules when a state changes. In the [Rules Editor](/frontend/html/help.html#cron-triggers), select `ha_state_change` as the trigger type and specify the entity_id to monitor. CWOC polls at the configured interval and fires the trigger when the state differs from the last known value.

---

**See also:** [Cron Triggers & Habit Rules](/frontend/html/help.html#cron-triggers) · [Settings](/frontend/html/settings.html) · [Dependent Apps](/frontend/html/help.html#dependent-apps)
