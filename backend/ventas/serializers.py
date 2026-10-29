from rest_framework import serializers

from .models import Caja, CuentaEspera, FormaPago, MovimientoCaja, Venta, VentaDetalle, VentaPago


class FormaPagoSerializer(serializers.ModelSerializer):
    tipo_display = serializers.CharField(source='get_tipo_display', read_only=True)

    class Meta:
        model = FormaPago
        fields = ('id', 'nombre', 'tipo', 'tipo_display', 'requiere_referencia', 'color', 'orden', 'activa')

    def validate_nombre(self, v):
        v = v.strip()
        qs = FormaPago.objects.filter(nombre__iexact=v)
        if self.instance:
            qs = qs.exclude(pk=self.instance.pk)
        if qs.exists():
            raise serializers.ValidationError('Ya existe una forma de pago con ese nombre.')
        return v


class VentaDetalleSerializer(serializers.ModelSerializer):
    codigo_barras = serializers.CharField(source='producto.codigo_barras', read_only=True)
    unidad_medida = serializers.CharField(source='producto.unidad_medida', read_only=True)

    class Meta:
        model = VentaDetalle
        fields = ('id', 'producto', 'nombre_producto', 'codigo_barras', 'unidad_medida', 'cantidad',
                  'precio_unit', 'descuento', 'subtotal')


class VentaPagoSerializer(serializers.ModelSerializer):
    forma_pago_nombre = serializers.CharField(source='forma_pago.nombre', read_only=True)
    forma_pago_tipo = serializers.CharField(source='forma_pago.tipo', read_only=True)

    class Meta:
        model = VentaPago
        fields = ('id', 'forma_pago', 'forma_pago_nombre', 'forma_pago_tipo', 'monto', 'recibido', 'referencia')


class VentaListaSerializer(serializers.ModelSerializer):
    usuario_nombre = serializers.CharField(source='usuario.nombre', read_only=True)
    cliente_nombre = serializers.CharField(source='cliente.nombre', read_only=True, default=None)
    formas_pago = serializers.SerializerMethodField()
    items = serializers.IntegerField(read_only=True, required=False)
    fe = serializers.SerializerMethodField()

    class Meta:
        model = Venta
        fields = ('id', 'numero', 'creado', 'terminal', 'usuario_nombre', 'cliente_nombre', 'total',
                  'descuento', 'estado', 'formas_pago', 'items', 'fe')

    def get_fe(self, obj):
        doc = next((d for d in obj.documentos.all() if d.tipo == 'POS'), None)
        return {'numero': doc.numero_completo, 'estado': doc.estado} if doc else None

    def get_formas_pago(self, obj):
        return sorted({p.forma_pago.nombre for p in obj.pagos.all()})


class VentaSerializer(serializers.ModelSerializer):
    usuario_nombre = serializers.CharField(source='usuario.nombre', read_only=True)
    cliente_nombre = serializers.CharField(source='cliente.nombre', read_only=True, default=None)
    anulada_por_nombre = serializers.CharField(source='anulada_por.nombre', read_only=True, default=None)
    caja_numero = serializers.IntegerField(source='caja.numero', read_only=True, default=None)
    detalle = VentaDetalleSerializer(many=True, read_only=True)
    pagos = VentaPagoSerializer(many=True, read_only=True)
    credito_numero = serializers.SerializerMethodField()
    documento_electronico = serializers.SerializerMethodField()

    class Meta:
        model = Venta
        fields = ('id', 'numero', 'creado', 'terminal', 'caja_numero', 'usuario_nombre', 'cliente',
                  'cliente_nombre', 'subtotal', 'descuento', 'total', 'total_pagado', 'cambio', 'estado',
                  'motivo_anulacion', 'anulada_por_nombre', 'anulada_en', 'nota', 'detalle', 'pagos',
                  'credito_numero', 'documento_electronico')

    def get_documento_electronico(self, obj):
        from facturacion.services import info_tiquete
        return info_tiquete(obj)

    def get_credito_numero(self, obj):
        c = getattr(obj, 'credito', None)
        return c.numero if c else None


class CajaSerializer(serializers.ModelSerializer):
    usuario_apertura_nombre = serializers.CharField(source='usuario_apertura.nombre', read_only=True)
    usuario_cierre_nombre = serializers.CharField(source='usuario_cierre.nombre', read_only=True, default=None)

    class Meta:
        model = Caja
        fields = ('id', 'numero', 'terminal', 'estado', 'usuario_apertura_nombre', 'usuario_cierre_nombre',
                  'abierta_en', 'cerrada_en', 'base', 'resumen', 'efectivo_esperado', 'efectivo_contado',
                  'diferencia', 'notas')


class MovimientoCajaSerializer(serializers.ModelSerializer):
    usuario_nombre = serializers.CharField(source='usuario.nombre', read_only=True)
    tipo_display = serializers.CharField(source='get_tipo_display', read_only=True)

    class Meta:
        model = MovimientoCaja
        fields = ('id', 'tipo', 'tipo_display', 'monto', 'concepto', 'usuario_nombre', 'creado')


class CuentaEsperaSerializer(serializers.ModelSerializer):
    usuario_nombre = serializers.CharField(source='usuario.nombre', read_only=True)

    class Meta:
        model = CuentaEspera
        fields = ('id', 'nombre', 'items', 'total', 'usuario_nombre', 'terminal', 'creado')
        read_only_fields = ('id', 'usuario_nombre', 'terminal', 'creado')
