import { html, nothing, type TemplateResult } from "lit";

import type { Hass } from "../api";
import { t, type Key } from "../i18n";

export type Action = "run" | "resume" | "pause" | "stop";

export interface ButtonSpec {
  action: Action;
  run: (hass: Hass) => Promise<unknown>;
}

// iconos mdi en SVG: los caracteres ▶ ⏸ salen como emoji de color en Android
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
      void runCommand(host, hass, spec.run);
    }}
  >
    ${svgIcon(ICONS[spec.action])}${text ? html`<span class="text">${text}</span>` : nothing}
  </button>`;
}

/** Icono SVG de 24×24 que hereda el color del texto (clase .svg-icon en sharedStyles). */
export function svgIcon(path: string): TemplateResult {
  return html`<svg class="svg-icon" viewBox="0 0 24 24" aria-hidden="true"><path d=${path}></path></svg>`;
}
