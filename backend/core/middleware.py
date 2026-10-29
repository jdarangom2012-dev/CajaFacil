import re

_VALIDO = re.compile(r'^[\w\- ]{1,30}$')


class TerminalMiddleware:
    """Identifica la caja (terminal) que hace la petición. En multicaja cada PC envía X-Terminal."""

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        t = request.headers.get('X-Terminal', '').strip()
        request.terminal = t if t and _VALIDO.match(t) else 'CAJA-1'
        return self.get_response(request)
