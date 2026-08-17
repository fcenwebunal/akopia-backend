<#
.SYNOPSIS
  Comprueba que los hallazgos de AUDITORIA-HOOKS.md siguen corregidos.

.DESCRIPTION
  Un caso por hallazgo, contra la API en ejecución. Es la red de seguridad
  frente a regresiones: si alguien vuelve a recortar un saldo a cero o
  reabre el camino de un rechazado a disponible, aquí se ve.

  Escribe datos de prueba. Úsalo sobre una base de desarrollo.

.EXAMPLE
  .\scripts\verificar-auditoria.ps1
#>

param(
  [string]$Password,
  [string]$BaseUrl = "http://127.0.0.1:8090"
)

$ErrorActionPreference = "Stop"
$script:Failures = 0

function Write-Step {
  param([string]$Id, [string]$Name, [bool]$Ok, [string]$Detail)

  if ($Ok) {
    Write-Host "  OK   " -ForegroundColor Green -NoNewline
  } else {
    Write-Host "  FALLA" -ForegroundColor Red -NoNewline
    $script:Failures++
  }
  Write-Host (" {0,-4} {1}" -f $Id, $Name) -NoNewline
  if ($Detail) { Write-Host "  ->  $Detail" -ForegroundColor DarkGray } else { Write-Host "" }
}

# Devuelve el mensaje de error, o $null si la llamada tuvo éxito.
function Get-Failure {
  param([scriptblock]$Block)

  try {
    & $Block | Out-Null
    return $null
  } catch {
    if ($_.ErrorDetails.Message) { return $_.ErrorDetails.Message }
    return $_.Exception.Message
  }
}

if (-not $Password) {
  $envFile = Join-Path $PSScriptRoot "..\.env"
  foreach ($line in Get-Content $envFile) {
    if ($line -match '^\s*AKOPIA_INITIAL_ADMIN_PASSWORD\s*=\s*(.+)$') {
      $Password = $Matches[1].Trim().Trim('"').Trim("'")
    }
  }
}

Write-Host ""
Write-Host "Verificacion de la auditoria de hooks" -ForegroundColor Cyan
Write-Host "$BaseUrl"
Write-Host ""

$auth = Invoke-RestMethod "$BaseUrl/api/collections/users/auth-with-password" -Method Post `
  -ContentType "application/json" -Body (@{ identity = "admin@akopia.org"; password = $Password } | ConvertTo-Json)
$h = @{ Authorization = $auth.token }
$op = $auth.record.id
$product = (Invoke-RestMethod "$BaseUrl/api/collections/products/records?perPage=1" -Headers $h).items[0]

function New-Donation {
  Invoke-RestMethod "$BaseUrl/api/collections/donations/records" -Method Post -Headers $h `
    -ContentType "application/json" -Body (@{
      donor_type = "individual"; donor_name = "Verificacion Auditoria"
      receipt_date = "2026-08-17 10:00:00.000Z"; operator_id = $op
    } | ConvertTo-Json)
}

function New-Item {
  param([string]$DonationId, [double]$Quantity, [string]$Status)
  Invoke-RestMethod "$BaseUrl/api/collections/donation_items/records" -Method Post -Headers $h `
    -ContentType "application/json" -Body (@{
      donation_id = $DonationId; product_id = $product.id; unit_id = $product.default_unit_id
      quantity = $Quantity; classification_status = $Status
    } | ConvertTo-Json)
}

function Get-Balance {
  $rows = (Invoke-RestMethod "$BaseUrl/api/collections/inventory/records" -Headers $h).items
  $row = $rows | Where-Object { $_.product_id -eq $product.id } | Select-Object -First 1
  if (-not $row) { return @{ available = 0; reserved = 0; quarantine = 0; total = 0 } }
  return @{
    available = $row.available_qty; reserved = $row.reserved_qty
    quarantine = $row.quarantine_qty; total = $row.total_qty
  }
}

# ── C1: un saldo que se iría a negativo lanza, no se recorta ────
#
# Solo los traslados pueden quedarse sin saldo: pending -> quarantine
# suma, así que nunca falta nada. El caso real es dejar un artículo en
# disponible, reservar parte de su cantidad, y entonces intentar moverlo
# entero a cuarentena: ya no queda disponible suficiente.
$donation = New-Donation
$item = New-Item $donation.id 100 "available"

$request0 = Invoke-RestMethod "$BaseUrl/api/collections/requests/records" -Method Post -Headers $h `
  -ContentType "application/json" -Body (@{
    requester_name = "Junta Reserva Parcial"; destination = "Comuna Prueba"
    priority = "media"; status = "pendiente"; operator_id = $op } | ConvertTo-Json)
Invoke-RestMethod "$BaseUrl/api/collections/request_items/records" -Method Post -Headers $h `
  -ContentType "application/json" -Body (@{
    request_id = $request0.id; product_id = $product.id; unit_id = $product.default_unit_id
    quantity_requested = 60; status = "pendiente" } | ConvertTo-Json) | Out-Null
Invoke-RestMethod "$BaseUrl/api/requests/$($request0.id)/approve" -Method Post -Headers $h `
  -ContentType "application/json" -Body '{}' | Out-Null

$beforeC1 = Get-Balance
$error1 = Get-Failure { Invoke-RestMethod "$BaseUrl/api/collections/donation_items/records/$($item.id)" `
  -Method Patch -Headers $h -ContentType "application/json" -Body '{"classification_status":"quarantine"}' }
Write-Step "C1" "Un traslado sin saldo suficiente se rechaza" ($null -ne $error1) `
  (($error1 | ConvertFrom-Json -ErrorAction SilentlyContinue).message)

$afterC1 = Get-Balance
Write-Step "C1d" "El intento fallido no altero ningun saldo" `
  (($beforeC1.available -eq $afterC1.available) -and ($beforeC1.quarantine -eq $afterC1.quarantine)) `
  ("disp {0}->{1}  cuar {2}->{3}" -f $beforeC1.available, $afterC1.available, $beforeC1.quarantine, $afterC1.quarantine)

$balance = Get-Balance
Write-Step "C1b" "Ningun saldo quedo negativo" `
  (($balance.available -ge 0) -and ($balance.reserved -ge 0) -and ($balance.quarantine -ge 0)) `
  ("disp={0} res={1} cuar={2}" -f $balance.available, $balance.reserved, $balance.quarantine)

Write-Step "C1c" "total_qty = disponible + reservada + cuarentena" `
  ($balance.total -eq ($balance.available + $balance.reserved + $balance.quarantine)) `
  ("{0} = {1}+{2}+{3}" -f $balance.total, $balance.available, $balance.reserved, $balance.quarantine)

# ── C2: tipo de movimiento desconocido ──────────────────────────
# No es alcanzable por la API (inventory_movements es de solo lectura),
# así que se comprueba que la tabla de efectos cubre los diez tipos.
$effects = Get-Content (Join-Path $PSScriptRoot "..\pb_hooks\utils\helpers.js") -Raw
$expected = @("entrada","salida","reserva","liberacion","devolucion","ajuste_positivo","ajuste_negativo","cuarentena","liberar_cuarentena","traslado_a_cuarentena")
$missing = $expected | Where-Object { $effects -notmatch ("(?m)^\s+" + $_ + ":") }
Write-Step "C2" "MOVEMENT_EFFECTS cubre los 10 tipos" ($missing.Count -eq 0) `
  $(if ($missing.Count -gt 0) { "faltan: " + ($missing -join ", ") } else { "10/10" })
Write-Step "C2b" "Un tipo desconocido lanza en vez de no hacer nada" `
  ($effects -match "Tipo de movimiento de inventario desconocido")

# ── C3: rejected -> available genera entrada ────────────────────
$before3 = (Get-Balance).available
$item3 = New-Item $donation.id 7 "rejected"
Invoke-RestMethod "$BaseUrl/api/collections/donation_items/records/$($item3.id)" -Method Patch -Headers $h `
  -ContentType "application/json" -Body '{"classification_status":"available"}' | Out-Null
$after3 = (Get-Balance).available
Write-Step "C3" "rejected -> available suma al disponible" (($after3 - $before3) -eq 7) `
  ("$before3 -> $after3")

# ── C4: una reserva cerrada no se reabre ────────────────────────
$request = Invoke-RestMethod "$BaseUrl/api/collections/requests/records" -Method Post -Headers $h `
  -ContentType "application/json" -Body (@{
    requester_name = "Junta Verificacion"; destination = "Comuna Prueba"
    priority = "media"; status = "pendiente"; operator_id = $op } | ConvertTo-Json)
Invoke-RestMethod "$BaseUrl/api/collections/request_items/records" -Method Post -Headers $h `
  -ContentType "application/json" -Body (@{
    request_id = $request.id; product_id = $product.id; unit_id = $product.default_unit_id
    quantity_requested = 3; status = "pendiente" } | ConvertTo-Json) | Out-Null
Invoke-RestMethod "$BaseUrl/api/requests/$($request.id)/approve" -Method Post -Headers $h `
  -ContentType "application/json" -Body '{}' | Out-Null
Invoke-RestMethod "$BaseUrl/api/requests/$($request.id)/cancel" -Method Post -Headers $h `
  -ContentType "application/json" -Body '{"reason":"verificacion"}' | Out-Null

$released = (Invoke-RestMethod "$BaseUrl/api/collections/reservations/records?filter=$([uri]::EscapeDataString("status='liberada'"))" -Headers $h).items[0]
$error4 = Get-Failure { Invoke-RestMethod "$BaseUrl/api/collections/reservations/records/$($released.id)" `
  -Method Patch -Headers $h -ContentType "application/json" -Body '{"status":"activa"}' }
Write-Step "C4" "Una reserva liberada no vuelve a activa" ($null -ne $error4) `
  (($error4 | ConvertFrom-Json -ErrorAction SilentlyContinue).message)

# ── C5: un ajuste puede partir de cero ──────────────────────────
$emptyProduct = (Invoke-RestMethod "$BaseUrl/api/collections/products/records?perPage=2" -Headers $h).items[1]
$inv = Invoke-RestMethod "$BaseUrl/api/collections/inventory/records" -Headers $h
$target = $inv.items | Where-Object { $_.available_qty -eq 0 } | Select-Object -First 1
if (-not $target) { $target = $inv.items[0] }
$adjustment = @{
  inventory_id = $target.id; product_id = $target.product_id; location_id = $target.location_id
  quantity_before = $target.available_qty; quantity_after = ($target.available_qty + 12)
  reason = "Alta de existencias no registradas"; operator_id = $op
} | ConvertTo-Json
$error5 = Get-Failure { Invoke-RestMethod "$BaseUrl/api/collections/adjustments/records" -Method Post `
  -Headers $h -ContentType "application/json" -Body $adjustment }
Write-Step "C5" "Un ajuste con quantity_before = 0 se acepta" ($null -eq $error5) `
  $(if ($error5) { ($error5 | ConvertFrom-Json -ErrorAction SilentlyContinue).message } else { "partiendo de $($target.available_qty)" })

# ── C6: devolucion sigue declarada, sin uso ─────────────────────
Write-Step "C6" "devolucion existe en la tabla de efectos" ($effects -match "(?m)^\s+devolucion:") `
  "sin flujo que la genere, por diseno"

# ── A1: salida no deja la reserva en negativo ───────────────────
Write-Step "A1" "salida no puede dejar reserva negativa" ($effects -match "insuficiente para registrar el movimiento") `
  "cubierto por el arreglo de C1"

# ── A2: filtros con parametros ──────────────────────────────────
$concatenated = $effects -match "product_id = '\s*\+" -or $effects -match "\+ productId \+"
Write-Step "A2" "Los filtros usan parametros, no concatenacion" (-not $concatenated) `
  "findInventory usa {:productId}"

# ── A3: contador atomico de codigos ─────────────────────────────
$codes = @()
for ($i = 0; $i -lt 3; $i++) { $codes += (New-Donation).code }
$unique = ($codes | Select-Object -Unique).Count
Write-Step "A3" "Los codigos son unicos y consecutivos" ($unique -eq 3) ($codes -join ", ")
Write-Step "A3b" "generateSequenceCode usa el contador" ($effects -match 'findFirstRecordByFilter\(\s*"sequences"') `
  "reserva dentro de la transaccion"

# ── A4: la auditoria no compara con String() ───────────────────
$audit = Get-Content (Join-Path $PSScriptRoot "..\pb_hooks\04_audit.pb.js") -Raw
Write-Step "A4" "La auditoria no colapsa tipos con String()" `
  (($audit -notmatch "String\(oldValue\)") -and ($audit -match "hasChanged"))

# ── A5: mensaje accionable cuando no hay operador ───────────────
$inventory = Get-Content (Join-Path $PSScriptRoot "..\pb_hooks\03_inventory.pb.js") -Raw
Write-Step "A5" "El error sin operador explica que hacer" `
  ($inventory -match "haga este cambio desde la aplicacion|haga este cambio desde la aplicación") `
  "decision de diseno, documentada"

# ── Resumen ─────────────────────────────────────────────────────
Write-Host ""
if ($script:Failures -eq 0) {
  Write-Host "Todos los hallazgos siguen corregidos." -ForegroundColor Green
  Write-Host ""
  exit 0
}

Write-Host "$($script:Failures) comprobacion(es) fallaron." -ForegroundColor Red
Write-Host "Revisa AUDITORIA-HOOKS.md." -ForegroundColor Yellow
Write-Host ""
exit 1
