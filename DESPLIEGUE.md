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

### Sobre la VPN

El mensaje de Carlos dice *«Favor generar la VPN para el usuario judiazgom»*. Conviene aclarar con él quién la genera, porque se puede leer de dos maneras: que él ya la solicitó, o que tú debes pedirla.

El cliente y el portal **cambian según la sede** (Bogotá usa Cisco AnyConnect, Medellín tiene su propio portal), así que pídele a Carlos los datos concretos de Manizales en vez de seguir un instructivo de otra sede.

**Responde a Carlos confirmando esto:**

> Buenas tardes Carlos, gracias.
>
> Confirmo recibido el acceso a `172.23.177.12`. Tres cosas para poder avanzar:
>
> 1. **VPN:** ¿la gestionan ustedes para `judiazgom` o debo radicar la solicitud yo? En ese caso, ¿por cuál canal y con qué cliente (AnyConnect, GlobalProtect, otro)?
> 2. **Permisos:** ¿el usuario `juan` tiene `sudo`? Necesito instalar Node.js y nginx, y crear dos servicios de systemd.
> 3. **Dominio y certificado:** el subdominio que proponemos es `acopio.manizales.unal.edu.co`. ¿Lo crean ustedes y emiten el certificado TLS, o lo gestionamos de otra forma? (Entiendo que no debemos instalar Let's Encrypt contra un dominio institucional.)
>
> Quedo atento. Juan Manuel Díaz — judiazgom@unal.edu.co

Las tres respuestas condicionan pasos de esta guía. Sin la 2 no se puede instalar nada; sin la 3, el sitio queda accesible solo por IP.

---

## 1. Primer ingreso y reconocimiento

Con VPN activa o desde el campus:

```bash
ssh juan@172.23.177.12
```

> En PowerShell, `ssh` funciona igual (viene con Windows 10+). Si la contraseña da problemas al pegarla, escríbela a mano: contiene `&`, que algunos terminales interpretan.

Antes de instalar nada, mira qué te entregaron:

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

# Mientras no exista el subdominio, apunta a la IP
echo "NEXT_PUBLIC_PB_URL=http://172.23.177.12" > .env.production

npm ci && npm run build
exit
```

> Cuando OTIC cree el subdominio, cambia esta línea a `https://acopio.manizales.unal.edu.co`, vuelve a correr `npm run build` y reinicia el servicio. Las variables `NEXT_PUBLIC_*` se incrustan en el build: no basta con reiniciar.

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

`/etc/nginx/sites-available/akopia`:

```nginx
server {
    listen 80;
    server_name 172.23.177.12;   # luego: acopio.manizales.unal.edu.co

    client_max_body_size 10M;    # fotos de donación y firmas

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
        # Panel de administración: acceso total a la base.
        # Restringido a la red interna mientras no haya otra medida.
        allow 172.16.0.0/12;
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

> **El panel `/_/` es lo más sensible del despliegue:** da acceso completo a la base, incluidos los datos personales de donantes y destinatarios. La regla `allow`/`deny` de arriba lo limita a la red interna. Lo más seguro es cerrarlo del todo y llegar por túnel SSH: `ssh -L 8090:127.0.0.1:8090 juan@172.23.177.12` y abrir `http://127.0.0.1:8090/_/` en tu máquina.

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

Como copia adicional fuera del proceso, en `sudo crontab -e`:

```
0 3 * * * su -s /bin/bash akopia -c 'tar czf /opt/akopia/backups/pb_$(date +\%F).tgz -C /opt/akopia/backend pb_data'
0 4 * * 0 find /opt/akopia/backups -name 'pb_*.tgz' -mtime +30 -delete
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
| **VPN para `judiazgom`** | Sin ella solo se puede trabajar desde el campus |
| **Confirmar `sudo` para `juan`** | Sin permisos no se instala Node, nginx ni los servicios |
| **Subdominio `acopio.manizales.unal.edu.co`** | Sin guiones y sin `www`, según la directriz B1 |
| **Certificado TLS** | Lo emite la Universidad. **No instalar certbot** contra un dominio institucional |
| **Acceso al panel `/_/`** | Acordar si se restringe por IP o se cierra y se usa túnel SSH |
| **Política de respaldos** | Si OTIC ya respalda la VM, se evita duplicar |

---

## Documentos relacionados

- [PUESTA-EN-MARCHA.md](PUESTA-EN-MARCHA.md) — levantar todo en local
- [README.md](README.md) — modelo de datos, hooks y cómo aportar código
