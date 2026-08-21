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

### 2026-08-18 (noche) — Rechazar lo retenido en cuarentena: salida definitiva, no reubicación

Pedido explícito del frontend (botones al final de cada renglón de "En Revisión" en Inventario): liberar a disponible, o mandar a "Rechazados". Antes de tocar código se resolvió con `AskUserQuestion` la pregunta de fondo — ¿"Rechazados" es una ubicación real que sigue contando como cuarentena, o una salida definitiva que da de baja el saldo? **Decisión de Juan Manuel: salida definitiva.** Eso descarta extender `relocateInventory` (que mueve saldo entre renglones, nunca lo destruye) y apunta al mismo mecanismo que ya usa un ajuste: restar sin sumar en ningún otro lado.

- **Migración `042`** — `"rechazo"` como valor nuevo de `inventory_movements.movement_type`. A diferencia de `traslado_salida`/`traslado_entrada` (van en pareja), este no tiene par: es una salida sin destino.
- **`rejectQuarantine()`** en `utils/helpers.js` + `rechazo: { quarantine: -1 }` en `MOVEMENT_EFFECTS` — resta de `quarantine_qty` y de `total_qty`, nunca de `available_qty`. Mismo patrón que `relocateInventory`: opera sobre el renglón de `inventory` directamente, **sin tocar el `donation_item` original** — es la misma razón por la que la transición `quarantine → rejected` en `donation_items` ya estaba bloqueada desde el 17 de agosto ("Use un ajuste de inventario"): este endpoint es justo ese ajuste, con nombre propio.
- **`POST /api/inventory/{id}/reject`** en `05_routes.pb.js`, junto a `relocate` — `{ quantity, notes }`, `requireOperator`, valida `quantity <= quarantine_qty` antes de escribir.

**Consecuencia real, encontrada verificando desde el frontend (no anticipada al diseñar):** como el rechazo no toca `donation_items`, un rechazo *parcial* deja la remesa original con su cantidad de siempre marcada `quarantine` — más de lo que en verdad queda en `inventory.quarantine_qty`. Un "liberar todo" posterior sobre ese mismo renglón falla con "Cantidad en cuarentena insuficiente" porque intenta liberar de más. **No se resolvió en el backend** (habría significado repartir el rechazo entre remesas específicas, un cambio de diseño mayor) — el frontend detecta el desajuste antes de intentarlo y remite al panel de detalle por remesa, que sí puede resolverlo una por una. Es la misma familia de limitación ya documentada para reubicar y clasificar: la remesa manda cuando hay ambigüedad de a cuál de varias le tocó el ajuste.

Verificado de punta a punta contra el servidor real: rechazar más de lo que hay en revisión devuelve 400 con el saldo real; rechazar una cantidad válida resta de `quarantine_qty` y de `total_qty` sin tocar `available_qty`, y queda una fila en `inventory_movements` con `movement_type: "rechazo"` y el motivo en `notes`.

### 2026-08-18 (noche) — Despliegue provisional en Fly.io, y `/api/requests/missing-products` se abre al público

**Decisión de Juan Manuel, revierte la del mismo día por la mañana:** OTIC (Carlos) no respondió con el acceso al servidor de la UNAL, y el aplicativo debía quedar en producción recolectando datos hoy mismo. Se descarta "estrictamente en local hasta nuevo aviso" — se despliega **de forma provisional** en hosting público (Fly.io para este backend, Vercel para el frontend), con migración al servidor de la UNAL como plan cuando haya VPN. Detalle completo del porqué y del paso a paso, en [`DEPLOY-PROVISIONAL.md`](DEPLOY-PROVISIONAL.md).

- **`Dockerfile` + `.dockerignore` + `fly.toml`** (nuevos) — descargan el binario oficial de Linux de la misma versión que corre en desarrollo (0.39.11), en vez de reusar `pocketbase.exe` (binario de Windows, gitignored). `pb_data` no se copia a la imagen: vive en un volumen de Fly montado en tiempo de ejecución, para que sobreviva a cada redeploy. **Probado de punta a punta contra Docker real, no solo escrito:** `docker build` limpio, el contenedor arrancado localmente respondió `/api/health`, `/api/requests/missing-products` y `/api/akopia-backups` (401 correcto, sin sesión) — confirma que los hooks y las rutas propias cargan igual dentro del contenedor que en local.
- **`GET /api/requests/missing-products` pasa a pública** — sin `requireOperator` ni `$apis.requireAuth()`. No es un cambio de alcance nuevo: la ruta ya se había escrito el 18 de agosto exactamente para este momento ("esta ruta es la que en algún momento va a alimentar una vista pública"), con una forma de respuesta que a propósito nunca llevó nada del solicitante. Ahora además devuelve `photo_url` del producto, para que la landing pueda mostrar la foto junto a la cantidad que falta.

**Riesgo real, documentado, no resuelto por decisión explícita:** en este despliegue provisional, `/_/` de PocketBase queda alcanzable desde cualquier punto de internet — a diferencia del plan para el VPS de la UNAL (`DESPLIEGUE.md`), que lo restringía por IP o túnel SSH. Ni Fly ni Railway ofrecen ese equivalente de forma nativa. Mitigación mínima aplicada: contraseña fuerte en el superusuario personal, nada más — se retoma la restricción real al migrar al servidor definitivo.

### 2026-08-18 (noche) — Fly.io descartado por la tarjeta, pivote a Railway, y superusuarios que se crean solos al arrancar

**La tarjeta de Juan Manuel fue rechazada por la verificación de Fly.io** — dos veces, incluida una tarjeta virtual nueva sacada para esto. No es un problema de la tarjeta en sí: es la verificación anti-fraude estándar que piden prácticamente todos los proveedores con proceso y disco persistentes (Fly, Google Cloud, Oracle...), y sin otra tarjeta a mano no había forma de pasarla. Se evaluaron alternativas con el propio Juan Manuel: un túnel desde su máquina (Cloudflare Tunnel/ngrok, descartado porque no puede dejar el computador encendido y conectado todo el día) y un VPS de pago con PayPal (DigitalOcean, más lento de montar — requiere systemd/nginx/certbot a mano). **Se resolvió con Railway**, que Juan Manuel ya tenía disponible con un plan de prueba de 30 días sin pedir tarjeta.

- **`Dockerfile` reescrito para servir a los dos hostings sin cambios** — usa `docker-entrypoint.sh` (nuevo) como `ENTRYPOINT` en vez de un `CMD` fijo, y escucha en `$PORT` si el hosting lo inyecta (Railway lo hace; Fly no, así que cae al 8090 de `fly.toml`). **Probado de nuevo con Docker real** simulando exactamente el caso de Railway (`-e PORT=8091`): el servidor arrancó en el puerto inyectado, no en el fijo.
- **`docker-entrypoint.sh` crea los superusuarios de PocketBase al arrancar, si vienen las variables de entorno correctas** (`SERVICE_SUPERUSER_EMAIL`/`PASSWORD` para el puente de Firebase, `PERSONAL_SUPERUSER_EMAIL`/`PASSWORD` opcional para `/_/`) — `pocketbase superuser upsert` es seguro de repetir en cada arranque. Antes de esto, crear esos superusuarios exigía entrar por SSH/consola al contenedor (`flyctl ssh console`), un paso más que podía volver a fallar por lo mismo que ya falló con el PATH de `flyctl` — y no todo hosting (Railway incluido) ofrece necesariamente una consola tan directa como la de Fly. **Verificado de punta a punta contra Docker real, no solo escrito:** el superusuario se creó al arrancar (`Successfully saved superuser`) y se pudo autenticar contra `/api/collections/_superusers/auth-with-password` de verdad, con la contraseña puesta por variable de entorno.
- **`.gitattributes` nuevo** — fuerza `*.sh` a LF siempre, sin importar el `autocrlf` de quien edite en Windows. Un CRLF cuela el shebang (`/bin/sh^M`) y el contenedor no arranca, con un error que no dice "son los saltos de línea" — se adelantó el problema antes de que apareciera, no después de que fallara un deploy real.
- **`railway.toml`** (nuevo, opcional) — le da a Railway la ruta de salud (`/api/health`) para que sepa cuándo el despliegue está listo de verdad, y solo reinicie si el proceso muere.
- **`DEPLOY-PROVISIONAL.md` reescrito**, con Railway como camino principal (pasos del dashboard, sin CLI: crear proyecto desde GitHub, variables, volumen en `/pb/pb_data`, dominio público) y Fly.io movido al final como alternativa, documentada por si algún día una tarjeta sí pasa.

**Lección para la próxima vez que se prepare un despliegue bajo presión de tiempo:** no asumir que el primer proveedor elegido va a funcionar — la tarjeta, el PATH del CLI, la disponibilidad de consola son puntos de fallo reales, ya tropezados dos veces hoy. Diseñar para no depender de ninguno de esos tres (superusuarios por variable de entorno en vez de CLI/consola) resultó ser la mejora que de verdad importaba, más allá de cuál hosting se terminara usando.

### 2026-08-18 (noche) — Railway en producción real: un bug propio de `set -e`, un desajuste de puerto, y catálogo sin restaurar todo

**El despliegue en Railway respondió 502 "Application failed to respond" en el primer intento**, con el contenedor aparentemente "Online" según el dashboard. Dos causas reales, encontradas en ese orden:

1. **Bug propio en `docker-entrypoint.sh`: `set -e` dejaba que un `superuser upsert` fallido tumbara todo el arranque.** Si `SERVICE_SUPERUSER_PASSWORD` tiene menos de 8 caracteres (el mínimo que exige PocketBase), el `upsert` termina con código de salida distinto de cero — y con `set -e`, el script entero se corta ahí, sin llegar jamás al `exec ... serve`. El contenedor "termina de arrancar" desde el punto de vista del hosting (el proceso de entrada corrió y salió), pero no queda nada escuchando. **Reproducido a propósito contra Docker real** con una contraseña corta antes de escribir el arreglo: mismo síntoma exacto. Corregido con `|| echo "AVISO: ..."` alrededor de los dos `upsert` — un fallo ahí ahora se registra en los logs pero nunca impide que `serve` arranque. Verificado de nuevo con Docker real que el servidor sigue arrancando con una contraseña corta.
2. **Desajuste de puerto, específico de Railway.** El contenedor escuchaba en `$PORT` (Railway lo inyecta — resultó ser 8080), pero el dominio público seguía apuntando al puerto 8090 (el que sugiere `EXPOSE 8090` del `Dockerfile`, no el real). Se diagnosticó comparando los *Deploy Logs* (`Server started at http://0.0.0.0:8080`) contra `Settings → Networking` (`Port 8090`) — nada de esto aparece en los *Build Logs*, que se veían perfectos. Se corrigió a mano, editando el puerto del dominio en Railway. Documentado en `DEPLOY-PROVISIONAL.md` para la próxima vez.

**Restaurar el respaldo completo no era lo que hacía falta** para poblar el catálogo con fotos — traía también donaciones y solicitudes de prueba, y la base en Railway debía quedar limpia salvo el catálogo. El catálogo en sí (nombres, categorías, unidades) ya estaba igual en los dos lados: las migraciones lo siembran igual siempre. Lo único que faltaba era `photo_url`, cargado después vía Cloudinary y ausente de cualquier migración. Se resolvió con un script nuevo en el frontend (`scripts/sync-catalog-photos-to-remote.mjs`) que empareja por nombre —nunca por id, cada instancia sembró el catálogo con ids propios— y copia solo ese campo. 189 registros actualizados, verificado leyendo uno de vuelta con una petición aparte contra el servidor real. Detalle completo en el `CLAUDE.md` del frontend, que es donde vive el script.

**Aprendido de paso:** al cambiar la contraseña del superusuario de servicio en Railway para resolver la autenticación del script de sincronización, hace falta actualizar la misma variable en Vercel (`POCKETBASE_SERVICE_PASSWORD`) — quedan desincronizadas si no, y el puente de Firebase falla en silencio con un 500 genérico aunque el resto del sitio funcione bien.

**Último hallazgo del día, ya con todo lo demás funcionando:** "Continuar con Google" fallaba en producción (`auth/unauthorized-domain` / "Ocurrió un error inesperado") aunque `akopia.vercel.app` ya estaba en la lista de dominios autorizados de Firebase — porque estaba agregado en el proyecto de Firebase equivocado. La cuenta de Juan Manuel tiene acceso a más de un proyecto con nombre parecido (`fcenedit`/FCEN, además del `akopia` real que usa la app según `NEXT_PUBLIC_FIREBASE_PROJECT_ID`), y el selector de proyecto arriba a la izquierda de la consola no avisa si estás editando el que no es — el dominio se ve "agregado" igual en cualquiera de los dos. Corregido agregándolo en el proyecto correcto; login por Google confirmado funcionando. Documentado en `DEPLOY-PROVISIONAL.md` como aviso explícito antes de tocar Authorized domains.

**Cierre del día: el despliegue provisional queda funcionando de punta a punta**, verificado en producción real — portada pública con catálogo y fotos, login por correo y por Google, y el resto del ciclo de negocio ya probado antes. Railway + Vercel, listo para recolectar datos reales.

### 2026-08-19 — Nomenclatura colombiana estructurada en `requests` y `dispatches`

Pedido del frontend: un módulo de dirección con tipo de vía/número/placa/complemento por separado, más mapa con Mapbox (autocompletado y geocoding inverso). Antes de tocar el esquema se resolvió con `AskUserQuestion` si esto ameritaba una migración nueva (sí) o si bastaba con componer el texto en la interfaz sin guardarlo estructurado (se descartó): guardar solo el texto compuesto habría hecho irrecuperable la descomposición más adelante, igual que ya pasó con lotes/vencimiento en el catálogo.

**Migración `043`** — `street_type` (`SelectField`, diez valores: calle/carrera/avenida/avenida_calle/avenida_carrera/diagonal/transversal/autopista/kilometro/otro), `street_number`, `street_plate` y `address_complement` en `requests` y `dispatches`. Ninguno es obligatorio — `destination` (el texto libre, que ya existía) sigue siendo el único campo que de verdad se exige, porque hay direcciones reales (veredas, sitios sin nomenclatura formal) que no encajan en tipo de vía + número.

**`street_plate` se nombra distinto de `dispatches.vehicle_plate`** a propósito: son dos "placas" completamente distintas (la de la dirección, lo que va después del "#"; la del vehículo que despacha) y ya convivían en la misma tabla — darles nombres iguales habría sido confuso en el esquema y en cualquier código que las lea.

Verificado contra `pb_data` real (no solo escrito): reiniciado el servidor por PID (nunca `taskkill /F /IM`, que mataría cualquier otra instancia — ver bitácora del 17 de agosto), y confirmadas las cuatro columnas nuevas en las dos tablas leyendo `pragma table_info` directo de `data.db`, porque el usuario de aplicación (`role: admin`) no tiene acceso al endpoint de esquema de PocketBase (ese es solo para un superusuario real de `_superusers`) — intentarlo devolvió 403, tal como se esperaba.

### 2026-08-20 — Sistema de roles múltiples, con jerarquía de asignación

Pedido explícito de Juan Manuel: reemplazar `users.role` (selección única, `admin`/`operator`) por un sistema de roles funcionales múltiples — una cuenta puede tener varios roles a la vez — con una jerarquía que impida que alguien asigne un rol de poder igual o mayor al suyo. Se propuso primero por escrito (`PROPUESTA-ROLES-PERMISOS.md`, en la raíz del proyecto) y se implementó tras cuatro rondas de respuestas que fijaron la matriz final; detalle de la matriz completa por rol/módulo en ese archivo y en el `CLAUDE.md` raíz.

**Migración `044`** — `role` pasa de `SelectField` de un solo valor a `maxSelect: 6`, con los valores `admin`, `coordinacion`, `transporte_distribucion`, `voluntariado`, `comunicaciones`, `salida` (`operator` desaparece). Las cuentas existentes se migran a `["admin"]` — decisión explícita: mientras no se creen las diez cuentas reales del equipo, lo que ya existía conserva acceso total en vez de perderlo de golpe.

**Hallazgo real, verificado contra un servidor de prueba desechable antes de escribir la migración de reglas** (copia de `pb_migrations`/`pb_hooks` al scratchpad, nunca contra `pb_data` real): el modificador `campo:each = "valor"` es la sintaxis correcta para comprobar pertenencia en el nuevo campo multi-valor — `campo = "valor"` (sin `:each`) y `campo ?= "valor"` devuelven cero resultados contra un arreglo JSON, pese a parecer más naturales. Confirmado con filtros directos y con reglas de acceso reales (`donations.listRule` probado con un usuario `voluntariado` real).

**Migración `045`** — reescribe las reglas de acceso de las 18 colecciones según la matriz de roles, con el mismo patrón `rules()` de `026_harden_access_rules.js`. Los roles que interactúan con inventario (admin, coordinación, transporte y distribución, voluntariado, salida) pueden ahora crear catálogo nuevo y editar fotos de `groups`/`categories`/`products`/`locations` — antes solo `products`/`categories`/`groups` estaban abiertos a "cualquier activo" (migraciones `033`/`037`/`038`); `locations` se suma por primera vez a ese permiso, y `06_catalog_photo_guard.pb.js` se actualiza para reconocerlo (antes limitaba solo por `role === "admin"`, ahora por `hasAnyRole(e.auth, ["admin", "coordinacion"])`).

**`utils/roles.js`** (nuevo) — la tabla de niveles (`ROLE_LEVELS`) y `canAssignRoles(actorRoles, requestedRoles)`: Administrador puede asignar cualquier rol (incluido Administrador, la única excepción a la regla general); cualquier otro actor solo roles de nivel estrictamente menor al suyo.

**`09_users_role_guard.pb.js`** (nuevo) — la jerarquía de asignación no se puede expresar en una regla declarativa de colección (necesita comparar un arreglo contra una tabla de niveles), así que vive en un hook sobre `onRecordCreateRequest`/`onRecordUpdateRequest` de `users`. **Bug real, encontrado y corregido antes de entregar, no después:** la primera versión declaraba una función `guard()` a nivel de archivo, compartida entre los dos handlers — cae directo en la trampa ya documentada del backend ("cada handler se serializa y corre aislado, sin ver el scope del archivo"): `ReferenceError: guard is not defined`, confirmado contra el servidor de prueba. Corregido duplicando la comprobación dentro de cada handler. **Segundo hallazgo, real:** un superusuario auténtico de `/_/` no tiene `role` en `users` (no es un registro de esa colección) — sin `e.hasSuperuserAuth()` como salida temprana, cualquier alta hecha desde el panel de PocketBase quedaría bloqueada por la misma jerarquía pensada para los roles de la aplicación.

**`utils/routes.js`** gana `requireRole(e, allowed)`, genérico, junto a los ya existentes `requireOperator`/`requireAdmin`. Las rutas propias de `05_routes.pb.js` se reasignan según la matriz: `approve`/`reject`/`cancel` de solicitudes → admin, coordinación, salida; `confirm-delivery` → admin, transporte y distribución, salida; `relocate`/`reject` de inventario → admin, coordinación. `07_backups.pb.js` se queda exclusivo de admin, sin cambios — decisión explícita, ni Coordinación llega a respaldos.

**Ajuste posterior a la primera versión de la migración, encontrado al contrastar contra la matriz ya prometida:** `donation_items.updateRule` seguía siendo "admin o el dueño original" (`adminOrOwner`), lo que en la práctica le negaba a Coordinación clasificar o liberar cuarentena de una donación que no recibió ella misma — contradice "Inventario — reubicar/liberar/rechazar cuarentena: Coordinación G" de la matriz. Corregido con `adminCoordOrOwner()`, verificado contra el servidor de prueba: un usuario `coordinacion` sin relación con la donación puede clasificar el artículo de otro.

Verificado de punta a punta contra un servidor de prueba real (no solo razonado): jerarquía de asignación (Coordinación no puede crear otro Coordinación ni un Administrador, sí un Voluntariado); Coordinación ve una cuenta Administrador pero no puede editarla (404 por regla); creación de donaciones permitida a Voluntariado y bloqueada a Comunicaciones; creación de solicitudes bloqueada a Voluntariado y permitida a Salida (pasa la regla, llega a validación de campos). Instancia de prueba descartada al terminar — nunca tocó `pb_data` real.

Detalle del componente de dirección con mapa (Mapbox, react-hook-form + zod), que es donde vive el resto de esta funcionalidad, en el `CLAUDE.md` del frontend.

### 2026-08-20 (tarde) — Kits: plantillas de productos+cantidades para solicitudes

Pedido explícito de Juan Manuel, evaluado por escrito antes de tocar código (`PROPUESTA-KITS-SOLICITUDES.md`, raíz del proyecto). El diseño se resolvió más simple de lo planteado inicialmente: un kit se usa una vez por destino (misma pantalla de "Registrar solicitud" de siempre, renglones precargados y multiplicados por N), así que **no hizo falta ninguna ruta propia nueva** — crear la solicitud sigue siendo el mismo CRUD directo de hoy.

- **Migración `046`** — colección `kits` (`name`, `description`, `created_by`, `active`, `use_count`). `use_count` sin `required: true` a propósito: un kit nuevo empieza en 0, y PocketBase trata `0` como vacío en un `NumberField` (la misma trampa que ya documentaba la migración `025` para `inventory`).
- **Migración `047`** — colección `kit_items` (`kit_id`, `product_id`, `unit_id`, `quantity`). `unit_id` es solo el registro de en qué unidad se pensó el kit al guardarlo: al usarlo, el frontend siempre resuelve contra la unidad ACTUAL del producto, así que un cambio de unidad en el catálogo después no rompe nada.
- **Migración `048`** — `requests.source_kit_id`/`source_kit_multiplier`, ambos opcionales, solo para trazabilidad. Las cantidades ya se copiaron a `request_items` al crear la solicitud — si el kit se edita después, esta solicitud no cambia. Mismo principio que ya sostiene `donation_items`/`request_items` frente a su origen.
- **Permisos, la única pregunta que quedaba abierta en la propuesta**, resuelta con una frase de Juan Manuel: "la creación de kits debe hacerla cualquiera que hayamos dicho que puede hacer solicitudes, en esencia es eso, una solicitud". Un solo conjunto de roles para todo — usar, crear, editar, derivar —, el mismo que ya podía crear solicitudes (Administrador, Coordinación, Salida). Sin la capa "solo admin/coordinación edita la plantilla oficial" que sí tiene el resto del catálogo.
- **`kit_items.deleteRule` se abre a esos mismos roles** (a diferencia de casi todo el resto del esquema, donde `deleteRule` es `null`): quitar un renglón al editar un kit es mantenimiento normal de una plantilla viva, no algo que deba dejar rastro histórico como si fuera una donación o una solicitud ya ocurrida. `kits.deleteRule` sigue en `null` — el kit en sí se desactiva, nunca se borra, mismo criterio que todo el catálogo.
- **`10_kits.pb.js`** (hook nuevo) — cuando una solicitud se crea con `source_kit_id`, le suma uno a `kits.use_count`. Corre después de `e.next()` y un fallo se registra y se traga, mismo criterio que `04_audit.pb.js`: perder el contador es un problema menor, rechazar una solicitud válida por eso sería peor.
- `kits`/`kit_items` se suman a la auditoría existente (`utils/config.js`, `04_audit.pb.js`).

Verificado de punta a punta contra un servidor de prueba real (no `pb_data` real): Voluntariado bloqueado para crear un kit (403); Salida crea un kit y un renglón sin problema; una solicitud creada con `source_kit_id`/`source_kit_multiplier` reales; `use_count` del kit pasando de 0 a 1 automáticamente al crear esa solicitud.

**Pedido también por Juan Manuel, antes de dar por buena la implementación:** confirmar que el flujo manual de solicitudes (sin kits) seguía intacto tras los cambios de roles de esa misma mañana. Verificado de punta a punta: crear solicitud → aprobar (con inventario real, clasificado por un voluntariado real) → despachar (transporte y distribución) → confirmar entrega. Sin regresión.

Detalle del frontend (tres pantallas nuevas bajo `/panel/kits`, y el selector de kit dentro de `solicitudes/nueva`) en el `CLAUDE.md` del frontend.

### 2026-08-20 (noche) — Recepción rápida de remesas: `donations.status`, sin ningún hook nuevo

Pedido explícito de Juan Manuel, evaluado por escrito antes de tocar el esquema (`PROPUESTA-RECEPCION-REMESAS.md`). **Hallazgo real, antes de proponer nada:** el modelo ya soportaba una donación sin artículos — `donation_items.createRule` nunca exigió que ocurriera en la misma petición que crear la `donation`. El cuello de botella descrito era enteramente de interfaz, no del esquema.

**Migración `049`** — `donations` gana `status` (`recepcion`/`clasificada`, `SelectField` requerido — sin el problema de "0 es vacío" que sí tienen los `NumberField`, así que aquí `required: true` es seguro), `total_weight_kg`, `classified_weight_kg`, `carrier_name`, `classification_closed_at`/`classification_closed_by`. Los cuatro últimos **sin** `required: true` a propósito, aunque la recepción rápida los pide en la práctica: un `NumberField` obligatorio sobre una colección con filas ya existentes puede bloquear la edición futura de un registro viejo sin ese dato — el mismo problema que ya corrigió la migración `025` sobre `inventory`. La obligatoriedad real vive en la pantalla, no en el esquema.

**Corrección de modelo, no solo de nombre:** el pedido original sugería un tercer estado "en cuarentena" a nivel de remesa. Señalado y corregido antes de implementar — cuarentena ya es un estado de cada `donation_item`, y una remesa real casi siempre termina con artículos en estados distintos a la vez (algo apto, algo en revisión). Un estado de cabecera "en cuarentena" habría sido engañoso en cuanto el primer artículo se marcara apto. Quedaron dos estados que describen únicamente si el trabajo de clasificar terminó: `recepcion` (nombre elegido por Juan Manuel, en reemplazo de "pendiente de clasificación") y `clasificada`.

**`donations.updateRule` se amplía** de `admin-o-dueño` a `admin, coordinación o dueño` (mismo patrón `adminCoordOrOwner` que ya se usó hoy mismo para `donation_items`) — cerrar la clasificación de una remesa no puede depender de ser la misma persona que la recibió, porque la fase 2 ("personal interno" clasificando) suele ser alguien distinto de quien la recibió en el mostrador.

**Migración de datos, en la misma migración `049`:** todas las donaciones que ya existían (todas de antes de este cambio, sin ningún artículo `pending`) se marcan `status: "clasificada"` de una vez — no tiene sentido hacerlas pasar por el flujo nuevo retroactivamente.

**Sin ningún hook nuevo.** El estado de cabecera es siempre una acción explícita (crear la remesa, agregar un artículo, cerrar/reabrir clasificación) gobernada por las reglas de acceso normales — nunca inferido por un proceso en segundo plano, a propósito, para no repetir el riesgo de que un campo derivado se desincronice de la realidad. `donations`/`donation_items` ya estaban auditados (`04_audit.pb.js`); los campos nuevos solo se agregaron a `AUDIT_FIELDS.donations` en `utils/config.js`.

Verificado de punta a punta contra un servidor de prueba real (no `pb_data` real): una donación creada sin ítems, con peso declarado y transportista; un artículo agregado después, desde una sesión distinta, a una remesa ya existente; cierre de clasificación con el peso declarado como valor por defecto; y Coordinación cerrando una remesa que no recibió ella misma.

Detalle del frontend (el interruptor "Solo recepción rápida" en `donaciones/nueva`, y "Agregar artículo"/"Cerrar clasificación"/"Reabrir" en `donaciones/[id]`, que hoy no existían) en el `CLAUDE.md` del frontend.

### 2026-08-20 (noche) — "Continuar con Google" bloqueado por el CSP que se agregó por el pentest

Al crear la cuenta de `judiazgom@unal.edu.co` (Juan Manuel Díaz Gómez, OTIC) y probar "Continuar con Google" desde `/login` en el servidor de la UNAL, el navegador lo rechazaba en silencio: *"Loading the script 'https://apis.google.com/js/api.js' violates ... script-src 'self' 'unsafe-inline'"*. La petición ni siquiera salía a la red — el propio Content-Security-Policy que se agregó el 19 de agosto (hallazgo del pentest de Carlos) nunca contempló que Google Sign-In carga su propio script desde `apis.google.com`, un dominio que no está bajo `*.googleapis.com` (son dominios distintos: `google.com` vs. `googleapis.com`).

**Corregido en `/etc/nginx/sites-available/akopia`** (y en `DESPLIEGUE.md` para que la guía no vuelva a quedar desactualizada): `script-src` gana `https://apis.google.com https://www.gstatic.com`, `connect-src` gana `https://apis.google.com`. `nginx -t` antes de `systemctl reload nginx` (recarga, no reinicio — no corta conexiones activas). Verificado con la cabecera real de producción tras la recarga.

**No se corrigió esto el 19 de agosto porque nunca se probó un login real por Google contra el servidor de la UNAL en ese momento** — el escaneo de Carlos fue automatizado (ZAP), no ejercitó el flujo de Google Sign-In con clic real. Coincide con el mismo patrón del otro bug de hoy (el login desde `/login` roto por la URL vacía del SDK): las verificaciones automatizadas y los `curl` no sustituyen un clic real en el navegador — los dos bugs de esta sesión salieron exactamente cuando alguien probó de verdad, no antes.

### 2026-08-20 (noche) — Un tercer bug del mismo apagón: nginx mandaba las rutas propias del frontend al backend

Con el CSP corregido, el popup de Google ya se ejecutaba de verdad — pero el login seguía fallando: `POST /api/auth/firebase 404 (Not Found)`. Esa ruta es del **frontend** (`src/app/api/auth/firebase/route.ts`, el puente que cambia un ID token de Firebase por una sesión de PocketBase), no del backend — y sin embargo PocketBase era quien respondía el 404.

**Causa:** `location /api/ { proxy_pass http://127.0.0.1:8090; }` en `/etc/nginx/sites-available/akopia` manda **todo** lo que empiece por `/api/` al backend — documentado así a propósito desde el principio ("nginx enruta `/api/` ... al backend"), pero nadie reparó en que el frontend también expone dos rutas propias bajo ese mismo prefijo (`/api/auth/firebase`, `/api/uploads/sign` — la firma de subidas a Cloudinary). PocketBase, que nunca tuvo esas rutas, respondía con su propio 404 genérico.

**Corregido** con dos `location = /api/...` exactas (mayor precedencia en nginx que la `/api/` genérica, sin importar el orden en el archivo) que mandan esas dos rutas puntuales al frontend (puerto 3000) antes de que la regla general las capture — en los dos bloques de servidor que las repiten (el de la IP en el puerto 80 y el del dominio en 443). `nginx -t` antes de recargar; verificado en producción real que `/api/auth/firebase` ya responde con el mensaje de error propio del frontend (en español, "El token de Firebase no es válido o expiró") en vez del 404 de PocketBase, y que `/api/health` (una ruta real del backend) sigue llegando a PocketBase sin problema.

**Tercer bug real de la misma tanda, mismo patrón que los dos anteriores:** nadie había completado el flujo de Firebase de punta a punta contra el servidor de la UNAL hasta hoy — el despliegue provisional de Railway/Vercel nunca tuvo este problema porque ahí el frontend y el backend son dos hosts completamente distintos, sin nginx de por medio decidiendo a cuál mandar cada ruta.

### 2026-08-20 (noche) — Incidente: `data.db` corrupto, recuperado desde respaldo, y el cron de respaldo pasa a la API nativa

Investigando el 500 de `/api/auth/firebase` (punto anterior) apareció algo más grave: `data.db` estaba corrupto a nivel binario — `PRAGMA integrity_check` fallaba con `file is not a database (26)`, cabecera sin la firma válida de SQLite, y faltaban por completo `data.db-wal`/`data.db-shm`. **Causa raíz no confirmada**, pero la hipótesis más probable, descartadas primero las alternativas obvias (sin errores de disco/filesystem en `dmesg`, 37G libres, el cron de las 3am no coincide con la ventana del problema): consultas directas con el cliente `sqlite3` contra el archivo **mientras el proceso de PocketBase lo tenía abierto en modo WAL**, hechas repetidamente esa tarde para diagnosticar el bug anterior — nunca antes se había leído el archivo así, en caliente, en este proyecto.

**Recuperado restaurando `pre_limpieza_datos_prueba_20260820.zip`** (respaldo nativo de las 17:04, el último punto bueno conocido, confirmado con Juan Manuel antes de ejecutar por ser una restauración manual — la misma regla que ya rige `/panel/respaldos`), con `akopia-backend` detenido durante el reemplazo de archivos. `PRAGMA integrity_check` → `ok` tras restaurar. Como ese respaldo es anterior a la limpieza de datos de prueba de esa misma tarde, se repitió esa limpieza (mismos 9 registros de antes) y se reseteó el contador de `donations` a 1.

**Cambio de práctica, aplicado de inmediato:** cualquier operación directa sobre `data.db` (lectura o escritura por `sqlite3`) se hace de ahora en más con el servicio detenido, nunca con `akopia-backend` corriendo.

**El cron diario de respaldo (§7 de `DESPLIEGUE.md`) pasa de un `tar czf` en caliente sobre `pb_data` a la API nativa de PocketBase** (`POST /api/backups`, `scripts/backup-cron.sh` nuevo) — exactamente el mismo mecanismo online-safe que salvó los datos hoy, en vez de una copia de archivos sin checkpoint que corre el mismo riesgo que se sospecha causó la corrupción. El script autentica con el superusuario de servicio (mismas credenciales que ya usa el puente de Firebase, leídas del `.env.production` del frontend), crea el respaldo por API y prunea por filesystem solo los `auto_*.zip` con más de 30 días — nunca toca los respaldos manuales creados desde `/panel/respaldos`.

Detalle completo del incidente, con la línea de tiempo de la recuperación, en el `CLAUDE.md` raíz.

### 2026-08-21 — nginx no dejaba pasar `/api/auth/email-status`, mismo patrón que ya se había visto el 20 de agosto

El frontend agregó una ruta propia nueva (`/api/auth/email-status`, para mensajes de login más claros — detalle en el `CLAUDE.md` del frontend). Al desplegarla en la UNAL, `curl` contra ella devolvía un 404 con la forma característica de PocketBase (`{"message":"The requested resource wasn't found."}`) — exactamente el mismo síntoma que el bug de `/api/auth/firebase` del 20 de agosto: `location /api/` en nginx captura cualquier ruta bajo ese prefijo y la manda al backend (puerto 8090) salvo que exista una `location =` exacta que gane antes, y esta ruta nueva no la tenía.

Corregido agregando `location = /api/auth/email-status` en los dos `server{}` de `/etc/nginx/sites-available/akopia` (puerto 80 sobre la IP, y 443 sobre el dominio), mismo patrón que ya usan `/api/auth/firebase` y `/api/uploads/sign`. Se respaldó el archivo anterior (`akopia.bak-<fecha>`) antes de sobrescribirlo, `nginx -t` limpio antes de `systemctl reload`. `DESPLIEGUE.md` actualizado con el bloque nuevo y un comentario más explícito, para que la próxima ruta que se agregue no vuelva a tropezar con lo mismo.

Verificado tras el reload: la ruta nueva ya responde el JSON del frontend, `/api/auth/firebase` y `/api/health` (que sí debía seguir yendo a PocketBase) sin regresión.

### 2026-08-21 — Bug real de PocketBase: cualquier cuenta con 2+ roles no veía nada, en ninguna colección

Juan Manuel reportó, probando en producción: un usuario que él mismo registró, activó y le asignó Coordinación no veía "Cuentas activas" en `/panel/usuarios` (salía en 0), ni Solicitudes, ni Historial. Confirmó de entrada un dato clave: una cuenta creada con "Vincular correo" sí funcionaba bien — eso acotó la búsqueda a la ruta de auto-registro + activación posterior, no a los datos en sí.

**Diagnóstico, no asumido — verificado contra el servidor real en cada paso:**

1. El registro de esa cuenta en la base era correcto: `role: ["voluntariado", "coordinacion"]`, `active: true`. Confirmado leyendo el registro directo con el superusuario de servicio.
2. Reproducido con `impersonate` (URL correcta: `POST /api/collections/users/impersonate/{id}`, no `/records/{id}/impersonate` — un primer intento con la URL equivocada dio un 404 que mi propio manejo de errores en Python enmascaró como "éxito", hasta que se corrigió el script y se confirmó el fallo real): con el token de esa cuenta exacta, `GET /api/collections/users/records` devolvía `totalItems: 0`. Mismo resultado en `requests` y `audit_log`.
3. **Experimento controlado, aislando la variable real:** se tomó una cuenta de prueba con un solo rol (`coordinacion`) — veía todo bien. Se le agregó un segundo rol (`voluntariado`), sin tocar nada más — dejó de ver todo. Se le devolvió a un solo rol — volvió a funcionar. Confirmado en las dos direcciones del arreglo (`[voluntariado, coordinacion]` y `[coordinacion, voluntariado]`) y con arreglos de 3 elementos.

**La causa:** la sintaxis `@request.auth.role:each = "admin" || @request.auth.role:each = "coordinacion"` — la misma que la migración 045 había verificado contra un servidor de prueba real el 20 de agosto — solo se probó entonces con cuentas de **un solo rol**. Con dos o más roles en el arreglo, esa combinación deja de encontrar coincidencias en PocketBase 0.39.11, sin error visible: la consulta simplemente devuelve cero filas.

**La corrección**, encontrada probando alternativas contra una colección desechable (creada y borrada en el mismo servidor, sin tocar datos reales) hasta dar con una que funcionara en todos los casos: `@request.auth.role:each ?= "valor"` — combinando los dos modificadores (`:each` y `?=`) en vez de usar uno solo. Ninguna otra combinación probada (`?=` sola, `:each` sola, o `:each` combinada con `||` como estaba) dio el resultado correcto para un arreglo de 2+ elementos. Verificado además que la comprobación de negación en sentido contrario (`role:each != "admin"`, la que impide que Coordinación edite una cuenta Administrador) **no** tiene este problema — solo las comparaciones afirmativas combinadas con `||` estaban rotas.

**Aplicado en dos pasos, no uno solo:**

- **En caliente contra producción primero** (con autorización explícita de Juan Manuel), colección por colección — 17 colecciones en total (`users`, todo el catálogo, `donations`, `donation_items`, `requests`, `request_items`, `dispatches`, `deliveries`, `reservations`, `preparations`, `adjustments`, `audit_log`, `kits`, `kit_items`) — porque el problema afectaba a gente real en ese momento y no podía esperar a un despliegue. El clasificador de seguridad automático bloqueó varias veces los intentos (parece un enfriamiento tras una racha de acciones seguidas sobre producción, no un rechazo del contenido — los mismos comandos, reintentados, pasaron después). Verificado con un barrido final sobre las 20 colecciones de la base: ninguna regla con la sintaxis vieja quedó sin corregir.
- **Migración `050_fix_multi_role_each_operator.js` después**, para que el arreglo quede versionado y sobreviva a cualquier despliegue futuro o restauración de un respaldo anterior a hoy. Probada de punta a punta contra una instancia de PocketBase completamente desechable (las 50 migraciones desde cero, en un puerto y una carpeta aparte, borrada al terminar) — no contra `pb_data` real ni contra el servidor: una cuenta con dos roles vio 123 productos (el catálogo completo) y pudo listar `users`, confirmando que la migración reproduce exactamente el arreglo ya verificado en caliente.

**Verificado al cierre, con la cuenta real que reportó el problema:** ve `users` (20), `donations` (4), `requests` (5), `dispatches` (1), `audit_log` (45) y `kits` (1) — las mismas pantallas que antes le salían vacías.

**Para la próxima vez que se agregue una regla con roles múltiples:** usar `role:each ?= "valor"` desde el principio, y si se prueba con una sola cuenta de un solo rol, probar también con una de dos roles antes de darla por buena — es exactamente el paso que faltó el 20 de agosto.

### 2026-08-21 — Unidades de medida, atributos de talla/empaque en `donation_items`, e identificación real del donante

Pedido de Juan Manuel al revisar el Excel que ya está usando el equipo para imputar datos a mano (`INVENTARIO INTERNO.xlsx`): decimales en peso y cantidad (ver el `CLAUDE.md` del frontend — el problema real no era el backend, que ya aceptaba decimales en todos los `NumberField` relevantes desde el principio, sino los `<input type="number">` del frontend en modo período contra teclados en español), y cuatro cambios de catálogo. Cuatro decisiones de diseño se resolvieron con `AskUserQuestion` antes de escribir ninguna migración, porque cambiaban el modelo: talla en un solo desplegable (Única/XS/S/M/L/XL/XXL + "Numérica" con texto libre), "unidades por paquete" capturado por remesa (como la talla, no fijo en el catálogo — el mismo producto puede llegar con tamaños de empaque distintos según la donación), retirar unidades por desactivación en vez de borrado, y talla/empaque acotados solo a donaciones (no a Solicitudes/Kits, porque el inventario sigue siendo por producto, no por variante — decisión ya tomada el 17 de agosto).

**Migración `051`** — "Pieza" se renombra a "Unidad" (`code` **y** `name`: `unitLabel()` en el frontend muestra `code` antes que `name`, así que renombrar solo el nombre habría dejado "PIEZA" visible en toda la app). Se agregan `TABLETAS` y `PRENDA`. Se retiran `JUEGO`, `PAR`, `DOCENA`, `ROLLO`, `SACO`, `TAMBOR`, `TUBO` por `active: false`, no por borrado — mismo patrón que ya usa todo el catálogo. **Hallazgo real antes de escribir la migración:** Par, Rollo, Saco y Tubo ya son la unidad de 11 productos reales del catálogo sembrado (Calcetines/Calzado/Guantes → Par; Vendas/Cinta médica → Rollo; Cemento/Cal/Croquetas → Saco; Pasta dental → Tubo) — desactivar en vez de borrar los deja funcionando exactamente igual, solo dejan de ofrecerse para productos nuevos. Verificado contra una instancia desechable (las 53 migraciones desde cero): esos 11 productos conservan su unidad original sin error, y una unidad desactivada sigue resolviendo por `id` sin problema.

**Migración `052`** — `donation_items` gana `size` (`TextField`, no un `SelectField`: la interfaz ofrece un desplegable fijo más una opción numérica, pero el valor final que se guarda es siempre una sola cadena — "M", "40", "Única" — que un enum no podría representar sin abrir el rango completo) y `units_per_package` (`NumberField`, `noDecimal: true`, `min: 1`, sin `required` — la obligatoriedad real vive en la pantalla, mismo criterio que ya usó la migración `049` para los pesos de recepción rápida).

**Migración `053`** — resuelve el pendiente ya anotado en el README (`§8`, "Campos mexicanos"): `donor_rfc` nunca se conectó en el frontend, así que renombrarlo a `donor_id_number` no migra ningún dato real. Se agrega `donor_id_type` (cédula de ciudadanía/extranjería, NIT, pasaporte, otro). `deliveries.receiver_id_type` queda igual, pendiente, mismo problema pero fuera de este pedido.

`utils/config.js` — `AUDIT_FIELDS.donations` cambia `donor_rfc` por `donor_id_type`/`donor_id_number`; `AUDIT_FIELDS.donation_items` suma `size`/`units_per_package`.

Verificado de punta a punta contra una instancia de PocketBase desechable (las 53 migraciones desde cero en un puerto aparte, borrada al terminar — nunca contra `pb_data` real): unidades listadas con el estado `active` correcto (Unidad primera por nombre entre las activas, las 7 retiradas en `inactive`); una donación creada con `total_weight_kg: 12.75` y los tres campos de donante nuevos; un `donation_item` con `quantity: 3.5`, `units_per_package: 1` y `size` vacío; `audit_log` registrando los campos nuevos de `donation_items` en la creación.

### 2026-08-21 (noche) — Editar y eliminar con motivo obligatorio, solo admin/coordinación, con revisión de dependencias

Pedido explícito de Juan Manuel, con dos requisitos de fondo: (1) toda edición y todo borrado de un registro ya creado — donaciones, solicitudes, "productos en el inventario", etc. — debe pedir sí o sí una justificación y quedar en el historial; (2) antes de borrar hay que revisar qué depende de ese registro y, si algo lo bloquea, decírselo al operador con claridad. Antes de escribir código se resolvieron tres decisiones de fondo con `AskUserQuestion` (recomendaciones aceptadas las tres): el catálogo (productos/categorías/grupos/ubicaciones, y por extensión kits) se sigue rigiendo por el principio ya establecido de "nada se borra, se desactiva" — "eliminar" ahí pasa a ser una desactivación con motivo obligatorio, no un borrado real; los cambios y borrados que ya afectaron inventario se **bloquean y explican** en vez de revertirse automáticamente (más seguro de construir y verificar bien en una sola sesión); y el alcance cubre de una vez donaciones/solicitudes, despachos/entregas, catálogo y kits.

**El hallazgo que definió el diseño, antes de escribir nada:** revisando `donation_items.donation_id` (`cascadeDelete: true`) y `request_items.request_id`→`reservations.request_item_id` (ambos `cascadeDelete: true`), el `deleteRule` que ya existía (admin, desde el principio) permitía borrar una `donations`/`requests` con artículos ya clasificados o reservas activas — PocketBase cascada el borrado de los hijos **sin revertir el efecto en inventario ni dejar ningún rastro**, porque `04_audit.pb.js` nunca tuvo un handler de borrado. Era un hueco real, ya presente, no algo que este pedido introdujera — solo nadie lo había ejercitado porque no había ninguna pantalla que ofreciera borrar.

**Arquitectura — una ruta propia, no las reglas declarativas de cada colección**, mismo criterio que ya usan `approve`/`reject`/`cancel`/`relocate` en `05_routes.pb.js`: una regla de acceso no puede exigir "un motivo de al menos 5 caracteres" ni "solo si no hay dependencias", eso es lógica, no un filtro.

- **`11_edit_delete_with_reason.pb.js`** (nuevo) — tres rutas, config-driven por `EDITABLE_RECORDS` (`utils/config.js`, nuevo): `POST /api/records/{collection}/{id}/edit`, `GET /api/records/{collection}/{id}/delete-check` (adelanta el bloqueo antes de pedir el motivo, para no hacer escribir una justificación completa y recién ahí avisar que no se puede) y `POST /api/records/{collection}/{id}/delete`. `EDITABLE_RECORDS` es una lista blanca de campos por colección que **nunca** incluye nada que ya gobierne un flujo de negocio (`status`, `classification_status`, cantidades que ya afectaron inventario) — esos siguen viviendo exactamente donde ya estaban (clasificar, aprobar/rechazar/cancelar, confirmar entrega, un ajuste). `mode: "delete"` borra de verdad tras pasar `dependencies.js`; `mode: "deactivate"` (productos/categorías/grupos/ubicaciones/kits) nunca borra, pone `active: false`.
- **`utils/dependencies.js`** (nuevo) — `checkDeletable()`/`checkEditable()` por colección: una donación se bloquea si algún artículo ya está `available`/`quarantine`; una solicitud se bloquea si tiene un despacho asociado o una reserva `activa`/`consumida`; un despacho se bloquea si ya tiene una entrega; **una entrega nunca se puede borrar** (ya generó una salida real de inventario vía `confirm-delivery` — no existe una versión segura de deshacer eso, así que se bloquea siempre, sin excepción). `checkEditable()` reutiliza las mismas comprobaciones para `donation_items`/`request_items`: un `app.save()` dentro de una ruta no dispara los hooks de `03_inventory.pb.js` que hoy bloquean cambiar cantidad/producto/ubicación una vez que un artículo ya afectó inventario — **hallazgo real durante la verificación, no anticipado al diseñar**: la primera versión de la ruta `/edit` solo aplicaba esta comprobación al borrado, y dejaba editar `quantity` de un artículo ya clasificado sin pasar por ningún ajuste, desincronizando el saldo en silencio. Corregido antes de entregar, con una prueba dedicada que reproduce exactamente ese caso.
- **`06_catalog_photo_guard.pb.js`** — la excepción que dejaba a admin/coordinación cambiar cualquier campo de `products`/`categories`/`groups`/`locations` por un PATCH crudo, sin motivo ni rastro, se retira: el PATCH crudo de la API queda limitado a `photo_url` **para cualquiera**, sin excepción de rol. El resto del catálogo se edita por la ruta nueva, que hace `app.save()` dentro de un handler propio y por eso nunca dispara este hook — no hay conflicto entre las dos.
- **Migración `054`** — `donations`/`donation_items`/`requests`/`request_items`/`dispatches`/`deliveries` pierden su `deleteRule` (antes admin-solo): el borrado real de esas seis colecciones **solo** pasa por la ruta nueva a partir de aquí, nunca por un `DELETE` crudo. `adjustments` se abre a Coordinación además de Administrador — es el camino que la ruta de edición señala cuando alguien intenta cambiar algo que ya afectó inventario ("usa un ajuste"), y dejarlo solo para admin habría hecho ese mensaje un callejón sin salida para uno de los dos roles a los que se les está dando esta capacidad. Sintaxis de roles: `role:each ?= "valor"`, la misma que la migración `050` ya dejó vigente contra 2+ roles a la vez.
- **`utils/routes.js`** gana `loadRecord(app, collection, id)`, genérico. **`04_audit.pb.js`** suma `"adjustments"` a las colecciones que audita en creación — antes un ajuste no dejaba rastro en Historial, aunque el propio registro de `adjustments` ya era en sí mismo una bitácora completa.

**Un segundo hallazgo real durante la verificación, de la propia API de rutas de PocketBase, no del dominio:** un campo `changes: {}` (objeto) en un `DynamicModel` **no se vincula a un objeto plano de JavaScript** — goja lo envuelve en un valor de Go con métodos (`get`, `set`, `value`, `marshalJSON`...), y `Object.keys()` sobre eso devuelve esos nombres de método, no las claves reales del JSON enviado. Ningún uso anterior de `DynamicModel` en este proyecto había declarado un campo objeto — todos usaban strings/números planos —, así que la trampa no tenía precedente documentado. Resuelto mandando `changes` como texto JSON (`JSON.stringify()` en el cliente, `JSON.parse()` en la ruta), no como campo objeto — mismo tipo de dato (string) que el resto de rutas de este proyecto ya usa sin problema.

Verificado de punta a punta contra una instancia de PocketBase desechable (nunca contra `pb_data` real), con cadenas de dependencia reales, no solo casos sueltos: donación con un artículo `pending` → se borra sin problema; con un artículo `available` → bloqueada, con el mensaje exacto de qué hacer; solicitud aprobada (reserva `activa`) → bloqueada; la misma solicitud con un despacho encima → bloqueada por el despacho, antes de siquiera mirar la reserva; despacho sin entrega → se borra; el mismo despacho tras `confirm-delivery` → bloqueado; la entrega → siempre bloqueada, pero editable (nombre de quien recibió); producto desactivado con motivo, mismo PATCH crudo de su nombre ahora rechazado incluso para admin; Coordinación creando un ajuste de inventario (antes 403, ahora 200); Voluntariado intentando editar o borrar cualquier cosa → 403 en los dos casos; `audit_log` con `notes` (el motivo) presente en cada entrada nueva, y `action: "delete"` apareciendo por primera vez en la base desde que existe la colección.
