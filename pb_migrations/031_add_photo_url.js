// Diseño estilo menú de restaurante en el explorador de categorías del
// frontend: cada grupo, categoría y producto puede llevar una foto.
//
// Se guarda solo la URL (Cloudinary aloja el archivo real), no el
// binario. `photo_url` es opcional en las tres colecciones — la mayoría
// no va a tener foto de entrada, y el explorador debe verse bien sin
// ella, no solo con ella.

const COLLECTIONS = ["groups", "categories", "products"]

migrate((app) => {
  for (const name of COLLECTIONS) {
    const collection = app.findCollectionByNameOrId(name)
    collection.fields.add(new URLField({ name: "photo_url", max: 500 }))
    app.save(collection)
  }
}, (app) => {
  for (const name of COLLECTIONS) {
    const collection = app.findCollectionByNameOrId(name)
    collection.fields.removeByName("photo_url")
    app.save(collection)
  }
})
