import { css, html, LitElement, nothing } from "lit";

import type { Hass } from "../api";
import { t } from "../i18n";
import { define } from "./ha-components";
import { sharedStyles } from "./styles";

// el dialog-box de HA se carga bajo demanda y una integración no puede forzar su carga:
// diálogo propio con <dialog> modal y variables del tema de HA

const TAG = "irrigation-confirm-dialog";

export interface ConfirmOptions {
  text: string;
  confirmText: string;
  /** por defecto «Cancelar» */
  cancelText?: string;
  destructive?: boolean;
  /** solo el botón de confirmar: aviso sin elección */
  single?: boolean;
}

class ConfirmDialog extends LitElement {
  declare hass: Hass | undefined;
  declare options: ConfirmOptions;
  declare done: (confirmed: boolean) => void;

  protected firstUpdated(): void {
    this.renderRoot.querySelector("dialog")?.showModal();
  }

  private close(confirmed: boolean): void {
    this.renderRoot.querySelector("dialog")?.close();
    this.done(confirmed);
  }

  protected render() {
    const { text, confirmText, cancelText, destructive, single } = this.options;
    return html`<dialog
      @cancel=${(ev: Event) => {
        // Esc: se cierra aquí para resolver la promesa una sola vez
        ev.preventDefault();
        this.close(false);
      }}
      @click=${(ev: Event) => {
        // clic en el fondo: el target es el propio <dialog>
        if (ev.target === ev.currentTarget) this.close(false);
      }}
    >
      <div class="body">${text}</div>
      <div class="actions">
        ${single ? nothing : html`<button @click=${() => this.close(false)}>${cancelText ?? t(this.hass, "cancel")}</button>`}
        <button class=${destructive ? "destructive" : "filled"} autofocus @click=${() => this.close(true)}>
          ${confirmText}
        </button>
      </div>
    </dialog>`;
  }

  static styles = [
    sharedStyles,
    css`
      dialog {
        padding: 0;
        border: none;
        border-radius: var(--ha-dialog-border-radius, 24px);
        background: var(--ha-dialog-surface-background, var(--card-background-color));
        color: var(--primary-text-color);
        max-width: min(420px, calc(100vw - 32px));
        box-shadow: var(--ha-card-box-shadow, 0 8px 24px rgba(0, 0, 0, 0.4));
      }
      dialog::backdrop {
        background: var(--mdc-dialog-scrim-color, rgba(0, 0, 0, 0.32));
      }
      .body {
        padding: 24px 24px 8px;
        line-height: 1.5;
      }
      .actions {
        display: flex;
        justify-content: flex-end;
        gap: 8px;
        padding: 16px 24px 24px;
      }
      button.destructive {
        background: var(--error-color);
        border-color: var(--error-color);
        color: var(--text-primary-color, #fff);
      }
    `,
  ];
}

define(TAG, ConfirmDialog);

/** Pide confirmación en un diálogo modal de la página; resuelve true al confirmar. */
export function confirmDialog(hass: Hass | undefined, options: ConfirmOptions): Promise<boolean> {
  return new Promise((resolve) => {
    const dialog = document.createElement(TAG) as ConfirmDialog;
    dialog.hass = hass;
    dialog.options = options;
    dialog.done = (confirmed) => {
      dialog.remove();
      resolve(confirmed);
    };
    document.body.append(dialog);
  });
}

/** Aviso modal con un solo botón. */
export async function alertDialog(hass: Hass | undefined, text: string): Promise<void> {
  await confirmDialog(hass, { text, confirmText: t(hass, "dialog_ok"), single: true });
}
