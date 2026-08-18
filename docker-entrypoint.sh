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

if [ -n "$SERVICE_SUPERUSER_EMAIL" ] && [ -n "$SERVICE_SUPERUSER_PASSWORD" ]; then
  echo "Asegurando el superusuario de servicio ($SERVICE_SUPERUSER_EMAIL)..."
  /pb/pocketbase superuser upsert "$SERVICE_SUPERUSER_EMAIL" "$SERVICE_SUPERUSER_PASSWORD"
fi

if [ -n "$PERSONAL_SUPERUSER_EMAIL" ] && [ -n "$PERSONAL_SUPERUSER_PASSWORD" ]; then
  echo "Asegurando el superusuario personal ($PERSONAL_SUPERUSER_EMAIL)..."
  /pb/pocketbase superuser upsert "$PERSONAL_SUPERUSER_EMAIL" "$PERSONAL_SUPERUSER_PASSWORD"
fi

exec /pb/pocketbase serve --http="0.0.0.0:${PORT:-8090}"
