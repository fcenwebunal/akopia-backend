// Dos atributos nuevos por remesa recibida (no por producto): la
// talla, cuando el producto se mide en la unidad Prenda, y cuántas
// unidades individuales trae cada paquete, cuando se mide en
// Paquete/Caja/Cubeta. Se capturan cada vez que se registra un
// artículo, igual que `batch_code`/`expiry_date` — el mismo producto
// puede llegar con tallas o tamaños de empaque distintos según la
// donación, así que no tiene sentido fijarlos una sola vez en el
// catálogo.
//
// `size` es texto libre, no un SelectField: la interfaz ofrece un
// desplegable con Única/XS/S/M/L/XL/XXL más una opción "Numérica" que
// abre un campo de texto, pero el valor final que se guarda es
// siempre una sola cadena ("M", "40", "Única") — un enum en el
// backend no podría representar el caso numérico sin abrir el rango
// completo de valores posibles.
//
// `units_per_package` no lleva `required: true` a propósito: no
// aplica a la mayoría de los artículos (solo a paquete/caja/cubeta),
// y la obligatoriedad real vive en la pantalla, no en el esquema —
// mismo criterio que ya usó la migración `049` para los campos de
// peso de recepción rápida.

migrate((app) => {
  const collection = app.findCollectionByNameOrId("donation_items")

  collection.fields.add(new TextField({ name: "size", max: 20 }))
  collection.fields.add(new NumberField({ name: "units_per_package", noDecimal: true, min: 1 }))

  app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("donation_items")

  collection.fields.removeByName("size")
  collection.fields.removeByName("units_per_package")

  app.save(collection)
})
