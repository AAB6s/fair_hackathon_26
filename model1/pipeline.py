import os
import json
from pathlib import Path

import joblib
import pandas as pd


class PhosphogypsumPipeline:
    def __init__(self, models_dir="models"):
        base_dir = Path(__file__).resolve().parent
        candidate = Path(models_dir)
        self.models_dir = candidate if candidate.is_absolute() else base_dir / candidate

        with open(self.models_dir / "metadata.json", "r", encoding="utf-8") as f:
            self.meta = json.load(f)

        self.input_features = self.meta["input_features"]
        self.target_features = self.meta["target_features"]
        self.best_algo = self.meta["best_algorithm_per_target"]

        self.scaler = joblib.load(self.models_dir / "scaler.pkl")
        self.models = {}
        for target, algo in self.best_algo.items():
            path = self.models_dir / f"{target}__{algo}.pkl"
            self.models[target] = joblib.load(path)

    def _prepare(self, inputs):
        if isinstance(inputs, dict):
            df = pd.DataFrame([inputs])
        elif isinstance(inputs, list):
            df = pd.DataFrame(inputs)
        elif isinstance(inputs, pd.DataFrame):
            df = inputs.copy()
        else:
            raise TypeError("inputs must be a dict, list of dicts, or DataFrame")

        missing = [c for c in self.input_features if c not in df.columns]
        if missing:
            raise ValueError(f"Missing required input features: {missing}")
        return df[self.input_features]

    def predict(self, inputs):
        df = self._prepare(inputs)
        X_scaled = self.scaler.transform(df.values)

        out = {}
        for target, model in self.models.items():
            out[target] = model.predict(X_scaled)

        result_df = pd.DataFrame(out)
        result_df["lime_milk_kg_per_ton"] = result_df["lime_milk_kg_per_ton"].round(2)
        result_df["washing_time_min"] = result_df["washing_time_min"].round(1)
        result_df["P2O5_recovery_percent"] = result_df["P2O5_recovery_percent"].round(2)
        result_df["treatment_cost_USD_per_ton"] = result_df["treatment_cost_USD_per_ton"].round(2)
        result_df["final_pH"] = result_df["final_pH"].round(2)

        if len(result_df) == 1:
            return result_df.iloc[0].to_dict()
        return result_df

    def report(self, inputs):
        result = self.predict(inputs)
        lines = []
        lines.append("=" * 60)
        lines.append("PHOSPHOGYPSUM TREATMENT RECOMMENDATION")
        lines.append("=" * 60)
        lines.append("")
        lines.append("Input sample:")
        lines.append(f"  P2O5={inputs['P2O5_percent']:.2f}%  CaO={inputs['CaO_percent']:.2f}%  "
                     f"SO3={inputs['SO3_percent']:.2f}%  F={inputs['F_percent']:.2f}%")
        lines.append(f"  Initial pH={inputs['pH_initial']:.2f}  T={inputs['temperature_C']:.1f}C  "
                     f"Moisture={inputs['moisture_percent']:.1f}%")
        lines.append(f"  Heavy metals (ppm): Cd={inputs['Cd_ppm']:.1f}  Pb={inputs['Pb_ppm']:.1f}  "
                     f"As={inputs['As_ppm']:.1f}  Zn={inputs['Zn_ppm']:.1f}")
        lines.append(f"  Ra-226: {inputs['Ra226_Bq_per_kg']:.0f} Bq/kg")
        lines.append("")
        lines.append("Recommended treatment:")
        lines.append(f"  Lime milk Ca(OH)2 dose : {result['lime_milk_kg_per_ton']:.2f} kg/ton")
        lines.append(f"  Washing time           : {result['washing_time_min']:.1f} min")
        lines.append("")
        lines.append("Expected outcomes:")
        lines.append(f"  P2O5 recovery          : {result['P2O5_recovery_percent']:.2f} %")
        lines.append(f"  Final pH after process : {result['final_pH']:.2f}")
        lines.append(f"  Treatment cost         : ${result['treatment_cost_USD_per_ton']:.2f} / ton")
        lines.append("")
        if 6.5 <= result["final_pH"] <= 8.5:
            lines.append("  [OK] Final pH within environmental norms (6.5-8.5)")
        else:
            lines.append(f"  [WARN] Final pH {result['final_pH']:.2f} outside 6.5-8.5 range")
        if result["P2O5_recovery_percent"] >= 75:
            lines.append("  [OK] High P2O5 recovery - economically favorable")
        elif result["P2O5_recovery_percent"] >= 60:
            lines.append("  [OK] Moderate P2O5 recovery")
        else:
            lines.append("  [LOW] Low P2O5 recovery - consider pre-treatment")
        lines.append("=" * 60)
        return "\n".join(lines)


if __name__ == "__main__":
    pipe = PhosphogypsumPipeline(models_dir="models")

    sample = {
        "P2O5_percent": 2.5, "CaO_percent": 30.0, "SO3_percent": 43.0,
        "F_percent": 1.2, "SiO2_percent": 2.5, "Fe2O3_percent": 0.3,
        "Al2O3_percent": 0.2, "MgO_percent": 0.1, "Na2O_percent": 0.15,
        "K2O_percent": 0.08, "Cd_ppm": 5.0, "Pb_ppm": 10.0,
        "Zn_ppm": 80.0, "As_ppm": 8.0, "Ra226_Bq_per_kg": 450.0,
        "moisture_percent": 18.0, "pH_initial": 3.5, "temperature_C": 25.0,
    }

    print(pipe.report(sample))
