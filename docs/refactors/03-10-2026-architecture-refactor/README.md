# Refactor de arquitectura — propuestas de mejora

Fecha: 2026-10-03. Estado: **propuesta**, sin implementar.

Análisis de siete propuestas de mejora para `irrigation-scheduler`. Cada apartado tiene su
`specs.md` con contexto, evidencia `archivo:línea`, veredicto y plan.

| # | Propuesta | Veredicto | Coste |
|---|---|---|---|
| 1 | [Romper engine → api](01-snapshot-to-api/specs.md) | **Sí, ya** | Muy bajo |
| 2 | [Test de capas](02-layer-test/specs.md) | **Sí**, con reglas ajustadas | Bajo |
| 3 | [Puertos explícitos](03-ports/specs.md) | Dudoso; solo puntual | Alto |
| 4 | [Partir manager.py](04-split-manager/specs.md) | Parcial, con cuidado | Medio |
| 5 | [Release con build del front](05-release-build/specs.md) | Razonable | Medio |
| 6 | [tests/ en la raíz](06-tests-root/specs.md) | **No** | — |
| 7 | [Señales finas y deltas por WS](07-fine-signals/specs.md) | **No** compensa | Alto |

## Orden recomendado

1 → 2 (reglas ajustadas) → 5 → 4 (parcial, con el test del lock ampliado).
Descartar 6 y 7. La 3 solo de forma puntual.

La 1 y la 2 son pequeñas; la 2 depende de la 1 para la regla «engine no importa api».
