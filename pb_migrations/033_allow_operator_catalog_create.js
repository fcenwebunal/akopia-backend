// Hasta ahora solo un admin podía dar de alta grupos, categorías o
// productos (`createRule` de la migración 026). Pedido explícito:
// un operador de bodega también puede ampliar el catálogo mientras
// recibe una donación, sin tener que llamar a un admin a mitad de
// turno. `updateRule` sigue siendo solo admin — no se toca aquí — así
// que un operador puede crear pero no editar ni subir foto a lo que
// ya existía.
//
// `units` y `locations` quedan fuera a propósito: no forman parte de
// lo que se pidió y su alta no ocurre en medio de una recepción.

const ADMIN_OR_OPERATOR =
  "(@request.auth.role = 'admin' || @request.auth.role = 'operator') && @request.auth.active = true"
const ADMIN = "@request.auth.role = 'admin' && @request.auth.active = true"

const COLLECTIONS = ["groups", "categories", "products"]

migrate(
  (app) => {
    for (const name of COLLECTIONS) {
      const collection = app.findCollectionByNameOrId(name)
      collection.createRule = ADMIN_OR_OPERATOR
      app.save(collection)
    }
  },
  (app) => {
    for (const name of COLLECTIONS) {
      const collection = app.findCollectionByNameOrId(name)
      collection.createRule = ADMIN
      app.save(collection)
    }
  }
)
