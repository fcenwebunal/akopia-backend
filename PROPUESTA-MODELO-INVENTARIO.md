# Propuesta — Modelo de inventario con variantes y lotes

Respuesta a las dos decisiones abiertas de [`PROPUESTA-CAPTURA.md`](https://github.com/fcenwebunal/akopia-frontend/blob/main/PROPUESTA-CAPTURA.md): granularidad del inventario y papel de la marca. Con la estrategia para que esa granularidad **no se pague en fricción de captura**, que es el riesgo real.

---

## 1. Las dos respuestas, en corto

| Pregunta | Respuesta | Razón |
|---|---|---|
| ¿Inventario por producto o por variante? | **Por variante** | Se entregan paquetes, no kilogramos |
| ¿La marca importa? | **Sí, pero no por lo que crees** | Para el balance monetario no basta la marca: hace falta el **lote** |

Y una tercera que no habías preguntado y es la más importante:

> **El nivel que de verdad necesitas es el lote, no la variante.** La variante te dice *qué* es. El lote te dice *cuánto valía, cuándo vence y de qué entrega vino*. Sin él no hay valoración correcta ni FEFO.

---

## 2. Por qué la marca sola no resuelve lo monetario

Tu argumento fue: «no es lo mismo promediar el precio de marcas que tener las marcas de cada registro y evaluar el precio de cada una». Es correcto, y el mismo razonamiento llevado un paso más allá desmonta la solución.

Supón que recibes tres veces la misma variante — *Lentejas Marca X, bolsa 500 g*:

| Fecha | Cantidad | Valor unitario declarado |
|---|---|---|
| Marzo | 200 bolsas | $2.800 |
| Junio | 150 bolsas | $3.400 |
| Septiembre | 300 bolsas | $3.100 |

Si el valor vive en la **variante**, solo puedes guardar un número. Sea cual sea, las otras dos entradas quedan mal valoradas. Has cambiado «promediar entre marcas» por «promediar dentro de la marca»: el mismo problema, más pequeño.

**El valor no es un atributo de qué es la cosa, sino de cuándo entró.** Cambia con el mercado, con el donante y con el estado de la mercancía. Y eso, en cualquier sistema de inventario serio, se llama **lote**.

Con lotes, la pregunta «¿cuánto vale lo que tengo en bodega?» se responde sumando `cantidad × valor_unitario` lote por lote. Sin promedios y sin suposiciones. Es lo que en contabilidad se llama **identificación específica**, y es la valoración más exacta que existe.

Nota adicional: la variante seguirá siendo útil para el precio — como **precio de referencia** cuando el donante no declara valor. Pero el número que entra al balance es el del lote.

---

## 3. El modelo: cuatro niveles

Es la estructura estándar de cualquier sistema de bodega, y encaja con lo que ya existe:

```
grupo                Alimentos y Bebidas              11    ┐
  categoría          Granos y Cereales                55    │ taxonomía
    producto         Lentejas                        123    ┘ (ya existe)
      variante       Marca X · bolsa 500 g        ~2.000    ← QUÉ es · código de barras
        lote         L-4471 · vence 30/06/27      ~50.000   ← CUÁNTO valía · CUÁNDO vence
          saldo      12 unidades en A-01-03                 ← DÓNDE está
```

| Nivel | Responde | Quién lo crea | Cuándo |
|---|---|---|---|
| Producto | ¿Qué clase de cosa es? | Admin | Rara vez |
| **Variante** | ¿Exactamente cuál? | Operario (con revisión) | Al aparecer algo nuevo |
| **Lote** | ¿De qué entrega vino, qué valía, cuándo vence? | **El sistema, solo** | En cada recepción |
| Saldo | ¿Cuánto queda y dónde? | **El sistema, solo** | Con cada movimiento |

Los dos niveles de abajo **nadie los teclea**. Esa es la clave de todo lo que sigue.

### Cómo cambia el esquema

**`product_variants`** — nueva

| Campo | Notas |
|---|---|
| `product_id` | Producto del catálogo |
| `brand_id` | Relación a `brands`. Vacío para granel o ropa donada |
| `presentation` | «Bolsa 500 g», «Caja 12 unidades» |
| `content_qty` + `content_unit_id` | 500 + gramos. Permite convertir a la unidad base |
| `barcode` | EAN-13 / UPC, índice único. La llave del escáner |
| `reference_price` | Estimado, para cuando el donante no declara valor |
| `attributes` | JSON con lo que pide cada categoría (talla, género…) |
| `created_by` + `reviewed` | Trazabilidad de las altas de operarios |

**`brands`** — nueva, pequeña y curada. Texto libre produce «Diana», «DIANA» y «diana» en dos meses, y entonces agrupar por marca deja de servir — que es justo para lo que la querías.

**`inventory_lots`** — nueva

| Campo | Notas |
|---|---|
| `variant_id` | Qué es |
| `batch_code` | Código del fabricante, si lo trae |
| `expiry_date` | Vencimiento |
| `unit_value` | **Valor unitario declarado.** El número que entra al balance |
| `donation_id` | De qué entrega vino. Cierra la trazabilidad |
| `received_at` | Para FIFO cuando no hay vencimiento |

**`inventory`** — cambia su llave: pasa de `(product_id, location_id)` a `(lot_id, location_id)`. Las tres cubetas y toda la aritmética se quedan **exactamente igual**.

**`inventory_movements`** — gana `lot_id`. El libro sigue funcionando igual.

---

## 4. Por qué el lote no cuesta ni un gesto más

Esta es la parte contraintuitiva, y es la que hace viable toda la propuesta.

**El lote no se teclea: se deduce de lo que ya se estaba tecleando.**

Cuando el operario registra una entrada ya escribe el vencimiento y, si lo hay, el código de lote. Eso *es* la identidad del lote. El sistema busca si existe un lote con esa misma combinación y, si no, lo crea:

```
variante + código de lote + vencimiento + valor  →  ¿existe?
                                                     sí → suma al lote existente
                                                     no → lo crea
```

El operario nunca ve la palabra «lote». Ve el mismo formulario de antes.

Comparación de lo que se teclea por línea:

| | Hoy | Con variantes y lotes |
|---|---|---|
| Elegir producto | Sí | Sí (escáner: 1 gesto) |
| Cantidad | Sí | Sí |
| Vencimiento | Sí (si aplica) | Sí (si aplica) |
| Código de lote | Sí (si aplica) | Sí (si aplica) |
| Valor unitario | — | **Uno solo por remesa**, no por línea |
| **Total de campos** | **4** | **4** |

El valor unitario se captura **una vez por donación**, no por artículo: el donante suele declarar un valor global, o ninguno. Si no hay declaración, se usa el `reference_price` de la variante y se marca como estimado.

### Lo que sí ahorra

Con el lote resuelto, dos cosas que hoy no se pueden hacer salen gratis:

- **FEFO** — *first expired, first out*. Al alistar un despacho, el sistema propone el lote que vence primero. Hoy el operario elige a ojo y lo que vence se queda al fondo del estante.
- **Alertas de vencimiento** — «12 bolsas vencen en 30 días». Imposible sin lote, porque el saldo no sabe de fechas.

Para un acopio de alimentos, esto no es un adorno: es la diferencia entre repartir y botar.

---

## 5. Los riesgos de volumen, con números

Preguntaste por problemas logísticos o de almacenamiento a futuro. Vamos con cifras en vez de intuiciones.

Supuesto de operación intensa: 50 recepciones por semana, 20 líneas cada una.

| Tabla | Filas al año | En 5 años |
|---|---|---|
| `product_variants` | +500 | ~2.500 |
| `inventory_lots` | ~52.000 | ~260.000 |
| `inventory` (saldos) | ver abajo | — |
| `inventory_movements` | ~200.000 | ~1.000.000 |

**SQLite no se inmuta con eso.** Maneja bases de terabytes y estas tablas, con índices correctos, quedan en decenas de MB. El tamaño no es el problema.

Los problemas reales son otros tres, y los tres tienen solución conocida:

### Riesgo 1 — Filas de saldo en cero que ensucian todo

El peor. Un lote agotado deja una fila con `total_qty = 0`. Sin cuidado, en un año el inventario tiene 50.000 filas de las cuales 48.000 están vacías, y cada pantalla y cada consulta las arrastra.

**Solución:** no crear filas en cero, y archivar las que llegan a cero.

- `findOrCreateInventory` solo crea la fila cuando hay algo que poner.
- Una tarea semanal marca como `archived` las filas en cero cuyo último movimiento tiene más de 90 días. No se borran —el libro debe poder explicarlas— pero salen de las consultas por defecto.
- El lote agotado se marca `depleted`, y deja de aparecer al elegir de dónde sacar.

### Riesgo 2 — Recalcular saldos leyendo todo el libro

Si alguna vez alguien decide comprobar un saldo sumando el histórico de movimientos, en cinco años eso es un millón de filas.

**Solución:** ya está bien resuelto y hay que mantenerlo. `inventory` es la fuente autoritativa del saldo; `inventory_movements` es el libro que lo explica. **Nunca se calcula uno leyendo el otro.**

Lo que sí conviene agregar: un **cierre mensual** que guarde el saldo de cada lote al cerrar el mes. Con eso, cualquier reporte histórico parte del cierre más cercano en vez de recorrer el libro entero. Es una tabla pequeña y evita el único patrón que envejece mal.

### Riesgo 3 — El catálogo se pudre

No es un problema de volumen sino de calidad, y es el que de verdad rompe los informes. Con marca libre y alta sin control, en seis meses tienes cuatro variantes que son la misma cosa y el balance por marca deja de significar nada.

**Solución, en tres capas:**

1. **`brands` como colección**, no texto libre.
2. **Buscar antes de crear**: el alta muestra las variantes parecidas mientras se escribe. La mayoría de duplicados nacen de no encontrar lo que ya estaba.
3. **`reviewed = false`** en lo que crea un operario, con una pantalla de admin para revisar y **fusionar** duplicados. Fusionar debe repuntar los lotes de la variante duplicada a la buena; con el libro de movimientos intacto, es una operación segura.

> Sin la capa 3, las otras dos solo retrasan el problema. **Alguien tiene que tener el encargo explícito de revisar el catálogo.** Es una decisión de equipo, no técnica.

---

## 6. Qué cambia en el código

| Pieza | Cambio |
|---|---|
| `utils/helpers.js` | `findOrCreateInventory` pasa a operar por `(lot_id, location_id)`. **La aritmética de las tres cubetas no se toca** |
| `03_inventory.pb.js` | Las transiciones resuelven o crean el lote antes de mover saldo |
| `05_routes.pb.js` | `approve` elige lote por **FEFO** en vez del primer inventario que encuentra |
| `/api/inventory/summary` | Agrega por producto sumando variantes y lotes — ya agrega, solo cambia el nivel |
| Migraciones | `029` a `032`: `brands`, `product_variants`, `inventory_lots`, y la nueva llave de `inventory` |
| Nueva ruta | `GET /api/inventory/expiring?days=30` — lo que vence pronto |
| Nueva ruta | `POST /api/variants/{id}/merge` — fusionar duplicados |

**El coste está acotado porque el corazón no se toca.** Las tres cubetas, los diez movimientos, la transaccionalidad y la auditoría siguen exactamente igual: lo único que cambia es *a qué* se le lleva el saldo. La suite `verificar-auditoria.ps1` sigue siendo válida y es la red para hacer el cambio sin miedo.

---

## 7. Por fases, y por qué en este orden

**Fase 1 — Variantes y marcas** *(desbloquea el escáner y la captura rápida)*
`brands`, `product_variants`, inventario por variante. Con esto funciona el código de barras y la captura por jerarquía que quieres.

**Fase 2 — Lotes** *(desbloquea vencimientos y valoración)*
`inventory_lots`, inventario por lote, FEFO en `approve`, alertas de vencimiento. Sin fricción añadida en captura.

**Fase 3 — Mantenimiento** *(evita el deterioro)*
Archivado de saldos en cero, cierre mensual, pantalla de revisión y fusión de variantes.

### Por qué ahora y no después

Las dos primeras fases son migraciones sobre **tablas vacías**: `inventory`, `inventory_lots` y `inventory_movements` no tienen un solo registro real. Hacerlas hoy es escribir cuatro migraciones y ajustar los hooks.

Hacerlas con seis meses de operación encima significa repartir el inventario existente en lotes **sin saber sus fechas de vencimiento ni sus valores** — datos que ya no se pueden recuperar. Es exactamente lo que la auditoría del backend advertía como «la decisión más costosa de postergar».

La fase 3 puede esperar, pero no más de un año.

---

## 8. Lo que hace falta decidir

1. **¿Se registra el valor de lo donado?** Es la premisa de todo lo monetario. Si el donante no declara valor y nadie lo estima, el lote sirve igual para vencimientos pero el balance queda vacío.
2. **¿Quién revisa el catálogo, y cada cuánto?** Sin un responsable, la capa de revisión no existe.
3. **¿Se usan ubicaciones?** `locations` sigue vacía. Con lotes, la ubicación importa más: dos lotes del mismo producto pueden estar en estantes distintos y el picking necesita saberlo.
4. **¿Qué se hace con «Despensas Armadas»?** Un producto compuesto de otros productos es un modelo aparte, y conviene decidir si entra o se retira.

---

## Documentos relacionados

- [`PROPUESTA-CAPTURA.md`](https://github.com/fcenwebunal/akopia-frontend/blob/main/PROPUESTA-CAPTURA.md) — la interfaz de captura rápida
- [`AUDITORIA-HOOKS.md`](AUDITORIA-HOOKS.md) — estado de la lógica de inventario
- [`README.md`](README.md) — modelo de datos actual
