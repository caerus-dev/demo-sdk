# Guion de la Demo — Presentación Final (20 Minutos)

Guion optimizado para la defensa final ante el Tribunal / Jury. El foco está puesto en la **solución de concurrencia distribuida provista por Caerus**, la utilización del SDK oficial (`@caerus-dev/sdk`), y la reactividad basada en **Webhooks**.

---

## ⏱️ Estructura de Tiempos (Total: 20 min)

1. **Min 0 a 3:** Presentación del equipo, problema de negocio, alcance funcional y modelo de arquitectura.
2. **Min 3 a 7:** La aplicación de cine y colisión concurrente (`UNITARY` con política `FAIL`).
3. **Min 7 a 11:** Cola distribuida y promoción automática (`UNITARY` con política `QUEUE`).
4. **Min 11 a 14:** Expiración por TTL del cluster y arquitectura reactiva por Webhooks.
5. **Min 14 a 17:** Candy Bar con inventario compartido (`POOLED` atómico) y confirmación terminal.
6. **Min 17 a 20:** Panel de telemetría / dashboard de Caerus y lecciones aprendidas.

---

## 🎬 Paso a Paso: Qué Hacer y Qué Decir

### 0. Preparación previa (antes de ingresar al aula)
- Servidor corriendo: `npm run dev` en `localhost:3000`.
- Dos navegadores abiertos lado a lado:
  - **Ventana Izquierda:** "Usuario 1" (Navegador normal).
  - **Ventana Derecha:** "Usuario 2" (Navegador en modo incógnito).
- Ambos con la consola o el panel colapsable de **"Llamadas al SDK"** y **"Caerus Live Webhooks"** visibles.

---

### 1. Introducción y Alcance (Minutos 0 a 3)
- **Decir:**
  > "Buenas tardes. Nuestro proyecto es **Caerus**, una plataforma de concurrencia y coordinación distribuida diseñada para desacoplar la lógica de locks, cuotas y colas de espera de la base de datos de las aplicaciones.
  > A efectos del proyecto, para validar el producto en un escenario de alta demanda, construimos esta aplicación de venta de entradas de cine sobre Next.js consumiendo el paquete `@caerus-dev/sdk`.
  > La sala cuenta con 30 butacas y productos de candy bar. Toda la concurrencia, vencimiento de reservas y resolución de conflictos es delegada enteramente al motor Caerus."

---

### 2. Conflicto Concurrente: Rechazo Inmediato (`FAIL`) (Minutos 3 a 7)
- **Qué hacer:**
  1. En ambas ventanas, ingresar a la película **"El Último Horizonte"**.
  2. En la ventana izquierda, hacer clic en la butaca **C3**. Se reserva inmediatamente (color azul/verde, inicia cuenta regresiva).
  3. En la ventana derecha, intentar hacer clic en la misma butaca **C3** antes de que refresque.
- **Qué se ve:**
  - El Usuario 2 recibe un cartel de conflicto: `409 Out of stock for resource`.
  - En el panel de llamadas se observa la invocación fallida de `caerus.unitary('funcionhorizonte_C3').take(...)`.
- **Qué decir:**
  > "La aplicación jamás ejecutó un `SELECT ... FOR UPDATE` ni consultó previamente si la butaca estaba libre. Simplemente invocó `take()` a través del SDK.
  > La plantilla `butaca` está configurada con resolución `FAIL`. Fue el motor Caerus quien evaluó la colisión en memoria y rechazó atómicamente al segundo usuario con un `ConflictError`."

---

### 3. Cola de Espera y Promoción Automática (`QUEUE`) (Minutos 7 a 11)
- **Qué hacer:**
  1. En ambas ventanas, ir a la película **"Lluvia de Neón"**.
  2. Usuario 1 hace clic en la butaca **B4**. Queda reservada.
  3. Usuario 2 hace clic en la misma butaca **B4**.
  4. La butaca para el Usuario 2 queda en estado punteado / **"En cola de espera (posición 1)"**.
  5. Usuario 1 decide cancelar la reserva tocando **"Quitar"**.
- **Qué se ve:**
  - En milisegundos, la pantalla del Usuario 2 se actualiza automáticamente: la butaca pasa a estar asignada a él, iniciando su propio temporizador.
  - En el panel flotante de Webhooks se observa el evento `resource.released` seguido de `resource.taken` (promoción automática).
- **Qué decir:**
  > "Miren esto: ambas pantallas corren exactamente las mismas líneas de código. La única diferencia es que la función 'Lluvia de Neón' utiliza la plantilla `butaca_fila`, configurada con política `QUEUE`.
  > Al soltar la butaca el primer comprador, nadie en la aplicación escribió lógica de reasignación: el cluster de Caerus desencoló al siguiente usuario, le otorgó la reserva y emitió un webhook que notificó a nuestra aplicación vía Server-Sent Events."

---

### 4. Vencimiento por TTL y Notificación por Webhook (Minutos 11 a 14)
- **Qué hacer:**
  1. Seleccionar una butaca libre y dejar correr el temporizador (30 segundos).
  2. No tocar nada y observar ambas pantallas cuando el temporizador llega a cero.
- **Qué se ve:**
  - Al expirar los 30s, Caerus emite el evento de webhook `resource.expired`.
  - El backend recibe el webhook firmado con HMAC, lo propaga por SSE y ambas pantallas liberan la butaca en simultáneo.
- **Qué decir:**
  > "No hay cron jobs, ni polling, ni tareas batch de base de datos barriendo registros expirados.
  > Caerus maneja el ciclo de vida del recurso con timers de alta precisión. Cuando el TTL expira, el motor invalida el holder y notifica a nuestro webhook firmado criptográficamente, permitiendo que la interfaz reaccione al instante."

---

### 5. Candy Bar: Stock Compartido Atómico (`POOLED`) (Minutos 14 a 17)
- **Qué hacer:**
  1. Con una butaca reservada, avanzar a la pantalla de **Checkout**.
  2. Mostrar los combos de pochoclos y gaseosas. Resaltar la etiqueta **`POOLED`**.
  3. Intentar pedir más unidades de las disponibles (o pedir unidades concurrentemente desde ambas ventanas).
  4. Avanzar y hacer clic en **"Confirmar y Pagar"**.
- **Qué se ve:**
  - El candy bar utiliza `caerus.pooled(productoKey).takeMany(cantidad)`.
  - Si no alcanza el stock total, la operación falla por completo (atomicidad todo-o-nada).
  - Al completar el pago, las reservas pasan al estado terminal `CONFIRMED`. Si se intentara liberarlas después, el motor no lo permite.
- **Qué decir:**
  > "En el Candy Bar los recursos ya no son individuales sino conjuntos de unidades intercambiables (`POOLED`). Mediante `takeMany()` reservamos atómicamente múltiples unidades.
  > Al finalizar el proceso de compra, se invoca `confirm()` sobre todos los holders. En Caerus, `CONFIRMED` es un estado terminal que distingue una reserva temporal de una transacción completada."

---

### 6. Cierre y Lecciones Aprendidas (Minutos 17 a 20)
- **Qué decir:**
  > "En conclusión, logramos resolver un problema transversal complejo —concurrencia, colas y reservas distribuidas— abstrayéndolo en un servicio de infraestructura con una API limpia y expresiva.
  > Como lección aprendida clave, vimos la importancia de sincronizar los estados mediante Webhooks en vez de polling, y la necesidad de diseñar el SDK con tipos estrictos para diferenciar operaciones unitarias de pooled en tiempo de compilación.
  > Quedamos a disposición del Tribunal para cualquier consulta técnica o arquitectural."
