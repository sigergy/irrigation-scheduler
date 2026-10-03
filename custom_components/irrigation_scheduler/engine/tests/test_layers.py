"""Las capas respetan sus dependencias: domain y engine no importan capas superiores."""

from __future__ import annotations

import ast
from pathlib import Path

PACKAGE_DIR = Path(__file__).parents[2]
ROOT = ("custom_components", PACKAGE_DIR.name)

# capa -> capas que no puede importar
FORBIDDEN = {
    "domain": {"engine", "api", "entities", "adapters", "homeassistant"},
    "engine": {"api", "entities"},
}
# los imports bajo TYPE_CHECKING cuentan en domain y se ignoran en engine
COUNT_TYPE_CHECKING = {"domain": True, "engine": False}


def _is_type_checking(node: ast.AST) -> bool:
    return isinstance(node, ast.If) and ast.unparse(node.test) in (
        "TYPE_CHECKING",
        "typing.TYPE_CHECKING",
    )


def _absolute_module(node: ast.ImportFrom, package: tuple[str, ...]) -> str:
    """Resuelve el módulo de un `from` relativo a nombre absoluto."""
    base = package[: len(package) - (node.level - 1)] if node.level else ()
    return ".".join([*base, *([node.module] if node.module else [])])


def _imports(node: ast.AST, package: tuple[str, ...], include_type_checking: bool) -> list[tuple[int, str]]:
    """Devuelve (línea, módulo absoluto) de cada import bajo el nodo."""
    found: list[tuple[int, str]] = []
    for child in ast.iter_child_nodes(node):
        if isinstance(child, ast.Import):
            found.extend((child.lineno, alias.name) for alias in child.names)
        elif isinstance(child, ast.ImportFrom):
            module = _absolute_module(child, package)
            if child.module:
                found.append((child.lineno, module))
            else:
                # `from . import x`: el destino es cada nombre importado
                found.extend((child.lineno, f"{module}.{alias.name}") for alias in child.names)
        elif _is_type_checking(child) and not include_type_checking:
            # se ignora el cuerpo de `if TYPE_CHECKING:`; el else sí cuenta
            orelse = ast.Module(body=child.orelse, type_ignores=[])
            found.extend(_imports(orelse, package, include_type_checking))
        else:
            found.extend(_imports(child, package, include_type_checking))
    return found


def _target_layer(module: str) -> str | None:
    """Capa de destino de un módulo absoluto, o None si es ajeno al proyecto."""
    parts = module.split(".")
    if parts[0] == "homeassistant":
        return "homeassistant"
    if tuple(parts[:2]) == ROOT and len(parts) > 2:
        return parts[2]
    return None


def _violations(layer: str) -> tuple[list[str], int]:
    files = sorted((PACKAGE_DIR / layer).glob("*.py"))
    package = (*ROOT, layer)
    offenders: list[str] = []
    for path in files:
        tree = ast.parse(path.read_text(encoding="utf-8"))
        for lineno, module in _imports(tree, package, COUNT_TYPE_CHECKING[layer]):
            if _target_layer(module) in FORBIDDEN[layer]:
                offenders.append(f"{path.relative_to(PACKAGE_DIR).as_posix()}:{lineno} {module}")
    return offenders, len(files)


def test_domain_layer_imports() -> None:
    offenders, analyzed = _violations("domain")
    assert not offenders, "\n".join(offenders)
    # sin ficheros analizados el test no prueba nada
    assert analyzed > 0


def test_engine_layer_imports() -> None:
    offenders, analyzed = _violations("engine")
    assert not offenders, "\n".join(offenders)
    assert analyzed > 0
