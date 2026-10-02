# Avisos por voz en altavoces y pantallas Cast

> Estado: **diseño aprobado** · Última actualización: 2026-10-03
> Rutas de código relativas a `custom_components/irrigation_scheduler/`.
> Requiere: [`../../quiet-hours/spec.md`](../../quiet-hours/spec.md) parte A (envío sin espera).
> Mockup: [`mockup.html`](mockup.html).

Segundo canal de avisos, además del push: el aviso se dice en voz alta en altavoces y pantallas
de HA (Nest Audio, Nest Hub, Android TV con Cast, grupos Cast).

El horario silencioso **no** afecta a la voz: los avisos se dicen a cualquier hora.

---

## 1. Alcance

**Dentro:**

- Cualquier `media_player.*` que reproduzca medios (`supported_features` con el bit
  `PLAY_MEDIA` = 512). Cast, Sonos y otros entran igual.
- Motores TTS modernos (entidades `tts.*`), por el servicio `tts.speak`.

**Fuera:**

- Alexa (no es `media_player` con `PLAY_MEDIA` fiable), Android TV sin Cast (`nfandroidtv`).
- Motores TTS antiguos (`tts.<plataforma>_say`).
- Restaurar el volumen después de hablar.

---

## 2. Modelo

`Settings` (`domain/model.py:121`) gana:

| Campo | Tipo | Defecto | Significado |
|---|---|---|---|
| `speaker_targets` | `list[str]` | `[]` | Altavoces elegidos con chips (`media_player.*`). |
| `tts_entity` | `str \| None` | `None` | Motor TTS (`tts.*`). Sin motor no hay voz. |
| `tts_volume` | `float \| None` | `None` | Volumen 0–1 antes de hablar. `None` = no se toca. |

`AlertConfig` (`domain/model.py:104-117`) gana:

| Campo | Tipo | Defecto | Significado |
|---|---|---|---|
| `voice` | `bool` | `False` | El aviso se dice. Apagado por defecto: nada cambia al actualizar. |
| `voice_targets` | `list[str] \| None` | `None` | `None` = todos los `speaker_targets`, también los que se añadan. |

`domain/alerts.py` gana `voice_targets(settings, alert_id)`, gemela de `push_targets`
(`domain/alerts.py:81-88`): vacía si `voice` está apagado o no hay `tts_entity`; si no, los
elegidos que siguen en `speaker_targets`.

Sin migración: `from_dict` ignora lo desconocido y usa defectos para lo que falta
(`domain/model.py:114-117`, `:134-141`).

---

## 3. Validación y API

En `validate_settings` (`domain/validation.py:108`), con la regla `entity` ya existente:

- Cada `speaker_targets[i]` y `alerts.<id>.voice_targets[i]` empieza por `media_player.`.
- `tts_entity` empieza por `tts.`.
- `tts_volume` es número entre 0 y 1 → regla nueva `V18`, ruta `("tts_volume",)`.

Esquemas (`api/schemas.py:38-59`):

- `ALERT_SCHEMA`: `vol.Optional("voice"): bool`, `vol.Optional("voice_targets"): vol.Any(None, [str])`.
  Opcionales para no romper un panel viejo en caché.
- `SETTINGS_SCHEMA`: `speaker_targets: [str]`, `tts_entity: vol.Any(None, str)`,
  `tts_volume: vol.Any(None, int, float)`.

Comando WebSocket nuevo `irrigation_scheduler/test_speak` (`entity_id`, `tts_entity`,
`volume` opcional) para el botón «Probar». Dice una frase fija en el idioma de HA. Responde cuando
`tts.speak` vuelve (empieza a sonar), sin esperar a que acabe; si la llamada falla, devuelve el
error al panel.

---

## 4. Envío

### 4.1 Composición

`async_notify` (spec de horario silencioso, A.2.4) recibe los destinos de voz junto a los de
push y lanza `async_speak` como segundo canal del `gather`. El push y la voz no se esperan entre
sí.

Frase hablada: `title + ". " + message`, con « · » sustituido por «, ». Ejemplo: «Error.
Césped, Aspersor norte: no se apaga (03:12). Puede seguir regando. Ciérrala a mano ya.»
Usa los mismos `MESSAGES` (`adapters/notify.py:24-90`); no hay textos nuevos salvo la frase de
prueba.

### 4.2 Adaptador `adapters/speak.py`

`async_speak(hass, speakers, tts_entity, volume, text)`:

1. Por cada altavoz, en paralelo:
   - Si su estado es `unavailable` o `unknown`, se salta con un aviso en el log.
   - Toma el `asyncio.Lock` de ese altavoz. Dos avisos seguidos no se cortan.
   - Si `volume` no es `None`: `media_player.volume_set`.
   - `tts.speak` con `entity_id = tts_entity`, `media_player_entity_id = altavoz`,
     `message = text`, `blocking=True`.
   - Espera a que el altavoz deje de estar `playing`/`buffering`, como máximo **60 s**. Así el
     siguiente aviso no corta al anterior: `tts.speak` vuelve al empezar a sonar, no al acabar.
   - Suelta el lock.
2. Límite de **30 s** por llamada de servicio. Errores y vencimientos van al log; nunca suben.

### 4.3 Riesgos conocidos

- Hablar en un grupo Cast y en uno de sus miembros a la vez se pisa. Se documenta en la ayuda;
  no se detecta.
- `volume_set` deja el volumen cambiado. El usuario lo acepta al fijar volumen.
- Un altavoz que reproduce música la corta. Es el comportamiento normal de `tts.speak`.

---

## 5. Panel

Según el mockup, con estas correcciones respecto a la versión de `b94ac9c`:

- **Tarjeta «Notificaciones».**
  - Grupo «Móviles · push»: los chips actuales (`frontend/src/panel/settings-view.ts:195-222`).
  - Grupo «Altavoces y pantallas · voz»: chips de `hass.states` `media_player.*` con bit 512.
    Icono según `device_class` (`tv` → televisor, `speaker` o sin clase → altavoz). No se
    intenta detectar grupos. Los no disponibles salen atenuados y se pueden elegir.
  - Caja de voz: motor TTS (lista de `tts.*`), volumen (deslizador con «sin cambiar»), botón
    «Probar» por altavoz elegido.
  - Sin `tts.*`: grupo de voz deshabilitado con «Instala un motor de voz (TTS) para usar
    altavoces». Sin altavoces: «No hay altavoces en HA».
  - El horario silencioso **no** va aquí: tiene tarjeta propia (spec de horario silencioso, B.5).
- **«Errores y avisos»** (`frontend/src/panel/alert-settings.ts`).
  - Columna nueva «Voz» entre Push y Prioridad.
  - El desplegable de cada fila añade los chips de altavoces bajo los de móviles.
  - El selector de prioridad se deshabilita solo con el push apagado: la prioridad no afecta a
    la voz.
  - Sin vista previa de la frase: duplicaría `MESSAGES` en el panel.
- **i18n** (`frontend/src/i18n.ts`): claves nuevas `voice*` y `rule_V18`, es/en.

---

## 6. Verificación

Mismos gates que la spec de horario silencioso, parte C:

- `uvx ruff check custom_components`
- `py -3.14 -m compileall -q custom_components`
- `npm run lint` y `npm run build` en `frontend/`
- CI en verde con los tests existentes.

La prueba funcional con altavoces reales la hace el usuario en su HA.
