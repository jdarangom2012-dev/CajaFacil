from datetime import date, datetime, time, timedelta
from decimal import Decimal, ROUND_HALF_UP

from django.utils import timezone


def ahora():
    return timezone.localtime()


def hoy() -> date:
    return timezone.localdate()


def rango_dia(dia: date):
    """Devuelve (inicio, fin) con zona horaria local para filtrar un día completo."""
    tz = timezone.get_current_timezone()
    inicio = timezone.make_aware(datetime.combine(dia, time.min), tz)
    return inicio, inicio + timedelta(days=1)


def rango_fechas(desde: date, hasta: date):
    inicio, _ = rango_dia(desde)
    _, fin = rango_dia(hasta)
    return inicio, fin


def parse_fecha(valor, defecto=None):
    if not valor:
        return defecto
    if isinstance(valor, date):
        return valor
    try:
        return date.fromisoformat(str(valor)[:10])
    except ValueError:
        return defecto


def redondear_pesos(valor) -> Decimal:
    return Decimal(valor).quantize(Decimal('1'), rounding=ROUND_HALF_UP)


def a_float(valor) -> float:
    return float(valor or 0)
