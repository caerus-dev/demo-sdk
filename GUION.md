# Guion de la demo

Ocho pasos, unos quince minutos. Cada uno tiene **qué hacer** y **qué decir** — lo segundo
importa más, porque lo que se defiende es el motor, no la pantalla.

## Antes de empezar

```bash
npm run dev
```

Dejá el cine en cero: Backoffice → **Soltar reservas en curso**. Si quedaron compras
confirmadas de una demo anterior, `node scripts/resembrar.mjs --borrar`.

Abrí **dos ventanas** lado a lado, no dos pestañas de la misma. Izquierda "Ana", derecha
"Beto". Cada ventana es un usuario distinto porque la identidad vive en `sessionStorage`.

Tené a mano el **panel de llamadas**, debajo del mapa. Es lo que convierte la demo en una
demo del SDK y no de una app de cine.

## Antes de mostrarla, una cosa a saber

**Si el dueño compra la butaca, el de la fila queda esperando para siempre.** Es correcto
—se vendió, no hay nada que darle— pero si alguien se queda colgado, esa es la razón.

Reservar → quitar → reservar la misma butaca **ya se puede**. Antes rompía, y valía la pena
entender por qué: mandábamos siempre la misma clave de idempotencia para ese usuario y esa
butaca, así que al volver a pedirla el motor contestaba con el holder viejo, ya liberado.
No era un defecto del motor sino nuestro, por reusar una clave para una operación distinta.

---

## 1. El conflicto

**Hacer:** las dos ventanas en *El Último Horizonte*, misma butaca, clic casi simultáneo.

**Decir:** la app no preguntó si estaba libre. Mandó el `take` y **Caerus decidió**. En el
panel se lee el error tal cual vino del motor:

```
caerus.unitary('funcionhorizonte_D4').take({ idempotencyKey: '…', ttlSeconds: 120 })
✕ ConflictError: Out of stock for resource: funcionhorizonte_D4
```

**Si querés forzarlo** sin depender de la coordinación: que Ana tome la butaca y Beto haga
clic **dentro de los 3 segundos**, antes de que su mapa se refresque. Beto la ve libre,
hace clic igual, y el motor lo rechaza. Más contundente todavía, porque muestra que la
pantalla puede estar desactualizada y no importa.

## 2. La cola de espera

**Hacer:** lo mismo, pero en *Lluvia de Neón*. Beto no pierde: la butaca le queda punteada
en azul y el panel dice "En la fila". Después Ana toca **quitar**.

**Decir:** la butaca de Ana se liberó y **el motor se la asignó a Beto solo**, en un par de
segundos. Nadie programó esa transferencia.

Y el remate: **las dos funciones corren exactamente el mismo código.** La única diferencia
es un campo en una plantilla del dashboard — `FAIL` contra `QUEUE`. Si te preguntan qué
aporta Caerus más allá de un mutex, esto es la respuesta.

## 3. El temporizador

**Hacer:** Ana reserva y no paga. Arranca el contador en 2:00. A los dos minutos la butaca
vuelve sola, en las dos ventanas.

**Decir:** no hay ningún job de limpieza escrito por nosotros. Es el TTL del holder. Si la
app se cae, la reserva vence igual, porque el que cuenta es el motor.

Es el momento muerto del guion — aprovechá los dos minutos para el paso 4.

## 4. Reservar es más de una cosa

**Hacer:** con una butaca tomada, mirá el panel. Hay **dos** llamadas, no una.

```
caerus.unitary('funcionneon_D4').take(...)
caerus.pooled('info_neon').takeMany(1, ...)
```

**Decir:** la butaca **y** una unidad de la capacidad de la sala. Si la segunda falla, la
primera se libera. Es compensación explícita, y es el ejemplo de por qué el motor no
alcanza solo: la app decide qué significa "atómico" para su negocio.

## 5. Idempotencia

**Hacer:** clic dos veces seguidas en la misma butaca libre.

**Decir:** no se tomaron dos reservas. El panel muestra el `idempotencyKey` que va en cada
`take`; con la misma clave, el motor devuelve **el mismo holder**. Es lo que hace seguro
reintentar cuando se corta la red.

## 6. El candy bar

**Hacer:** al checkout, pedí 20 Combo Pareja cuando hay 15.

**Decir:** las butacas son recursos *unitarios* —una y solo una, y el motor lo impone—; los
productos son *pooled*, con stock compartido. Misma API, dos naturalezas. En el panel se ve
la diferencia: `unitary().take()` contra `pooled().takeMany(20)`.

Mostrá también **Necesito más tiempo**: `caerus.extend(holderId, 120000)` y el contador
salta dos minutos.

## 7. Pagar, y que la venta sea una venta

**Hacer:** completá el pago. Después intentá liberar esa butaca.

**Decir:** queda `CONFIRMED`, que es terminal. No pasa nada al intentar liberarla: Caerus no
tiene "descomprar". Distingue *reservado* de *vendido*, y esa distinción es del motor, no
de la app.

## 8. El Backoffice

**Hacer:** mostrá la auditoría filtrando por estado.

**Decir:** el rastro completo —`PENDING`, `CONFIRMED`, `RELEASED`, `QUEUED`, `EXPIRED`— con
el nombre del comprador que guardó el motor en la metadata del holder.

---

## Si abrís el código

Dos recorridos: la app que consume, y la biblioteca que escribimos. Cinco minutos cada uno.
Los números de línea son de esta versión.

### La app

**1. `lib/caerus/index.ts:43-53`** — Acá se instancia el SDK. Sin API Key devuelve el motor
en memoria, y los dos implementan `SharedResourceApi`.
*El punto:* la app no sabe contra cuál de los dos corre.

**2. `app/api/funciones/[id]/reservar-butaca/route.ts:26-50`** — El corazón, entra en una
pantalla: los dos `take`, la compensación cuando el segundo falla, y el manejo de `QUEUED`.
*El punto:* nunca se pregunta si hay lugar. Se pide, y el motor contesta.

**3. `lib/api.ts:5-20`** — `exigirHolderVivo`. Ninguna respuesta se da por buena sin mirar
el estado. *El punto:* un `200` puede traer un holder muerto, y eso no es un error del
motor sino el contrato de idempotencia.

**4. `lib/client.ts:132-149`** — La clave de idempotencia es por **intento**: un UUID que
vive en `sessionStorage` y se descarta al soltar la butaca. *El punto:* el doble clic
sigue siendo idempotente, pero volver a pedir una butaca que soltaste es una operación
nueva.

**5. `lib/caerus/registro.ts:73-96`** — El Proxy que alimenta el panel. *El punto:* el
panel no puede mentir; intercepta las llamadas de verdad, no son `console.log` a mano.

**6. `app/api/holders/confirmar/route.ts:29-47`** — Revisa que todas las reservas sigan
vivas antes de confirmar una sola. *El punto:* confirmar es irreversible.

No abras `lib/cine.ts` (catálogo, largo) ni los componentes de React salvo que te pregunten
por la pantalla.

### El SDK

**1. `src/internal/handles.ts:21-42`** — `unitaryHandle` no tiene `takeMany`; `pooledHandle`
sí. *El punto:* la diferencia entre unitario y múltiple la sostiene el tipo, no un chequeo
en tiempo de ejecución.

**2. `src/client.ts:214-236`** — El `take` privado que usan los dos handles, y la guarda al
final. *El punto:* una sola implementación, dos superficies.

**3. `src/internal/mapping.ts:170-178`** — `assertUsable`, con los estados válidos pasados
por llamada. *El punto:* un holder `CONFIRMED` es el resultado esperado de `confirm` y un
fracaso viniendo de `take`, así que no puede haber una lista única.

**4. `src/internal/mapping.ts:66-78`** — Las fechas. `expiresAt` viene en segundos y
`createdAt` en milisegundos, y un cero se devuelve como `undefined`. *El punto:* la
conversión ocurre una vez, acá, y nunca se convierte un dato ausente en enero de 1970.

**5. `src/errors.ts:88-110`** — El mapeo de estados gRPC a errores tipados. *El punto:*
quien usa la biblioteca hace `catch (ConflictError)`, no compara números de estado.

**6. `src/internal/transport.ts:60-70`** — La API Key viaja en la metadata y cada llamada
lleva su propio deadline. *El punto:* el SDK nunca reintenta solo; para eso están las
claves de idempotencia.

---

## Preguntas que te pueden hacer

**¿Contra qué corre esto?** Contra el motor desplegado en
`caerus.dev.ar.sdk.apps.disilab.ar`, vía `@caerus-dev/sdk` bajado de npm. La demo no tiene
base de datos: el inventario entero vive en Caerus.

**¿Y si se cae Caerus?** La demo arranca igual sin API Key, contra un motor en memoria que
respeta las mismas reglas. Los dos implementan el mismo tipo del SDK.

**¿Por qué no usan una transacción de base de datos?** Porque el inventario no está en una
base propia. Es el caso de uso: varios servicios compitiendo por el mismo recurso, sin
compartir esquema.

**¿Esto no es un mutex?** Un mutex no vence solo, no distingue reservado de vendido, no
tiene cola con promoción automática ni idempotencia, y no es compartido entre procesos.
Los pasos 2, 3, 5 y 7 responden esa pregunta.
