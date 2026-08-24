// La migración 057 creó "Kit dental" sin darse cuenta de que ya existía
// "Kits dentales" en el catálogo sembrado (la búsqueda previa no lo
// encontró por el plural). Se desactiva el duplicado recién creado -- sin
// ninguna donación ni inventario asociado todavía, así que es seguro -- en
// vez de borrarlo, mismo criterio de "nada se borra, se desactiva" que ya
// rige el resto del catálogo.

migrate((app) => {
  const record = app.findFirstRecordByFilter("products", "name = {:val}", { "val": "Kit dental" })
  record.set("active", false)
  app.save(record)
}, (app) => {
  const record = app.findFirstRecordByFilter("products", "name = {:val}", { "val": "Kit dental" })
  record.set("active", true)
  app.save(record)
})
