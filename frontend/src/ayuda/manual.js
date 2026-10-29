/*
  Manual de CajaFácil — el mismo contenido alimenta:
    · la página Ayuda (manual completo)
    · el panel de ayuda de cada pantalla (F1 sobre un espacio vacío)
    · la explicación de cada opción (F1 con el mouse encima, o el "Modo ayuda")

  Cada sección:
    id, titulo, icono, rutas (pantallas donde aplica), quien (roles), resumen,
    captura (archivo en /manual/), tareas [{titulo, pasos[]}], consejos[],
    elementos [{id, titulo, texto, textos[]}]
      · id: se usa con data-ayuda="id" en la pantalla
      · textos: palabras con las que empieza el botón/campo, para reconocerlo sin marcarlo
*/

export const SOPORTE = {
  whatsapp: '573151355693',
  whatsappTexto: '+57 315 135 5693',
  web: 'nautilustech.app',
}

export const ATAJOS = [
  { tecla: 'F1', que: 'Ayuda: pon el mouse sobre cualquier opción y presiona F1' },
  { tecla: 'F3', que: 'Ir a vender desde cualquier pantalla' },
  { tecla: 'Enter', que: 'En vender: agrega el producto (o cobra si la búsqueda está vacía)' },
  { tecla: 'F2', que: 'Cobrar la venta' },
  { tecla: 'F4', que: 'Poner la venta en espera' },
  { tecla: 'F8', que: 'Abrir el cajón del dinero' },
  { tecla: 'Supr', que: 'Quitar el último producto de la venta' },
  { tecla: '3*código', que: 'Vender varias unidades de una vez (ej: 3*7702004003508)' },
  { tecla: 'Esc', que: 'Cerrar una ventana o limpiar la búsqueda' },
]

export const SECCIONES = [
  /* ───────────────────────── Primeros pasos ───────────────────────── */
  {
    id: 'primeros-pasos',
    titulo: 'Primeros pasos',
    icono: 'Sparkles',
    rutas: [],
    resumen: 'Cómo entrar a CajaFácil, moverte por el menú y pedir ayuda cuando no sepas algo.',
    captura: 'login.webp',
    tareas: [
      {
        titulo: 'Entrar a CajaFácil',
        pasos: [
          'Haz doble clic en el ícono **CajaFácil** del escritorio.',
          'Escribe tu **usuario** y tu **contraseña** y presiona **Entrar**.',
          'Cada persona debe usar **su propio usuario**: todo lo que se hace queda guardado a nombre de quien lo hizo.',
        ],
      },
      {
        titulo: 'Moverte por el programa',
        pasos: [
          'A la izquierda está el **menú**: Inicio, Vender, Caja, Ventas, Productos, Fiado…',
          'En el celular o la tablet el menú está abajo; toca **Más** para ver todas las opciones.',
          'Solo ves las opciones que tu usuario tiene permitidas.',
        ],
      },
      {
        titulo: 'Pedir ayuda dentro del programa',
        pasos: [
          'Pon el mouse encima de cualquier botón o casilla y presiona la tecla **F1**: te explica para qué sirve.',
          'Si presionas **F1** sin señalar nada, se abre la ayuda de la pantalla donde estás.',
          'También puedes tocar el botón **?** de arriba y luego tocar cualquier opción.',
        ],
      },
    ],
    consejos: [
      'Si te equivocas, tranquilo: casi todo se puede corregir, y lo delicado pide confirmación.',
      'El botón de la luna 🌙 pone la pantalla oscura (modo noche); el sol ☀️ la vuelve clara.',
    ],
    elementos: [
      { id: 'login.usuario', titulo: 'Usuario', texto: 'El nombre con el que entras. Te lo da el dueño o administrador de la tienda.', textos: ['Usuario'] },
      { id: 'login.clave', titulo: 'Contraseña', texto: 'Tu clave secreta. No la compartas: todo lo que se hace con tu usuario queda a tu nombre.', textos: ['Contraseña'] },
      { id: 'login.entrar', titulo: 'Entrar', texto: 'Abre CajaFácil con tu usuario.', textos: ['Entrar'] },
    ],
  },

  /* ───────────────────────── Menú ───────────────────────── */
  {
    id: 'menu',
    titulo: 'El menú y la barra de arriba',
    icono: 'Menu',
    rutas: [],
    resumen: 'El menú de la izquierda te lleva a cada parte del programa. Arriba ves el estado de la caja, la ayuda, el modo noche y tu usuario.',
    elementos: [
      { id: 'menu.inicio', titulo: 'Inicio', texto: 'El resumen del día: ventas, formas de pago, lo más vendido y lo que se está acabando.' },
      { id: 'menu.vender', titulo: 'Vender (F3)', texto: 'La caja registradora: aquí haces las ventas. Desde cualquier pantalla puedes llegar con la tecla F3.' },
      { id: 'menu.caja', titulo: 'Caja', texto: 'El turno abierto: plata que entra y sale del cajón y el cierre (cuadre) al final del día.' },
      { id: 'menu.ventas', titulo: 'Ventas', texto: 'El historial de todas las ventas: buscar, reimprimir tiquetes o anular.' },
      { id: 'menu.productos', titulo: 'Productos', texto: 'Tu catálogo: crear productos, cambiar precios, fotos y favoritos.' },
      { id: 'menu.categorias', titulo: 'Categorías', texto: 'Los grupos de productos (bebidas, aseo, fruver…) y sus reglas.' },
      { id: 'menu.inventario', titulo: 'Inventario', texto: 'Mercancía que llega, ajustes de cantidades y qué pedir al proveedor.' },
      { id: 'menu.fiado', titulo: 'Fiado', texto: 'Quién te debe, cuánto, los abonos y el cobro por WhatsApp.' },
      { id: 'menu.reportes', titulo: 'Reportes', texto: 'Cuánto vendes y cuánto ganas por día, categoría, producto y cajero.' },
      { id: 'menu.auditoria', titulo: 'Auditoría', texto: 'El registro de seguridad: anulaciones, cambios de precio, descuadres y más. No se puede borrar.' },
      { id: 'menu.usuarios', titulo: 'Usuarios', texto: 'Quién puede entrar al programa y qué puede hacer cada uno.' },
      { id: 'menu.configuracion', titulo: 'Configuración', texto: 'Datos del negocio, impresora, báscula, formas de pago, copias de seguridad y licencia.' },
      { id: 'menu.ayuda', titulo: 'Ayuda', texto: 'Este manual, con todas las explicaciones paso a paso.' },
      { id: 'menu.estado-caja', titulo: 'Estado de la caja', texto: 'Te dice si tu caja está abierta o cerrada. Tócalo para ir a la caja.' },
      { id: 'menu.tema', titulo: 'Modo noche / día', texto: 'Cambia los colores de la pantalla: oscuros (noche) para descansar la vista, o claros (día).' },
      { id: 'menu.usuario', titulo: 'Tu usuario', texto: 'Quién está usando el programa. Desde aquí cambias tu contraseña o cierras sesión.' },
      { id: 'menu.mas', titulo: 'Más', texto: 'En el celular o la tablet, abre el menú completo.' },
    ],
  },

  /* ───────────────────────── Inicio ───────────────────────── */
  {
    id: 'inicio',
    titulo: 'Inicio',
    icono: 'LayoutDashboard',
    rutas: ['/'],
    resumen: 'Es el resumen del día: cuánto has vendido, cómo te pagaron, lo que más se vende y lo que se está acabando.',
    captura: 'inicio.webp',
    tareas: [
      {
        titulo: 'Revisar cómo va el día',
        pasos: [
          'Mira **Vendido hoy** para saber cuánto llevas.',
          'En **Cómo te pagaron hoy** ves cuánto entró en efectivo, Nequi, tarjeta o fiado.',
          'En **Por agotarse** aparecen los productos que debes pedir pronto.',
        ],
      },
    ],
    consejos: ['Toca el botón **Vender** (o presiona **F3**) para ir directo a la caja.'],
    elementos: [
      { id: 'inicio.vender', titulo: 'Vender', texto: 'Te lleva a la pantalla de venta (la caja registradora). También puedes presionar F3 desde cualquier pantalla.', textos: ['Vender'] },
      { id: 'inicio.caja', titulo: 'Caja', texto: 'Te lleva a la caja: el turno abierto, la plata que entra y sale y el cierre del día.', textos: ['Caja'] },
      { id: 'inicio.vendido', titulo: 'Vendido hoy', texto: 'Todo lo que has vendido hoy, sumando todas las formas de pago. No incluye las ventas anuladas.', textos: ['Vendido hoy'] },
      { id: 'inicio.ventas', titulo: 'Ventas', texto: 'Cuántas ventas (tickets) has hecho hoy.', textos: ['Ventas'] },
      { id: 'inicio.utilidad', titulo: 'Utilidad estimada', texto: 'Lo que te queda de ganancia: precio de venta menos el costo de los productos. Es aproximada: depende de que los costos estén bien escritos en Productos.', textos: ['Utilidad estimada'] },
      { id: 'inicio.fiado', titulo: 'Fiado por cobrar', texto: 'Todo lo que los clientes te deben en este momento.', textos: ['Fiado por cobrar'] },
      { id: 'inicio.pagos', titulo: 'Cómo te pagaron hoy', texto: 'Cuánto entró por cada forma de pago: efectivo, Nequi, Daviplata, tarjeta, fiado…', textos: ['Cómo te pagaron hoy'] },
      { id: 'inicio.hora', titulo: 'Ventas por hora', texto: 'A qué horas vendes más. Te sirve para saber cuándo necesitas más gente en la caja.', textos: ['Ventas por hora'] },
      { id: 'inicio.semana', titulo: 'Últimos 7 días', texto: 'Cuánto vendiste cada día de la última semana, para comparar.', textos: ['Últimos 7 días'] },
      { id: 'inicio.top', titulo: 'Lo más vendido hoy', texto: 'Los productos que más salieron hoy.', textos: ['Lo más vendido hoy'] },
      { id: 'inicio.agotarse', titulo: 'Por agotarse', texto: 'Productos que tienen igual o menos cantidad que su "stock mínimo". Es hora de pedirlos al proveedor.', textos: ['Por agotarse', 'Pedido sugerido'] },
      { id: 'inicio.ultimas', titulo: 'Últimas ventas', texto: 'Las ventas más recientes. Toca "Ver todas" para ir al historial completo.', textos: ['Últimas ventas', 'Ver todas'] },
    ],
  },

  /* ───────────────────────── Vender ───────────────────────── */
  {
    id: 'vender',
    titulo: 'Vender',
    icono: 'ShoppingCart',
    rutas: ['/vender'],
    quien: 'Todos los que venden',
    resumen: 'La caja registradora: aquí agregas los productos que lleva el cliente y cobras.',
    captura: 'vender.webp',
    tareas: [
      {
        titulo: 'Abrir la caja (al empezar el día)',
        pasos: [
          'Entra a **Vender** (o presiona **F3**).',
          'Cuenta el dinero con el que empiezas en el cajón (la **base**) y escríbelo, o toca uno de los valores.',
          'Toca **Abrir caja**. Sin caja abierta no se puede vender.',
        ],
      },
      {
        titulo: 'Hacer una venta',
        pasos: [
          'Pasa el producto por el **lector de código de barras**: se agrega solo.',
          'Si no tiene código, escribe parte del nombre (ej: "arroz") y toca el producto, o búscalo en la **cuadrícula** de abajo.',
          'Para varias unidades escribe la cantidad y un asterisco antes del código: **3*** y luego el código.',
          'Revisa el **Total a cobrar** y toca **Cobrar** (o **F2**).',
        ],
      },
      {
        titulo: 'Vender fruver, carnes o granel (precio libre)',
        pasos: [
          'Toca el producto. Se abre una ventana.',
          'Elige **Por valor** si el cliente pide "dos mil de tomate", o **Por peso** si lo pesas (escribe los kilos o lee la báscula).',
          'Toca **Agregar**.',
        ],
      },
      {
        titulo: 'Corregir la venta',
        pasos: [
          'Con **−** y **+** cambias la cantidad de un producto.',
          'Toca el nombre del producto en la venta para cambiar la cantidad o hacer un **descuento**.',
          'La caneca 🗑️ quita el producto. **Supr** quita el último que agregaste.',
          '**Vaciar** borra toda la venta para empezar de nuevo.',
        ],
      },
      {
        titulo: 'Atender a otro cliente sin perder la venta',
        pasos: [
          'Toca el botón de **pausa** (o **F4**): la venta queda guardada en espera.',
          'Atiende al otro cliente normalmente.',
          'Para retomarla, toca el botón naranja con el valor de la venta en espera.',
        ],
      },
    ],
    consejos: [
      'El cursor siempre queda listo en el buscador: puedes pasar productos por el lector sin tocar nada.',
      'Los productos con ⭐ aparecen en **Rápidos**: marca así los que más vendes.',
      'Los descuentos y las aperturas del cajón quedan registrados en la auditoría.',
    ],
    elementos: [
      { id: 'vender.base', titulo: 'Base de la caja', texto: 'El dinero con el que empiezas el turno en el cajón (para dar vueltas). Cuéntalo y escríbelo antes de abrir la caja.', textos: ['Abre la caja para empezar', 'Base'] },
      { id: 'vender.abrir', titulo: 'Abrir caja', texto: 'Empieza tu turno con la base que escribiste. Desde ese momento puedes vender. Cada computador abre su propia caja.', textos: ['Abrir caja'] },
      { id: 'vender.buscar', titulo: 'Buscador / lector de código', texto: 'Aquí entra lo que pasas por el lector de código de barras. También puedes escribir parte del nombre del producto y presionar Enter o tocarlo en la lista. Para varias unidades: 3*código.', textos: ['Escanea el código'] },
      { id: 'vender.categorias', titulo: 'Categorías', texto: 'Filtra la cuadrícula de productos por grupo (bebidas, aseo, fruver…). "Rápidos" muestra los productos marcados con ⭐.', textos: ['Rápidos'] },
      { id: 'vender.admin-categorias', titulo: 'Administrar categorías', texto: 'Te lleva a crear o cambiar las categorías (grupos de productos).', textos: ['Administrar categorías'] },
      { id: 'vender.cuadricula', titulo: 'Cuadrícula de productos', texto: 'Toca un producto para agregarlo a la venta. Los que dicen "Precio libre" te preguntan el valor o el peso.' },
      { id: 'vender.carrito', titulo: 'Venta actual', texto: 'Los productos que lleva el cliente. Toca el nombre de un producto para cambiar la cantidad o darle descuento.', textos: ['Venta actual'] },
      { id: 'vender.vaciar', titulo: 'Vaciar', texto: 'Borra todos los productos de la venta actual. No se guarda nada.', textos: ['Vaciar'] },
      { id: 'vender.total', titulo: 'Total a cobrar', texto: 'Lo que debe pagar el cliente, ya con descuentos.', textos: ['Total a cobrar'] },
      { id: 'vender.espera', titulo: 'Poner en espera (F4)', texto: 'Guarda la venta para atender a otro cliente. Luego la retomas con el botón naranja que aparece arriba de la venta.', textos: ['Poner en espera'] },
      { id: 'vender.cajon', titulo: 'Abrir cajón (F8)', texto: 'Abre el cajón del dinero sin hacer una venta (por ejemplo, para dar cambio). Queda registrado en la auditoría.', textos: ['Abrir cajón'] },
      { id: 'vender.cobrar', titulo: 'Cobrar (F2)', texto: 'Abre la ventana de pago para terminar la venta.', textos: ['Cobrar'] },
      { id: 'vender.atajos', titulo: 'Teclas rápidas', texto: 'Las teclas que te ahorran tiempo: Enter agrega, F2 cobra, F4 pone en espera, F8 abre el cajón, Supr quita el último.' },
      { id: 'vender.linea', titulo: 'Producto en la venta', texto: 'Con − y + cambias la cantidad. Toca el nombre para hacer descuento o escribir la cantidad. La caneca lo quita.' },
    ],
  },

  /* ───────────────────────── Cobrar ───────────────────────── */
  {
    id: 'cobrar',
    titulo: 'Cobrar una venta',
    icono: 'Banknote',
    rutas: ['/vender'],
    resumen: 'La ventana de pago: eliges cómo paga el cliente, calculas el cambio y terminas la venta.',
    captura: 'cobrar.webp',
    tareas: [
      {
        titulo: 'Cobrar en efectivo',
        pasos: [
          'Deja seleccionado **Efectivo**.',
          'Toca el billete con el que te paga el cliente (o escribe el valor). El **cambio** aparece en verde.',
          'Toca **Confirmar venta** (o **Enter**). Se imprime el tiquete y se abre el cajón.',
        ],
      },
      {
        titulo: 'Cobrar por Nequi, Daviplata, Bre-B o tarjeta',
        pasos: [
          'Toca la forma de pago.',
          'Verifica en tu celular o datáfono que el dinero sí llegó.',
          'Toca **Confirmar venta**.',
        ],
      },
      {
        titulo: 'El cliente paga una parte en efectivo y otra por Nequi',
        pasos: [
          'Toca **Dividir el pago**.',
          'Escribe cuánto paga con cada forma.',
          'Cuando "Falta" quede en cero, toca **Confirmar venta**.',
        ],
      },
      {
        titulo: 'Fiar',
        pasos: [
          'Toca **Fiado**.',
          'Busca al cliente por nombre o celular. Si es nuevo, toca **Nuevo** y escribe su nombre y celular.',
          'Toca **Confirmar venta**. Si el cliente ya pasó su cupo, el sistema no deja fiarle más.',
        ],
      },
    ],
    consejos: ['Si te equivocaste de forma de pago después de vender, un coordinador o el dueño puede anular la venta en **Ventas** y la haces de nuevo.'],
    elementos: [
      { id: 'cobrar.forma', titulo: 'Forma de pago', texto: 'Cómo paga el cliente: efectivo, Nequi, Daviplata, Bre-B, tarjeta o fiado.', textos: ['Forma de pago', 'Efectivo', 'Nequi', 'Daviplata', 'Bre-B', 'Tarjeta', 'Transferencia'] },
      { id: 'cobrar.fiado', titulo: 'Fiado', texto: 'La venta queda como deuda del cliente. Debes elegir a quién se le fía.', textos: ['Fiado', 'Crédito'] },
      { id: 'cobrar.recibido', titulo: 'Con cuánto paga', texto: 'El dinero que te entrega el cliente. Toca un billete o escribe el valor; "Exacto" es cuando paga justo.', textos: ['Con cuánto paga', 'Recibido', 'Exacto'] },
      { id: 'cobrar.cambio', titulo: 'Cambio', texto: 'Las vueltas que le debes dar al cliente.', textos: ['Cambio'] },
      { id: 'cobrar.dividir', titulo: 'Dividir el pago', texto: 'Para cuando el cliente paga con dos formas, por ejemplo parte en efectivo y parte por Nequi.', textos: ['Dividir el pago'] },
      { id: 'cobrar.cliente', titulo: 'Cliente del fiado', texto: 'A quién se le fía. Búscalo por nombre o celular, o crea uno nuevo con "Nuevo".', textos: ['Cliente del fiado', 'Nuevo', 'Crear cliente'] },
      { id: 'cobrar.imprimir', titulo: 'Imprimir ticket', texto: 'Si está activo, se imprime el tiquete al confirmar la venta.', textos: ['Imprimir ticket', 'Imprimir'] },
      { id: 'cobrar.confirmar', titulo: 'Confirmar venta', texto: 'Termina la venta: descuenta el inventario, guarda el pago, imprime y abre el cajón.', textos: ['Confirmar venta'] },
      { id: 'cobrar.volver', titulo: 'Volver', texto: 'Regresa a la venta sin cobrar, por si falta agregar algo.', textos: ['Volver'] },
      { id: 'cobrar.nueva', titulo: 'Nueva venta', texto: 'Cierra el comprobante y deja la caja lista para el siguiente cliente.', textos: ['Nueva venta'] },
    ],
  },

  /* ───────────────────────── Caja ───────────────────────── */
  {
    id: 'caja',
    titulo: 'Caja: entradas, salidas y cierre',
    icono: 'Wallet',
    rutas: ['/caja'],
    resumen: 'Aquí ves el turno abierto, registras la plata que sale o entra al cajón y haces el cierre (cuadre) al final del día.',
    captura: 'caja.webp',
    tareas: [
      {
        titulo: 'Sacar dinero del cajón (pago a proveedor, gasto, retiro)',
        pasos: [
          'Toca **Sacar dinero**.',
          'Elige el motivo (pago a proveedor, gastos, retiro del dueño…), escribe el valor y una nota si quieres.',
          'Toca **Registrar**. Así el cierre te cuadra.',
        ],
      },
      {
        titulo: 'Cerrar la caja (al final del turno)',
        pasos: [
          'Toca **Cerrar caja**.',
          'Cuenta los billetes y monedas: escribe cuántos hay de cada uno, o toca **Total directo** y escribe el total.',
          'Mira lo que **debe haber**, lo que **contaste** y si **sobra o falta**.',
          'Toca **Cerrar caja**. Se guarda el cierre, se hace una copia de seguridad y puedes imprimir el comprobante.',
        ],
      },
    ],
    consejos: [
      'Registra siempre la plata que sacas del cajón: si no, al cerrar te va a "faltar".',
      'Los descuadres (sobrantes o faltantes) quedan en la auditoría.',
    ],
    elementos: [
      { id: 'caja.base', titulo: 'Base', texto: 'El dinero con el que se abrió la caja.', textos: ['Base'] },
      { id: 'caja.vendido', titulo: 'Vendido en el turno', texto: 'Lo que se ha vendido desde que se abrió esta caja.', textos: ['Vendido en el turno', 'Total vendido'] },
      { id: 'caja.efectivo', titulo: 'Efectivo en cajón', texto: 'Cuánta plata debería haber en el cajón ahora: base + ventas en efectivo + abonos − salidas.', textos: ['Efectivo en cajón', 'Debe haber en el cajón'] },
      { id: 'caja.sacar', titulo: 'Sacar dinero', texto: 'Registra la plata que sale del cajón: pagos a proveedores, gastos de la tienda o retiros del dueño.', textos: ['Sacar dinero', 'Sacar efectivo'] },
      { id: 'caja.meter', titulo: 'Meter dinero', texto: 'Registra plata que entra al cajón sin ser venta: por ejemplo, sencillo para dar vueltas o un aporte del dueño.', textos: ['Meter dinero', 'Meter efectivo'] },
      { id: 'caja.movimientos', titulo: 'Entradas y salidas de efectivo', texto: 'La lista de todo el dinero que se metió o se sacó del cajón en este turno.', textos: ['Entradas y salidas'] },
      { id: 'caja.pagos', titulo: 'Por forma de pago', texto: 'Cuánto se vendió en efectivo, Nequi, tarjeta, fiado… en este turno.', textos: ['Por forma de pago'] },
      { id: 'caja.cerrar', titulo: 'Cerrar caja', texto: 'Termina el turno: cuentas el dinero, el sistema te dice si sobra o falta, guarda el cierre y hace una copia de seguridad.', textos: ['Cerrar caja'] },
      { id: 'caja.contar', titulo: 'Contar billetes / Total directo', texto: 'Dos formas de contar: escribir cuántos billetes y monedas hay de cada valor, o escribir directamente el total.', textos: ['Contar billetes', 'Total directo', 'Efectivo contado'] },
      { id: 'caja.diferencia', titulo: 'Diferencia', texto: 'Lo contado menos lo que debería haber. Si es positivo sobra plata; si es negativo, falta.', textos: ['Diferencia', 'Sobran', 'Faltan'] },
      { id: 'caja.imprimir', titulo: 'Imprimir cierre', texto: 'Imprime el comprobante del cierre de caja.', textos: ['Imprimir cierre'] },
      { id: 'caja.historial', titulo: 'Historial de cierres', texto: 'Los cierres de caja anteriores, con su diferencia.', textos: ['Historial de cierres'] },
    ],
  },

  /* ───────────────────────── Ventas ───────────────────────── */
  {
    id: 'ventas',
    titulo: 'Ventas (historial)',
    icono: 'Receipt',
    rutas: ['/ventas'],
    resumen: 'Todas las ventas hechas. Desde aquí puedes buscar una venta, reimprimir su tiquete o anularla.',
    captura: 'ventas.webp',
    tareas: [
      {
        titulo: 'Reimprimir un tiquete',
        pasos: ['Busca la venta por número, cliente o producto.', 'Ábrela y toca **Reimprimir**.'],
      },
      {
        titulo: 'Anular una venta (coordinador o dueño)',
        pasos: [
          'Abre la venta y toca **Anular**.',
          'Escribe el motivo (es obligatorio) y confirma.',
          'Los productos vuelven solos al inventario y la anulación queda en la auditoría.',
        ],
      },
    ],
    elementos: [
      { id: 'ventas.buscar', titulo: 'Buscar', texto: 'Encuentra una venta por su número, el nombre del cliente o un producto.', textos: ['Número, cliente o producto', 'Buscar'] },
      { id: 'ventas.fechas', titulo: 'Desde / Hasta', texto: 'Elige el rango de fechas que quieres ver.', textos: ['Desde', 'Hasta'] },
      { id: 'ventas.estado', titulo: 'Todas / Completadas / Anuladas', texto: 'Filtra para ver solo las ventas buenas o solo las anuladas.', textos: ['Todas', 'Completadas', 'Anuladas'] },
      { id: 'ventas.excel', titulo: 'Excel', texto: 'Descarga las ventas del periodo en un archivo de Excel. "Excel detalle" trae producto por producto.', textos: ['Excel ventas', 'Excel detalle'] },
      { id: 'ventas.reimprimir', titulo: 'Reimprimir', texto: 'Vuelve a imprimir el tiquete de la venta.', textos: ['Reimprimir'] },
      { id: 'ventas.anular', titulo: 'Anular', texto: 'Cancela la venta: el inventario se devuelve y queda registrado en la auditoría con el motivo. Solo coordinador o dueño.', textos: ['Anular', 'Sí, anular'] },
    ],
  },

  /* ───────────────────────── Productos ───────────────────────── */
  {
    id: 'productos',
    titulo: 'Productos',
    icono: 'Package',
    rutas: ['/productos'],
    resumen: 'Tu catálogo: aquí creas productos, cambias precios, pones fotos y marcas los favoritos para vender más rápido.',
    captura: 'productos.webp',
    tareas: [
      {
        titulo: 'Crear un producto',
        pasos: [
          'Toca **Nuevo**.',
          'Pasa el producto por el lector para llenar el **código de barras** (o déjalo vacío).',
          'Escribe el **nombre**, elige la **categoría** y escribe el **precio de venta** y el **precio de costo**.',
          'Escribe la **cantidad** que tienes y el **stock mínimo** (cuándo avisarte que se está acabando).',
          'Toca **Crear producto**.',
        ],
      },
      {
        titulo: 'Cambiar un precio',
        pasos: ['Busca el producto y tócalo.', 'Cambia el **precio de venta** y toca **Guardar**. El cambio queda en la auditoría.'],
      },
      {
        titulo: 'Cargar muchos productos desde Excel',
        pasos: [
          'Toca **Importar** y luego **Descargar plantilla**.',
          'Llena la plantilla en Excel (nombre, precio, código, categoría…).',
          'Vuelve a **Importar** y elige el archivo. Si el código ya existe, ese producto se actualiza.',
        ],
      },
    ],
    consejos: [
      'Escribe bien el **costo**: así CajaFácil te dice cuánto ganas de verdad.',
      'Marca con ⭐ **Tecla rápida** los productos que más vendes: salen de primeros en la caja.',
    ],
    elementos: [
      { id: 'productos.buscar', titulo: 'Buscar producto', texto: 'Escribe el nombre o pasa el código por el lector para encontrar un producto.', textos: ['Buscar por nombre o código'] },
      { id: 'productos.filtro-categoria', titulo: 'Filtrar por categoría', texto: 'Muestra solo los productos de un grupo.', textos: ['Todas las categorías'] },
      { id: 'productos.estado', titulo: 'Activos / Inactivos', texto: 'Los inactivos son productos que ya no vendes: no salen en la caja pero no se borran del historial.', textos: ['Activos', 'Inactivos', 'Todos'] },
      { id: 'productos.nuevo', titulo: 'Nuevo producto', texto: 'Crea un producto nuevo en tu catálogo.', textos: ['Nuevo', 'Crear producto'] },
      { id: 'productos.importar', titulo: 'Importar', texto: 'Carga o actualiza muchos productos a la vez desde un archivo de Excel. Primero descarga la plantilla.', textos: ['Importar', 'Descargar plantilla'] },
      { id: 'productos.exportar', titulo: 'Exportar', texto: 'Descarga tu lista de productos en Excel.', textos: ['Exportar'] },
      { id: 'productos.codigo', titulo: 'Código de barras', texto: 'El número del código de barras del producto. Pásalo por el lector. Si lo dejas vacío, el sistema crea un código interno.', textos: ['Código de barras'] },
      { id: 'productos.nombre', titulo: 'Nombre', texto: 'Cómo se llama el producto. Escríbelo como lo buscarías: "Arroz Diana 500 g".', textos: ['Nombre'] },
      { id: 'productos.categoria', titulo: 'Categoría', texto: 'El grupo al que pertenece (bebidas, aseo, fruver…). Sirve para encontrarlo en la caja y para los reportes.', textos: ['Categoría'] },
      { id: 'productos.precio', titulo: 'Precio de venta', texto: 'Lo que paga el cliente por una unidad.', textos: ['Precio de venta', 'Precio de referencia', 'Precio'] },
      { id: 'productos.costo', titulo: 'Precio de costo', texto: 'Lo que te cuesta a ti el producto (lo que le pagas al proveedor). Sirve para calcular tu ganancia.', textos: ['Precio de costo'] },
      { id: 'productos.unidad', titulo: 'Se vende por', texto: 'Si se vende por unidad, por kilo, libra, litro… Para fruver o granel usa kilo o libra.', textos: ['Se vende por'] },
      { id: 'productos.stock', titulo: 'Cantidad / Stock', texto: 'Cuántas unidades tienes en la tienda. Baja sola con cada venta y sube con las entradas de mercancía.', textos: ['Cantidad inicial en tienda', 'Stock'] },
      { id: 'productos.minimo', titulo: 'Stock mínimo', texto: 'Cuando el producto llegue a esta cantidad o menos, el sistema te avisa que se está acabando.', textos: ['Stock mínimo'] },
      { id: 'productos.favorito', titulo: 'Tecla rápida en la caja (⭐)', texto: 'Hace que el producto aparezca en "Rápidos" en la pantalla de vender, para tocarlo sin buscarlo.', textos: ['Tecla rápida en la caja'] },
      { id: 'productos.foto', titulo: 'Subir foto', texto: 'Ponle una foto al producto para reconocerlo más fácil en la caja.', textos: ['Subir foto'] },
      { id: 'productos.activar', titulo: 'Activar / Desactivar', texto: 'Desactiva un producto que ya no vendes. No se borra: su historial queda guardado.', textos: ['Activar', 'Desactivar'] },
    ],
  },

  /* ───────────────────────── Categorías ───────────────────────── */
  {
    id: 'categorias',
    titulo: 'Categorías',
    icono: 'Tags',
    rutas: ['/categorias'],
    resumen: 'Los grupos de productos (bebidas, aseo, fruver…). Cada uno tiene un color y reglas: si se vende con precio libre y si lleva control de inventario.',
    captura: 'categorias.webp',
    tareas: [
      {
        titulo: 'Crear una categoría',
        pasos: [
          'Toca **Nueva categoría**.',
          'Escribe el nombre y elige un color.',
          'Activa **Precio libre al vender** si es fruver, carnes o granel.',
          'Desactiva **Controlar inventario** si no llevas cuenta de las existencias de esa categoría.',
          'Toca **Guardar**.',
        ],
      },
    ],
    elementos: [
      { id: 'categorias.nueva', titulo: 'Nueva categoría', texto: 'Crea un grupo nuevo de productos.', textos: ['Nueva categoría'] },
      { id: 'categorias.color', titulo: 'Color', texto: 'El color con el que se ve la categoría en la caja. Ayuda a encontrar los productos más rápido.', textos: ['Color'] },
      { id: 'categorias.precio-libre', titulo: 'Precio libre al vender', texto: 'Para fruver, carnes o granel: al vender, el cajero escribe el valor ("$2.000 de tomate") o el peso.', textos: ['Precio libre'] },
      { id: 'categorias.inventario', titulo: 'Controlar inventario', texto: 'Si está activo, cada venta descuenta existencias y el sistema avisa cuando se acaban. Apágalo para cosas que no cuentas (por ejemplo, minutos o recargas).', textos: ['Controlar inventario', 'Sin inventario'] },
      { id: 'categorias.activa', titulo: 'Categoría activa', texto: 'Si la desactivas, deja de aparecer en la caja.', textos: ['Categoría activa', 'Inactiva'] },
    ],
  },

  /* ───────────────────────── Inventario ───────────────────────── */
  {
    id: 'inventario',
    titulo: 'Inventario',
    icono: 'Boxes',
    rutas: ['/inventario'],
    quien: 'Dueño, coordinador y almacenista',
    resumen: 'Controla lo que tienes en la tienda: registra la mercancía que llega, corrige cantidades y te dice qué pedir.',
    captura: 'inventario.webp',
    tareas: [
      {
        titulo: 'Registrar mercancía que llegó (entrada)',
        pasos: [
          'Ve a la pestaña **Entrada**.',
          'Escribe el proveedor y el número de factura (opcional).',
          'Pasa cada producto por el lector y escribe la **cantidad** que llegó y su **costo**.',
          'Toca **Registrar entrada**. Las cantidades se suman solas.',
        ],
      },
      {
        titulo: 'Corregir una cantidad (conteo, vencidos, dañados)',
        pasos: [
          'En **Existencias**, busca el producto y toca **Ajustar**.',
          'Elige si es un **conteo** ("¿cuántos hay realmente?"), si vas a **sumar** o **restar**.',
          'Escribe la cantidad y el **motivo** (es obligatorio) y toca **Guardar ajuste**.',
        ],
      },
      {
        titulo: 'Saber qué pedir al proveedor',
        pasos: ['Ve a **Pedido sugerido**: te muestra lo que se va a acabar y cuánto pedir, según lo que vendes cada día.'],
      },
    ],
    elementos: [
      { id: 'inventario.existencias', titulo: 'Existencias', texto: 'Cuánto hay de cada producto y cuánto vale tu inventario.', textos: ['Existencias'] },
      { id: 'inventario.entrada', titulo: 'Entrada', texto: 'Registra la mercancía que te llega del proveedor. Suma las cantidades y actualiza el costo.', textos: ['Entrada', 'Registrar entrada'] },
      { id: 'inventario.movimientos', titulo: 'Movimientos', texto: 'El historial de todo lo que entró y salió: ventas, entradas, ajustes y anulaciones.', textos: ['Movimientos', 'Todos los movimientos'] },
      { id: 'inventario.pedido', titulo: 'Pedido sugerido', texto: 'Calcula, con lo que vendiste en las últimas 4 semanas, qué se va a acabar y cuánto pedir.', textos: ['Pedido sugerido'] },
      { id: 'inventario.ajustar', titulo: 'Ajustar', texto: 'Corrige la cantidad de un producto (conteo físico, vencidos, dañados, consumo de la tienda). Siempre pide un motivo y queda en la auditoría.', textos: ['Ajustar', 'Guardar ajuste'] },
      { id: 'inventario.agotarse', titulo: 'Solo por agotarse', texto: 'Muestra solo los productos que están en su stock mínimo o por debajo.', textos: ['Solo por agotarse'] },
      { id: 'inventario.valor', titulo: 'Inventario a costo / a precio de venta', texto: 'Cuánto vale lo que tienes en la tienda: a lo que te costó, y a lo que lo venderías.', textos: ['Inventario a costo', 'Inventario a precio de venta'] },
      { id: 'inventario.proveedor', titulo: 'Proveedor y factura', texto: 'Quién te trajo la mercancía y el número de la factura o remisión. Es opcional pero te ayuda a buscar después.', textos: ['Proveedor', 'No. factura'] },
      { id: 'inventario.costo', titulo: 'Costo c/u', texto: 'Lo que te costó cada unidad en esta compra. Mantiene al día el cálculo de tu ganancia.', textos: ['Costo c/u'] },
    ],
  },

  /* ───────────────────────── Fiado ───────────────────────── */
  {
    id: 'fiado',
    titulo: 'Fiado',
    icono: 'HandCoins',
    rutas: ['/fiado'],
    resumen: 'El cuaderno del fiado, pero ordenado: quién te debe, cuánto, desde cuándo, y los abonos que te hacen.',
    captura: 'fiado.webp',
    tareas: [
      {
        titulo: 'Recibir un abono',
        pasos: [
          'Busca al cliente y tócalo.',
          'Toca **Abonar**, escribe el valor y la forma de pago.',
          'Toca **Registrar abono**. El abono paga primero las deudas más viejas.',
        ],
      },
      {
        titulo: 'Cobrar por WhatsApp',
        pasos: ['Abre el cliente y toca **Cobrar por WhatsApp**: se abre WhatsApp con un mensaje amable que incluye cuánto debe.'],
      },
      {
        titulo: 'Pasar al sistema las deudas del cuaderno',
        pasos: ['Abre el cliente (o créalo con **Nuevo cliente**), toca **Deuda anterior**, escribe el valor y un detalle.'],
      },
    ],
    consejos: [
      'Ponle **celular** a cada cliente: así puedes cobrarle por WhatsApp con un toque.',
      'El **cupo** es lo máximo que se le puede fiar. Si un cliente no tiene cupo propio, se usa el de Configuración.',
    ],
    elementos: [
      { id: 'fiado.porcobrar', titulo: 'Por cobrar', texto: 'Todo lo que te deben los clientes en este momento.', textos: ['Por cobrar'] },
      { id: 'fiado.vencido', titulo: 'Vencido', texto: 'Deudas que ya pasaron la fecha en que debían pagarse.', textos: ['Vencido', 'Vencidos'] },
      { id: 'fiado.hoy', titulo: 'Fiado hoy / Abonos hoy', texto: 'Cuánto se fió hoy y cuánto te pagaron hoy.', textos: ['Fiado hoy', 'Abonos hoy'] },
      { id: 'fiado.buscar', titulo: 'Buscar cliente', texto: 'Encuentra un cliente por nombre, celular o cédula.', textos: ['Buscar por nombre, celular'] },
      { id: 'fiado.filtro', titulo: 'Con deuda / Vencidos / Todos', texto: 'Filtra la lista de clientes.', textos: ['Con deuda', 'Todos'] },
      { id: 'fiado.nuevo', titulo: 'Nuevo cliente', texto: 'Crea un cliente para fiarle. También se pueden crear al fiar desde la caja.', textos: ['Nuevo cliente'] },
      { id: 'fiado.abonar', titulo: 'Abonar', texto: 'Registra un pago del cliente. Paga primero las deudas más viejas. Si es en efectivo, suma al cuadre de la caja.', textos: ['Abonar', 'Registrar abono'] },
      { id: 'fiado.whatsapp', titulo: 'Cobrar por WhatsApp', texto: 'Abre WhatsApp con un mensaje amable para el cliente, con el saldo que debe.', textos: ['Cobrar por WhatsApp'] },
      { id: 'fiado.anterior', titulo: 'Deuda anterior', texto: 'Para pasar al sistema lo que el cliente ya debía en el cuaderno (antes de usar CajaFácil).', textos: ['Deuda anterior', 'Registrar deuda anterior'] },
      { id: 'fiado.cupo', titulo: 'Cupo de fiado', texto: 'Lo máximo que le puedes fiar a este cliente. Si está apagado, usa el tope general de Configuración.', textos: ['Cupo de fiado propio', 'Sin tope de fiado'] },
      { id: 'fiado.editar', titulo: 'Editar cliente', texto: 'Cambia el nombre, celular, cédula, dirección, notas o el cupo del cliente.', textos: ['Editar'] },
      { id: 'fiado.historial', titulo: 'Historial de fiados', texto: 'Cada fiado del cliente con su fecha, valor, lo abonado y lo que falta.', textos: ['Historial de fiados'] },
    ],
  },

  /* ───────────────────────── Reportes ───────────────────────── */
  {
    id: 'reportes',
    titulo: 'Reportes',
    icono: 'BarChart3',
    rutas: ['/reportes'],
    quien: 'Dueño y coordinador',
    resumen: 'Cuánto vendes, cuánto ganas y qué se mueve más, por día, categoría, producto y cajero.',
    captura: 'reportes.webp',
    tareas: [
      {
        titulo: 'Ver cómo te fue en el mes',
        pasos: ['Elige el periodo arriba (por ejemplo **Este mes**).', 'Revisa el total vendido, la utilidad y los productos más vendidos.', 'Descarga en Excel si lo necesitas para tu contador.'],
      },
    ],
    elementos: [
      { id: 'reportes.periodo', titulo: 'Periodo', texto: 'Elige las fechas del reporte: hoy, los últimos 7 o 30 días, este mes, o un rango que tú escojas.', textos: ['Hoy', '7 días', '30 días', 'Este mes', 'Desde', 'Hasta'] },
      { id: 'reportes.total', titulo: 'Total vendido', texto: 'Todo lo vendido en el periodo, sin contar anuladas.', textos: ['Total vendido'] },
      { id: 'reportes.utilidad', titulo: 'Utilidad estimada', texto: 'La ganancia aproximada: ventas menos el costo de lo vendido.', textos: ['Utilidad estimada', 'Utilidad'] },
      { id: 'reportes.ticket', titulo: 'Ticket promedio', texto: 'Cuánto gasta en promedio cada cliente por compra.', textos: ['Ticket promedio'] },
      { id: 'reportes.dia', titulo: 'Ventas por día', texto: 'Cómo se movieron las ventas día a día.', textos: ['Ventas por día'] },
      { id: 'reportes.categoria', titulo: 'Por categoría', texto: 'Cuánto vendió y cuánto dejó cada grupo de productos.', textos: ['Por categoría'] },
      { id: 'reportes.productos', titulo: 'Productos más vendidos', texto: 'Los productos que más salieron en el periodo.', textos: ['Productos más vendidos'] },
      { id: 'reportes.cajero', titulo: 'Ventas por cajero', texto: 'Cuánto vendió cada persona.', textos: ['Ventas por cajero'] },
      { id: 'reportes.ia', titulo: 'Asistente IA', texto: 'Hazle preguntas a tu tienda en palabras sencillas ("¿qué fue lo que más vendí este mes?"). Viene con el plan Nube.', textos: ['Asistente IA', 'Pregúntale a tu tienda', 'Enviar'] },
      { id: 'reportes.excel', titulo: 'Excel', texto: 'Descarga el reporte en Excel.', textos: ['Excel'] },
    ],
  },

  /* ───────────────────────── Auditoría ───────────────────────── */
  {
    id: 'auditoria',
    titulo: 'Auditoría',
    icono: 'ShieldCheck',
    rutas: ['/auditoria'],
    quien: 'Dueño y coordinador',
    resumen: 'El registro de seguridad: todo lo delicado queda aquí y no se puede borrar (anulaciones, cambios de precio, descuentos, descuadres, cajón abierto, intentos de entrar con clave equivocada).',
    captura: 'auditoria.webp',
    elementos: [
      { id: 'auditoria.alertas', titulo: 'Solo alertas', texto: 'Muestra solo lo más importante: descuadres, anulaciones, descuentos grandes y accesos fallidos.', textos: ['Solo alertas', 'Alertas'] },
      { id: 'auditoria.accion', titulo: 'Tipo de acción', texto: 'Filtra por lo que pasó: anulación, cambio de precio, descuento, cajón abierto…', textos: ['Todas las acciones'] },
      { id: 'auditoria.buscar', titulo: 'Buscar', texto: 'Busca por usuario, producto o detalle.', textos: ['Buscar'] },
      { id: 'auditoria.antes', titulo: 'Antes / Después', texto: 'Cómo estaba el dato antes del cambio y cómo quedó (por ejemplo, el precio viejo y el nuevo).', textos: ['Antes', 'Después'] },
    ],
  },

  /* ───────────────────────── Usuarios ───────────────────────── */
  {
    id: 'usuarios',
    titulo: 'Usuarios',
    icono: 'Users',
    rutas: ['/usuarios'],
    quien: 'Solo el dueño (administrador)',
    resumen: 'Quién puede entrar a CajaFácil y qué puede hacer cada uno.',
    captura: 'usuarios.webp',
    tareas: [
      {
        titulo: 'Crear un usuario para un cajero',
        pasos: [
          'Toca **Nuevo usuario**.',
          'Escribe su nombre, el **usuario** con el que va a entrar y una **contraseña**.',
          'Elige el **rol** (normalmente **Cajero**) y toca **Guardar**.',
        ],
      },
      {
        titulo: 'Un empleado ya no trabaja en la tienda',
        pasos: ['Abre su usuario y apaga **Usuario activo**. No se borra, para que su historial quede guardado.'],
      },
    ],
    elementos: [
      { id: 'usuarios.nuevo', titulo: 'Nuevo usuario', texto: 'Crea un acceso para una persona nueva.', textos: ['Nuevo usuario'] },
      { id: 'usuarios.rol', titulo: 'Rol', texto: 'Qué puede hacer: Administrador (todo), Coordinador (vende, anula, inventario, reportes), Cajero (vende y cierra su caja), Almacenista (productos e inventario).', textos: ['Rol', 'Administrador', 'Coordinador', 'Cajero', 'Almacenista'] },
      { id: 'usuarios.usuario', titulo: 'Usuario (para entrar)', texto: 'El nombre corto con el que la persona entra a CajaFácil, por ejemplo "maria".', textos: ['Usuario (para entrar)'] },
      { id: 'usuarios.clave', titulo: 'Contraseña', texto: 'La clave de la persona. Al editar, déjala vacía para no cambiarla.', textos: ['Contraseña', 'Nueva contraseña'] },
      { id: 'usuarios.activo', titulo: 'Usuario activo', texto: 'Apágalo cuando la persona ya no trabaje en la tienda: no podrá entrar, pero su historial se conserva.', textos: ['Usuario activo', 'Inactivo'] },
    ],
  },

  /* ───────────────────────── Configuración ───────────────────────── */
  {
    id: 'configuracion',
    titulo: 'Configuración',
    icono: 'Settings',
    rutas: ['/configuracion'],
    quien: 'Solo el dueño (administrador)',
    resumen: 'Los datos del negocio, la impresora, la báscula, las formas de pago, las copias de seguridad y la licencia.',
    captura: 'configuracion.webp',
    tareas: [
      {
        titulo: 'Configurar la impresora de tiquetes',
        pasos: [
          'Ve a la pestaña **Impresora y cajón**.',
          'Elige **Impresora térmica instalada en Windows** y escoge tu impresora en la lista.',
          'Elige el ancho del papel (casi siempre **80 mm**).',
          'Toca **Imprimir prueba** y luego **Probar cajón**. Si todo sale bien, toca **Guardar cambios**.',
        ],
      },
      {
        titulo: 'Activar la licencia',
        pasos: [
          'Ve a **Licencia y nube** y toca el **código de este equipo** para copiarlo.',
          'Envíalo a NautilusTech por WhatsApp.',
          'Pega el texto de la licencia que te enviamos y toca **Activar licencia**.',
        ],
      },
      {
        titulo: 'Guardar las copias de seguridad también en una USB',
        pasos: ['Ve a **Respaldos**, escribe la carpeta de tu memoria (ej: E:\\RespaldosCajaFacil) en **Copia adicional** y guarda.'],
      },
    ],
    elementos: [
      { id: 'config.negocio', titulo: 'Negocio', texto: 'Nombre, NIT, dirección, teléfono y el mensaje que sale en el tiquete.', textos: ['Negocio'] },
      { id: 'config.ventas', titulo: 'Ventas y fiado', texto: 'Reglas de venta: si se puede vender sin existencias y el tope de fiado por cliente.', textos: ['Ventas y fiado'] },
      { id: 'config.sin-stock', titulo: 'Vender sin existencias', texto: 'Si está activo, la caja deja vender aunque el sistema diga que no hay unidades. Útil mientras organizas el inventario.', textos: ['Permitir vender aunque'] },
      { id: 'config.vence', titulo: 'Días para que un fiado se venza', texto: 'Cuántos días tiene un cliente para pagar un fiado antes de que aparezca como vencido. 0 = nunca vence.', textos: ['Días para que un fiado'] },
      { id: 'config.tope', titulo: 'Cupo de fiado por defecto', texto: 'Lo máximo que se le puede fiar a un cliente que no tiene cupo propio. 0 = sin tope.', textos: ['Cupo de fiado por defecto'] },
      { id: 'config.impresora', titulo: 'Impresora y cajón', texto: 'Qué impresora usa la caja para los tiquetes y si abre el cajón del dinero.', textos: ['Impresora y cajón', 'Impresora'] },
      { id: 'config.prueba', titulo: 'Imprimir prueba / Probar cajón', texto: 'Comprueba que la impresora imprime y que el cajón abre, antes de empezar a vender.', textos: ['Imprimir prueba', 'Probar cajón'] },
      { id: 'config.papel', titulo: 'Ancho del papel', texto: 'El tamaño del rollo de la impresora: 80 mm (el más común) o 58 mm (impresoras pequeñas).', textos: ['Ancho del papel'] },
      { id: 'config.bascula', titulo: 'Báscula', texto: 'Conecta una báscula para leer el peso automáticamente al vender fruver o granel.', textos: ['Báscula', 'Leer peso de prueba'] },
      { id: 'config.pagos', titulo: 'Formas de pago', texto: 'Las formas en que te pueden pagar (efectivo, Nequi, Daviplata, tarjeta…). Puedes crear, renombrar o desactivar.', textos: ['Formas de pago', 'Nueva forma de pago'] },
      { id: 'config.respaldos', titulo: 'Respaldos', texto: 'Las copias de seguridad de toda la información. Se hacen solas cada día y en cada cierre de caja.', textos: ['Respaldos', 'Respaldar ahora'] },
      { id: 'config.usb', titulo: 'Copia adicional (USB)', texto: 'Una carpeta en una memoria USB o disco externo donde también se guardan las copias. Si no está conectada, no pasa nada.', textos: ['Copia adicional'] },
      { id: 'config.licencia', titulo: 'Licencia y nube', texto: 'El estado de tu licencia, el código de este equipo y el plan Nube (copia fuera de la tienda y ver ventas desde el celular).', textos: ['Licencia y nube', 'Licencia', 'Activar licencia'] },
      { id: 'config.codigo', titulo: 'Código de este equipo', texto: 'El código único de este computador. Envíalo a NautilusTech para que te generen la licencia.', textos: ['Código de este equipo', 'Código del equipo'] },
      { id: 'config.equipo', titulo: 'Este equipo', texto: 'El nombre de este computador o tablet (CAJA-1, CAJA-2…) y si imprime en su propia impresora.', textos: ['Este equipo'] },
      { id: 'config.guardar', titulo: 'Guardar cambios', texto: 'Guarda lo que cambiaste en esta pestaña.', textos: ['Guardar cambios'] },
    ],
  },

  /* ───────────────────────── Facturación electrónica ───────────────────────── */
  {
    id: 'facturacion',
    titulo: 'Facturación electrónica',
    icono: 'FileCheck2',
    rutas: [],
    quien: 'Solo si tu licencia incluye el módulo (en modo prueba se puede probar)',
    resumen: 'Si tu negocio está obligado a facturar, cada venta sale como **documento equivalente electrónico POS** validado por la DIAN, con su código CUDE y un QR en el tiquete. Si no lo necesitas, déjalo apagado y CajaFácil funciona igual que siempre.',
    tareas: [
      {
        titulo: 'Activarla (lo hace el dueño o NautilusTech)',
        pasos: [
          'Revisa que en **Configuración → Negocio** esté bien el **NIT** del negocio.',
          'Ve a **Configuración → Facturación electrónica**.',
          'Elige el **proveedor tecnológico** y escribe sus datos de acceso.',
          'Escribe los datos de la **resolución de la DIAN**: número, prefijo, rango de números y fechas.',
          'Empieza en **ambiente de Pruebas**; cuando la DIAN te habilite, cámbialo a **Producción**.',
          'Prende **Facturación electrónica activa** y toca **Guardar cambios**.',
        ],
      },
      {
        titulo: 'Cuando el cliente pide factura con sus datos',
        pasos: [
          'Al cobrar, toca **Cliente pide factura**.',
          'Escribe el tipo y número de documento (cédula o NIT), el nombre y el correo.',
          'Confirma la venta normal. Si no tocas nada, el documento sale a **Consumidor final**.',
        ],
      },
      {
        titulo: 'Si se va el internet',
        pasos: [
          'Sigue vendiendo normal: la venta se guarda y el documento queda **pendiente**.',
          'Cuando vuelva el internet, CajaFácil lo envía solo a la DIAN.',
          'En **Configuración → Facturación electrónica → Documentos emitidos** ves los pendientes y los puedes reenviar.',
        ],
      },
    ],
    consejos: [
      'Pide una nueva resolución a la DIAN antes de que se acaben los números o venza la fecha: CajaFácil te avisa con tiempo.',
      'Anular una venta con documento electrónico genera sola la **nota de ajuste** para la DIAN.',
      'En cada producto puedes indicar el **IVA incluido en el precio** (0%, 5% o 19%).',
    ],
    elementos: [
      { id: 'cobrar.factura', titulo: 'Cliente pide factura', texto: 'Para cuando el cliente quiere el documento a su nombre (con cédula o NIT). Si no, sale a Consumidor final.', textos: ['Cliente pide factura', 'Datos para la factura'] },
      { id: 'fe.activa', titulo: 'Facturación electrónica activa', texto: 'Apagada, la caja funciona como siempre. Encendida, cada venta genera su documento ante la DIAN.', textos: ['Facturación electrónica activa'] },
      { id: 'fe.proveedor', titulo: 'Proveedor tecnológico', texto: 'La empresa autorizada que envía los documentos a la DIAN por CajaFácil. "Simulado" sirve solo para probar.', textos: ['Proveedor tecnológico'] },
      { id: 'fe.ambiente', titulo: 'Ambiente', texto: 'Pruebas: para la habilitación ante la DIAN, sin validez fiscal. Producción: documentos reales.', textos: ['Ambiente'] },
      { id: 'fe.resolucion', titulo: 'Resolución de numeración', texto: 'El número, prefijo, rango y fechas que la DIAN autorizó para tus documentos POS.', textos: ['Número de resolución', 'Prefijo', 'Desde el número', 'Hasta el número', 'Vigente desde', 'Vigente hasta'] },
      { id: 'fe.probar', titulo: 'Probar conexión', texto: 'Verifica que CajaFácil se puede comunicar con el proveedor tecnológico.', textos: ['Probar conexión'] },
      { id: 'fe.documentos', titulo: 'Documentos emitidos', texto: 'La lista de documentos electrónicos: aceptados, pendientes (sin internet) y rechazados. Desde aquí se reenvían.', textos: ['Documentos emitidos', 'Enviar pendientes'] },
      { id: 'productos.iva', titulo: 'IVA incluido en el precio', texto: 'Qué IVA trae el precio de venta del producto. Solo se usa para la facturación electrónica.', textos: ['IVA incluido en el precio'] },
    ],
  },

  /* ───────────────────────── Respaldos (solo manual) ───────────────────────── */
  {
    id: 'respaldos',
    titulo: 'Copias de seguridad',
    icono: 'DatabaseBackup',
    rutas: [],
    resumen: 'CajaFácil guarda una copia de toda tu información todos los días y en cada cierre de caja, para que nunca pierdas tus datos.',
    tareas: [
      {
        titulo: 'Qué hace solo',
        pasos: [
          'Una copia **todos los días**, automáticamente.',
          'Una copia **en cada cierre de caja**.',
          'Si configuras una **memoria USB**, la copia también va ahí cuando esté conectada.',
          'Con el **plan Nube**, además se guarda una copia fuera de la tienda (por si se daña o se roban el computador).',
        ],
      },
    ],
    consejos: ['Deja la memoria USB conectada al computador de la caja, o conéctala al menos una vez por semana.'],
    elementos: [],
  },
]

export const PROBLEMAS = [
  { p: 'Sale "No hay conexión con CajaFacil"', s: 'Reinicia el computador. Si sigue, llama a soporte.' },
  { p: 'No imprime el tiquete', s: 'Revisa que la impresora esté encendida, con papel y conectada. Luego ve a Configuración → Impresora y cajón → Imprimir prueba.' },
  { p: 'No abre el cajón', s: 'El cajón debe estar conectado a la impresora con su cable. Prueba en Configuración → Impresora y cajón → Probar cajón.' },
  { p: 'No deja vender: "abre la caja"', s: 'Ve a Vender, escribe la base y toca Abrir caja.' },
  { p: 'El lector no agrega el producto', s: 'Haz clic en el buscador de arriba y vuelve a pasar el producto. Si dice "no encontrado", el producto no está creado o tiene otro código.' },
  { p: 'Al cerrar la caja me falta plata', s: 'Revisa si sacaste dinero para pagar algo y no lo registraste en Caja → Sacar dinero. También revisa ventas pagadas por Nequi registradas como efectivo.' },
  { p: 'Sale "La fecha del computador está atrasada"', s: 'Corrige la fecha y la hora de Windows (abajo a la derecha de la pantalla).' },
  { p: 'Sale "Modo solo lectura"', s: 'La prueba o la licencia se venció. Comunícate con NautilusTech.' },
  { p: 'Olvidé mi contraseña', s: 'Pídele al dueño que te ponga una nueva en Usuarios. Si es el dueño quien la olvidó, llama a soporte.' },
]

/* ── Búsqueda de la sección y del elemento ───────────────────────────── */

export const normalizar = (t) => String(t || '')
  .toLowerCase()
  .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .replace(/[⭐★☆🌙☀️💬]/gu, '')
  .replace(/\s+/g, ' ')
  .trim()

export const seccionPorId = (id) => SECCIONES.find((s) => s.id === id)

export function seccionesDeRuta(pathname) {
  const exactas = SECCIONES.filter((s) => s.rutas.includes(pathname))
  if (exactas.length) return exactas
  return SECCIONES.filter((s) => s.rutas.some((r) => r !== '/' && pathname.startsWith(r)))
}

const INDICE = new Map()
SECCIONES.forEach((s) => s.elementos.forEach((e) => INDICE.set(e.id, { ...e, seccion: s.id })))
export const elementoPorId = (id) => INDICE.get(id)

/** Busca, entre las secciones dadas (y luego en todas), el elemento cuyo texto coincide. */
export function elementoPorTexto(texto, preferidas = [], soloExacto = false) {
  const t = normalizar(texto)
  if (!t) return null
  const orden = [...preferidas, ...SECCIONES.filter((s) => !preferidas.includes(s))]
  let mejor = null
  for (const s of orden) {
    for (const e of s.elementos) {
      for (const patron of e.textos || []) {
        const p = normalizar(patron)
        if (!p) continue
        const exacto = t === p
        // Palabras cortas ("Base", "Nuevo") solo si coinciden exacto, para no confundir nombres de productos
        if (exacto || (!soloExacto && p.length >= 6 && t.startsWith(p))) {
          const puntaje = (exacto ? 1000 : 0) + p.length + (preferidas.includes(s) ? 500 : 0)
          if (!mejor || puntaje > mejor.puntaje) mejor = { puntaje, el: { ...e, seccion: s.id } }
        }
      }
    }
    if (mejor && mejor.puntaje >= 1500) break
  }
  return mejor?.el || null
}
