#!/usr/bin/env python3
"""
build_zip.py — Pack the entire AlgoReviewer project into algo_reviewer_project.zip

Excludes:
  - .venv / venv / env
  - node_modules
  - __pycache__ and *.pyc
  - .git and .gitignore artifacts
  - .next (Next.js build output)
  - out/ dist/ build/
  - *.egg-info
  - The zip file itself

Usage:
    python build_zip.py
    # → writes algo_reviewer_project.zip in the current directory
"""

from __future__ import annotations

import os
import sys
import zipfile
from pathlib import Path

# ── Configuration ─────────────────────────────────────────────────────────────

OUTPUT_ZIP = "algo_reviewer_project.zip"

EXCLUDE_DIRS = {
    ".venv", "venv", "env",
    "node_modules",
    "__pycache__",
    ".git",
    ".next",
    "out",
    "dist",
    "build",
    ".pytest_cache",
    ".mypy_cache",
    ".ruff_cache",
    "htmlcov",
    ".idea",
    ".vscode",
}

EXCLUDE_SUFFIXES = {
    ".pyc", ".pyo", ".pyd",
    ".DS_Store",
    ".egg-info",
    ".zip",          # avoid including old zips
    ".log",
}

EXCLUDE_FILES = {
    OUTPUT_ZIP,
    ".env",          # never ship secrets
}


# ── Helpers ───────────────────────────────────────────────────────────────────

def should_exclude(path: Path, root: Path) -> bool:
    """Return True if this path should be excluded from the zip."""
    parts = path.relative_to(root).parts

    # Skip any path that passes through an excluded directory
    for part in parts:
        if part in EXCLUDE_DIRS:
            return True

    # Skip by suffix
    if path.suffix in EXCLUDE_SUFFIXES:
        return True

    # Skip by exact filename
    if path.name in EXCLUDE_FILES:
        return True

    # Skip .egg-info directories (suffix check on name)
    for part in parts:
        if part.endswith(".egg-info"):
            return True

    return False


def build_zip(root: Path, output: Path) -> None:
    root = root.resolve()
    output = output.resolve()

    print(f"📦 Packing: {root}")
    print(f"📄 Output:  {output}\n")

    included = 0
    skipped  = 0

    with zipfile.ZipFile(output, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=6) as zf:
        for filepath in sorted(root.rglob("*")):
            if not filepath.is_file():
                continue
            if should_exclude(filepath, root):
                skipped += 1
                continue

            arcname = filepath.relative_to(root.parent)  # preserve top-level folder name
            zf.write(filepath, arcname)
            print(f"  ✓  {arcname}")
            included += 1

    size_kb = output.stat().st_size / 1024
    print(f"\n✅ Done! {included} files included, {skipped} excluded.")
    print(f"   Archive size: {size_kb:.1f} KB → {output.name}")


# ── Entry point ───────────────────────────────────────────────────────────────

if __name__ == "__main__":
    # Resolve project root as the directory containing this script
    script_dir = Path(__file__).parent.resolve()

    # Allow overriding output path via CLI arg
    out_path = Path(sys.argv[1]) if len(sys.argv) > 1 else script_dir / OUTPUT_ZIP

    build_zip(root=script_dir, output=out_path)
