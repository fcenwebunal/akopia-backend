# Imagen para desplegar PocketBase en un hosting con proceso y disco
# persistentes (Railway o Fly.io) — provisional, mientras se resuelve
# el acceso al servidor de la UNAL. Ver DESPLIEGUE.md para la receta
# pensada para un VPS con systemd + nginx; este Dockerfile es su
# equivalente para un contenedor con un único proceso, portable entre
# los dos hostings sin tocar nada (mismo build, mismo entrypoint).
#
# No copia pocketbase.exe (binario de Windows, gitignored): descarga la
# build oficial para Linux de la misma versión que se usa en desarrollo.

FROM alpine:3.20

RUN apk add --no-cache ca-certificates unzip curl tzdata

WORKDIR /pb

ARG PB_VERSION=0.39.11
RUN curl -fsSL -o /tmp/pb.zip \
      "https://github.com/pocketbase/pocketbase/releases/download/v${PB_VERSION}/pocketbase_${PB_VERSION}_linux_amd64.zip" \
    && unzip /tmp/pb.zip -d /pb \
    && rm /tmp/pb.zip \
    && chmod +x /pb/pocketbase

# pb_data NO se copia — vive en el volumen persistente del hosting,
# montado en tiempo de ejecución en esta misma ruta (ver fly.toml /
# la configuración de volumen de Railway).
COPY pb_hooks ./pb_hooks
COPY pb_migrations ./pb_migrations
COPY docker-entrypoint.sh ./docker-entrypoint.sh
RUN chmod +x ./docker-entrypoint.sh

EXPOSE 8090

# 0.0.0.0 aquí es correcto y no contradice la regla de DESPLIEGUE.md de
# "nunca en 0.0.0.0": esa regla es para un VPS expuesto directo a la
# red de la UNAL. Dentro de un contenedor de Railway o Fly, la red está
# aislada y es el propio proxy del hosting (con su TLS) el único que
# llega a este puerto — 0.0.0.0 es lo que necesita para reenviar el
# tráfico adentro.
ENTRYPOINT ["./docker-entrypoint.sh"]
