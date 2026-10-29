from django.contrib.auth.password_validation import validate_password
from rest_framework import serializers

from .models import Usuario


class UsuarioSerializer(serializers.ModelSerializer):
    rol_display = serializers.CharField(source='get_rol_display', read_only=True)
    password = serializers.CharField(write_only=True, required=False, allow_blank=False)

    class Meta:
        model = Usuario
        fields = ('id', 'username', 'nombre_completo', 'rol', 'rol_display', 'telefono',
                  'email', 'is_active', 'last_login', 'date_joined', 'password')
        read_only_fields = ('id', 'last_login', 'date_joined')

    def validate_username(self, v):
        v = v.strip().lower()
        qs = Usuario.objects.filter(username__iexact=v)
        if self.instance:
            qs = qs.exclude(pk=self.instance.pk)
        if qs.exists():
            raise serializers.ValidationError('Ese nombre de usuario ya existe.')
        return v

    def validate(self, attrs):
        if not self.instance and not attrs.get('password'):
            raise serializers.ValidationError({'password': 'La contraseña es obligatoria.'})
        if attrs.get('password'):
            validate_password(attrs['password'])
        return attrs

    def create(self, data):
        pwd = data.pop('password')
        u = Usuario(**data)
        u.set_password(pwd)
        u.save()
        return u

    def update(self, inst, data):
        pwd = data.pop('password', None)
        for k, v in data.items():
            setattr(inst, k, v)
        if pwd:
            inst.set_password(pwd)
        inst.save()
        return inst


class PerfilSerializer(serializers.ModelSerializer):
    rol_display = serializers.CharField(source='get_rol_display', read_only=True)

    class Meta:
        model = Usuario
        fields = ('id', 'username', 'nombre_completo', 'rol', 'rol_display', 'telefono', 'email')
        read_only_fields = ('id', 'username', 'rol')


class CambiarPasswordSerializer(serializers.Serializer):
    actual = serializers.CharField()
    nueva = serializers.CharField(min_length=4)
