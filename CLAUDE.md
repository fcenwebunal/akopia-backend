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
