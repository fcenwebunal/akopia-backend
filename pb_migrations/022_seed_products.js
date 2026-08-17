migrate((app) => {
  const collection = app.findCollectionByNameOrId("products")

  const products = [
    { name: "Pasta (fideos)",              category: "Pastas y Sopas",          unit: "PAQUETE",   requires_batch: false, requires_expiry: true,  requires_quarantine: false, is_fragile: false, is_hazardous: false },
    { name: "Sopa instantánea",            category: "Pastas y Sopas",          unit: "PAQUETE",   requires_batch: false, requires_expiry: true,  requires_quarantine: false, is_fragile: false, is_hazardous: false },
    { name: "Sopa de sobre",               category: "Pastas y Sopas",          unit: "PAQUETE",   requires_batch: false, requires_expiry: true,  requires_quarantine: false, is_fragile: false, is_hazardous: false },
    { name: "Arroz",                       category: "Arroz y Legumbres",       unit: "KILOGRAMO", requires_batch: false, requires_expiry: true,  requires_quarantine: false, is_fragile: false, is_hazardous: false },
    { name: "Frijol",                      category: "Arroz y Legumbres",       unit: "KILOGRAMO", requires_batch: false, requires_expiry: true,  requires_quarantine: false, is_fragile: false, is_hazardous: false },
    { name: "Lenteja",                     category: "Arroz y Legumbres",       unit: "KILOGRAMO", requires_batch: false, requires_expiry: true,  requires_quarantine: false, is_fragile: false, is_hazardous: false },
    { name: "Garbanzo",                    category: "Arroz y Legumbres",       unit: "KILOGRAMO", requires_batch: false, requires_expiry: true,  requires_quarantine: false, is_fragile: false, is_hazardous: false },
    { name: "Aceite vegetal",              category: "Aceites y Vinagres",      unit: "BOTELLA",   requires_batch: false, requires_expiry: true,  requires_quarantine: false, is_fragile: true,  is_hazardous: false },
    { name: "Vinagre",                     category: "Aceites y Vinagres",      unit: "BOTELLA",   requires_batch: false, requires_expiry: true,  requires_quarantine: false, is_fragile: true,  is_hazardous: false },
    { name: "Atún enlatado",               category: "Enlatados y Conservas",   unit: "LATA",      requires_batch: false, requires_expiry: true,  requires_quarantine: false, is_fragile: false, is_hazardous: false },
    { name: "Sardina enlatada",            category: "Enlatados y Conservas",   unit: "LATA",      requires_batch: false, requires_expiry: true,  requires_quarantine: false, is_fragile: false, is_hazardous: false },
    { name: "Frijoles enlatados",          category: "Enlatados y Conservas",   unit: "LATA",      requires_batch: false, requires_expiry: true,  requires_quarantine: false, is_fragile: false, is_hazardous: false },
    { name: "Verduras enlatadas",          category: "Enlatados y Conservas",   unit: "LATA",      requires_batch: false, requires_expiry: true,  requires_quarantine: false, is_fragile: false, is_hazardous: false },
    { name: "Frutas en almíbar",           category: "Enlatados y Conservas",   unit: "LATA",      requires_batch: false, requires_expiry: true,  requires_quarantine: false, is_fragile: false, is_hazardous: false },
    { name: "Chiles enlatados",            category: "Enlatados y Conservas",   unit: "LATA",      requires_batch: false, requires_expiry: true,  requires_quarantine: false, is_fragile: false, is_hazardous: false },
    { name: "Salsa de tomate",             category: "Enlatados y Conservas",   unit: "FRASCO",    requires_batch: false, requires_expiry: true,  requires_quarantine: false, is_fragile: true,  is_hazardous: false },
    { name: "Pan dulce",                   category: "Pan y Cereales",          unit: "PAQUETE",   requires_batch: false, requires_expiry: true,  requires_quarantine: false, is_fragile: false, is_hazardous: false },
    { name: "Pan Bimbo",                   category: "Pan y Cereales",          unit: "PAQUETE",   requires_batch: false, requires_expiry: true,  requires_quarantine: false, is_fragile: false, is_hazardous: false },
    { name: "Cereal",                      category: "Pan y Cereales",          unit: "CAJA",      requires_batch: false, requires_expiry: true,  requires_quarantine: false, is_fragile: false, is_hazardous: false },
    { name: "Chile seco",                  category: "Chiles y Salsas",         unit: "BOLSA",     requires_batch: false, requires_expiry: false, requires_quarantine: false, is_fragile: false, is_hazardous: false },
    { name: "Chile en polvo",              category: "Chiles y Salsas",         unit: "FRASCO",    requires_batch: false, requires_expiry: true,  requires_quarantine: false, is_fragile: false, is_hazardous: false },
    { name: "Salsa picante",               category: "Chiles y Salsas",         unit: "BOTELLA",   requires_batch: false, requires_expiry: true,  requires_quarantine: false, is_fragile: true,  is_hazardous: false },
    { name: "Leche en polvo",              category: "Leche y Lácteos",         unit: "PAQUETE",   requires_batch: false, requires_expiry: true,  requires_quarantine: false, is_fragile: false, is_hazardous: false },
    { name: "Leche evaporada",             category: "Leche y Lácteos",         unit: "LATA",      requires_batch: false, requires_expiry: true,  requires_quarantine: false, is_fragile: false, is_hazardous: false },
    { name: "Leche condensada",            category: "Leche y Lácteos",         unit: "LATA",      requires_batch: false, requires_expiry: true,  requires_quarantine: false, is_fragile: false, is_hazardous: false },
    { name: "Yogurt",                      category: "Leche y Lácteos",         unit: "BOTELLA",   requires_batch: false, requires_expiry: true,  requires_quarantine: false, is_fragile: true,  is_hazardous: false },
    { name: "Azúcar",                      category: "Azúcar y Dulces",         unit: "KILOGRAMO", requires_batch: false, requires_expiry: false, requires_quarantine: false, is_fragile: false, is_hazardous: false },
    { name: "Miel",                        category: "Azúcar y Dulces",         unit: "FRASCO",    requires_batch: false, requires_expiry: true,  requires_quarantine: false, is_fragile: true,  is_hazardous: false },
    { name: "Dulces variados",             category: "Azúcar y Dulces",         unit: "BOLSA",     requires_batch: false, requires_expiry: true,  requires_quarantine: false, is_fragile: false, is_hazardous: false },
    { name: "Chocolate en barra",          category: "Azúcar y Dulces",         unit: "PAQUETE",   requires_batch: false, requires_expiry: true,  requires_quarantine: false, is_fragile: false, is_hazardous: false },
    { name: "Café soluble",               category: "Café y Bebidas Calientes", unit: "FRASCO",    requires_batch: false, requires_expiry: true,  requires_quarantine: false, is_fragile: true,  is_hazardous: false },
    { name: "Té",                          category: "Café y Bebidas Calientes", unit: "CAJA",      requires_batch: false, requires_expiry: true,  requires_quarantine: false, is_fragile: false, is_hazardous: false },
    { name: "Chocolate en polvo",          category: "Café y Bebidas Calientes", unit: "PAQUETE",   requires_batch: false, requires_expiry: true,  requires_quarantine: false, is_fragile: false, is_hazardous: false },
    { name: "Jugo en caja",               category: "Bebidas Frías",           unit: "CAJA",      requires_batch: false, requires_expiry: true,  requires_quarantine: false, is_fragile: false, is_hazardous: false },
    { name: "Refresco",                    category: "Bebidas Frías",           unit: "BOTELLA",   requires_batch: false, requires_expiry: true,  requires_quarantine: false, is_fragile: true,  is_hazardous: false },
    { name: "Bebida en polvo",             category: "Bebidas Frías",           unit: "PAQUETE",   requires_batch: false, requires_expiry: true,  requires_quarantine: false, is_fragile: false, is_hazardous: false },
    { name: "Electrolitos",               category: "Bebidas Frías",           unit: "PAQUETE",   requires_batch: false, requires_expiry: true,  requires_quarantine: false, is_fragile: false, is_hazardous: false },
    { name: "Avena",                       category: "Avena y Cereales",        unit: "PAQUETE",   requires_batch: false, requires_expiry: true,  requires_quarantine: false, is_fragile: false, is_hazardous: false },
    { name: "Granola",                     category: "Avena y Cereales",        unit: "PAQUETE",   requires_batch: false, requires_expiry: true,  requires_quarantine: false, is_fragile: false, is_hazardous: false },
    { name: "Galletas saladas",            category: "Galletas y Botanas",      unit: "PAQUETE",   requires_batch: false, requires_expiry: true,  requires_quarantine: false, is_fragile: false, is_hazardous: false },
    { name: "Galletas dulces",             category: "Galletas y Botanas",      unit: "PAQUETE",   requires_batch: false, requires_expiry: true,  requires_quarantine: false, is_fragile: false, is_hazardous: false },
    { name: "Papitas",                     category: "Galletas y Botanas",      unit: "BOLSA",     requires_batch: false, requires_expiry: true,  requires_quarantine: false, is_fragile: false, is_hazardous: false },
    { name: "Sal",                         category: "Especias y Condimentos",  unit: "PAQUETE",   requires_batch: false, requires_expiry: false, requires_quarantine: false, is_fragile: false, is_hazardous: false },
    { name: "Caldo de pollo",              category: "Especias y Condimentos",  unit: "CAJA",      requires_batch: false, requires_expiry: true,  requires_quarantine: false, is_fragile: false, is_hazardous: false },
    { name: "Comino",                      category: "Especias y Condimentos",  unit: "FRASCO",    requires_batch: false, requires_expiry: true,  requires_quarantine: false, is_fragile: false, is_hazardous: false },
    { name: "Proteína en polvo",           category: "Proteínas y Suplementos", unit: "FRASCO",    requires_batch: false, requires_expiry: true,  requires_quarantine: false, is_fragile: true,  is_hazardous: false },
    { name: "Barras energéticas",          category: "Proteínas y Suplementos", unit: "CAJA",      requires_batch: false, requires_expiry: true,  requires_quarantine: false, is_fragile: false, is_hazardous: false },

    { name: "Agua embotellada 1L",         category: "Agua Embotellada",        unit: "BOTELLA",   requires_batch: false, requires_expiry: true,  requires_quarantine: false, is_fragile: true,  is_hazardous: false },
    { name: "Agua embotellada 500ml",      category: "Agua Embotellada",        unit: "BOTELLA",   requires_batch: false, requires_expiry: true,  requires_quarantine: false, is_fragile: true,  is_hazardous: false },
    { name: "Garrafón 20L",                category: "Agua Embotellada",        unit: "GARRAFA",   requires_batch: false, requires_expiry: true,  requires_quarantine: false, is_fragile: true,  is_hazardous: false },
    { name: "Bolsa de agua",              category: "Bolsas de Agua",          unit: "BOLSA",     requires_batch: false, requires_expiry: true,  requires_quarantine: false, is_fragile: false, is_hazardous: false },
    { name: "Pastillas potabilizadoras",   category: "Pastillas Potabilizadoras", unit: "CAJA",    requires_batch: false, requires_expiry: true,  requires_quarantine: false, is_fragile: false, is_hazardous: false },
    { name: "Hielo",                       category: "Hielo",                   unit: "KILOGRAMO", requires_batch: false, requires_expiry: false, requires_quarantine: false, is_fragile: false, is_hazardous: false },

    { name: "Jabón de barra",              category: "Jabón y Shampoo",         unit: "PAQUETE",   requires_batch: false, requires_expiry: true,  requires_quarantine: false, is_fragile: false, is_hazardous: false },
    { name: "Jabón líquido",               category: "Jabón y Shampoo",         unit: "BOTELLA",   requires_batch: false, requires_expiry: true,  requires_quarantine: false, is_fragile: true,  is_hazardous: false },
    { name: "Shampoo",                     category: "Jabón y Shampoo",         unit: "BOTELLA",   requires_batch: false, requires_expiry: true,  requires_quarantine: false, is_fragile: true,  is_hazardous: false },
    { name: "Pasta dental",                category: "Pasta de Dientes",        unit: "TUBO",      requires_batch: false, requires_expiry: true,  requires_quarantine: false, is_fragile: false, is_hazardous: false },
    { name: "Cepillo de dientes",          category: "Pasta de Dientes",        unit: "PIEZA",     requires_batch: false, requires_expiry: false, requires_quarantine: false, is_fragile: false, is_hazardous: false },
    { name: "Toallitas húmedas",           category: "Toallas Húmedas",         unit: "PAQUETE",   requires_batch: false, requires_expiry: true,  requires_quarantine: false, is_fragile: false, is_hazardous: false },
    { name: "Papel higiénico",             category: "Papel Higiénico",         unit: "PAQUETE",   requires_batch: false, requires_expiry: false, requires_quarantine: false, is_fragile: false, is_hazardous: false },
    { name: "Toallas sanitarias",          category: "Toallas Femeninas",       unit: "PAQUETE",   requires_batch: false, requires_expiry: false, requires_quarantine: false, is_fragile: false, is_hazardous: false },
    { name: "Pañales para bebé",           category: "Pañales",                 unit: "PAQUETE",   requires_batch: false, requires_expiry: false, requires_quarantine: false, is_fragile: false, is_hazardous: false },
    { name: "Pañales para adulto",         category: "Pañales",                 unit: "PAQUETE",   requires_batch: false, requires_expiry: false, requires_quarantine: false, is_fragile: false, is_hazardous: false },
    { name: "Desodorante",                 category: "Desodorante",             unit: "PIEZA",     requires_batch: false, requires_expiry: true,  requires_quarantine: false, is_fragile: false, is_hazardous: false },
    { name: "Bloqueador solar",            category: "Protección Solar",        unit: "FRASCO",    requires_batch: false, requires_expiry: true,  requires_quarantine: false, is_fragile: true,  is_hazardous: false },
    { name: "Repelente de insectos",       category: "Repelente de Insectos",   unit: "FRASCO",    requires_batch: false, requires_expiry: true,  requires_quarantine: false, is_fragile: true,  is_hazardous: false },

    { name: "Cloro",                       category: "Cloro y Desinfectantes",  unit: "BOTELLA",   requires_batch: false, requires_expiry: true,  requires_quarantine: false, is_fragile: true,  is_hazardous: true },
    { name: "Desinfectante multiusos",     category: "Cloro y Desinfectantes",  unit: "BOTELLA",   requires_batch: false, requires_expiry: true,  requires_quarantine: false, is_fragile: true,  is_hazardous: true },
    { name: "Jabón para ropa",             category: "Jabón para Ropa",         unit: "PAQUETE",   requires_batch: false, requires_expiry: true,  requires_quarantine: false, is_fragile: false, is_hazardous: false },
    { name: "Detergente",                  category: "Detergente",              unit: "PAQUETE",   requires_batch: false, requires_expiry: true,  requires_quarantine: false, is_fragile: false, is_hazardous: false },
    { name: "Jabón para trastes",          category: "Jabón para Trastes",      unit: "BOTELLA",   requires_batch: false, requires_expiry: true,  requires_quarantine: false, is_fragile: true,  is_hazardous: false },
    { name: "Escoba",                      category: "Escobas y Trapos",        unit: "PIEZA",     requires_batch: false, requires_expiry: false, requires_quarantine: false, is_fragile: false, is_hazardous: false },
    { name: "Trapeador",                   category: "Escobas y Trapos",        unit: "PIEZA",     requires_batch: false, requires_expiry: false, requires_quarantine: false, is_fragile: false, is_hazardous: false },

    { name: "Ropa interior",               category: "Ropa Interior",           unit: "PAQUETE",   requires_batch: false, requires_expiry: false, requires_quarantine: false, is_fragile: false, is_hazardous: false },
    { name: "Calcetines",                  category: "Calcetines",              unit: "PAR",       requires_batch: false, requires_expiry: false, requires_quarantine: false, is_fragile: false, is_hazardous: false },
    { name: "Playeras",                    category: "Playeras",                unit: "PIEZA",     requires_batch: false, requires_expiry: false, requires_quarantine: false, is_fragile: false, is_hazardous: false },
    { name: "Pantalones",                  category: "Pantalones",              unit: "PIEZA",     requires_batch: false, requires_expiry: false, requires_quarantine: false, is_fragile: false, is_hazardous: false },
    { name: "Calzado",                     category: "Calzado",                 unit: "PAR",       requires_batch: false, requires_expiry: false, requires_quarantine: false, is_fragile: false, is_hazardous: false },
    { name: "Sudaderas",                   category: "Ropa de Abrigo",          unit: "PIEZA",     requires_batch: false, requires_expiry: false, requires_quarantine: false, is_fragile: false, is_hazardous: false },
    { name: "Chamarra",                    category: "Ropa de Abrigo",          unit: "PIEZA",     requires_batch: false, requires_expiry: false, requires_quarantine: false, is_fragile: false, is_hazardous: false },
    { name: "Gorro",                       category: "Ropa de Abrigo",          unit: "PIEZA",     requires_batch: false, requires_expiry: false, requires_quarantine: false, is_fragile: false, is_hazardous: false },
    { name: "Guantes",                     category: "Ropa de Abrigo",          unit: "PAR",       requires_batch: false, requires_expiry: false, requires_quarantine: false, is_fragile: false, is_hazardous: false },

    { name: "Paracetamol",                 category: "Analgésicos",             unit: "CAJA",      requires_batch: true,  requires_expiry: true,  requires_quarantine: true,  is_fragile: false, is_hazardous: false },
    { name: "Ibuprofeno",                  category: "Analgésicos",             unit: "CAJA",      requires_batch: true,  requires_expiry: true,  requires_quarantine: true,  is_fragile: false, is_hazardous: false },
    { name: "Aspirina",                    category: "Analgésicos",             unit: "CAJA",      requires_batch: true,  requires_expiry: true,  requires_quarantine: true,  is_fragile: false, is_hazardous: false },
    { name: "Medicamento antigripal",      category: "Antigripales",            unit: "CAJA",      requires_batch: true,  requires_expiry: true,  requires_quarantine: true,  is_fragile: false, is_hazardous: false },
    { name: "Loperamida",                  category: "Antidiarreicos",          unit: "CAJA",      requires_batch: true,  requires_expiry: true,  requires_quarantine: true,  is_fragile: false, is_hazardous: false },
    { name: "Sales de rehidratación",      category: "Antidiarreicos",          unit: "PAQUETE",   requires_batch: false, requires_expiry: true,  requires_quarantine: true,  is_fragile: false, is_hazardous: false },
    { name: "Gasas estériles",             category: "Material de Curación",    unit: "CAJA",      requires_batch: false, requires_expiry: true,  requires_quarantine: false, is_fragile: false, is_hazardous: false },
    { name: "Vendas",                      category: "Material de Curación",    unit: "ROLLO",     requires_batch: false, requires_expiry: false, requires_quarantine: false, is_fragile: false, is_hazardous: false },
    { name: "Alcohol",                     category: "Material de Curación",    unit: "BOTELLA",   requires_batch: false, requires_expiry: true,  requires_quarantine: false, is_fragile: true,  is_hazardous: true },
    { name: "Cinta médica",                category: "Material de Curación",    unit: "ROLLO",     requires_batch: false, requires_expiry: false, requires_quarantine: false, is_fragile: false, is_hazardous: false },
    { name: "Botiquín armado",             category: "Botiquines Armados",      unit: "CAJA",      requires_batch: false, requires_expiry: true,  requires_quarantine: false, is_fragile: true,  is_hazardous: false },

    { name: "Pala",                        category: "Herramientas Manuales",   unit: "PIEZA",     requires_batch: false, requires_expiry: false, requires_quarantine: false, is_fragile: false, is_hazardous: false },
    { name: "Pico",                        category: "Herramientas Manuales",   unit: "PIEZA",     requires_batch: false, requires_expiry: false, requires_quarantine: false, is_fragile: false, is_hazardous: false },
    { name: "Martillo",                    category: "Herramientas Manuales",   unit: "PIEZA",     requires_batch: false, requires_expiry: false, requires_quarantine: false, is_fragile: false, is_hazardous: false },
    { name: "Desarmador",                  category: "Herramientas Manuales",   unit: "PIEZA",     requires_batch: false, requires_expiry: false, requires_quarantine: false, is_fragile: false, is_hazardous: false },
    { name: "Linterna",                    category: "Linternas y Pilas",       unit: "PIEZA",     requires_batch: false, requires_expiry: false, requires_quarantine: false, is_fragile: true,  is_hazardous: false },
    { name: "Pilas",                       category: "Linternas y Pilas",       unit: "PAQUETE",   requires_batch: false, requires_expiry: false, requires_quarantine: false, is_fragile: false, is_hazardous: false },
    { name: "Velas",                       category: "Linternas y Pilas",       unit: "PAQUETE",   requires_batch: false, requires_expiry: false, requires_quarantine: false, is_fragile: false, is_hazardous: false },
    { name: "Casco",                       category: "Equipos de Protección",   unit: "PIEZA",     requires_batch: false, requires_expiry: false, requires_quarantine: false, is_fragile: false, is_hazardous: false },
    { name: "Guantes de trabajo",          category: "Equipos de Protección",   unit: "PAR",       requires_batch: false, requires_expiry: false, requires_quarantine: false, is_fragile: false, is_hazardous: false },
    { name: "Lentes de protección",        category: "Equipos de Protección",   unit: "PIEZA",     requires_batch: false, requires_expiry: false, requires_quarantine: false, is_fragile: true,  is_hazardous: false },
    { name: "Tapabocas",                   category: "Equipos de Protección",   unit: "CAJA",      requires_batch: false, requires_expiry: false, requires_quarantine: false, is_fragile: false, is_hazardous: false },

    { name: "Cobija",                      category: "Cobijas",                 unit: "PIEZA",     requires_batch: false, requires_expiry: false, requires_quarantine: false, is_fragile: false, is_hazardous: false },
    { name: "Frazada",                     category: "Cobijas",                 unit: "PIEZA",     requires_batch: false, requires_expiry: false, requires_quarantine: false, is_fragile: false, is_hazardous: false },
    { name: "Colchoneta de espuma",        category: "Colchonetas",             unit: "PIEZA",     requires_batch: false, requires_expiry: false, requires_quarantine: false, is_fragile: false, is_hazardous: false },
    { name: "Colchón inflable",            category: "Colchonetas",             unit: "PIEZA",     requires_batch: false, requires_expiry: false, requires_quarantine: false, is_fragile: false, is_hazardous: false },
    { name: "Saco de dormir",              category: "Sacos de Dormir",         unit: "PIEZA",     requires_batch: false, requires_expiry: false, requires_quarantine: false, is_fragile: false, is_hazardous: false },

    { name: "Lámina de zinc",              category: "Láminas y Estructuras",   unit: "PIEZA",     requires_batch: false, requires_expiry: false, requires_quarantine: false, is_fragile: false, is_hazardous: false },
    { name: "Lámina galvanizada",          category: "Láminas y Estructuras",   unit: "PIEZA",     requires_batch: false, requires_expiry: false, requires_quarantine: false, is_fragile: false, is_hazardous: false },
    { name: "Perlin",                      category: "Láminas y Estructuras",   unit: "PIEZA",     requires_batch: false, requires_expiry: false, requires_quarantine: false, is_fragile: false, is_hazardous: false },
    { name: "Cemento",                     category: "Cemento y Agregados",     unit: "SACO",      requires_batch: false, requires_expiry: false, requires_quarantine: false, is_fragile: false, is_hazardous: false },
    { name: "Arena",                       category: "Cemento y Agregados",     unit: "COSTAL",    requires_batch: false, requires_expiry: false, requires_quarantine: false, is_fragile: false, is_hazardous: false },
    { name: "Cal",                         category: "Cemento y Agregados",     unit: "SACO",      requires_batch: false, requires_expiry: false, requires_quarantine: false, is_fragile: false, is_hazardous: false },

    { name: "Despensa básica",             category: "Despensas",               unit: "CAJA",      requires_batch: false, requires_expiry: true,  requires_quarantine: false, is_fragile: false, is_hazardous: false },

    { name: "Croquetas para perro",        category: "Alimento para Mascotas",  unit: "SACO",      requires_batch: false, requires_expiry: true,  requires_quarantine: false, is_fragile: false, is_hazardous: false },
    { name: "Croquetas para gato",         category: "Alimento para Mascotas",  unit: "SACO",      requires_batch: false, requires_expiry: true,  requires_quarantine: false, is_fragile: false, is_hazardous: false },
    { name: "Alimento húmedo para mascota", category: "Alimento para Mascotas", unit: "LATA",      requires_batch: false, requires_expiry: true,  requires_quarantine: false, is_fragile: false, is_hazardous: false },
    { name: "Correa",                      category: "Suministros Mascotas",    unit: "PIEZA",     requires_batch: false, requires_expiry: false, requires_quarantine: false, is_fragile: false, is_hazardous: false },
    { name: "Collar",                      category: "Suministros Mascotas",    unit: "PIEZA",     requires_batch: false, requires_expiry: false, requires_quarantine: false, is_fragile: false, is_hazardous: false },
    { name: "Comedero para mascota",       category: "Suministros Mascotas",    unit: "PIEZA",     requires_batch: false, requires_expiry: false, requires_quarantine: false, is_fragile: false, is_hazardous: false },
    { name: "Jaula",                       category: "Suministros Mascotas",    unit: "PIEZA",     requires_batch: false, requires_expiry: false, requires_quarantine: false, is_fragile: false, is_hazardous: false }
  ]

  for (const p of products) {
    const category = app.findFirstRecordByFilter("categories", "name = {:val}", { "val": p.category })
    const unit = app.findFirstRecordByFilter("units", "code = {:val2}", { "val2": p.unit })
    const record = new Record(collection)
    record.set("name", p.name)
    record.set("category_id", category.id)
    record.set("default_unit_id", unit.id)
    record.set("requires_batch", p.requires_batch)
    record.set("requires_expiry", p.requires_expiry)
    record.set("requires_quarantine", p.requires_quarantine)
    record.set("is_fragile", p.is_fragile)
    record.set("is_hazardous", p.is_hazardous)
    record.set("active", true)
    app.save(record)
  }
}, (app) => {
  try {
    const productNames = [
      "Pasta (fideos)", "Sopa instantánea", "Sopa de sobre", "Arroz", "Frijol", "Lenteja", "Garbanzo",
      "Aceite vegetal", "Vinagre", "Atún enlatado", "Sardina enlatada", "Frijoles enlatados",
      "Verduras enlatadas", "Frutas en almíbar", "Chiles enlatados", "Salsa de tomate", "Pan dulce",
      "Pan Bimbo", "Cereal", "Chile seco", "Chile en polvo", "Salsa picante", "Leche en polvo",
      "Leche evaporada", "Leche condensada", "Yogurt", "Azúcar", "Miel", "Dulces variados",
      "Chocolate en barra", "Café soluble", "Té", "Chocolate en polvo", "Jugo en caja", "Refresco",
      "Bebida en polvo", "Electrolitos", "Avena", "Granola", "Galletas saladas", "Galletas dulces",
      "Papitas", "Sal", "Caldo de pollo", "Comino", "Proteína en polvo", "Barras energéticas",
      "Agua embotellada 1L", "Agua embotellada 500ml", "Garrafón 20L", "Bolsa de agua",
      "Pastillas potabilizadoras", "Hielo", "Jabón de barra", "Jabón líquido", "Shampoo",
      "Pasta dental", "Cepillo de dientes", "Toallitas húmedas", "Papel higiénico",
      "Toallas sanitarias", "Pañales para bebé", "Pañales para adulto", "Desodorante",
      "Bloqueador solar", "Repelente de insectos", "Cloro", "Desinfectante multiusos",
      "Jabón para ropa", "Detergente", "Jabón para trastes", "Escoba", "Trapeador", "Ropa interior",
      "Calcetines", "Playeras", "Pantalones", "Calzado", "Sudaderas", "Chamarra", "Gorro", "Guantes",
      "Paracetamol", "Ibuprofeno", "Aspirina", "Medicamento antigripal", "Loperamida",
      "Sales de rehidratación", "Gasas estériles", "Vendas", "Alcohol", "Cinta médica",
      "Botiquín armado", "Pala", "Pico", "Martillo", "Desarmador", "Linterna", "Pilas", "Velas",
      "Casco", "Guantes de trabajo", "Lentes de protección", "Tapabocas", "Cobija", "Frazada",
      "Colchoneta de espuma", "Colchón inflable", "Saco de dormir", "Lámina de zinc",
      "Lámina galvanizada", "Perlin", "Cemento", "Arena", "Cal", "Despensa básica",
      "Croquetas para perro", "Croquetas para gato", "Alimento húmedo para mascota", "Correa",
      "Collar", "Comedero para mascota", "Jaula"
    ]
    for (const name of productNames) {
      try {
        const record = app.findFirstRecordByFilter("products", "name = {:val}", { "val": name })
        app.delete(record)
      } catch (_) {}
    }
  } catch (_) {}
})
