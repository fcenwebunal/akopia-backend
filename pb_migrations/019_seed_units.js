migrate((app) => {
  const collection = app.findCollectionByNameOrId("units")

  const nonCountableCodes = ["BULTO", "COSTAL", "CUBETA", "GARRAFA", "TAMBOR", "TUBO"]

  const units = [
    { code: "PIEZA",     name: "Pieza",     description: "Unidad individual" },
    { code: "PAQUETE",   name: "Paquete",   description: "Conjunto empaquetado de artículos" },
    { code: "CAJA",      name: "Caja",      description: "Contenedor rígido con múltiples piezas" },
    { code: "BOLSA",     name: "Bolsa",     description: "Contenedor flexible de artículos" },
    { code: "LATA",      name: "Lata",      description: "Envase metálico sellado" },
    { code: "BOTELLA",   name: "Botella",   description: "Envase de vidrio o plástico" },
    { code: "FRASCO",    name: "Frasco",    description: "Envase de vidrio con tapa" },
    { code: "SACO",      name: "Saco",      description: "Contenedor de tela o plástico grande" },
    { code: "ROLLO",     name: "Rollo",     description: "Material enrollado (cinta, tela, etc.)" },
    { code: "LITRO",     name: "Litro",     description: "Unidad de volumen líquido (1000 ml)" },
    { code: "KILOGRAMO", name: "Kilogramo", description: "Unidad de peso (1000 gramos)" },
    { code: "PAR",       name: "Par",       description: "Conjunto de dos piezas" },
    { code: "JUEGO",     name: "Juego",     description: "Conjunto de piezas relacionadas" },
    { code: "DOCENA",    name: "Docena",    description: "Conjunto de doce piezas" },
    { code: "BULTO",     name: "Bulto",     description: "Contenedor genérico de cantidad variable" },
    { code: "COSTAL",    name: "Costal",    description: "Saco grande para grano o material" },
    { code: "CUBETA",    name: "Cubeta",    description: "Contenedor rígido con asa" },
    { code: "GARRAFA",   name: "Garrafa",   description: "Recipiente grande para líquidos" },
    { code: "TAMBOR",    name: "Tambor",    description: "Recipiente cilíndrico grande" },
    { code: "TUBO",      name: "Tubo",      description: "Recipiente cilíndrico pequeño" }
  ]

  for (const u of units) {
    const record = new Record(collection)
    record.set("code", u.code)
    record.set("name", u.name)
    record.set("description", u.description)
    record.set("is_countable", !nonCountableCodes.includes(u.code))
    record.set("active", true)
    app.save(record)
  }
}, (app) => {
  try {
    const collection = app.findCollectionByNameOrId("units")
    const codes = ["PIEZA", "PAQUETE", "CAJA", "BOLSA", "LATA", "BOTELLA", "FRASCO", "SACO", "ROLLO", "LITRO", "KILOGRAMO", "PAR", "JUEGO", "DOCENA", "BULTO", "COSTAL", "CUBETA", "GARRAFA", "TAMBOR", "TUBO"]
    for (const code of codes) {
      try {
        const record = app.findFirstRecordByFilter("units", "code = {:val}", { "val": code })
        app.delete(record)
      } catch (_) {}
    }
  } catch (_) {}
})
