// `weight_kg` en `products`: cuántos kilos pesa UNA unidad de la medida
// por defecto del producto (1 kg si ya se mide en KILOGRAMO, ~1 kg por
// LITRO, y una estimación real para paquete/unidad/botella/caja/lata/
// frasco/saco/etc.). Existe para poder sumar "cuánto hay" entre
// productos que se miden en unidades distintas -- convertidas a un
// denominador común -- sin lo cual solo se puede contar referencias
// distintas, como ya hacía el panel principal (ver comentario en
// akopia-frontend/src/app/(app)/panel/page.tsx).
//
// Pedido explícito de Juan Manuel, incluida la decisión de poblarlo
// ahora con una estimación razonable en vez de dejarlo vacío: son
// pesos típicos de empaque (mismo criterio que ya usaron los scripts
// de importación -- "lata estándar ~170 g", "saco estándar ~20 kg" --
// no un peso medido producto por producto. Ajustable desde el
// catálogo en cualquier momento; no es `required` a propósito, mismo
// criterio que el resto de campos que no aplican a todos los
// productos (ver migración 052).
//
// No hay ninguna forma declarativa de matchear cada producto por
// nombre + categoría en una sola pasada legible, así que se hace a
// mano: para los dos nombres que se repiten en el catálogo
// (Tampones, Velas -- mismo nombre, categoría distinta), la tabla
// lleva la categoría; para el resto, `null`.
//
// La tabla trae más entradas (220) que lo que siembra cualquier
// migración anterior: varios productos ("Aceite x 2000 ml" y
// similares) se agregaron después directo desde el catálogo en
// producción, no por una migración -- verificado contra la base real,
// donde sí hay cobertura 1:1 exacta. Por eso una entrada de la tabla
// que no matchea ningún producto NO es un error aquí (sería normal en
// una instancia de desarrollo recién creada, sin esos productos
// manuales); lo que sí falla fuerte es que un producto que SÍ existe
// en esta instancia se quede sin peso -- esa es la clase de error que
// importa atrapar (un nombre mal escrito en la tabla).

const WEIGHTS = [
  ["Abrigo", null, 0.8],
  ["Aceite para bebé", null, 0.2],
  ["Aceite vegetal", null, 1],
  ["Aceite x 2000 ml", null, 2],
  ["Aceite x 230 ml", null, 0.23],
  ["Aceite x 3000 ml", null, 3],
  ["Aceite x 900 ml", null, 0.9],
  ["Aciclovir", null, 0.02],
  ["Acolchado", null, 1.5],
  ["Agua", null, 1],
  ["Agua embotellada 500ml", null, 0.5],
  ["Agua oxigenada", null, 0.25],
  ["Alcohol", null, 0.25],
  ["Algodón", null, 0.1],
  ["Alimento húmedo para mascota", null, 0.4],
  ["Alimento lácteo para bebé", null, 0.4],
  ["Almohadas", null, 0.5],
  ["Antibacterial", null, 0.3],
  ["Arena", null, 25],
  ["Arena para gatos", null, 1],
  ["Arroz", null, 1],
  ["Arveja", null, 1],
  ["Arverja", null, 1],
  ["Aspirina", null, 0.03],
  ["Astigmin parche", null, 0.01],
  ["Atún enlatado", null, 0.17],
  ["Avena", null, 0.5],
  ["Azúcar", null, 1],
  ["Barras energéticas", null, 0.3],
  ["Bebida en polvo", null, 0.3],
  ["Blanquillos", null, 1],
  ["Bloqueador solar", null, 0.2],
  ["Blusa", null, 0.2],
  ["Bolsa de agua", null, 0.3],
  ["Bolsa desechos para mascotas", null, 0.1],
  ["Bolsas de basura", null, 0.3],
  ["Borradores", null, 0.02],
  ["Botiquín armado", null, 1],
  ["Café soluble", null, 0.2],
  ["Caja de juego", null, 0.5],
  ["Cal", null, 20],
  ["Calcetines", null, 0.05],
  ["Caldo de pollo", null, 0.1],
  ["Calzado", null, 0.6],
  ["Carro de juguete", null, 0.3],
  ["Cartuchera", null, 0.15],
  ["Casco", null, 0.4],
  ["Cemento", null, 50],
  ["Cepillo de dientes", null, 0.02],
  ["Cereal", null, 0.4],
  ["Chamarra", null, 0.6],
  ["Chile con carne", null, 1],
  ["Chile en polvo", null, 0.1],
  ["Chile seco", null, 0.1],
  ["Chiles enlatados", null, 0.4],
  ["Chocolate en barra", null, 0.1],
  ["Chocolate en barra x 112 g", null, 0.112],
  ["Chocolate en polvo", null, 0.4],
  ["Cinta médica", null, 0.05],
  ["Cloro", null, 1],
  ["Cobija", null, 1],
  ["Colada", null, 0.4],
  ["Colchoneta de espuma", null, 2],
  ["Colchón inflable", null, 3],
  ["Collar", null, 0.05],
  ["Colores", null, 0.2],
  ["Comedero para mascota", null, 0.3],
  ["Comida para gatos", null, 1],
  ["Comida para perros", null, 1],
  ["Comino", null, 0.1],
  ["Compota", null, 0.1],
  ["Condimentos varios", null, 0.05],
  ["Correa", null, 0.1],
  ["Cortaúñas", null, 0.02],
  ["Crema antiinflamatoria", null, 0.05],
  ["Crema antipañalitis", null, 0.1],
  ["Croquetas para gato", null, 20],
  ["Croquetas para perro", null, 20],
  ["Curitas", null, 0.05],
  ["Desarmador", null, 0.15],
  ["Desinfectante multiusos", null, 1],
  ["Desodorante", null, 0.09],
  ["Despensa básica", null, 5],
  ["Desvenlafaxina", null, 0.02],
  ["Detergente", null, 1],
  ["Diovan", null, 0.02],
  ["Dulces variados", null, 0.3],
  ["Electrolitos", null, 0.05],
  ["Enlatados varios", null, 0.4],
  ["Escoba", null, 0.5],
  ["Esomeprazol", null, 0.02],
  ["Esponjilla", null, 0.02],
  ["Frazada", null, 1.2],
  ["Frijol", null, 1],
  ["Frijoles enlatados", null, 0.17],
  ["Frutas en almíbar", null, 0.4],
  ["Frutos secos", null, 0.3],
  ["Galletas dulces", null, 0.2],
  ["Galletas saladas", null, 0.2],
  ["Garbanzo", null, 1],
  ["Garrafón 20L", null, 20],
  ["Gasas estériles", null, 0.1],
  ["Gelatina", null, 1],
  ["Gorro", null, 0.1],
  ["Granola", null, 0.4],
  ["Guantes", null, 0.3],
  ["Guantes de trabajo", null, 0.15],
  ["Harina de maíz", null, 1],
  ["Harina de trigo", null, 1],
  ["Hielo", null, 1],
  ["Ibuprofeno", null, 0.03],
  ["Isodine", null, 0.12],
  ["Jabón de barra", null, 0.3],
  ["Jabón líquido", null, 0.5],
  ["Jabón para bebé", null, 0.1],
  ["Jabón para ropa", null, 0.5],
  ["Jabón para trastes", null, 0.75],
  ["Jaula", null, 2],
  ["Juego de raquetas", null, 0.2],
  ["Jugo en caja", null, 1],
  ["Juguete de plástico", null, 0.2],
  ["Kit Aseo Personal", null, 1],
  ["Kit aseo del hogar", null, 1],
  ["Kit de alimentos", null, 3],
  ["Kit de medicamentos", null, 0.5],
  ["Kit dental", null, 0.15],
  ["Kits dentales", null, 0.15],
  ["Lansoprazol", null, 0.02],
  ["Leche condensada", null, 0.4],
  ["Leche en polvo", null, 0.4],
  ["Leche en polvo x200 gr", null, 0.2],
  ["Leche evaporada", null, 0.4],
  ["Lenteja", null, 1],
  ["Lentes de protección", null, 0.05],
  ["Libro infantil", null, 0.2],
  ["Limpiapisos", null, 1],
  ["Linterna", null, 0.2],
  ["Loperamida", null, 0.03],
  ["Lámina de zinc", null, 4],
  ["Lámina galvanizada", null, 5],
  ["Lápices", null, 0.01],
  ["Martillo", null, 0.6],
  ["Maíz pira", null, 1],
  ["Medicamento antigripal", null, 0.03],
  ["Micropore", null, 0.03],
  ["Miel", null, 0.5],
  ["Muñecas", null, 0.2],
  ["Máquina de afeitar", null, 0.03],
  ["Omnidol", null, 0.02],
  ["Pala", null, 1.5],
  ["Pan Bimbo", null, 0.5],
  ["Pan dulce", null, 0.5],
  ["Panela", null, 1],
  ["Pantalones", null, 0.4],
  ["Papel higiénico", null, 1],
  ["Papel higiénico x1 rollo", null, 0.15],
  ["Papel higiénico x2 rollos", null, 0.3],
  ["Papel higiénico x4 rollos", null, 0.6],
  ["Papel higiénico x6 rollos", null, 0.9],
  ["Papitas", null, 0.15],
  ["Paracetamol", null, 0.03],
  ["Pasta", null, 1],
  ["Pasta dental", null, 0.1],
  ["Pastillas potabilizadoras", null, 0.05],
  ["Pañales etapa 1", null, 1.5],
  ["Pañales etapa 2", null, 1.5],
  ["Pañales etapa 3", null, 1.5],
  ["Pañales etapa 4", null, 1.5],
  ["Pañales etapa 5", null, 1.5],
  ["Pañales para adulto", null, 2],
  ["Pañales para bebé", null, 1.5],
  ["Pelotas de trapo", null, 0.3],
  ["Peluche", null, 0.3],
  ["Perlin", null, 3],
  ["Pico", null, 2.5],
  ["Pilas", null, 0.1],
  ["Plastilina", null, 0.3],
  ["Playeras", null, 0.2],
  ["Preservativos", null, 0.05],
  ["Protectores diarios", null, 0.1],
  ["Proteína en polvo", null, 0.5],
  ["Quintamanchas", null, 0.5],
  ["Refresco", null, 1],
  ["Repelente de insectos", null, 0.15],
  ["Ropa interior", null, 0.15],
  ["Sacapuntas", null, 0.01],
  ["Saco", null, 0.4],
  ["Saco de dormir", null, 1.5],
  ["Sal", null, 0.5],
  ["Salchicha", null, 1],
  ["Sales de rehidratación", null, 0.03],
  ["Salsa de tomate", null, 0.4],
  ["Salsa picante", null, 0.2],
  ["Sardina enlatada", null, 0.17],
  ["Seda dental", null, 0.02],
  ["Servilletas", null, 0.2],
  ["Shampoo", null, 0.4],
  ["Sopa de sobre", null, 0.1],
  ["Sopa instantánea", null, 0.1],
  ["Sudaderas", null, 0.5],
  ["Suero fisiológico", null, 0.5],
  ["Talco", null, 0.2],
  ["Tampones", "Cuidado Personal Adicional", 0.1],
  ["Tampones", "Toallas Femeninas", 0.1],
  ["Tapabocas", null, 0.15],
  ["Test (ignorar)", null, 0.1],
  ["Tiquetín", null, 0.02],
  ["Toalla de cuerpo", null, 0.4],
  ["Toallas sanitarias", null, 0.2],
  ["Toallitas húmedas", null, 0.4],
  ["Trapeador", null, 0.3],
  ["Té", null, 0.1],
  ["Vasos desechables", null, 0.15],
  ["Velas", "Artículos del Hogar", 0.2],
  ["Velas", "Linternas y Pilas", 0.1],
  ["Vendas", null, 0.05],
  ["Verduras enlatadas", null, 0.4],
  ["Vinagre", null, 0.5],
  ["Yogurt", null, 1],
  ["Zelix", null, 0.02],

  // Nombres originales de la siembra (022_seed_products.js) que en
  // producción ya se renombraron a mano desde el catálogo -- una
  // instancia de desarrollo recién creada todavía los trae así.
  ["Pasta (fideos)", null, 1],
  ["Agua embotellada 1L", null, 1],
]

migrate((app) => {
  const collection = app.findCollectionByNameOrId("products")
  collection.fields.add(new NumberField({ name: "weight_kg", min: 0 }))
  app.save(collection)

  const categoryNameById = new Map(
    app.findRecordsByFilter("categories", "", "", 0, 0).map((c) => [c.id, c.get("name")])
  )

  const products = app.findRecordsByFilter("products", "", "", 0, 0)
  const byName = new Map()
  for (const p of products) {
    const key = p.get("name")
    if (!byName.has(key)) byName.set(key, [])
    byName.get(key).push(p)
  }

  const setIds = new Set()
  for (const [name, categoryName, weight] of WEIGHTS) {
    const candidates = byName.get(name) || []
    let target = null
    if (candidates.length === 1) {
      target = candidates[0]
    } else if (candidates.length > 1) {
      target = candidates.find((p) => categoryNameById.get(p.get("category_id")) === categoryName) || null
    }
    if (!target) {
      continue // producto manual, no sembrado en esta instancia -- ver comentario arriba
    }
    target.set("weight_kg", weight)
    app.save(target)
    setIds.add(target.id)
  }

  const missing = products.filter((p) => !setIds.has(p.id)).map((p) => p.get("name"))
  if (missing.length > 0) {
    throw new Error("weight_kg: productos sin peso asignado: " + missing.join(", "))
  }
}, (app) => {
  const collection = app.findCollectionByNameOrId("products")
  collection.fields.removeByName("weight_kg")
  app.save(collection)
})
