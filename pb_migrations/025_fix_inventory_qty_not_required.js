// A balance of zero is a normal state: a product can sit with 40
// available and 0 reserved. PocketBase treats 0 as blank on a
// required NumberField, so `required: true` made those rows
// impossible to save and blocked every first inventory entry.
// min: 0 still keeps the balances from going negative.

const QUANTITY_FIELDS = [
  "available_qty",
  "reserved_qty",
  "quarantine_qty",
  "total_qty",
]

migrate((app) => {
  const collection = app.findCollectionByNameOrId("inventory")

  for (const name of QUANTITY_FIELDS) {
    collection.fields.getByName(name).required = false
  }

  app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("inventory")

  for (const name of QUANTITY_FIELDS) {
    collection.fields.getByName(name).required = true
  }

  app.save(collection)
})
