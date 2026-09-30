import { css, html, nothing, type TemplateResult } from "lit";

// pop up de la línea de tiempo: uno por tarjeta, anclado a la barra o marca que lo abrió

export interface Tip {
  title: string;
  lines: string[];
}

/** Lo llaman las vistas: con `tip` lo abre sobre `target`; sin él, lo cierra si es de `target`. */
export type TipHandler = (target: Element, tip?: Tip) => void;

// separación entre el pop up y su ancla, en px
const GAP = 6;

export function renderTip(tip: Tip | undefined): TemplateResult | typeof nothing {
  if (!tip) return nothing;
  return html`<div class="tip" role="tooltip">
    <div class="tip-title">${tip.title}</div>
    ${tip.lines.map((line) => html`<div class="small">${line}</div>`)}
  </div>`;
}

/** Tras pintar: encima del ancla, o debajo si no cabe; siempre dentro del ancho del contenedor. */
export function placeTip(el: HTMLElement, target: Element, container: HTMLElement): void {
  const box = target.getBoundingClientRect();
  const base = container.getBoundingClientRect();
  const width = el.offsetWidth;
  const center = box.left + box.width / 2 - base.left;
  const left = Math.min(Math.max(center - width / 2, 0), Math.max(container.clientWidth - width, 0));
  const above = box.top - base.top - GAP - el.offsetHeight;
  el.style.left = `${left}px`;
  el.style.top = `${above >= 0 ? above : box.bottom - base.top + GAP}px`;
}

/** Ratón: abre al entrar y cierra al salir. Táctil y teclado: abre al pulsar. */
export function tipEvents(onTip: TipHandler, tip: Tip) {
  return {
    enter: (ev: PointerEvent) => {
      if (ev.pointerType === "mouse") onTip(ev.currentTarget as Element, tip);
    },
    leave: (ev: PointerEvent) => {
      if (ev.pointerType === "mouse") onTip(ev.currentTarget as Element);
    },
    click: (ev: Event) => {
      // la tarjeta cierra el pop up con cualquier otro clic
      ev.stopPropagation();
      onTip(ev.currentTarget as Element, tip);
    },
  };
}

export const tipStyles = css`
  .tip {
    position: absolute;
    z-index: 2;
    max-width: 240px;
    padding: 6px 10px;
    border: 1px solid var(--divider-color);
    border-radius: var(--ha-card-border-radius, 12px);
    background: var(--card-background-color);
    color: var(--primary-text-color);
    box-shadow: var(--ha-card-box-shadow, 0 2px 8px rgba(0, 0, 0, 0.25));
    pointer-events: none;
  }
  .tip-title {
    font-weight: 500;
  }
`;
