"""
Lectura de báscula por puerto serial.

La mayoría de básculas de mostrador (Moresco, Lexus, Systel, CAS, Dibal en modo
continuo) envían una trama ASCII con el peso, por ejemplo "  1.235kg" o "ST,GS,+001.235kg".
Algunas requieren un comando previo ("P", "W" o ENQ). Se toma el primer número decimal
de la trama y se interpreta en kilogramos (si la trama dice "g" se divide por 1000).
"""
import re
import time

PATRON = re.compile(r'([-+]?\d+[.,]?\d*)\s*(kg|g|lb)?', re.IGNORECASE)


class ErrorBascula(Exception):
    pass


def interpretar(trama: str) -> float | None:
    for m in PATRON.finditer(trama):
        numero = m.group(1).replace(',', '.')
        try:
            valor = float(numero)
        except ValueError:
            continue
        unidad = (m.group(2) or 'kg').lower()
        if unidad == 'g':
            valor /= 1000
        elif unidad == 'lb':
            valor *= 0.453592
        return round(abs(valor), 3)
    return None


def leer_peso(puerto: str, baudios: int = 9600, comando: str = 'P', intentos: int = 3) -> float:
    try:
        import serial
    except ImportError:
        raise ErrorBascula('Falta el módulo pyserial.')
    if not puerto:
        raise ErrorBascula('Configure el puerto de la báscula.')
    try:
        with serial.Serial(puerto, baudios, timeout=1) as s:
            for _ in range(intentos):
                s.reset_input_buffer()
                if comando:
                    cmd = b'\x05' if comando.upper() == 'ENQ' else comando.encode()
                    s.write(cmd)
                time.sleep(0.25)
                trama = s.read(64).decode('ascii', errors='ignore')
                peso = interpretar(trama)
                if peso is not None:
                    return peso
    except ErrorBascula:
        raise
    except Exception as e:
        raise ErrorBascula(f'No se pudo leer la báscula en {puerto}: {e}')
    raise ErrorBascula('La báscula no respondió. Verifique el cable y el puerto.')
