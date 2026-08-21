// "Pieza" se renombra a "Unidad" — code y name a la vez, porque
// unitLabel() en el frontend muestra `code` antes que `name`
// (catalog.ts): renombrar solo el nombre habría dejado "PIEZA"
// visible en toda la app.
//
// Se agregan dos unidades nuevas: Tabletas (medicamentos sólidos) y
// Prenda (ropa, con talla — ver migración 052).
//
// Juego, Par, Docena, Rollo, Saco, Tambor y Tubo se retiran por
// desactivación, no por borrado — mismo patrón que ya usa todo el
// catálogo (grupos/categorías/productos nunca se borran, solo
// `active: false`). Par, Rollo, Saco y Tubo ya son la unidad de 11
// productos reales del catálogo sembrado (Calcetines, Calzado,
// Guantes → Par; Vendas, Cinta médica → Rollo; Cemento, Cal,
// Croquetas → Saco; Pasta dental → Tubo): desactivar en vez de
// borrar los deja funcionando exactamente igual, solo dejan de
// ofrecerse para productos nuevos. Juego, Docena y Tambor no los usa
// ningún producto.

const RETIRED_CODES = ["JUEGO", "PAR", "DOCENA", "ROLLO", "SACO", "TAMBOR", "TUBO"]

migrate((app) => {
  const collection = app.findCollectionByNameOrId("units")

  const pieza = app.findFirstRecordByFilter("units", "code = 'PIEZA'")
  pieza.set("code", "UNIDAD")
  pieza.set("name", "Unidad")
  app.save(pieza)

  const nuevas = [
    { code: "TABLETAS", name: "Tabletas", description: "Unidad individual de medicamento sólido" },
    { code: "PRENDA", name: "Prenda", description: "Prenda de vestir individual" },
  ]
  for (const u of nuevas) {
    const record = new Record(collection)
    record.set("code", u.code)
    record.set("name", u.name)
    record.set("description", u.description)
    record.set("is_countable", true)
    record.set("active", true)
    app.save(record)
  }

  for (const code of RETIRED_CODES) {
    try {
      const record = app.findFirstRecordByFilter("units", "code = {:code}", { code })
      record.set("active", false)
      app.save(record)
    } catch (_) {}
  }
}, (app) => {
  try {
    const record = app.findFirstRecordByFilter("units", "code = 'UNIDAD'")
    record.set("code", "PIEZA")
    record.set("name", "Pieza")
    app.save(record)
  } catch (_) {}

  for (const code of ["TABLETAS", "PRENDA"]) {
    try {
      const record = app.findFirstRecordByFilter("units", "code = {:code}", { code })
      app.delete(record)
    } catch (_) {}
  }

  for (const code of RETIRED_CODES) {
    try {
      const record = app.findFirstRecordByFilter("units", "code = {:code}", { code })
      record.set("active", true)
      app.save(record)
    } catch (_) {}
  }
})
