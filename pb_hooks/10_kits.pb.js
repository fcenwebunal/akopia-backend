// ─────────────────────────────────────────────────────────────
// 10_kits.pb.js — Contador de uso de un kit
//
// Cuando una solicitud se crea a partir de un kit (`source_kit_id`
// presente), se le suma uno a `kits.use_count` — solo para poder
// reportar "este kit se usó N veces", nada más. Mismo criterio que
// 04_audit.pb.js: corre después de e.next() y un fallo aquí se
// registra y se traga — perder el contador es un problema menor,
// rechazar una solicitud válida por eso sería peor.
// ─────────────────────────────────────────────────────────────

onRecordCreateRequest((e) => {
  e.next();

  try {
    const kitId = e.record.get("source_kit_id");
    if (!kitId) {
      return;
    }

    const kit = e.app.findRecordById("kits", kitId);
    kit.set("use_count", (kit.get("use_count") || 0) + 1);
    e.app.save(kit);
  } catch (err) {
    console.error("Error incrementando use_count del kit:", err);
  }
}, "requests");
