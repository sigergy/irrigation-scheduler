import { css } from "lit";

// colores y fondos siempre con variables del tema de HA: claro y oscuro automáticos
export const sharedStyles = css`
  :host {
    color: var(--primary-text-color);
  }
  h3 {
    margin: 0;
    font-size: 1.1em;
    font-weight: 500;
  }
  ha-selector {
    display: block;
  }
  .muted {
    color: var(--secondary-text-color);
  }
  .card {
    background: var(--ha-card-background, var(--card-background-color));
    border: 1px solid var(--divider-color);
    border-radius: var(--ha-card-border-radius, 12px);
    padding: 16px;
  }
  .section {
    margin-bottom: 16px;
  }
  .label {
    font-weight: 500;
    margin-bottom: 8px;
  }
  .row {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
  }
  .small {
    font-size: 0.875em;
  }
  .error-text {
    color: var(--error-color);
    font-size: 0.8em;
    margin-top: 4px;
  }
  .banner {
    padding: 12px 16px;
    margin-bottom: 16px;
    border-radius: var(--ha-card-border-radius, 12px);
    display: flex;
    align-items: center;
    gap: 12px;
  }
  .banner.error {
    background: rgba(var(--rgb-error-color, 219, 68, 55), 0.15);
    color: var(--error-color);
  }
  .banner.warning {
    background: rgba(var(--rgb-warning-color, 255, 166, 0), 0.15);
  }
  .banner.info {
    background: rgba(var(--rgb-info-color, 3, 155, 229), 0.12);
  }
  .badge {
    display: inline-block;
    padding: 2px 8px;
    border-radius: 10px;
    font-size: 0.8em;
    font-weight: 500;
    white-space: nowrap;
  }
  .badge.running {
    background: var(--primary-color);
    color: var(--text-primary-color);
  }
  .badge.queued {
    background: var(--accent-color);
    color: var(--text-accent-color, var(--text-primary-color));
  }
  .badge.idle {
    background: var(--secondary-background-color);
    color: var(--primary-text-color);
  }
  .badge.stopped {
    background: var(--disabled-color, #bdbdbd);
    color: var(--text-primary-color);
  }
  button {
    font: inherit;
    cursor: pointer;
    border: 1px solid var(--divider-color);
    border-radius: 18px;
    background: transparent;
    color: var(--primary-color);
    padding: 4px 12px;
    min-height: 32px;
    white-space: nowrap;
  }
  button:disabled {
    cursor: default;
    opacity: 0.5;
  }
  button.danger {
    color: var(--error-color);
  }
  button.filled {
    background: var(--primary-color);
    border-color: var(--primary-color);
    color: var(--text-primary-color);
  }
  button.icon {
    border: none;
    min-width: 32px;
    padding: 4px 8px;
  }
  button.control {
    min-width: 36px;
    padding: 4px 8px;
  }
  .chips {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    align-items: center;
  }
  .chip {
    border-radius: 16px;
    padding: 4px 10px;
    min-height: 28px;
    color: var(--primary-text-color);
  }
  .chip.on {
    background: var(--primary-color);
    border-color: var(--primary-color);
    color: var(--text-primary-color);
  }
  .list-row {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 16px;
    border-bottom: 1px solid var(--divider-color);
    cursor: pointer;
  }
  .list-row:last-child {
    border-bottom: none;
  }
  .progress {
    height: 4px;
    border-radius: 2px;
    background: var(--divider-color);
    overflow: hidden;
    margin-top: 4px;
  }
  .progress > div {
    height: 100%;
    background: var(--primary-color);
  }
  .spacer {
    flex: 1;
  }
  select,
  input {
    font: inherit;
    color: var(--primary-text-color);
    background: var(--card-background-color);
    border: 1px solid var(--divider-color);
    border-radius: 16px;
    padding: 4px 10px;
    min-height: 30px;
    color-scheme: light dark;
  }
`;

export const toolbarStyles = css`
  .toolbar {
    display: flex;
    align-items: center;
    gap: 8px;
    height: 56px;
    padding: 0 12px;
    position: sticky;
    top: 0;
    z-index: 2;
    background: var(--app-header-background-color);
    color: var(--app-header-text-color, var(--text-primary-color));
    border-bottom: var(--app-header-border-bottom, none);
  }
  .toolbar .title {
    font-size: 20px;
    margin-right: 12px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .toolbar button {
    color: inherit;
    border-color: currentColor;
  }
  .toolbar button.filled {
    background: var(--app-header-text-color, var(--text-primary-color));
    color: var(--app-header-background-color, var(--primary-color));
  }
  .toolbar .tab {
    border: none;
    border-radius: 0;
    border-bottom: 2px solid transparent;
  }
  .toolbar .tab.active {
    border-bottom-color: currentColor;
  }
`;
