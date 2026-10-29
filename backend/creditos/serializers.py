from decimal import Decimal

from rest_framework import serializers

from .models import AbonoCredito, Cliente, Credito


class ClienteSerializer(serializers.ModelSerializer):
    saldo = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True, required=False)
    creditos_pendientes = serializers.IntegerField(read_only=True, required=False)
    cupo_efectivo = serializers.SerializerMethodField()
    tiene_vencidos = serializers.BooleanField(read_only=True, required=False)

    class Meta:
        model = Cliente
        fields = ('id', 'nombre', 'telefono', 'documento', 'direccion', 'cupo', 'cupo_efectivo', 'notas',
                  'activo', 'saldo', 'creditos_pendientes', 'tiene_vencidos', 'creado')
        read_only_fields = ('id', 'creado')

    def get_cupo_efectivo(self, obj):
        return obj.cupo_efectivo()

    def validate_nombre(self, v):
        v = ' '.join(v.split()).title()
        qs = Cliente.objects.filter(nombre__iexact=v)
        if self.instance:
            qs = qs.exclude(pk=self.instance.pk)
        if qs.exists():
            raise serializers.ValidationError('Ya existe un cliente con ese nombre.')
        return v


class AbonoSerializer(serializers.ModelSerializer):
    forma_pago_nombre = serializers.CharField(source='forma_pago.nombre', read_only=True)
    usuario_nombre = serializers.CharField(source='usuario.nombre', read_only=True)
    credito_numero = serializers.IntegerField(source='credito.numero', read_only=True)
    cliente_nombre = serializers.CharField(source='credito.cliente.nombre', read_only=True)

    class Meta:
        model = AbonoCredito
        fields = ('id', 'grupo', 'credito', 'credito_numero', 'cliente_nombre', 'forma_pago', 'forma_pago_nombre',
                  'monto', 'referencia', 'nota', 'usuario_nombre', 'creado')


class CreditoSerializer(serializers.ModelSerializer):
    cliente_nombre = serializers.CharField(source='cliente.nombre', read_only=True)
    cliente_telefono = serializers.CharField(source='cliente.telefono', read_only=True)
    usuario_nombre = serializers.CharField(source='usuario.nombre', read_only=True)
    venta_numero = serializers.IntegerField(source='venta.numero', read_only=True, default=None)
    saldo = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)
    vencido = serializers.BooleanField(read_only=True)
    dias_mora = serializers.IntegerField(read_only=True)
    productos = serializers.SerializerMethodField()
    abonos = AbonoSerializer(many=True, read_only=True)

    class Meta:
        model = Credito
        fields = ('id', 'numero', 'cliente', 'cliente_nombre', 'cliente_telefono', 'venta', 'venta_numero',
                  'total', 'abonado', 'saldo', 'estado', 'vence', 'vencido', 'dias_mora', 'notas',
                  'usuario_nombre', 'creado', 'pagado_en', 'productos', 'abonos')

    def get_productos(self, obj):
        if not obj.venta_id:
            return []
        return [{'nombre': d.nombre_producto, 'cantidad': d.cantidad, 'subtotal': d.subtotal}
                for d in obj.venta.detalle.all()]


class CrearCreditoSerializer(serializers.Serializer):
    cliente_id = serializers.UUIDField()
    total = serializers.DecimalField(max_digits=12, decimal_places=2, min_value=Decimal('1'))
    notas = serializers.CharField(max_length=300, required=False, allow_blank=True)


class AbonarSerializer(serializers.Serializer):
    monto = serializers.DecimalField(max_digits=12, decimal_places=2, min_value=Decimal('1'))
    forma_pago_id = serializers.UUIDField()
    referencia = serializers.CharField(max_length=100, required=False, allow_blank=True)
    nota = serializers.CharField(max_length=200, required=False, allow_blank=True)
    imprimir = serializers.BooleanField(required=False, default=False)
