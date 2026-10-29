import json

from django.core.serializers.json import DjangoJSONEncoder

from .models import Auditoria


def _json(v):
    if v is None:
        return None
    return json.loads(json.dumps(v, cls=DjangoJSONEncoder))


def registrar(usuario, accion, tabla='', registro_id='', valor_anterior=None, valor_nuevo=None,
              detalle='', request=None, usuario_nombre=None):
    ip = None
    terminal = ''
    if request is not None:
        ip = (request.META.get('HTTP_X_FORWARDED_FOR', '').split(',')[0].strip()
              or request.META.get('REMOTE_ADDR'))
        terminal = getattr(request, 'terminal', '')
    autenticado = usuario is not None and getattr(usuario, 'is_authenticated', False)
    nombre = (usuario.nombre if autenticado else None) or usuario_nombre or 'Sistema'
    reg = Auditoria.objects.create(
        usuario_id_ref=str(usuario.pk) if autenticado else '',
        usuario_nombre=nombre,
        accion=accion,
        tabla_afectada=tabla or '',
        registro_id=str(registro_id or ''),
        valor_anterior=_json(valor_anterior),
        valor_nuevo=_json(valor_nuevo),
        terminal=terminal,
        ip_dispositivo=ip or None,
        detalle=detalle or '',
    )
    if reg.es_alerta:
        from core.sync import encolar
        encolar('alerta', reg.id, {
            'accion': reg.accion, 'usuario': reg.usuario_nombre, 'detalle': reg.detalle,
            'terminal': reg.terminal, 'fecha_hora': reg.fecha_hora,
        })
    return reg
