from django.contrib import admin
from .models import PredictionLog

@admin.register(PredictionLog)
class PredictionLogAdmin(admin.ModelAdmin):
    list_display  = ['id', 'prediction_type', 'predicted_gas', 'danger_level',
                     'predicted_zone', 'gas_ppm', 'used_fallback', 'created_at']
    list_filter   = ['prediction_type', 'danger_level', 'season', 'used_fallback']
    search_fields = ['predicted_gas', 'predicted_zone', 'season']
    readonly_fields = ['created_at']
