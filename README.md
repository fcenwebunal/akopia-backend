# Akopia Backend

Backend para Akopia construido con PocketBase.

## Variables de entorno

| Variable | Requerida | Descripción |
|----------|-----------|-------------|
| `AKOPIA_INITIAL_ADMIN_PASSWORD` | Sí | Contraseña del usuario administrador inicial creado en la migración `023_seed_initial_superuser.js`. |

## Migraciones

Ejecutar las migraciones de la base de datos:

```bash
AKOPIA_INITIAL_ADMIN_PASSWORD='...' ./pocketbase migrate up
```
