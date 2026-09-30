import { html, nothing, type TemplateResult } from "lit";

import type { Hass } from "../api";
import { t, type Key } from "../i18n";

export type Action = "run" | "resume" | "pause" | "stop";

export interface ButtonSpec {
  action: Action;
  run: (hass: Hass) => Promise<unknown>;
}

// iconos mdi en SVG: los caracteres ▶ ⏸ salen como emoji de color en Android
// mdi:chevron-down y mdi:chevron-up (desplegar válvulas)
export const CHEVRON_DOWN = "M7.41,8.58L12,13.17L16.59,8.58L18,10L12,16L6,10L7.41,8.58Z";
export const CHEVRON_UP = "M7.41,15.41L12,10.83L16.59,15.41L18,14L12,8L6,14L7.41,15.41Z";

const PLAY = "M8,5.14V19.14L19,12.14L8,5.14Z";
const ICONS: Record<Action, string> = {
  run: PLAY,
  resume: PLAY,
  pause: "M14,19H18V5H14M6,19H10V5H6V19Z",
  stop: "M18,18H6V6H18V18Z",
};
const LABELS: Record<Action, Key> = {
  run: "action_run",
  resume: "action_resume",
  pause: "action_pause",
  stop: "action_stop",
};

export function fireEvent(node: EventTarget, type: string, detail?: unknown): void {
  node.dispatchEvent(new CustomEvent(type, { detail, bubbles: true, composed: true }));
}

/** Toast nativo de HA (02 §6). */
export function showToast(host: HTMLElement, message: string): void {
  // si el elemento ya no está en el DOM (fila repintada), se lanza desde la raíz de HA
  const target = host.isConnected ? host : document.querySelector("home-assistant");
  if (target) fireEvent(target, "hass-notification", { message });
}

export function errorMessage(hass: Hass, err: unknown): string {
  const message = (err as { message?: unknown } | null)?.message;
  return typeof message === "string" && message ? message : t(hass, "command_failed");
}

export async function runCommand(host: HTMLElement, hass: Hass, run: (hass: Hass) => Promise<unknown>) {
  try {
    await run(hass);
  } catch (err) {
    showToast(host, errorMessage(hass, err));
  }
}

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

/** Icono SVG de 24×24 que hereda el color del texto (clase .svg-icon en sharedStyles). */
export function svgIcon(path: string): TemplateResult {
  return html`<svg class="svg-icon" viewBox="0 0 24 24" aria-hidden="true"><path d=${path}></path></svg>`;
}
