migrate((app) => {
  const collection = app.findCollectionByNameOrId("inventory_movements")
  const field = collection.fields.getByName("movement_type")

  if (!field.values.includes("traslado_a_cuarentena")) {
    field.values.push("traslado_a_cuarentena")
  }

  app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("inventory_movements")
  const field = collection.fields.getByName("movement_type")

  field.values = field.values.filter((v) => v !== "traslado_a_cuarentena")

  app.save(collection)
})
