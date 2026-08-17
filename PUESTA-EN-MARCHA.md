# Puesta en marcha — AKOPIA completo

**De cero a los dos servicios hablando entre sí, en unos 15 minutos.**

Esta guía cubre **el sistema entero**: backend y frontend juntos. Si solo vas a tocar el backend, igual necesitas el frontend levantado para ver lo que haces; y al revés. Existe una copia gemela de este documento en el [repositorio del frontend](https://github.com/fcenwebunal/akopia-frontend/blob/main/PUESTA-EN-MARCHA.md).

Para el detalle de cada repositorio —modelo de datos, hooks, identidad visual, cómo aportar código— ve al [README](README.md).

---

## 1. Qué vas a levantar

Dos procesos y un archivo. No hay Docker, no hay base de datos que instalar, no hay servicios en la nube.

```
    ┌─────────────┐
    │  Navegador  │
    └──────┬──────┘
           │  http://localhost:3000
           ▼
    ┌──────────────────────────────┐
    │  Frontend — Next.js          │   akopia-frontend
    │  puerto 3000                 │   npm run dev
    └──────┬───────────────────────┘
           │  NEXT_PUBLIC_PB_URL
           │  http://127.0.0.1:8090
           ▼
    ┌──────────────────────────────┐
    │  Backend — PocketBase        │   akopia-backend
    │  puerto 8090                 │   ./pocketbase serve
    │                              │
    │  ├─ /api/    API REST        │
    │  ├─ /_/      panel admin     │
    │  ├─ pb_hooks/  lógica JS     │
    │  └─ pb_data/   SQLite ───────┼──▶ el estado, en disco
    └──────────────────────────────┘
```

**Dato clave:** el navegador habla con los dos. Descarga la página de `:3000` y desde ahí llama directamente a `:8090`. El frontend **no** hace de intermediario; no hay proxy en desarrollo.

| Proceso | Puerto | Qué pasa si no está |
|---|---|---|
| PocketBase | 8090 | La web carga, pero no puedes entrar: *«No se pudo conectar con el servidor»* |
| Next.js | 3000 | No hay web. La API sigue respondiendo a `curl` y el panel `/_/` funciona |

---

## 2. Requisitos

| | Comprobar con | Mínimo |
|---|---|---|
| git | `git --version` | cualquiera reciente |
| Node.js | `node --version` | **20 o superior** |
| PocketBase | se descarga en el paso 3 | **exactamente 0.39.11** |

> ⚠️ **No clones dentro de `G:\Mi unidad\`, OneDrive ni Dropbox.** Sincronizan archivo por archivo y corrompen tanto `.git/` como el `pb_data/*.db` que el servidor mantiene abierto, y `node_modules/` de paso. Usa una ruta local, por ejemplo `D:\Sistema\Carpetas\Programacion\WEB\AKOPIA\`.

Los dos repositorios van **uno al lado del otro**, en la misma carpeta madre:

```
AKOPIA/
├── akopia-backend/
└── akopia-frontend/
```

No es obligatorio, pero el generador de tipos (§7) asume esa vecindad.

---

## 3. Backend

### 3.1 Clonar

```bash
git clone https://github.com/fcenwebunal/akopia-backend.git
cd akopia-backend
```

### 3.2 Descargar PocketBase 0.39.11

El binario **no está en el repositorio**: cada quien descarga el suyo. La versión importa, porque la API de hooks cambió en la 0.23.

**Windows (PowerShell)**
```powershell
curl.exe -L -o pb.zip https://github.com/pocketbase/pocketbase/releases/download/v0.39.11/pocketbase_0.39.11_windows_amd64.zip
Expand-Archive -Path pb.zip -DestinationPath . -Force
Remove-Item pb.zip
.\pocketbase.exe --version
```

> En Windows, `tar -xf` **no** sirve para este zip aunque exista el comando. Usa `Expand-Archive`.

**Linux / macOS**
```bash
curl -L -o pb.zip https://github.com/pocketbase/pocketbase/releases/download/v0.39.11/pocketbase_0.39.11_linux_amd64.zip
unzip pb.zip && rm pb.zip CHANGELOG.md LICENSE.md
chmod +x pocketbase
./pocketbase --version
```

Debe imprimir `pocketbase version 0.39.11`.

### 3.3 Poner la contraseña inicial

```bash
cp .env.example .env
```

Abre `.env` y escribe una contraseña larga:

```bash
AKOPIA_INITIAL_ADMIN_PASSWORD=UnaClaveLargaSoloParaLocal
```

> ⚠️ **Escríbela a mano, no la copies de WhatsApp.** Las comillas tipográficas (`‘ ’`) no son comillas para el shell: pasan a formar parte de la contraseña, y después nadie logra entrar sin ningún mensaje que lo explique.

`.env` está en `.gitignore` y no se commitea.

### 3.4 Arrancar

**Windows (PowerShell)**
```powershell
$env:AKOPIA_INITIAL_ADMIN_PASSWORD = "UnaClaveLargaSoloParaLocal"
.\pocketbase.exe serve
```

**Git Bash / Linux / macOS**
```bash
set -a; . ./.env; set +a
./pocketbase serve
```

`serve` aplica las migraciones pendientes antes de escuchar. No hace falta `migrate up` por separado.

**Deja esta terminal abierta.** El servidor corre en primer plano.

### 3.5 Crear tu superusuario del panel

El arranque imprime algo así:

```
Server started at http://127.0.0.1:8090
├─ REST API:  http://127.0.0.1:8090/api/
└─ Dashboard: http://127.0.0.1:8090/_/

(!) Launch the URL below ... to create your first superuser account:
http://127.0.0.1:8090/_/#/pbinstall/eyJhbGciOi...
```

Abre ese último enlace y crea **tu** superusuario con tu propio correo.

> ### Hay DOS identidades y confundirlas cuesta media tarde
>
> | | `admin@akopia.org` | Tu superusuario |
> |---|---|---|
> | **Vive en** | Colección `users` | Tabla interna `_superusers` |
> | **Sirve para** | Login de la app, consumir la API | Entrar al panel `/_/` |
> | **Sale de** | Migración `023` + tu `.env` | El enlace `#/pbinstall/...` |
> | **Se comparte** | Sí, es del proyecto | No, es personal y local |
>
> `admin@akopia.org` **no entra al panel**. Tu superusuario **no entra a la app**.

### 3.6 Comprobar el backend solo

En **otra** terminal:

```bash
curl -X POST http://127.0.0.1:8090/api/collections/users/auth-with-password \
  -H "Content-Type: application/json" \
  -d '{"identity":"admin@akopia.org","password":"UnaClaveLargaSoloParaLocal"}'
```

Debe devolver un `token` y un registro con `"role":"admin"` y `"active":true`.

| Petición (con el token en `Authorization`) | Esperado |
|---|---|
| `GET /api/collections/products/records` | `totalItems: 123` |
| `GET /api/collections/units/records` | `totalItems: 20` |
| `GET /api/collections/categories/records` | `totalItems: 55` |
| `GET /api/collections/locations/records` | `totalItems: 0` ← correcto hoy, aún no hay semilla |

---

## 4. Frontend

En una **segunda terminal**, dejando el backend corriendo en la primera.

### 4.1 Clonar e instalar

```bash
cd ..                       # volver a la carpeta madre
git clone https://github.com/fcenwebunal/akopia-frontend.git
cd akopia-frontend
npm install
```

### 4.2 Apuntar al backend

```bash
cp .env.example .env.local
```

El contenido por defecto ya sirve para desarrollo:

```bash
NEXT_PUBLIC_PB_URL=http://127.0.0.1:8090
```

> Las variables `NEXT_PUBLIC_*` **se incrustan en el build**. Si cambias este archivo, reinicia `npm run dev` o el cambio no surte efecto.

### 4.3 Arrancar

```bash
npm run dev
```

La web queda en **http://localhost:3000**.

---

## 5. La comprobación conjunta

Con los dos procesos arriba, seis pruebas. Si las seis pasan, el sistema está bien conectado.

| # | Qué hacer | Qué debe pasar |
|---|---|---|
| 1 | Abrir `http://localhost:3000` | Carga la portada con el escudo de la UNAL, el verde institucional y la tipografía Ancízar. **Si las letras se ven genéricas**, las fuentes no cargaron |
| 2 | Ir a `/login` | Formulario con «Correo institucional» y «Contraseña» |
| 3 | Entrar con `admin@akopia.org` y tu contraseña de `.env` | Autentica. Si responde *«No se pudo conectar con el servidor»*, el backend no está corriendo o la URL apunta a otro lado |
| 4 | Abrir `http://127.0.0.1:8090/_/` y entrar con **tu superusuario** | Se ve el panel con las 18 colecciones |
| 5 | En el panel, abrir `products` | 123 registros |
| 6 | La prueba de los hooks (abajo) | Devuelve `DON-000001` |

### La prueba de los hooks

Es la que separa un backend que funciona de un CRUD crudo. Crea una donación **sin** enviar `code`:

```bash
# 1. Autenticarse y guardar el token y el id
curl -s -X POST http://127.0.0.1:8090/api/collections/users/auth-with-password \
  -H "Content-Type: application/json" \
  -d '{"identity":"admin@akopia.org","password":"TU_CLAVE"}'

# 2. Con el token y el record.id de la respuesta anterior:
curl -X POST http://127.0.0.1:8090/api/collections/donations/records \
  -H "Content-Type: application/json" \
  -H "Authorization: EL_TOKEN" \
  -d '{"donor_type":"individual","donor_name":"Prueba",
       "receipt_date":"2026-08-17 10:00:00.000Z","operator_id":"EL_RECORD_ID"}'
```

✅ **Correcto:** la respuesta trae `"code":"DON-000001"` — el servidor lo generó solo.
❌ **Los hooks no cargan:** `400` con `{"code":{"code":"validation_required","message":"Cannot be blank."}}`.

Si falla, revisa que los archivos de `pb_hooks/` terminen en `.pb.js` y que la versión sea 0.39.11.

---

## 6. Cómo se conectan realmente

Tres cosas explican el 90 % de los problemas de integración.

### La URL nunca se escribe en el código

Todo pasa por `NEXT_PUBLIC_PB_URL`, porque el mismo build tiene que servir en tres sitios:

| Entorno | Valor |
|---|---|
| Local | `http://127.0.0.1:8090` |
| Ubuntu de pruebas | `http://IP-DEL-UBUNTU` |
| UNAL | `https://acopio.manizales.unal.edu.co` |

Si ves una URL literal en un `.tsx`, es un bug.

### CORS: en desarrollo funciona solo; en producción no existe

PocketBase responde con `Access-Control-Allow-Origin: *`, así que el navegador en `localhost:3000` puede llamar a `127.0.0.1:8090` sin configurar nada.

En producción **no hay CORS en absoluto**, porque nginx sirve las dos cosas bajo el mismo dominio: `/api/` y `/_/` van al backend, todo lo demás al frontend. Mismo origen, sin preflight.

### La sesión vive en el navegador

El SDK guarda el token en `pb.authStore` (localStorage) y lo renueva solo. Consecuencia práctica: **un componente de servidor de Next no ve la sesión** a menos que le pases la cookie de auth explícitamente en cada petición. Si una pantalla necesita datos autenticados, o es componente de cliente, o reenvía la cookie a mano. Es donde más se tropieza al integrar Next con PocketBase.

---

## 7. El ciclo de trabajo diario

### Arrancar

```bash
# Terminal 1
cd akopia-backend
set -a; . ./.env; set +a && ./pocketbase serve

# Terminal 2
cd akopia-frontend && npm run dev
```

### Después de cada `git pull`

| Repositorio | Qué hacer |
|---|---|
| Backend | **Reiniciar el servidor.** Las migraciones nuevas se aplican solas al arrancar |
| Frontend | `npm install` si cambió `package.json`. Next recarga el resto solo |

### Al cambiar un hook

Se recargan al guardar el archivo. Cuando haya dudas, el ciclo completo:

```bash
rm -rf pb_data && ./pocketbase serve
```

Borrar `pb_data` es **seguro y reversible**: PocketBase reconstruye todo desde `pb_migrations/` en segundos. Pierdes los datos de prueba, nada más.

### Regenerar los tipos de TypeScript

Con el backend clonado al lado, desde `akopia-frontend`:

```bash
npx pocketbase-typegen --db ../akopia-backend/pb_data/data.db --out ./src/types/pb.ts
```

Así un cambio de esquema rompe la compilación del frontend en vez de romperse en producción.

---

## 8. Diagnóstico por síntoma

| Síntoma | Causa y solución |
|---|---|
| *«No se pudo conectar con el servidor»* al entrar | PocketBase no está corriendo, o `NEXT_PUBLIC_PB_URL` apunta a otro puerto |
| El login responde 400 | Contraseña incorrecta. ¿Copiaste comillas tipográficas al `.env`? |
| `Failed to find all relation records` en `operator_id` | El id enviado no existe en `users`. Usa el `record.id` que devuelve `auth-with-password`, no el correo |
| `400 validation_required` en `code` | Los hooks no cargan: revisa la extensión `.pb.js` y la versión de PocketBase |
| `Cannot be blank` en `available_qty` | Falta la migración `025`. `git pull` y reinicia el servidor |
| La contraseña de `admin@akopia.org` no cambia | La migración `023` corre **una sola vez**. Cambia la clave desde el panel, o borra `pb_data` y siembra de nuevo |
| Un hook «no hace nada», sin error | Casi siempre es un handler usando una variable de fuera de su cuerpo. Cada handler corre aislado: todo se carga con `require()`. Ver [README §6](README.md#6-los-hooks-la-lógica-de-negocio) |
| La tipografía se ve genérica | Faltan los `.woff2` en `src/fonts/` del frontend |
| Cambios en `.env.local` sin efecto | `NEXT_PUBLIC_*` se incrusta en el build: reinicia `npm run dev` |
| `git status` ofrece un archivo de 32 MB | Es `pocketbase.exe`. Haz `git pull` para traer el `.gitignore` corregido |
| Puerto 8090 o 3000 ocupado | Otra instancia quedó viva. Windows: `taskkill /F /IM pocketbase.exe` o `/IM node.exe` |
| Corrupción rara de `.git`, `pb_data` o `node_modules` | ¿El repositorio está en Google Drive u OneDrive? Muévelo a una ruta local |

---

## 9. Empezar de cero

Cuando algo se enreda y quieres el estado limpio sin volver a clonar:

```bash
# Backend — borra la base; el esquema y los datos semilla se reconstruyen
cd akopia-backend
rm -rf pb_data              # Windows CMD: rmdir /s /q pb_data
./pocketbase serve          # vuelve a crear todo, incluido admin@akopia.org

# Frontend — borra dependencias y caché de build
cd ../akopia-frontend
rm -rf node_modules .next
npm install
npm run dev
```

Después de borrar `pb_data` tendrás que **crear tu superusuario del panel otra vez** (paso 3.5): vivía en esa base.

---

## Siguiente paso

- [README del backend](README.md) — modelo de datos, hooks y cómo aportar código
- [README del frontend](https://github.com/fcenwebunal/akopia-frontend#readme) — identidad visual y estructura de pantallas
- [`CLAUDE.md`](CLAUDE.md) — contexto, decisiones y bitácora
