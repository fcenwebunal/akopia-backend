# AKOPIA — Backend

Backend del sistema de gestión del **Centro de Acopio de la Universidad Nacional de Colombia, sede Manizales**. Construido sobre [PocketBase](https://pocketbase.io) 0.39.11.

Repositorio hermano: [`fcenwebunal/akopia-frontend`](https://github.com/fcenwebunal/akopia-frontend).

> 🚀 **¿Primera vez?** Empieza por **[PUESTA-EN-MARCHA.md](PUESTA-EN-MARCHA.md)**: levanta el backend y el frontend juntos, y comprueba que se están hablando. Unos 15 minutos.
>
> 🖥️ **¿Vas a desplegar?** Ve a **[DESPLIEGUE.md](DESPLIEGUE.md)**: el servidor de la UNAL, paso a paso.
>
> Este README es la referencia del backend: modelo de datos, hooks y cómo aportar código.

---

## Índice

1. [Qué es AKOPIA y para qué sirve](#1-qué-es-akopia-y-para-qué-sirve)
2. [El stack, y por qué](#2-el-stack-y-por-qué)
3. [Instalación paso a paso](#3-instalación-paso-a-paso)
4. [Cómo está organizado el repositorio](#4-cómo-está-organizado-el-repositorio)
5. [El modelo de datos](#5-el-modelo-de-datos)
6. [Los hooks: la lógica de negocio](#6-los-hooks-la-lógica-de-negocio)
7. [Cómo aportamos código](#7-cómo-aportamos-código)
8. [Estado actual y pendientes](#8-estado-actual-y-pendientes)
9. [Solución de problemas](#9-solución-de-problemas)

---

## 1. Qué es AKOPIA y para qué sirve

Un centro de acopio recibe donaciones, las clasifica, las guarda y las entrega a quien las necesita. Cuando eso se lleva en papel o en una hoja de cálculo compartida, tres cosas fallan siempre: no se sabe qué hay realmente en bodega, no se sabe quién movió qué, y lo que se prometió a alguien puede haberse entregado ya a otro.

AKOPIA existe para resolver esas tres cosas. Es una aplicación web que cubre el flujo completo:

```
recepción → clasificación → inventario → solicitud → reserva → despacho → entrega
```

**El principio central del sistema:** *un saldo de inventario nunca se edita a mano.* Se registra un **movimiento**, y el saldo es su consecuencia. Eso hace que en todo momento exista un libro contable —quién, qué, cuánto, cuándo y por qué— que explica cómo se llegó al número que muestra la pantalla. Si alguna vez alguien escribe código que modifica `inventory` sin crear su `inventory_movements` correspondiente, está rompiendo la garantía que justifica todo el diseño.

**Contexto institucional.** Es un proyecto de la Facultad de Ciencias Exactas y Naturales (FCEN) de la UNAL Manizales. El sitio público debe cumplir las directrices de identidad de Unimedios; el despliegue final va a infraestructura de la Universidad, bajo el subdominio propuesto `acopio.manizales.unal.edu.co`.

### Los tres saldos

Todo el modelo gira alrededor de tres cubetas por producto y ubicación, en la colección `inventory`:

| Saldo | Significa |
|---|---|
| `available_qty` | Disponible para reservar y despachar. |
| `reserved_qty` | Comprometido con una solicitud aprobada, todavía físicamente en bodega. |
| `quarantine_qty` | Retenido a revisión. No se puede reservar ni despachar. |

Y nueve tipos de movimiento que mueven cantidad entre ellas: `entrada`, `reserva`, `liberacion`, `salida`, `cuarentena`, `liberar_cuarentena`, `traslado_a_cuarentena`, `ajuste_positivo`, `ajuste_negativo`.

---

## 2. El stack, y por qué

| Pieza | Elección | Por qué |
|---|---|---|
| Backend | **PocketBase 0.39.11** | Un solo ejecutable de Go, sin dependencias, con SQLite dentro. Trae API REST por colección, autenticación JWT, archivos, tiempo real por SSE y panel de administración. Se despliega copiando un archivo. |
| Base de datos | **SQLite** (embebida) | Viene dentro de PocketBase. Todo el estado cabe en un directorio, y el respaldo es un zip. |
| Lógica de negocio | **JavaScript en `pb_hooks/`** | Se ejecuta dentro del propio proceso de PocketBase, en un intérprete embebido (goja). No hay servidor aparte que mantener. |
| Esquema | **Migraciones JS en `pb_migrations/`** | El esquema es código versionado, no configuración hecha a mano en un panel. |
| Frontend | **Next.js 15 + TypeScript + Tailwind v4** | En el [repositorio hermano](https://github.com/fcenwebunal/akopia-frontend). |

> **No cambies el stack sin discutirlo.** Si algo parece que necesita Node, Express, Prisma, Docker o un ORM, casi con seguridad ya se puede hacer con lo que hay. Abre un issue antes de agregar una pieza.

---

## 3. Instalación paso a paso

### Requisitos

- **git**
- **PocketBase 0.39.11** — no está en el repositorio, cada quien descarga el suyo (paso 2)
- Nada más. No hay `npm install`, no hay dependencias.

### Paso 0 — Dónde clonar

> ⚠️ **No clones dentro de `G:\Mi unidad\` ni de ninguna carpeta sincronizada con Google Drive, OneDrive o Dropbox.** Sincronizan archivo por archivo y corrompen tanto `.git/` como el `pb_data/*.db` que el servidor mantiene abierto. Usa una ruta local.

### Paso 1 — Clonar

```bash
git clone https://github.com/fcenwebunal/akopia-backend.git
cd akopia-backend
```

### Paso 2 — Descargar PocketBase 0.39.11

La versión importa: la API de hooks cambió en la 0.23 y este código usa la nueva.

**Windows (PowerShell):**
```powershell
curl.exe -L -o pb.zip https://github.com/pocketbase/pocketbase/releases/download/v0.39.11/pocketbase_0.39.11_windows_amd64.zip
Expand-Archive -Path pb.zip -DestinationPath . -Force
Remove-Item pb.zip
.\pocketbase.exe --version   # debe imprimir 0.39.11
```

**Linux / macOS:**
```bash
curl -L -o pb.zip https://github.com/pocketbase/pocketbase/releases/download/v0.39.11/pocketbase_0.39.11_linux_amd64.zip
unzip pb.zip && rm pb.zip CHANGELOG.md LICENSE.md
chmod +x pocketbase
./pocketbase --version
```

### Paso 3 — Configurar la contraseña inicial

```bash
cp .env.example .env
```

Edita `.env` y pon una contraseña larga. **Escríbela a mano**, no la copies de un chat: las comillas tipográficas (`‘ ’`) no son comillas para el shell y terminarían formando parte de la contraseña, sin ningún mensaje de error que lo explique.

```bash
AKOPIA_INITIAL_ADMIN_PASSWORD=UnaClaveLargaSoloParaLocal
```

### Paso 4 — Arrancar

**Windows (PowerShell):**
```powershell
$env:AKOPIA_INITIAL_ADMIN_PASSWORD = "UnaClaveLargaSoloParaLocal"
.\pocketbase.exe serve
```

**Git Bash / Linux / macOS:**
```bash
set -a; . ./.env; set +a
./pocketbase serve
```

`serve` aplica solo las migraciones pendientes antes de escuchar. No hace falta correr `migrate up` por separado.

La salida trae tres cosas:

```
Server started at http://127.0.0.1:8090
├─ REST API:  http://127.0.0.1:8090/api/
└─ Dashboard: http://127.0.0.1:8090/_/

(!) Launch the URL below ... to create your first superuser account:
http://127.0.0.1:8090/_/#/pbinstall/eyJhbGciOi...
```

### Paso 5 — Crear tu superusuario del panel

Abre ese último enlace y crea **tu** superusuario, con tu propio correo. Es personal y local: no se comparte, no se commitea, y no existe en la máquina de nadie más.

> ### ⚠️ Hay DOS identidades distintas, y confundirlas cuesta media tarde
>
> | | `admin@akopia.org` | Tu superusuario |
> |---|---|---|
> | **Dónde vive** | Colección `users` | Tabla interna `_superusers` |
> | **Para qué sirve** | Login de la aplicación, consumir la API desde el frontend | Entrar al panel `/_/` |
> | **De dónde sale** | Migración `023`, con la clave de `.env` | El enlace `#/pbinstall/...` del arranque |
> | **Se comparte** | Sí, es del proyecto | No, es tuyo |
>
> `admin@akopia.org` **no sirve para entrar al panel**, y tu superusuario **no sirve para el login de la app**. Ninguna sustituye a la otra.

### Paso 6 — Verificar que quedó bien

Hay un script que recorre el flujo completo y no depende de que teclees `curl` correctamente:

```powershell
.\scripts\verificar.ps1     # Windows
```
```bash
./scripts/verificar.sh      # Git Bash / Linux / macOS
```

Lee la contraseña de tu `.env` y hace once comprobaciones, cada una con `OK` o `FALLA`. Escribe datos de prueba, así que úsalo en desarrollo.

A mano, la autenticación debe devolver un `token` y un registro con `"role":"admin"`. Con ese token:

| Petición | Resultado esperado |
|---|---|
| `GET /api/collections/products/records` | `totalItems: 123` |
| `GET /api/collections/units/records` | `totalItems: 20` |
| `GET /api/collections/categories/records` | `totalItems: 55` |
| `GET /api/collections/locations/records` | `totalItems: 0` ← esperado hoy, ver §8 |

### Paso 7 — Verificar que los hooks corren

Esta es la prueba que separa un backend que funciona de un CRUD crudo. Crea una donación **sin** `code`:

```bash
curl -s -X POST http://127.0.0.1:8090/api/collections/donations/records \
  -H "Content-Type: application/json" \
  -H "Authorization: TU_TOKEN" \
  -d '{"donor_type":"individual","donor_name":"Prueba","receipt_date":"2026-08-17 10:00:00.000Z","operator_id":"ID_DEL_USUARIO"}'
```

✅ **Correcto:** la respuesta trae `"code":"DON-000001"`.
❌ **Los hooks no están cargando:** `400` con `{"code":{"code":"validation_required","message":"Cannot be blank."}}`.

> **En PowerShell este comando no funciona:** `curl` ahí es un alias de `Invoke-WebRequest`, que no entiende `-X`, `-H` ni `-d`, y `\` no continúa líneas. Usa `.\scripts\verificar.ps1`, o la versión con `Invoke-RestMethod` de [PUESTA-EN-MARCHA.md](PUESTA-EN-MARCHA.md#la-prueba-manual-si-prefieres-hacerla-tú).

### Empezar de cero

```bash
rm -rf pb_data          # Linux/macOS/Git Bash
rmdir /s /q pb_data     # Windows CMD
```

Es seguro y reversible: al siguiente arranque PocketBase reconstruye todo desde `pb_migrations/`. Es la forma de comprobar que una migración nueva funciona sobre una base limpia y no solo sobre la tuya.

---

## 4. Cómo está organizado el repositorio

```
akopia-backend/
├── pb_migrations/          # El esquema como código → SÍ va a git
│   ├── 001..018_create_*.js
│   ├── 019..023_seed_*.js
│   └── 024..025_*.js       # cambios posteriores al esquema
├── pb_hooks/               # La lógica de negocio → SÍ va a git
│   ├── 02_codes.pb.js      # códigos correlativos DON-/SOL-/DES-
│   ├── 03_inventory.pb.js  # movimientos y validaciones de inventario
│   ├── 04_audit.pb.js      # bitácora de auditoría
│   └── utils/
│       ├── helpers.js      # funciones compartidas
│       └── config.js       # tablas de configuración por colección
├── scripts/                # Verificación de extremo a extremo
│   ├── verificar.ps1       # Windows
│   └── verificar.sh        # Git Bash / Linux / macOS
├── pb_data/                # SQLite, archivos subidos, logs → NUNCA va a git
├── .env                    # secretos → NUNCA va a git
├── .env.example            # plantilla → sí va a git
└── pocketbase(.exe)        # binario → nunca va a git
```

| Directorio | Qué es | Git |
|---|---|---|
| `pb_migrations/` | 18 colecciones, sus reglas de acceso, índices y datos semilla. Se aplican en orden y quedan registradas en la tabla `_migrations`. | **Sí — es la fuente de verdad** |
| `pb_hooks/` | Códigos correlativos, movimientos de inventario, auditoría, validaciones. | **Sí** |
| `pb_data/` | El estado. Personal de cada máquina, se reconstruye en segundos. | **Nunca** |

> **Regla de equipo:** si cambias una colección desde el panel `/_/`, PocketBase escribe sola la migración correspondiente en `pb_migrations/`. Ese archivo hay que revisarlo y commitearlo, o el cambio existe solo en tu máquina.

En desarrollo **no hay base de datos compartida** y no hace falta: cada quien corre su PocketBase con su `pb_data`. Lo que se sincroniza por git es el esquema y la lógica. Después de cada `git pull`, reinicia el servidor y las migraciones nuevas se aplican solas.

---

## 5. El modelo de datos

18 colecciones. Los conteos son los de una base recién sembrada.

### Catálogo (datos semilla)

| Colección | Registros | Qué guarda |
|---|---|---|
| `units` | 20 | Unidades de medida: KG, L, UND… |
| `groups` | 11 | Grupos de primer nivel del catálogo |
| `categories` | 55 | Categorías dentro de cada grupo |
| `products` | 123 | Catálogo maestro. Cada producto tiene un `default_unit_id` |
| `locations` | **0** | Ubicaciones de bodega (`zone`, `shelf`, `position`). **Sin sembrar todavía** |

### Operación

| Colección | Qué guarda |
|---|---|
| `users` | Operadores del centro. Campo `role`; `createRule` exige rol `admin` |
| `donations` | Cabecera de la donación. `code` autogenerado `DON-000001` |
| `donation_items` | Cada producto donado, con su `classification_status`: `pending` → `available` \| `quarantine` \| `rejected` |
| `inventory` | **Los tres saldos** por producto y ubicación |
| `inventory_movements` | **El libro**: cada cambio de saldo, con tipo, cantidad, operador y referencia |
| `requests` | Solicitudes de ayuda. `code` autogenerado `SOL-000001` |
| `request_items` | Renglones de la solicitud |
| `reservations` | Compromete stock: `activa` → `liberada` \| `consumida` |
| `preparations` | Alistamiento previo al despacho |
| `dispatches` | Despachos. `code` autogenerado `DES-000001` |
| `deliveries` | Confirmación de entrega al destinatario |
| `adjustments` | La única vía para corregir un saldo a mano |
| `audit_log` | Quién cambió qué y cuándo, en las 8 colecciones críticas |

### Quién puede hacer qué

PocketBase genera la API REST sola, así que **«configurar los endpoints» aquí es configurar las reglas de acceso**. Hay dos roles, `admin` y `operator`, y son los únicos valores que admite `users.role`.

| Colección | Leer | Crear | Modificar | Borrar |
|---|---|---|---|---|
| `units`, `groups`, `categories`, `products`, `locations` | Cualquiera | admin | admin | Nadie |
| `users` | admin (o uno mismo) | admin | admin | Nadie |
| `donations`, `requests`, `dispatches`, `deliveries` | Cualquiera | Cualquiera | Su autor o admin | admin |
| `donation_items`, `request_items` | Cualquiera | Cualquiera | Autor de la cabecera o admin | admin |
| `reservations`, `preparations` | Cualquiera | Cualquiera | Su autor o admin | Nadie |
| **`inventory`** | Cualquiera | **Nadie** | **Nadie** | **Nadie** |
| **`inventory_movements`** | Cualquiera | **Nadie** | **Nadie** | **Nadie** |
| `adjustments` | admin | admin | admin | Nadie |
| `audit_log` | admin | **Nadie** | **Nadie** | **Nadie** |

«Cualquiera» significa *cualquier usuario autenticado y activo*.

Tres cosas que conviene entender de esta tabla:

**Los saldos y el libro no se escriben por la API.** `inventory` e `inventory_movements` tienen `create`, `update` y `delete` en `null`: ni siquiera un administrador puede tocarlos con una petición. Los hooks sí los escriben, porque van por la capa de modelo y no pasan por estas reglas. Es lo que convierte el invariante en una garantía del servidor y no en una buena costumbre del cliente. Para corregir un saldo existe `adjustments`.

**Un usuario desactivado no puede nada.** Todas las reglas incluyen `@request.auth.active = true`. Dar de baja a alguien surte efecto de inmediato, sin esperar a que expire su token. Consecuencia práctica: **al crear un usuario hay que marcar `active`**, o no podrá ni leer el catálogo.

**Una regla de lista que no se cumple filtra, no rechaza.** Si un operador pide `GET /api/collections/audit_log/records`, recibe `200` con `totalItems: 0`, no un `403`. No hay fuga de datos, pero al probar reglas hay que mirar cuántos registros vuelven, no el código de estado.

### El flujo, y qué movimiento dispara cada paso

| Acción del operador | Transición | Movimiento | Efecto en los saldos |
|---|---|---|---|
| Clasifica un ítem como apto | `pending` → `available` | `entrada` | `available_qty` +n |
| Clasifica un ítem a revisión | `pending` → `quarantine` | `cuarentena` | `quarantine_qty` +n |
| Libera de cuarentena | `quarantine` → `available` | `liberar_cuarentena` | `quarantine_qty` −n, `available_qty` +n |
| Retiene a revisión | `available` → `quarantine` | `traslado_a_cuarentena` | `available_qty` −n, `quarantine_qty` +n |
| Reserva para una solicitud | reserva `activa` | `reserva` | `available_qty` −n, `reserved_qty` +n |
| Cancela la reserva | `activa` → `liberada` | `liberacion` | `reserved_qty` −n, `available_qty` +n |
| Confirma la entrega | `activa` → `consumida` | `salida` | `reserved_qty` −n |
| Corrige un saldo | ajuste creado | `ajuste_positivo` / `ajuste_negativo` | `available_qty` ±n |

---

## 6. Los hooks: la lógica de negocio

Los hooks son archivos JavaScript que PocketBase ejecuta dentro de su propio proceso. **Aquí vive todo lo que hace que AKOPIA sea AKOPIA y no una hoja de cálculo con API.**

### Cuatro reglas que no son opcionales

Estas cuatro cosas no son estilo: si las rompes, el código no funciona, y el modo en que falla es silencioso.

#### 1. El archivo debe llamarse `*.pb.js`

PocketBase solo carga `pb_hooks/**/*.pb.js`. Un archivo `mi_hook.js` es, para PocketBase, un archivo de texto cualquiera: no se carga, no da error, no aparece en el log. Simplemente no existe.

Por eso `utils/helpers.js` y `utils/config.js` **no** llevan `.pb.js`: son módulos, no hooks, y no deben auto-cargarse.

#### 2. Un handler no ve nada de fuera de su propio cuerpo

Cada handler se **serializa y se ejecuta en su propio contexto aislado**. No hay closures, no hay scope del archivo, no hay variables globales compartidas.

```js
// ❌ NO FUNCIONA — `prefix` no existe dentro del handler
const prefix = "DON-"
onRecordCreateRequest((e) => {
  e.record.set("code", prefix + "000001")   // prefix es undefined
  e.next()
}, "donations")

// ✅ Todo lo que el handler necesita, lo carga él mismo con require()
onRecordCreateRequest((e) => {
  const { CODE_PREFIXES } = require(`${__hooks}/utils/config.js`)
  const config = CODE_PREFIXES[e.collection.name]
  ...
  e.next()
}, "donations")
```

`__hooks` es una variable global de PocketBase con la ruta absoluta a `pb_hooks/`.

Esto también significa que **no se puede registrar hooks con una función auxiliar que reciba parámetros**: lo que se pase como argumento no llegará. Si varias colecciones comparten un handler, se registran juntas (`onRecordCreateRequest(fn, "a", "b", "c")`) y el handler diferencia por `e.collection.name`, con la configuración en `utils/config.js`.

#### 3. Dentro de un hook se usa `e.app`, nunca `$app`

`e.app` participa en la transacción de la petición. `$app` no. Si escribes un movimiento de inventario con `$app` y la petición falla después, el movimiento queda escrito igual y los saldos se separan de la realidad.

Por eso **todos los helpers reciben `app` como primer parámetro**, y quien los llama pasa `e.app`.

#### 4. Un solo handler cubre el «antes» y el «después»

La API antigua (≤ 0.22) tenía `onRecordBeforeCreateRequest` y `onRecordAfterCreateRequest`. **Desaparecieron en la 0.23.** Ahora hay un único hook y `e.next()` marca la frontera:

```js
onRecordUpdateRequest((e) => {
  // ANTES: e.record ya trae los datos enviados;
  //        e.record.original() trae lo que hay en disco
  const oldStatus = e.record.original().get("classification_status")

  // … validaciones; lanza BadRequestError para abortar …

  e.next()   // ← aquí se guarda

  // DESPUÉS: ya está guardado
  const newStatus = e.record.get("classification_status")
}, "donation_items")
```

Tabla de equivalencia, por si encuentras código viejo:

| API ≤ 0.22 (ya no existe) | API 0.23+ |
|---|---|
| `onRecordBeforeCreateRequest("col", fn)` | `onRecordCreateRequest(fn, "col")` — lógica **antes** de `e.next()` |
| `onRecordAfterCreateRequest("col", fn)` | `onRecordCreateRequest(fn, "col")` — lógica **después** de `e.next()` |
| `onRecordBeforeUpdateRequest("col", fn)` | `onRecordUpdateRequest(fn, "col")` |
| `onRecordAfterUpdateRequest("col", fn)` | `onRecordUpdateRequest(fn, "col")` |
| `record.getOriginal("campo")` | `record.original().get("campo")` |

Fíjate en el **orden de los argumentos**: primero el handler, después las colecciones.

### El patrón transaccional

Para que el guardado del registro y el movimiento de inventario que provoca sean atómicos, se envuelve `e.next()` en una transacción y se reapunta `e.app`:

```js
onRecordCreateRequest((e) => {
  const helpers = require(`${__hooks}/utils/helpers.js`)
  const originalApp = e.app

  try {
    e.app.runInTransaction((txApp) => {
      e.app = txApp

      // validaciones …
      e.next()
      // movimientos de inventario, con e.app (transaccional) …
    })
  } finally {
    e.app = originalApp
  }
}, "donation_items")
```

Si algo lanza después de `e.next()`, **toda la transacción se revierte**: el `donation_item` no queda creado y el movimiento tampoco. Es lo que garantiza que el libro y los saldos siempre cuenten la misma historia.

**Los errores de inventario no se silencian.** En `03_inventory.pb.js` un fallo revierte la petición y devuelve 400. En `04_audit.pb.js` sí se silencian y solo se registran en consola: perder una línea de bitácora es malo, pero rechazar una operación válida por eso es peor.

### Cómo probar un cambio en los hooks

Los hooks se recargan al guardar el archivo, pero cuando hay dudas conviene el ciclo completo:

```bash
rm -rf pb_data
./pocketbase serve
```

Y después el script de verificación, que hace exactamente esta secuencia:

1. Crear una donación sin `code` → debe llegar `DON-000001`
2. Crear un `donation_item` con `classification_status: "pending"` → `inventory` sigue vacío
3. Pasarlo a `available` → aparece un `inventory` con `available_qty` igual a la cantidad, y un `inventory_movements` de tipo `entrada`
4. Pasarlo a `quarantine` → `available_qty: 0`, `quarantine_qty: n`, movimiento `traslado_a_cuarentena`
5. Intentar cambiarle la cantidad → `400` con *«No se puede cambiar la cantidad de un artículo que ya afectó inventario»*
6. `GET /api/collections/audit_log/records` → hay registros de `create` y `status_change`

Si los seis pasos pasan, el cambio está listo para PR. En vez de hacerlos a mano:

```powershell
.\scripts\verificar.ps1              # el flujo completo
.\scripts\verificar-auditoria.ps1    # los hallazgos de la auditoría
```
```bash
./scripts/verificar.sh               # Git Bash / Linux / macOS
```

El segundo prueba un caso por cada hallazgo de [`AUDITORIA-HOOKS.md`](AUDITORIA-HOOKS.md): que un saldo sin existencias suficientes se rechace en vez de recortarse, que un rechazado no entre a disponible sin movimiento, que una reserva cerrada no se reabra, que los códigos no colisionen. **Córrelo siempre que toques los hooks** — es lo que evita que estos errores vuelvan.

---

## 6b. Rutas propias

La API REST resuelve el CRUD, pero hay operaciones que tocan varias colecciones y **tienen que ocurrir enteras o no ocurrir**. Aprobar una solicitud desde el cliente serían siete llamadas: si la cuarta falla, la solicitud queda aprobada con media reserva y el inventario comprometido a medias.

Están en [`pb_hooks/05_routes.pb.js`](pb_hooks/05_routes.pb.js), cada una envuelta en una transacción.

| Método | Ruta | Qué hace | Rol |
|---|---|---|---|
| `POST` | `/api/requests/{id}/approve` | Aprueba y reserva el inventario de todos los renglones | admin |
| `POST` | `/api/requests/{id}/reject` | Rechaza con motivo | admin |
| `POST` | `/api/requests/{id}/cancel` | Cancela y libera las reservas activas | operador |
| `GET` | `/api/requests/{id}/availability` | Qué se puede atender, antes de aprobar | operador |
| `GET` | `/api/inventory/summary` | Inventario agregado por producto, con totales | operador |
| `POST` | `/api/dispatches/{id}/confirm-delivery` | Registra la entrega y saca de bodega lo entregado | operador |

### `approve` — la que más trabajo ahorra

Comprueba **todos** los renglones antes de reservar ninguno. Reservar a medias y descubrir después que falta un producto dejaría stock comprometido para una solicitud que no se puede atender.

Si falta algo, responde `400` con el detalle:

```json
{
  "status": 400,
  "message": "Inventario insuficiente para completar la solicitud",
  "missing": [
    { "product": "Pasta (fideos)", "requested": 200, "available": 100, "shortage": 100 }
  ]
}
```

Si alcanza, crea las reservas, marca los renglones como `reservado` y devuelve la solicitud con sus reservas.

### `confirm-delivery` — cierra el ciclo

| `status` enviado | Qué pasa con las reservas | Estado de la solicitud |
|---|---|---|
| `entregado` | Se **consumen**: `salida`, la mercancía sale de bodega | `entregada` |
| `parcial` | Se consumen | `entregada` |
| `no_entregado` | Se **liberan**: `liberacion`, el stock vuelve a disponible | `cancelada` |

Lo reservado no sale físicamente hasta confirmar la entrega. Si la entrega falla, la mercancía nunca se movió: se libera la reserva, no se registra una devolución.

### Al escribir una ruta nueva

> **Los hooks de `03_inventory.pb.js` son de PETICIÓN.** No se disparan cuando una ruta guarda con `app.save()`, que va por la capa de modelo.

Por eso el efecto en inventario de cada operación vive en `utils/helpers.js` —`reserveInventory`, `closeReservation`, `applyReservationEffect`— y lo invocan **los dos caminos**: los hooks para las llamadas REST y las rutas directamente. Si escribes una ruta que mueve inventario y no llamas a esas funciones, el saldo no se actualiza y nadie te avisa.

Dos detalles más:

- **Los parámetros van entre llaves:** `/api/requests/{id}/approve`, y se leen con `e.request.pathValue("id")`. La sintaxis `:id` es de antes de la 0.23.
- **`BadRequestError` no sirve para devolver datos.** Su segundo argumento lo interpreta PocketBase como errores de validación por campo. Para responder con una estructura propia hay que usar `e.json(400, ...)`, lo que obliga a validar antes de abrir la transacción.

### Idioma en el código

- **Identificadores, nombres de archivo, comentarios y commits: en inglés.**
- **Mensajes de error que ve el usuario: en español**, porque los lee un operador de bodega, no un programador.

---

## 7. Cómo aportamos código

### Ramas

`main` siempre desplegable. Todo sale de `main` y vuelve por Pull Request.

| Prefijo | Para | Ejemplo |
|---|---|---|
| `fix/` | Corregir algo roto | `fix/hooks-no-se-cargan` |
| `feat/` | Funcionalidad nueva | `feat/seed-locations` |
| `docs/` | Documentación | `docs/contributing` |
| `chore/` | Herramientas, configuración | `chore/gitignore-windows` |

### Commits

*Conventional Commits*: `tipo(alcance): descripción en imperativo`. El cuerpo explica el **porqué**, no el **qué** — el qué ya está en el diff.

```
fix(hooks): migrate to the 0.23+ hook API and .pb.js naming

PocketBase only loads pb_hooks/**/*.pb.js, so none of the four files
were running: no codes, no inventory movements, no audit trail.
onRecordBefore/AfterCreateRequest were also removed in 0.23.
```

### El ciclo completo

```bash
git switch main
git pull origin main
git switch -c feat/seed-locations

# … trabajar; reiniciar PocketBase y probar de verdad …

git add pb_migrations/
git commit -m "feat(db): seed warehouse locations from the master catalog"
git push -u origin feat/seed-locations
gh pr create --fill
```

### Cinco reglas del repositorio

1. **Las migraciones se agregan, nunca se editan.** Una migración que ya corrió queda registrada en `_migrations` y no vuelve a ejecutarse. Editarla no cambia nada en tu base, pero sí en la de quien clone limpio: dos personas terminan con esquemas distintos y el mismo repositorio. Para cambiar algo, se agrega el número siguiente.

2. **Reserva el número antes de escribir.** Si dos ramas crean `026_…`, el merge las deja conviviendo y el orden de aplicación se vuelve azaroso. Avisa en el issue o en el chat qué número tomas.

3. **Nunca commitees estado ni binarios.** `pb_data/`, `pocketbase`, `pocketbase.exe`, `.env` y los `*.zip` están en `.gitignore`. Si `git status` te ofrece un archivo de 32 MB, algo está mal.

4. **Prueba contra una base limpia antes del PR.** `rm -rf pb_data && ./pocketbase serve`. Es la única forma de detectar una migración que solo funciona sobre *tu* base.

5. **Documenta lo que cambió el contrato.** Si tocas el esquema, las reglas de acceso o el comportamiento de un hook, actualiza este README y el `CLAUDE.md` en el mismo PR. Un cambio que el frontend no puede descubrir leyendo el repositorio es un cambio que va a romper el frontend.

### Si trabajas con un asistente de IA

Lee [`CLAUDE.md`](CLAUDE.md) — resume el contexto, el estado actual y las restricciones que no se pueden inferir del código. Las cuatro reglas de la §6 son la fuente de casi todos los errores que comete un modelo con este repositorio, porque la API de hooks de PocketBase cambió y la mayoría de los ejemplos que hay en internet son de la 0.22.

---

## 8. Estado actual y pendientes

### Funcionando y verificado

- ✅ 18 colecciones, 25 migraciones, semillas de catálogo (123 productos, 55 categorías, 20 unidades)
- ✅ Códigos correlativos `DON-`, `SOL-`, `DES-`
- ✅ Movimientos de inventario transaccionales con las tres cubetas
- ✅ Validaciones de negocio con mensajes en español
- ✅ Bitácora de auditoría sobre 8 colecciones
- ✅ Usuario de aplicación sembrado y autenticando

### Pendientes conocidos

| Pendiente | Detalle |
|---|---|
| **`locations` está vacía** | No hay migración semilla. Falta cargar el esquema `A-01-03` de la hoja `UBICACION` del catálogo maestro. Mientras tanto, `location_id` queda vacío y el inventario se lleva por producto. |
| **Campos mexicanos** | `donations.donor_rfc` debería ser NIT (el RFC es mexicano), y `deliveries.receiver_id_type` tiene valores `["ine","pasaporte","credencial","otro"]` cuando en Colombia serían cédula, cédula de extranjería y tarjeta de identidad. Corregir **antes** de capturar datos reales: ahora cuesta una migración, después cuesta una migración de datos. |
| **No hay lotes ni vencimiento** | `products` trae `requires_batch` y `requires_expiry`, pero no existe la colección `inventory_batches`. Lotes, fechas de caducidad y regla FEFO están sin implementar. Para un acopio de alimentos es la decisión más costosa de postergar. |
| **`generateSequenceCode` tiene una carrera** | Lee el último código y suma uno, sin bloqueo. Dos donaciones simultáneas piden el mismo número; el índice único de `donations.code` hace que la segunda falle con 400 en vez de duplicar. Tolerable con un operador a la vez; conviene reintentar o pasar a un contador atómico. |
| **`023_seed_initial_superuser.js` está mal nombrada** | No crea un superusuario de PocketBase: crea un registro en `users`. El nombre no se cambia porque la migración ya corrió en varias máquinas. |
| **Movimientos exigen operador autenticado** | Un `donation_item` que afecta inventario necesita `e.auth` con un registro de `users`. Crear uno desde el panel `/_/` con un superusuario devuelve 400. Es deliberado: sin operador no hay a quién atribuir el movimiento. |

### Decisiones abiertas

- **Unidades múltiples.** El catálogo permite `KG|G` para el arroz, pero `donation_items` exige que la unidad coincida con `default_unit_id`. Se resolvió por la vía estricta: una unidad por producto, con conversión a mano al recibir. Falta confirmar que a la bodega le sirve.
- **Registro público.** La maqueta del frontend ofrece `/registro`, pero `users.createRule` es `@request.auth.role = 'admin'`. Para un centro con operadores acreditados probablemente lo correcto sea quitar esa pantalla.

---

## 9. Solución de problemas

| Síntoma | Causa y solución |
|---|---|
| `400 validation_required` en `code` al crear una donación | Los hooks no están cargando. Verifica que los archivos terminen en `.pb.js` y que la versión sea 0.39.11. |
| El servidor arranca pero un hook "no hace nada" | Casi siempre es un handler que intenta usar una variable de fuera de su cuerpo (§6, regla 2). Se manifiesta como `undefined`, no como error. |
| `Cannot be blank` en `available_qty` al mover inventario | Falta la migración `025`. PocketBase trata `0` como vacío en un `NumberField` requerido. Haz `git pull` y reinicia. |
| `Failed to find all relation records` en `operator_id` | El id que enviaste no existe en `users`. Usa el `record.id` que devuelve `auth-with-password`. |
| La contraseña de `admin@akopia.org` no funciona | La migración `023` solo corre una vez. Cambiar `.env` después no cambia nada: usa el panel o borra `pb_data`. Revisa también que no hayas copiado comillas tipográficas. |
| `git status` ofrece un archivo de 32 MB | Es `pocketbase.exe`. Haz `git pull` para traer el `.gitignore` corregido. |
| Corrupción rara de `pb_data` o de `.git` | ¿El repositorio está dentro de una carpeta de Google Drive u OneDrive? Muévelo a una ruta local. |
| Un usuario recién creado no ve nada, ni el catálogo | Le falta `active`. Todas las reglas exigen `@request.auth.active = true`. |
| `validation_values_mismatch` en `verified` al crear un usuario | `verified` no se puede fijar por API. Créalo sin ese campo, o márcalo desde el panel. |
| `403` al escribir en `inventory` o `inventory_movements` | Es deliberado: solo los hooks los escriben. Para corregir un saldo, crea un `adjustments`. |

---

## Documentos relacionados

- [`CLAUDE.md`](CLAUDE.md) — contexto del proyecto y bitácora de avances
- [Documentación de PocketBase](https://pocketbase.io/docs/)
- [Guía de hooks JS](https://pocketbase.io/docs/js-overview/) y [hooks de eventos](https://pocketbase.io/docs/js-event-hooks/)
- [Frontend](https://github.com/fcenwebunal/akopia-frontend)
