// Amplía el catálogo real con lo que de verdad se ha donado y no tenía
// dónde clasificarse (ver PROPUESTA-AMPLIACION-CATALOGO.md, raíz del
// proyecto): 3 grupos nuevos, 9 categorías nuevas, 55 productos nuevos.
// Puramente aditiva -- nada existente se toca ni se borra, mismo patrón
// que 019-022.

migrate((app) => {
  const groupsCollection = app.findCollectionByNameOrId("groups")
  const categoriesCollection = app.findCollectionByNameOrId("categories")
  const productsCollection = app.findCollectionByNameOrId("products")

  const newGroups = [
    { name: "Juguetes", description: "Juguetes para niños y niñas", sort_order: 12 },
    { name: "Útiles Escolares", description: "Material escolar", sort_order: 13 },
    { name: "Hogar", description: "Artículos generales del hogar", sort_order: 14 },
  ]
  for (const g of newGroups) {
    const record = new Record(groupsCollection)
    record.set("name", g.name)
    record.set("description", g.description)
    record.set("sort_order", g.sort_order)
    record.set("active", true)
    app.save(record)
  }

  const newCategories = [
    { name: "Juguetes", group: "Juguetes", description: "Juguetes en general", sort_order: 56 },
    { name: "Útiles Escolares", group: "Útiles Escolares", description: "Lápices, colores, cuadernos y afines", sort_order: 57 },
    { name: "Artículos del Hogar", group: "Hogar", description: "Menaje y artículos generales del hogar", sort_order: 58 },
    { name: "Otros Medicamentos", group: "Medicamentos y Botiquines", description: "Medicamentos con nombre comercial que no encajan en las clases genéricas existentes", sort_order: 59 },
    { name: "Cuidado del Bebé", group: "Higiene Personal", description: "Jabón, aceite y crema para bebé", sort_order: 60 },
    { name: "Cuidado Personal Adicional", group: "Higiene Personal", description: "Artículos de aseo personal sin categoría propia", sort_order: 61 },
    { name: "Otros de Limpieza", group: "Limpieza del Hogar", description: "Productos de limpieza sin categoría propia", sort_order: 62 },
    { name: "Harinas", group: "Alimentos y Bebidas", description: "Harina de trigo, harina de maíz", sort_order: 63 },
    { name: "Alimento para Bebé", group: "Alimentos y Bebidas", description: "Compotas y alimentos preparados para bebé", sort_order: 64 },
  ]
  for (const c of newCategories) {
    const group = app.findFirstRecordByFilter("groups", "name = {:val}", { "val": c.group })
    const record = new Record(categoriesCollection)
    record.set("name", c.name)
    record.set("group_id", group.id)
    record.set("description", c.description)
    record.set("sort_order", c.sort_order)
    record.set("active", true)
    app.save(record)
  }

  const newProducts = [
    // Juguetes
    { name: "Libro infantil", category: "Juguetes", unit: "UNIDAD" },
    { name: "Juguete de plástico", category: "Juguetes", unit: "UNIDAD" },
    { name: "Caja de juego", category: "Juguetes", unit: "UNIDAD" },
    { name: "Muñecas", category: "Juguetes", unit: "UNIDAD" },
    { name: "Peluche", category: "Juguetes", unit: "UNIDAD" },
    { name: "Carro de juguete", category: "Juguetes", unit: "UNIDAD" },
    { name: "Pelotas de trapo", category: "Juguetes", unit: "PAQUETE" },
    { name: "Juego de raquetas", category: "Juguetes", unit: "UNIDAD" },

    // Útiles Escolares
    { name: "Colores", category: "Útiles Escolares", unit: "PAQUETE" },
    { name: "Borradores", category: "Útiles Escolares", unit: "UNIDAD" },
    { name: "Sacapuntas", category: "Útiles Escolares", unit: "UNIDAD" },
    { name: "Lápices", category: "Útiles Escolares", unit: "UNIDAD" },
    { name: "Plastilina", category: "Útiles Escolares", unit: "PAQUETE" },
    { name: "Cartuchera", category: "Útiles Escolares", unit: "UNIDAD" },

    // Hogar
    { name: "Vasos desechables", category: "Artículos del Hogar", unit: "PAQUETE" },
    { name: "Bolsas de basura", category: "Artículos del Hogar", unit: "PAQUETE" },
    { name: "Almohadas", category: "Artículos del Hogar", unit: "UNIDAD" },
    { name: "Acolchado", category: "Artículos del Hogar", unit: "UNIDAD" },

    // Otros Medicamentos
    { name: "Zelix", category: "Otros Medicamentos", unit: "TABLETAS" },
    { name: "Tiquetín", category: "Otros Medicamentos", unit: "TABLETAS" },
    { name: "Desvenlafaxina", category: "Otros Medicamentos", unit: "TABLETAS" },
    { name: "Omnidol", category: "Otros Medicamentos", unit: "TABLETAS" },
    { name: "Lansoprazol", category: "Otros Medicamentos", unit: "TABLETAS" },
    { name: "Aciclovir", category: "Otros Medicamentos", unit: "TABLETAS" },
    { name: "Esomeprazol", category: "Otros Medicamentos", unit: "TABLETAS" },
    { name: "Diovan", category: "Otros Medicamentos", unit: "TABLETAS" },
    { name: "Astigmin parche", category: "Otros Medicamentos", unit: "UNIDAD" },

    // Cuidado del Bebé
    { name: "Jabón para bebé", category: "Cuidado del Bebé", unit: "UNIDAD" },
    { name: "Crema antipañalitis", category: "Cuidado del Bebé", unit: "UNIDAD" },
    { name: "Aceite para bebé", category: "Cuidado del Bebé", unit: "BOTELLA" },

    // Cuidado Personal Adicional
    { name: "Máquina de afeitar", category: "Cuidado Personal Adicional", unit: "UNIDAD" },
    { name: "Kits dentales", category: "Cuidado Personal Adicional", unit: "UNIDAD" },
    { name: "Seda dental", category: "Cuidado Personal Adicional", unit: "UNIDAD" },
    { name: "Talco", category: "Cuidado Personal Adicional", unit: "UNIDAD" },
    { name: "Toalla de cuerpo", category: "Cuidado Personal Adicional", unit: "UNIDAD" },
    { name: "Preservativos", category: "Cuidado Personal Adicional", unit: "CAJA" },
    { name: "Tampones", category: "Cuidado Personal Adicional", unit: "CAJA" },

    // Otros de Limpieza
    { name: "Quintamanchas", category: "Otros de Limpieza", unit: "BOTELLA" },
    { name: "Limpiapisos", category: "Otros de Limpieza", unit: "BOTELLA" },

    // Harinas
    { name: "Harina de trigo", category: "Harinas", unit: "KILOGRAMO" },
    { name: "Harina de maíz", category: "Harinas", unit: "KILOGRAMO" },

    // Alimento para Bebé
    { name: "Compota", category: "Alimento para Bebé", unit: "UNIDAD" },

    // Productos nuevos en categorías YA existentes
    { name: "Protectores diarios", category: "Toallas Femeninas", unit: "PAQUETE" },
    { name: "Curitas", category: "Material de Curación", unit: "CAJA" },
    { name: "Agua oxigenada", category: "Material de Curación", unit: "BOTELLA" },
    { name: "Crema antiinflamatoria", category: "Material de Curación", unit: "UNIDAD" },
    { name: "Algodón", category: "Material de Curación", unit: "PAQUETE" },
    { name: "Abrigo", category: "Ropa de Abrigo", unit: "UNIDAD" },
    { name: "Saco", category: "Ropa de Abrigo", unit: "UNIDAD" },
    { name: "Blusa", category: "Playeras", unit: "UNIDAD" },
    { name: "Arveja", category: "Arroz y Legumbres", unit: "KILOGRAMO" },
    { name: "Blanquillos", category: "Arroz y Legumbres", unit: "KILOGRAMO" },
    { name: "Panela", category: "Azúcar y Dulces", unit: "KILOGRAMO" },
    { name: "Condimentos varios", category: "Especias y Condimentos", unit: "UNIDAD" },
    { name: "Enlatados varios", category: "Enlatados y Conservas", unit: "UNIDAD" },
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
    record.set("requires_quarantine", p.category === "Otros Medicamentos")
    record.set("is_fragile", false)
    record.set("is_hazardous", false)
    record.set("active", true)
    app.save(record)
  }
}, (app) => {
  const productNames = [
    "Libro infantil", "Juguete de plástico", "Caja de juego", "Muñecas", "Peluche",
    "Carro de juguete", "Pelotas de trapo", "Juego de raquetas",
    "Colores", "Borradores", "Sacapuntas", "Lápices", "Plastilina", "Cartuchera",
    "Vasos desechables", "Bolsas de basura", "Almohadas", "Acolchado",
    "Zelix", "Tiquetín", "Desvenlafaxina", "Omnidol", "Lansoprazol", "Aciclovir",
    "Esomeprazol", "Diovan", "Astigmin parche",
    "Jabón para bebé", "Crema antipañalitis", "Aceite para bebé",
    "Máquina de afeitar", "Kits dentales", "Seda dental", "Talco", "Toalla de cuerpo",
    "Preservativos", "Tampones",
    "Quintamanchas", "Limpiapisos",
    "Harina de trigo", "Harina de maíz",
    "Compota",
    "Protectores diarios", "Curitas", "Agua oxigenada", "Crema antiinflamatoria", "Algodón",
    "Abrigo", "Saco", "Blusa", "Arveja", "Blanquillos", "Panela",
    "Condimentos varios", "Enlatados varios",
  ]
  for (const name of productNames) {
    try {
      const record = app.findFirstRecordByFilter("products", "name = {:val}", { "val": name })
      app.delete(record)
    } catch (_) {}
  }

  const categoryNames = [
    "Juguetes", "Útiles Escolares", "Artículos del Hogar", "Otros Medicamentos",
    "Cuidado del Bebé", "Cuidado Personal Adicional", "Otros de Limpieza",
    "Harinas", "Alimento para Bebé",
  ]
  for (const name of categoryNames) {
    try {
      const record = app.findFirstRecordByFilter("categories", "name = {:val}", { "val": name })
      app.delete(record)
    } catch (_) {}
  }

  const groupNames = ["Juguetes", "Útiles Escolares", "Hogar"]
  for (const name of groupNames) {
    try {
      const record = app.findFirstRecordByFilter("groups", "name = {:val}", { "val": name })
      app.delete(record)
    } catch (_) {}
  }
})
