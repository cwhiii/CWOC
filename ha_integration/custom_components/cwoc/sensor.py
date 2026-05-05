"""Sensor platform for CWOC integration."""
import logging

from homeassistant.components.sensor import (
    SensorEntity,
    SensorStateClass,
)
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant
from homeassistant.helpers.entity_platform import AddEntitiesCallback
from homeassistant.helpers.update_coordinator import CoordinatorEntity

from .const import DOMAIN
from .coordinator import CwocDataUpdateCoordinator

_LOGGER = logging.getLogger(__name__)

# Fixed sensor definitions: (key, name, icon, data_key)
FIXED_SENSORS = [
    ("total_chits", "CWOC Total Chits", "mdi:note-multiple", "total_chits"),
    ("todo_count", "CWOC Todo", "mdi:checkbox-blank-outline", "todo_count"),
    ("in_progress_count", "CWOC In Progress", "mdi:progress-clock", "in_progress_count"),
    ("overdue_count", "CWOC Overdue", "mdi:alert-circle", "overdue_count"),
    ("inbox_count", "CWOC Inbox", "mdi:email-outline", "inbox_count"),
]


async def async_setup_entry(
    hass: HomeAssistant,
    entry: ConfigEntry,
    async_add_entities: AddEntitiesCallback,
) -> None:
    """Set up CWOC sensors from a config entry."""
    coordinator: CwocDataUpdateCoordinator = hass.data[DOMAIN][entry.entry_id]

    entities = []

    # Create fixed sensors
    for sensor_key, name, icon, data_key in FIXED_SENSORS:
        entities.append(
            CwocSensor(coordinator, entry, sensor_key, name, icon, data_key)
        )

    # Create dynamic tag sensors from coordinator data
    if coordinator.data and "tag_counts" in coordinator.data:
        for tag_name in coordinator.data["tag_counts"]:
            entities.append(
                CwocTagSensor(coordinator, entry, tag_name)
            )

    async_add_entities(entities, True)


class CwocSensor(CoordinatorEntity, SensorEntity):
    """A CWOC sensor entity backed by the DataUpdateCoordinator."""

    _attr_state_class = SensorStateClass.MEASUREMENT

    def __init__(
        self,
        coordinator: CwocDataUpdateCoordinator,
        entry: ConfigEntry,
        sensor_key: str,
        name: str,
        icon: str,
        data_key: str,
    ) -> None:
        """Initialize the sensor."""
        super().__init__(coordinator)
        self._data_key = data_key
        self._attr_name = name
        self._attr_icon = icon
        self._attr_unique_id = f"{entry.entry_id}_{sensor_key}"
        self._attr_has_entity_name = False

    @property
    def native_value(self):
        """Return the sensor value from coordinator data."""
        if self.coordinator.data is None:
            return None
        return self.coordinator.data.get(self._data_key, 0)


class CwocTagSensor(CoordinatorEntity, SensorEntity):
    """A dynamic CWOC tag count sensor."""

    _attr_state_class = SensorStateClass.MEASUREMENT
    _attr_icon = "mdi:tag"

    def __init__(
        self,
        coordinator: CwocDataUpdateCoordinator,
        entry: ConfigEntry,
        tag_name: str,
    ) -> None:
        """Initialize the tag sensor."""
        super().__init__(coordinator)
        self._tag_name = tag_name
        # Sanitize tag name for entity_id
        safe_name = tag_name.lower().replace(" ", "_").replace("/", "_")
        self._attr_name = f"CWOC Tag {tag_name}"
        self._attr_unique_id = f"{entry.entry_id}_tag_{safe_name}"
        self._attr_has_entity_name = False

    @property
    def native_value(self):
        """Return the tag count from coordinator data. Returns 0 if tag not present."""
        if self.coordinator.data is None:
            return 0
        tag_counts = self.coordinator.data.get("tag_counts", {})
        return tag_counts.get(self._tag_name, 0)
