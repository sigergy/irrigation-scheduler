# Refactor de arquitectura — propuestas de mejora

Fecha: 2026-10-03. Estado: **en curso**. Hechos los apartados 1 y 2 (2026-10-04), pendientes de
validar en CI; el resto, propuesta sin implementar.

Análisis de ocho propuestas de mejora para `irrigation-scheduler`. Cada apartado tiene su
`specs.md` con contexto, evidencia `archivo:línea`, veredicto y plan.

| # | Propuesta | Veredicto | Coste | Estado |
|---|---|---|---|---|
| 1 | [Romper engine → api](01-snapshot-to-api/specs.md) | **Sí, ya** | Muy bajo | Hecho (`ac50b8d`) |
| 2 | [Test de capas](02-layer-test/specs.md) | **Sí**, con reglas ajustadas | Bajo | Hecho (`885a255`, `7da7f41`) |
| 3 | [Coste de cada señal](03-signal-cost/specs.md) | **Sí**, por partes y midiendo antes | Medio | Propuesta |
| 4 | [Puertos explícitos](04-ports/specs.md) | Dudoso; solo puntual | Alto | Propuesta |
| 5 | [Partir manager.py](05-split-manager/specs.md) | Parcial, con cuidado | Medio | Propuesta |
| 6 | [Release con build del front](06-release-build/specs.md) | Razonable | Medio | Propuesta |
| 7 | [tests/ en la raíz](07-tests-root/specs.md) | **No** | — | Descartada |
| 8 | [Señales finas y deltas por WS](08-fine-signals/specs.md) | **No** compensa | Alto | Descartada |

## Orden recomendado

1 → 2 (reglas ajustadas) → 6 → 5 (parcial, con el test del lock ampliado).
Descartar 7 y 8. La 4 solo de forma puntual. La 3 empieza por medir; el resto de sus pasos
depende de la medición.

La 1 y la 2 son pequeñas; la 2 depende de la 1 para la regla «engine no importa api».
