#!/bin/bash
# Respaldo diario vía la API nativa de PocketBase (POST /api/backups), no un
# `tar` en caliente de pb_data. app.createBackup() usa el mecanismo online-safe
# de PocketBase (checkpoint + copia consistente); un tar crudo del directorio
# mientras el proceso escribe en modo WAL no lo es. Pensado para systemd
# timer o cron, corriendo como el usuario de sistema `akopia`.
#
# Variables esperadas (ya viven en el .env.production del frontend, que
# comparte el mismo superusuario de servicio):
#   PB_URL                        default http://127.0.0.1:8090
#   POCKETBASE_SERVICE_EMAIL
#   POCKETBASE_SERVICE_PASSWORD
#   BACKUP_RETENTION_DAYS         default 30
set -euo pipefail

PB_URL="${PB_URL:-http://127.0.0.1:8090}"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-30}"
ENV_FILE="${ENV_FILE:-/opt/akopia/frontend/.env.production}"

if [ -z "${POCKETBASE_SERVICE_EMAIL:-}" ] && [ -f "$ENV_FILE" ]; then
  POCKETBASE_SERVICE_EMAIL=$(grep -oP '(?<=^POCKETBASE_SERVICE_EMAIL=).*' "$ENV_FILE")
  POCKETBASE_SERVICE_PASSWORD=$(grep -oP '(?<=^POCKETBASE_SERVICE_PASSWORD=).*' "$ENV_FILE")
fi

if [ -z "${POCKETBASE_SERVICE_EMAIL:-}" ] || [ -z "${POCKETBASE_SERVICE_PASSWORD:-}" ]; then
  echo "Faltan POCKETBASE_SERVICE_EMAIL / POCKETBASE_SERVICE_PASSWORD." >&2
  exit 1
fi

TOKEN=$(curl -sf -X POST "$PB_URL/api/collections/_superusers/auth-with-password" \
  -H "Content-Type: application/json" \
  -d "{\"identity\":\"${POCKETBASE_SERVICE_EMAIL}\",\"password\":\"${POCKETBASE_SERVICE_PASSWORD}\"}" \
  | python3 -c "import sys,json;print(json.load(sys.stdin)['token'])")

NAME="auto_$(date +%F_%H%M%S).zip"

curl -sf -X POST "$PB_URL/api/backups" \
  -H "Authorization: $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"name\":\"${NAME}\"}" > /dev/null

echo "Respaldo creado: ${NAME}"

# Los respaldos viven como archivos sueltos en pb_data/backups/, sin relación
# con el WAL de data.db (son copias estáticas ya cerradas) — borrarlos por
# antigüedad directo del filesystem es seguro, sin pasar por la API.
find /opt/akopia/backend/pb_data/backups -name 'auto_*.zip' -mtime "+${RETENTION_DAYS}" -delete
