// Tope razonable en `quantity_requested`, a nivel de esquema — la misma
// vía que ya usa el resto de campos numéricos del proyecto (`min`/`max`
// declarativos, no un hook aparte). No limita a lo que hay en bodega:
// eso sigue siendo intencional (una solicitud puede pedir de más para
// registrar demanda insatisfecha, ver "Productos faltantes"; quien de
// verdad compromete inventario es /api/requests/{id}/approve, que ya
// rechaza con el detalle exacto de qué falta). Esto solo atrapa un
// error de tecleo o un valor absurdo antes de que llegue a la base.

migrate((app) => {
  const collection = app.findCollectionByNameOrId("request_items")
  collection.fields.getByName("quantity_requested").max = 100000
  app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("request_items")
  collection.fields.getByName("quantity_requested").max = null
  app.save(collection)
})
