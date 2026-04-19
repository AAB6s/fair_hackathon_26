from django import forms

# Model 1+2 form — lowercase (matches encoders.pkl)
SEASON_CHOICES_LOWER = [
    ('winter', 'Winter'),
    ('spring', 'Spring'),
    ('summer', 'Summer'),
    ('autumn', 'Autumn'),
]

# Model 3 form — capitalized (matches encoders_m3.pkl)
SEASON_CHOICES_UPPER = [
    ('Winter', 'Winter'),
    ('Spring', 'Spring'),
    ('Summer', 'Summer'),
    ('Autumn', 'Autumn'),
]

GAS_TYPE_CHOICES = [
    ('SO2', 'SO₂ — Sulfur Dioxide'),
    ('HF',  'HF  — Hydrogen Fluoride'),
    ('NOx', 'NOx — Nitrogen Oxides'),
]

W = lambda **kw: forms.NumberInput(attrs={'class': 'form-control', **kw})
S = lambda: forms.Select(attrs={'class': 'form-select'})


class SensorPredictionForm(forms.Form):
    gas_ppm = forms.FloatField(
        label='Gas Concentration (ppm)', min_value=0, max_value=5000,
        widget=W(step='0.1', placeholder='e.g. 320')
    )
    wind_direction = forms.FloatField(
        label='Wind Direction (°)', min_value=0, max_value=360,
        widget=W(step='1', placeholder='0 – 360')
    )
    wind_speed = forms.FloatField(
        label='Wind Speed (km/h)', min_value=0, max_value=150,
        widget=W(step='0.1', placeholder='e.g. 18')
    )
    hour = forms.IntegerField(
        label='Hour of Day (0–23)', min_value=0, max_value=23,
        widget=W(step='1', placeholder='e.g. 14')
    )
    season = forms.ChoiceField(
        label='Season', choices=SEASON_CHOICES_LOWER, widget=S()
    )


class MeteoPredictionForm(forms.Form):
    temp = forms.FloatField(
        label='Daily Mean Temperature (°C)', min_value=-10, max_value=55,
        widget=W(step='0.1', placeholder='e.g. 32')
    )
    wind_speed = forms.FloatField(
        label='Max Wind Speed (km/h)', min_value=0, max_value=150,
        widget=W(step='0.1', placeholder='e.g. 18')
    )
    wind_direction = forms.FloatField(
        label='Wind Direction (°)', min_value=0, max_value=360,
        widget=W(step='1', placeholder='0 – 360')
    )
    season = forms.ChoiceField(
        label='Season', choices=SEASON_CHOICES_UPPER, widget=S()
    )
    gas_type = forms.ChoiceField(
        label='Gas Type', choices=GAS_TYPE_CHOICES, widget=S()
    )
    hour = forms.IntegerField(
        label='Hour of Day (0–23)', min_value=0, max_value=23,
        initial=12, widget=W(step='1', placeholder='12')
    )
    precip = forms.FloatField(
        label='Precipitation (mm)', min_value=0, max_value=200,
        initial=0.0, widget=W(step='0.1', placeholder='0.0')
    )
    day_of_year = forms.IntegerField(
        label='Day of Year (1–365)', min_value=1, max_value=365,
        initial=180, widget=W(step='1', placeholder='180')
    )