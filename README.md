# CajaFácil

**Sistema POS local para tiendas de barrio y minimercados.** Es PosFácil, pero instalado en el computador del cliente: funciona 100 % sin internet. La nube es opcional y se activa con la licencia.

Desarrollado por **NautilusTech S.A.S.**

---

## Qué incluye

| Módulo | Qué hace |
|---|---|
| **Vender** | Lector de código (`3*codigo` vende 3 unidades), búsqueda, teclas rápidas por categoría y precio libre (Fruver: "por valor" o "por peso" con báscula). También cuentas en espera, descuentos auditados, pago mixto, fiado, cálculo de cambio con billetes sugeridos y ticket. Atajos: F1 vender, F2 cobrar, F4 en espera, F8 abrir cajón. |
| **Caja** | Turno por equipo con base inicial, entradas y salidas de efectivo (pago a proveedores, gastos, retiros). El cierre se hace contando billetes o con el total directo. Muestra esperado contra contado, registra el descuadre en auditoría, imprime el cierre, guarda historial y hace un respaldo automático. |
| **Ventas** | Historial con filtros, detalle, reimpresión, anulación con motivo (devuelve el inventario) y exportación a Excel. |
| **Productos** | Catálogo con código de barras o código interno, categorías con color, precio libre y control de inventario. Margen, foto, favoritos e importación y exportación en Excel/CSV con plantilla. |
| **Inventario** | Existencias y valor del inventario. Entrada de mercancía con varios productos (actualiza costo y precio), ajustes y conteo físico con motivo, movimientos y **pedido sugerido** según la rotación. |
| **Fiado** | Clientes con cupo, venta fiada (total o parcial) y abonos repartidos del fiado más antiguo al más nuevo. Incluye vencimientos, estado de cuenta, **cobro por WhatsApp**, deudas del cuaderno y comprobante de abono. |
| **Reportes** | Ventas por día, hora, forma de pago, categoría, producto y cajero, **utilidad estimada** y Excel. Asistente con IA (plan Nube). |
| **Auditoría** | Registro que no se puede borrar de anulaciones, cambios de precio, descuentos, ajustes, descuadres, aperturas manuales del cajón e intentos de ingreso fallidos. |
| **Usuarios** | Roles: Administrador, Coordinador, Cajero y Almacenista. |
| **Configuración** | Negocio, ventas y fiado, impresora y cajón (ESC/POS directo, red, COM o navegador), báscula, formas de pago, respaldos, licencia y nube, y datos de este equipo (multicaja). |

## Arquitectura

```
┌──────────────── PC de la tienda (Windows 10/11) ─────────────────┐
│  Ventana CajaFácil (Edge/Chrome modo app)  ──►  http://127.0.0.1:8770
│                                                     │
│  Servicio CajaFacil-App    (cajafacil.exe servidor) │ Django 5.2 + DRF + Waitress
│      └─ sirve el frontend React compilado           │ + hardware: impresora ESC/POS, cajón, báscula
│  Servicio CajaFacil-Worker (cajafacil.exe worker)   │ respaldos diarios + sincronizador
│  Servicio CajaFacil-DB     (PostgreSQL portable)    │ puerto 5544, solo localhost
│                                                     │
│  C:\ProgramData\CajaFacil\  cajafacil.ini · pgdata · respaldos · logs · imagenes · licencia.json
└──────────────────────────────────────────────────────────────────┘
           │ (solo con plan NUBE y cuando hay internet)
           ▼
   cajafacil.app  — respaldo, app del dueño, alertas, IA   (servidor en la carpeta nube/)
```

- **IDs UUID** en todas las tablas de negocio. Así se sincroniza con la nube sin choques. Las ventas, cajas y fiados también tienen un **número consecutivo** legible.
- **Outbox** (`core.EventoSync`): cada venta, abono, cierre, alerta y movimiento se encola en la misma transacción. El worker lo envía cuando hay internet.
- **Licencia** firmada con Ed25519 y atada al equipo. Sin licencia hay 15 días de prueba. Si vence, el sistema queda en solo lectura. Si vence el plan Nube, **la caja sigue funcionando** y solo se apaga el sincronizador (con 5 días de gracia).

## Estructura

```
backend/        Django: core (config, licencia, hardware, respaldos, sync), usuarios, catalogo,
                ventas (caja, ventas, en espera), creditos (fiado), auditoria, reportes
  servidor.py   punto de entrada del ejecutable (servidor | worker | manage)
  cajafacil.spec PyInstaller
  tests/        29 pruebas de flujos
frontend/       React 18 + Vite + Tailwind (responsive: PC, tablet y celular)
docs/MANUAL.md  manual para el tendero (también se instala junto al programa)
instalador/     construir.ps1 · CajaFacil.iss (Inno Setup) · scripts de servicios, multicaja y apertura
herramientas/   generar_licencia.py (USO INTERNO) · claves/ (llave privada: NO distribuir)
```

## Desarrollo

```bash
# Base de datos (PostgreSQL 16 local en el puerto 5544)
createuser -p 5544 -P cajafacil      # contraseña: dev123
createdb   -p 5544 -O cajafacil cajafacil

# Backend
cd backend
python -m venv .venv && .venv/Scripts/activate     # Linux: source .venv/bin/activate
pip install -r requirements.txt
set CAJAFACIL_DB_PASSWORD=dev123                   # Linux: export ...
set CAJAFACIL_DEBUG=1
python manage.py migrate
python servidor.py servidor                        # http://127.0.0.1:8770
python manage.py test tests                        # pruebas

# Frontend con recarga en caliente
cd frontend
npm install
npm run dev                                        # http://localhost:5173 (proxy a :8770)
npm run build                                      # compila a backend/frontend_dist
```

Variables útiles: `CAJAFACIL_HOME` (carpeta de datos), `CAJAFACIL_DB_*`, `CAJAFACIL_PG_BIN` y `CAJAFACIL_NUBE_URL`.

## Generar el instalador (en Windows)

```powershell
cd instalador
powershell -ExecutionPolicy Bypass -File construir.ps1
# → instalador\salida\CajaFacil-Instalador-1.0.0.exe
```

Requiere Python 3.12, Node 20 e Inno Setup 6. El script descarga PostgreSQL portable (ZIP "binaries" de EnterpriseDB) y NSSM. Si la versión de PostgreSQL cambió, use `-PgUrl` o `-PgZip`.

**Qué hace el instalador en el PC del cliente:**
1. Copia la app, PostgreSQL y NSSM en `C:\Program Files\CajaFacil`.
2. `configurar.ps1` crea la base en `C:\ProgramData\CajaFacil\pgdata` (puerto 5544, solo localhost, ajustada para PCs de 4 GB), con contraseñas generadas y el servicio **CajaFacil-DB**.
3. Registra **CajaFacil-App** y **CajaFacil-Worker** con NSSM: arranque automático y reinicio si fallan.
4. Crea el acceso directo que abre la app como ventana propia en Edge (`--kiosk-printing`: imprime sin diálogo).
5. Al actualizar, reinstala sobre la versión existente sin tocar los datos. Las migraciones corren solas.
6. Al desinstalar, pregunta si se borran los datos. Por defecto se conservan.

**Multicaja:** en el PC principal ejecute el acceso *"Activar multicaja (red local)"*. Las otras cajas (PC, tablet o celular en el mismo WiFi) entran por `http://IP-DEL-PRINCIPAL:8770`. En cada una:
- Ponga un nombre propio en *Configuración → Este equipo* (CAJA-2…).
- Active *"Imprimir con la impresora de ESTE equipo"*.

## Migrar una tienda desde PosTienda (PosFácil web)

1. Saque un backup de la base de producción de PosTienda (ver abajo) y cópielo a este PC.
2. Doble clic en **`migrar-desde-postienda.cmd`** y seleccione el archivo `.sql` (o `.sql.gz`).
3. El script restaura el backup en una base temporal, **recrea la base de CajaFácil** (pide confirmación), importa todo y muestra la verificación (productos, stock, fiados, cartera, ventas y total vendido: antes → después).

Se migra: negocio, usuarios **con sus mismas contraseñas** (el primer coordinador queda como Administrador; cambie con `-Admin usuario`), categorías (unifica nombres repetidos), productos y stock, formas de pago, clientes del fiado (creados a partir de los nombres; lo que no parece teléfono pasa a notas), fiados y abonos, ventas con detalle y pagos, cierres de caja, movimientos de inventario y auditoría. Los 24 productos más vendidos quedan como teclas rápidas. El cupo de fiado por defecto se calcula para que ningún cliente quede bloqueado (`-TopeFiado 0` = sin tope, como PosFácil en producción).

Con el instalador: `"C:\Program Files\CajaFacil\app\cajafacil.exe" manage importar_postienda --origen-db postienda_import --origen-usuario postgres --origen-clave ...`

**Backup de producción (servidor Linux de Azure, PostgreSQL en el host):**
```bash
sudo -u postgres pg_dump -d postenda_qa --no-owner --no-privileges | gzip > ~/postienda_$(date +%Y%m%d).sql.gz
# luego descargarlo:  scp usuario@IP:~/postienda_AAAAMMDD.sql.gz D:\Obras\PosTienda\db\
```

## Licencias (NautilusTech)

1. El cliente envía el **código del equipo** que aparece en *Configuración → Licencia y nube*.
2. Se genera la licencia:
   ```bash
   python herramientas/generar_licencia.py --cliente "Tienda El Gordo" --nit 71234567 --equipo 0C9B-534B-8142-33CA
   python herramientas/generar_licencia.py --cliente "Tienda El Gordo" --equipo ... --plan NUBE --nube-hasta 2026-11-30 --cajas 2
   ```
3. El cliente pega el texto en la app.
4. Para renovar el plan nube, se genera la licencia con el mismo `--id` y una nueva `--nube-hasta`. Con internet, el worker la descarga solo de la nube (`GET /api/licencias/{id}`).

`python herramientas/generar_licencia.py --listar` muestra el registro de todas las licencias emitidas (`claves/registro_licencias.csv`).

**Protecciones:** la fecha de inicio de la prueba se guarda en la base, en un archivo oculto y en el registro de Windows (se toma la más antigua, así que reinstalar no reinicia la prueba). Si la fecha del PC se atrasa más de un día respecto a la última vista, la caja se bloquea hasta corregir el reloj.

**Actualizaciones:** el worker consulta una vez al día `GET {nube}/api/version` → `{"version": "1.1.0", "url": "https://..."}`; si hay una versión mayor, el administrador ve un aviso con el enlace de descarga. El instalador nuevo se instala encima sin perder datos.

> ⚠️ `herramientas/claves/nautilus_licencias_PRIVADA.pem` es la llave que firma las licencias. Guárdela en un lugar seguro, fuera del repositorio y fuera de los instaladores. Si se pierde, hay que generar otra (`--nuevas-llaves`) y actualizar `LLAVE_PUBLICA_B64` en `backend/core/licencia.py`.

## Contrato con la nube (por construir)

| Método | Ruta | Cuerpo / respuesta |
|---|---|---|
| POST | `/api/sync/eventos` | `{instalacion_id, equipo_id, licencia_id, eventos:[{id,tipo,entidad_id,creado,payload}]}` → `{recibidos:[id…]}`. Es idempotente por `id`. |
| POST | `/api/sync/respaldo` | multipart `archivo` (.dump de pg_dump) |
| GET | `/api/licencias/{licencia_id}?equipo_id=` | licencia firmada vigente |
| GET | `/api/version` | `{version, url}` de la última versión publicada |
| POST | `/api/ia/preguntar` | `{pregunta, contexto, licencia_id, equipo_id}` → `{respuesta}` |

Cabeceras: `X-CajaFacil-Licencia` y `X-CajaFacil-Equipo`. Tipos de evento: `venta`, `credito`, `abono`, `cierre_caja`, `movimiento_inventario`, `producto` y `alerta`.

## Pendientes conocidos

- El instalador de Windows (`configurar.ps1` + Inno Setup) se escribió pero **todavía no se ha ejecutado en un Windows real**. Hay que probarlo en un PC limpio antes de llevarlo a una tienda.
- El servicio en la nube (sincronización, app del dueño, IA) no existe todavía. La app local ya envía los datos según el contrato de arriba.
- Facturación electrónica / documento equivalente POS de la DIAN: no incluido (fase 3, con un proveedor tecnológico habilitado).
- `max_cajas` de la licencia limita cuántas cajas pueden estar abiertas a la vez.
