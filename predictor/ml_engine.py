"""
ML Engine — Gabès Air Quality Predictor
Matches the exact feature engineering and encoders from the 3 training notebooks.

Model 1  (model_gas.pkl + model_danger.pkl + encoders.pkl)
  Input:  gas_ppm, wind_direction, wind_speed, hour, season
  Output: gas_type (SO2/HF/NOx)  +  danger_level (low/medium/high)
  Features trained on: [gas_ppm, wind_sin, wind_cos, wind_speed,
                        hour_sin, hour_cos, season_enc]

Model 2  (model_gps.pkl + model_zone.pkl + encoders_m2.pkl)
  Input:  model-1 outputs + same meteo inputs
  Output: GPS coordinates + zone_id (0-7)
  Features trained on: [gas_ppm, wind_sin, wind_cos, wind_speed,
                        hour_sin, hour_cos, season_enc, gas_type_enc, danger_enc]

Model 3  (real_pipeline_output: model_gps.pkl + model_zone.pkl + encoders.pkl)
  Input:  daily meteo (temp, wind_speed, wind_direction, season,
                       gas_type, hour, precip, day_of_year)
  Output: GPS coordinates + zone_id (0-7)
  Features trained on: [gas_ppm, wind_sin, wind_cos, wind_speed,
                        hour_sin, hour_cos, temp_mean, precip,
                        season_enc, gas_type_enc, danger_enc,
                        doy_sin, doy_cos]
"""

import os
import math
import logging
import numpy as np
from django.conf import settings

logger = logging.getLogger(__name__)
MODELS_DIR = settings.MODELS_DIR

# ── lazy model cache ─────────────────────────────────────────────────────────
_cache = {}

def _load(name):
    if name not in _cache:
        path = os.path.join(MODELS_DIR, name)
        if os.path.exists(path):
            import joblib
            _cache[name] = joblib.load(path)
            logger.info(f"Loaded: {name}")
        else:
            _cache[name] = None
            logger.warning(f"Not found: {path} → fallback active")
    return _cache[name]


# ── Real Gabès zones (from both notebooks) ───────────────────────────────────
ZONES = {
    0: (33.895, 10.098, "Medina_North",      "Residential — old city N of factory"),
    1: (33.872, 10.115, "Port_Industrial",   "Heavy industry, SE coast"),
    2: (33.865, 10.085, "Agricultural_SW",   "Oasis / farmland SW"),
    3: (33.880, 10.075, "Residential_West",  "Housing estates W"),
    4: (33.900, 10.115, "Coastal_NE",        "Beach / fishing NE"),
    5: (33.870, 10.098, "Factory_Immediate", "500m radius — highest exposure"),
    6: (33.890, 10.080, "Jara_District",     "Urban residential NW"),
    7: (33.858, 10.105, "Chenini_South",     "Southern agricultural zone"),
}

FACTORY_LAT = 33.8806
FACTORY_LON = 10.0992

SEASONS = ['Winter', 'Spring', 'Summer', 'Autumn']
GAS_TYPES = ['SO2', 'HF', 'NOx']

# ── Shared feature builder (Model 1 & 2) ────────────────────────────────────
def _build_features_m1(gas_ppm, wind_direction, wind_speed, hour, season_enc):
    """7 features used by Model 1 (and base of Model 2)."""
    wind_sin = np.sin(np.deg2rad(wind_direction))
    wind_cos = np.cos(np.deg2rad(wind_direction))
    hour_sin = np.sin(2 * np.pi * hour / 24)
    hour_cos = np.cos(2 * np.pi * hour / 24)
    return [gas_ppm, wind_sin, wind_cos, wind_speed, hour_sin, hour_cos, season_enc]


# ── Danger helper (used in fallback AND model-3 inference) ──────────────────
def _danger_from_ppm(gas_type, gas_ppm):
    if gas_type == 'SO2':
        return 'high' if gas_ppm > 250 else ('medium' if gas_ppm > 100 else 'low')
    elif gas_type == 'HF':
        return 'high' if gas_ppm > 8   else ('medium' if gas_ppm > 3   else 'low')
    else:  # NOx
        return 'high' if gas_ppm > 200 else ('medium' if gas_ppm > 80  else 'low')


# ── Nearest zone (Euclidean in lat/lon — fine for ~5 km scale) ───────────────
def _nearest_zone(lat, lon):
    return min(ZONES.keys(),
               key=lambda z: (lat - ZONES[z][0])**2 + (lon - ZONES[z][1])**2)


# ═══════════════════════════════════════════════════════════════════════════════
# MODEL 1 — Gas Type + Danger Level
# Input: gas_ppm, wind_direction, wind_speed, hour, season (str)
# ═══════════════════════════════════════════════════════════════════════════════
def predict_gas_and_danger(gas_ppm, wind_direction, wind_speed, hour, season):
    model_gas    = _load('model_gas.pkl')
    model_danger = _load('model_danger.pkl')
    encoders     = _load('encoders.pkl')

    if model_gas and model_danger and encoders:
        # Safe season encoding — fall back to physics if season unseen
        try:
            se = encoders['season'].transform([season])[0]
        except ValueError:
            # Try common variations
            season_map = {
                'winter': 'Winter', 'spring': 'Spring',
                'summer': 'Summer', 'autumn': 'Autumn', 'fall': 'Autumn'
            }
            season_fixed = season_map.get(season.lower(), season)
            try:
                se = encoders['season'].transform([season_fixed])[0]
            except ValueError:
                logger.warning(f"Unknown season '{season}' → using fallback")
                return _gas_fallback(gas_ppm)

        X = np.array([_build_features_m1(gas_ppm, wind_direction, wind_speed, hour, se)])
        gas_enc    = model_gas.predict(X)[0]
        danger_enc = model_danger.predict(X)[0]

        gas_label = encoders['gas_type'].inverse_transform([gas_enc])[0]
        danger_order_inv = {v: k for k, v in encoders['danger_order'].items()}
        danger_label = danger_order_inv[danger_enc]

        proba = model_gas.predict_proba(X)[0] if hasattr(model_gas, 'predict_proba') else None
        confidence = float(max(proba)) if proba is not None else None

        return gas_label, danger_label, confidence, False

    else:
        return _gas_fallback(gas_ppm)


def _gas_fallback(gas_ppm):
    if gas_ppm > 200:
        gas_label = 'SO2'
    elif gas_ppm > 60:
        gas_label = 'NOx'
    else:
        gas_label = 'HF'
    danger_label = _danger_from_ppm(gas_label, gas_ppm)
    return gas_label, danger_label, 0.65, True

# ═══════════════════════════════════════════════════════════════════════════════
# MODEL 2 — GPS + Zone (chained from Model 1)
# Input: model-1 inputs + gas_type + danger_level (from model-1 output)
# ═══════════════════════════════════════════════════════════════════════════════
def predict_zone_m2(gas_ppm, wind_direction, wind_speed, hour, season,
                    gas_label, danger_label):
    """
    Returns (lat, lon, zone_id, zone_name, zone_desc, used_fallback)
    Uses encoders_m2.pkl (keys: season, gas_type, danger_level)
    """
    rf_gps    = _load('model_gps.pkl')
    rf_zone   = _load('model_zone.pkl')
    enc_m2    = _load('encoders_m2.pkl')  # keys: season, gas_type, danger_level

    if rf_gps and rf_zone and enc_m2:
        se  = enc_m2['season'].transform([season])[0]
        ge  = enc_m2['gas_type'].transform([gas_label])[0]
        de  = enc_m2['danger_level'].transform([danger_label])[0]
        base = _build_features_m1(gas_ppm, wind_direction, wind_speed, hour, se)
        X    = np.array([base + [ge, de]])

        gps      = rf_gps.predict(X)[0]
        zone_id  = int(rf_zone.predict(X)[0])
        lat, lon = float(gps[0]), float(gps[1])
        return lat, lon, zone_id, ZONES[zone_id][2], ZONES[zone_id][3], False

    else:
        # Gaussian plume fallback (same formula as notebook Cell 5)
        wind_rad = np.deg2rad(wind_direction)
        wind_f   = wind_speed / 20
        danger_f = gas_ppm / 150
        dist     = 0.008 + wind_f * 0.010 + danger_f * 0.005
        dlat = np.cos(wind_rad) * dist
        dlon = np.sin(wind_rad) * dist
        lat  = FACTORY_LAT + dlat
        lon  = FACTORY_LON + dlon
        zone_id = _nearest_zone(lat, lon)
        return lat, lon, zone_id, ZONES[zone_id][2], ZONES[zone_id][3], True


# ═══════════════════════════════════════════════════════════════════════════════
# MODEL 3 — Real Meteo Pipeline
# Input: temp, wind_speed, wind_direction, season, gas_type,
#        hour, precip, day_of_year
# ═══════════════════════════════════════════════════════════════════════════════
def predict_zone_m3(temp, wind_speed, wind_direction, season, gas_type,
                    hour=12, precip=0.0, day_of_year=180):
    """
    Returns (gas_ppm, danger_label, lat, lon, zone_id, zone_name, zone_desc, used_fallback)
    Uses real_pipeline encoders.pkl (keys: season, gas_type, danger)
    Features: [gas_ppm, wind_sin, wind_cos, wind_speed,
               hour_sin, hour_cos, temp_mean, precip,
               season_enc, gas_type_enc, danger_enc, doy_sin, doy_cos]
    """
    rf_gps  = _load('model_gps_m3.pkl')
    rf_zone = _load('model_zone_m3.pkl')
    enc_m3  = _load('encoders_m3.pkl')  # keys: season, gas_type, danger

    # Estimate gas PPM (same formula as notebook Cell 5 + Cell 10)
    base     = {'Summer': 180, 'Spring': 120, 'Autumn': 100, 'Winter': 70}.get(season, 100)
    gas_ppm  = max(1.0, base * (1 + max(0, (temp - 20) / 30)) * max(0.3, 1 - wind_speed / 60))

    # Determine danger label
    danger_label = _danger_from_ppm(gas_type, gas_ppm)

    if rf_gps and rf_zone and enc_m3:
        wind_sin = np.sin(np.deg2rad(wind_direction))
        wind_cos = np.cos(np.deg2rad(wind_direction))
        hour_sin = np.sin(2 * np.pi * hour / 24)
        hour_cos = np.cos(2 * np.pi * hour / 24)
        doy_sin  = np.sin(2 * np.pi * day_of_year / 365)
        doy_cos  = np.cos(2 * np.pi * day_of_year / 365)
        se  = enc_m3['season'].transform([season])[0]
        ge  = enc_m3['gas_type'].transform([gas_type])[0]
        de  = enc_m3['danger'].transform([danger_label])[0]

        X = np.array([[gas_ppm, wind_sin, wind_cos, wind_speed,
                       hour_sin, hour_cos, temp, precip,
                       se, ge, de, doy_sin, doy_cos]])

        gps     = rf_gps.predict(X)[0]
        zone_id = int(rf_zone.predict(X)[0])
        lat, lon = float(gps[0]), float(gps[1])
        return gas_ppm, danger_label, lat, lon, zone_id, ZONES[zone_id][2], ZONES[zone_id][3], False

    else:
        # Gaussian plume fallback
        wind_rad = np.deg2rad(wind_direction)
        temp_f   = max(0.5, (temp - 10) / 25)
        wind_f   = wind_speed / 20
        danger_f = gas_ppm / 150
        dist     = (0.008 + wind_f * 0.010 + danger_f * 0.005) * (0.8 + temp_f * 0.4)
        dlat = np.cos(wind_rad) * dist
        dlon = np.sin(wind_rad) * dist
        lat  = FACTORY_LAT + dlat
        lon  = FACTORY_LON + dlon
        zone_id = _nearest_zone(lat, lon)
        return gas_ppm, danger_label, lat, lon, zone_id, ZONES[zone_id][2], ZONES[zone_id][3], True
