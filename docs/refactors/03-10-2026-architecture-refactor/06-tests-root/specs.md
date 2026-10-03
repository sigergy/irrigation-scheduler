# 6. tests/ en la raíz del repo

## Propuesta original

Mover los tests a `tests/` en la raíz, fuera del paquete.

## Situación actual

- La convención acordada en el proyecto es tests colocados junto al código, en
  `<subcarpeta>/tests/`: `engine/tests/`, `entities/tests/`.
- `pyproject.toml` la respalda: `testpaths = ["custom_components"]`, `pythonpath = ["."]`.
- `engine/tests/test_lock.py:11` localiza `manager.py` por ruta relativa
  (`Path(__file__).parents[1]`).

## Análisis

- El motivo habitual para sacarlos es no distribuirlos al usuario. Con `zip_release`
  (apartado 5) el zip puede excluir `*/tests/` y ese motivo desaparece.
- Moverlos rompe la convención acordada y las rutas relativas de los tests sin aportar nada.

## Veredicto

**No.** Contradice una decisión vigente del proyecto.

## Alternativa

Excluir `**/tests/` al empaquetar el zip de release (apartado 5).
