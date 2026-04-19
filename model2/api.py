"""FastAPI service that serves the Panache control predictions."""
from __future__ import annotations

from functools import lru_cache
from typing import Literal

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

try:
    from .pipeline import PanachePipeline
except ImportError:  # pragma: no cover - allow direct module execution
    from pipeline import PanachePipeline


class PanacheInput(BaseModel):
    # Weather context
    T_amb_C: float = Field(..., ge=-10.0, le=55.0)
    humidite_rel_pct: float = Field(..., ge=0.0, le=100.0)
    T_rosee_C: float = Field(..., ge=-20.0, le=40.0)
    vitesse_vent_ms: float = Field(..., ge=0.0, le=30.0)
    pression_hpa: float = Field(..., ge=900.0, le=1100.0)
    # Stack / process gas
    T_gaz_procede_C: float = Field(..., ge=0.0, le=120.0)
    H_gaz_pct: float = Field(..., ge=0.0, le=100.0)
    debit_gaz_nm3h: float = Field(..., ge=0.0, le=120000.0)
    delta_T_gaz_amb: float = Field(..., ge=-20.0, le=120.0)
    # Time / production context
    heure: int = Field(..., ge=0, le=23)
    mois: int = Field(..., ge=1, le=12)
    jour_semaine: int = Field(..., ge=0, le=6)
    production_factor: float = Field(..., ge=0.0, le=1.5)


class PanacheOutput(BaseModel):
    panache_visible: int
    prob_visible: float
    puissance_kW: float
    puissance_continue_kW: float
    economie_horaire_DT: float
    decision: str


class PanacheMetrics(BaseModel):
    visibility_accuracy: float
    power_r2: float
    power_rmse: float
    decision_accuracy: float
    best_classifier: str
    best_regressor: str


class PredictResponse(BaseModel):
    source: Literal["api"] = "api"
    input: PanacheInput
    output: PanacheOutput
    metrics: PanacheMetrics


app = FastAPI(
    title="Gabes Panache Visual Control API",
    version="1.0.0",
    description=(
        "Serves the AI control predictions for the stack gas heating loop "
        "that eliminates the visible white plume."
    ),
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@lru_cache(maxsize=1)
def get_pipeline() -> PanachePipeline:
    return PanachePipeline(models_dir="models")


def _build_metrics(pipe: PanachePipeline) -> PanacheMetrics:
    meta = pipe.meta["metrics"]
    return PanacheMetrics(
        visibility_accuracy=float(meta["visibility_classifier"]["accuracy"]),
        power_r2=float(meta["power_regressor"]["r2"]),
        power_rmse=float(meta["power_regressor"]["rmse"]),
        decision_accuracy=float(meta["decision_classifier"]["accuracy"]),
        best_classifier=str(meta["visibility_classifier"]["name"]),
        best_regressor=str(meta["power_regressor"]["name"]),
    )


@app.get("/api/panache/health")
def health():
    pipe = get_pipeline()
    return {
        "ok": True,
        "models_dir": str(pipe.models_dir),
        "features_cls": pipe.features_cls,
        "features_reg": pipe.features_reg,
        "decisions": list(pipe.label_encoder.classes_),
    }


@app.get("/api/panache/metadata")
def metadata():
    pipe = get_pipeline()
    return pipe.meta


@app.post("/api/panache/predict", response_model=PredictResponse)
def predict(payload: PanacheInput):
    pipe = get_pipeline()
    prediction = pipe.predict(payload.model_dump())

    return PredictResponse(
        input=payload,
        output=PanacheOutput(**prediction),
        metrics=_build_metrics(pipe),
    )


if __name__ == "__main__":  # pragma: no cover
    import uvicorn

    uvicorn.run("model2.api:app", host="0.0.0.0", port=8001, reload=False)
