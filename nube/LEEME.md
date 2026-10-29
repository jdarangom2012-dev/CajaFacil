# CajaFácil Nube

El servidor que recibe los datos de las tiendas con plan Nube. También tiene el panel donde el dueño ve su tienda desde el celular.

- **Panel del dueño:** https://cajafacil.app. Muestra ventas, cierres de caja, fiados, inventario, alertas y reportes. Se puede instalar en el celular con "Agregar a la pantalla de inicio".
- **Panel de NautilusTech:** https://cajafacil.app/nautilus/. Sirve para dar de alta tiendas, registrar pagos y crear los usuarios de los dueños.

Dominio: **cajafacil.app** (se compra en GoDaddy). `cajafacil.nautilustech.app` queda como alias opcional para equipos de prueba.

---

## 1. Montarlo en la VM Linux de Azure (una sola vez)

### 1.1 DNS en GoDaddy
En GoDaddy → cajafacil.app → DNS, deja estos registros (borra el "Parked" que trae GoDaddy):

| Tipo | Nombre | Valor | TTL |
|------|--------|-------|-----|
| A | `@` | IP pública de la VM Linux | 1 hora |
| CNAME | `www` | `cajafacil.app` | 1 hora |

Opcional, en nautilustech.app → DNS: A `cajafacil` → misma IP (alias para equipos de prueba).

Para comprobarlo, `nslookup cajafacil.app` debe responder con la IP de la VM. Puede tardar unos minutos.

### 1.2 Copiar el código y configurar
```bash
# En la VM
cd ~ && git clone <tu repo de CajaFacil> cajafacil   # o copia la carpeta nube/ con scp
cd cajafacil/nube
cp ejemplo-configuracion.txt .env
nano .env        # cambia NUBE_SECRET_KEY y NUBE_DB_PASSWORD (genera claves largas)
```

### 1.3 Arrancar
```bash
docker compose up -d --build
docker compose logs -f app       # debe decir "Listening at: http://0.0.0.0:8000"
curl http://127.0.0.1:8095/api/version
```

### 1.4 Crear tu usuario de NautilusTech
```bash
docker compose exec app python manage.py createsuperuser
```

### 1.5 HTTPS con Caddy
Agrega el bloque de `Caddyfile.ejemplo` al Caddyfile que ya usas en la VM y recarga Caddy. Caddy saca el certificado solo.

Revisa que entren `https://cajafacil.app` (el panel) y `/nautilus/` (tu administración).

### 1.6 Copia de seguridad de la nube (cron diario)
```bash
crontab -e
# Agregar:
30 3 * * * cd ~/cajafacil/nube && docker compose exec -T db pg_dump -U cajafacil_nube -Fc cajafacil_nube > ~/respaldos_nube/nube_$(date +\%u).dump
```
Antes de que corra la primera vez, crea la carpeta con `mkdir -p ~/respaldos_nube`. Se guardan 7 copias, una por día de la semana.

### Actualizar a una versión nueva
```bash
cd ~/cajafacil && git pull && cd nube && docker compose up -d --build
```

---

## 2. Vender una tienda con Nube (lo de todos los días)

1. **Licencia con plan Nube, sin fecha.** En tu PC:
   ```
   python generar_licencia.py --cliente "Tienda El Gordo" --nit 71234567 --equipo XXXX-XXXX-XXXX-XXXX --plan NUBE
   ```
   La licencia queda con la nube abierta. El cobro mensual se controla en el servidor, así que no hay que volver a firmarla cada mes.
2. **Activarla en la tienda.** Se pega en CajaFácil → Configuración → Licencia y nube, igual que siempre.
3. **Darla de alta en la nube.** Entra a `/nautilus/` → Tiendas → Añadir tienda:
   - Pega el mismo texto de la licencia.
   - Meses gratis: **3** (promoción Black Friday).
   - Escribe el usuario y la clave del dueño, más su WhatsApp y el vendedor.
   - Guarda.
4. Listo. En menos de un minuto CajaFácil sube por sí solo lo que ya había en la tienda:
   - todos los productos;
   - los fiados pendientes;
   - las ventas y los cierres de los últimos 60 días.

   Desde ahí cada venta llega en menos de un minuto, y la copia de seguridad se sube una vez al día.
5. Al dueño le dices: *"Entre a cajafacil.app con este usuario y clave, y guárdelo en la pantalla del celular."*

### Cobrar la mensualidad
En `/nautilus/` → Tiendas, marca la tienda y elige la acción:
- **Registrar: 1 mes de nube ($25.000)**
- **Registrar: 1 año de nube ($300.000)**

La fecha "pagada hasta" se corre sola y el pago queda registrado en **Pagos**. Ahí puedes sumar lo de cada vendedor.

### Si no paga
Hay **5 días de gracia**, que se ajustan con `NUBE_DIAS_GRACIA`. Después de eso:
- La caja de la tienda **sigue funcionando normal**: la nube nunca bloquea las ventas.
- La nube deja de recibir datos. Esos datos **se quedan guardados en la tienda**, así que no se pierde nada.
- El panel le muestra al dueño "Tu suscripción venció" con un botón de WhatsApp.

Apenas registres el pago, la tienda envía todo lo que tenía pendiente.

### Cliente que compró Básico y después quiere Nube
1. Genera la licencia nueva con el **mismo `--id`** y `--plan NUBE`.
2. Dala de alta en `/nautilus/` como en el paso 3.

Al día siguiente CajaFácil la descarga sola. Si no quieres esperar, pégala en la tienda.

### Cambio de computador
1. Genera la licencia con el mismo `--id` y el código del equipo nuevo.
2. Pégala en la tienda.
3. En `/nautilus/`, abre la tienda y pégala en "Licencia".

---

## 3. Cómo funciona por dentro

- **Autenticación de la tienda.** CajaFácil manda tres cabeceras:
  - el `licencia_id`;
  - el código del equipo;
  - un token, que es el sha256 de la firma de la licencia.

  La nube solo acepta tiendas cuya licencia esté cargada en `/nautilus/`. **La llave privada nunca va al servidor:** la nube solo verifica firmas con la llave pública.
- **Datos.**
  - Cada operación de la tienda es un evento con un id único. Reenviarlo no duplica nada.
  - Si dos eventos tocan lo mismo, gana el más reciente.
  - Un evento con datos raros queda guardado con su error y no frena los demás. Se ve en `/nautilus/` → Eventos.
- **Aislamiento.** Cada dueño solo ve sus tiendas. Los usuarios de NautilusTech (staff) ven todas, para dar soporte.
- **Copias de seguridad.** Se guardan las últimas 10 de cada tienda (`NUBE_RESPALDOS_CONSERVAR`) en el volumen `respaldos`. Para restaurar una tienda en un PC nuevo, descarga el `.dump` de `/var/lib/docker/volumes/nube_respaldos/_data/<id de la tienda>/`. En el PC nuevo, con CajaFácil instalado, corre como administrador `cajafacil.exe respaldar --restaurar C:\ruta\archivo.dump`.
- **Asistente con IA.** Se activa poniendo `OPENAI_API_KEY` en `.env`. Sin la clave, responde "muy pronto".

## 4. Desarrollo local
```bash
cd nube/backend
NUBE_DEBUG=1 python manage.py migrate
NUBE_DEBUG=1 python manage.py test tests        # pruebas
NUBE_DEBUG=1 python manage.py runserver 8790
cd ../frontend && npm install && npm run dev     # panel en http://localhost:5174
```
Para que tu CajaFácil local mande datos a esta nube de pruebas, arráncala con `CAJAFACIL_NUBE_URL=http://127.0.0.1:8790`.
