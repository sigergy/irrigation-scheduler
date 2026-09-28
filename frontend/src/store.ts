import type { ReactiveController, ReactiveControllerHost } from "lit";

import { SUBSCRIBE, type Connection, type Hass, type Snapshot } from "./api";

// una suscripción por conexión, compartida por el panel y todas las tarjetas (02 §3.3)

export type StoreError = "not_loaded" | "unknown";

export interface StoreState {
  snapshot?: Snapshot;
  error?: StoreError;
}

type Listener = (state: StoreState) => void;

interface Entry {
  state: StoreState;
  listeners: Set<Listener>;
  unsubscribe?: Promise<() => Promise<void>>;
  retry?: number;
}

const RETRY_MS = 30_000;
const entries = new WeakMap<Connection, Entry>();

function publish(entry: Entry, state: StoreState): void {
  entry.state = state;
  for (const listener of entry.listeners) listener(state);
}

function open(connection: Connection, entry: Entry): void {
  // resubscribe (por defecto en HA): al reconectar se vuelve a suscribir solo
  const pending = connection.subscribeMessage<Snapshot>((snapshot) => publish(entry, { snapshot }), {
    type: SUBSCRIBE,
  });
  entry.unsubscribe = pending;
  pending.catch((err: unknown) => {
    if (entry.unsubscribe !== pending) return;
    entry.unsubscribe = undefined;
    const code = (err as { code?: unknown } | null)?.code;
    publish(entry, { error: code === "not_loaded" ? "not_loaded" : "unknown" });
    // la integración puede cargarse más tarde
    entry.retry = window.setTimeout(() => {
      entry.retry = undefined;
      if (entry.listeners.size) open(connection, entry);
    }, RETRY_MS);
  });
}

export function subscribeSnapshot(connection: Connection, listener: Listener): () => void {
  let entry = entries.get(connection);
  if (!entry) {
    entry = { state: {}, listeners: new Set() };
    entries.set(connection, entry);
  }
  const current = entry;
  current.listeners.add(listener);
  if (current.state.snapshot || current.state.error) listener(current.state);
  if (!current.unsubscribe && current.retry === undefined) open(connection, current);
  return () => {
    current.listeners.delete(listener);
    if (current.listeners.size) return;
    // sin consumidores: se cierra la suscripción
    window.clearTimeout(current.retry);
    current.retry = undefined;
    const pending = current.unsubscribe;
    current.unsubscribe = undefined;
    current.state = {};
    pending?.then((unsubscribe) => unsubscribe()).catch(() => undefined);
  };
}

/** Estado en vivo para un componente con `hass`; cambia de suscripción si cambia la conexión. */
export class SnapshotController implements ReactiveController {
  state: StoreState = {};
  private readonly host: ReactiveControllerHost & { hass?: Hass };
  private connection?: Connection;
  private release?: () => void;

  constructor(host: ReactiveControllerHost & { hass?: Hass }) {
    this.host = host;
    host.addController(this);
  }

  hostConnected(): void {
    this.sync();
  }

  hostUpdate(): void {
    this.sync();
  }

  hostDisconnected(): void {
    this.release?.();
    this.release = undefined;
    this.connection = undefined;
  }

  private sync(): void {
    const connection = this.host.hass?.connection;
    if (connection === this.connection) return;
    this.release?.();
    this.connection = connection;
    this.state = {};
    this.release = connection
      ? subscribeSnapshot(connection, (state) => {
          this.state = state;
          this.host.requestUpdate();
        })
      : undefined;
  }
}

/** Repinta cada segundo: tiempo restante y progreso se calculan en el cliente (02 §3.3). */
export class TickController implements ReactiveController {
  private readonly host: ReactiveControllerHost;
  private timer?: number;

  constructor(host: ReactiveControllerHost) {
    this.host = host;
    host.addController(this);
  }

  hostConnected(): void {
    this.timer = window.setInterval(() => this.host.requestUpdate(), 1000);
  }

  hostDisconnected(): void {
    window.clearInterval(this.timer);
    this.timer = undefined;
  }
}
