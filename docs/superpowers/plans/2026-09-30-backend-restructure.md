# Reestructuración del backend — plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ordenar `custom_components/irrigation_scheduler/` en carpetas por responsabilidad, partir `manager.py` sin cambiar el comportamiento y que el panel vea los cambios de estado sin esperar a la escritura en disco.

**Architecture:** primero una red de tests de caracterización en CI contra el código actual. Después limpieza, movimiento de ficheros con `git mv` y división de `manager.py` en `ValveSlots` (estado en tránsito) + servicios sin lock + fachada dueña del lock. Al final, escritura diferida del runtime con `Store.async_delay_save` y botón «procesando» en el panel.

**Tech Stack:** Python 3.14, Home Assistant 2026.9, `pytest-homeassistant-custom-component==0.13.367`, GitHub Actions, ruff; frontend Lit 3.3.3 + TypeScript 6 + Vite 8.

**Spec:** `docs/superpowers/specs/2026-09-30-backend-restructure-design.md`

## Global Constraints

- Rama `feat/incidents`. Un commit por tarea. Nunca commit en `main`. Push solo con confirmación del usuario.
- No cambian: claves de Store (`const.py:7-10`), `unique_id` de entidades, URL del bundle `/irrigation_scheduler/irrigation-scheduler.js`, `FRONTEND_FILE = "frontend/irrigation-scheduler.js"` relativo a `__init__.py`, mensajes WebSocket, servicios y la API pública del manager.
- En la raíz del paquete se quedan: `manifest.json`, `__init__.py`, `config_flow.py`, `const.py`, `binary_sensor.py`, `button.py`, `event.py`, `select.py`, `sensor.py`, `switch.py`, `services.yaml`, `strings.json`, `translations/`, `frontend/`.
- Comentarios en español; identificadores en inglés; módulos Python en `snake_case`.
- Tests en `<subcarpeta>/tests/`, nunca en una carpeta `tests/` global. Cada carpeta `tests/` lleva `__init__.py`.
- Gates locales en cada tarea: `uvx ruff check custom_components` y `py -3.14 -m compileall -q custom_components`. Tareas de frontend: `npx tsc --noEmit`, `npm run lint`, `npm run build` en `frontend/`.
- **pytest no corre en esta máquina** (sin `homeassistant`; `lru-dict` pide MSVC). Todo test se valida en CI. Esto incluye los tests de `ValveSlots`: el paquete importa HA en `__init__.py`, así que no hay tests «puros» ejecutables en local. Desviación respecto a la spec §4 fase 3, aceptada por esa razón.
- Una tarea con tests nuevos no se da por terminada hasta ver el CI en verde (push previa confirmación, o lote de tareas y un push).

---

## Mapa de ficheros

| Destino | Origen | Responsabilidad |
|---|---|---|
| `errors.py` | `manager.py:81-87,1392` | `ZoneDeleteError`, `IrrigationConfigEntry` |
| `domain/{model,runtime,schedule,rain,alerts,validation}.py` | raíz | Modelo y reglas, sin HA |
| `adapters/{store,valves,rain_source,notify,card_resource}.py` | raíz | I/O con HA |
| `adapters/registry.py` | `manager.py:1096-1136,1300-1302` | Registro de entidades y dispositivos |
| `api/{websocket,services}.py` | raíz | Entrada externa |
| `api/lookup.py` | `websocket.py:84-88`, `services.py:31-35` | Manager cargado |
| `api/schemas.py` | `websocket.py:18-67`, `services.py:14-28` | Schemas voluptuous |
| `api/snapshot.py` | `manager.py:1304-1315,1330-1389` | Snapshot para el panel |
| `entities/base.py` | `entity.py` | Bases de entidades |
| `entities/unique_ids.py` | nuevo | Formatos de `unique_id` |
| `entities/sync.py` | nuevo | Alta incremental de entidades |
| `engine/slots.py` | nuevo | `ValveSlots` |
| `engine/incidents.py` | `manager.py:435-463,670-708,884-937` | Alertas y push |
| `engine/rain_control.py` | `manager.py:90-96,511-708,1255-1291` | Lluvia |
| `engine/manual.py` | `manager.py:465-470,830-845` | Encendidas a mano, suministro |
| `engine/manager.py` | `manager.py` | Fachada con el lock |

---

## Fase 0 — red de seguridad

### Task 1: CI y primer test de caracterización

**Files:**
- Create: `.github/workflows/tests.yml`
- Modify: `pyproject.toml`
- Create: `custom_components/irrigation_scheduler/engine/__init__.py`
- Create: `custom_components/irrigation_scheduler/engine/tests/__init__.py`
- Create: `custom_components/irrigation_scheduler/engine/tests/conftest.py`
- Create: `custom_components/irrigation_scheduler/engine/tests/test_characterization.py`

**Interfaces:**
- Produces: fixtures `switches` (`FakeSwitches`), `manager` (`IrrigationManager` arrancado), helpers `add_zone(...)`, `at_local(...)`, `fire_at(...)`. Constantes de parcheo `VALVES_MODULE` y `RAIN_SOURCE_TARGET` en `conftest.py`: **único sitio** que cambia cuando se mueven módulos.

- [ ] **Step 1: workflow**

`.github/workflows/tests.yml`:

```yaml
name: tests

on:
  push:
    branches: [main, feat/**]
  pull_request:

jobs:
  backend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with:
          python-version: "3.14"
      - name: Dependencias
        run: pip install ruff "pytest-homeassistant-custom-component==0.13.367"
      - name: ruff
        run: ruff check custom_components
      - name: compileall
        run: python -m compileall -q custom_components
      - name: pytest
        run: pytest
```

- [ ] **Step 2: configuración de pytest**

Añadir al final de `pyproject.toml`:

```toml
[tool.pytest.ini_options]
testpaths = ["custom_components"]
pythonpath = ["."]
asyncio_mode = "auto"
asyncio_default_fixture_loop_scope = "function"
```

- [ ] **Step 3: paquetes vacíos**

`engine/__init__.py`: `"""Orquestación con estado: manager, huecos de válvula y servicios."""`
`engine/tests/__init__.py`: vacío.

- [ ] **Step 4: conftest**

`engine/tests/conftest.py`:

```python
"""Fixtures de los tests de caracterización del manager."""

from __future__ import annotations

import asyncio
from collections.abc import AsyncIterator
from datetime import datetime
from typing import Any

import pytest
from homeassistant.const import ATTR_ENTITY_ID, STATE_OFF, STATE_ON
from homeassistant.core import HomeAssistant, ServiceCall
from homeassistant.util import dt as dt_util
from pytest_homeassistant_custom_component.common import async_fire_time_changed

from custom_components.irrigation_scheduler.manager import IrrigationManager
from custom_components.irrigation_scheduler.store import IrrigationStore

# rutas que se parchean; al mover módulos solo cambia esto
VALVES_MODULE = "custom_components.irrigation_scheduler.valves"
RAIN_SOURCE_TARGET = "custom_components.irrigation_scheduler.manager"


@pytest.fixture(autouse=True)
def auto_enable_custom_integrations(enable_custom_integrations: None) -> None:
    return


@pytest.fixture(autouse=True)
def fast_valves(monkeypatch: pytest.MonkeyPatch) -> None:
    # sin la espera real de verificación (2 s por intento)
    monkeypatch.setattr(f"{VALVES_MODULE}.VERIFY_DELAY_S", 0)


class FakeSwitches:
    """Servicios switch.turn_on/turn_off que cambian el estado, con fallos y retención."""

    def __init__(self, hass: HomeAssistant) -> None:
        self.hass = hass
        self.fail_on: set[str] = set()
        self.fail_off: set[str] = set()
        # si está puesto, turn_on espera a que se libere: apertura en curso
        self.gate: asyncio.Event | None = None
        self.calls: list[tuple[str, str]] = []

    def add(self, entity_id: str, state: str = STATE_OFF) -> None:
        self.hass.states.async_set(entity_id, state)

    async def handle(self, call: ServiceCall) -> None:
        entity_id = call.data[ATTR_ENTITY_ID]
        turn_on = call.service == "turn_on"
        self.calls.append((call.service, entity_id))
        if turn_on and self.gate is not None:
            await self.gate.wait()
        if entity_id in (self.fail_on if turn_on else self.fail_off):
            return
        self.hass.states.async_set(entity_id, STATE_ON if turn_on else STATE_OFF)


@pytest.fixture
def switches(hass: HomeAssistant) -> FakeSwitches:
    fake = FakeSwitches(hass)
    hass.services.async_register("switch", "turn_on", fake.handle)
    hass.services.async_register("switch", "turn_off", fake.handle)
    return fake


async def start_manager(hass: HomeAssistant) -> IrrigationManager:
    manager = IrrigationManager(hass, "test_entry", IrrigationStore(hass))
    await manager.async_setup()
    await hass.async_block_till_done(wait_background_tasks=True)
    return manager


@pytest.fixture
async def manager(hass: HomeAssistant, switches: FakeSwitches) -> AsyncIterator[IrrigationManager]:
    started = await start_manager(hass)
    yield started
    started.async_shutdown()
    await hass.async_block_till_done(wait_background_tasks=True)


def zone_data(
    valves: list[str], *, start: str = "06:00", duration: int = 10, max_simultaneous: int = 1,
    rain_skip: bool = False, supply: dict[str, str] | None = None,
) -> dict[str, Any]:
    supply = supply or {}
    return {
        "name": "Huerto",
        "enabled": True,
        "mode": "manual",
        "days": [0, 1, 2, 3, 4, 5, 6],
        "start_times": [start],
        "max_simultaneous": max_simultaneous,
        "rain_skip": rain_skip,
        "valves": [
            {
                "entity_id": entity_id,
                "name": entity_id.split(".", 1)[1],
                "duration_min": duration,
                "start_times": [start],
                "enabled": True,
                "supply_sensor": supply.get(entity_id),
            }
            for entity_id in valves
        ],
    }


async def add_zone(manager: IrrigationManager, switches: FakeSwitches, valves: list[str], **kwargs: Any) -> str:
    for entity_id in valves:
        switches.add(entity_id)
    zone, issues = await manager.async_save_zone(zone_data(valves, **kwargs))
    assert not issues, issues
    assert zone is not None
    await manager.hass.async_block_till_done(wait_background_tasks=True)
    return zone.zone_id


def at_local(hour: int, minute: int, second: int = 0) -> datetime:
    """Hoy a esa hora local, en UTC."""
    today = dt_util.now().date()
    local = datetime(today.year, today.month, today.day, hour, minute, second, tzinfo=dt_util.get_default_time_zone())
    return dt_util.as_utc(local)


async def fire_at(hass: HomeAssistant, freezer: Any, when: datetime) -> None:
    freezer.move_to(when)
    async_fire_time_changed(hass, when)
    await hass.async_block_till_done(wait_background_tasks=True)
```

- [ ] **Step 5: primer test (bloque programado)**

`engine/tests/test_characterization.py`:

```python
"""Caracterización del manager: fija el comportamiento actual antes del refactor."""

from __future__ import annotations

from homeassistant.const import STATE_OFF, STATE_ON
from homeassistant.core import HomeAssistant

from custom_components.irrigation_scheduler.const import ORIGIN_SCHEDULED, STATUS_IDLE, STATUS_RUNNING

from .conftest import add_zone, at_local, fire_at


async def test_scheduled_block_opens_and_closes(hass: HomeAssistant, manager, switches, freezer) -> None:
    freezer.move_to(at_local(5, 0))
    zone_id = await add_zone(manager, switches, ["switch.v1"], start="06:00", duration=10)

    await fire_at(hass, freezer, at_local(6, 0))
    assert hass.states.get("switch.v1").state == STATE_ON
    assert manager.runtime.open_valves["switch.v1"].origin == ORIGIN_SCHEDULED
    assert manager.zone_status(zone_id) == STATUS_RUNNING

    await fire_at(hass, freezer, at_local(6, 10, 1))
    assert hass.states.get("switch.v1").state == STATE_OFF
    assert manager.runtime.open_valves == {}
    assert manager.zone_status(zone_id) == STATUS_IDLE
```

- [ ] **Step 6: gates locales**

Run: `uvx ruff check custom_components && py -3.14 -m compileall -q custom_components`
Expected: `All checks passed!` y sin salida de compileall.

- [ ] **Step 7: commit**

```bash
git add .github/workflows/tests.yml pyproject.toml custom_components/irrigation_scheduler/engine
git commit -m "test: CI y caracterización del bloque programado"
```

- [ ] **Step 8: CI**

Pedir confirmación de push. Tras `git push`, `gh run watch` hasta el final.
Expected: job `backend` en verde. Si falla por el entorno (fixtures, rutas), se corrige aquí antes de seguir: el resto del plan depende de esta red.

### Task 2: resto de la caracterización

**Files:**
- Modify: `custom_components/irrigation_scheduler/engine/tests/test_characterization.py`

**Interfaces:**
- Consumes: fixtures y helpers de Task 1.

- [ ] **Step 1: añadir los seis casos**

Añadir a los imports:

```python
import pytest
from pytest_homeassistant_custom_component.common import async_capture_events

from custom_components.irrigation_scheduler.const import (
    EVENT_BLOCK_SKIPPED,
    EVENT_NO_WATER,
    EVENT_VALVE_OVERRUN,
    RUNTIME_STORE_KEY,
    CONFIG_STORE_KEY,
    ZONE_DELETE_VALVES_ON,
)
from custom_components.irrigation_scheduler.manager import ZoneDeleteError

from .conftest import RAIN_SOURCE_TARGET, start_manager, zone_data
```

(`ZoneDeleteError` se importará de `errors` desde Task 4; ahí se actualiza.)

Casos:

```python
async def test_pause_while_opening(hass: HomeAssistant, manager, switches) -> None:
    await add_zone(manager, switches, ["switch.v1"])
    switches.gate = asyncio.Event()
    await manager.async_run_valve("switch.v1")
    await hass.async_block_till_done()
    # abriéndose: aún ocupa hueco
    assert [item["entity_id"] for item in manager.snapshot()["opening"]] == ["switch.v1"]

    await manager.async_pause_valve("switch.v1")
    # pausada: sale del snapshot aunque la llamada siga en curso
    assert manager.snapshot()["opening"] == []

    switches.gate.set()
    await hass.async_block_till_done(wait_background_tasks=True)
    assert hass.states.get("switch.v1").state == STATE_OFF
    assert manager.runtime.open_valves == {}
    assert manager.runtime.pending == []


async def test_no_water_closes_running_valve(hass: HomeAssistant, manager, switches) -> None:
    hass.states.async_set("binary_sensor.agua", STATE_OFF)
    await add_zone(manager, switches, ["switch.v1"], supply={"switch.v1": "binary_sensor.agua"})
    events = async_capture_events(hass, EVENT_NO_WATER)
    await manager.async_run_valve("switch.v1")
    await hass.async_block_till_done(wait_background_tasks=True)
    assert hass.states.get("switch.v1").state == STATE_ON

    hass.states.async_set("binary_sensor.agua", STATE_ON)
    await hass.async_block_till_done(wait_background_tasks=True)
    assert hass.states.get("switch.v1").state == STATE_OFF
    assert [event.data["closed"] for event in events] == [True]
    assert [item["entity_id"] for item in manager.snapshot()["no_water"]] == ["switch.v1"]


async def test_restart_with_overrun_valve(hass: HomeAssistant, switches, hass_storage, freezer) -> None:
    freezer.move_to(at_local(8, 0))
    config = zone_data(["switch.v1"])
    config["zone_id"] = "z1"
    hass_storage[CONFIG_STORE_KEY] = {
        "version": 1, "minor_version": 1, "key": CONFIG_STORE_KEY,
        "data": {"settings": {}, "zones": [config]},
    }
    hass_storage[RUNTIME_STORE_KEY] = {
        "version": 1, "minor_version": 1, "key": RUNTIME_STORE_KEY,
        "data": {
            "open_valves": [{
                "entity_id": "switch.v1", "zone_id": "z1", "origin": "manual",
                "started_at": at_local(6, 0).isoformat(), "ends_at": at_local(6, 10).isoformat(),
            }],
            "pending": [], "next_seq": 1, "last_alive": at_local(7, 59).isoformat(),
        },
    }
    switches.add("switch.v1", STATE_ON)
    events = async_capture_events(hass, EVENT_VALVE_OVERRUN)

    manager = await start_manager(hass)
    assert hass.states.get("switch.v1").state == STATE_OFF
    assert manager.runtime.open_valves == {}
    assert [event.data["entity_id"] for event in events] == ["switch.v1"]
    manager.async_shutdown()


async def test_manual_valve_turns_off_on_time(hass: HomeAssistant, manager, switches, freezer) -> None:
    freezer.move_to(at_local(9, 0))
    await add_zone(manager, switches, ["switch.v1"], duration=10)
    # encendida fuera de la integración
    hass.states.async_set("switch.v1", STATE_ON)
    await hass.async_block_till_done(wait_background_tasks=True)
    assert manager.valve_origin("switch.v1") == "external"

    await fire_at(hass, freezer, at_local(9, 10, 1))
    assert hass.states.get("switch.v1").state == STATE_OFF


async def test_rain_skip_blocks_the_block(hass: HomeAssistant, manager, switches, freezer, monkeypatch) -> None:
    async def past_rain(_hass, _entity_id, _hours):
        return 20.0, None

    async def forecast(_hass, _entity_id):
        return None, None

    monkeypatch.setattr(f"{RAIN_SOURCE_TARGET}.async_past_rain", past_rain)
    monkeypatch.setattr(f"{RAIN_SOURCE_TARGET}.async_forecast", forecast)
    freezer.move_to(at_local(5, 0))
    settings, issues = await manager.async_save_settings({"rain_sensor": "sensor.lluvia"})
    assert settings is not None, issues
    await add_zone(manager, switches, ["switch.v1"], start="06:00", rain_skip=True)
    events = async_capture_events(hass, EVENT_BLOCK_SKIPPED)

    await fire_at(hass, freezer, at_local(5, 50))
    assert len(events) == 1

    await fire_at(hass, freezer, at_local(6, 0))
    assert hass.states.get("switch.v1").state == STATE_OFF
    assert manager.runtime.pending == []
    assert manager.runtime.open_valves == {}


async def test_delete_zone_keeps_zone_when_turn_off_fails(hass: HomeAssistant, manager, switches) -> None:
    zone_id = await add_zone(manager, switches, ["switch.v1"])
    await manager.async_run_valve("switch.v1")
    await hass.async_block_till_done(wait_background_tasks=True)
    switches.fail_off.add("switch.v1")

    with pytest.raises(ZoneDeleteError) as err:
        await manager.async_delete_zone(zone_id)
    assert err.value.reason == ZONE_DELETE_VALVES_ON
    assert zone_id in manager.config.zones
    # el hueco se libera igualmente
    assert manager.runtime.open_valves == {}
```

Añadir `import asyncio` arriba.

- [ ] **Step 2: gates locales**

Run: `uvx ruff check custom_components && py -3.14 -m compileall -q custom_components`
Expected: sin errores.

- [ ] **Step 3: commit**

```bash
git add custom_components/irrigation_scheduler/engine/tests/test_characterization.py
git commit -m "test: caracterización de pausa, sin agua, arranque, manual, lluvia y borrado"
```

- [ ] **Step 4: CI en verde**

Push con confirmación; `gh run watch`. Si un caso falla, **se ajusta el test al comportamiento real**, nunca el código: el objetivo es fijar lo que hay. Anotar en el mensaje del commit de ajuste qué se descubrió.

---

## Fase 1 — limpieza sin cambio de comportamiento

### Task 3: código muerto

**Files:**
- Modify: `custom_components/irrigation_scheduler/schedule.py:44-47`
- Modify: `custom_components/irrigation_scheduler/rain.py:82-84`

- [ ] **Step 1: confirmar cero usos**

Run: `graft callers next_run --depth 1` y `graft callers is_rate_unit --depth 1`
Expected: ningún llamador. (`sensor.py:102,106` usa la clave `"next_run"` y `manager.zone_next_run`, no `schedule.next_run`.) Si aparece un llamador, parar y preguntar.

- [ ] **Step 2: borrar** las funciones `next_run` de `schedule.py` e `is_rate_unit` de `rain.py`, y los imports que queden sin uso (ruff los señala).

- [ ] **Step 3: gates** — ruff y compileall sin errores.

- [ ] **Step 4: commit** — `git commit -am "refactor: borra next_run e is_rate_unit sin uso"`

### Task 4: `errors.py`

**Files:**
- Create: `custom_components/irrigation_scheduler/errors.py`
- Modify: `manager.py` (quitar líneas 81-87 y 1392), `__init__.py:18`, `websocket.py:16`, `binary_sensor.py:14`, `button.py:12`, `event.py:24`, `select.py:13`, `sensor.py:16`, `switch.py:15`, `engine/tests/test_characterization.py`

**Interfaces:**
- Produces: `errors.ZoneDeleteError(reason: str, valves: list[str])`, `errors.IrrigationConfigEntry`.

- [ ] **Step 1: crear `errors.py`**

```python
"""Errores y tipos compartidos por plataformas, API y motor."""

from __future__ import annotations

from typing import TYPE_CHECKING

from homeassistant.config_entries import ConfigEntry
from homeassistant.exceptions import HomeAssistantError

if TYPE_CHECKING:
    from .manager import IrrigationManager


class ZoneDeleteError(HomeAssistantError):
    """El borrado de zona no sigue. `reason`: código WS; `valves`: nombres afectados."""

    def __init__(self, reason: str, valves: list[str]) -> None:
        super().__init__(reason)
        self.reason = reason
        self.valves = valves


# alias perezoso (PEP 695): no importa el manager en tiempo de ejecución
type IrrigationConfigEntry = ConfigEntry[IrrigationManager]
```

- [ ] **Step 2: actualizar imports**

- `manager.py`: borrar la clase y el alias; añadir `from .errors import ZoneDeleteError`; quitar `ConfigEntry` del import si queda sin uso.
- `__init__.py`: `from .errors import IrrigationConfigEntry` y `from .manager import IrrigationManager`.
- Plataformas: `from .errors import IrrigationConfigEntry` + `from .manager import IrrigationManager`.
- `websocket.py`: `from .errors import ZoneDeleteError`.
- Test: `from custom_components.irrigation_scheduler.errors import ZoneDeleteError`.

Run: `graft grep IrrigationConfigEntry` y `graft grep ZoneDeleteError` → ningún import desde `.manager`.

- [ ] **Step 3: gates** — ruff y compileall.
- [ ] **Step 4: commit** — `git commit -am "refactor: ZoneDeleteError e IrrigationConfigEntry a errors.py"`

### Task 5: `api/lookup.py`

**Files:**
- Create: `custom_components/irrigation_scheduler/api/__init__.py`, `api/lookup.py`
- Modify: `websocket.py:84-97,265-268`, `services.py:31-35`

**Interfaces:**
- Produces: `api.lookup.loaded_manager(hass) -> IrrigationManager | None`, `api.lookup.require_manager(hass) -> IrrigationManager` (lanza `ServiceValidationError` `not_loaded`).

- [ ] **Step 1: crear**

`api/__init__.py`: `"""Entrada externa: WebSocket, servicios y snapshot."""`

`api/lookup.py`:

```python
"""Acceso al manager de la entry cargada."""

from __future__ import annotations

from typing import TYPE_CHECKING

from homeassistant.config_entries import ConfigEntryState
from homeassistant.core import HomeAssistant
from homeassistant.exceptions import ServiceValidationError

from ..const import DOMAIN

if TYPE_CHECKING:
    from ..manager import IrrigationManager


def loaded_manager(hass: HomeAssistant) -> IrrigationManager | None:
    for entry in hass.config_entries.async_entries(DOMAIN):
        if entry.state is ConfigEntryState.LOADED:
            return entry.runtime_data
    return None


def require_manager(hass: HomeAssistant) -> IrrigationManager:
    if manager := loaded_manager(hass):
        return manager
    raise ServiceValidationError(translation_domain=DOMAIN, translation_key="not_loaded")
```

- [ ] **Step 2: usar**

- `websocket.py`: borrar `_loaded_manager`; `from .api.lookup import loaded_manager`; `_manager` y `forward()` llaman a `loaded_manager(hass)`. Quitar `ConfigEntryState` del import.
- `services.py`: borrar `_manager`; `from .api.lookup import require_manager`; cada handler usa `require_manager(hass)`. Quitar imports sin uso.

- [ ] **Step 3: gates** — ruff y compileall.
- [ ] **Step 4: commit** — `git commit -am "refactor: un solo lookup del manager para WS y servicios"`

### Task 6: `api/schemas.py`

**Files:**
- Create: `custom_components/irrigation_scheduler/api/schemas.py`
- Modify: `websocket.py:18-67`, `services.py:14-28`

- [ ] **Step 1: mover sin tocar** `VALVE_SCHEMA`, `ZONE_SCHEMA`, `ALERT_SCHEMA`, `SETTINGS_SCHEMA` (de `websocket.py`) y `RUN_ZONE_SCHEMA`, `RUN_VALVE_SCHEMA`, `STOP_SCHEMA`, `PAUSE_VALVE_SCHEMA`, `SET_VALVE_ENABLED_SCHEMA`, `SET_ZONE_ENABLED_SCHEMA` (de `services.py`) a `api/schemas.py`, con cabecera `"""Schemas voluptuous de WebSocket y servicios."""` y los imports que necesitan (`voluptuous as vol`, `cv`, `..domain`/`..alerts` `ALERT_TYPES, PRIORITIES`, `..const` `MODES, SENSOR_KINDS`). No se unifican validadores: `cv.boolean` y `bool` aceptan entradas distintas y cambiarlo cambiaría la API.
- [ ] **Step 2:** `websocket.py` y `services.py` importan los schemas de `.api.schemas`. Borrar imports sin uso.
- [ ] **Step 3: gates.**
- [ ] **Step 4: commit** — `git commit -am "refactor: schemas de WS y servicios en api/schemas.py"`

### Task 7: `entities/unique_ids.py` y `entities/sync.py`

**Files:**
- Create: `entities/__init__.py`, `entities/unique_ids.py`, `entities/sync.py`, `entities/tests/__init__.py`, `entities/tests/test_entities.py`
- Modify: `entity.py:36,57,88`, `manager.py:1115,1124-1128,1307-1311`, `sensor.py:19-68`, `event.py:27-59`, `binary_sensor.py:18-39`, `button.py`, `select.py`, `switch.py`

**Interfaces:**
- Produces:
  - `zone_uid(zone_id: str, key: str) -> str` → `f"{zone_id}_{key}"`
  - `installation_uid(key: str) -> str` → `f"{INSTALLATION_ID}_{key}"`
  - `valve_uid(zone_id: str, key: str, entity_id: str) -> str` → `f"{zone_id}_{key}_{entity_id}"`
  - `KnownSet[T].sync(current: Iterable[T]) -> list[T]`
  - `on_zones(hass, entry, manager, add_zone: Callable[[str], None]) -> None`

- [ ] **Step 1: test que falla**

`entities/tests/test_entities.py`:

```python
"""Formatos de unique_id y alta incremental."""

from custom_components.irrigation_scheduler.entities.sync import KnownSet
from custom_components.irrigation_scheduler.entities.unique_ids import installation_uid, valve_uid, zone_uid


def test_unique_id_formats_are_stable() -> None:
    # cambiar un formato duplica entidades en instalaciones existentes
    assert zone_uid("z1", "status") == "z1_status"
    assert installation_uid("alerts") == "installation_alerts"
    assert valve_uid("z1", "valve_mode", "switch.v1") == "z1_valve_mode_switch.v1"


def test_known_set_returns_only_new_and_forgets_removed() -> None:
    known: KnownSet[str] = KnownSet()
    assert known.sync(["a", "b"]) == ["a", "b"]
    assert known.sync(["a", "b", "c"]) == ["c"]
    assert known.sync(["a"]) == []
    # «b» se olvidó: si vuelve, es nueva
    assert known.sync(["a", "b"]) == ["b"]
```

- [ ] **Step 2: implementar**

`entities/__init__.py`: `"""Bases y utilidades de las entidades de las plataformas."""`

`entities/unique_ids.py`:

```python
"""Formatos de unique_id. No cambiar: el registro de HA los usa como clave."""

from __future__ import annotations

from ..const import INSTALLATION_ID


def zone_uid(zone_id: str, key: str) -> str:
    return f"{zone_id}_{key}"


def installation_uid(key: str) -> str:
    return f"{INSTALLATION_ID}_{key}"


def valve_uid(zone_id: str, key: str, entity_id: str) -> str:
    # prefijo zone_id: borrar la zona la borra también
    return f"{zone_id}_{key}_{entity_id}"
```

`entities/sync.py`:

```python
"""Alta incremental de entidades cuando cambia la configuración."""

from __future__ import annotations

from collections.abc import Callable, Hashable, Iterable
from typing import TYPE_CHECKING

from homeassistant.core import HomeAssistant, callback
from homeassistant.helpers.dispatcher import async_dispatcher_connect

from ..const import SIGNAL_ZONE_ADDED

if TYPE_CHECKING:
    from ..errors import IrrigationConfigEntry
    from ..manager import IrrigationManager


class KnownSet[T: Hashable]:
    """Recuerda qué ya tiene entidad. Las quitadas las borra el manager; aquí solo se olvidan."""

    def __init__(self) -> None:
        self._known: set[T] = set()

    def sync(self, current: Iterable[T]) -> list[T]:
        """Devuelve, en el orden de `current`, las que aún no tienen entidad."""
        items = list(current)
        self._known.intersection_update(items)
        new = [item for item in items if item not in self._known]
        self._known.update(new)
        return new


def on_zones(
    hass: HomeAssistant,
    entry: IrrigationConfigEntry,
    manager: IrrigationManager,
    add_zone: Callable[[str], None],
) -> None:
    """Llama a `add_zone` con cada zona existente y con cada alta posterior."""
    for zone_id in manager.config.zones:
        add_zone(zone_id)
    entry.async_on_unload(async_dispatcher_connect(hass, SIGNAL_ZONE_ADDED, callback(add_zone)))
```

- [ ] **Step 3: usar**

- `entity.py`: las tres asignaciones de `_attr_unique_id` usan `zone_uid`, `installation_uid`, `valve_uid`.
- `manager.py`: `_remove_valve_entities` usa `valve_uid(zone_id, key, entity_id)`; `_remove_rain_entities` usa `installation_uid("rain_past")`, `installation_uid("rain_forecast")`, `zone_uid(zone_id, "rain_skip_next")`; `_history_entities` usa `zone_uid(zone.zone_id, "alerts")`, `valve_uid(zone.zone_id, "valve_mode", valve.entity_id)`, `valve_uid(zone.zone_id, "valve_alerts", valve.entity_id)`; `snapshot` usa `installation_uid("alerts")`.
- `sensor.py`: `valves_known = KnownSet()`; en `sync_valves`: `new = valves_known.sync(sorted(configured_valves(manager)))`. `rain_known = KnownSet()`; en `sync_rain`: `new = rain_known.sync(sorted(wanted))`. Bloque `for zone_id in ...: add_zone(zone_id)` + `async_dispatcher_connect(... SIGNAL_ZONE_ADDED, add_zone)` → `on_zones(hass, entry, manager, add_zone)` (mantener `async_add_entities([ActiveValvesSensor(manager)])` en su sitio).
- `event.py`: `known = KnownSet()`; `new = known.sync(sorted(configured_valves(manager)))`. El alta inicial de zonas se mantiene en la misma llamada `async_add_entities` junto a `InstallationAlertsEvent`; solo el `async_dispatcher_connect(SIGNAL_ZONE_ADDED...)` queda igual (no usa `on_zones` porque el alta inicial va agrupada).
- `binary_sensor.py`: `known = KnownSet()`; `new = known.sync([zone_id for zone_id in manager.config.zones if zone_id in wanted])`.
- `button.py`, `select.py`, `switch.py`: bucle + connect → `on_zones(hass, entry, manager, add_zone)`. En `button.py` el `async_add_entities([StopAllButton(manager)])` se queda entre medias como ahora.

`callback(add_zone)` en `on_zones`: las funciones ya llevan `@callback`; volver a decorar no cambia nada.

- [ ] **Step 4: gates** — ruff y compileall.
- [ ] **Step 5: commit** — `git add -A custom_components && git commit -m "refactor: unique_id y alta incremental de entidades centralizados"`
- [ ] **Step 6: CI** — push con confirmación (o agrupar con Task 3-6); tests nuevos y de caracterización en verde.

---

## Fase 2 — carpetas

Regla de las tres tareas: `git mv`, luego imports relativos (`.x` → `..x` dentro de la subcarpeta; `.x` → `.carpeta.x` desde la raíz), luego `VALVES_MODULE`/`RAIN_SOURCE_TARGET` del `conftest.py` si procede. Localizar importadores con `graft callers <módulo>` o `graft grep "from .<módulo> import"`.

### Task 8: `domain/`

**Files:**
- Move: `model.py`, `runtime.py`, `schedule.py`, `rain.py`, `alerts.py`, `validation.py` → `domain/`
- Create: `domain/__init__.py` (`"""Modelo y reglas del riego. Sin Home Assistant."""`)
- Modify: importadores (según §«Imports internos»: `manager.py`, `store.py`, `notify.py`, `rain_source.py`, `websocket.py` o `api/schemas.py`, `event.py`, `binary_sensor.py`, `entity.py`, `validation.py`…)

- [ ] **Step 1:** `mkdir domain && git mv custom_components/irrigation_scheduler/{model,runtime,schedule,rain,alerts,validation}.py custom_components/irrigation_scheduler/domain/`
- [ ] **Step 2:** dentro de `domain/`, `from .const` → `from ..const`; imports entre ellos (`.model`, `.alerts`, `.rain`) se quedan. Fuera: `from .model` → `from .domain.model`, etc.
- [ ] **Step 3: gates** — ruff y compileall. `graft grep "from .model import"` debe dar solo resultados dentro de `domain/`.
- [ ] **Step 4: commit** — `git add -A custom_components && git commit -m "refactor: modelo y reglas a domain/"`

### Task 9: `adapters/`

**Files:**
- Move: `store.py`, `valves.py`, `rain_source.py`, `notify.py`, `card_resource.py` → `adapters/`
- Create: `adapters/__init__.py` (`"""I/O con Home Assistant: Store, switch, lluvia, notificaciones y Lovelace."""`)
- Modify: `engine/tests/conftest.py` → `VALVES_MODULE = "custom_components.irrigation_scheduler.adapters.valves"` y el import de `IrrigationStore`.

- [ ] **Step 1:** `git mv` de los cinco ficheros.
- [ ] **Step 2:** imports: dentro de `adapters/`, `.const`/`.model`/`.rain`/`.alerts` → `..const`/`..domain.model`/`..domain.rain`/`..domain.alerts`. Fuera: `.store` → `.adapters.store`, etc.
- [ ] **Step 3:** `notify.py` lee textos de traducción: comprobar que no usa `Path(__file__)` para localizar `translations/`. Run: `graft grep "__file__"`. Si lo usa, subir un nivel (`Path(__file__).parent.parent`).
- [ ] **Step 4: gates.**
- [ ] **Step 5: commit** — `git add -A custom_components && git commit -m "refactor: I/O con HA a adapters/"`

### Task 10: `api/` y `entities/`

**Files:**
- Move: `websocket.py`, `services.py` → `api/`; `entity.py` → `entities/base.py`
- Modify: `__init__.py`, plataformas, `api/lookup.py`, `api/schemas.py`, `entities/sync.py`

- [ ] **Step 1:** `git mv .../websocket.py .../api/websocket.py`, `git mv .../services.py .../api/services.py`, `git mv .../entity.py .../entities/base.py`.
- [ ] **Step 2:** imports: `__init__.py` → `from .api.services import async_register_services`, `from .api.websocket import async_register_websocket`. Plataformas → `from .entities.base import ...`. Dentro de `api/` y `entities/`, `.const` → `..const`, `.api.lookup` → `.lookup`, etc. El comentario de `entities/base.py` que cita `manager._remove_zone_entities` se actualiza a la ruta nueva cuando exista (Task 15).
- [ ] **Step 3: gates.**
- [ ] **Step 4: commit** — `git add -A custom_components && git commit -m "refactor: WS y servicios a api/, bases de entidad a entities/"`
- [ ] **Step 5: CI** — push con confirmación; todo en verde antes de la fase 3.

---

## Fase 3 — partir `manager.py`

### Task 11: `ValveSlots`

**Files:**
- Create: `engine/slots.py`, `engine/tests/test_slots.py`

**Interfaces:**
- Consumes: `domain.runtime.RuntimeState`, `Job`, `OpenValve`.
- Produces: clase `ValveSlots` con:
  - atributo `runtime: RuntimeState`
  - `reserve_startable(zone_limits: dict[str, int], global_limit: int | None) -> list[Job]`
  - `finish_opening(entity_id: str) -> bool` (devuelve si estaba cancelada)
  - `opened(job: Job, started: datetime) -> OpenValve`
  - `begin_close(entity_id: str) -> bool`
  - `closed(entity_id: str) -> OpenValve | None`
  - `begin_manual_close(entity_ids: Iterable[str]) -> None`
  - `end_manual_close(entity_id: str) -> None`
  - `cancel(match: Callable[[str, str], bool]) -> list[str]` (devuelve las abiertas que empiezan a cerrarse)
  - `drop_pending(keep: Callable[[Job], bool]) -> None`
  - `prune_batches(zone_ids: Collection[str]) -> None`
  - vistas: `busy() -> set[str]`, `reserved() -> dict[str, str]`, `visible_opening() -> dict[str, str]`, `durations() -> dict[str, tuple[str, int]]`, `origin(entity_id) -> str | None`, `is_cancelled(entity_id) -> bool`, `is_closing(entity_id) -> bool`
  - constante de módulo `MUTATORS: frozenset[str]` con los nombres de los métodos que modifican estado.

- [ ] **Step 1: tests que fallan**

`engine/tests/test_slots.py`:

```python
"""ValveSlots: único dueño del estado en tránsito."""

from datetime import UTC, datetime

from custom_components.irrigation_scheduler.domain.runtime import RuntimeState
from custom_components.irrigation_scheduler.engine.slots import ValveSlots

NOW = datetime(2026, 9, 30, 6, 0, tzinfo=UTC)


def slots_with(*jobs: tuple[str, str]) -> ValveSlots:
    runtime = RuntimeState()
    for zone_id, entity_id in jobs:
        runtime.enqueue(zone_id, entity_id, 600, origin="manual")
    return ValveSlots(runtime)


def test_reserve_respects_zone_limit_and_counts_opening() -> None:
    slots = slots_with(("z1", "switch.a"), ("z1", "switch.b"))
    assert [job.entity_id for job in slots.reserve_startable({"z1": 1}, None)] == ["switch.a"]
    # «a» abriéndose ocupa el hueco de la zona
    assert slots.reserve_startable({"z1": 1}, None) == []
    assert slots.reserved() == {"switch.a": "z1"}
    assert [job.entity_id for job in slots.runtime.pending] == ["switch.b"]


def test_open_then_close_frees_slot() -> None:
    slots = slots_with(("z1", "switch.a"))
    (job,) = slots.reserve_startable({"z1": 1}, None)
    assert slots.finish_opening("switch.a") is False
    valve = slots.opened(job, NOW)
    assert slots.runtime.open_valves["switch.a"] is valve
    assert slots.runtime.batch_started == {"z1": NOW}
    assert slots.begin_close("switch.a") is True
    # dos cierres a la vez no
    assert slots.begin_close("switch.a") is False
    assert slots.busy() == {"switch.a"}
    assert slots.closed("switch.a") is valve
    assert slots.busy() == set()


def test_cancel_marks_opening_and_closes_open() -> None:
    slots = slots_with(("z1", "switch.a"), ("z1", "switch.b"), ("z2", "switch.c"))
    (job_a,) = slots.reserve_startable({"z1": 1, "z2": 0}, None)
    slots.finish_opening("switch.a")
    slots.opened(job_a, NOW)
    (job_b,) = slots.reserve_startable({"z1": 2, "z2": 0}, None)
    assert job_b.entity_id == "switch.b"

    closing = slots.cancel(lambda zone_id, _entity: zone_id == "z1")
    assert closing == ["switch.a"]
    assert slots.is_cancelled("switch.b")
    assert slots.visible_opening() == {}
    assert slots.reserved() == {"switch.b": "z1"}
    # la cola de otras zonas no se toca
    assert [job.entity_id for job in slots.runtime.pending] == ["switch.c"]
    assert slots.finish_opening("switch.b") is True
    assert not slots.is_cancelled("switch.b")


def test_prune_batches_keeps_active_zones() -> None:
    slots = slots_with(("z2", "switch.c"))
    slots.runtime.batch_started = {"z1": NOW, "z2": NOW, "gone": NOW}
    slots.prune_batches({"z1", "z2"})
    # z1 sin actividad, gone borrada; z2 tiene cola
    assert slots.runtime.batch_started == {"z2": NOW}


def test_manual_close_marks_busy() -> None:
    slots = ValveSlots(RuntimeState())
    slots.begin_manual_close(["switch.m"])
    assert slots.is_closing("switch.m") and slots.busy() == {"switch.m"}
    slots.end_manual_close("switch.m")
    assert slots.busy() == set()
```

- [ ] **Step 2: implementar**

`engine/slots.py`:

```python
"""Huecos de válvula: cola, abiertas y estados en tránsito (03 §3).

Único que modifica `pending`, `open_valves`, `batch_started` y los estados en tránsito.
Sin HA ni asyncio. Quien lo usa debe tener el lock del manager para llamar a los MUTATORS.
"""

from __future__ import annotations

from collections.abc import Callable, Collection, Iterable
from datetime import datetime, timedelta

from ..domain.runtime import Job, OpenValve, RuntimeState

MUTATORS = frozenset(
    {
        "reserve_startable",
        "finish_opening",
        "opened",
        "begin_close",
        "closed",
        "begin_manual_close",
        "end_manual_close",
        "cancel",
        "drop_pending",
        "prune_batches",
    }
)


class ValveSlots:
    def __init__(self, runtime: RuntimeState) -> None:
        self.runtime = runtime
        # abriéndose: entity_id -> zone_id; ocupan su hueco de zona y global
        self._opening: dict[str, str] = {}
        # duración (s) de cada apertura, para estimar el fin del lote
        self._opening_s: dict[str, int] = {}
        # origen de cada apertura: el sensor «Modo riego» lo muestra antes del turn_on
        self._opening_origin: dict[str, str] = {}
        self._closing: set[str] = set()
        # pausadas mientras abrían: al terminar el turn_on se cierran
        self._cancelled: set[str] = set()

    # ---------- transiciones ----------

    def reserve_startable(self, zone_limits: dict[str, int], global_limit: int | None) -> list[Job]:
        """Saca de la cola lo que cabe y lo marca como abriéndose (una sola pasada)."""
        jobs = self.runtime.startable_jobs(zone_limits, global_limit, reserved=self._opening)
        for job in jobs:
            self.runtime.pending.remove(job)
            self._opening[job.entity_id] = job.zone_id
            self._opening_s[job.entity_id] = job.duration_s
            self._opening_origin[job.entity_id] = job.origin
        return jobs

    def finish_opening(self, entity_id: str) -> bool:
        """Termina la apertura (bien o mal). Devuelve si se pausó mientras abría."""
        self._opening.pop(entity_id, None)
        self._opening_s.pop(entity_id, None)
        self._opening_origin.pop(entity_id, None)
        cancelled = entity_id in self._cancelled
        self._cancelled.discard(entity_id)
        return cancelled

    def opened(self, job: Job, started: datetime) -> OpenValve:
        valve = OpenValve(
            job.entity_id, job.zone_id, started, started + timedelta(seconds=job.duration_s), job.origin
        )
        self.runtime.open_valves[job.entity_id] = valve
        self.runtime.batch_started.setdefault(job.zone_id, started)
        return valve

    def begin_close(self, entity_id: str) -> bool:
        """Marca la válvula como cerrándose; sigue en `open_valves` y ocupa hueco."""
        if entity_id not in self.runtime.open_valves or entity_id in self._closing:
            return False
        self._closing.add(entity_id)
        return True

    def closed(self, entity_id: str) -> OpenValve | None:
        """Libera el hueco tras el turn_off, haya ido bien o no."""
        self._closing.discard(entity_id)
        return self.runtime.open_valves.pop(entity_id, None)

    def begin_manual_close(self, entity_ids: Iterable[str]) -> None:
        """Encendidas a mano que se apagan: no ocupan hueco, solo se marcan."""
        self._closing.update(entity_ids)

    def end_manual_close(self, entity_id: str) -> None:
        self._closing.discard(entity_id)

    def cancel(self, match: Callable[[str, str], bool]) -> list[str]:
        """Pausa (03 §4): vacía la cola, cancela aperturas y empieza a cerrar las abiertas."""
        self.runtime.pending = [job for job in self.runtime.pending if not match(job.zone_id, job.entity_id)]
        closing = [
            entity_id
            for entity_id, valve in list(self.runtime.open_valves.items())
            if match(valve.zone_id, entity_id) and self.begin_close(entity_id)
        ]
        for entity_id, zone_id in self._opening.items():
            if match(zone_id, entity_id):
                self._cancelled.add(entity_id)
        return closing

    def drop_pending(self, keep: Callable[[Job], bool]) -> None:
        self.runtime.pending = [job for job in self.runtime.pending if keep(job)]

    def prune_batches(self, zone_ids: Collection[str]) -> None:
        """Cierra el lote de las zonas sin abiertas, abriéndose ni en cola, o ya borradas."""
        active = (
            {valve.zone_id for valve in self.runtime.open_valves.values()}
            | set(self._opening.values())
            | {job.zone_id for job in self.runtime.pending}
        )
        for zone_id in list(self.runtime.batch_started):
            if zone_id not in active or zone_id not in zone_ids:
                del self.runtime.batch_started[zone_id]

    # ---------- vistas (sin cambios de estado) ----------

    def busy(self) -> set[str]:
        """Switch en manos de la integración: abiertas, abriéndose o cerrándose."""
        return set(self.runtime.open_valves) | set(self._opening) | self._closing

    def reserved(self) -> dict[str, str]:
        """Todas las aperturas, también las pausadas: aún ocupan hueco."""
        return dict(self._opening)

    def visible_opening(self) -> dict[str, str]:
        """Aperturas no pausadas: las que el panel muestra como «Encendiendo»."""
        return {e: z for e, z in self._opening.items() if e not in self._cancelled}

    def durations(self) -> dict[str, tuple[str, int]]:
        return {e: (z, self._opening_s.get(e, 0)) for e, z in self._opening.items()}

    def origin(self, entity_id: str) -> str | None:
        return self._opening_origin.get(entity_id)

    def is_cancelled(self, entity_id: str) -> bool:
        return entity_id in self._cancelled

    def is_closing(self, entity_id: str) -> bool:
        return entity_id in self._closing
```

Nota: `engine/__init__.py` no debe importar nada de HA para no romper este test si algún día se ejecuta aislado; ya es solo un docstring.

- [ ] **Step 3: gates** — ruff y compileall.
- [ ] **Step 4: commit** — `git add custom_components/irrigation_scheduler/engine && git commit -m "feat: ValveSlots, dueño del estado en tránsito"`
- [ ] **Step 5: CI** — `test_slots.py` en verde.

### Task 12: el manager usa `ValveSlots` + test del lock

**Files:**
- Modify: `manager.py` (líneas 105-125 `__init__`, 142-145, 180-271, 393-509, 727-882, 939-953, 1020-1045, 1175-1208, 1244-1253, 1317-1389)
- Create: `engine/tests/test_lock.py`

**Interfaces:**
- Consumes: `ValveSlots` de Task 11.
- Produces: `IrrigationManager.runtime` pasa a ser propiedad de solo lectura (`return self._slots.runtime`). Renombrados: `_mark_open` → `_mark_open_locked`, `_prune_batches` desaparece (`self._slots.prune_batches(self.config.zones)`), `_manual_on` sigue igual pero usa `self._slots.busy()`.

- [ ] **Step 1: test del lock que falla**

`engine/tests/test_lock.py`:

```python
"""Las transiciones de ValveSlots solo se llaman con el lock del manager tomado."""

from __future__ import annotations

import ast
from pathlib import Path

from custom_components.irrigation_scheduler.engine.slots import MUTATORS

MANAGER = Path(__file__).parents[1] / "manager.py"


def _holds_lock(node: ast.AST, parents: dict[ast.AST, ast.AST]) -> bool:
    while node in parents:
        node = parents[node]
        if isinstance(node, ast.AsyncWith) and any(
            ast.unparse(item.context_expr) == "self._lock" for item in node.items
        ):
            return True
        if isinstance(node, ast.FunctionDef | ast.AsyncFunctionDef):
            return node.name.endswith("_locked")
    return False


def test_slot_mutators_run_under_lock() -> None:
    tree = ast.parse(MANAGER.read_text(encoding="utf-8"))
    parents = {child: parent for parent in ast.walk(tree) for child in ast.iter_child_nodes(parent)}
    offenders = [
        f"{MANAGER.name}:{node.lineno} {node.func.attr}"
        for node in ast.walk(tree)
        if isinstance(node, ast.Call)
        and isinstance(node.func, ast.Attribute)
        and node.func.attr in MUTATORS
        and ast.unparse(node.func.value) == "self._slots"
        and not _holds_lock(node, parents)
    ]
    assert offenders == []
    # sin llamadas a slots el test no prueba nada
    assert "self._slots." in MANAGER.read_text(encoding="utf-8")
```

Mientras `manager.py` siga en la raíz, `MANAGER` apunta a `engine/manager.py`, que no existe: el test falla. Hasta Task 16 se apunta temporalmente a `Path(__file__).parents[2] / "manager.py"`; Task 16 lo cambia a `parents[1]`.

- [ ] **Step 2: sustituir el estado en tránsito**

En `manager.py`:

1. `__init__`: borrar `self.runtime = RuntimeState()`, `_opening`, `_opening_s`, `_opening_origin`, `_closing`, `_cancelled` y su comentario; añadir

```python
        # huecos de válvula: cola, abiertas y estados en tránsito; mutar solo con el lock
        self._slots = ValveSlots(RuntimeState())
```

y la propiedad

```python
    @property
    def runtime(self) -> RuntimeState:
        return self._slots.runtime
```

2. `async_setup`: `self.config, runtime = await self._store.async_load()` y `self._slots = ValveSlots(runtime)`.
3. `_async_recover` (líneas 184-201): `self.runtime.open_valves.pop(valve.entity_id)` → `self._slots.closed(valve.entity_id)`.
4. `_async_heartbeat`: la condición de `overdue` usa `self._begin_close_locked(entity_id)` (sigue igual, ver punto 7); `self._closing.update(...)` → `self._slots.begin_manual_close(entity_id for _z, entity_id, _m in manual)`.
5. `_async_valve_state_changed` y `_async_no_water`: `entity_id not in self._cancelled` → `not self._slots.is_cancelled(entity_id)`; `entity_id not in self._closing` → `not self._slots.is_closing(entity_id)`; `entity_id in self._opening` → `entity_id in self._slots.reserved()`.
6. `_async_dispatch_locked`:

```python
        limits = {zone_id: zone.max_simultaneous for zone_id, zone in self.config.zones.items()}
        jobs = self._slots.reserve_startable(limits, self.config.settings.global_max_valves)
        if not jobs:
            return
        for job in jobs:
            self._spawn(self._async_open_job(job), f"irrigation_open_{job.entity_id}")
        await self._async_persist()
```

7. `_async_open_job`: `cancelled=lambda: self._slots.is_cancelled(job.entity_id)`; dentro del lock:

```python
            cancelled = self._slots.finish_opening(job.entity_id)
            if ok:
                self._mark_open_locked(job)
                if cancelled:
                    closing = self._begin_close_locked(job.entity_id)
```

8. `_mark_open` → `_mark_open_locked`:

```python
    def _mark_open_locked(self, job: Job) -> None:
        """Requiere el lock. Registra la válvula abierta y, si procede, programa su cierre."""
        valve = self._slots.opened(job, dt_util.utcnow())
        if not self._stopping:
            self._schedule_close(valve)
```

9. `_begin_close_locked`:

```python
        if not self._slots.begin_close(entity_id):
            return False
        if unsub := self._close_unsubs.pop(entity_id, None):
            unsub()
        return True
```

10. `_async_finish_close`: `self._closing.discard(entity_id)` + `pop` → `valve = self._slots.closed(entity_id)`.
11. `_manual_on`: `busy = self._slots.busy()`.
12. `_async_manual_due`: `self._closing.add(entity_id)` → `self._slots.begin_manual_close([entity_id])`.
13. `_async_close_manual`: `self._closing.discard(entity_id)` → `self._slots.end_manual_close(entity_id)`.
14. `_async_persist`: `self._prune_batches()` → `self._slots.prune_batches(self.config.zones)`. Borrar `_prune_batches`. `_async_persist` se llama siempre con el lock: renombrarlo **no** hace falta porque `prune_batches` va dentro de él; añadir el sufijo `_locked` para que el test lo acepte: `_async_persist` → `_async_persist_locked` en todas sus llamadas (`graft grep _async_persist`).
15. `async_save_zone` (1001-1005): `self._slots.drop_pending(lambda job: job.zone_id != zone.zone_id or job.entity_id in kept)`.
16. `async_delete_zone` (1030-1034): `busy += [e for e, z in self._slots.reserved().items() if z == zone_id]`; `self._slots.drop_pending(lambda job: job.zone_id != zone_id)`.
17. `_async_pause`:

```python
        async with self._lock:
            closing = self._slots.cancel(match)
            for entity_id in closing:
                if unsub := self._close_unsubs.pop(entity_id, None):
                    unsub()
            manual = [
                (zone.zone_id, valve.entity_id)
                for zone, valve, _since in self._manual_on()
                if match(zone.zone_id, valve.entity_id)
            ]
            self._slots.begin_manual_close(entity_id for _zone_id, entity_id in manual)
            await self._async_persist_locked()
            if not closing:
                await self._async_dispatch_locked()
```

Orden: antes, `_begin_close_locked` quitaba el temporizador **antes** de cancelar las aperturas; ahora se quita justo después, dentro del mismo lock y sin `await` en medio. Equivalente.

18. `zone_status`: `opening = self._slots.visible_opening().values()`.
19. `valve_origin`: `self._opening_origin.get(entity_id)` → `self._slots.origin(entity_id)`.
20. `snapshot`: `opening=self._slots.durations()`; `"opening": [{"entity_id": e, "zone_id": z} for e, z in self._slots.visible_opening().items()]`.
21. `async_recover` y `_async_evaluate_lot` siguen escribiendo `self.runtime.rain_decisions`, `rain_episodes`, `last_alive`: son de lluvia y latido, no de huecos, y están bajo el lock. Fuera del alcance de `ValveSlots`.

Tras el cambio: `graft grep "_opening\b\|_closing\b\|_cancelled\b\|_opening_s\|_opening_origin" manager.py` → ningún resultado. `graft grep "runtime.pending\|runtime.open_valves\[" manager.py` → solo lecturas.

- [ ] **Step 3: gates** — ruff y compileall.
- [ ] **Step 4: commit** — `git add -A custom_components && git commit -m "refactor: el manager delega el estado en tránsito en ValveSlots"`
- [ ] **Step 5: CI** — caracterización + `test_slots` + `test_lock` en verde.

### Task 13: `engine/incidents.py`

**Files:**
- Create: `engine/incidents.py`
- Modify: `manager.py` (435-463, 670-708, 884-937)

**Interfaces:**
- Produces: clase `Incidents(hass: HomeAssistant, config: Callable[[], Config], rain_unit: Callable[[], str])` con:
  - `async alert(alert_id, zone_id, entity_id, event_type, data, *, push=True, **push_fields) -> None` (cuerpo literal de `_async_alert`)
  - `async valve_error(zone_id, entity_id, turning_on: bool) -> None` (cuerpo de `_async_valve_error`)
  - `async push_switched(entity_id, kind, origin, seconds=None) -> None` (cuerpo de `_async_push_switched`)
  - `async push_rain_skipped(opened: list[tuple[Zone, str]], reason: str, rain_mm: float) -> None`
  - `async rain_source_alert(state: RainState) -> None`
  - `find_valve(entity_id) -> tuple[Zone, Valve] | None` (búsqueda sin excepción, la usa `push_switched`)

- [ ] **Step 1: mover los cinco métodos** a `Incidents`, sustituyendo `self.config` por `self._config()`, `self.rain_unit()` por `self._rain_unit()`, y en `push_switched` el `try: self._find_valve(...) except ServiceValidationError: return` por `if (found := self.find_valve(entity_id)) is None: return`. Sin lock: ninguno lo tomaba.

```python
"""Incidencias: entidad event, evento de bus y push (docs/alerts/spec.md §0.1)."""

from __future__ import annotations

from collections.abc import Callable
from typing import Any

from homeassistant.core import HomeAssistant
from homeassistant.helpers.dispatcher import async_dispatcher_send

from ..adapters.notify import async_push, duration_text, message_text
from ..const import (
    EVENT_RAIN_SOURCE_UNAVAILABLE,
    EVENT_VALVE_ERROR,
    ORIGIN_EXTERNAL,
    ORIGIN_MANUAL,
    ORIGIN_SCHEDULED,
    SIGNAL_ALERT,
)
from ..domain.alerts import Alert, alert_priority, push_targets
from ..domain.model import Config, Valve, Zone
from ..domain.rain import RainState, format_rain


class Incidents:
    def __init__(self, hass: HomeAssistant, config: Callable[[], Config], rain_unit: Callable[[], str]) -> None:
        self.hass = hass
        # getters: el manager sustituye config al cargar
        self._config = config
        self._rain_unit = rain_unit

    def find_valve(self, entity_id: str) -> tuple[Zone, Valve] | None:
        for zone in self._config().zones.values():
            for valve in zone.valves:
                if valve.entity_id == entity_id:
                    return zone, valve
        return None

    # alert, valve_error, push_switched, push_rain_skipped, rain_source_alert:
    # cuerpos literales de manager.py:901-937, 884-899, 435-463, 670-687, 689-708
```

(El comentario de la última línea no va en el fichero: se sustituye por los cinco métodos copiados.)

- [ ] **Step 2: manager** — `self._incidents = Incidents(hass, lambda: self.config, self.rain_unit)` en `__init__`; cada `self._async_alert(` → `self._incidents.alert(`, `self._async_valve_error(` → `self._incidents.valve_error(`, `self._async_push_switched(` → `self._incidents.push_switched(`, `self._async_push_rain_skipped(` → `self._incidents.push_rain_skipped(`, `self._async_rain_source_alert(` → `self._incidents.rain_source_alert(`. `_find_valve` del manager se queda (lanza `ServiceValidationError` para la API) y reutiliza `self._incidents.find_valve`. Borrar imports sin uso.
- [ ] **Step 3: gates.**
- [ ] **Step 4: commit** — `git add -A custom_components && git commit -m "refactor: alertas y push a engine/incidents.py"`

### Task 14: `engine/rain_control.py`

**Files:**
- Create: `engine/rain_control.py`
- Modify: `manager.py` (90-96, 128-132, 511-608, 1255-1291), `engine/tests/conftest.py` (`RAIN_SOURCE_TARGET = "custom_components.irrigation_scheduler.engine.rain_control"`)

**Interfaces:**
- Produces:
  - `ZoneOutlook` (dataclass, igual que `manager.py:90-96`)
  - clase `RainControl(hass, settings: Callable[[], Settings])` con atributo `state: RainState`, `configured() -> bool`, `track(on_change: Callable[[], Awaitable[None]]) -> None`, `untrack() -> None`, `async refresh() -> RainState` (cuerpo de `async_refresh_rain`, con su `_rain_lock`, que no es el lock del manager).
  - funciones puras:
    - `apply_verdict(runtime: RuntimeState, zones: dict[str, Zone], refs: list[BlockRef], verdict: Verdict, needs_rain: Callable[[Zone], bool], now: datetime) -> tuple[bool, list[BlockRef], list[tuple[Zone, str]]]` → `(evaluated, skipped, opened)`; cuerpo del bucle de `manager.py:625-646`. Se llama con el lock del manager.
    - `zone_plan(zone: Zone, runtime: RuntimeState, rain: RainState, settings: Settings, needs_rain: bool, now: datetime) -> tuple[ZoneOutlook | None, datetime | None]`; cuerpo de `_zone_plan` + `_outlook` + `_skip_decided`.

- [ ] **Step 1: mover.** `track` recibe el callback que hoy es `self.async_refresh_rain`: el tick horario y el debounce del pluviómetro llaman a `on_change()`. `untrack` es `_untrack_rain`.
- [ ] **Step 2: manager.**
  - `self.rain` pasa a propiedad: `return self._rain.state` (las entidades de lluvia la leen).
  - `rain_configured()` → `return self._rain.configured()`.
  - `async_refresh_rain()` → `state = await self._rain.refresh(); async_dispatcher_send(self.hass, SIGNAL_STATE); return state`.
  - `_track_rain` → `self._rain.track(self.async_refresh_rain)`; `_untrack_rain` → `self._rain.untrack()`.
  - `_async_evaluate_lot`: el bucle bajo lock pasa a `evaluated, skipped, opened = apply_verdict(self.runtime, self.config.zones, refs, verdict, self._needs_rain, now)`.
  - `zone_rain_outlook` / `zone_next_run` → `zone_plan(zone, self.runtime, self.rain, self.config.settings, self._needs_rain(zone), dt_util.now())`, con `zone = self.config.zones.get(zone_id)` y `(None, None)` si falta.
  - `_async_recover_rain`, `_async_evaluate_lot` y `_needs_rain` se quedan en el manager: toman el lock.
- [ ] **Step 3: gates.**
- [ ] **Step 4: commit** — `git add -A custom_components && git commit -m "refactor: lluvia a engine/rain_control.py"`
- [ ] **Step 5: CI** — `test_rain_skip_blocks_the_block` en verde con el nuevo `RAIN_SOURCE_TARGET`.

### Task 15: `engine/manual.py` y `adapters/registry.py`

**Files:**
- Create: `engine/manual.py`, `adapters/registry.py`
- Modify: `manager.py` (465-470, 830-845, 1096-1136, 1300-1315), `entities/base.py` (comentario de `valve_uid`)

**Interfaces:**
- Produces:
  - `manual.manual_on(hass, zones: Iterable[Zone], busy: set[str]) -> list[tuple[Zone, Valve, datetime]]`
  - `manual.manual_ends(valve: Valve, since: datetime) -> datetime`
  - `manual.supply_on(hass, valve: Valve) -> bool`
  - `registry.rename_device(hass, zone)`, `registry.remove_zone_entities(hass, entry_id, zone_id)`, `registry.remove_valve_entities(hass, zone_id, entity_ids)`, `registry.remove_rain_entities(hass, config, rain_configured: bool)`, `registry.registry_id(hass, domain, unique_id) -> str | None`, `registry.history_entities(hass, zone) -> dict[str, Any]`

- [ ] **Step 1: mover** los cuerpos literales, cambiando `self.hass` por `hass` y `self.config` por el argumento. `_remove_entity` se queda como función privada del módulo.
- [ ] **Step 2: manager** llama a las funciones: `self._manual_on()` → `manual_on(self.hass, self.config.zones.values(), self._slots.busy())` (mantener un método fino `_manual_on` para no repetir los argumentos en sus 5 llamadas); `self._manual_ends` → `manual_ends`; `self._supply_on` → `supply_on(self.hass, valve)`; registro → `registry.*`.
- [ ] **Step 3:** comentario de `entities/unique_ids.valve_uid` y de `entities/base.py:87` → «borrar la zona la borra también (adapters/registry.remove_zone_entities)».
- [ ] **Step 4: gates.**
- [ ] **Step 5: commit** — `git add -A custom_components && git commit -m "refactor: encendidas a mano y registro fuera del manager"`

### Task 16: `api/snapshot.py` y `engine/manager.py`

**Files:**
- Create: `api/snapshot.py`
- Move: `manager.py` → `engine/manager.py`
- Modify: `manager.py:1330-1389`, `__init__.py`, plataformas, `errors.py`, `api/lookup.py`, `entities/*.py`, `engine/tests/conftest.py`, `engine/tests/test_characterization.py`, `engine/tests/test_lock.py`

**Interfaces:**
- Produces: `api.snapshot.build_snapshot(manager: IrrigationManager) -> dict[str, Any]` (cuerpo de `snapshot`, leyendo por la API pública del manager y `manager._slots` solo con vistas). `IrrigationManager.snapshot()` queda como `return build_snapshot(self)`.

Para no leer `_slots` desde fuera, añadir al manager dos vistas públicas: `opening_durations() -> dict[str, tuple[str, int]]` (`self._slots.durations()`) y `visible_opening() -> dict[str, str]` (`self._slots.visible_opening()`), y `manual_on()` público (renombrar `_manual_on`; `graft callers _manual_on` para actualizar las llamadas).

- [ ] **Step 1: crear `api/snapshot.py`** con `build_snapshot` = cuerpo de `manager.py:1330-1389`, cambiando `self.` por `manager.`, `self._opening…` por `manager.opening_durations()` / `manager.visible_opening()`, `self._history_entities(zone)` por `history_entities(manager.hass, zone)`, `self._supply_on(valve)` por `supply_on(manager.hass, valve)`, `self._registry_id(...)` por `registry_id(manager.hass, ...)`. Import de `IrrigationManager` bajo `TYPE_CHECKING`.
- [ ] **Step 2: mover el manager**: `git mv custom_components/irrigation_scheduler/manager.py custom_components/irrigation_scheduler/engine/manager.py`. Imports dentro: `.const` → `..const`, `.domain.x` → `..domain.x`, `.adapters.x` → `..adapters.x`, `.errors` → `..errors`, `.engine.slots` → `.slots`, etc. Fuera: `from .manager import` → `from .engine.manager import` (raíz) o `from ..engine.manager import` (subcarpetas). `errors.py` y `api/lookup.py`: import bajo `TYPE_CHECKING` actualizado.
- [ ] **Step 3: tests**: `conftest.py` → `from custom_components.irrigation_scheduler.engine.manager import IrrigationManager`, `from custom_components.irrigation_scheduler.adapters.store import IrrigationStore`. `test_lock.py` → `MANAGER = Path(__file__).parents[1] / "manager.py"`.
- [ ] **Step 4: tamaño**: `wc -l custom_components/irrigation_scheduler/engine/manager.py`. Objetivo de la spec: 500-600. Si pasa de 700, anotar qué bloques quedan y proponer al usuario el siguiente corte; no seguir partiendo sin acuerdo.
- [ ] **Step 5: gates** — ruff, compileall; `graft grep "from .manager import"` → ningún resultado en la raíz.
- [ ] **Step 6: commit** — `git add -A custom_components && git commit -m "refactor: manager a engine/ y snapshot a api/"`
- [ ] **Step 7: CI** en verde.

---

## Fase 4 — rapidez del panel

### Task 17: aviso inmediato y escritura diferida

**Files:**
- Modify: `adapters/store.py`, `engine/manager.py` (`_async_persist_locked`), `__init__.py:79-84`, `api/websocket.py` (`_async_run`)
- Create: `engine/tests/test_persist.py`

**Interfaces:**
- Produces: `IrrigationStore.schedule_save_runtime(state: RuntimeState) -> None` (síncrono), `IrrigationStore.async_flush_runtime(state: RuntimeState) -> Awaitable[None]`.

Se reutiliza `Store.async_delay_save` de HA en lugar de escribir un escritor propio: agrupa escrituras seguidas, serializa el último estado al escribir y HA vacía lo pendiente en `EVENT_HOMEASSISTANT_FINAL_WRITE`. Cumple spec §4 fase 4 C.

- [ ] **Step 1: test que falla**

`engine/tests/test_persist.py`:

```python
"""El panel recibe el cambio antes de que se escriba el runtime."""

from __future__ import annotations

from homeassistant.core import HomeAssistant, callback
from homeassistant.helpers.dispatcher import async_dispatcher_connect

from custom_components.irrigation_scheduler.const import RUNTIME_STORE_KEY, SIGNAL_STATE

from .conftest import add_zone


async def test_signal_before_disk_write(hass: HomeAssistant, manager, switches, hass_storage, monkeypatch) -> None:
    await add_zone(manager, switches, ["switch.v1", "switch.v2"])
    writes: list[str] = []
    order: list[str] = []

    original = manager._store.async_save_runtime

    async def spy(state):
        writes.append("direct")
        await original(state)

    monkeypatch.setattr(manager._store, "async_save_runtime", spy)

    @callback
    def on_state() -> None:
        order.append("signal")

    async_dispatcher_connect(hass, SIGNAL_STATE, on_state)
    switches.gate = __import__("asyncio").Event()

    await manager.async_run_zone(next(iter(manager.config.zones)))
    # el comando vuelve sin escritura directa y con la señal ya enviada
    assert writes == []
    assert order and order[0] == "signal"

    switches.gate.set()
    await hass.async_block_till_done(wait_background_tasks=True)
    # la escritura diferida acaba guardando el último estado
    saved = hass_storage[RUNTIME_STORE_KEY]["data"]
    assert {valve["entity_id"] for valve in saved["open_valves"]} == {"switch.v1"}
    assert [job["entity_id"] for job in saved["pending"]] == ["switch.v2"]
```

(Sustituir `__import__("asyncio")` por `import asyncio` arriba al escribirlo.)

- [ ] **Step 2: store**

Añadir a `IrrigationStore`:

```python
    @callback
    def schedule_save_runtime(self, state: RuntimeState) -> None:
        """Escritura diferida: agrupa cambios seguidos y guarda el último estado.

        HA la vacía al parar (EVENT_HOMEASSISTANT_FINAL_WRITE).
        """
        self._runtime.async_delay_save(state.to_dict, RUNTIME_SAVE_DELAY_S)

    async def async_flush_runtime(self, state: RuntimeState) -> None:
        """Escribe ya; cancela la diferida pendiente (Store.async_save lo hace)."""
        await self._runtime.async_save(state.to_dict())
```

`RUNTIME_SAVE_DELAY_S = 0` en `const.py` con comentario «0: se escribe en la siguiente vuelta del bucle, fuera del lock y después de avisar». Import de `callback` desde `homeassistant.core`.

- [ ] **Step 3: manager**

```python
    async def _async_persist_locked(self) -> None:
        """Avisa al panel ya y deja la escritura en disco para después, fuera del lock."""
        self._slots.prune_batches(self.config.zones)
        async_dispatcher_send(self.hass, SIGNAL_STATE)
        self._store.schedule_save_runtime(self.runtime)
```

Se mantiene `async` para no tocar las 15 llamadas. El latido (`_async_heartbeat`) sigue con `async_save_runtime` directo: marca `last_alive` y debe quedar escrito.

- [ ] **Step 4: descarga**

`__init__.py`, `async_unload_entry`:

```python
    if unloaded:
        frontend.async_remove_panel(hass, PANEL_URL_PATH)
        entry.runtime_data.async_shutdown()
        # la escritura diferida pendiente no se pierde al recargar la entry
        await entry.runtime_data.async_flush()
```

Manager: `async def async_flush(self) -> None: await self._store.async_flush_runtime(self.runtime)`.

- [ ] **Step 5: medición**

`api/websocket.py`, `_async_run`: medir con `time.monotonic()` y `_LOGGER.debug("%s en %.0f ms", msg_type, elapsed_ms)` (añadir el tipo de mensaje como argumento; `_LOGGER = logging.getLogger(__name__)`). `adapters/store.py`: en `schedule_save_runtime`, `_LOGGER.debug("runtime: escritura programada")`; en `to_dict` no se toca. Con esto el log de depuración muestra clic → respuesta; la señal ya sale antes de la respuesta por construcción (test del Step 1).

- [ ] **Step 6: gates** — ruff y compileall.
- [ ] **Step 7: commit** — `git add -A custom_components && git commit -m "perf: avisa al panel antes de escribir el runtime"`
- [ ] **Step 8: CI** en verde, incluida toda la caracterización (el arranque con válvula excedida valida que la persistencia sigue funcionando).

### Task 18: botón «procesando» en el panel

**Files:**
- Modify: `frontend/src/shared/controls.ts:48-71`, `frontend/src/shared/styles.ts:116-119`
- Regenerado: `custom_components/irrigation_scheduler/frontend/irrigation-scheduler.js`

Sin tests (regla del proyecto para features de frontend). Validación: gates y prueba del usuario en HA.

- [ ] **Step 1: controles**

```ts
/** Botón ▶ ⏸ ■. No propaga el clic: en filas pulsables no abre ni despliega. */
export function controlButton(host: HTMLElement, hass: Hass, spec: ButtonSpec, text?: string): TemplateResult {
  const label = t(hass, LABELS[spec.action]);
  return html`<button
    class="control ${spec.action === "stop" ? "danger" : ""}"
    title=${label}
    aria-label=${text ?? label}
    ?disabled=${!hass.connected}
    @click=${(ev: Event) => {
      ev.stopPropagation();
      void runBusy(ev.currentTarget as HTMLButtonElement, host, hass, spec.run);
    }}
  >
    ${svgIcon(ICONS[spec.action])}${text ? html`<span class="text">${text}</span>` : nothing}
  </button>`;
}

// procesando: deshabilitado hasta la respuesta; evita el doble clic y da respuesta visual.
// Lit no repone `disabled` si su valor enlazado no cambia, así que el estado manual se mantiene
async function runBusy(button: HTMLButtonElement, host: HTMLElement, hass: Hass, run: (hass: Hass) => Promise<unknown>) {
  button.disabled = true;
  button.classList.add("busy");
  button.setAttribute("aria-busy", "true");
  try {
    await runCommand(host, hass, run);
  } finally {
    button.classList.remove("busy");
    button.removeAttribute("aria-busy");
    button.disabled = !hass.connected;
  }
}
```

- [ ] **Step 2: estilo** — tras `button.control { ... }` en `styles.ts`:

```css
  button.control.busy {
    cursor: progress;
    opacity: 0.5;
  }
```

- [ ] **Step 3: gates** — en `frontend/`: `npx tsc --noEmit`, `npm run lint`, `npm run build`. Expected: sin errores y bundle regenerado.
- [ ] **Step 4: commit** — `git add frontend/src custom_components/irrigation_scheduler/frontend && git commit -m "feat: botón en «procesando» hasta la respuesta"`

---

## Cierre

### Task 19: tests en el paquete de HACS y PR

- [ ] **Step 1:** preguntar al usuario: los `tests/` viajan dentro de `custom_components/irrigation_scheduler/` a cada instalación HACS (no se ejecutan, solo ocupan). Opciones: aceptarlo, o `zip_release` en `hacs.json` con un workflow de release que excluya `**/tests/**`. No decidir por él.
- [ ] **Step 2:** changelog de la versión siguiente: nombres de logger nuevos (`custom_components.irrigation_scheduler.engine.manager`, `...adapters.valves`, etc.). Quien tenga `logger:` configurado en YAML debe actualizarlo.
- [ ] **Step 3:** push con confirmación y PR contra `main` con `gh pr create`, cuerpo con resumen por fase, riesgos de la spec §5 y la línea de atribución.

---

## Autorrevisión

- **Cobertura de la spec:** §4 fase 0 → Tasks 1-2; fase 1 → Tasks 3-7; fase 2 → Tasks 8-10; fase 3 → Tasks 11-16; fase 4 C → Task 17, D → Task 18, medición → Task 17 Step 5; §5 riesgos → Task 19; §6 entrega → Task 19.
- **Desviaciones anotadas:** tests de `ValveSlots` solo en CI (Global Constraints); escritura diferida con `Store.async_delay_save` en lugar de escritor propio (Task 17, mismo comportamiento); `_async_persist` → `_async_persist_locked` para que el test AST lo reconozca.
- **Nombres cruzados:** `ValveSlots.reserve_startable/finish_opening/opened/begin_close/closed/begin_manual_close/end_manual_close/cancel/drop_pending/prune_batches` coinciden entre Task 11 (`MUTATORS`), Task 12 y el test de Task 12. `VALVES_MODULE` cambia en Task 9, `RAIN_SOURCE_TARGET` en Task 14, imports del manager en Task 16.
