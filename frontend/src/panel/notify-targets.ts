// móviles de la app de HA: servicios notify.mobile_app_*

export const NOTIFY_PREFIX = "notify.mobile_app_";
// mdi:cellphone
export const PHONE_ICON =
  "M17,19H7V5H17M17,1H7C5.89,1 5,1.89 5,3V21A2,2 0 0,0 7,23H17A2,2 0 0,0 19,21V3C19,1.89 18.1,1 17,1Z";

/** «notify.mobile_app_movil_principal» → «movil principal». */
export function targetName(target: string): string {
  return target.slice(NOTIFY_PREFIX.length).replaceAll("_", " ");
}
