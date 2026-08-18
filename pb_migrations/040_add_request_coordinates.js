// Coordenadas del destino de una solicitud, capturadas desde el momento
// en que se crea — no solo en el despacho. Antes solo `dispatches` tenía
// lat/lng (migración 039); cada despacho arrancaba con el mapa centrado
// en Manizales, sin punto propio, aunque la solicitud que lo originó ya
// tenía una dirección de texto. Con esto la solicitud es la única fuente
// de la ubicación real, y el despacho la hereda como valor por defecto
// (editable, por si el vehículo termina yendo a un punto distinto).
//
// Mismo rango que en dispatches: acota a un área razonable alrededor de
// Manizales, no a sus límites exactos.

migrate((app) => {
  const collection = app.findCollectionByNameOrId("requests")

  collection.fields.add(new NumberField({
    name: "destination_lat",
    min: 4.9,
    max: 5.2,
  }))
  collection.fields.add(new NumberField({
    name: "destination_lng",
    min: -75.7,
    max: -75.3,
  }))

  app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("requests")
  collection.fields.removeByName("destination_lat")
  collection.fields.removeByName("destination_lng")
  app.save(collection)
})
