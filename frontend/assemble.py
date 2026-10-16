#!/usr/bin/env python3
"""
AssignFlow HTML Component Assembler & Integrity Checker.

Splits and maintains modular HTML components and pages in:
  - frontend/components/*.html
  - frontend/pages/*.html
And compiles them into frontend/index.html using frontend/index.template.html.

Usage:
  python3 frontend/assemble.py --build    # Compiles index.template.html into index.html
  python3 frontend/assemble.py --check    # Validates index.html is in sync with components
"""

import sys
import re
from pathlib import Path

FRONTEND_DIR = Path(__file__).resolve().parent
COMPONENTS_DIR = FRONTEND_DIR / "components"
PAGES_DIR = FRONTEND_DIR / "pages"
TEMPLATE_FILE = FRONTEND_DIR / "index.template.html"
TARGET_INDEX = FRONTEND_DIR / "index.html"


def assemble_html(template_content: str) -> str:
    """
    Replaces all `<!-- @include <relative_path> -->` tags with the contents of the referenced file.
    """
    pattern = re.compile(r"<!--\s*@include\s+([a-zA-Z0-9_\-\.\/]+)\s*-->")

    def replacer(match):
        rel_path = match.group(1).strip()
        target_path = FRONTEND_DIR / rel_path
        if not target_path.exists():
            raise FileNotFoundError(f"Referenced HTML component not found: {target_path}")

        component_content = target_path.read_text(encoding="utf-8").strip()
        return (
            f"<!-- BEGIN COMPONENT: {rel_path} -->\n"
            f"{component_content}\n"
            f"<!-- END COMPONENT: {rel_path} -->"
        )

    assembled = pattern.sub(replacer, template_content)
    return assembled


def main():
    if not TEMPLATE_FILE.exists():
        print(f"Error: Template file {TEMPLATE_FILE} does not exist.", file=sys.stderr)
        sys.exit(1)

    template_content = TEMPLATE_FILE.read_text(encoding="utf-8")
    assembled = assemble_html(template_content)

    if "--check" in sys.argv:
        if not TARGET_INDEX.exists():
            print(f"Error: {TARGET_INDEX} does not exist.", file=sys.stderr)
            sys.exit(1)
        current = TARGET_INDEX.read_text(encoding="utf-8")
        if current.strip() != assembled.strip():
            print("Error: frontend/index.html is out of sync with modular components. Run 'python3 frontend/assemble.py --build'.", file=sys.stderr)
            sys.exit(1)
        print("Success: frontend/index.html is in exact sync with all modular components.")
        sys.exit(0)

    # Build mode (default)
    TARGET_INDEX.write_text(assembled, encoding="utf-8")
    print(f"Successfully assembled {TARGET_INDEX} ({len(assembled.splitlines())} lines) from modular components.")


if __name__ == "__main__":
    main()
