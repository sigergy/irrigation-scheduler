"""Las transiciones de ValveSlots y los métodos `*_locked` solo se llaman con el lock del manager.

Recorre todos los módulos de engine/: al mover código fuera de manager.py el lock no se pierde.
"""

from __future__ import annotations

import ast
from dataclasses import dataclass
from pathlib import Path

from custom_components.irrigation_scheduler.engine.slots import MUTATORS

ENGINE_DIR = Path(__file__).parents[1]
# slots.py define los MUTATORS: dentro de ValveSlots no hay lock que comprobar
EXCLUDED = {"slots.py"}


@dataclass(frozen=True)
class GuardedCall:
    """Llamada que exige el lock: un MUTATOR de ValveSlots o un método `*_locked`."""

    path: Path
    lineno: int
    call: str
    is_mutator: bool
    holds_lock: bool


def _engine_files() -> list[Path]:
    return sorted(path for path in ENGINE_DIR.glob("*.py") if path.name not in EXCLUDED)


def _holds_lock(node: ast.AST, parents: dict[ast.AST, ast.AST]) -> bool:
    """Dentro de `async with <expr>._lock` o de una función `*_locked`; manda la función más cercana."""
    while node in parents:
        node = parents[node]
        if isinstance(node, ast.AsyncWith) and any(
            isinstance(item.context_expr, ast.Attribute) and item.context_expr.attr == "_lock"
            for item in node.items
        ):
            return True
        if isinstance(node, ast.FunctionDef | ast.AsyncFunctionDef):
            return node.name.endswith("_locked")
    return False


def _scope(node: ast.AST, parents: dict[ast.AST, ast.AST]) -> ast.AST:
    """Función que contiene el nodo, o el módulo si no hay ninguna."""
    while node in parents:
        node = parents[node]
        if isinstance(node, ast.FunctionDef | ast.AsyncFunctionDef):
            return node
    return node


def _is_slots(expr: ast.AST) -> bool:
    return isinstance(expr, ast.Attribute) and expr.attr == "_slots"


def _is_valve_slots(annotation: ast.AST | None) -> bool:
    """Anotación `ValveSlots`, `x.ValveSlots` o `"ValveSlots"`."""
    return (
        (isinstance(annotation, ast.Name) and annotation.id == "ValveSlots")
        or (isinstance(annotation, ast.Attribute) and annotation.attr == "ValveSlots")
        or (isinstance(annotation, ast.Constant) and annotation.value == "ValveSlots")
    )


def _slot_aliases(scope: ast.AST) -> set[str]:
    """Nombres del ámbito que apuntan a un ValveSlots.

    Parámetros anotados `ValveSlots` y asignaciones desde `<expr>._slots`
    (p. ej. `slots = manager._slots`) o anotadas `ValveSlots`.
    """
    aliases: set[str] = set()
    if isinstance(scope, ast.FunctionDef | ast.AsyncFunctionDef):
        args = scope.args
        aliases |= {
            arg.arg
            for arg in [*args.posonlyargs, *args.args, *args.kwonlyargs]
            if _is_valve_slots(arg.annotation)
        }
    for node in ast.walk(scope):
        if isinstance(node, ast.Assign) and _is_slots(node.value):
            aliases |= {target.id for target in node.targets if isinstance(target, ast.Name)}
        elif (
            isinstance(node, ast.AnnAssign)
            and isinstance(node.target, ast.Name)
            and (_is_valve_slots(node.annotation) or (node.value is not None and _is_slots(node.value)))
        ):
            aliases.add(node.target.id)
    return aliases


def _scope_aliases(scope: ast.AST, cache: dict[ast.AST, set[str]]) -> set[str]:
    if scope not in cache:
        cache[scope] = _slot_aliases(scope)
    return cache[scope]


def _guarded_calls(path: Path) -> list[GuardedCall]:
    tree = ast.parse(path.read_text(encoding="utf-8"))
    parents = {child: parent for parent in ast.walk(tree) for child in ast.iter_child_nodes(parent)}
    # alias calculados una vez por ámbito
    aliases: dict[ast.AST, set[str]] = {}
    found: list[GuardedCall] = []
    for node in ast.walk(tree):
        if not (isinstance(node, ast.Call) and isinstance(node.func, ast.Attribute)):
            continue
        receiver, name = node.func.value, node.func.attr
        is_mutator = name in MUTATORS and (
            _is_slots(receiver)
            or (
                isinstance(receiver, ast.Name)
                and receiver.id in _scope_aliases(_scope(node, parents), aliases)
            )
        )
        if is_mutator or name.endswith("_locked"):
            found.append(
                GuardedCall(path, node.lineno, ast.unparse(node.func), is_mutator, _holds_lock(node, parents))
            )
    return found


def test_guarded_calls_run_under_lock() -> None:
    calls = [call for path in _engine_files() for call in _guarded_calls(path)]
    offenders = [
        f"{call.path.relative_to(ENGINE_DIR).as_posix()}:{call.lineno} {call.call}"
        for call in calls
        if not call.holds_lock
    ]
    assert not offenders, "\n".join(offenders)
    # sin llamadas analizadas, o sin ningún MUTATOR, el test no prueba nada
    assert calls, "no guarded calls found in engine/"
    assert any(call.is_mutator for call in calls), "no ValveSlots mutator calls found in engine/"
