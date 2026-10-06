# 6. Release con build del front (zip_release)

## Propuesta original

`zip_release: true` en `hacs.json` y una Action de release que compile el front. El `.js` deja
de commitearse.

## Situación actual

- Bundle commiteado: `custom_components/irrigation_scheduler/frontend/irrigation-scheduler.js`,
  unos 170 KB, con 40 commits en su historial. Mucho churn en los diffs.
- Riesgo real de desajuste entre `frontend/src` y el bundle commiteado.
- `hacs.json` no tiene `zip_release` ni `filename`.
- El CI (`.github/workflows/tests.yml`) solo cubre el backend: `ruff`, `compileall`, `pytest`.
  No compila ni lintea el front, aunque `frontend/package.json` define `build` (`vite build`)
  y `lint` (`eslint --max-warnings 0 .`).

## Veredicto

**Razonable. Prioridad media.**

## Plan

1. Job `frontend` en `tests.yml`: `npm ci`, `npm run lint`, `npm run build`.
2. Workflow de release (on: release published): build del front, zip de
   `custom_components/irrigation_scheduler` con el bundle y subida como asset.
3. `hacs.json`: `zip_release: true` y `filename` del zip.
4. Quitar el bundle del repo y añadirlo a `.gitignore`.

## Costes y consecuencias

- Instalar desde una rama deja de funcionar: solo valen las releases publicadas.
- El desarrollo local necesita `npm run build` antes de copiar a HA.
- Revisar que la ruta del bundle que sirve `__init__.py:58` (`add_extra_js_url`) y
  `adapters/card_resource.py` sigue existiendo en el zip.
