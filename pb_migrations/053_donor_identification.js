// Identificación del donante: tipo de documento (nuevo) y número
// (reutiliza `donor_rfc`, renombrado). `donor_rfc` nunca se conectó
// en el frontend — es el campo mexicano que el CLAUDE.md ya tenía
// anotado como deuda técnica ("sería NIT") — así que renombrarlo no
// migra ningún dato real, solo corrige el nombre antes de que se
// empiece a usar.
//
// Los tres campos de esta migración son opcionales, igual que ya lo
// era `donor_rfc`: un centro de acopio no puede exigirle documento a
// quien dona.

migrate((app) => {
  const collection = app.findCollectionByNameOrId("donations")

  collection.fields.add(new SelectField({
    name: "donor_id_type",
    values: ["cedula_ciudadania", "cedula_extranjeria", "nit", "pasaporte", "otro"],
    maxSelect: 1,
  }))

  const idNumber = collection.fields.getByName("donor_rfc")
  idNumber.name = "donor_id_number"

  app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("donations")

  const rfc = collection.fields.getByName("donor_id_number")
  rfc.name = "donor_rfc"

  collection.fields.removeByName("donor_id_type")

  app.save(collection)
})
