<#
.SYNOPSIS
  Comprueba que el backend de AKOPIA está funcionando de verdad.

.DESCRIPTION
  Recorre el flujo completo: autenticación, catálogo sembrado, código
  correlativo, entrada de inventario, traslado a cuarentena, validaciones
  y auditoría. Cada paso imprime OK o FALLA.

  Escribe datos de prueba. Úsalo sobre una base de desarrollo, y si quieres
  el estado limpio: borra pb_data y vuelve a arrancar el servidor.

.PARAMETER Password
  Contraseña de admin@akopia.org. Si se omite se lee de .env.

.PARAMETER BaseUrl
  URL del servidor. Por defecto http://127.0.0.1:8090

.EXAMPLE
  .\scripts\verificar.ps1

.EXAMPLE
  .\scripts\verificar.ps1 -Password "MiClave" -BaseUrl "http://127.0.0.1:8090"
#>

param(
  [string]$Password,
  [string]$BaseUrl = "http://127.0.0.1:8090"
)

$ErrorActionPreference = "Stop"
$script:Failures = 0

function Write-Step {
  param([string]$Name, [bool]$Ok, [string]$Detail)

  if ($Ok) {
    Write-Host "  OK   " -ForegroundColor Green -NoNewline
  } else {
    Write-Host "  FALLA" -ForegroundColor Red -NoNewline
    $script:Failures++
  }
  Write-Host " $Name" -NoNewline
  if ($Detail) { Write-Host "  ->  $Detail" -ForegroundColor DarkGray } else { Write-Host "" }
}

function Get-PasswordFromEnv {
  $envFile = Join-Path $PSScriptRoot "..\.env"
  if (-not (Test-Path $envFile)) { return $null }

  foreach ($line in Get-Content $envFile) {
    if ($line -match '^\s*AKOPIA_INITIAL_ADMIN_PASSWORD\s*=\s*(.+)$') {
      return $Matches[1].Trim().Trim('"').Trim("'")
    }
  }
  return $null
}

Write-Host ""
Write-Host "Verificacion del backend AKOPIA" -ForegroundColor Cyan
Write-Host "$BaseUrl"
Write-Host ""

if (-not $Password) {
  $Password = Get-PasswordFromEnv
  if (-not $Password) {
    Write-Host "No encontre AKOPIA_INITIAL_ADMIN_PASSWORD en .env." -ForegroundColor Red
    Write-Host "Pasala con:  .\scripts\verificar.ps1 -Password 'tu-clave'"
    exit 1
  }
}

# ── 1. El servidor responde ─────────────────────────────────────
try {
  Invoke-RestMethod -Uri "$BaseUrl/api/health" -TimeoutSec 5 | Out-Null
  Write-Step "El servidor responde" $true
} catch {
  Write-Step "El servidor responde" $false "arranca PocketBase con: .\pocketbase.exe serve"
  Write-Host ""
  exit 1
}

# ── 2. Autenticación de la aplicación ───────────────────────────
try {
  $body = @{ identity = "admin@akopia.org"; password = $Password } | ConvertTo-Json
  $auth = Invoke-RestMethod -Uri "$BaseUrl/api/collections/users/auth-with-password" `
    -Method Post -ContentType "application/json" -Body $body
  Write-Step "Login de admin@akopia.org" ($auth.record.role -eq "admin") "rol: $($auth.record.role)"
} catch {
  Write-Step "Login de admin@akopia.org" $false "revisa la clave en .env; la migracion 023 corre una sola vez"
  Write-Host ""
  exit 1
}

$headers = @{ Authorization = $auth.token }
$operatorId = $auth.record.id

function Get-Count {
  param([string]$Collection)
  $r = Invoke-RestMethod -Uri "$BaseUrl/api/collections/$Collection/records?perPage=1" -Headers $headers
  return $r.totalItems
}

# ── 3. Catálogo sembrado ────────────────────────────────────────
$products = Get-Count "products"
$units = Get-Count "units"
$categories = Get-Count "categories"
Write-Step "Catalogo sembrado" (($products -eq 123) -and ($units -eq 20) -and ($categories -eq 55)) `
  "$products productos, $units unidades, $categories categorias"

$locations = Get-Count "locations"
Write-Step "Ubicaciones (0 es lo esperado hoy)" ($locations -eq 0) "$locations ubicaciones"

# ── 4. Código correlativo ───────────────────────────────────────
$donationBody = @{
  donor_type   = "individual"
  donor_name   = "Verificacion automatica"
  receipt_date = (Get-Date).ToString("yyyy-MM-dd HH:mm:ss.fff") + "Z"
  operator_id  = $operatorId
} | ConvertTo-Json

try {
  $donation = Invoke-RestMethod -Uri "$BaseUrl/api/collections/donations/records" `
    -Method Post -Headers $headers -ContentType "application/json" -Body $donationBody
  Write-Step "Codigo de donacion autogenerado" ($donation.code -match '^DON-\d{6}$') $donation.code
} catch {
  Write-Step "Codigo de donacion autogenerado" $false "los hooks no se estan ejecutando"
  Write-Host ""
  Write-Host "Revisa que los archivos de pb_hooks/ terminen en .pb.js y que la version sea 0.39.11" -ForegroundColor Yellow
  exit 1
}

# ── 5. Un item pendiente no toca inventario ─────────────────────
$product = (Invoke-RestMethod -Uri "$BaseUrl/api/collections/products/records?perPage=1" -Headers $headers).items[0]
$inventoryBefore = Get-Count "inventory"

$itemBody = @{
  donation_id           = $donation.id
  product_id            = $product.id
  unit_id               = $product.default_unit_id
  quantity              = 40
  classification_status = "pending"
} | ConvertTo-Json

$item = Invoke-RestMethod -Uri "$BaseUrl/api/collections/donation_items/records" `
  -Method Post -Headers $headers -ContentType "application/json" -Body $itemBody

$inventoryAfter = Get-Count "inventory"
Write-Step "Un item pendiente no mueve inventario" ($inventoryAfter -eq $inventoryBefore)

# ── 6. Clasificar como disponible genera la entrada ─────────────
$patch = @{ classification_status = "available" } | ConvertTo-Json
Invoke-RestMethod -Uri "$BaseUrl/api/collections/donation_items/records/$($item.id)" `
  -Method Patch -Headers $headers -ContentType "application/json" -Body $patch | Out-Null

$filter = [uri]::EscapeDataString("product_id = '$($product.id)'")
$inv = (Invoke-RestMethod -Uri "$BaseUrl/api/collections/inventory/records?filter=$filter" -Headers $headers).items[0]
Write-Step "pending -> available crea saldo disponible" ($inv.available_qty -ge 40) `
  "disponible: $($inv.available_qty)"

$movFilter = [uri]::EscapeDataString("reference_id = '$($donation.id)'")
$movs = Invoke-RestMethod -Uri "$BaseUrl/api/collections/inventory_movements/records?filter=$movFilter" -Headers $headers
Write-Step "Se registro el movimiento de entrada" ($movs.items.movement_type -contains "entrada")

# ── 7. Traslado a cuarentena ────────────────────────────────────
$patch = @{ classification_status = "quarantine" } | ConvertTo-Json
Invoke-RestMethod -Uri "$BaseUrl/api/collections/donation_items/records/$($item.id)" `
  -Method Patch -Headers $headers -ContentType "application/json" -Body $patch | Out-Null

$invQ = (Invoke-RestMethod -Uri "$BaseUrl/api/collections/inventory/records?filter=$filter" -Headers $headers).items[0]
Write-Step "available -> quarantine mueve el saldo" ($invQ.quarantine_qty -ge 40) `
  "disponible: $($invQ.available_qty), cuarentena: $($invQ.quarantine_qty)"

# ── 8. Las validaciones rechazan y revierten ────────────────────
$patch = @{ quantity = 999 } | ConvertTo-Json
$rejected = $false
$message = ""
try {
  Invoke-RestMethod -Uri "$BaseUrl/api/collections/donation_items/records/$($item.id)" `
    -Method Patch -Headers $headers -ContentType "application/json" -Body $patch | Out-Null
} catch {
  $rejected = $true
  $stream = $_.Exception.Response.GetResponseStream()
  $reader = New-Object System.IO.StreamReader($stream)
  $message = ($reader.ReadToEnd() | ConvertFrom-Json).message
}
Write-Step "Se rechaza cambiar la cantidad ya contabilizada" $rejected $message

# ── 9. Auditoría ────────────────────────────────────────────────
$audit = Invoke-RestMethod -Uri "$BaseUrl/api/collections/audit_log/records?perPage=5&sort=-created" -Headers $headers
$actions = ($audit.items | ForEach-Object { "$($_.entity_type)/$($_.action)" }) -join ", "
Write-Step "La auditoria registra los cambios" ($audit.totalItems -gt 0) $actions

# ── Resumen ─────────────────────────────────────────────────────
Write-Host ""
if ($script:Failures -eq 0) {
  Write-Host "Todo correcto. El backend esta funcionando." -ForegroundColor Green
  Write-Host ""
  exit 0
}

Write-Host "$($script:Failures) comprobacion(es) fallaron." -ForegroundColor Red
Write-Host "Revisa PUESTA-EN-MARCHA.md, seccion 8: diagnostico por sintoma." -ForegroundColor Yellow
Write-Host ""
exit 1
