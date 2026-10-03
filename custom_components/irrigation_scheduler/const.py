"""Constantes de Irrigation Scheduler. Sin dependencias de HA."""

from datetime import timedelta

DOMAIN = "irrigation_scheduler"

CONFIG_STORE_KEY = f"{DOMAIN}.config"
CONFIG_STORE_VERSION = 1
RUNTIME_STORE_KEY = f"{DOMAIN}.runtime"
RUNTIME_STORE_VERSION = 1
# 0: se escribe en la siguiente vuelta del bucle, fuera del lock y después de avisar
RUNTIME_SAVE_DELAY_S = 0

MODE_MANUAL = "manual"
MODE_AUTO = "auto"
MODES = [MODE_MANUAL, MODE_AUTO]

STATUS_IDLE = "idle"
STATUS_RUNNING = "running"
STATUS_QUEUED = "queued"
STATUSES = [STATUS_IDLE, STATUS_RUNNING, STATUS_QUEUED]

# Origen del riego de una válvula: estados del sensor «Modo riego»
ORIGIN_IDLE = "idle"
ORIGIN_SCHEDULED = "scheduled"
ORIGIN_MANUAL = "manual"
ORIGIN_EXTERNAL = "external"
ORIGINS = [ORIGIN_IDLE, ORIGIN_SCHEDULED, ORIGIN_MANUAL, ORIGIN_EXTERNAL]

# Sensores opcionales de zona (04-sensors-auto.md §1)
SENSOR_KINDS = ("temperature", "humidity", "soil_moisture")

# Valores por defecto de lluvia (05-rain-skip.md §3.1 y §8.17)
DEFAULT_RAIN_PAST_HOURS = 24
DEFAULT_RAIN_PAST_THRESHOLD_MM = 5.0
DEFAULT_RAIN_FORECAST_HOURS = 24
DEFAULT_RAIN_FORECAST_THRESHOLD_MM = 5.0
RAIN_FORECAST_HOURS_MIN = 6
RAIN_FORECAST_HOURS_MAX = 24
# La decisión de un bloque se toma 10 min antes (05-rain-skip.md §8.16)
RAIN_EVAL_LEAD_MIN = 10

# Estado de lluvia (05-rain-skip.md §8.9, §8.27)
RAIN_REFRESH_INTERVAL = timedelta(hours=1)
RAIN_DEBOUNCE_S = 60
# un episodio abierto más de 24 h se cierra al evaluar la zona (§8.14)
RAIN_EPISODE_MAX = timedelta(hours=24)
# margen del latido para purgar decisiones de bloques ya pasados (§8.23)
DECISION_PURGE_MARGIN = timedelta(minutes=5)
# Arranque de HA: reintento de las fuentes para los bloques perdidos (§8.15)
RAIN_STARTUP_RETRY_S = 30
RAIN_STARTUP_MAX = timedelta(minutes=5)

# Fallos de switch (03-valves-execution.md §6): 1 intento + 3 reintentos
SWITCH_RETRIES = 3
VERIFY_DELAY_S = 2

# Latido last_alive (docs/features/valves-execution/spec.md §5.1)
HEARTBEAT_INTERVAL = timedelta(minutes=5)

# Margen de la vigilancia de tiempos en el latido (docs/features/valves-execution/spec.md §5.3)
OVERRUN_MARGIN = timedelta(minutes=1)

NOTIFY_PREFIX = "notify.mobile_app_"
# canal de voz (docs/features/alerts/cast-notifies/spec.md §2)
SPEAKER_PREFIX = "media_player."
TTS_PREFIX = "tts."

PRIORITY_CRITICAL = "critical"
PRIORITY_HIGH = "high"
PRIORITY_NORMAL = "normal"

SIGNAL_STATE = f"{DOMAIN}_state"
SIGNAL_CONFIG = f"{DOMAIN}_config"
SIGNAL_ZONE_ADDED = f"{DOMAIN}_zone_added"
# incidencia hacia las entidades event (docs/features/alerts/spec.md §0.1)
SIGNAL_ALERT = f"{DOMAIN}_alert"

# códigos WS de un borrado de zona que no sigue (docs/features/alerts/spec.md §2)
ZONE_DELETE_BUSY = "zone_busy"
ZONE_DELETE_VALVES_ON = "valves_not_off"

EVENT_VALVE_ERROR = f"{DOMAIN}_valve_error"
EVENT_VALVE_OVERRUN = f"{DOMAIN}_valve_overrun"
EVENT_SENSOR_UNAVAILABLE = f"{DOMAIN}_sensor_unavailable"
EVENT_BLOCK_SKIPPED = f"{DOMAIN}_block_skipped"
EVENT_RAIN_SOURCE_UNAVAILABLE = f"{DOMAIN}_rain_source_unavailable"
EVENT_NO_WATER = f"{DOMAIN}_no_water"

INSTALLATION_ID = "installation"

# Frontend (02-frontend.md §3.2)
FRONTEND_URL = f"/{DOMAIN}/irrigation-scheduler.js"
FRONTEND_FILE = "frontend/irrigation-scheduler.js"
PANEL_URL_PATH = "irrigation-scheduler"
PANEL_ELEMENT = "irrigation-scheduler-panel"
PANEL_ICON = "mdi:sprinkler-variant"
