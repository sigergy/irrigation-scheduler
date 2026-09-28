import { html, type TemplateResult } from "lit";

import type { Hass } from "../api";
import { t, type Key } from "../i18n";

export type Action = "run" | "resume" | "pause" | "stop";

export interface ButtonSpec {
  action: Action;
  run: (hass: Hass) => Promise<unknown>;
}

const GLYPHS: Record<Action, string> = { run: "▶", resume: "▶", pause: "⏸", stop: "■" };
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
    ${GLYPHS[spec.action]}${text ? ` ${text}` : ""}
  </button>`;
}
