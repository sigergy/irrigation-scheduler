"""Constantes de Irrigation Scheduler. Sin dependencias de HA."""

from datetime import timedelta

DOMAIN = "irrigation_scheduler"

CONFIG_STORE_KEY = f"{DOMAIN}.config"
CONFIG_STORE_VERSION = 1
RUNTIME_STORE_KEY = f"{DOMAIN}.runtime"
RUNTIME_STORE_VERSION = 1

MODE_MANUAL = "manual"
MODE_AUTO = "auto"
MODES = [MODE_MANUAL, MODE_AUTO]

STATUS_IDLE = "idle"
STATUS_RUNNING = "running"
STATUS_QUEUED = "queued"
STATUSES = [STATUS_IDLE, STATUS_RUNNING, STATUS_QUEUED]

# Sensores opcionales de zona (04-sensors-auto.md §1)
SENSOR_KINDS = ("temperature", "humidity", "soil_moisture")

# Valores por defecto de lluvia (05-rain-skip.md §3.1)
DEFAULT_RAIN_PAST_HOURS = 24
DEFAULT_RAIN_PAST_THRESHOLD_MM = 5.0
DEFAULT_RAIN_FORECAST_HOURS = 12
DEFAULT_RAIN_FORECAST_THRESHOLD_MM = 5.0

# Fallos de switch (03-valves-execution.md §6): 1 intento + 3 reintentos
SWITCH_RETRIES = 3
VERIFY_DELAY_S = 2

# Latido last_alive (03-valves-execution.md §5.1)
HEARTBEAT_INTERVAL = timedelta(minutes=5)

# Margen de la vigilancia de tiempos en el latido (03-valves-execution.md §5.3)
OVERRUN_MARGIN = timedelta(minutes=1)

NOTIFY_PREFIX = "notify.mobile_app_"

PRIORITY_CRITICAL = "critical"
PRIORITY_HIGH = "high"
PRIORITY_NORMAL = "normal"

SIGNAL_STATE = f"{DOMAIN}_state"
SIGNAL_CONFIG = f"{DOMAIN}_config"
SIGNAL_ZONE_ADDED = f"{DOMAIN}_zone_added"
# incidencia hacia las entidades event (docs/alerts/spec.md §0.1)
SIGNAL_ALERT = f"{DOMAIN}_alert"

# códigos WS de un borrado de zona que no sigue (docs/alerts/spec.md §2)
ZONE_DELETE_BUSY = "zone_busy"
ZONE_DELETE_VALVES_ON = "valves_not_off"

EVENT_VALVE_ERROR = f"{DOMAIN}_valve_error"
EVENT_VALVE_OVERRUN = f"{DOMAIN}_valve_overrun"
EVENT_SENSOR_UNAVAILABLE = f"{DOMAIN}_sensor_unavailable"

INSTALLATION_ID = "installation"

# Frontend (02-frontend.md §3.2)
FRONTEND_URL = f"/{DOMAIN}/irrigation-scheduler.js"
FRONTEND_FILE = "frontend/irrigation-scheduler.js"
PANEL_URL_PATH = "irrigation-scheduler"
PANEL_ELEMENT = "irrigation-scheduler-panel"
PANEL_ICON = "mdi:sprinkler-variant"
