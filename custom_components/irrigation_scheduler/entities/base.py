"""Bases de entidades: una por zona (dispositivo por zona) y globales."""

from __future__ import annotations

from homeassistant.helpers.device import async_entity_id_to_device
from homeassistant.helpers.device_registry import DeviceEntryType, DeviceInfo
from homeassistant.helpers.dispatcher import async_dispatcher_connect
from homeassistant.helpers.entity import Entity
from homeassistant.util import slugify

from ..const import DOMAIN, INSTALLATION_ID, SIGNAL_CONFIG, SIGNAL_STATE
from ..domain.model import Zone
from ..engine.manager import IrrigationManager
from .unique_ids import installation_uid, valve_uid, zone_uid


class IrrigationEntity(Entity):
    _attr_has_entity_name = True
    _attr_should_poll = False
    # señales que repintan la entidad
    _signals: tuple[str, ...] = (SIGNAL_STATE, SIGNAL_CONFIG)

    def __init__(self, manager: IrrigationManager) -> None:
        self._manager = manager

    async def async_added_to_hass(self) -> None:
        for signal in self._signals:
            self.async_on_remove(
                async_dispatcher_connect(self.hass, signal, self.async_write_ha_state)
            )


class ZoneEntity(IrrigationEntity):
    def __init__(self, manager: IrrigationManager, zone_id: str, key: str) -> None:
        super().__init__(manager)
        self._zone_id = zone_id
        self._attr_unique_id = zone_uid(zone_id, key)
        self._attr_translation_key = key
        self._attr_device_info = DeviceInfo(
            identifiers={(DOMAIN, zone_id)},
            name=manager.config.zones[zone_id].name,
            manufacturer="Irrigation Scheduler",
            entry_type=DeviceEntryType.SERVICE,
        )

    @property
    def zone(self) -> Zone | None:
        return self._manager.config.zones.get(self._zone_id)

    @property
    def available(self) -> bool:
        return self.zone is not None


class InstallationEntity(IrrigationEntity):
    def __init__(self, manager: IrrigationManager, key: str) -> None:
        super().__init__(manager)
        self._attr_unique_id = installation_uid(key)
        self._attr_translation_key = key
        self._attr_device_info = DeviceInfo(
            identifiers={(DOMAIN, INSTALLATION_ID)},
            name="Irrigation Scheduler",
            manufacturer="Irrigation Scheduler",
            entry_type=DeviceEntryType.SERVICE,
        )


def configured_valves(manager: IrrigationManager) -> set[tuple[str, str]]:
    """(zone_id, entity_id) de cada válvula configurada."""
    return {
        (zone_id, valve.entity_id)
        for zone_id, zone in manager.config.zones.items()
        for valve in zone.valves
    }


class ValveEntity(ZoneEntity):
    """Entidad de una válvula configurada, en el dispositivo de su switch (decisión 4).

    `object_prefix` es el entity_id propuesto sin sufijo, p. ej. «sensor.modo_riego».
    """

    def __init__(
        self, manager: IrrigationManager, zone_id: str, entity_id: str, key: str, object_prefix: str
    ) -> None:
        super().__init__(manager, zone_id, key)
        self._valve_id = entity_id
        # prefijo zone_id: borrar la zona la borra también (adapters/registry.remove_zone_entities)
        self._attr_unique_id = valve_uid(zone_id, key, entity_id)
        zone = manager.config.zones[zone_id]
        name = next((v.name for v in zone.valves if v.entity_id == entity_id), entity_id)
        # en el dispositivo de la switch; si no tiene, en el de la zona (decisión 4).
        # Con device_info None la plataforma usa device_entry (entity_platform.py)
        if device := async_entity_id_to_device(manager.hass, entity_id):
            self._attr_device_info = None
            self.device_entry = device
            name = device.name_by_user or device.name or name
        # entity_id propuesto: HA no le antepone el dispositivo (entity_registry.py:1360).
        # Solo vale al crearla; una entidad ya registrada conserva el suyo
        self.entity_id = f"{object_prefix}_{slugify(name)}"

    @property
    def available(self) -> bool:
        zone = self.zone
        return zone is not None and any(v.entity_id == self._valve_id for v in zone.valves)
