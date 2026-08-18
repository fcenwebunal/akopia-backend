# Despliegue provisional — Fly.io + Vercel

**Por qué existe este documento:** OTIC (Carlos) no ha respondido con el acceso al servidor de la UNAL, y el aplicativo tiene que estar en producción recolectando datos. Decisión de Juan Manuel (18 ago 2026): desplegar de forma **provisional** en hosting público, y migrar a `172.23.177.12` (`DESPLIEGUE.md`) en cuanto haya VPN. Nada de lo que sigue es definitivo — es para hoy.

| | |
|---|---|
| **Backend** (PocketBase) | Fly.io — proceso y disco persistentes, algo que Vercel no ofrece |
| **Frontend** (Next.js) | Vercel |

Los archivos que hacen falta ya están en este repositorio: [`Dockerfile`](Dockerfile), [`.dockerignore`](.dockerignore), [`fly.toml`](fly.toml).

---

## Parte 1 — Backend en Fly.io

### 1. Instalar `flyctl`

PowerShell:

```powershell
pwsh -Command "iwr https://fly.io/install.ps1 -useb | iex"
```

Si no tienes `pwsh` (PowerShell 7), el mismo comando funciona igual en Windows PowerShell 5.1 quitando el `pwsh -Command`:

```powershell
iwr https://fly.io/install.ps1 -useb | iex
```

Cierra y vuelve a abrir la terminal para que `fly` quede en el `PATH`.

### 2. Crear cuenta e iniciar sesión

```powershell
fly auth signup
```

(o `fly auth login` si ya tienes cuenta). Fly pide una tarjeta al activar la cuenta, incluso para el uso gratuito — es su verificación anti-abuso. Una máquina pequeña como esta debería mantenerse dentro del uso gratuito, pero confírmalo en su panel de facturación una vez dentro; los precios no los fija este documento.

### 3. Lanzar la app (sin desplegar todavía)

Desde `akopia-backend/`:

```powershell
fly launch --no-deploy
```

Va a preguntar:
- **Nombre de la app** — el que quieras (queda en `<nombre>.fly.dev`). Si `akopia-backend` ya está tomado por otra cuenta, prueba `akopia-backend-unal`.
- **Región** — `bog` (Bogotá) si aparece disponible; si no, `mia` (Miami) es la alternativa más cercana.
- **¿Postgres/Redis?** — No a ambas. Ya tenemos SQLite propio.
- Detecta el `Dockerfile` solo.

Esto reescribe `fly.toml` con el nombre y región reales. Revisa que conserve: un volumen montado en `/pb/pb_data`, `min_machines_running = 1`, y **una sola máquina** (nunca actives autoescalado horizontal — SQLite no admite dos procesos escribiendo el mismo archivo).

### 4. Crear el volumen persistente

```powershell
fly volumes create akopia_data --region bog --size 1
```

(`--region` con la misma que confirmaste en el paso 3; `--size 1` es 1 GB, de sobra para empezar — se amplía después con `fly volumes extend` si hace falta, sin perder datos).

### 5. Configurar la contraseña del admin inicial

Es la misma variable que ya conoces de `.env` local — sin ella, la migración `023` bloquea el arranque a propósito:

```powershell
fly secrets set AKOPIA_INITIAL_ADMIN_PASSWORD="la-misma-que-tienes-en-tu-.env-local-o-una-nueva"
```

### 6. Desplegar

```powershell
fly deploy
```

### 7. Verificar

```powershell
fly status
```

Y en el navegador: `https://<tu-app>.fly.dev/api/health` debe responder `{"message":"API is healthy."...}`.

### 8. Crear el superusuario de servicio (para el puente de Firebase del frontend)

El frontend necesita un superusuario real de PocketBase para `/api/auth/firebase` — el mismo mecanismo que ya usas en local, reutilizando el correo `admin@akopia.org` (ver el `CLAUDE.md` del frontend, entrada del 18 de agosto sobre esta desviación deliberada).

```powershell
fly ssh console
```

Ya dentro del contenedor:

```sh
/pb/pocketbase superuser upsert admin@akopia.org
```

Te va a pedir la contraseña por stdin — usa **exactamente** la misma que tienes guardada como `POCKETBASE_SERVICE_PASSWORD` en el `.env.local` del frontend. Si no coinciden, el puente de Firebase responde con un 500 genérico sin pista de la causa (ya documentado como riesgo conocido).

### 9. (Recomendado) Tu propio superusuario para entrar a `/_/`

Mismo comando del paso 8, con tu correo y una contraseña tuya, distinta de la de servicio:

```sh
/pb/pocketbase superuser upsert tu-correo@ejemplo.com
```

`exit` para salir del contenedor.

> ⚠️ **A diferencia del plan para el VPS de la UNAL** (`DESPLIEGUE.md`, donde `/_/` se pensaba restringir por IP o túnel SSH), en este despliegue provisional `/_/` queda alcanzable desde cualquier lugar de internet — Fly no tiene, out of the box, el equivalente a "solo dentro de la red del campus". Usa una contraseña fuerte para tu superusuario personal. Cuando se migre al servidor definitivo, se retoma la restricción real.

---

## Parte 2 — Frontend en Vercel

### 1. Crear cuenta / iniciar sesión en [vercel.com](https://vercel.com)

Con GitHub es lo más simple — el repo `fcenwebunal/akopia-frontend` es público, así que se importa directo sin dar permisos especiales.

### 2. Importar el proyecto

**Add New → Project** → selecciona `fcenwebunal/akopia-frontend`. Vercel detecta Next.js solo; deja **Root Directory** vacío (la raíz del repo ya es el proyecto).

### 3. Variables de entorno

Antes de darle a Deploy (o después, en **Settings → Environment Variables** — cualquiera de los dos momentos sirve, pero sin esto el build no funciona de verdad):

| Variable | Valor |
|---|---|
| `NEXT_PUBLIC_PB_URL` | `https://<tu-app>.fly.dev` (la de la Parte 1, sin `/` al final) |
| `NEXT_PUBLIC_FIREBASE_API_KEY` | igual que en tu `.env.local` |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | igual que en tu `.env.local` |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | igual que en tu `.env.local` |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` | igual que en tu `.env.local` |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | igual que en tu `.env.local` |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | igual que en tu `.env.local` |
| `NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID` | igual que en tu `.env.local` |
| `POCKETBASE_SERVICE_EMAIL` | `admin@akopia.org` |
| `POCKETBASE_SERVICE_PASSWORD` | la misma que usaste en el paso 8 de la Parte 1 |
| `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME` | igual que en tu `.env.local` |
| `CLOUDINARY_API_KEY` | igual que en tu `.env.local` |
| `CLOUDINARY_API_SECRET` | igual que en tu `.env.local` |

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
