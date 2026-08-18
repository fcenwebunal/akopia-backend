# Despliegue provisional — Railway + Vercel

**Por qué existe este documento:** OTIC (Carlos) no ha respondido con el acceso al servidor de la UNAL, y el aplicativo tiene que estar en producción recolectando datos. Decisión de Juan Manuel (18 ago 2026): desplegar de forma **provisional** en hosting público, y migrar a `172.23.177.12` (`DESPLIEGUE.md`) en cuanto haya VPN. Nada de lo que sigue es definitivo — es para hoy.

**Por qué Railway y no Fly.io:** se intentó primero con Fly.io (queda documentado como alternativa al final, por si algún día una tarjeta sí pasa su verificación) — la tarjeta de Juan Manuel, incluida una virtual nueva, fue rechazada dos veces en la verificación de Fly. Railway no pidió tarjeta para el plan de prueba de 30 días que Juan Manuel ya tenía activo, así que es el camino que de verdad se pudo recorrer hoy.

|                                |                                                                   |
| ------------------------------ | ----------------------------------------------------------------- |
| **Backend** (PocketBase) | Railway — proceso y disco persistentes, algo que Vercel no ofrece |
| **Frontend** (Next.js)   | Vercel                                                            |

Los archivos que hacen falta ya están en este repositorio: [`Dockerfile`](Dockerfile), [`docker-entrypoint.sh`](docker-entrypoint.sh), [`.dockerignore`](.dockerignore), [`railway.toml`](railway.toml).

**El mismo `Dockerfile` sirve para los dos hostings** — no hace falta nada específico de Railway más allá de `railway.toml` (opcional, solo mejora cómo Railway detecta que el despliegue quedó listo). `docker-entrypoint.sh` es lo que hace posible saltarse la consola/shell del hosting por completo: si le pasas las variables correctas, crea los superusuarios de PocketBase que hacen falta apenas arranca el contenedor, cada vez — no hay que entrar a ningún lado a teclear un comando.

---

## Parte 1 — Backend en Railway

### 1. Entra a [railway.app](https://railway.app) e inicia sesión

Con la cuenta donde ya tienes el plan de prueba activo. GitHub como método de inicio de sesión es lo más simple: además de crear la cuenta, deja lista la conexión que hace falta para el paso siguiente.

### 2. Crear el proyecto desde este repositorio

**New Project → Deploy from GitHub repo** → busca y selecciona `fcenwebunal/akopia-backend`. Si es la primera vez, Railway va a pedir autorizar su GitHub App — puedes darle acceso solo a este repositorio, no hace falta autorizar toda la cuenta.

Railway detecta el `Dockerfile` solo y arranca el build. Puede tardar uno o dos minutos la primera vez (descarga el binario de PocketBase dentro del build, igual que en la prueba local).

### 3. Variables de entorno

En el servicio recién creado → pestaña **Variables** → agrega:

| Variable | Valor |
|---|---|
| `AKOPIA_INITIAL_ADMIN_PASSWORD` | la misma que tienes en `akopia-backend/.env` local, o una nueva |
| `SERVICE_SUPERUSER_EMAIL` | `admin@akopia.org` |
| `SERVICE_SUPERUSER_PASSWORD` | la misma que tienes guardada como `POCKETBASE_SERVICE_PASSWORD` en `akopia-frontend/.env.local` — **tiene que coincidir exactamente**, o el puente de Firebase del frontend responde con un 500 genérico sin pista de la causa |
| `PERSONAL_SUPERUSER_EMAIL` *(opcional)* | tu correo, para poder entrar a `/_/` |
| `PERSONAL_SUPERUSER_PASSWORD` *(opcional)* | una contraseña tuya, distinta de la de servicio |

`docker-entrypoint.sh` crea esos superusuarios solo, cada vez que el contenedor arranca — no hace falta abrir ninguna consola.

### 4. Volumen persistente

**Settings → Volumes → New Volume**. Ruta de montaje: `/pb/pb_data`. Sin esto, cada redeploy borra la base — Railway reconstruye el contenedor desde cero en cada uno, y solo lo que está en un volumen sobrevive.

### 5. Dominio público

**Settings → Networking → Generate Domain**. Da un dominio `https://<algo>.up.railway.app`, con HTTPS ya resuelto — nada que configurar.

### 6. Redeploy y verificar

Si agregaste el volumen o las variables después del primer build, Railway normalmente redespliega solo; si no, **Deployments → ⋮ → Redeploy** en el último. Luego:

```powershell
curl https://<tu-dominio>.up.railway.app/api/health
```

Debe responder `{"message":"API is healthy."...}`. Revisa también los **Logs** del servicio: deberías ver las dos líneas de `docker-entrypoint.sh` confirmando los superusuarios (`Successfully saved superuser "..."`) antes de la línea de `Server started`.

> ⚠️ **A diferencia del plan para el VPS de la UNAL** (`DESPLIEGUE.md`, donde `/_/` se pensaba restringir por IP o túnel SSH), en este despliegue provisional `/_/` queda alcanzable desde cualquier lugar de internet. Usa una contraseña fuerte para tu superusuario personal. Cuando se migre al servidor definitivo, se retoma la restricción real.

---

## Parte 2 — Frontend en Vercel

### 1. Crear cuenta / iniciar sesión en [vercel.com](https://vercel.com)

Con GitHub es lo más simple — el repo `fcenwebunal/akopia-frontend` es público, así que se importa directo sin dar permisos especiales.

### 2. Importar el proyecto

**Add New → Project** → selecciona `fcenwebunal/akopia-frontend`. Vercel detecta Next.js solo; deja **Root Directory** vacío (la raíz del repo ya es el proyecto).

### 3. Variables de entorno

Antes de darle a Deploy (o después, en **Settings → Environment Variables** — cualquiera de los dos momentos sirve, pero sin esto el build no funciona de verdad):

| Variable                                     | Valor                                                               |
| --------------------------------------------- | ------------------------------------------------------------------- |
| `NEXT_PUBLIC_PB_URL`                       | `https://<tu-dominio>.up.railway.app` (la de la Parte 1, sin `/` al final) |
| `NEXT_PUBLIC_FIREBASE_API_KEY`             | igual que en tu `.env.local`                                       |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`         | igual que en tu `.env.local`                                       |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID`          | igual que en tu `.env.local`                                       |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`      | igual que en tu `.env.local`                                       |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | igual que en tu `.env.local`                                       |
| `NEXT_PUBLIC_FIREBASE_APP_ID`              | igual que en tu `.env.local`                                       |
| `NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID`      | igual que en tu `.env.local`                                       |
| `POCKETBASE_SERVICE_EMAIL`                 | `admin@akopia.org`                                                |
| `POCKETBASE_SERVICE_PASSWORD`              | la misma que pusiste en `SERVICE_SUPERUSER_PASSWORD` en la Parte 1  |
| `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME`        | igual que en tu `.env.local`                                       |
| `CLOUDINARY_API_KEY`                       | igual que en tu `.env.local`                                       |
| `CLOUDINARY_API_SECRET`                    | igual que en tu `.env.local`                                       |

Todos los valores ya los tienes en `akopia-frontend/.env.local` (nunca se commitea, pero está en tu máquina) — es copiar y pegar cada uno.

### 4. Deploy

Dale a **Deploy**. Vercel construye y publica en un dominio `<proyecto>.vercel.app`.

---

## Parte 3 — Ajustes cruzados, después de que los dos estén arriba

### 1. Dominios autorizados en Firebase

Solo si vas a usar "Continuar con Google" (el login con correo y contraseña no lo necesita): en la [consola de Firebase](https://console.firebase.google.com) → Authentication → Settings → **Authorized domains**, agrega el dominio de Vercel (`<proyecto>.vercel.app`). Sin esto, Google Sign-In falla con `auth/unauthorized-domain` desde ese dominio — mismo síntoma ya documentado para una IP de red local, causa distinta.

### 2. Probar el ciclo completo en producción real

Login, panel, una donación de prueba, clasificar, ver el inventario moverse — el mismo criterio de "funcionando" que ya define este proyecto. No asumas que porque compiló ya sirve.

### 3. Primer respaldo

En cuanto quede en pie, entra a `/panel/respaldos` y crea el primero — es el punto de partida limpio de este despliegue, y el archivo que vas a necesitar el día que se migre al servidor definitivo.

---

## Parte 4 — Cuando llegue el acceso a la UNAL

La migración sigue el mismo camino que ya documenta `DESPLIEGUE.md`: un respaldo de PocketBase (`Settings → Backups` en `/_/`, o `/panel/respaldos` en la app) es portable a cualquier instancia nueva, sin importar en qué hosting vivió mientras tanto.

---

## Alternativa — Fly.io (si consigues una tarjeta que sí pase)

El mismo `Dockerfile` funciona sin cambios; solo hace falta `fly.toml`, ya en este repositorio.

1. Instalar `flyctl` (⚠️ el comando se llama `flyctl`, no `fly` — el instalador no deja ningún `fly.exe`, confirmado en una instalación real):
   ```powershell
   iwr https://fly.io/install.ps1 -useb | iex
   ```
   Cierra y abre una terminal nueva para que el `PATH` quede activo.
2. `flyctl auth signup` (pide tarjeta, aunque el uso se quede en el nivel gratuito — es su verificación anti-abuso).
3. Desde `akopia-backend/`: `flyctl launch --no-deploy` — nombre de app, región `bog` (Bogotá) o `mia` (Miami) si `bog` no aparece, sin Postgres/Redis.
4. `flyctl volumes create akopia_data --region bog --size 1`
5. `flyctl secrets set AKOPIA_INITIAL_ADMIN_PASSWORD="..." SERVICE_SUPERUSER_EMAIL="admin@akopia.org" SERVICE_SUPERUSER_PASSWORD="..." PERSONAL_SUPERUSER_EMAIL="tu-correo" PERSONAL_SUPERUSER_PASSWORD="..."` — con `docker-entrypoint.sh` ya no hace falta `flyctl ssh console` para crear los superusuarios: se crean solos al arrancar, igual que en Railway.
6. `flyctl deploy`
7. Verificar: `flyctl status`, y `https://<tu-app>.fly.dev/api/health` en el navegador.

El resto (Parte 2, 3 y 4 de arriba) es idéntico, cambiando la URL de `NEXT_PUBLIC_PB_URL` por la de `.fly.dev`.
