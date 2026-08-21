# Despliegue en el servidor de la UNAL

Guía para poner AKOPIA en el servidor que asignó la Oficina de Tecnologías de la Información y las Comunicaciones (OTIC), sede Manizales.

| | |
|---|---|
| **Servidor** | `172.23.177.12` |
| **Usuario** | `juan` |
| **Contacto OTIC** | Carlos |
| **Responsable** | `judiazgom` · judiazgom@unal.edu.co |

> ⚠️ **Las credenciales no van en este repositorio.** La contraseña que envió OTIC viajó por correo en texto plano: cámbiala en el primer ingreso (§2) y guárdala en un gestor de contraseñas, nunca en un archivo del proyecto.

---

## 0. Antes de tocar nada: la VPN

`172.23.177.12` es una **dirección privada** (rango `172.16.0.0/12`). No existe fuera de la red de la Universidad: desde tu casa, sin VPN, no responde a nada — ni SSH, ni ping, ni navegador. No es que el servidor esté caído.

Tienes dos formas de llegar:

1. **Desde la red del campus**, cableada o WiFi institucional. Sirve para empezar hoy mismo si estás en la sede.
2. **Por VPN**, desde cualquier lado. Es lo que hay que gestionar.

### La VPN: FortiClient

**Confirmado por OTIC (Carlos, 17 ago 2026):** el cliente es **FortiClient**, y él acompaña la configuración una vez esté instalado. La versión exacta se solicita en el hilo del correo — **conviene pedirla en vez de bajar la última**, porque el cliente tiene que ser compatible con el firmware del concentrador FortiGate.

#### Instalar FortiClient en Windows

> ⚠️ **Descárgalo solo de `fortinet.com`.** FortiClient es de los instaladores más suplantados en sitios agregadores de descargas: buscarlo en Google y hacer clic en el primer resultado es una forma conocida de terminar con un troyano. Si Carlos te manda el instalador directamente, usa ese.

1. Ve a [fortinet.com/support/product-downloads](https://www.fortinet.com/support/product-downloads).
2. Busca la sección **FortiClient VPN-only**. Es la versión gratuita, sin licencia ni registro. Las ediciones ZTNA y EPP/APT son de pago y no hacen falta.
3. Descarga **Windows 64-bit** y ejecuta el instalador. Reinicia si lo pide: instala un adaptador de red virtual.

#### Datos que faltan para configurarlo

FortiClient no descubre nada solo. Estos son los datos que Carlos tiene que darte, y conviene tenerlos a mano cuando te acompañe:

| Dato | Para qué |
|---|---|
| Tipo de conexión | SSL-VPN o IPsec |
| Dirección del gateway | El concentrador. Con SSL-VPN suele ser un host más un puerto (10443 o 443) |
| Usuario | `judiazgom`, con credenciales institucionales |
| Certificado | Si es autofirmado, hay que permitir el aviso de certificado inválido |

#### Comprobar que funcionó

Con la VPN conectada, tu equipo tendrá **dos direcciones a la vez**: la de tu red y una del rango de la Universidad.

```powershell
Test-NetConnection 172.23.177.12 -Port 22
```

`TcpTestSucceeded : True`, y el campo `SourceAddress` ya no muestra tu red doméstica sino una de la UNAL. Ese cambio es la señal de que estás dentro.

### Dominio y certificado — resuelto el 19 ago 2026

`acopio.manizales.unal.edu.co` con TLS ya está instalado y funcionando en el servidor. Carlos (OTIC) dejó el certificado en `/etc/ssl/Certificados/` del propio servidor (`manizales.crt` + `manizales.key`, wildcard `*.manizales.unal.edu.co`, Sectigo, vence 29 oct 2026). El `.crt` que entregó traía solo el certificado hoja, sin la cadena intermedia — se completó con el intermedio de Sectigo (`SectigoPublicServerAuthenticationCADVR36`, vía su AIA) antes de instalarlo, si no algunos clientes que no completan la cadena solos (curl, apps, navegadores viejos) habrían fallado.

**Pendiente real con OTIC, no resuelto:** el DNS **público** de `acopio.manizales.unal.edu.co` resuelve a `168.176.155.47`, que no es este servidor (`172.23.177.12`) — probablemente el escaneo de Carlos se hizo desde dentro de la red UNAL, donde el DNS interno sí apunta bien. Desde fuera (o por VPN, que no cambia la resolución pública), el dominio no llega al servidor todavía. Hay que pedirle a OTIC que corrija el registro público antes de anunciar la URL a donantes reales.

---

## 1. Primer ingreso y reconocimiento

Con VPN activa o desde el campus:

```bash
ssh juan@172.23.177.12
```

> En PowerShell, `ssh` funciona igual (viene con Windows 10+). Si la contraseña da problemas al pegarla, escríbela a mano: contiene `&`, que algunos terminales interpretan.

**Confirmado por OTIC:** el servidor es **Ubuntu** y el usuario `juan` **tiene `sudo`**. Aun así, conviene mirar qué versión y con qué recursos:

```bash
# Qué sistema es y cuánto tiene
cat /etc/os-release
free -h && df -h / && nproc

# ¿Tenemos sudo?
sudo -v && echo "sudo OK"

# ¿Hay algo ya escuchando? ¿Node, nginx?
sudo ss -tulpn | grep LISTEN
which node nginx git curl

# ¿Cortafuegos activo?
sudo ufw status 2>/dev/null || sudo firewall-cmd --state 2>/dev/null
```

Anota los resultados: determinan si esta guía aplica tal cual (asume Ubuntu/Debian con `apt` y `ufw`) o hay que adaptarla.

---

## 2. Asegurar el acceso

Estos tres pasos van **antes** de desplegar nada.

### 2.1 Cambiar la contraseña

```bash
passwd
```

La que envió OTIC viajó por correo. Cámbiala y guárdala en un gestor.

### 2.2 Entrar con llave en vez de contraseña

Desde **tu máquina**, no desde el servidor:

```powershell
# Windows (PowerShell) — si aún no tienes llave
ssh-keygen -t ed25519 -C "judiazgom@unal.edu.co"

# Copiarla al servidor
type $env:USERPROFILE\.ssh\id_ed25519.pub | ssh juan@172.23.177.12 "mkdir -p ~/.ssh && chmod 700 ~/.ssh && cat >> ~/.ssh/authorized_keys && chmod 600 ~/.ssh/authorized_keys"
```

```bash
# Linux / macOS
ssh-keygen -t ed25519 -C "judiazgom@unal.edu.co"
ssh-copy-id juan@172.23.177.12
```

**Comprueba que la llave funciona abriendo una segunda sesión** antes de seguir. Si desactivas la contraseña sin haberlo probado, te quedas fuera del servidor.

### 2.3 Desactivar el ingreso por contraseña

Solo cuando la llave ya te deje entrar, y **avisando a OTIC** — puede que ellos necesiten ese acceso:

```bash
sudo nano /etc/ssh/sshd_config
#   PasswordAuthentication no
#   PermitRootLogin no
sudo systemctl restart ssh
```

---

## 3. Preparar el sistema

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y git curl unzip nginx

# Node.js 22
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs
node --version    # v22.x
```

### Usuario y directorios del servicio

La aplicación **no corre como `juan`**: corre como un usuario de sistema sin shell, que no puede iniciar sesión ni tiene contraseña. Si alguna vez alguien logra ejecutar código a través de la app, ese es todo el alcance que consigue.

```bash
sudo adduser --system --group --home /opt/akopia akopia
sudo mkdir -p /opt/akopia/{backend,frontend,backups}
sudo chown -R akopia:akopia /opt/akopia
```

---

## 4. Backend

```bash
sudo -u akopia -H bash
cd /opt/akopia/backend
git clone https://github.com/fcenwebunal/akopia-backend.git .

curl -L -o pb.zip https://github.com/pocketbase/pocketbase/releases/download/v0.39.11/pocketbase_0.39.11_linux_amd64.zip
unzip pb.zip && rm pb.zip CHANGELOG.md LICENSE.md
chmod +x pocketbase
./pocketbase --version      # 0.39.11

# La clave del usuario de aplicación: generada, no inventada
printf 'AKOPIA_INITIAL_ADMIN_PASSWORD=%s\n' "$(openssl rand -base64 24)" > .env
chmod 600 .env
cat .env                    # anótala: solo sirve en el primer arranque
exit
```

### El servicio

`/etc/systemd/system/akopia-backend.service`:

```ini
[Unit]
Description=AKOPIA backend (PocketBase)
After=network.target

[Service]
Type=simple
User=akopia
Group=akopia
WorkingDirectory=/opt/akopia/backend
EnvironmentFile=/opt/akopia/backend/.env
ExecStart=/opt/akopia/backend/pocketbase serve --http=127.0.0.1:8090
Restart=always
RestartSec=5

NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=/opt/akopia/backend/pb_data

[Install]
WantedBy=multi-user.target
```

> **`127.0.0.1` y no `0.0.0.0`.** Así PocketBase solo escucha desde la propia máquina y nginx queda como única puerta. Con `0.0.0.0`, el puerto 8090 respondería a toda la red de la Universidad sin TLS y con el panel de administración expuesto.

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now akopia-backend
sudo systemctl status akopia-backend
```

### Comprobar

```bash
cd /opt/akopia/backend
sudo -u akopia ./scripts/verificar.sh
```

Las once comprobaciones deben quedar en `OK`.

---

## 5. Frontend

```bash
sudo -u akopia -H bash
cd /opt/akopia/frontend
git clone https://github.com/fcenwebunal/akopia-frontend.git .

cat > .env.production <<'EOF'
NEXT_PUBLIC_PB_URL=
PB_INTERNAL_URL=http://127.0.0.1:8090
EOF

npm ci && npm run build
exit
```

> **`NEXT_PUBLIC_PB_URL` va vacía en producción, a propósito — no la IP, no el dominio.** Con base URL vacía, el SDK de PocketBase que corre en el navegador resuelve contra `location.origin`: el mismo host y protocolo desde el que se cargó la página. Así funciona igual si alguien entra por `http://172.23.177.12` o por `https://acopio.manizales.unal.edu.co`, sin depender de cuál de los dos es alcanzable desde donde esté el usuario — justo el problema real que salió el 19 de agosto: fijarla al dominio rompió el login para quien entraba por la IP, porque el dominio no es alcanzable desde dentro de la red UNAL mientras el NAT con OTIC siga pendiente (ver §0 y bitácora del `CLAUDE.md`). `PB_INTERNAL_URL` es la que usan las rutas del propio servidor (el puente de Firebase, `requireAdmin`, la landing pública) para hablar con PocketBase — esa sí se queda fija en `127.0.0.1:8090`, porque corre en el servidor mismo, no en el navegador de nadie. Las variables `NEXT_PUBLIC_*` se incrustan en el build: cambiar el valor exige `npm run build` de nuevo, no basta con reiniciar el servicio.

`/etc/systemd/system/akopia-frontend.service`:

```ini
[Unit]
Description=AKOPIA frontend (Next.js)
After=network.target akopia-backend.service

[Service]
Type=simple
User=akopia
Group=akopia
WorkingDirectory=/opt/akopia/frontend
Environment=NODE_ENV=production
ExecStart=/usr/bin/npm run start -- -p 3000
Restart=always
RestartSec=5

NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=/opt/akopia/frontend/.next

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now akopia-frontend
```

---

## 6. nginx

**Desde el 19 ago 2026, con TLS instalado.** El certificado (wildcard `*.manizales.unal.edu.co`, con la cadena de Sectigo ya completada) vive en `/etc/ssl/certs/acopio.manizales.unal.edu.co.crt` y `/etc/ssl/private/acopio.manizales.unal.edu.co.key`. Tres bloques: el dominio en 80 redirige a HTTPS; la IP desnuda en 80 se deja sin redirigir (el certificado no la cubre — redirigirla produciría un aviso de certificado inválido); el dominio en 443 sirve de verdad, con las cabeceras de seguridad que pidió el escaneo de Carlos.

> **nginx 1.24 (la versión del servidor) no entiende `http2 on;`** — esa sintaxis llegó en 1.25.1. Usar `listen 443 ssl http2;` (la forma vieja, en la misma línea del `listen`).

`/etc/nginx/sites-available/akopia`:

```nginx
server {
    listen 80;
    server_name acopio.manizales.unal.edu.co;
    return 301 https://acopio.manizales.unal.edu.co$request_uri;
}

server {
    listen 80;
    server_name 172.23.177.12;

    client_max_body_size 10M;    # fotos de donación y firmas

    # Rutas propias del frontend (Next.js) que también empiezan por
    # /api/ — location exacta, gana por precedencia sobre la /api/
    # general de abajo (que va al backend), sin importar el orden en
    # el archivo. Sin esto, PocketBase responde su propio 404 (con esa
    # forma característica: {"message":"The requested resource wasn't
    # found."}) porque no tiene estas rutas — encontrado dos veces ya:
    # el 20 de agosto con el login real por Google, y el 21 con
    # /api/auth/email-status recién agregado.
    #
    # LECCIÓN: cualquier ruta NUEVA que se agregue bajo
    # akopia-frontend/src/app/api/ necesita su propio bloque `location =`
    # aquí, en los DOS server{} (puerto 80 y 443) — si un 404 con esa
    # forma de PocketBase aparece en una ruta que debería resolver el
    # frontend, es casi seguro esto.
    location = /api/auth/firebase {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host              $host;
        proxy_set_header X-Real-IP         $remote_addr;
        proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location = /api/uploads/sign {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host              $host;
        proxy_set_header X-Real-IP         $remote_addr;
        proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location = /api/auth/email-status {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host              $host;
        proxy_set_header X-Real-IP         $remote_addr;
        proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /api/ {
        proxy_pass http://127.0.0.1:8090;
        proxy_http_version 1.1;
        proxy_set_header Host              $host;
        proxy_set_header X-Real-IP         $remote_addr;
        proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # Tiempo real por SSE: sin esto las suscripciones se cortan
        proxy_buffering off;
        proxy_cache off;
        proxy_read_timeout 24h;
    }

    location /_/ {
        allow 172.16.0.0/12;
        allow 10.100.100.0/24;   # rango real de la VPN FortiClient (18 ago 2026)
        deny all;

        proxy_pass http://127.0.0.1:8090;
        proxy_set_header Host $host;
    }

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade    $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host       $host;
    }
}

server {
    listen 443 ssl http2;
    server_name acopio.manizales.unal.edu.co;

    ssl_certificate     /etc/ssl/certs/acopio.manizales.unal.edu.co.crt;
    ssl_certificate_key /etc/ssl/private/acopio.manizales.unal.edu.co.key;
    ssl_protocols       TLSv1.2 TLSv1.3;
    ssl_ciphers         HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

    client_max_body_size 10M;

    server_tokens off;   # no divulgar la versión de nginx

    # Cabeceras que pidió el escaneo de Carlos (OTIC), 19 ago 2026.
    # script-src/connect-src ganaron apis.google.com y www.gstatic.com
    # el 20 de agosto: sin ellos, "Continuar con Google" cargaba
    # apis.google.com/js/api.js y el propio CSP lo bloqueaba en
    # silencio (solo se ve en la consola del navegador, la petición ni
    # siquiera sale a red) — encontrado probando el login real después
    # de crear una cuenta nueva.
    add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline' https://apis.google.com https://www.gstatic.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: https://res.cloudinary.com https://*.basemaps.cartocdn.com https://*.openstreetmap.org; connect-src 'self' https://nominatim.openstreetmap.org https://api.cloudinary.com https://*.googleapis.com https://securetoken.googleapis.com https://apis.google.com; frame-src https://accounts.google.com https://akopia.firebaseapp.com; font-src 'self' data:; object-src 'none'; base-uri 'self'; frame-ancestors 'self'" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;

    location = /api/auth/firebase {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host              $host;
        proxy_set_header X-Real-IP         $remote_addr;
        proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location = /api/uploads/sign {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host              $host;
        proxy_set_header X-Real-IP         $remote_addr;
        proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location = /api/auth/email-status {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host              $host;
        proxy_set_header X-Real-IP         $remote_addr;
        proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /api/ {
        proxy_pass http://127.0.0.1:8090;
        proxy_http_version 1.1;
        proxy_set_header Host              $host;
        proxy_set_header X-Real-IP         $remote_addr;
        proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        proxy_buffering off;
        proxy_cache off;
        proxy_read_timeout 24h;
    }

    location /_/ {
        allow 172.16.0.0/12;
        allow 10.100.100.0/24;
        deny all;

        proxy_pass http://127.0.0.1:8090;
        proxy_set_header Host $host;
    }

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade    $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host       $host;
    }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/akopia /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl reload nginx
```

> **El panel `/_/` es lo más sensible del despliegue:** da acceso completo a la base, incluidos los datos personales de donantes y destinatarios. La regla `allow`/`deny` de arriba lo limita a la red interna y a la VPN. Lo más seguro es cerrarlo del todo y llegar por túnel SSH: `ssh -L 8090:127.0.0.1:8090 juan@172.23.177.12` y abrir `http://127.0.0.1:8090/_/` en tu máquina.
>
> **El CSP se armó revisando a qué dominios externos llama la app de verdad** (Cloudinary para fotos, Nominatim/CartoDB para el mapa de direcciones, Google/Firebase para el login) — no se verificó en un navegador real por falta de esa herramienta en la sesión que lo instaló. Si algo del sitio deja de funcionar (mapa, login con Google, subir fotos) después de este cambio, lo primero es abrir la consola del navegador y buscar líneas que empiecen con "Refused to..." — ahí dice exactamente qué dominio falta agregar al CSP.

### Cortafuegos

```bash
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw enable
sudo ufw status
```

Los puertos 8090 y 3000 quedan cerrados desde fuera: solo nginx entra.

---

## 7. Respaldos

PocketBase los trae integrados: panel → *Settings* → *Backups*, con programación automática. El zip incluye la base y los archivos subidos, y se restaura en una instancia nueva desde la misma pantalla.

**El cron diario usa la API nativa de respaldos (`POST /api/backups`), no un `tar` en caliente del directorio.** `app.createBackup()` hace un checkpoint y una copia consistente del propio motor de SQLite; un `tar czf` leyendo `pb_data` mientras el proceso escribe en modo WAL no ofrece esa garantía — es sospechoso de una corrupción real de `data.db` en producción el 20 de agosto de 2026 (ver bitácora de ese día), aunque la causa exacta no quedó confirmada. El script vive en `scripts/backup-cron.sh` (lee el superusuario de servicio del `.env.production` del frontend, crea el respaldo por API y borra los `auto_*.zip` con más de 30 días — nunca toca los respaldos manuales de `/panel/respaldos`). En `sudo crontab -e` para el usuario `akopia`:

```
0 3 * * * /opt/akopia/backend/scripts/backup-cron.sh >> /var/log/akopia-backup.log 2>&1
```

**Ensaya la restauración antes de tener datos reales.** Un respaldo que nunca se restauró no es un respaldo.

---

## 8. Comprobación final

Desde tu máquina, con VPN activa:

| Prueba | Esperado |
|---|---|
| `http://172.23.177.12` | Portada de AKOPIA con el escudo y la tipografía Ancízar |
| `http://172.23.177.12/api/health` | `{"message":"API is healthy."...}` |
| `http://172.23.177.12/login` | Entra con `admin@akopia.org` y la clave generada en §4 |
| `http://172.23.177.12/panel` | Resumen con datos reales |
| `http://172.23.177.12/_/` | El panel, o 403 si estás fuera del rango permitido |

En el servidor:

```bash
systemctl status akopia-backend akopia-frontend nginx
journalctl -u akopia-backend -f
```

---

## 9. Actualizar después de un cambio

```bash
# Backend: las migraciones nuevas se aplican solas al reiniciar
sudo -u akopia -H bash -c 'cd /opt/akopia/backend && git pull'
sudo systemctl restart akopia-backend

# Frontend: hay que reconstruir
sudo -u akopia -H bash -c 'cd /opt/akopia/frontend && git pull && npm ci && npm run build'
sudo systemctl restart akopia-frontend
```

---

## 10. Lo que falta cerrar con OTIC

| Pendiente | Por qué importa |
|---|---|
| ~~VPN para `judiazgom`~~ | ✅ Confirmado: FortiClient. Falta la versión del instalador |
| ~~Confirmar `sudo` para `juan`~~ | ✅ Confirmado: Ubuntu con `sudo` |
| ~~Certificado TLS~~ | ✅ Instalado 19 ago 2026. Carlos lo dejó en `/etc/ssl/Certificados/` del servidor (wildcard `*.manizales.unal.edu.co`, Sectigo, vence 29 oct 2026) |
| **DNS público de `acopio.manizales.unal.edu.co` resuelve a `168.176.155.47`, no a este servidor** | El sitio con TLS funciona de punta a punta *dentro* de la red/VPN de la UNAL (donde el DNS interno sí apunta bien — así lo vio el escaneo de Carlos). Desde fuera, el dominio no llega. Hay que pedirle a OTIC que corrija el registro público antes de compartir la URL con donantes reales |
| **¿La IP es fija o por DHCP?** | Si cambia sola, todo lo que apunte a ella se rompe sin aviso |
| **Acceso al panel `/_/`** | Acordar si se restringe por IP o se cierra y se usa túnel SSH |
| **Política de respaldos** | Si OTIC ya respalda la VM, se evita duplicar |

---

## Documentos relacionados

- [PUESTA-EN-MARCHA.md](PUESTA-EN-MARCHA.md) — levantar todo en local
- [README.md](README.md) — modelo de datos, hooks y cómo aportar código
