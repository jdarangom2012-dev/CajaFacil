"""Constructor mínimo de comandos ESC/POS (impresoras térmicas 58/80 mm)."""
import unicodedata

ESC = b'\x1b'
GS = b'\x1d'

INICIAR = ESC + b'@'
CORTAR = GS + b'V\x41\x03'
# Pulso al cajón monedero conectado a la impresora (pin 2)
ABRIR_CAJON = ESC + b'p\x00\x19\xfa'
ABRIR_CAJON_PIN5 = ESC + b'p\x01\x19\xfa'
# Tabla de caracteres PC850 (multilingüe) para tildes y ñ
CODEPAGE_850 = ESC + b't\x02'


def _texto(s: str) -> bytes:
    try:
        return s.encode('cp850')
    except UnicodeEncodeError:
        limpio = unicodedata.normalize('NFKD', s).encode('ascii', 'ignore')
        return limpio


class Ticket:
    def __init__(self, ancho_mm: int = 80):
        self.cols = 48 if ancho_mm >= 80 else 32
        self.buf = bytearray(INICIAR + CODEPAGE_850)

    # ── formato ──────────────────────────────────
    def alinear(self, modo: str):
        self.buf += ESC + b'a' + {'izq': b'\x00', 'centro': b'\x01', 'der': b'\x02'}[modo]
        return self

    def negrita(self, on=True):
        self.buf += ESC + b'E' + (b'\x01' if on else b'\x00')
        return self

    def grande(self, on=True):
        self.buf += GS + b'!' + (b'\x11' if on else b'\x00')
        return self

    # ── contenido ────────────────────────────────
    def linea(self, texto: str = ''):
        self.buf += _texto(texto[:self.cols]) + b'\n'
        return self

    def separador(self, car='-'):
        return self.linea(car * self.cols)

    def dos_columnas(self, izq: str, der: str):
        izq = izq or ''
        der = der or ''
        espacio = self.cols - len(der) - 1
        if len(izq) > espacio:
            # el texto largo va en su propia línea
            self.linea(izq[:self.cols])
            izq = ''
        return self.linea(izq.ljust(self.cols - len(der)) + der)

    def parrafo(self, texto: str):
        """Texto largo partido en varias líneas (CUDE, resoluciones…)."""
        texto = texto or ''
        for i in range(0, len(texto), self.cols):
            self.linea(texto[i:i + self.cols])
        return self

    def qr(self, datos: str, tamano: int = 5):
        """Código QR nativo de la impresora (ESC/POS GS ( k, modelo 2)."""
        d = (datos or '').encode('utf-8')
        if not d:
            return self
        n = len(d) + 3
        self.buf += GS + b'(k\x04\x00\x31\x41\x32\x00'                    # modelo 2
        self.buf += GS + b'(k\x03\x00\x31\x43' + bytes([max(1, min(tamano, 16))])  # tamaño del módulo
        self.buf += GS + b'(k\x03\x00\x31\x45\x31'                         # corrección de errores M
        self.buf += GS + b'(k' + bytes([n % 256, n // 256]) + b'\x31\x50\x30' + d  # guardar datos
        self.buf += GS + b'(k\x03\x00\x31\x51\x30'                         # imprimir
        self.buf += b'\n'
        return self

    def avanzar(self, n=3):
        self.buf += b'\n' * n
        return self

    def cortar(self):
        self.avanzar(3)
        self.buf += CORTAR
        return self

    def abrir_cajon(self):
        self.buf += ABRIR_CAJON
        return self

    def bytes(self) -> bytes:
        return bytes(self.buf)
