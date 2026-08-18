// "rechazo" — el tipo de movimiento para dar de baja lo que quedó en
// cuarentena y no pasa la revisión. A diferencia de traslado_salida/
// traslado_entrada (que van en pareja, mueven saldo de un renglón a
// otro), este no tiene par: resta de `quarantine_qty` y de `total_qty`
// sin sumar en ningún otro lado — es una salida definitiva, no una
// reubicación. Ver utils/helpers.js (MOVEMENT_EFFECTS) y la ruta
// POST /api/inventory/{id}/reject en 05_routes.pb.js.

migrate((app) => {
  const collection = app.findCollectionByNameOrId("inventory_movements")
  const field = collection.fields.getByName("movement_type")

  if (!field.values.includes("rechazo")) {
    field.values.push("rechazo")
  }

  app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("inventory_movements")
  const field = collection.fields.getByName("movement_type")

  field.values = field.values.filter((v) => v !== "rechazo")

  app.save(collection)
})
