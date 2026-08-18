// Dos tipos nuevos para reubicar stock ya clasificado entre ubicaciones
// (o asignarle ubicación por primera vez a lo que está "sin ubicar").
// Van en pareja, como salida/entrada: uno resta en el renglón de
// origen y el otro suma en el de destino, cada uno con su propia fila
// en el libro — el mismo patrón que ya usan reserva/liberación.
//
// No existía ningún camino para esto: `donation_items` bloquea cambiar
// `location_id` una vez que un artículo ya afectó inventario (evita que
// se pierda de dónde salió una donación), así que la única forma de
// mover stock ya ubicado es a nivel de `inventory`, con su propio
// movimiento — nunca reescribiendo el `donation_item` original.

migrate((app) => {
  const collection = app.findCollectionByNameOrId("inventory_movements")
  const field = collection.fields.getByName("movement_type")

  for (const value of ["traslado_salida", "traslado_entrada"]) {
    if (!field.values.includes(value)) {
      field.values.push(value)
    }
  }

  app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("inventory_movements")
  const field = collection.fields.getByName("movement_type")

  field.values = field.values.filter(
    (v) => v !== "traslado_salida" && v !== "traslado_entrada"
  )

  app.save(collection)
})
