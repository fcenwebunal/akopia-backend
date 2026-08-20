// `users.role` pasa de selección única (`admin`/`operator`) a selección
// múltiple: una persona puede tener varios roles funcionales a la vez
// (por ejemplo Coordinación + Transporte y distribución). El campo
// sigue siendo required — toda cuenta necesita al menos un rol.
//
// `operator` desaparece como valor genérico, reemplazado por seis roles
// concretos. Las cuentas que ya existen (todas `admin` u `operator` hoy)
// se migran a `["admin"]` — decisión explícita: mientras no se creen las
// cuentas nuevas del equipo, todo lo que ya existe queda con acceso
// total en vez de perder permisos de golpe.
//
// Verificado contra un servidor de prueba real (no solo la doc): tras
// `app.save(collection)` con `maxSelect` en 6, PocketBase reescribe la
// columna y los valores existentes deben resetearse explícitamente a
// arreglo — un string plano ("admin") no se autoconvierte.

const ROLES = [
  "admin",
  "coordinacion",
  "transporte_distribucion",
  "voluntariado",
  "comunicaciones",
  "salida",
]

migrate((app) => {
  const collection = app.findCollectionByNameOrId("users")
  const field = collection.fields.getByName("role")
  field.values = ROLES
  field.maxSelect = ROLES.length
  app.save(collection)

  const records = app.findRecordsByFilter("users", "", "", 0, 0)
  for (const record of records) {
    record.set("role", ["admin"])
    app.save(record)
  }
}, (app) => {
  const collection = app.findCollectionByNameOrId("users")

  const records = app.findRecordsByFilter("users", "", "", 0, 0)
  for (const record of records) {
    const roles = record.get("role") || []
    record.set("role", roles.indexOf("admin") !== -1 ? "admin" : "operator")
    app.save(record)
  }

  const field = collection.fields.getByName("role")
  field.values = ["admin", "operator"]
  field.maxSelect = 1
  app.save(collection)
})
