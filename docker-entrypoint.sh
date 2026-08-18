#!/bin/sh
# Arranque del contenedor — común a Fly.io y Railway.
#
# 1. Si vienen SERVICE_SUPERUSER_EMAIL/PASSWORD y/o
#    PERSONAL_SUPERUSER_EMAIL/PASSWORD, asegura esos superusuarios reales
#    de PocketBase (tabla interna `_superusers`, no la colección `users`)
#    antes de servir — el de servicio es el que necesita el puente de
#    Firebase del frontend (`/api/auth/firebase`); el personal es para
#    entrar a `/_/`. Sin esto había que crearlos a mano por SSH/consola
#    cada vez que el volumen empieza de cero, y no todo hosting ofrece
#    eso de forma sencilla. `upsert` es seguro de repetir: no hace nada
#    si ya existe con esa contraseña, y la actualiza si cambió.
#
# 2. Sirve en $PORT si el hosting lo inyecta (Railway lo hace; Fly no,
#    así que cae al 8090 fijo de fly.toml).
set -e

# OJO: estos dos bloques NO deben poder tumbar el arranque. Un `upsert`
# puede fallar por algo tan simple como una contraseña de menos de 8
# caracteres (el mínimo que exige PocketBase) — sin el `|| echo ...`,
# `set -e` corta el script ahí mismo y `serve` nunca llega a correr: el
# contenedor queda "arriba" para el hosting (el proceso de arranque
# técnicamente terminó) pero sin nada escuchando, así que cualquier
# petición da 502 sin ninguna pista de la causa real. Encontrado en un
# despliegue real, no anticipado al escribir esto la primera vez.
if [ -n "$SERVICE_SUPERUSER_EMAIL" ] && [ -n "$SERVICE_SUPERUSER_PASSWORD" ]; then
  echo "Asegurando el superusuario de servicio ($SERVICE_SUPERUSER_EMAIL)..."
  /pb/pocketbase superuser upsert "$SERVICE_SUPERUSER_EMAIL" "$SERVICE_SUPERUSER_PASSWORD" \
    || echo "AVISO: no se pudo crear/actualizar el superusuario de servicio (revisa que la contraseña tenga al menos 8 caracteres). Sigo arrancando igual."
fi

if [ -n "$PERSONAL_SUPERUSER_EMAIL" ] && [ -n "$PERSONAL_SUPERUSER_PASSWORD" ]; then
  echo "Asegurando el superusuario personal ($PERSONAL_SUPERUSER_EMAIL)..."
  /pb/pocketbase superuser upsert "$PERSONAL_SUPERUSER_EMAIL" "$PERSONAL_SUPERUSER_PASSWORD" \
    || echo "AVISO: no se pudo crear/actualizar el superusuario personal (revisa que la contraseña tenga al menos 8 caracteres). Sigo arrancando igual."
fi

echo "Arrancando PocketBase en el puerto ${PORT:-8090}..."
exec /pb/pocketbase serve --http="0.0.0.0:${PORT:-8090}"
