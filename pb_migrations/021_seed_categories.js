migrate((app) => {
  const collection = app.findCollectionByNameOrId("categories")

  const categories = [
    { name: "Pastas y Sopas",          group: "Alimentos y Bebidas",        description: "Pasta, fideos, sopa instantánea",          sort_order: 1 },
    { name: "Arroz y Legumbres",       group: "Alimentos y Bebidas",        description: "Arroz, frijol, lenteja, garbanzo",         sort_order: 2 },
    { name: "Aceites y Vinagres",      group: "Alimentos y Bebidas",        description: "Aceites vegetales, vinagre",               sort_order: 3 },
    { name: "Enlatados y Conservas",   group: "Alimentos y Bebidas",        description: "Atún, sardina, frijoles enlatados, verduras enlatadas", sort_order: 4 },
    { name: "Pan y Cereales",          group: "Alimentos y Bebidas",        description: "Pan dulce, pan Bimbol, cereal, avena",     sort_order: 5 },
    { name: "Chiles y Salsas",         group: "Alimentos y Bebidas",        description: "Chile enlatado, salsa de tomate, chiles secos", sort_order: 6 },
    { name: "Leche y Lácteos",         group: "Alimentos y Bebidas",        description: "Leche en polvo, leche evaporada, yogurt",  sort_order: 7 },
    { name: "Azúcar y Dulces",         group: "Alimentos y Bebidas",        description: "Azúcar, miel, dulces, chocolate",          sort_order: 8 },
    { name: "Café y Bebidas Calientes", group: "Alimentos y Bebidas",       description: "Café soluble, té, chocolate en polvo",     sort_order: 9 },
    { name: "Bebidas Frías",           group: "Alimentos y Bebidas",        description: "Jugo, refresco, bebida en polvo, electrolitos", sort_order: 10 },
    { name: "Avena y Cereales",        group: "Alimentos y Bebidas",        description: "Avena, granola, cereal en hojuelas",       sort_order: 11 },
    { name: "Galletas y Botanas",      group: "Alimentos y Bebidas",        description: "Galletas saladas, galletas dulces, papitas", sort_order: 12 },
    { name: "Especias y Condimentos",  group: "Alimentos y Bebidas",        description: "Sal, pimienta, comino, caldo de pollo",    sort_order: 13 },
    { name: "Proteínas y Suplementos", group: "Alimentos y Bebidas",        description: "Proteína en polvo, barras energéticas",    sort_order: 14 },

    { name: "Agua Embotellada",        group: "Agua",                       description: "Garrafones, botellones de agua purificada", sort_order: 15 },
    { name: "Bolsas de Agua",          group: "Agua",                       description: "Bolsas de agua purificada",                sort_order: 16 },
    { name: "Pastillas Potabilizadoras", group: "Agua",                     description: "Pastillas o gotas para potabilizar agua",  sort_order: 17 },
    { name: "Hielo",                   group: "Agua",                       description: "Hielo para conservación",                  sort_order: 18 },

    { name: "Jabón y Shampoo",         group: "Higiene Personal",           description: "Jabón de barra, jabón líquido, shampoo",   sort_order: 19 },
    { name: "Pasta de Dientes",        group: "Higiene Personal",           description: "Pasta dental, cepillo de dientes",         sort_order: 20 },
    { name: "Toallas Húmedas",         group: "Higiene Personal",           description: "Toallitas húmedas, baby wipes",            sort_order: 21 },
    { name: "Papel Higiénico",         group: "Higiene Personal",           description: "Rollo de papel higiénico",                 sort_order: 22 },
    { name: "Toallas Femeninas",       group: "Higiene Personal",           description: "Toallas sanitarias, pantiprotectores",     sort_order: 23 },
    { name: "Pañales",                 group: "Higiene Personal",           description: "Pañales desechables para bebés y adultos", sort_order: 24 },
    { name: "Desodorante",             group: "Higiene Personal",           description: "Desodorante en barra, spray, roll-on",     sort_order: 25 },
    { name: "Protección Solar",        group: "Higiene Personal",           description: "Bloqueador solar, after sun",              sort_order: 26 },
    { name: "Repelente de Insectos",   group: "Higiene Personal",           description: "Repelente en spray, crema, parches",       sort_order: 27 },
    { name: "Mantas y Abarrotas",      group: "Higiene Personal",           description: "Mantas, pañales de tela, abarrotas",       sort_order: 28 },

    { name: "Cloro y Desinfectantes",  group: "Limpieza del Hogar",         description: "Cloro, desinfectante multiusos",           sort_order: 29 },
    { name: "Jabón para Ropa",         group: "Limpieza del Hogar",         description: "Jabón en barra, detergente líquido",       sort_order: 30 },
    { name: "Detergente",              group: "Limpieza del Hogar",         description: "Detergente en polvo o líquido",            sort_order: 31 },
    { name: "Jabón para Trastes",      group: "Limpieza del Hogar",         description: "Jabón lavaloza líquido",                   sort_order: 32 },
    { name: "Escobas y Trapos",        group: "Limpieza del Hogar",         description: "Escobas, trapeadores, jergas, recogedores", sort_order: 33 },

    { name: "Ropa Interior",           group: "Ropa y Calzado",             description: "Ropa interior nueva (hombre, mujer, niño)", sort_order: 34 },
    { name: "Calcetines",              group: "Ropa y Calzado",             description: "Calcetines y medias",                      sort_order: 35 },
    { name: "Playeras",                group: "Ropa y Calzado",             description: "Playeras y camisetas",                     sort_order: 36 },
    { name: "Pantalones",              group: "Ropa y Calzado",             description: "Pantalones, jeans, shorts",                sort_order: 37 },
    { name: "Calzado",                 group: "Ropa y Calzado",             description: "Zapatos, tenis, sandalias",                sort_order: 38 },
    { name: "Ropa de Abrigo",          group: "Ropa y Calzado",             description: "Sudaderas, chamaras, gorros, guantes",     sort_order: 39 },

    { name: "Analgésicos",             group: "Medicamentos y Botiquines",  description: "Paracetamol, ibuprofeno, aspirina",        sort_order: 40 },
    { name: "Antigripales",            group: "Medicamentos y Botiquines",  description: "Medicamentos para gripe y resfriado",      sort_order: 41 },
    { name: "Antidiarreicos",          group: "Medicamentos y Botiquines",  description: "Loperamida, sales de rehidratación",       sort_order: 42 },
    { name: "Material de Curación",    group: "Medicamentos y Botiquines",  description: "Gasas, vendas, cinta médica, alcohol",     sort_order: 43 },
    { name: "Botiquines Armados",      group: "Medicamentos y Botiquines",  description: "Botiquines completos pre-armados",         sort_order: 44 },

    { name: "Herramientas Manuales",   group: "Herramientas y Equipos",     description: "Pala, pico, martillo, desarmador",         sort_order: 45 },
    { name: "Linternas y Pilas",       group: "Herramientas y Equipos",     description: "Linternas, velas, pilas, mecheros",        sort_order: 46 },
    { name: "Equipos de Protección",   group: "Herramientas y Equipos",     description: "Casco, guantes de trabajo, lentes, tapabocas", sort_order: 47 },

    { name: "Cobijas",                 group: "Cobijas y Colchonetas",      description: "Cobijas y frazadas",                       sort_order: 48 },
    { name: "Colchonetas",             group: "Cobijas y Colchonetas",      description: "Colchonetas de espuma, colchones inflables", sort_order: 49 },
    { name: "Sacos de Dormir",         group: "Cobijas y Colchonetas",      description: "Sacos de dormir y sleeping bags",          sort_order: 50 },

    { name: "Láminas y Estructuras",   group: "Materiales de Construcción", description: "Láminas de zinc, láminas galvanizadas, perlines", sort_order: 51 },
    { name: "Cemento y Agregados",     group: "Materiales de Construcción", description: "Cemento, arena, grava, cal",               sort_order: 52 },

    { name: "Despensas",               group: "Despensas Armadas",          description: "Despensa básica armada (alimentos no perecederos)", sort_order: 53 },

    { name: "Alimento para Mascotas",  group: "Mascotas",                   description: "Croquetas y alimento para perros y gatos", sort_order: 54 },
    { name: "Suministros Mascotas",    group: "Mascotas",                   description: "Correas, collares, comederos, jaulas",     sort_order: 55 }
  ]

  for (const c of categories) {
    const group = app.findFirstRecordByFilter("groups", "name = {:val}", { "val": c.group })
    const record = new Record(collection)
    record.set("name", c.name)
    record.set("group_id", group.id)
    record.set("description", c.description)
    record.set("sort_order", c.sort_order)
    record.set("active", true)
    app.save(record)
  }
}, (app) => {
  try {
    const categoryNames = [
      "Pastas y Sopas", "Arroz y Legumbres", "Aceites y Vinagres", "Enlatados y Conservas",
      "Pan y Cereales", "Chiles y Salsas", "Leche y Lácteos", "Azúcar y Dulces",
      "Café y Bebidas Calientes", "Bebidas Frías", "Avena y Cereales", "Galletas y Botanas",
      "Especias y Condimentos", "Proteínas y Suplementos", "Agua Embotellada", "Bolsas de Agua",
      "Pastillas Potabilizadoras", "Hielo", "Jabón y Shampoo", "Pasta de Dientes",
      "Toallas Húmedas", "Papel Higiénico", "Toallas Femeninas", "Pañales", "Desodorante",
      "Protección Solar", "Repelente de Insectos", "Mantas y Abarrotas", "Cloro y Desinfectantes",
      "Jabón para Ropa", "Detergente", "Jabón para Trastes", "Escobas y Trapos", "Ropa Interior",
      "Calcetines", "Playeras", "Pantalones", "Calzado", "Ropa de Abrigo", "Analgésicos",
      "Antigripales", "Antidiarreicos", "Material de Curación", "Botiquines Armados",
      "Herramientas Manuales", "Linternas y Pilas", "Equipos de Protección", "Cobijas",
      "Colchonetas", "Sacos de Dormir", "Láminas y Estructuras", "Cemento y Agregados",
      "Despensas", "Alimento para Mascotas", "Suministros Mascotas"
    ]
    for (const name of categoryNames) {
      try {
        const record = app.findFirstRecordByFilter("categories", "name = {:val}", { "val": name })
        app.delete(record)
      } catch (_) {}
    }
  } catch (_) {}
})
