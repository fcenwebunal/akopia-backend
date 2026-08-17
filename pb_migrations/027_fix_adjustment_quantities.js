// Mismo defecto que corrigió la 025 sobre `inventory`: PocketBase trata
// el 0 como vacío en un NumberField requerido.
//
// En `adjustments` bloqueaba los dos casos en que más falta hace un
// ajuste: dar de alta existencias que estaban en bodega pero nunca se
// registraron (`quantity_before: 0`), y bajar un saldo hasta cero
// (`quantity_after: 0`). `difference` es calculado por el hook, así que
// tampoco tiene sentido exigirlo.
//
// `min: 0` sigue impidiendo cantidades negativas en before/after.
// `difference` no lleva `min` porque un ajuste negativo lo necesita.

const OPTIONAL_FIELDS = ["quantity_before", "quantity_after", "difference"]

migrate((app) => {
  const collection = app.findCollectionByNameOrId("adjustments")

  for (const name of OPTIONAL_FIELDS) {
    collection.fields.getByName(name).required = false
  }

  app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("adjustments")

  for (const name of OPTIONAL_FIELDS) {
    collection.fields.getByName(name).required = true
  }

  app.save(collection)
})
