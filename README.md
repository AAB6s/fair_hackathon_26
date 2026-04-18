# Gabes Environmental Monitoring Dashboard

Real-time monitoring and decision dashboard for the Gabes phosphate pollution case.

This project combines:

- a public-screen dashboard for air, water, factory, alert, and decision data
- a short-horizon prediction layer for pollution spread
- a phosphogypsum treatment model that recommends lime dose, washing time, expected recovery, cost, and final pH

The UI is built for large displays first, but it also adapts to smaller screens.


## What The Project Does

The dashboard follows a simple flow:

1. detect abnormal values and incidents
2. estimate near-term evolution
3. recommend action
4. display everything clearly in one place

Main areas in the interface:

- live indicators for `SO₂`, phosphate/acid, `pH`, and sea water contamination
- zone-based map of Gabes with affected regions
- alert stream and operator action panel
- prediction chart for the next `30-60` minutes
- factory unit status and loss figures
- phosphogypsum treatment recommendation panel inside the factory section


## Tech Stack

- `React`
- `Vite`
- `TypeScript`
- `Zustand`
- `Tailwind CSS`
- `Framer Motion`
- `Python`
- `FastAPI`
- `scikit-learn`
- `XGBoost`


## Project Structure

```text
src/
  components/        UI panels and dashboard sections
  data/              scenario simulation and map reference data
  hooks/             frontend data hooks
  store/             centralized app state
  theme/             global visual system
  utils/             classification and model helpers

model1/
  phosphogypsum_training.ipynb   training notebook
  export_models.py               exports models from the notebook
  pipeline.py                    loads exported models and runs prediction
  api.py                         FastAPI service for the model
  requirements.txt              Python dependencies for the model service
```


## Requirements

Frontend:

- `Node.js 18+`
- `npm`

Model service:

- `Python 3.12` recommended
- `pip`


## Install

Install frontend dependencies:

```powershell
cd C:\Users\aab62\Desktop\hackathon
npm install
```

Install Python dependencies for the model:

```powershell
cd C:\Users\aab62\Desktop\hackathon
python -m pip install -r model1/requirements.txt
```


## First Run

The trained model files are not committed to the repository. Export them once after cloning:

```powershell
cd C:\Users\aab62\Desktop\hackathon
npm run model:train
```

That command runs the notebook logic and creates the files needed by the prediction API under `model1/models/`.


## Run The Project

Terminal 1, start the model API:

```powershell
cd C:\Users\aab62\Desktop\hackathon
npm run model:serve
```

Terminal 2, start the dashboard:

```powershell
cd C:\Users\aab62\Desktop\hackathon
npm run dev
```

Open:

- dashboard: `http://127.0.0.1:5173`
- model health check: `http://127.0.0.1:8000/api/phosphogypsum/health`


## Useful Commands

Export model files:

```powershell
npm run model:train
```

Run the model demo from Python:

```powershell
npm run model:demo
```

Start only the frontend:

```powershell
npm run dev
```

Build the frontend:

```powershell
npm run build
```


## Where To See The Model Output

Inside the dashboard, open the factory block:

- section: `المصنع`
- panel: `الوحدات والخسائر`
- card: `معالجة الفوسفوجيبس`

That panel shows:

- lime milk dose
- washing time
- expected `P₂O₅` recovery
- expected treatment cost
- final `pH`

If the Python API is online, the panel shows `API مباشر`.

If the API is not reachable, the dashboard switches to a local fallback estimate and shows `احتياطي محلي` so the screen does not go blank.


## Model Notes

The phosphogypsum model currently comes from the notebook in `model1/`.

Inputs:

- sample chemistry
- heavy metals
- radioactivity
- moisture
- initial `pH`
- temperature

Outputs:

- `lime_milk_kg_per_ton`
- `washing_time_min`
- `P2O5_recovery_percent`
- `treatment_cost_USD_per_ton`
- `final_pH`

The current training data is generated from the notebook logic. It is useful for demonstration, integration, and workflow testing. For field use, replace that synthetic dataset with real lab or plant measurements and retrain.


## API Endpoints

Health:

```text
GET /api/phosphogypsum/health
```

Metadata:

```text
GET /api/phosphogypsum/metadata
```

Prediction:

```text
POST /api/phosphogypsum/predict
```


## Development Notes

- The Vite dev server proxies `/api/phosphogypsum` to `http://127.0.0.1:8000`.
- The frontend can still render treatment advice without the API, but the preferred mode is the live Python service.
- Exported model files and generated datasets are ignored by Git.


## Current Status

Verified locally:

- frontend build passes
- notebook export runs
- model API responds
- dashboard and model service run together
