from __future__ import annotations

from functools import lru_cache
from typing import Literal

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

try:
    from .pipeline import PhosphogypsumPipeline
except ImportError:  # pragma: no cover
    from pipeline import PhosphogypsumPipeline


class TreatmentInput(BaseModel):
    P2O5_percent: float = Field(..., ge=0.5, le=5.0)
    CaO_percent: float = Field(..., ge=28.0, le=33.0)
    SO3_percent: float = Field(..., ge=40.0, le=46.0)
    F_percent: float = Field(..., ge=0.2, le=2.0)
    SiO2_percent: float = Field(..., ge=0.5, le=5.0)
    Fe2O3_percent: float = Field(..., ge=0.05, le=0.8)
    Al2O3_percent: float = Field(..., ge=0.05, le=0.5)
    MgO_percent: float = Field(..., ge=0.01, le=0.3)
    Na2O_percent: float = Field(..., ge=0.05, le=0.4)
    K2O_percent: float = Field(..., ge=0.01, le=0.2)
    Cd_ppm: float = Field(..., ge=0.5, le=15.0)
    Pb_ppm: float = Field(..., ge=1.0, le=25.0)
    Zn_ppm: float = Field(..., ge=10.0, le=200.0)
    As_ppm: float = Field(..., ge=0.5, le=20.0)
    Ra226_Bq_per_kg: float = Field(..., ge=100.0, le=1000.0)
    moisture_percent: float = Field(..., ge=10.0, le=25.0)
    pH_initial: float = Field(..., ge=2.5, le=5.5)
    temperature_C: float = Field(..., ge=15.0, le=45.0)


class TreatmentOutput(BaseModel):
    lime_milk_kg_per_ton: float
    washing_time_min: float
    P2O5_recovery_percent: float
    treatment_cost_USD_per_ton: float
    final_pH: float


class MetricInfo(BaseModel):
    algorithm: str
    r2: float
    mae: float
    rmse: float


class PredictResponse(BaseModel):
    source: Literal["api"] = "api"
    input: TreatmentInput
    output: TreatmentOutput
    best_algorithms: dict[str, str]
    metrics: dict[str, MetricInfo]


app = FastAPI(
    title="Gabes Phosphogypsum Model API",
    version="1.0.0",
    description="Serves phosphogypsum treatment optimization predictions.",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@lru_cache(maxsize=1)
def get_pipeline() -> PhosphogypsumPipeline:
    return PhosphogypsumPipeline(models_dir="models")


@app.get("/api/phosphogypsum/health")
def health():
    pipe = get_pipeline()
    return {
        "ok": True,
        "models_dir": str(pipe.models_dir),
        "targets": pipe.target_features,
    }


@app.get("/api/phosphogypsum/metadata")
def metadata():
    pipe = get_pipeline()
    return pipe.meta


@app.post("/api/phosphogypsum/predict", response_model=PredictResponse)
def predict(payload: TreatmentInput):
    pipe = get_pipeline()
    prediction = pipe.predict(payload.model_dump())

    metrics = {}
    for target, algorithm in pipe.best_algo.items():
        metrics[target] = {
            "algorithm": algorithm,
            **pipe.meta["metrics"][target][algorithm],
        }

    return PredictResponse(
        input=payload,
        output=TreatmentOutput(**prediction),
        best_algorithms=pipe.best_algo,
        metrics=metrics,
    )


if __name__ == "__main__":  # pragma: no cover
    import uvicorn

    uvicorn.run("model1.api:app", host="0.0.0.0", port=8000, reload=False)
