import json
from django.shortcuts import render
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods
from django.db.models import Count

from .forms import SensorPredictionForm, MeteoPredictionForm
from .models import PredictionLog
from .ml_engine import (
    predict_gas_and_danger, predict_zone_m2, predict_zone_m3,
    ZONES, FACTORY_LAT, FACTORY_LON
)

DANGER_COLORS = {
    'high':   '#ef4444',
    'medium': '#f97316',
    'low':    '#22c55e',
}


def dashboard(request):
    total = PredictionLog.objects.count()
    sensor_count = PredictionLog.objects.filter(prediction_type='sensor').count()
    meteo_count  = PredictionLog.objects.filter(prediction_type='meteo').count()
    recent = PredictionLog.objects.all()[:10]
    danger_stats = (
        PredictionLog.objects.filter(danger_level__isnull=False)
        .values('danger_level').annotate(count=Count('id'))
    )
    zones_json = json.dumps([
        {'id': zid, 'name': data[2], 'desc': data[3], 'lat': data[0], 'lon': data[1]}
        for zid, data in ZONES.items()
    ])
    context = {
        'total': total,
        'sensor_count': sensor_count,
        'meteo_count': meteo_count,
        'recent': recent,
        'danger_stats': list(danger_stats),
        'danger_colors': DANGER_COLORS,
        'zones_json': zones_json,
        'factory_lat': FACTORY_LAT,
        'factory_lon': FACTORY_LON,
    }
    return render(request, 'predictor/dashboard.html', context)


def sensor_predict(request):
    """Model 1 → gas type + danger,  then Model 2 → GPS + zone."""
    result = None
    form = SensorPredictionForm(request.POST or None)

    if request.method == 'POST' and form.is_valid():
        d = form.cleaned_data

        gas_label, danger_label, confidence, fb1 = predict_gas_and_danger(
            d['gas_ppm'], d['wind_direction'], d['wind_speed'],
            d['hour'], d['season']
        )
        lat, lon, zone_id, zone_name, zone_desc, fb2 = predict_zone_m2(
            d['gas_ppm'], d['wind_direction'], d['wind_speed'],
            d['hour'], d['season'], gas_label, danger_label
        )
        used_fallback = fb1 or fb2

        log = PredictionLog.objects.create(
            prediction_type='sensor',
            gas_ppm=d['gas_ppm'],
            wind_direction=d['wind_direction'],
            wind_speed=d['wind_speed'],
            hour=d['hour'],
            season=d['season'],
            predicted_gas=gas_label,
            danger_level=danger_label,
            predicted_lat=lat,
            predicted_lon=lon,
            predicted_zone=zone_name,
            confidence=confidence,
            used_fallback=used_fallback,
        )

        result = {
            'gas': gas_label,
            'danger': danger_label,
            'confidence': f"{confidence*100:.1f}%" if confidence else "N/A",
            'lat': round(lat, 5),
            'lon': round(lon, 5),
            'zone_id': zone_id,
            'zone_name': zone_name,
            'zone_desc': zone_desc,
            'fallback': used_fallback,
            'color': DANGER_COLORS.get(danger_label, '#6b7280'),
            'log_id': log.id,
        }

    return render(request, 'predictor/sensor_predict.html', {'form': form, 'result': result})


def meteo_predict(request):
    """Model 3 — Real Meteo Pipeline → GPS + zone."""
    result = None
    form = MeteoPredictionForm(request.POST or None)

    if request.method == 'POST' and form.is_valid():
        d = form.cleaned_data

        gas_ppm, danger_label, lat, lon, zone_id, zone_name, zone_desc, used_fallback = predict_zone_m3(
            temp=d['temp'],
            wind_speed=d['wind_speed'],
            wind_direction=d['wind_direction'],
            season=d['season'],
            gas_type=d['gas_type'],
            hour=d['hour'],
            precip=d['precip'],
            day_of_year=d['day_of_year'],
        )

        log = PredictionLog.objects.create(
            prediction_type='meteo',
            temp=d['temp'],
            wind_speed=d['wind_speed'],
            wind_direction=d['wind_direction'],
            season=d['season'],
            gas_type_input=d['gas_type'],
            hour=d['hour'],
            precip=d['precip'],
            day_of_year=d['day_of_year'],
            gas_ppm=gas_ppm,
            danger_level=danger_label,
            predicted_lat=lat,
            predicted_lon=lon,
            predicted_zone=zone_name,
            used_fallback=used_fallback,
        )

        result = {
            'gas_ppm': round(gas_ppm, 1),
            'danger': danger_label,
            'lat': round(lat, 5),
            'lon': round(lon, 5),
            'zone_id': zone_id,
            'zone_name': zone_name,
            'zone_desc': zone_desc,
            'fallback': used_fallback,
            'color': DANGER_COLORS.get(danger_label, '#6b7280'),
            'log_id': log.id,
        }

    return render(request, 'predictor/meteo_predict.html', {'form': form, 'result': result})


def history(request):
    ptype = request.GET.get('type', '')
    qs = PredictionLog.objects.all()
    if ptype in ('sensor', 'meteo'):
        qs = qs.filter(prediction_type=ptype)
    return render(request, 'predictor/history.html', {
        'logs': qs[:100],
        'ptype': ptype,
        'danger_colors': DANGER_COLORS,
    })


# ── JSON APIs ─────────────────────────────────────────────────────────────────
@csrf_exempt
@require_http_methods(["POST"])
def api_sensor(request):
    try:
        data = json.loads(request.body)
        form = SensorPredictionForm(data)
        if not form.is_valid():
            return JsonResponse({'error': form.errors}, status=400)
        d = form.cleaned_data
        gas, danger, confidence, fb1 = predict_gas_and_danger(
            d['gas_ppm'], d['wind_direction'], d['wind_speed'], d['hour'], d['season']
        )
        lat, lon, zone_id, zone_name, zone_desc, fb2 = predict_zone_m2(
            d['gas_ppm'], d['wind_direction'], d['wind_speed'],
            d['hour'], d['season'], gas, danger
        )
        return JsonResponse({
            'gas_type': gas, 'danger_level': danger,
            'confidence': confidence,
            'lat': round(lat, 5), 'lon': round(lon, 5),
            'zone_id': zone_id, 'zone_name': zone_name,
            'used_fallback': fb1 or fb2,
        })
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)


@csrf_exempt
@require_http_methods(["POST"])
def api_meteo(request):
    try:
        data = json.loads(request.body)
        form = MeteoPredictionForm(data)
        if not form.is_valid():
            return JsonResponse({'error': form.errors}, status=400)
        d = form.cleaned_data
        gas_ppm, danger, lat, lon, zone_id, zone_name, zone_desc, used_fallback = predict_zone_m3(
            d['temp'], d['wind_speed'], d['wind_direction'],
            d['season'], d['gas_type'], d['hour'], d['precip'], d['day_of_year']
        )
        return JsonResponse({
            'estimated_ppm': round(gas_ppm, 1),
            'danger_level': danger,
            'lat': round(lat, 5), 'lon': round(lon, 5),
            'zone_id': zone_id, 'zone_name': zone_name,
            'used_fallback': used_fallback,
        })
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)
