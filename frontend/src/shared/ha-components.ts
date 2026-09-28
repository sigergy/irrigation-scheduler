// utilidades para convivir con los componentes nativos de HA

function register(name: string, ctor: CustomElementConstructor): void {
  // el bundle se carga desde el panel y desde los dashboards: no se redefine
  if (!customElements.get(name)) customElements.define(name, ctor);
}

export function define(name: string, ctor: CustomElementConstructor): void {
  register(name, ctor);
  // app.js de HA instala el polyfill de registros con ámbito y sustituye window.customElements.
  // Este bundle se importa en paralelo y puede terminar antes: lo registrado queda en el registro
  // nativo, invisible para el nuevo. Se repite el registro cuando HA ha arrancado.
  void customElements.whenDefined("home-assistant").then(() => register(name, ctor));
}

export function selectorValue<T>(ev: Event): T | undefined {
  return (ev as CustomEvent<{ value?: T }>).detail?.value;
}

interface LazyRoutes {
  routes: Record<string, { load: () => Promise<unknown> }>;
}

interface RouterElement extends HTMLElement {
  hass?: unknown;
  routerOptions: LazyRoutes;
  _updateRoutes?: () => void;
}

const LOAD_TIMEOUT_MS = 10_000;
let loading: Promise<void> | undefined;

async function load(): Promise<void> {
  if (customElements.get("ha-selector")) return;
  // HA carga ha-selector de forma perezosa: se fuerza cargando el editor de automatizaciones
  await customElements.whenDefined("partial-panel-resolver");
  const resolver = document.createElement("partial-panel-resolver") as RouterElement;
  resolver.hass = { panels: [{ url_path: "tmp", component_name: "config" }] };
  resolver._updateRoutes?.();
  await resolver.routerOptions.routes.tmp.load();
  await customElements.whenDefined("ha-panel-config");
  const config = document.createElement("ha-panel-config") as RouterElement;
  await config.routerOptions.routes.automation.load();
  await customElements.whenDefined("ha-selector");
}

/** Resuelve cuando ha-selector está definido o a los 10 s; nunca rechaza. */
export function loadHaComponents(): Promise<void> {
  loading ??= Promise.race([
    load().catch((err: unknown) => console.warn("Irrigation Scheduler: ha-selector", err)),
    new Promise<void>((resolve) => window.setTimeout(resolve, LOAD_TIMEOUT_MS)),
  ]);
  return loading;
}
