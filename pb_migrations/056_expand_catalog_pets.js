// Dos productos reales que se quedaron fuera de la migración 055 al
// construir el reporte de prueba de la importación del histórico
// (INVENTARIO INTERNO): arena para gatos y bolsas para desechos de
// mascotas, donados de verdad, sin equivalente en "Suministros Mascotas".

migrate((app) => {
  const categoriesCollection = app.findCollectionByNameOrId("categories")
  const productsCollection = app.findCollectionByNameOrId("products")

  const newProducts = [
    { name: "Arena para gatos", category: "Suministros Mascotas", unit: "KILOGRAMO" },
    { name: "Bolsa desechos para mascotas", category: "Suministros Mascotas", unit: "PAQUETE" },
  ]

  for (const p of newProducts) {
    const category = app.findFirstRecordByFilter("categories", "name = {:val}", { "val": p.category })
    const unit = app.findFirstRecordByFilter("units", "code = {:val2}", { "val2": p.unit })
    const record = new Record(productsCollection)
    record.set("name", p.name)
    record.set("category_id", category.id)
    record.set("default_unit_id", unit.id)
    record.set("requires_batch", false)
    record.set("requires_expiry", false)
    record.set("requires_quarantine", false)
    record.set("is_fragile", false)
    record.set("is_hazardous", false)
    record.set("active", true)
    app.save(record)
  }
}, (app) => {
  for (const name of ["Arena para gatos", "Bolsa desechos para mascotas"]) {
    try {
      const record = app.findFirstRecordByFilter("products", "name = {:val}", { "val": name })
      app.delete(record)
    } catch (_) {}
  }
})
