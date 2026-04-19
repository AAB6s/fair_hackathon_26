"""
Serving pipeline for the Panache (visible plume) control models.

Loads the three models the notebook trains:
  - clf_visibilite_panache  : predicts whether the plume is visible
  - reg_puissance_chauffage : predicts optimal heating power (kW)
  - clf_decision_ia         : predicts the categorical action to take

plus the StandardScaler (used only by LogisticRegression inside the
visibility classifier when it was the winner) and the LabelEncoder
for decisions.
"""
from __future__ import annotations

import json
import pickle
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd


TARIF_KWH = 0.18  # DT per kWh, same constant as the notebook.


def _load_pickle(path: Path) -> Any:
    with path.open("rb") as handle:
        return pickle.load(handle)


class PanachePipeline:
    """Loads the saved artefacts and exposes `.predict()` / `.report()`."""

    def __init__(self, models_dir: str | Path = "models") -> None:
        base_dir = Path(__file__).resolve().parent
        candidate = Path(models_dir)
        self.models_dir = candidate if candidate.is_absolute() else base_dir / candidate

        with (self.models_dir / "metadata.json").open("r", encoding="utf-8") as handle:
            self.meta = json.load(handle)

        self.features_cls: list[str] = self.meta["features_classification"]
        self.features_reg: list[str] = self.meta["features_regression"]
        self.best_cls: str = self.meta["best_classifier"]
        self.best_reg: str = self.meta["best_regressor"]

        self.scaler = _load_pickle(self.models_dir / "scaler_classification.pkl")
        self.clf_visibility = _load_pickle(self.models_dir / "clf_visibilite_panache.pkl")
        self.reg_power = _load_pickle(self.models_dir / "reg_puissance_chauffage.pkl")
        self.clf_decision = _load_pickle(self.models_dir / "clf_decision_ia.pkl")
        self.label_encoder = _load_pickle(self.models_dir / "label_encoder_decision.pkl")

    # ------------------------------------------------------------------ utils
    def _ensure_frame(self, inputs: dict | list | pd.DataFrame) -> pd.DataFrame:
        if isinstance(inputs, dict):
            df = pd.DataFrame([inputs])
        elif isinstance(inputs, list):
            df = pd.DataFrame(inputs)
        elif isinstance(inputs, pd.DataFrame):
            df = inputs.copy()
        else:
            raise TypeError("inputs must be a dict, list of dicts, or DataFrame")
        return df

    def _prepare_cls(self, df: pd.DataFrame) -> np.ndarray:
        missing = [c for c in self.features_cls if c not in df.columns]
        if missing:
            raise ValueError(f"Missing features for classification: {missing}")
        return df[self.features_cls].to_numpy()

    def _prepare_reg(self, df: pd.DataFrame) -> np.ndarray:
        missing = [c for c in self.features_reg if c not in df.columns]
        if missing:
            raise ValueError(f"Missing features for regression: {missing}")
        return df[self.features_reg].to_numpy()

    # --------------------------------------------------------------- predict
    def predict(self, inputs: dict | list | pd.DataFrame) -> dict | pd.DataFrame:
        df = self._ensure_frame(inputs)
        X_cls_raw = self._prepare_cls(df)
        X_reg_raw = self._prepare_reg(df)

        # LogReg was trained on scaled features; tree models on raw. We always
        # feed the scaled features to LogReg and raw features to the others.
        if self.best_cls.lower().startswith("logistic"):
            X_cls = self.scaler.transform(X_cls_raw)
        else:
            X_cls = X_cls_raw

        visible = self.clf_visibility.predict(X_cls)
        if hasattr(self.clf_visibility, "predict_proba"):
            prob_visible = self.clf_visibility.predict_proba(X_cls)[:, 1]
        else:
            prob_visible = visible.astype(float)

        # Regressor only makes sense during active hours; outside that window
        # we force the power to 0 (matches the notebook's PanacheControlSystem).
        hour_col = df["heure"].to_numpy()
        active_mask = (hour_col >= 6) & (hour_col <= 22)
        power = np.zeros(len(df), dtype=float)
        if active_mask.any():
            power[active_mask] = np.maximum(
                0.0, self.reg_power.predict(X_reg_raw[active_mask])
            )

        decision_encoded = self.clf_decision.predict(X_cls)
        decision = self.label_encoder.inverse_transform(decision_encoded)

        continuous_power = np.where(active_mask, 120.0, 60.0)
        savings_per_hour = (continuous_power - power) * TARIF_KWH

        out = pd.DataFrame(
            {
                "panache_visible": visible.astype(int),
                "prob_visible": np.round(prob_visible, 4),
                "puissance_kW": np.round(power, 2),
                "puissance_continue_kW": continuous_power,
                "economie_horaire_DT": np.round(savings_per_hour, 3),
                "decision": decision,
            }
        )

        if len(out) == 1:
            return out.iloc[0].to_dict()
        return out

    # ---------------------------------------------------------------- report
    def report(self, inputs: dict) -> str:
        prediction = self.predict(inputs)
        if not isinstance(prediction, dict):
            raise TypeError("report() only supports a single sample")

        emoji_map = {
            "nuit_inactif": ("🌙", "Nuit — Système inactif", "Aucune action requise"),
            "chauffage_inutile": (
                "✅",
                "Panache naturellement invisible",
                "Désactiver le chauffage",
            ),
            "chauffage_leger": (
                "🟡",
                "Faible risque de panache",
                f"Chauffage léger : {prediction['puissance_kW']:.0f} kW",
            ),
            "chauffage_modere": (
                "🟠",
                "Risque modéré de panache",
                f"Chauffage modéré : {prediction['puissance_kW']:.0f} kW",
            ),
            "chauffage_maximal": (
                "🔴",
                "Fort risque — conditions humides",
                f"Chauffage maximal : {prediction['puissance_kW']:.0f} kW",
            ),
        }
        emoji, statut, action = emoji_map.get(
            prediction["decision"], ("❓", prediction["decision"], "")
        )

        lines = []
        lines.append("=" * 60)
        lines.append("PANACHE VISUAL CONTROL RECOMMENDATION")
        lines.append("=" * 60)
        lines.append(f"{emoji}  {statut}")
        lines.append(
            f"  Panache visible   : {'OUI' if prediction['panache_visible'] else 'NON'} "
            f"(prob {prediction['prob_visible']*100:.1f}%)"
        )
        lines.append(f"  Decision          : {prediction['decision']}")
        lines.append(f"  Action            : {action}")
        lines.append(
            f"  Puissance IA      : {prediction['puissance_kW']:.1f} kW "
            f"(vs {prediction['puissance_continue_kW']:.0f} kW continue)"
        )
        lines.append(
            f"  Economie horaire  : {prediction['economie_horaire_DT']:.2f} DT"
        )
        lines.append("=" * 60)
        return "\n".join(lines)


if __name__ == "__main__":
    pipe = PanachePipeline(models_dir="models")
    sample = {
        "T_amb_C": 10.0,
        "humidite_rel_pct": 88.0,
        "T_rosee_C": 8.0,
        "vitesse_vent_ms": 3.2,
        "pression_hpa": 1018.0,
        "T_gaz_procede_C": 60.0,
        "H_gaz_pct": 92.0,
        "debit_gaz_nm3h": 42000.0,
        "delta_T_gaz_amb": 50.0,
        "heure": 9,
        "mois": 1,
        "jour_semaine": 1,
        "production_factor": 0.9,
    }
    print(pipe.report(sample))
