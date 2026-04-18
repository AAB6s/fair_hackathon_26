from __future__ import annotations

import json
import os
from pathlib import Path


def main() -> None:
    root = Path(__file__).resolve().parent
    notebook_path = root / "phosphogypsum_training.ipynb"
    os.chdir(root)

    with notebook_path.open("r", encoding="utf-8") as handle:
        notebook = json.load(handle)

    namespace = {"__name__": "__main__"}

    for index, cell in enumerate(notebook["cells"], start=1):
        if cell.get("cell_type") != "code":
            continue

        source = "".join(cell.get("source", []))
        if not source.strip():
            continue

        print(f"Running notebook cell {index}...")
        exec(compile(source, f"<phosphogypsum_training:{index}>", "exec"), namespace)

    print("Model export complete.")


if __name__ == "__main__":
    main()
