import type { Hass, HassEntity } from "../api";

// móviles de la app de HA: servicios notify.mobile_app_*

export const NOTIFY_PREFIX = "notify.mobile_app_";
// mdi:cellphone
export const PHONE_ICON =
  "M17,19H7V5H17M17,1H7C5.89,1 5,1.89 5,3V21A2,2 0 0,0 7,23H17A2,2 0 0,0 19,21V3C19,1.89 18.1,1 17,1Z";

/** «notify.mobile_app_movil_principal» → «movil principal». */
export function targetName(target: string): string {
  return target.slice(NOTIFY_PREFIX.length).replaceAll("_", " ");
}

// MediaPlayerEntityFeature.PLAY_MEDIA (ha/components/media_player/const.py): lo que pide tts.speak
const PLAY_MEDIA = 512;
// mdi:speaker
export const SPEAKER_ICON =
  "M12,12A3,3 0 0,0 9,15A3,3 0 0,0 12,18A3,3 0 0,0 15,15A3,3 0 0,0 12,12M12,20A5,5 0 0,1 7,15A5,5 0 0,1 12,10A5,5 0 0,1 17,15A5,5 0 0,1 12,20M12,4A2,2 0 0,1 14,6A2,2 0 0,1 12,8C10.89,8 10,7.1 10,6C10,4.89 10.89,4 12,4M17,2H7C5.89,2 5,2.89 5,4V20A2,2 0 0,0 7,22H17A2,2 0 0,0 19,20V4C19,2.89 18.1,2 17,2Z";
// mdi:television
export const TV_ICON =
  "M21,17H3V5H21M21,3H3A2,2 0 0,0 1,5V17A2,2 0 0,0 3,19H8V21H16V19H21A2,2 0 0,0 23,17V5A2,2 0 0,0 21,3Z";
// mdi:play
export const PLAY_ICON = "M8,5.14V19.14L19,12.14L8,5.14Z";

/** Reproductores de HA que aceptan audio (`media_player.*` con PLAY_MEDIA), ordenados por id. */
export function speakerEntities(hass: Hass): HassEntity[] {
  return Object.values(hass.states)
    .filter(
      (state) =>
        state.entity_id.startsWith("media_player.") &&
        (Number(state.attributes.supported_features ?? 0) & PLAY_MEDIA) !== 0,
    )
    .sort((a, b) => a.entity_id.localeCompare(b.entity_id));
}

/** Motores de voz de HA (`tts.*`), ordenados por id. */
export function ttsEntities(hass: Hass): HassEntity[] {
  return Object.values(hass.states)
    .filter((state) => state.entity_id.startsWith("tts."))
    .sort((a, b) => a.entity_id.localeCompare(b.entity_id));
}

/** Icono mdi del altavoz: device_class `tv` → televisor; `speaker` o sin clase → altavoz. */
export function speakerIcon(state: HassEntity | undefined): string {
  return state?.attributes.device_class === "tv" ? TV_ICON : SPEAKER_ICON;
}

/** Nombre para mostrar: friendly_name o, sin estado, el id sin dominio. */
export function speakerName(entityId: string, state: HassEntity | undefined): string {
  return state?.attributes.friendly_name ?? entityId.slice(entityId.indexOf(".") + 1).replaceAll("_", " ");
}

/** Altavoz sin conexión: se atenúa en el panel pero se puede elegir. */
export function speakerOffline(state: HassEntity | undefined): boolean {
  return state === undefined || state.state === "unavailable" || state.state === "unknown";
}
