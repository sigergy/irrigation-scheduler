"""Las transiciones de ValveSlots solo se llaman con el lock del manager tomado."""

from __future__ import annotations

import ast
from pathlib import Path

from custom_components.irrigation_scheduler.engine.slots import MUTATORS

# manager.py sigue en la raíz del paquete hasta la Task 16, que lo pasa a parents[1]
MANAGER = Path(__file__).parents[1] / "manager.py"


def _holds_lock(node: ast.AST, parents: dict[ast.AST, ast.AST]) -> bool:
    while node in parents:
        node = parents[node]
        if isinstance(node, ast.AsyncWith) and any(
            ast.unparse(item.context_expr) == "self._lock" for item in node.items
        ):
            return True
        if isinstance(node, ast.FunctionDef | ast.AsyncFunctionDef):
            return node.name.endswith("_locked")
    return False


def test_slot_mutators_run_under_lock() -> None:
    tree = ast.parse(MANAGER.read_text(encoding="utf-8"))
    parents = {child: parent for parent in ast.walk(tree) for child in ast.iter_child_nodes(parent)}
    offenders = [
        f"{MANAGER.name}:{node.lineno} {node.func.attr}"
        for node in ast.walk(tree)
        if isinstance(node, ast.Call)
        and isinstance(node.func, ast.Attribute)
        and node.func.attr in MUTATORS
        and ast.unparse(node.func.value) == "self._slots"
        and not _holds_lock(node, parents)
    ]
    assert offenders == []
    # sin llamadas a slots el test no prueba nada
    assert "self._slots." in MANAGER.read_text(encoding="utf-8")
