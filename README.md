# Caerus Cine — demo de concurrencia

Demo de un cine que usa **Caerus** para reservar butacas: se toman por unos minutos, se
liberan solas si nadie paga, y dos personas que quieren la misma butaca chocan de verdad.

Corre contra el motor Caerus desplegado a través del SDK publicado, `@caerus-dev/sdk`, y
ejercita **los trece verbos** de su API pública.

Las dos funciones de la cartelera tienen **políticas distintas de conflicto**, y esa es la
idea central de la demo:

| | *El Último Horizonte* | *Lluvia de Neón* |
|---|---|---|
| Plantilla de butaca | `butaca` (`FAIL`) | `butaca_fila` (`QUEUE`) |
| El segundo que pide la misma butaca | recibe un conflicto y la pierde | **queda en la fila** |
| Cuando el primero libera | nada | el motor **se la asigna solo**, en segundos |

Mismo código, dos comportamientos. La diferencia es un campo en una plantilla del
dashboard, no una línea de esta app.

## Publicada

**https://caerus-demo.vercel.app** — repo `caerus-dev/demo-sdk`, cada push a `main` redeploya solo.

Las variables de entorno viven en Vercel, no en el repo. El Backoffice queda en **solo
lectura** salvo que cargues el token de `BACKOFFICE_TOKEN`: reservar y comprar están
abiertos para cualquiera, modificar el inventario no.

## Levantarla

```bash
npm install
npm run dev
```

Abrila en **dos ventanas distintas** y pelea con vos mismo por la misma butaca. Cada
pestaña es un usuario distinto: la identidad vive en `sessionStorage`, que es por pestaña.

## El panel de llamadas

Debajo del mapa de butacas y del checkout hay un panel que muestra **cada llamada real al
SDK a medida que ocurre**, con sus argumentos y lo que contestó el motor:

```
22:53:33   reservar   53 ms
caerus.unitary('funcionneon_D9').take({ idempotencyKey: '…', ttlSeconds: 120 })
✕ ConflictError: Out of stock for resource: funcionneon_D9
```

Existe porque lo que la demo defiende es la **biblioteca**, y el SDK corre en el servidor
donde nadie lo ve. Se implementa con un Proxy sobre el cliente (`lib/caerus/registro.ts`),
no con `console.log` desperdigados: así el panel no puede desincronizarse de lo que
realmente se ejecuta, y una llamada nueva aparece sola.

Solo registra **acciones del usuario** —reservar, quitar, candy bar, pagar, cancelar—. Las
consultas del refresco automático corren cada 3 segundos y ahogarían el panel.

## Configuración

Todo vive en `.env.local`, que no se versiona.

| Variable | Para qué |
|---|---|
| `CAERUS_API_KEY` | API Key del ambiente. **Sin ella la demo arranca igual**, contra un motor en memoria. |
| `CAERUS_ENDPOINT` | Host del motor. El SDK ya trae uno por defecto. |
| `CAERUS_TEMPLATE_BUTACA` / `_BUTACA_FILA` / `_CAPACIDAD` / `_PRODUCTO` | Nombres de las plantillas del dashboard. |
| `CAERUS_METADATA` | `on` sólo si la plantilla acepta guardar metadata (ver abajo). |

### Correr contra un Caerus local

Útil cuando el ambiente desplegado se rompe o lo pisa un deploy: el data plane arranca con
`ddl-auto: create`, así que **cada reinicio del deploy borra las plantillas y el inventario**.
Un Caerus local no te lo pisa nadie.

Con el repo `caerus-back` al lado:

```bash
docker compose up -d postgres-dev-common redis rabbitmq zookeeper
```

Levantá el `data-plane-service` (expone gRPC en `9090`), y sembrá la API Key y las cuatro
plantillas por SQL, sin pasar por el dashboard:

```bash
docker exec -i postgres-dev-common psql -U admin -d caerus_data_plane < scripts/caerus-local.sql
```

Después apuntá la demo, en `.env.local`:

```bash
CAERUS_ENDPOINT=localhost:9090
CAERUS_TLS=false
CAERUS_API_KEY=caer_dev_T3STK3Y00000000000001
CAERUS_METADATA=on
```

`CAERUS_TLS=false` es imprescindible: el SDK cifra por defecto y solo desactiva el cifrado
con un `false` o un `0` explícitos. Un valor mal escrito **no** apaga la encriptación,
a propósito.

La ventaja concreta: el seed crea `butaca_fila` con resolución `QUEUE`, así que podés
probar la cola de espera sin depender de que exista la plantilla en el dashboard.

Ojo: `ddl-auto: create` también aplica local, así que hay que re-sembrar cada vez que
reinicies el data plane.

### Dos motores, un mismo contrato

`lib/caerus/index.ts` elige la implementación según haya `CAERUS_API_KEY`:

- **con key** → `new CaerusClient(...)`, el SDK real contra el motor desplegado;
- **sin key** → `MotorEnMemoria` (`lib/caerus/memory.ts`), que respeta las mismas reglas
  (conflictos, idempotencia, vencimiento) sin necesitar infraestructura.

Los dos implementan `SharedResourceApi`, el tipo del SDK. La app no sabe cuál tiene
enchufado, y por eso se puede mostrar la demo sin conexión sin cambiar una línea.

### Qué pone Caerus y qué pone la app

El **catálogo** —qué películas hay, horarios, pósters, precios, productos del candy bar—
es configuración de esta app, en `lib/cine.ts`. Caerus se ocupa de lo suyo: cuántas
unidades quedan, quién las tiene tomadas y hasta cuándo. Un motor de concurrencia no es
una base de datos de productos.

Como efecto secundario, la demo no depende de que la plantilla guarde metadata. Si la
plantilla la acepta, se pone `CAERUS_METADATA=on` y además se guarda en el motor el
nombre del comprador y el detalle de cada reserva, que el Backoffice muestra.

## Plantillas que espera

Se crean **en el dashboard**, no desde acá.

| Plantilla | Tipo | TTL | Resolución | Metadata | Idempotencia |
|---|---|---|---|---|---|
| `butaca` | Unitaria | 2 min | `FAIL` | Sí | No |
| `butaca_fila` | Unitaria | 2 min | **`QUEUE`** | Sí | No |
| `funcion_capacidad` | Múltiple | 2 min | `FAIL` | Sí | No |
| `producto` | Múltiple | 2 min | `FAIL` | Sí | No |

Por qué así:

- **`butaca` Unitaria**: el motor *garantiza* que hay una sola. Rechaza crearla con
  cantidad ≠ 1, rechaza tomarla de a 2, y prohíbe modificarle el stock.
- **`butaca` y `butaca_fila` son idénticas salvo la resolución.** Esa única diferencia
  es todo lo que separa "el segundo pierde" de "el segundo espera su turno".
- **Si `butaca_fila` no existe, la demo no se rompe**: siembra con `butaca` y muestra
  honestamente "sin cola" en vez de prometer una fila que no va a funcionar. La política
  real de cada función queda guardada en su metadata, así que el cartel nunca miente.
- **Idempotencia en No**: la app manda `idempotencyKey` en los tres caminos igual, así
  que se puede prender sin tocar código. En `Sí` el motor la exige siempre, y es una
  piedra para el que agregue una llamada nueva.
- **Metadata en Sí**: sin eso hay que poner `CAERUS_METADATA=off`, o toda reserva falla.

El TTL de la plantilla lo pisa la app: pide `ttlSeconds: 120` en cada reserva.

### Si cambiás una plantilla

Los recursos ya creados quedan atados a la plantilla vieja. Para rehacerlos:

```bash
node scripts/resembrar.mjs           # ensayo: lista qué borraría
node scripts/resembrar.mjs --borrar  # borra de verdad
npm run dev                          # al abrir la cartelera, siembra sola
```

## Si la conexión falla con "unable to verify the first certificate"

No es Caerus. Es un antivirus o un proxy corporativo que **inspecciona HTTPS** (Avast,
Kaspersky, ESET, Zscaler). Ese software intercepta la conexión y la re-firma con una raíz
propia: Windows confía en ella, así que el navegador anda, pero Node trae su propio
almacén de raíces y no la tiene.

La solución es que Node también confíe en esa raíz:

1. Exportá el certificado raíz del antivirus a `certs/` en formato PEM.
2. `npm run dev` lo levanta solo (`scripts/dev.mjs` arma el bundle y setea
   `NODE_EXTRA_CA_CERTS` antes de arrancar Next).

**No** uses `NODE_TLS_REJECT_UNAUTHORIZED=0`: apaga la verificación de toda la app y deja
pasar cualquier certificado, incluido el de un atacante real.

## El Backoffice

Tres cosas además del alta de funciones y productos:

| Panel | Qué hace | Verbo del SDK |
|---|---|---|
| **Funciones en cartelera** | Eliminar borra la capacidad y las 54 butacas | `deleteResource` |
| **Stock del candy bar** | Reponer devuelve el stock al valor del catálogo | `updateResource` |
| **Soltar reservas en curso** | Libera de un saque los holders `PENDING` y los `QUEUED` | `release` |

"Soltar reservas en curso" es el botón que vas a querer entre una demo y la siguiente. No
toca las compras confirmadas: esas son terminales y el motor no tiene "descomprar".

Reponer calcula el faltante contra la capacidad **total** —disponible más reservado—, no
contra lo disponible. Si no, repone de más mientras alguien tiene unidades en la mano.

## Mantenimiento

Los tres tienen ensayo antes de tocar nada:

| Script | Para qué |
|---|---|
| `scripts/resembrar.mjs` | Rehace el inventario entero. Necesario si cambiás una plantilla |
| `scripts/liberar-vendida.mjs <funcion> <butaca>` | Devuelve al ruedo una butaca ya vendida |
| `scripts/reponer-producto.mjs [slug]` | Repone el stock de un producto |

Devolver una butaca vendida es borrar y recrear el recurso, porque confirmar es terminal.
Es mantenimiento, no una operación que una app de verdad deba poder hacer con una venta.

Después de un `resembrar.mjs --borrar` **no hace falta reiniciar**: la app revalida el
sembrado cada 30 segundos y vuelve a crear todo sola.

## Lo que sabemos que falla

**Si el dueño de una butaca la compra, el que estaba en la fila queda esperando para
siempre.** Es correcto —la butaca se vendió, no hay nada que darle— pero si alguien se
queda colgado en la demo, esa es la razón.

Bajo ráfagas de muchos pedidos a la vez, los números de la cartelera pueden ir unos
segundos atrasados respecto del motor. Se asientan solos.

## Detalles que importan

- **La clave de idempotencia es por intento, no por butaca.** Se arma como
  `sessionId:butacaKey:intento`, donde `intento` es un UUID que vive en `sessionStorage` y
  se descarta al soltar la butaca o al vencerse. Así el doble clic sigue devolviendo el
  mismo holder —que es para lo que existe la idempotencia— pero volver a pedir una butaca
  que soltaste arranca una operación nueva. Con una clave fija por usuario y butaca, el
  motor contestaba con el holder viejo ya liberado: correcto de su parte, y un error
  nuestro por reusar una clave para otra cosa.
- **Ninguna respuesta del motor se da por buena sin mirar el estado.** `exigirHolderVivo`
  rechaza cualquier holder que no venga `PENDING` o `QUEUED`, así que un `200` con un
  holder muerto se convierte en un `409` visible en vez de una reserva fantasma.
- **El mapa revalida sus propias reservas cada cinco segundos** contra `/api/holders`. Si
  un holder dejó de estar vigente —lo soltó el Backoffice, se venció, lo liberó otra
  ventana— la butaca vuelve a estar libre en pantalla sola.
- **`serverExternalPackages`** en `next.config.mjs`: `@grpc/grpc-js` no se puede
  empaquetar. Si se saca, todas las llamadas fallan.
- **`export const runtime = 'nodejs'`** en cada Route Handler: gRPC necesita el runtime de
  Node, no el Edge.
- **Confirmar es irreversible.** Por eso `/api/holders/confirmar` revisa que TODAS las
  reservas del pedido sigan vigentes antes de confirmar una sola.
- **Cada butaca vence por su cuenta.** El temporizador muestra la más próxima; al llegar a
  cero se descarta sólo esa, no el pedido entero.
- **Estar en la fila no reserva capacidad.** Mientras esperás no tenés nada tomado; la
  unidad de capacidad de la sala se pide recién cuando el motor te promueve a `PENDING`.
  Si en ese momento no hay capacidad, se libera la butaca: la misma compensación que al
  reservar normalmente.
- **El guion de la demo está en `GUION.md`.**
