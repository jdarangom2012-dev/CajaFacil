from decimal import Decimal

from rest_framework import serializers

from .models import Categoria, MovimientoInventario, Producto


class CategoriaSerializer(serializers.ModelSerializer):
    total_productos = serializers.IntegerField(read_only=True, required=False)

    class Meta:
        model = Categoria
        fields = ('id', 'nombre', 'descripcion', 'color', 'precio_variable', 'controla_stock',
                  'activa', 'total_productos')

    def validate_nombre(self, v):
        v = v.strip()
        qs = Categoria.objects.filter(nombre__iexact=v)
        if self.instance:
            qs = qs.exclude(pk=self.instance.pk)
        if qs.exists():
            raise serializers.ValidationError('Ya existe una categoría con ese nombre.')
        return v


class ProductoSerializer(serializers.ModelSerializer):
    categoria_nombre = serializers.CharField(source='categoria.nombre', read_only=True)
    categoria_color = serializers.CharField(source='categoria.color', read_only=True)
    precio_variable = serializers.BooleanField(read_only=True)
    controla_stock = serializers.BooleanField(read_only=True)
    se_vende_por_peso = serializers.BooleanField(read_only=True)
    margen = serializers.FloatField(read_only=True)
    bajo_minimo = serializers.BooleanField(read_only=True)
    imagen_url = serializers.CharField(read_only=True)
    unidad_display = serializers.CharField(source='get_unidad_medida_display', read_only=True)
    stock_inicial = serializers.DecimalField(max_digits=12, decimal_places=3, write_only=True,
                                             required=False, min_value=Decimal('0'))

    class Meta:
        model = Producto
        fields = ('id', 'codigo_barras', 'nombre', 'descripcion', 'categoria', 'categoria_nombre',
                  'categoria_color', 'precio_costo', 'precio_venta', 'unidad_medida', 'unidad_display',
                  'stock', 'stock_minimo', 'imagen', 'imagen_url', 'favorito', 'activo',
                  'precio_variable', 'controla_stock', 'se_vende_por_peso', 'margen', 'bajo_minimo',
                  'stock_inicial', 'tarifa_iva', 'creado', 'actualizado')
        read_only_fields = ('id', 'stock', 'imagen', 'creado', 'actualizado')

    def validate_codigo_barras(self, v):
        v = (v or '').strip() or None
        if v:
            qs = Producto.objects.filter(codigo_barras=v)
            if self.instance:
                qs = qs.exclude(pk=self.instance.pk)
            existente = qs.first()
            if existente:
                raise serializers.ValidationError(f'El código ya está asignado a "{existente.nombre}".')
        return v

    def validate_nombre(self, v):
        return v.strip()

    def validate(self, attrs):
        venta = attrs.get('precio_venta', getattr(self.instance, 'precio_venta', None))
        cat = attrs.get('categoria', getattr(self.instance, 'categoria', None))
        if venta is not None and venta < 0:
            raise serializers.ValidationError({'precio_venta': 'El precio no puede ser negativo.'})
        if venta is not None and venta == 0 and not (cat and cat.precio_variable):
            raise serializers.ValidationError({'precio_venta': 'Indica el precio de venta.'})
        return attrs


class ProductoPOSSerializer(serializers.ModelSerializer):
    """Versión liviana para la caja (búsqueda rápida)."""
    categoria_nombre = serializers.CharField(source='categoria.nombre', read_only=True)
    categoria_color = serializers.CharField(source='categoria.color', read_only=True)
    precio_variable = serializers.BooleanField(read_only=True)
    controla_stock = serializers.BooleanField(read_only=True)
    se_vende_por_peso = serializers.BooleanField(read_only=True)
    imagen_url = serializers.CharField(read_only=True)

    class Meta:
        model = Producto
        fields = ('id', 'codigo_barras', 'nombre', 'categoria', 'categoria_nombre', 'categoria_color',
                  'precio_venta', 'unidad_medida', 'stock', 'favorito', 'precio_variable',
                  'controla_stock', 'se_vende_por_peso', 'imagen_url')


class MovimientoSerializer(serializers.ModelSerializer):
    producto_nombre = serializers.CharField(source='producto.nombre', read_only=True)
    producto_codigo = serializers.CharField(source='producto.codigo_barras', read_only=True)
    tipo_display = serializers.CharField(source='get_tipo_display', read_only=True)
    usuario_nombre = serializers.CharField(source='usuario.nombre', read_only=True)

    class Meta:
        model = MovimientoInventario
        fields = ('id', 'producto', 'producto_nombre', 'producto_codigo', 'tipo', 'tipo_display',
                  'cantidad', 'stock_anterior', 'stock_nuevo', 'costo_unitario', 'proveedor',
                  'referencia_tipo', 'referencia_id', 'motivo', 'usuario_nombre', 'creado')


class LineaEntradaSerializer(serializers.Serializer):
    producto_id = serializers.UUIDField()
    cantidad = serializers.DecimalField(max_digits=12, decimal_places=3, min_value=Decimal('0.001'))
    costo_unitario = serializers.DecimalField(max_digits=12, decimal_places=2, required=False,
                                              allow_null=True, min_value=Decimal('0'))
    precio_venta = serializers.DecimalField(max_digits=12, decimal_places=2, required=False,
                                            allow_null=True, min_value=Decimal('0'))


class EntradaSerializer(serializers.Serializer):
    proveedor = serializers.CharField(max_length=120, required=False, allow_blank=True)
    factura = serializers.CharField(max_length=60, required=False, allow_blank=True)
    lineas = LineaEntradaSerializer(many=True)

    def validate_lineas(self, v):
        if not v:
            raise serializers.ValidationError('Agrega al menos un producto.')
        return v


class AjusteSerializer(serializers.Serializer):
    producto_id = serializers.UUIDField()
    tipo = serializers.ChoiceField(choices=['AJUSTE_POS', 'AJUSTE_NEG', 'CONTEO'])
    cantidad = serializers.DecimalField(max_digits=12, decimal_places=3, min_value=Decimal('0'))
    motivo = serializers.CharField(max_length=300)

    def validate_motivo(self, v):
        if len(v.strip()) < 3:
            raise serializers.ValidationError('Escribe el motivo del ajuste.')
        return v.strip()
