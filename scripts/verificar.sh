#!/usr/bin/env bash
#
# Comprueba que el backend de AKOPIA está funcionando de verdad.
#
# Recorre el flujo completo: autenticación, catálogo sembrado, código
# correlativo, entrada de inventario, traslado a cuarentena, validaciones
# y auditoría. Cada paso imprime OK o FALLA.
#
# Escribe datos de prueba. Úsalo sobre una base de desarrollo, y si quieres
# el estado limpio: borra pb_data y vuelve a arrancar el servidor.
#
# Uso:
#   ./scripts/verificar.sh
#   ./scripts/verificar.sh "mi-clave" "http://127.0.0.1:8090"
#
# Requiere curl y node (node solo para leer el JSON).

set -uo pipefail

BASE_URL="${2:-http://127.0.0.1:8090}"
PASSWORD="${1:-}"
FAILURES=0

GREEN=$'\033[32m'; RED=$'\033[31m'; GRAY=$'\033[90m'; YELLOW=$'\033[33m'; CYAN=$'\033[36m'; RESET=$'\033[0m'

step() {
  local ok="$1" name="$2" detail="${3:-}"

  if [ "$ok" = "1" ]; then
    printf "  %sOK   %s %s" "$GREEN" "$RESET" "$name"
  else
    printf "  %sFALLA%s %s" "$RED" "$RESET" "$name"
    FAILURES=$((FAILURES + 1))
  fi

  if [ -n "$detail" ]; then
    printf "  %s->  %s%s\n" "$GRAY" "$detail" "$RESET"
  else
    printf "\n"
  fi
}

# Lee una ruta de un JSON que llega por stdin. Devuelve cadena vacía si no existe.
jget() {
  node -e "
    let raw='';
    process.stdin.on('data', (c) => raw += c).on('end', () => {
      try {
        const value = $1;
        process.stdout.write(value === undefined || value === null ? '' : String(value));
      } catch (err) { process.stdout.write(''); }
    });
  " <<< "$(cat)"
}

api() {
  local method="$1" path="$2" data="${3:-}"

  if [ -n "$data" ]; then
    curl -s -X "$method" "$BASE_URL$path" \
      -H "Content-Type: application/json" \
      ${TOKEN:+-H "Authorization: $TOKEN"} \
      -d "$data"
  else
    curl -s -X "$method" "$BASE_URL$path" ${TOKEN:+-H "Authorization: $TOKEN"}
  fi
}

count() {
  api GET "/api/collections/$1/records?perPage=1" | jget "JSON.parse(raw).totalItems"
}

printf "\n%sVerificacion del backend AKOPIA%s\n%s\n\n" "$CYAN" "$RESET" "$BASE_URL"

if [ -z "$PASSWORD" ] && [ -f "$(dirname "$0")/../.env" ]; then
  PASSWORD=$(grep -E '^\s*AKOPIA_INITIAL_ADMIN_PASSWORD\s*=' "$(dirname "$0")/../.env" \
    | head -1 | cut -d= -f2- | tr -d '"'"'" | xargs)
fi

if [ -z "$PASSWORD" ]; then
  printf "%sNo encontre AKOPIA_INITIAL_ADMIN_PASSWORD en .env.%s\n" "$RED" "$RESET"
  printf "Pasala con:  ./scripts/verificar.sh 'tu-clave'\n\n"
  exit 1
fi

TOKEN=""

# ── 1. El servidor responde ─────────────────────────────────────
if curl -s -f --max-time 5 "$BASE_URL/api/health" > /dev/null; then
  step 1 "El servidor responde"
else
  step 0 "El servidor responde" "arranca PocketBase con: ./pocketbase serve"
  printf "\n"
  exit 1
fi

# ── 2. Autenticación de la aplicación ───────────────────────────
AUTH=$(api POST "/api/collections/users/auth-with-password" \
  "{\"identity\":\"admin@akopia.org\",\"password\":\"$PASSWORD\"}")
TOKEN=$(jget "JSON.parse(raw).token" <<< "$AUTH")
ROLE=$(jget "JSON.parse(raw).record.role" <<< "$AUTH")
OPERATOR_ID=$(jget "JSON.parse(raw).record.id" <<< "$AUTH")

if [ "$ROLE" = "admin" ]; then
  step 1 "Login de admin@akopia.org" "rol: $ROLE"
else
  step 0 "Login de admin@akopia.org" "revisa la clave en .env; la migracion 023 corre una sola vez"
  printf "\n"
  exit 1
fi

# ── 3. Catálogo sembrado ────────────────────────────────────────
PRODUCTS=$(count products); UNITS=$(count units); CATEGORIES=$(count categories)
OK=0; [ "$PRODUCTS" = "123" ] && [ "$UNITS" = "20" ] && [ "$CATEGORIES" = "55" ] && OK=1
step "$OK" "Catalogo sembrado" "$PRODUCTS productos, $UNITS unidades, $CATEGORIES categorias"

LOCATIONS=$(count locations)
OK=0; [ "$LOCATIONS" = "0" ] && OK=1
step "$OK" "Ubicaciones (0 es lo esperado hoy)" "$LOCATIONS ubicaciones"

# ── 4. Código correlativo ───────────────────────────────────────
RECEIPT_DATE=$(date -u +"%Y-%m-%d %H:%M:%S.000Z")
DONATION=$(api POST "/api/collections/donations/records" \
  "{\"donor_type\":\"individual\",\"donor_name\":\"Verificacion automatica\",\"receipt_date\":\"$RECEIPT_DATE\",\"operator_id\":\"$OPERATOR_ID\"}")
CODE=$(jget "JSON.parse(raw).code" <<< "$DONATION")
DONATION_ID=$(jget "JSON.parse(raw).id" <<< "$DONATION")

if [[ "$CODE" =~ ^DON-[0-9]{6}$ ]]; then
  step 1 "Codigo de donacion autogenerado" "$CODE"
else
  step 0 "Codigo de donacion autogenerado" "los hooks no se estan ejecutando"
  printf "\n%sRevisa que los archivos de pb_hooks/ terminen en .pb.js y que la version sea 0.39.11%s\n\n" "$YELLOW" "$RESET"
  exit 1
fi

# ── 5. Un item pendiente no toca inventario ─────────────────────
PRODUCTS_JSON=$(api GET "/api/collections/products/records?perPage=1")
PRODUCT_ID=$(jget "JSON.parse(raw).items[0].id" <<< "$PRODUCTS_JSON")
UNIT_ID=$(jget "JSON.parse(raw).items[0].default_unit_id" <<< "$PRODUCTS_JSON")

INVENTORY_BEFORE=$(count inventory)
ITEM=$(api POST "/api/collections/donation_items/records" \
  "{\"donation_id\":\"$DONATION_ID\",\"product_id\":\"$PRODUCT_ID\",\"unit_id\":\"$UNIT_ID\",\"quantity\":40,\"classification_status\":\"pending\"}")
ITEM_ID=$(jget "JSON.parse(raw).id" <<< "$ITEM")
INVENTORY_AFTER=$(count inventory)

OK=0; [ "$INVENTORY_BEFORE" = "$INVENTORY_AFTER" ] && OK=1
step "$OK" "Un item pendiente no mueve inventario"

# ── 6. Clasificar como disponible genera la entrada ─────────────
api PATCH "/api/collections/donation_items/records/$ITEM_ID" \
  '{"classification_status":"available"}' > /dev/null

FILTER=$(node -pe "encodeURIComponent(\"product_id = '$PRODUCT_ID'\")")
INV=$(api GET "/api/collections/inventory/records?filter=$FILTER")
AVAILABLE=$(jget "JSON.parse(raw).items[0].available_qty" <<< "$INV")

OK=0; [ -n "$AVAILABLE" ] && [ "$AVAILABLE" -ge 40 ] 2>/dev/null && OK=1
step "$OK" "pending -> available crea saldo disponible" "disponible: $AVAILABLE"

MOV_FILTER=$(node -pe "encodeURIComponent(\"reference_id = '$DONATION_ID'\")")
MOVS=$(api GET "/api/collections/inventory_movements/records?filter=$MOV_FILTER")
HAS_ENTRADA=$(jget "JSON.parse(raw).items.some((m) => m.movement_type === 'entrada') ? 1 : 0" <<< "$MOVS")
step "$HAS_ENTRADA" "Se registro el movimiento de entrada"

# ── 7. Traslado a cuarentena ────────────────────────────────────
api PATCH "/api/collections/donation_items/records/$ITEM_ID" \
  '{"classification_status":"quarantine"}' > /dev/null

INV_Q=$(api GET "/api/collections/inventory/records?filter=$FILTER")
QUARANTINE=$(jget "JSON.parse(raw).items[0].quarantine_qty" <<< "$INV_Q")
AVAILABLE_Q=$(jget "JSON.parse(raw).items[0].available_qty" <<< "$INV_Q")

OK=0; [ -n "$QUARANTINE" ] && [ "$QUARANTINE" -ge 40 ] 2>/dev/null && OK=1
step "$OK" "available -> quarantine mueve el saldo" "disponible: $AVAILABLE_Q, cuarentena: $QUARANTINE"

# ── 8. Las validaciones rechazan y revierten ────────────────────
REJECT=$(api PATCH "/api/collections/donation_items/records/$ITEM_ID" '{"quantity":999}')
STATUS=$(jget "JSON.parse(raw).status" <<< "$REJECT")
MESSAGE=$(jget "JSON.parse(raw).message" <<< "$REJECT")

OK=0; [ "$STATUS" = "400" ] && OK=1
step "$OK" "Se rechaza cambiar la cantidad ya contabilizada" "$MESSAGE"

# ── 9. Auditoría ────────────────────────────────────────────────
AUDIT=$(api GET "/api/collections/audit_log/records?perPage=5&sort=-created")
AUDIT_TOTAL=$(jget "JSON.parse(raw).totalItems" <<< "$AUDIT")
AUDIT_LIST=$(jget "JSON.parse(raw).items.map((i) => i.entity_type + '/' + i.action).join(', ')" <<< "$AUDIT")

OK=0; [ -n "$AUDIT_TOTAL" ] && [ "$AUDIT_TOTAL" -gt 0 ] 2>/dev/null && OK=1
step "$OK" "La auditoria registra los cambios" "$AUDIT_LIST"

# ── Resumen ─────────────────────────────────────────────────────
printf "\n"
if [ "$FAILURES" -eq 0 ]; then
  printf "%sTodo correcto. El backend esta funcionando.%s\n\n" "$GREEN" "$RESET"
  exit 0
fi

printf "%s%d comprobacion(es) fallaron.%s\n" "$RED" "$FAILURES" "$RESET"
printf "%sRevisa PUESTA-EN-MARCHA.md, seccion 8: diagnostico por sintoma.%s\n\n" "$YELLOW" "$RESET"
exit 1
