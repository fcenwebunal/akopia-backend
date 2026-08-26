// `updateInventoryQuantities` (utils/helpers.js) llevaba desde el
// principio del proyecto sumando y restando cantidades sobre el saldo
// guardado sin redondear nunca -- `available_qty += efecto * cantidad`,
// en punto flotante, cientos de veces por producto. Cada suma individual
// pierde una fracción de bit imposible de notar sola, pero no desaparece:
// se va acumulando en el propio saldo guardado, movimiento tras
// movimiento. Encontrado por Juan Manuel el 25 de agosto viendo saldos
// como "202.99000000000012" o "971.01" paquetes en producción -- no son
// cantidades reales, son ruido acumulado. Corregido hacia adelante en la
// misma migración que agrega esta (`updateInventoryQuantities` ahora
// redondea a 3 decimales después de cada movimiento), pero eso no
// arregla lo que ya está guardado.
//
// Esta migración reconstruye cada saldo desde cero, sumando en una sola
// pasada todos los movimientos reales de `inventory_movements` para su
// producto+ubicación -- el libro, no el saldo cacheado, es la fuente de
// verdad ("un saldo nunca se edita a mano, se registra un movimiento y
// el saldo es su consecuencia"). Un renglón sin ningún movimiento que lo
// respalde se deja intacto en vez de ponerlo en cero -- sería más
// probable un error de esta migración que un renglón huérfano real.
//
// Mismo mapa de efectos que ya usa `updateInventoryQuantities` -- se
// copia aquí en vez de importarlo porque las migraciones no comparten
// el `require()` de los hooks.
const MOVEMENT_EFFECTS = {
  entrada: { available: 1 },
  devolucion: { available: 1 },
  ajuste_positivo: { available: 1 },
  ajuste_negativo: { available: -1 },
  salida: { reserved: -1 },
  reserva: { available: -1, reserved: 1 },
  liberacion: { available: 1, reserved: -1 },
  cuarentena: { quarantine: 1 },
  liberar_cuarentena: { available: 1, quarantine: -1 },
  traslado_a_cuarentena: { available: -1, quarantine: 1 },
  traslado_salida: { available: -1 },
  traslado_entrada: { available: 1 },
  rechazo: { quarantine: -1 },
}

function round3(n) {
  return Math.round(n * 1000) / 1000
}

migrate((app) => {
  const rows = app.findRecordsByFilter("inventory", "", "", 0, 0)

  for (const row of rows) {
    const productId = row.get("product_id")
    const locationId = row.get("location_id") || ""
    const filter = locationId
      ? "product_id = {:productId} && location_id = {:locationId}"
      : "product_id = {:productId} && location_id = ''"
    const movements = app.findRecordsByFilter(
      "inventory_movements", filter, "", 0, 0,
      { productId: productId, locationId: locationId }
    )

    if (movements.length === 0) {
      continue // sin libro que lo respalde -- no se toca, ver comentario arriba
    }

    const buckets = { available: 0, reserved: 0, quarantine: 0 }
    for (const movement of movements) {
      const effect = MOVEMENT_EFFECTS[movement.get("movement_type")]
      if (!effect) continue
      const quantity = movement.get("quantity")
      for (const bucket in effect) {
        buckets[bucket] += effect[bucket] * quantity
      }
    }

    row.set("available_qty", Math.max(0, round3(buckets.available)))
    row.set("reserved_qty", Math.max(0, round3(buckets.reserved)))
    row.set("quarantine_qty", Math.max(0, round3(buckets.quarantine)))
    row.set(
      "total_qty",
      round3(
        Math.max(0, round3(buckets.available)) +
          Math.max(0, round3(buckets.reserved)) +
          Math.max(0, round3(buckets.quarantine))
      )
    )
    app.save(row)
  }
}, (app) => {
  // Sin rollback con sentido: no hay forma de recuperar el ruido de
  // punto flotante que esto quita, y no habría por qué querer
  // recuperarlo. Deja los saldos reconciliados tal como quedaron.
})
