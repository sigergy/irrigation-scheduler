# Historial de `05-rain-skip.md`

Solo lectura. Fecha del informe: 2026-10-06. Rama: `sigergy/ha-restart-fallbacks-impl`.

## Conclusión

`docs/specs/05-rain-skip.md` **se renombró**, no se borró. Nuevo nombre: `docs/features/rain-skip/spec.md`.
Commit: `13fc896` (2026-10-03, Carlosjcfr, «docs: reestructurar y limpiar carpetas legacy de documentacion»).
Similitud git: 97 % (`R097`). La numeración §8.x se conserva entera.
Las 27 citas de `docs/features/alerts/spec.md` a `05-rain-skip.md` apuntan al nombre antiguo. No se perdió contenido.

## 1. Ficheros borrados o renombrados con `rain-skip` en el nombre

Comando: `git log --all --diff-filter=DR --name-status --format='%h %ad %an %s' --date=short -- '*rain-skip*' '*rain_skip*'`

| Commit | Fecha | Autor | Mensaje | Cambio |
|---|---|---|---|---|
| `13fc896` | 2026-10-03 | Carlosjcfr | docs: reestructurar y limpiar carpetas legacy de documentacion | `R097 docs/specs/05-rain-skip.md -> docs/features/rain-skip/spec.md` |
| `0e57b2d` | 2026-09-30 | Carlosjcfr | docs: borra los planes ya ejecutados y el ejemplo de push sustituido | `D docs/superpowers/plans/2026-09-29-rain-skip.md` |

El segundo es un plan ejecutado, no la spec. No lo cita la spec de alertas (no se comprobó fuera de ella).

## 2. Ramas que contienen cada commit

Comando: `git branch -a --contains <sha>`

- `13fc896`: `architecture-refactor`, `clean-refactor`, `docs/architecture-review`, `feat/ha-restart-fallbacks`, `main`, `sigergy/ha-restart-fallbacks-impl` y sus remotos (`origin/main`, `origin/clean-refactor`, `origin/architecture-refactor`, `origin/docs/architecture-review`, `origin/sigergy/ha-restart-fallbacks-impl`, `origin/chore/version-1.2.0b2`).
- `0e57b2d`: las anteriores más `docs/rain-estimated`, `docs/zone-icon`, `feat/cast-notifies`.

Comprobación: `git ls-tree -r --name-only main | grep -c '05-rain'` da `0`. En `main` el fichero antiguo ya no existe.

## 3. Historial completo de la spec

Comando: `git log --all --follow --name-status -- docs/features/rain-skip/spec.md`

- `ad34622` 2026-09-28: A `docs/specs/05-rain-skip.md`
- `ed1d237`, `c5829ab`, `4001b11` (2026-09-29), `fbf9323`, `0e57b2d` (2026-09-30): M
- `13fc896` 2026-10-03: R097 a `docs/features/rain-skip/spec.md`

Antes del rename, `git ls-tree -r --name-only 13fc896^` lista `docs/specs/05-rain-skip.md` y el resto `00`–`04`. Último commit con el nombre antiguo: `13fc896^`.
Hoy: `git ls-tree -r --name-only HEAD | grep -E '05-|rain'` no muestra `05-rain-skip.md`.

## 4. Comparación de contenido

Comando: `git diff -M 13fc896^:docs/specs/05-rain-skip.md 13fc896:docs/features/rain-skip/spec.md`
Resultado: 6 inserciones, 5 borrados. Solo cambian:

- Título: `# 05 · Omisión de riego por lluvia` pasa a `# Omisión de riego por lluvia — especificación`.
- Cabecera: se quita «Fase 5»; fecha 2026-09-29 pasa a 2026-10-03; enlaces `00-overview.md` y `03-valves-execution.md` pasan a rutas nuevas; se añade enlace a `rain-estimated-design.md`.
- Dos referencias `docs/alerts/` pasan a `docs/features/alerts/` (en §8 intro y en el último punto).

### Encabezados (`grep -n '^#'`)

Versión antigua (`13fc896^:docs/specs/05-rain-skip.md`), 13 encabezados:
`# 05 · Omisión…`, §1 Propósito, §2 Fuentes de lluvia, §3 Configuración, §3.1 Global, §3.2 Por zona, §4 Regla de decisión, §5 Ejecuciones afectadas, §6 Fallo de una fuente, §7 Entidades, eventos y notificaciones, §7.1 Agrupación del push de omisión, §8 Revisión 2026-09-29, §8.1 Ampliación 2026-09-29 (revisión de huecos).

Versión actual (`docs/features/rain-skip/spec.md`), 13 encabezados: los mismos, salvo el título. Las líneas se desplazan +1 por la línea extra de cabecera.

### Numeración §8.x

Los «§8.N» de la spec de alertas son los puntos numerados de la lista de §8, no subencabezados. `grep -E '^[0-9]+\. '` sobre §8 da 28 puntos en ambas versiones (1 a 28). Citados desde alertas: §8.2, 3, 4, 6, 7, 9, 10, 11, 12, 13, 15, 16, 17, 19, 20, 21, 26. Todos existen. §8.10, §8.11, §8.15, §8.19 y §8.20 siguen en su sitio (el punto 10 empieza «Omitir por lluvia sigue siendo por zona», el 11 «Lotes: un disparador por hora de inicio», el 15 «Arranque de HA: esperar a las fuentes», el 19 «Episodio de lluvia por zona», el 20 «Un push por lote…»).

## 5. Contenido perdido

Ninguno en la spec. Sin sustituto que buscar.

## 6. Acción pendiente (no ejecutada)

Las 27 citas en `docs/features/alerts/spec.md` (`grep -o '05-rain-skip[^ )]*'`) deben apuntar a `docs/features/rain-skip/spec.md`. No se ha editado nada.
