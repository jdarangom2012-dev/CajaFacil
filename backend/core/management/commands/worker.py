"""
Proceso de fondo de CajaFacil (servicio "CajaFacil-Worker"):
  - Respaldo local automático una vez al día (y limpieza de respaldos viejos)
  - Sincronización con la nube cada N segundos (solo si el plan NUBE está activo)
  - Renovación de la licencia desde la nube una vez al día
  - Envío a la DIAN de los documentos electrónicos pendientes (si el módulo está activo)
"""
import logging
import time

from django.core.management.base import BaseCommand
from django.db import close_old_connections
from django.utils import timezone

from core import licencia, respaldo, sync

log = logging.getLogger('cajafacil.worker')


class Command(BaseCommand):
    help = 'Ejecuta respaldos automáticos y la sincronización con la nube.'

    def add_arguments(self, parser):
        parser.add_argument('--intervalo', type=int, default=60, help='Segundos entre ciclos de sincronización')
        parser.add_argument('--una-vez', action='store_true')

    def handle(self, *args, **opts):
        log.info('Worker de CajaFacil iniciado.')
        ultima_licencia = None
        while True:
            close_old_connections()
            try:
                if respaldo.necesita_respaldo_diario() and timezone.localtime().hour >= 6:
                    r = respaldo.crear('AUTO')
                    log.info('Respaldo diario creado: %s', r.archivo)
                    if licencia.estado_actual().nube_activa:
                        sync.subir_respaldo(r)
            except Exception as e:
                log.warning('Respaldo automático falló: %s', e)

            try:
                est = licencia.estado_actual()
                if ultima_licencia != timezone.localdate():
                    sync.revisar_actualizacion()
                    if not est.licencia_id or sync.renovar_licencia(est):
                        ultima_licencia = timezone.localdate()
                from facturacion import services as fe
                fe_res = fe.enviar_pendientes()
                if fe_res['enviados']:
                    log.info('Facturación electrónica: %s documentos enviados (%s pendientes).',
                             fe_res['enviados'], fe_res['pendientes'])
                res = sync.enviar_pendientes()
                sync.subir_respaldos_pendientes()
                if res['enviados']:
                    log.info('Sincronizados %s eventos (%s pendientes).', res['enviados'], res['pendientes'])
            except Exception as e:
                log.warning('Ciclo de sincronización falló: %s', e)

            if opts['una_vez']:
                break
            time.sleep(max(opts['intervalo'], 10))
