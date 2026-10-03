# Plan 2 · Avisos por voz en altavoces Cast

> Spec: [`docs/alerts/cast-notifies/spec.md`](../../alerts/cast-notifies/spec.md).
> Mockup: [`docs/alerts/cast-notifies/mockup.html`](../../alerts/cast-notifies/mockup.html).
> Requiere: plan 1 cerrado (`Notice` / `Notifier`). Progreso: [`PROGRESO.md`](PROGRESO.md).
> Rutas de backend relativas a `custom_components/irrigation_scheduler/`; de panel, a `frontend/src/`.

**Objetivo.** Segundo canal del `Notifier`: `tts.speak` en los `media_player` elegidos, en
paralelo con el push.

---

## Tarea 2.1 · Modelo, destinos y validación

Spec §2 y §3.

1. `domain/model.py`: `Settings.speaker_targets`, `tts_entity`, `tts_volume`;
   `AlertConfig.voice`, `voice_targets` (tipos y defectos de la spec §2).
2. `domain/alerts.py`: `voice_targets(settings, alert_id)` junto a `push_targets` (81-88).
3. `domain/validation.py` `validate_settings`: prefijos `media_player.` y `tts.` con la regla
   `entity`; `V18` para `tts_volume` fuera de 0–1 o no numérico.
4. `api/schemas.py`: claves nuevas en `ALERT_SCHEMA` (opcionales) y `SETTINGS_SCHEMA`.

**Criterio.** Una configuración guardada sin las claves nuevas carga igual y no envía voz.

## Tarea 2.2 · Adaptador de voz y canal en el Notifier

Spec §4.

1. `adapters/speak.py`: `async_speak(hass, speakers, tts_entity, volume, text)` con los pasos de
   la spec §4.2: salto de no disponibles, lock por altavoz, `volume_set` opcional, `tts.speak`
   con `blocking=True` y `SERVICE_TIMEOUT_S = 30`, espera a que deje de sonar con
   `PLAYBACK_WAIT_S = 60` (`async_track_state_change_event` + `asyncio.Event`, o espera con
   timeout sobre el estado). Errores al log.
2. `speech_text(title, message)`: `title + ". " + message.replace(" · ", ", ")`.
3. `adapters/notify.py`: `Notice` gana `voice_targets`, `tts_entity`, `tts_volume`;
   `compose_notice` los rellena; `_async_deliver` añade `async_speak` al `gather` si hay
   altavoces.
4. `engine/incidents.py`: pasar `voice_targets(settings, alert_id)` a `compose_notice` en los
   tres caminos.
5. `api/websocket.py`: comando `irrigation_scheduler/test_speak` (spec §3), registrado en
   `async_register_websocket` (`api/websocket.py:23-38`).

**Criterio.** Un altavoz caído o lento no retrasa el push ni a los otros altavoces.

## Tarea 2.3 · Panel: tarjeta «Notificaciones»

Spec §5, primer bloque. Mockup: tarjeta «Notificaciones».

1. `api.ts`: tipos `Settings` y `AlertConfig` con los campos nuevos; `testSpeak(hass, …)`.
2. `panel/notify-targets.ts`: `speakerEntities(hass)` (`media_player.*` con bit 512),
   `ttsEntities(hass)`, `speakerIcon(state)` según `device_class`.
3. `panel/settings-view.ts` `renderNotifications` (195-222): grupos «Móviles · push» y
   «Altavoces y pantallas · voz», caja de voz (motor, volumen, «Probar») y estados vacíos.
4. `i18n.ts`: claves `voice*`, `rule_V18`, es/en.

## Tarea 2.4 · Panel: «Errores y avisos»

Spec §5, segundo bloque.

1. `panel/alert-settings.ts`: columna «Voz» (ajustar el grid `1fr 64px 112px 72px 32px`), chips
   de altavoces en el detalle, prioridad deshabilitada solo sin push.
2. `i18n.ts`: textos de la columna y del detalle.

## Tarea 2.5 · Gates y commits

Backend (2.1 + 2.2) y panel (2.3 + 2.4) en commits separados:

1. `uvx ruff check custom_components` y `py -3.14 -m compileall -q custom_components`.
2. `npm run lint` y `npm run build` en `frontend/`.
3. Commits: `feat: canal de voz por tts.speak` y `feat: panel de altavoces y columna Voz`.
