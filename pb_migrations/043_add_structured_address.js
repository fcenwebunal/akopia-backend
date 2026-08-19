// Nomenclatura urbana colombiana, estructurada en vez de un solo texto
// libre. `destination` se conserva como el texto compuesto (lo sigue
// leyendo el resto del sistema — listados, el mapa de ayuda, cualquier
// integración futura), y estos cuatro campos son el detalle que el
// frontend usa para armarlo y para el formulario de captura con mapa.
// Ninguno es obligatorio: hay direcciones (veredas, sitios sin
// nomenclatura formal) que no encajan en tipo de vía + número + placa,
// y `destination` sigue siendo el campo que de verdad se exige.
//
// `street_plate` es la "placa" de la dirección (lo que va después del
// "#") — se nombra distinto de `dispatches.vehicle_plate` (la placa del
// vehículo) para que no se confundan ni en el esquema ni en el código.

migrate((app) => {
  for (const name of ["requests", "dispatches"]) {
    const collection = app.findCollectionByNameOrId(name)

    collection.fields.add(new SelectField({
      name: "street_type",
      values: ["calle", "carrera", "avenida", "avenida_calle", "avenida_carrera", "diagonal", "transversal", "autopista", "kilometro", "otro"],
      maxSelect: 1,
    }))
    collection.fields.add(new TextField({ name: "street_number", max: 20 }))
    collection.fields.add(new TextField({ name: "street_plate", max: 20 }))
    collection.fields.add(new TextField({ name: "address_complement", max: 200 }))

    app.save(collection)
  }
}, (app) => {
  for (const name of ["requests", "dispatches"]) {
    const collection = app.findCollectionByNameOrId(name)
    collection.fields.removeByName("street_type")
    collection.fields.removeByName("street_number")
    collection.fields.removeByName("street_plate")
    collection.fields.removeByName("address_complement")
    app.save(collection)
  }
})
