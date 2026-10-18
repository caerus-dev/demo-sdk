# Caerus Cine — Demo de Concurrencia (Edición Jury / Presentación Final)

Demo interactiva de una cadena de cine que utiliza **Caerus** para orquestar la concurrencia, reservas temporales y resolución de conflictos en tiempo real mediante el SDK oficial (`@caerus-dev/sdk`).

La sala y el catálogo son completamente configurables mediante `config/sala.json`, y la sincronización entre múltiples clientes se realiza en tiempo real a través de **Webhooks** de Caerus y **Server-Sent Events (SSE)** hacia el frontend, sin necesidad de polling continuo.

---

## 🎯 Políticas de Conflicto en Cartelera

La cartelera presenta dos películas que demuestran las dos estrategias de resolución de conflictos provistas por el motor Caerus para recursos de tipo **Unitario**:

| | *El Último Horizonte* | *Lluvia de Neón* |
|---|---|---|
| **Plantilla SRE** | `butaca` (`FAIL`) | `butaca_fila` (`QUEUE`) |
| **Comportamiento ante colisión** | El segundo usuario recibe `409 Conflict` inmediato. | El segundo usuario entra en **cola de espera** (`QUEUED`). |
| **Al liberarse la butaca** | Queda libre para quien la tome primero. | El motor **promueve automáticamente** al usuario en cola (`resource.taken`). |
| **Notificación en vivo** | Webhook → SSE a todos los navegadores. | Webhook → SSE asigna la butaca en la pantalla del usuario en cola. |

> **Nota de Arquitectura:** Ambos flujos ejecutan exactamente el mismo código fuente (`caerus.unitary(key).take(...)`). La diferencia de comportamiento reside 100% en la configuración declarativa de la plantilla en el motor Caerus.

---

## 📋 Recursos y Plantillas Necesarias en Caerus

Para replicar el entorno de la demo desde cero en el **Dashboard de Caerus**, es necesario tener creada una **Aplicación** y las siguientes **3 Plantillas de Recursos Compartidos**:

### 1. Plantillas de Recursos (Shared Resource Templates)

| Nombre de Plantilla | Tipo de Recurso | TTL por Defecto | Resolución de Conflicto | Guardar Metadata | Exigir Idempotencia |
|---|---|---|---|---|---|
| **`butaca`** | `UNITARY` | `30s` (o `120s`) | **`FAIL`** | Sí (`true`) | No (`false`) |
| **`butaca_fila`** | `UNITARY` | `30s` (o `120s`) | **`QUEUE`** | Sí (`true`) | No (`false`) |
| **`producto`** | `POOLED` | `30s` (o `120s`) | **`FAIL`** | Sí (`true`) | No (`false`) |

#### Justificación técnica de la configuración:
- **`UNITARY` para butacas:** El motor garantiza matemáticamente que existe una sola instancia disponible por butaca. Impide asignaciones dobles sin necesidad de bloqueos pesados en bases de datos relacionales.
- **`POOLED` para Candy Bar:** Permite gestionar inventarios compartidos de unidades intercambiables (ej. 15 combos de pochoclos). Soporta `takeMany(n)` atómico (todo-o-nada).
- **TTL Dinámico:** La aplicación puede solicitar un TTL explícito en el `take` (por defecto `CAERUS_TTL_SECONDS=30` para agilizar la demo). Si no se especifica, toma el de la plantilla.
- **Idempotencia:** La demo genera `idempotencyKey` únicos por intento (`UUID`), protegiendo al usuario contra reintentos por fallas de red sin bloquear operaciones subsiguientes.

---

### 2. Configuración de Webhook en Caerus

La demo incluye un endpoint receptor de webhooks que emite eventos en tiempo real a las pantallas conectadas:

- **URL del Webhook:** `https://<tu-dominio-o-ngrok>/api/webhooks/caerus`
- **Eventos a suscribir:**
  - `resource.taken` (butaca o producto reservado / promovido de cola)
  - `resource.queued` (usuario entra a cola de espera)
  - `resource.released` (butaca liberada voluntariamente)
  - `resource.expired` (butaca expirada por TTL del motor)
  - `resource.confirmed` (compra finalizada con éxito)
- **Secret:** Copiar el secreto generado por el dashboard (ej. `whsec_...`) y colocarlo en `CAERUS_WEBHOOK_SECRET`.

---

## ⚙️ Variables de Entorno (`.env.local`)

Crear un archivo `.env.local` en la raíz del proyecto:

```bash
# Credenciales del Data Plane de Caerus
CAERUS_API_KEY=caer_app_tu_api_key_aqui
CAERUS_ENDPOINT=api.caerus.dev:443
CAERUS_TLS=true

# Secreto para verificar la firma HMAC de los Webhooks
CAERUS_WEBHOOK_SECRET=whsec_tu_webhook_secret_aqui

# TTL de las reservas en segundos (30s recomendado para la demo de 20 min)
CAERUS_TTL_SECONDS=30

# Nombres de las plantillas en Caerus
CAERUS_TEMPLATE_BUTACA=butaca
CAERUS_TEMPLATE_BUTACA_FILA=butaca_fila
CAERUS_TEMPLATE_PRODUCTO=producto

# Habilitar persistencia de metadata en holders
CAERUS_METADATA=on

# Puerto local (opcional)
PORT=3000
```

> **Modo Fallback Offline:** Si `CAERUS_API_KEY` se omite, la app arranca automáticamente con un **Motor en Memoria** que simula localmente las mismas garantías de Caerus (conflictos, colas y TTL).

---

## 🚀 Ejecución

### 1. Instalación y arranque

```bash
# Instalar dependencias
npm install
# o con pnpm
pnpm install

# Iniciar servidor de desarrollo
npm run dev
# o en un puerto específico
PORT=3000 npm run dev
```

### 2. Simulación de Concurrencia (Dos ventanas lado a lado)

Para la presentación o pruebas de colisión:
1. Abrir **dos navegadores diferentes** (ej. Chrome normal e Incógnito, o Chrome y Firefox) apuntando a `http://localhost:3000`.
2. Cada ventana mantendrá una sesión y usuario independiente (`sessionStorage`).
3. En la ventana izquierda ("Usuario 1") y la derecha ("Usuario 2"), ingresar a la misma función.
4. Al hacer clic simultáneo o secuencial sobre la misma butaca:
   - En *El Último Horizonte*: Uno obtiene la reserva y el otro recibe el aviso de colisión `409 Out of stock`.
   - En *Lluvia de Neón*: Uno obtiene la reserva y el otro queda en `En cola de espera`. Al soltar el primero, el segundo pasa a tener la butaca inmediatamente vía Webhook/SSE.

---

## 🍿 Candy Bar (Stock Atómico `POOLED`)

En la pantalla de Checkout (`/funcion/[id]/checkout`), el Candy Bar permite adquirir combos y bebidas:
- El stock inicial se define en `config/sala.json`.
- Cada reserva ejecuta `caerus.pooled(productoKey).takeMany(cantidad, { idempotencyKey })`.
- **Garantía todo-o-nada:** Si se solicitan 10 unidades y solo quedan 8, Caerus rechaza la reserva completa sin consumir parcialmente el inventario.
- Los productos reservados muestran una insignia **`POOLED`** y el badge con las unidades actualmente comprometidas por otros usuarios en tiempo real.

---

## 📡 Monitor de Webhooks en Vivo (`WebhookFeed`)

Tanto en la grilla de la sala como en el checkout, se encuentra disponible un panel flotante colapsable (**"Caerus Live Webhooks"**):
- Muestra el flujo en tiempo real de notificaciones `POST /api/webhooks/caerus`.
- Permite desplegar el payload JSON firmado que Caerus envía ante cada evento (`resource.taken`, `resource.expired`, etc.).
- Facilita a los evaluadores verificar que la expiración y reasignación son eventos asíncronos genuinos disparados por el cluster de Caerus.

---

## 🛠️ Estructura del Proyecto

```
├── config/
│   └── sala.json             # Declaración de funciones, salas (5x6 = 30 butacas) y catálogo de candy bar
├── lib/
│   ├── caerus/
│   │   ├── index.ts          # Inicializador singleton del cliente Caerus (@caerus-dev/sdk)
│   │   ├── memory.ts         # Motor de prueba en memoria (fallback sin API key)
│   │   └── registro.ts       # Proxy interceptor para telemetría de llamadas del SDK
│   ├── cine.ts               # Lógica de dominio, inventario y mapeo de salas
│   ├── event-bus.ts          # EventBus local que puentea Webhooks hacia Server-Sent Events
│   └── client.ts             # Cliente HTTP frontend con manejo de sesiones
├── app/
│   ├── api/
│   │   ├── webhooks/caerus/  # Endpoint receptor de webhooks de Caerus (valida HMAC)
│   │   ├── events/stream/    # Endpoint SSE (Server-Sent Events) para el navegador
│   │   └── funciones/        # Endpoints REST de cartelera, butacas y reservas
│   ├── funcion/[id]/         # Vista de sala interactiva con mapa de butacas
│   │   └── checkout/         # Vista de checkout con candy bar (POOLED) y temporizador
│   └── backoffice/           # Panel de auditoría de holders y reabastecimiento de stock
└── scripts/
    └── resembrar.mjs         # Utilidad para limpiar y reconstruir el inventario en Caerus
```
