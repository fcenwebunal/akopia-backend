// Contador atómico para los códigos correlativos.
//
// Hasta ahora el código se calculaba leyendo el último y sumando uno. Dos
// peticiones simultáneas leían el mismo número y la segunda fallaba con
// 400 por el índice único: no se duplicaba, pero se perdía una donación
// legítima y el operador no entendía por qué.
//
// Con un contador, la reserva del número ocurre dentro de la misma
// transacción que inserta el registro. SQLite serializa las escrituras,
// así que la segunda petición ve el valor ya incrementado.
//
// Se siembra desde el máximo actual de cada colección, para que al
// aplicarla sobre una base con datos el siguiente código continúe la
// serie en vez de chocar con los existentes.

const SEQUENCES = [
  { key: "donations", prefix: "DON-" },
  { key: "requests", prefix: "SOL-" },
  { key: "dispatches", prefix: "DES-" },
]

migrate((app) => {
  const collection = new Collection({
    name: "sequences",
    type: "base",
    // Solo los hooks lo tocan: no se expone por la API.
    listRule: null,
    viewRule: null,
    createRule: null,
    updateRule: null,
    deleteRule: null,
  })

  collection.fields.add(new TextField({ name: "key", required: true, min: 1, max: 50 }))
  collection.fields.add(new NumberField({ name: "next_value", min: 1 }))
  collection.fields.add(new AutodateField({ name: "created", onCreate: true }))
  collection.fields.add(new AutodateField({ name: "updated", onCreate: true, onUpdate: true }))

  collection.indexes = ["CREATE UNIQUE INDEX idx_sequences_key ON sequences (key)"]

  app.save(collection)

  for (const sequence of SEQUENCES) {
    let next = 1

    // Continúa la serie si ya hay registros con código.
    const existing = app.findRecordsByFilter(sequence.key, "", "-code", 1, 0)
    if (existing.length > 0) {
      const parsed = parseInt(String(existing[0].get("code")).replace(sequence.prefix, ""), 10)
      if (!isNaN(parsed)) {
        next = parsed + 1
      }
    }

    const record = new Record(collection)
    record.set("key", sequence.key)
    record.set("next_value", next)
    app.save(record)
  }
}, (app) => {
  const collection = app.findCollectionByNameOrId("sequences")
  app.delete(collection)
})
