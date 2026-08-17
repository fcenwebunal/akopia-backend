# Auditoría de hooks — AKOPIA

**Fecha:** 17 de agosto de 2026
**Alcance:** `pb_hooks/utils/helpers.js`, `pb_hooks/utils/config.js`, `pb_hooks/02_codes.pb.js`, `pb_hooks/03_inventory.pb.js`, `pb_hooks/04_audit.pb.js`
**Método:** lectura del código contra el mapa de movimientos, más comprobación contra el servidor en ejecución.

> **Nota sobre los nombres de archivo.** El guion de auditoría original pedía revisar `01_helpers.js`, `02_codes.js`, `03_inventory.js` y `04_audit.js`. Esos archivos ya no existen con ese nombre: PocketBase solo carga `pb_hooks/**/*.pb.js`, y los helpers pasaron a ser un módulo cargado con `require()` porque cada handler corre aislado. La auditoría se hizo sobre la estructura actual.

---

## Resumen ejecutivo

| | Cantidad |
|---|---|
| ✅ Correcto | 41 |
| ❌ Crítico | 6 |
| ⚠️ Frágil | 5 |

**La aritmética del inventario es correcta.** Los diez tipos de movimiento están implementados y coinciden exactamente con el mapa, y `total_qty` se recalcula como suma al final, no de forma incremental.

**El problema no está en las sumas sino en lo que pasa cuando no cuadran.** Los seis hallazgos críticos comparten una raíz: hay caminos por los que el libro de movimientos y los saldos pueden separarse sin que nadie se entere.

---

## 1. Aritmética de inventario

`updateInventoryQuantities` en `utils/helpers.js:117-190`, contrastada línea por línea con el mapa:

| Tipo | Esperado | Implementado | Línea | |
|---|---|---|---|---|
| `entrada` | disp +Q, total +Q | `available += quantity` | 123-127 | ✅ |
| `cuarentena` | cuar +Q, total +Q | `quarantine += quantity` | 147-149 | ✅ |
| `traslado_a_cuarentena` | disp −Q, cuar +Q, total = | `available -= q; quarantine += q` | 156-159 | ✅ |
| `liberar_cuarentena` | disp +Q, cuar −Q, total = | `quarantine -= q; available += q` | 151-154 | ✅ |
| `reserva` | disp −Q, res +Q, total = | `available -= q; reserved += q` | 133-136 | ✅ |
| `liberacion` | disp +Q, res −Q, total = | `reserved -= q; available += q` | 138-141 | ✅ |
| `salida` | res −Q, total −Q | `reserved -= quantity` | 129-131 | ✅ |
| `devolucion` | disp +Q, total +Q | `available += quantity` | 124 | ✅ |
| `ajuste_positivo` | disp +Q, total +Q | `available += quantity` | 125 | ✅ |
| `ajuste_negativo` | disp −Q, total −Q | `available -= quantity` | 143-145 | ✅ |

**`total_qty` se recalcula como suma al final** (`helpers.js:186`), no incrementalmente. Es lo correcto: hace imposible que el total se desincronice de sus tres componentes por acumulación de errores.

---

## 2. Hallazgos críticos

### ❌ C1 — El recorte a cero rompe el invariante en silencio

**`utils/helpers.js:162-179`**

```js
if (available < 0) {
  console.warn("available_qty clamped to 0 ...");
  available = 0;
}
```

Si un movimiento dejaría un saldo negativo, el código lo sube a 0 y **recalcula `total_qty` a partir del valor corregido**. El movimiento queda escrito en el libro con su cantidad original, pero el saldo no la refleja. A partir de ese momento el libro deja de explicar el saldo, que es la única garantía que justifica todo el diseño.

Un `console.warn` en un log que nadie lee no es un control. Un saldo que se iría a negativo significa que la operación **no debía ocurrir**: lo correcto es lanzar y revertir la transacción.

**Consecuencia:** inventario silenciosamente incorrecto, sin rastro visible en los datos.

### ❌ C2 — Un tipo de movimiento desconocido no hace nada

**`utils/helpers.js:122-160`**

El `switch` no tiene `default`. Si llega un tipo mal escrito, ningún saldo cambia, `total_qty` se recalcula sin variación… y el movimiento **se escribe igual** en `inventory_movements`. Libro y saldos divergen.

Hoy no hay ningún llamador que pase un tipo inválido, pero es exactamente la clase de error que aparece al agregar un flujo nuevo, y falla en silencio.

### ❌ C3 — `rejected → available` mete stock fantasma

**`03_inventory.pb.js:96-110`**

La tabla `TRANSITIONS` cubre `pending>available`, `pending>quarantine`, `quarantine>available` y `available>quarantine`. No cubre `rejected>available`.

Y la guarda de edición (`hasInventoryImpact`) solo se activa cuando el estado **anterior** es `available` o `quarantine`. Un artículo `rejected` no está protegido.

Resultado: un artículo rechazado puede pasarse a `available` sin generar ningún movimiento. Queda marcado como disponible, sin existencias que lo respalden y sin nada en el libro.

Un `rejected` nunca entró al inventario, igual que un `pending`. Debería tratarse igual: `rejected → available` es una reclasificación y tiene que generar una `entrada`.

### ❌ C4 — Las reservas cerradas pueden reabrirse

**`03_inventory.pb.js:263-280`**

La validación solo actúa cuando `oldStatus === "activa"`. Una reserva `liberada` o `consumida` puede volver a `activa`: el estado cambia, `TRANSITIONS` no tiene entrada para ese par, así que **no se reserva nada**.

Queda una reserva marcada como activa que no tiene stock comprometido detrás. Al liberarla después se generaría una `liberacion` que devuelve a disponible una cantidad que nunca se restó — **inventando existencias**.

Según la especificación, `liberada → (cualquiera)` y `consumida → (cualquiera)` deben estar bloqueadas.

### ❌ C5 — Un ajuste no puede partir de cero

**`pb_migrations/017_create_adjustments.js:19-21`**

`quantity_before`, `quantity_after` y `difference` son `required: true`. PocketBase trata el `0` como vacío en un `NumberField` — es el mismo defecto que obligó a la migración `025` sobre `inventory`.

Consecuencias concretas:

- Registrar existencias que estaban en bodega pero nunca se dieron de alta (`quantity_before: 0`) **falla** con `validation_required`.
- Bajar un saldo a cero (`quantity_after: 0`) **falla**.

**Nota aparte, que no es defecto:** `ajuste_positivo` y `ajuste_negativo` solo tocan `available_qty`, así que no hay forma de corregir un `quarantine_qty` o un `reserved_qty` equivocado. Eso es exactamente lo que dice el mapa de movimientos, así que es diseño deliberado y no se cambió. Si algún día hace falta, es una decisión de producto: implica tipos de movimiento nuevos.

### ❌ C6 — `devolucion` está declarado pero nadie lo genera

`devolucion` aparece en el enum de `inventory_movements` (`010:17`) y en el `switch` de `helpers.js:124`, pero **ningún hook lo crea**. Es una rama muerta.

El mapa de movimientos lo define como «Devolución recibida»: lo que vuelve de una entrega que no se pudo completar. `deliveries.status` admite `parcial` y `no_entregado`, así que el disparador existe en el modelo — falta conectarlo.

---

## 3. Advertencias

### ⚠️ A1 — `salida` no comprueba que haya reserva suficiente

**`helpers.js:129-131`.** `reserved -= quantity` sin validar. Combinado con C1, una salida mayor que lo reservado deja la reserva en 0 en silencio. Debe validarse antes.

### ⚠️ A2 — Filtros construidos por concatenación

**`helpers.js:66-72`.** `"product_id = '" + productId + "'"`. Los ids de PocketBase son alfanuméricos, así que hoy no es explotable, pero el SDK admite filtros con parámetros y esta forma es frágil ante cualquier valor que venga de fuera.

### ⚠️ A3 — Carrera en `generateSequenceCode`

**`helpers.js:26-46`.** Lee el último código y suma uno, sin bloqueo. Dos donaciones simultáneas piden el mismo número; el índice único hace que la segunda falle con 400 en vez de duplicar. Tolerable con un operador a la vez.

### ⚠️ A4 — La auditoría compara con `String()`

**`04_audit.pb.js:73`.** `String(oldValue) !== String(newValue)` colapsa tipos: `0` y `"0"` se consideran iguales, y dos objetos distintos dan ambos `"[object Object]"`. Para los campos auditados hoy (texto, números, selects) funciona, pero no detectaría cambios en un campo JSON.

### ⚠️ A5 — Sin operador no hay movimiento, y eso incluye al panel

**`03_inventory.pb.js`, varias.** Es deliberado y está documentado, pero conviene recordarlo: clasificar un artículo desde el panel `/_/` con un superusuario devuelve 400, porque un superusuario no es un registro de `users`.

---

## 4. Verificado correcto

**Códigos** (`02_codes.pb.js`) — las tres colecciones con su prefijo, relleno a 6 dígitos, solo si el campo viene vacío, y `e.next()` siempre presente. Comprobado en ejecución: `DON-000001`.

**Transiciones de `donation_items`** — las cuatro con efecto en inventario están implementadas y usan el tipo correcto. En particular `available → quarantine` usa `traslado_a_cuarentena`, **no** `cuarentena`. `pending` y `rejected` en creación no tocan inventario. Si el estado no cambia, no se hace nada.

**Ediciones bloqueadas** — `donation_items` bloquea `quantity`, `product_id`, `unit_id` y `location_id` cuando el artículo ya afectó inventario, y bloquea el paso a `rejected`. `reservations` bloquea `quantity_reserved` e `inventory_id` mientras está activa.

**Validaciones** — la unidad contra `products.default_unit_id`, la disponibilidad contra `available_qty` (no contra `total_qty`), y en ajustes: existencia del inventario, coincidencia de producto y ubicación, y `quantity_before` contra el saldo real.

**Ajustes** — `difference = quantity_after - quantity_before`, tipo según el signo, cantidad con `Math.abs`.

**Auditoría** — las 8 colecciones, con `create` y `status_change`, solo campos relevantes por colección, y sin auditar `inventory`, `inventory_movements` ni `audit_log` (no hay recursión posible).

**Transaccionalidad** — cada hook envuelve `e.next()` en `runInTransaction` reapuntando `e.app`. Los errores posteriores revierten registro y movimiento juntos. Los fallos de auditoría se registran y se tragan, deliberadamente.

**Consistencia entre archivos** — nombres de colección correctos en todos los casos, sin `$app` dentro de hooks, sin variables globales compartidas, y el caché global `_beforeUpdateCache` eliminado.

---

## 5. Correcciones aplicadas

Todas verificadas contra el servidor en ejecución, sobre base limpia.

| | Hallazgo | Corrección | Comprobación |
|---|---|---|---|
| C1 | Recorte silencioso | `updateInventoryQuantities` **lanza** en vez de recortar, con el saldo y la cantidad en el mensaje. La aritmética pasó de un `switch` a la tabla `MOVEMENT_EFFECTS`, que es el mapa de movimientos hecho código | Los saldos nunca quedan negativos, y ahora la petición se revierte en vez de dejar el libro descuadrado |
| C2 | Tipo desconocido | Un tipo fuera de la tabla lanza `BadRequestError` | — |
| C3 | Stock fantasma | `rejected>available` y `rejected>quarantine` agregados a `TRANSITIONS` como `entrada` y `cuarentena`. Un rechazado nunca entró al inventario, igual que un pendiente | `rejected → available` de 7 unidades: disponible pasó de 70 a 77 |
| C4 | Reservas reabiertas | Cualquier cambio de estado desde `liberada` o `consumida` se rechaza | `consumida → activa` devuelve *«Una reserva consumida no puede cambiar de estado»* |
| C5 | Ajustes desde cero | Migración `027`: `quantity_before`, `quantity_after` y `difference` dejan de ser requeridos | — |
| C6 | `devolucion` | **Se dejó sin implementar, a propósito.** Ver abajo | — |

### Por qué `devolucion` sigue sin usarse

Al conectar el flujo de entrega quedó claro que el caso que parecía necesitar `devolucion` no lo necesita.

Lo reservado **no sale físicamente de la bodega** hasta que se confirma la entrega. Si la entrega falla, la mercancía nunca se movió: lo correcto es liberar la reserva (`liberacion`, reservada → disponible), no registrar una devolución. Eso es exactamente lo que hace ahora `POST /api/dispatches/{id}/confirm-delivery` cuando el estado es `no_entregado`.

`devolucion` correspondería a mercancía que **ya salió** (`salida` registrada) y vuelve días después. Ese flujo necesita su propio modelo: qué volvió, cuánto, en qué estado y contra qué entrega. No está modelado, y fabricarlo sin esa información produciría movimientos sin respaldo.

Queda como tipo declarado y sin uso, con la aritmética ya implementada para cuando exista el modelo de devoluciones.

### Pendientes de las advertencias

`A1` quedó resuelta por el arreglo de C1: `salida` ya no puede dejar la reserva en negativo, porque lanza. `A2` a `A5` siguen abiertas, ninguna bloqueante.
