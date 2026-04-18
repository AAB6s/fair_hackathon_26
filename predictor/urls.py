from django.urls import path
from . import views

urlpatterns = [
    path('',                  views.dashboard,    name='dashboard'),
    path('sensor/',           views.sensor_predict, name='sensor_predict'),
    path('meteo/',            views.meteo_predict,  name='meteo_predict'),
    path('history/',          views.history,        name='history'),
    path('api/sensor/',       views.api_sensor,     name='api_sensor'),
    path('api/meteo/',        views.api_meteo,      name='api_meteo'),
]
