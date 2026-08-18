# CLAUDE.md — Backend AKOPIA

Contexto operativo para asistentes de IA y para quien retome el proyecto.
La guía completa de instalación, modelo de datos y flujo de trabajo está en [README.md](README.md); aquí va lo que **no** se puede deducir leyendo el código.

---

## Regla permanente de este repositorio

> **Todo cambio importante y toda instrucción global se registran por escrito, en el mismo PR que los introduce.**
>
> - **Siempre** → una línea en la [bitácora](#bitácora-de-avances) de este archivo, con fecha absoluta.
> - **Además, en el [README.md](README.md)** cuando el cambio altera el contrato: esquema, reglas de acceso, comportamiento de un hook, pasos de instalación, variables de entorno o convenciones de trabajo.
> - **Además, en el `CLAUDE.md` raíz** del proyecto AKOPIA cuando la decisión afecta también al frontend o al despliegue.
>
> Un cambio que el resto del equipo no puede descubrir leyendo el repositorio es un cambio que va a romperle el trabajo a alguien.

**Además:** cada mejora o corrección se commitea y se empuja en el momento, sin esperar a que lo pidan. `main` no tiene protección de rama: se puede empujar directo cuando el cambio lo amerite, y los PR se reservan para lo que conviene revisar.

---

## Qué es esto en una frase

Backend en PocketBase 0.39.11 para el centro de acopio de la UNAL Manizales: recibe donaciones, las clasifica, lleva inventario con tres saldos (disponible, reservado, cuarentena) y registra cada movimiento en un libro auditable.

**El invariante que justifica todo el diseño:** un saldo de `inventory` nunca se edita solo. Se crea un `inventory_movements` y el saldo es su consecuencia. Cualquier código que toque `inventory` sin escribir su movimiento está roto, aunque los números parezcan correctos.

---

## Las cuatro trampas de la API de hooks

Casi todo el código de PocketBase que hay en internet es de la versión 0.22 y **no funciona aquí**. Estas cuatro cosas fallan de forma silenciosa:

1. **Solo se cargan `pb_hooks/**/*.pb.js`.** Un `.js` a secas no se carga, no da error y no aparece en el log. Por eso `utils/helpers.js` y `utils/config.js` deliberadamente NO llevan `.pb.js`: son módulos, no hooks.

2. **Cada handler se serializa y corre aislado.** No ve variables del archivo, ni closures, ni argumentos de una función registradora. Todo lo que necesite lo carga con `require(`${__hooks}/utils/...`)` y lo discrimina por `e.collection.name`.

3. **Dentro de un hook siempre `e.app`, nunca `$app`.** `e.app` participa en la transacción; `$app` no. Todos los helpers reciben `app` como primer parámetro justamente para forzar esto.

4. **Un solo handler para el antes y el después**, separados por `e.next()`. `onRecordBeforeCreateRequest` y `onRecordAfterCreateRequest` no existen desde la 0.23. El orden de argumentos también cambió: primero el handler, después las colecciones. Y `record.getOriginal("x")` es ahora `record.original().get("x")`.

El patrón transaccional completo y la tabla de equivalencias están en el [README §6](README.md#6-los-hooks-la-lógica-de-negocio).

---

## Decisiones tomadas que no se ven en el código

| Decisión | Por qué |
|---|---|
| Los errores de inventario **revierten la petición**; los de auditoría solo se registran en consola | Un saldo incorrecto corrompe la operación; una línea de bitácora perdida no justifica rechazar una operación válida |
| Los movimientos de inventario **exigen `e.auth` con un registro de `users`** | Sin operador no hay a quién atribuir el movimiento. Consecuencia: crear un `donation_item` clasificado desde el panel `/_/` con un superusuario devuelve 400. Es deliberado |
| Una sola unidad por producto (`donation_items.unit_id` debe igualar `products.default_unit_id`) | El catálogo permite `KG\|G`, pero se resolvió por la vía estricta. Implica convertir a mano al recibir. **Falta confirmar con la bodega** |
| `023_seed_initial_superuser.js` conserva su nombre equivocado | No crea un superusuario de PocketBase sino un registro en `users`. Ya corrió en varias máquinas; renombrarla rompería `_migrations` |
| Identificadores y commits en inglés, errores de usuario en español | Los mensajes los lee un operador de bodega |

---

## Dos identidades que se confunden siempre

| | `admin@akopia.org` | Superusuario del panel |
|---|---|---|
| Vive en | Colección `users` | Tabla interna `_superusers` |
| Sirve para | Login de la app y consumo de la API | Entrar a `/_/` |
| Sale de | Migración `023` + `.env` | Enlace `#/pbinstall/...` del primer arranque |
| Se comparte | Sí | No, es personal |

Ninguna sustituye a la otra.

---

## Estado verificado

Comprobado ejecutando el servidor y llamando a la API, no leyendo el código:

- ✅ `DON-000001` se autogenera al crear una donación sin `code`
- ✅ `pending` no toca inventario; `pending → available` crea movimiento `entrada` y saldo `available_qty`
- ✅ `available → quarantine` mueve el saldo entre cubetas con `traslado_a_cuarentena`
- ✅ Las validaciones responden 400 con el mensaje en español y **revierten** la escritura
- ✅ `audit_log` registra `create` y `status_change` con el operador

Pendientes y decisiones abiertas: [README §8](README.md#8-estado-actual-y-pendientes).

---

## Bitácora de avances

### 2026-08-17 — Migración del repositorio y arreglo de los hooks

- Repositorio movido de `david35mm/akopia-backend` (privado) a `fcenwebunal/akopia-backend` (público), conservando los tres commits originales de David.
- **Los hooks no se estaban ejecutando.** Dos causas: los archivos no terminaban en `.pb.js`, y el código usaba la API de la 0.22 (`onRecordBeforeCreateRequest`, `onRecordAfterCreateRequest`), eliminada en la 0.23. El backend funcionaba como un CRUD crudo: sin códigos, sin movimientos de inventario, sin auditoría y sin validaciones.
- Reescritos los tres hooks a la API 0.39 con el patrón transaccional (`runInTransaction` + rebind de `e.app`), que es más fuerte que el original: ahora el registro y su movimiento de inventario son atómicos.
- `01_helpers.js` pasó a `utils/helpers.js` como módulo cargado con `require()`, porque los handlers aislados no ven el scope del archivo. El objeto global `_beforeUpdateCache` desapareció: con un solo handler basta una variable local antes de `e.next()`.
- Configuración por colección extraída a `utils/config.js`, porque un handler serializado tampoco recibe argumentos de una función registradora.
- **Bug nuevo encontrado y corregido:** migración `025_fix_inventory_qty_not_required.js`. Los cuatro campos de cantidad de `inventory` eran `required: true`, y PocketBase trata `0` como vacío en un `NumberField`. Eso hacía imposible crear el primer registro de inventario — es decir, la primera entrada de cualquier producto fallaba. `min: 0` sigue impidiendo saldos negativos.
- `.gitignore` corregido (`pocketbase.exe`, `.env`, `*.log`, `CHANGELOG.md`, `LICENSE.md`), agregado `.env.example` y reescrito el README como guía completa.
- Agregada [`PUESTA-EN-MARCHA.md`](PUESTA-EN-MARCHA.md): guía conjunta de los dos repositorios, con el diagrama de conexión, la comprobación de seis pasos y el diagnóstico por síntoma. Existe una copia gemela en el frontend.
- Verificado que CORS funciona sin configuración: PocketBase responde `Access-Control-Allow-Origin: *`, así que `localhost:3000` puede llamar a `127.0.0.1:8090` en desarrollo. En producción no hay CORS porque nginx sirve ambos bajo el mismo dominio.
- Instrucción global recibida: hacer push de cada cambio en el momento, y no proteger `main`.

### 2026-08-17 (tarde) — Scripts de verificación

- **Bug en la documentación:** las guías traían solo comandos `curl` de bash. En PowerShell `curl` es un alias de `Invoke-WebRequest`, que no entiende `-X`, `-H` ni `-d`, y `\` no continúa líneas — la continuación es `` ` ``. El equipo trabaja en Windows, así que ninguna comprobación de la guía era ejecutable tal cual.
- Agregados `scripts/verificar.ps1` y `scripts/verificar.sh`: once comprobaciones de extremo a extremo (servidor, login, catálogo, código correlativo, entrada de inventario, movimiento, cuarentena, validación que revierte, auditoría), con salida `OK`/`FALLA` y código de salida. Leen la contraseña de `.env`.
- Documentación corregida: el script es ahora el camino principal, y los comandos manuales llevan las dos sintaxis. Agregados los dos errores de PowerShell a las tablas de diagnóstico.
- **Nota:** el script escribe datos de prueba (una donación y un artículo). Es inofensivo en desarrollo, pero conviene saberlo antes de correrlo varias veces y ver saldos acumulados.

### 2026-08-17 (noche) — Servidor de la UNAL

- OTIC (Carlos) asignó el servidor `172.23.177.12`, usuario `juan`. Es una IP privada: **solo responde dentro de la red de la Universidad**, así que sin VPN o sin estar en el campus no hay acceso.
- Agregada [`DESPLIEGUE.md`](DESPLIEGUE.md) con el procedimiento completo: reconocimiento del servidor, endurecimiento del acceso, usuario de sistema `akopia`, los dos servicios de systemd, nginx con el panel `/_/` restringido, cortafuegos y respaldos.
- **Las credenciales del servidor no van en el repositorio.** La contraseña inicial llegó por correo en texto plano y debe cambiarse en el primer ingreso.
- Pendiente de OTIC: VPN para `judiazgom`, confirmar `sudo` para `juan`, subdominio `acopio.manizales.unal.edu.co` y certificado TLS (lo emite la Universidad, no se instala certbot).

### 2026-08-17 (noche) — Respuestas de OTIC

- **Cliente VPN: FortiClient.** Carlos acompaña la configuración una vez instalado; la versión del instalador se pide en el hilo del correo, porque el cliente debe ser compatible con el firmware del FortiGate.
- **El servidor es Ubuntu y `juan` tiene `sudo`.** El despliegue de `DESPLIEGUE.md` aplica tal cual.
- Sigue pendiente el subdominio y el certificado TLS, y confirmar si `172.23.177.12` es fija o asignada por DHCP.

### 2026-08-17 (noche) — Reglas de acceso endurecidas

Migración `026_harden_access_rules.js`. En PocketBase la API se genera sola, así que «configurar endpoints» es configurar reglas. Tres cambios, todos verificados llamando a la API con tres identidades distintas:

- **Un usuario desactivado no puede nada.** `users.active` existía pero ninguna regla lo miraba: un token vigente seguía sirviendo después de dar de baja a alguien. El frontend lo comprobaba al iniciar sesión, que es cortesía de interfaz, no defensa. Ahora todas las reglas llevan `@request.auth.active = true`. **Consecuencia: al crear un usuario hay que marcar `active`**, o no ve ni el catálogo.
- **`inventory_movements.createRule` pasó a `null`.** Cualquier autenticado podía insertar un movimiento fantasma sin que ningún saldo cambiara, y el libro dejaba de cuadrar con `inventory` — justo la garantía que sostiene el modelo. Los hooks escriben por la capa de modelo y no pasan por las reglas, así que siguen igual.
- **`adjustments.viewRule` pasó a admin**, que era lo que ya decía su `listRule`. Quien tuviera un id podía leer el ajuste completo.

Dos cosas aprendidas al probarlo:

- **`delete` es palabra reservada** y el parser de las migraciones la rechaza como nombre de propiedad en un objeto literal. Costó un `panic` en el arranque.
- **Una `listRule` que no se cumple filtra, no rechaza:** devuelve `200` con `totalItems: 0`, no `403`. Al probar reglas hay que contar registros, no mirar el código de estado — mi primera prueba daba «PERMITE» donde en realidad bloqueaba.

También corregido en el frontend: `UserRole` declaraba `"admin" | "operador" | "consulta"` cuando el esquema solo admite `admin` y `operator`.

### 2026-08-17 (noche) — Auditoría de hooks, correcciones y rutas propias

**Auditoría** completa en [`AUDITORIA-HOOKS.md`](AUDITORIA-HOOKS.md): 41 comprobaciones correctas, 6 hallazgos críticos, 5 advertencias. La aritmética de inventario estaba bien —los diez tipos coinciden con el mapa y `total_qty` se recalcula como suma— pero había seis caminos por los que el libro y los saldos podían separarse.

Corregidos y verificados contra el servidor:

- **C1 — el recorte a cero.** `updateInventoryQuantities` subía a 0 cualquier saldo negativo y recalculaba el total desde el valor corregido: el movimiento quedaba escrito con una cantidad que el saldo ya no reflejaba, y solo un `console.warn` lo registraba. Ahora **lanza y revierte**. La aritmética pasó de un `switch` a la tabla `MOVEMENT_EFFECTS`, que es el mapa hecho código.
- **C2** — un tipo de movimiento desconocido no hacía nada y el movimiento se escribía igual. Ahora lanza.
- **C3** — `rejected → available` no estaba en `TRANSITIONS` y la guarda no protegía el estado `rejected`: un artículo rechazado podía pasar a disponible sin generar movimiento. Un rechazado nunca entró al inventario, igual que un pendiente, así que ahora genera `entrada`.
- **C4** — una reserva `liberada` o `consumida` podía volver a `activa` sin reservar nada; al liberarla después se habría inventado inventario. Bloqueado.
- **C5** — migración `027`: las cantidades de `adjustments` eran `required: true` y PocketBase trata el 0 como vacío, así que no se podían dar de alta existencias no registradas (`quantity_before: 0`) ni bajar un saldo a cero.
- **C6 — `devolucion` se dejó sin implementar a propósito.** Lo reservado no sale de bodega hasta confirmar la entrega: si falla, se libera la reserva, no se devuelve nada. Una devolución real es mercancía que ya salió y vuelve después, y eso necesita su propio modelo.

**Seis rutas propias** en `05_routes.pb.js`: `approve`, `reject`, `cancel`, `availability`, `inventory/summary` y `confirm-delivery`. Las tres restantes del documento (`reserve`, `prepare`, `dispatch`) se hacen con CRUD estándar.

Tres cosas aprendidas, todas documentadas en el README §6b:

- **Los hooks son de petición: `app.save()` dentro de una ruta NO los dispara.** Por eso el efecto en inventario se extrajo a `reserveInventory`, `closeReservation` y `applyReservationEffect` en `utils/helpers.js`, que invocan los dos caminos. Es el riesgo más serio al agregar rutas.
- **Los parámetros de ruta van entre llaves** (`{id}`) desde la 0.23, no `:id` como en Echo.
- **`BadRequestError` no sirve para devolver datos:** su segundo argumento se interpreta como errores de validación por campo. Para responder con estructura propia hay que usar `e.json(400, ...)`, lo que obliga a validar antes de abrir la transacción.

### 2026-08-17 (noche) — Advertencias resueltas y verificación continua

Las cinco advertencias de la auditoría quedaron cerradas. Nuevo script `scripts/verificar-auditoria.ps1`: 16 comprobaciones, una por hallazgo, contra la API en ejecución. **Correrlo en todo PR que toque los hooks.**

- **A1** resuelta por el arreglo de C1: ninguna cubeta puede quedar negativa.
- **A2** — filtros con parámetros en `findInventory`. **Ojo:** un parámetro vacío **no equivale** al literal `''` en un campo de relación; con `{:locationId}` vacío dejaron de encontrarse las filas sin ubicar y se rompió el traslado a cuarentena. El caso sin ubicación conserva el literal.
- **A3** — migración `028` con la colección `sequences`. El número se reserva dentro de la transacción que inserta el registro, así que SQLite serializa. El hook de códigos ahora abre transacción, que antes no lo hacía. Comprobado con 12 donaciones en paralelo: 12 códigos únicos, cero errores.
- **A4** — `hasChanged` en la auditoría: compara por identidad y solo serializa cuando ambos lados son objetos.
- **A5** — se mantiene como diseño. Atribuir un movimiento a un usuario genérico vaciaría de sentido la trazabilidad. Solo cambió el mensaje, que ahora dice qué hacer.

### 2026-08-17 (noche) — Propuesta de modelo con variantes y lotes

[`PROPUESTA-MODELO-INVENTARIO.md`](PROPUESTA-MODELO-INVENTARIO.md). **Pendiente de aprobación, nada implementado.** Responde a las dos decisiones abiertas: inventario por variante, y marca sí — pero con un matiz que cambia el diseño.

- **La marca no resuelve el balance monetario; el lote sí.** El valor no es atributo de *qué es* la cosa sino de *cuándo entró*: tres recepciones de la misma variante tienen tres valores distintos. Guardarlo en la variante solo cambia «promediar entre marcas» por «promediar dentro de la marca».
- **Modelo de cuatro niveles:** producto → variante (qué es, código de barras) → lote (qué valía, cuándo vence) → saldo (dónde está). Es la estructura estándar de bodega y encaja con lo que ya hay.
- **El lote no cuesta ni un gesto más de captura:** se deduce de lo que ya se teclea (vencimiento + código de lote). El operario nunca ve la palabra «lote». El valor unitario se captura **una vez por donación**, no por línea.
- Con lotes salen gratis **FEFO** y las **alertas de vencimiento**, hoy imposibles porque el saldo no sabe de fechas.
- **Riesgos de volumen, con números:** ~1M de movimientos en 5 años, que a SQLite no le pesan. Los problemas reales son otros: filas de saldo en cero (archivado), recalcular saldos leyendo el libro (cierre mensual), y el deterioro del catálogo (`brands` como colección + buscar antes de crear + revisión y fusión).
- **El corazón no se toca:** las tres cubetas, los diez movimientos, la transaccionalidad y la auditoría siguen igual. Solo cambia *a qué* se le lleva el saldo, así que `verificar-auditoria.ps1` sigue siendo la red.
- **Hacerlo ahora son migraciones sobre tablas vacías.** Con datos encima habría que repartir el inventario en lotes sin conocer sus vencimientos ni sus valores — datos irrecuperables.

### 2026-08-18 — Puente con Firebase Authentication

Instrucción recibida: conectar el registro/login con Firebase Authentication, dando rol admin a `admin@akopia.org` cuando se enlace. Firebase solo prueba identidad (correo + contraseña); quién es esa persona dentro de AKOPIA lo sigue decidiendo PocketBase exclusivamente, como siempre.

- **Migración `029`** — campo `firebase_uid` en `users` (índice único parcial, solo cuando no está vacío). Enlazar por uid y no solo por correo importa porque el correo puede cambiar en Firebase y el uid no.
- **Migración `030`** — `manageRule` en `users`. **Hallazgo real, no anticipado:** un admin de la aplicación (`role: admin`) no es un superusuario real de PocketBase, así que las colecciones de autenticación le ocultan el correo de terceros (`emailVisibility`) y le bloquean campos internos como `verified`. `updateRule` no alcanza para eso; `manageRule` sí, y es el mecanismo que PocketBase ofrece exactamente para «un rol de la app administra la colección de auth sin ser superusuario». Se descubrió con el correo en blanco en `/panel/usuarios` del frontend.
- **Verificado empíricamente que `impersonate` exige un superusuario real**, no basta `role: admin` (403 con el segundo, 200 con el primero). Es la pieza que hace posible el puente: el frontend nunca conoce la contraseña de un usuario de Firebase, y aun así puede emitirle una sesión válida de PocketBase.
- Creado un tercer superusuario, **`servicio@akopia.internal`**, dedicado exclusivamente a esto. Cada entorno debe crear el suyo con `./pocketbase superuser upsert`; sus credenciales viven solo en el servidor del frontend.
- **`active` se re-evalúa en cada petición, no queda embebido en el token.** Verificado: un usuario recién activado por el admin pudo leer datos inmediatamente con el token que ya tenía, sin volver a autenticarse. Confirma que el invariante de `active = true` en cada regla de acceso (migración `026`) sigue siendo la única puerta, también para las cuentas de Firebase.
- Todo verificado contra Firebase real (proyecto `akopia`, API pública, sin mocks): alta de un operador nuevo (`active: false`), y `admin@akopia.org` registrándose por primera vez en Firebase y enlazándose a su registro existente sin perder el rol.

### 2026-08-18 (noche) — Fotos de catálogo para el explorador estilo menú

Migración `031`: `photo_url` (`URLField`, opcional) en `groups`, `categories` y `products`. Solo la URL — el archivo real lo aloja Cloudinary, no PocketBase. Sin foto, el frontend muestra una inicial de color; no es un campo obligatorio ni bloquea nada.

### 2026-08-18 (noche) — Ubicaciones con foto y reubicación de inventario

Pedido con análisis de arquitectura previo, confirmado con Juan Manuel antes de implementar (tres decisiones puntuales, ver detalle igual en el `CLAUDE.md` del frontend). Hallazgo que motivó el diseño: no existía **ningún** camino, en ningún punto de la app, para asignar una ubicación a un producto — ni al clasificar, ni después. El hook de `donation_items` además bloquea explícitamente cambiar `location_id` una vez que el artículo ya afectó inventario, por diseño (ver `03_inventory.pb.js`): un `donation_item` debe seguir contando de dónde vino la donación.

- **Migración `035`** — `photo_url` en `locations` (mismo patrón que grupos/categorías/productos, migración `031`) y `createRule` pasa de admin exclusivo a admin-u-operador. `updateRule` se queda en admin, igual que el resto del catálogo desde la migración `033`: crear sí, editar lo ya creado no.
- **Migración `036` + `relocateInventory()` en `utils/helpers.js` + ruta `POST /api/inventory/{id}/relocate`** — la pieza que faltaba. Dos movimientos nuevos, `traslado_salida`/`traslado_entrada`, que mueven `available_qty` de un renglón de `inventory` a otro (mismo producto, ubicación distinta), cada uno con su propia fila en el libro — mismo patrón de pareja que ya usan reserva/liberación, no un solo movimiento con dos ubicaciones. Sirve tanto para asignarle ubicación por primera vez a algo que estaba sin ubicar como para reorganizar después. **Solo toca `available_qty`, a propósito:** lo reservado está comprometido con una solicitud aprobada y lo que está en cuarentena espera revisión — reubicar cualquiera de los dos de paso habría sido una decisión de negocio distinta, no pedida.
- El `donation_item` original nunca se toca en una reubicación — sigue siendo el registro de qué donación trajo esa mercancía. Lo que se mueve es únicamente el saldo agregado en `inventory`.

Verificado de punta a punta contra el servidor real: operador crea una ubicación con foto (`createRule` nuevo, confirmado con una cuenta de prueba real, no asumido), reubicación de una unidad entre dos renglones de inventario (origen 8→7, destino nuevo con 1, ambos movimientos en el libro), y los dos casos de error — destino igual al origen, cantidad insuficiente — devolviendo 400 con el mensaje correcto y sin dejar el saldo a medias.

### 2026-08-18 (noche) — Corregido: `approve`/`availability` ya suman todas las ubicaciones

El hallazgo del mismo día (documentado arriba, en la entrada de "Productos faltantes" del frontend, y confirmado como bloqueo activo — no ya un caso límite — al probar coordenadas de despacho): `approve` y `availability` resolvían el inventario con `findInventory(app, productId, item.get("location_id"))`, pero `request_items` nunca tuvo un campo `location_id`. Esa llamada siempre resolvía al renglón "sin ubicar", así que en cuanto el stock real quedó repartido en ubicaciones con nombre, dejó de encontrarse — `approve` rechazaba cualquier solicitud, sin excepción.

- **`findInventoryRows(app, productId)`** en `utils/helpers.js` — todos los renglones de inventario de un producto con saldo, en cualquier ubicación, ordenados de mayor a menor saldo. Es lo que `availability` necesitaba (sumar) y lo que `approve` necesitaba para repartir.
- **`approve` reparte la reserva entre ubicaciones cuando hace falta.** Un producto puede estar repartido entre varias — reubicar es justo lo que lo separa así — y cubrir lo pedido puede necesitar tomar de más de una. Se asigna primero de la que más tiene, y **cada ubicación que aporte deja su propia fila en `reservations`**, en vez de asumir un solo `inventory_id` por renglón de solicitud.
- **No hizo falta tocar `closeReservation` ni `findActiveReservations`.** Ya procesaban "todas las reservas activas que tenga la solicitud", sin asumir una por renglón — así que una solicitud respaldada por dos reservas en vez de una funcionó sin cambiar ni una línea de `cancel` ni de `confirm-delivery`. Verificado, no solo razonado.

**Verificado de punta a punta contra el servidor real, con el caso exacto que fallaba:** un producto repartido 7/1 entre dos ubicaciones, solicitado como una sola cantidad de 8. `availability` ahora reporta 8 disponibles (antes solo veía una ubicación); `approve` aprueba y crea dos reservas (7 y 1, cada una contra su propio renglón); `cancel` libera las dos a sus renglones originales; una segunda vuelta completa por `approve` → despacho → `confirm-delivery` cierra las dos reservas como consumidas y deja ambos renglones en 0/0/0. El stock de prueba consumido en el camino se restauró con un ajuste real (`adjustments`), no reescribiendo el libro.

### 2026-08-18 (noche) — Respaldo manual de la base, para un admin de la app sin pasar por /_/

Pedido explícito de Juan Manuel: un apartado para respaldar la base manualmente (sin cron todavía) y restaurarla, restringido al superadmin con contraseña. Antes de tocar código se resolvieron con él tres ambigüedades reales por `AskUserQuestion`: quién cuenta como "superadmin" (cualquier `role: admin`, no una cuenta fija), qué contraseña se pide (la nativa de PocketBase de esa cuenta, no una maestra separada) y el alcance de restaurar (**decisión: solo respaldar desde el panel; restaurar sigue siendo manual, solo desde `/_/` con un superusuario real** — sobreescribe toda la base y reinicia el proceso, cortando a cualquiera conectado en ese momento; exponer eso a la app de operadores no compensaba el riesgo).

**`pb_hooks/07_backups.pb.js`** — tres rutas nuevas, todas exigen `role: admin` (`requireAdmin`, ya existente) y las dos que escriben además piden repetir la contraseña nativa de PocketBase de quien las llama (`record.validatePassword()`), porque la sesión activa por sí sola no basta para una acción que exporta la base completa:

- `GET /api/akopia-backups` — lista lo que ya existe (`app.newBackupsFilesystem().list("")`).
- `POST /api/akopia-backups` — crea uno nuevo (`app.createBackup()`), nombre `akopia_manual_<fecha>_<hora>.zip`.
- `POST /api/akopia-backups/{key}/download` — sirve el zip completo (`fs.serve()`), con el nombre validado contra un patrón fijo antes de abrir nada (no confía en lo que llega en la URL).

**Dos hallazgos reales, no anticipados, encontrados bisecando con respuestas de depuración temporales (documentados en el propio archivo para que no se repitan):**

1. **`/api/backups` ya es una ruta reservada de PocketBase** (su API nativa de respaldos, solo para superusuario real de `_superusers`). Registrar una ruta propia con ese mismo path no da error ni aviso — queda tapada por la nativa en silencio, y lo único visible es un 403 genérico que no viene de nuestro código. Resuelto usando `/api/akopia-backups` en su lugar.
2. **La trampa de los handlers aislados, otra vez** (la misma que ya documenta este archivo arriba, en «Las cuatro trampas de la API de hooks» — y aun así se cayó en ella escribiendo esto): la primera versión declaraba `backupName()`/`pad2()` a nivel de archivo, fuera del handler. Un handler serializado no ve nada de eso: la llamada fallaba como una excepción no atrapable por ningún `try/catch` de la ruta, indistinguible de un panic de Go, y PocketBase la convertía en el mismo 400 genérico ("Something went wrong...") sin ninguna pista de la causa real. Se resolvió moviendo el nombrado a `utils/backups.js`, cargado con `require()` dentro de cada handler — el mismo patrón que ya usan `utils/routes.js` y `utils/helpers.js`.

**Otro detalle encontrado al formatear la fecha para el frontend:** `blob.ListObject.modTime.toString()` da el formato de depuración de Go (`"2026-08-18 04:57:04.11 -0500 -05"`), que `new Date()` en el navegador no interpreta de forma fiable. Se usa `.format("2006-01-02T15:04:05Z07:00")` (el layout de referencia de Go para RFC3339) para mandar ISO 8601 de verdad.

**Sin restaurar ni borrar, a propósito.** Restaurar queda fuera por la decisión de arriba. Borrar un respaldo tampoco se construyó — no se pidió, y este backend ya tiene como principio que nada se borra de verdad (`deleteRule` nulo en todo el catálogo); un superusuario real puede limpiar `pb_data/backups` a mano o desde `/_/` si hace falta.

Verificado de punta a punta contra el servidor real: crear con contraseña incorrecta → 403; sin contraseña → 400; con la correcta → 200 y el zip aparece en `pb_data/backups/`; descargar produce un zip real con `data.db`/`auxiliary.db` dentro (confirmado con `unzip -l`, suficiente para restaurar); un intento de recorrido de directorio en el nombre del respaldo (`../../pocketbase.exe`) rechazado con 400 antes de tocar el sistema de archivos.

### 2026-08-18 (noche) — Coordenadas en solicitudes, heredadas hacia despachos y entregas; tope y consistencia de unidad al pedir

Pedido explícito con tres partes, resuelto empezando por una pregunta de alcance real (`AskUserQuestion`) antes de tocar el backend: el sistema ya permite a propósito pedir más de lo disponible (switch apagado en el frontend, para registrar demanda insatisfecha — "Productos faltantes"), así que un tope duro al crear `request_items` habría roto esa función. Confirmado con Juan Manuel: el tope de verdad sigue viviendo en `approve` (ya lo tenía desde el 18 de agosto, corregido el mismo día que se introdujo la reubicación de inventario), y aquí solo se endurece la validación básica del dato.

- **Migración `040`** — `destination_lat`/`destination_lng` en `requests`, mismo rango que ya tenía `dispatches` (migración `039`) alrededor de Manizales. Antes de esto, `requests` solo guardaba la dirección en texto; el punto exacto se inventaba de nuevo en cada despacho, siempre arrancando del centro de Manizales aunque la solicitud que lo originó ya tuviera su propia ubicación marcada. Con esto la solicitud es la única fuente real del punto — el frontend ya lo hereda como valor por defecto (editable) al armar el despacho.
- **Migración `041`** — `max: 100000` en `request_items.quantity_requested`. No limita a lo que hay en bodega (eso rompería el registro de demanda insatisfecha); solo atrapa un valor absurdo o un error de tecleo antes de que llegue a la base.
- **`pb_hooks/08_request_items_guard.pb.js`** (nuevo) — `request_items.unit_id` debe coincidir con `products.default_unit_id`, exactamente la misma regla que `donation_items` ya tenía desde el principio (`03_inventory.pb.js`) pero que `request_items` nunca llegó a tener. Sin este resguardo, nada impedía pedir un producto "en libras" cuando se lleva en kilogramos — `quantity_requested` y `available_qty` habrían dejado de ser comparables entre sí sin que nadie lo notara hasta la aprobación. Sin efecto en inventario (a diferencia de los hooks de `03_inventory.pb.js`): no necesita transacción ni rebind de `e.app`.

**Auditoría del resto del flujo, pedida explícitamente ("qué otras variables deberían heredarse"):** revisado `dispatches` y `deliveries` buscando redundancia evitable. Único hallazgo real: `deliveries.receiver_name`/`receiver_phone` se tecleaban siempre desde cero al confirmar una entrega, aunque casi siempre la persona que recibe es la misma que pidió — el dato ya vivía en `requests.requester_name`/`requester_phone`, accesible vía `expand: "request_id"` que el detalle del despacho ya pedía. Resuelto **solo en el frontend** (no hacía falta tocar el backend): se precarga como punto de partida editable, nunca se fuerza — el operador puede cambiarlo si la entrega termina siendo a otra persona. El resto de los campos de `dispatches`/`deliveries` (conductor, placa, brigada, tipo/número de documento) son genuinamente propios de ese paso y no tienen de dónde heredarse.

Verificado de punta a punta contra el servidor real: unidad distinta a la del producto rechazada con el mismo mensaje que ya usa `donation_items`; `quantity_requested: 200000` rechazado por el esquema; una solicitud creada con coordenadas propias, aprobada, y su despacho arrancando el mapa exactamente en ese punto (no en el centro de Manizales) — confirmado leyendo el valor mostrado en pantalla, no solo el código.
