// Seis productos reales que aparecieron en el histórico de INGRESO/SALIDAS
// de Google Sheets (segunda entrega de mercados, 24 ago 2026) sin
// equivalente en el catálogo: Maíz pira, Salchicha, Gelatina, Chile con
// carne, Kit dental, Esponjilla. Aditiva, mismo patrón que 055/056.

migrate((app) => {
  const productsCollection = app.findCollectionByNameOrId("products")

  const newProducts = [
    { name: "Maíz pira", category: "Avena y Cereales", unit: "KILOGRAMO" },
    { name: "Salchicha", category: "Proteínas y Suplementos", unit: "KILOGRAMO" },
    { name: "Gelatina", category: "Azúcar y Dulces", unit: "KILOGRAMO" },
    { name: "Chile con carne", category: "Enlatados y Conservas", unit: "KILOGRAMO" },
    { name: "Kit dental", category: "Cuidado Personal Adicional", unit: "PAQUETE" },
    { name: "Esponjilla", category: "Otros de Limpieza", unit: "UNIDAD" },
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
  for (const name of ["Maíz pira", "Salchicha", "Gelatina", "Chile con carne", "Kit dental", "Esponjilla"]) {
    try {
      const record = app.findFirstRecordByFilter("products", "name = {:val}", { "val": name })
      app.delete(record)
    } catch (_) {}
  }
})
