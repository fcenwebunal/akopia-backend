// Para que crear un producto nuevo dentro de una categoría sugiera su
// unidad en vez de obligar a elegir entre las 20 cada vez: "Café y
// Bebidas Calientes" casi siempre se mide en gramos, "Cemento y
// Agregados" en bultos. Opcional — una categoría sin unidad declarada
// simplemente deja el selector vacío al crear un producto dentro de
// ella, y quien crea el producto elige. No reemplaza el `default_unit_id`
// de cada producto, que sigue siendo obligatorio: solo lo sugiere.

migrate((app) => {
  const unitsCollection = app.findCollectionByNameOrId("units")
  const collection = app.findCollectionByNameOrId("categories")

  collection.fields.add(new RelationField({
    name: "default_unit_id",
    collectionId: unitsCollection.id,
    cascadeDelete: false,
    maxSelect: 1,
  }))

  app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("categories")
  collection.fields.removeByName("default_unit_id")
  app.save(collection)
})
