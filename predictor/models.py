from django.db import models

class PredictionLog(models.Model):
    PREDICTION_TYPES = [
        ('sensor', 'Sensor / Model 1+2'),
        ('meteo',  'Real Meteo / Model 3'),
    ]

    prediction_type = models.CharField(max_length=10, choices=PREDICTION_TYPES)
    created_at = models.DateTimeField(auto_now_add=True)

    # ── Shared inputs ──────────────────────────────────────────────────────
    gas_ppm        = models.FloatField(null=True, blank=True)  # measured or estimated
    wind_direction = models.FloatField(null=True, blank=True)
    wind_speed     = models.FloatField(null=True, blank=True)
    hour           = models.IntegerField(null=True, blank=True)
    season         = models.CharField(max_length=10, null=True, blank=True)

    # ── Meteo-only inputs ──────────────────────────────────────────────────
    temp           = models.FloatField(null=True, blank=True)
    precip         = models.FloatField(null=True, blank=True)
    day_of_year    = models.IntegerField(null=True, blank=True)
    gas_type_input = models.CharField(max_length=10, null=True, blank=True)

    # ── Outputs ────────────────────────────────────────────────────────────
    predicted_gas  = models.CharField(max_length=10, null=True, blank=True)   # SO2/HF/NOx
    danger_level   = models.CharField(max_length=10, null=True, blank=True)   # low/medium/high
    predicted_lat  = models.FloatField(null=True, blank=True)
    predicted_lon  = models.FloatField(null=True, blank=True)
    predicted_zone = models.CharField(max_length=60, null=True, blank=True)
    confidence     = models.FloatField(null=True, blank=True)
    used_fallback  = models.BooleanField(default=False)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        ts = self.created_at.strftime('%Y-%m-%d %H:%M') if self.created_at else '—'
        return f"[{self.prediction_type}] {ts} → {self.predicted_gas or '—'} / {self.danger_level or '—'} | {self.predicted_zone or '—'}"
