migrate((app) => {
  const collection = app.findCollectionByNameOrId("groups")

  const groups = [
    { name: "Alimentos y Bebidas",        description: "Productos alimenticios y bebidas",              sort_order: 1 },
    { name: "Agua",                       description: "Agua purificada y envases",                     sort_order: 2 },
    { name: "Higiene Personal",           description: "Artículos de aseo y cuidado personal",           sort_order: 3 },
    { name: "Limpieza del Hogar",         description: "Productos de limpieza y desinfección",           sort_order: 4 },
    { name: "Ropa y Calzado",             description: "Vestimenta y calzado",                          sort_order: 5 },
    { name: "Medicamentos y Botiquines",  description: "Medicinas y suministros médicos",                sort_order: 6 },
    { name: "Herramientas y Equipos",     description: "Herramientas manuales y equipos",                sort_order: 7 },
    { name: "Cobijas y Colchonetas",      description: "Ropa de cama y descanso",                       sort_order: 8 },
    { name: "Materiales de Construcción", description: "Materiales para reconstrucción",                 sort_order: 9 },
    { name: "Despensas Armadas",          description: "Paquetes pre-armados de despensa",               sort_order: 10 },
    { name: "Mascotas",                   description: "Alimentos y suministros para mascotas",          sort_order: 11 }
  ]

  for (const g of groups) {
    const record = new Record(collection)
    record.set("name", g.name)
    record.set("description", g.description)
    record.set("sort_order", g.sort_order)
    record.set("active", true)
    app.save(record)
  }
}, (app) => {
  try {
    const groupNames = [
      "Alimentos y Bebidas", "Agua", "Higiene Personal", "Limpieza del Hogar",
      "Ropa y Calzado", "Medicamentos y Botiquines", "Herramientas y Equipos",
      "Cobijas y Colchonetas", "Materiales de Construcción", "Despensas Armadas", "Mascotas"
    ]
    for (const name of groupNames) {
      try {
        const record = app.findFirstRecordByFilter("groups", "name = {:val}", { "val": name })
        app.delete(record)
      } catch (_) {}
    }
  } catch (_) {}
})
