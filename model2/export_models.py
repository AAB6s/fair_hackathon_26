"""
Run the Panache training notebook non-interactively and export the trained
models plus a metadata.json so pipeline.py / api.py can serve predictions.

Mirrors the shape of model1/export_models.py but adds a few guards because
the Panache notebook calls matplotlib/seaborn/plotly/`display`/`!pip install`,
which would fail or block in a headless process.
"""
from __future__ import annotations

import json
import os
import sys
from pathlib import Path

# Force a headless matplotlib backend BEFORE anything imports pyplot.
import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt  # noqa: E402  (after backend switch)


def main() -> None:
    root = Path(__file__).resolve().parent
    notebook_path = root / "panache_training.ipynb"
    models_dir = root / "models"
    models_dir.mkdir(parents=True, exist_ok=True)
    os.chdir(root)

    with notebook_path.open("r", encoding="utf-8") as handle:
        notebook = json.load(handle)

    # Silence plots, IPython magics, and display() so the notebook
    # runs as a plain Python script.
    plt.show = lambda *args, **kwargs: None  # type: ignore[assignment]

    class _FakeFigure:
        def show(self, *args, **kwargs):
            return None

        def write_html(self, *args, **kwargs):
            return None

    def _fake_display(*args, **kwargs):  # noqa: D401 - shim for Jupyter display()
        return None

    namespace: dict = {
        "__name__": "__main__",
        "display": _fake_display,
        "get_ipython": lambda: None,
    }

    for index, cell in enumerate(notebook["cells"], start=1):
        if cell.get("cell_type") != "code":
            continue

        source_lines = cell.get("source", [])
        if isinstance(source_lines, str):
            source = source_lines
        else:
            source = "".join(source_lines)

        # Strip bash/IPython magics (`!pip ...`, `%matplotlib inline`, ...)
        filtered_lines = []
        for line in source.splitlines():
            stripped = line.lstrip()
            if stripped.startswith("!") or stripped.startswith("%"):
                continue
            filtered_lines.append(line)
        source = "\n".join(filtered_lines)

        if not source.strip():
            continue

        print(f"Running notebook cell {index}...")
        try:
            exec(compile(source, f"<panache_training:{index}>", "exec"), namespace)
        except SystemExit:
            break
        except Exception as err:  # surface the failing cell, then re-raise
            print(f"  !! cell {index} failed: {err.__class__.__name__}: {err}",
                  file=sys.stderr)
            raise

    # Collect metadata for the serving pipeline. These names come from the
    # notebook's save block (cell 29).
    meta = {
        "features_classification": namespace["features_cls"],
        "features_regression": namespace["features_reg"],
        "label_classes_decision": list(namespace["le"].classes_),
        "best_classifier": namespace["best_cls_name"],
        "best_regressor": namespace["best_reg_name"],
        "metrics": {
            "visibility_classifier": {
                "name": namespace["best_cls_name"],
                "accuracy": float(
                    namespace["results_cls"][namespace["best_cls_name"]]["acc"]
                ),
            },
            "power_regressor": {
                "name": namespace["best_reg_name"],
                "r2": float(
                    namespace["results_reg"][namespace["best_reg_name"]]["r2"]
                ),
                "rmse": float(
                    namespace["results_reg"][namespace["best_reg_name"]]["rmse"]
                ),
            },
            "decision_classifier": {
                "accuracy": float(namespace["acc_dec"]),
            },
        },
    }

    # Move the .pkl files the notebook produced into models/, alongside meta.json.
    # (The notebook writes them to the CWD, which is this folder.)
    for pkl_name in (
        "clf_visibilite_panache.pkl",
        "reg_puissance_chauffage.pkl",
        "clf_decision_ia.pkl",
        "scaler_classification.pkl",
        "label_encoder_decision.pkl",
    ):
        src = root / pkl_name
        if src.exists():
            dst = models_dir / pkl_name
            src.replace(dst)

    # Move the CSV next to the models too, matching model1's layout.
    csv_src = root / "dataset_panache_visuel.csv"
    if csv_src.exists():
        csv_src.replace(root / "dataset_panache_visuel.csv")  # keep in place

    # Move any generated PNGs into models/ to keep the folder tidy.
    for png in root.glob("*.png"):
        png.replace(models_dir / png.name)

    with (models_dir / "metadata.json").open("w", encoding="utf-8") as handle:
        json.dump(meta, handle, indent=2, ensure_ascii=False)

    print("Panache model export complete.")


if __name__ == "__main__":
    main()
