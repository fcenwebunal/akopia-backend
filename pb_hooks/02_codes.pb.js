// ─────────────────────────────────────────────────────────────
// 02_codes.pb.js — Auto-generated sequential codes
//
// El número se reserva de un contador y se asigna antes de e.next(), así
// que ya está en el registro cuando PocketBase valida el campo requerido.
//
// Todo va dentro de una transacción a propósito: si la inserción falla,
// el contador se revierte con ella y el número no se pierde.
// ─────────────────────────────────────────────────────────────

onRecordCreateRequest(
  (e) => {
    const { generateSequenceCode } = require(`${__hooks}/utils/helpers.js`);
    const { CODE_PREFIXES } = require(`${__hooks}/utils/config.js`);

    const config = CODE_PREFIXES[e.collection.name];

    if (!config || e.record.get("code")) {
      e.next();
      return;
    }

    const originalApp = e.app;

    try {
      e.app.runInTransaction((txApp) => {
        e.app = txApp;

        try {
          e.record.set(
            "code",
            generateSequenceCode(e.app, config.prefix, e.collection.name)
          );
        } catch (err) {
          console.error(
            "Error generating code for " + e.collection.name + ":",
            err
          );
          throw new BadRequestError(config.error);
        }

        e.next();
      });
    } finally {
      e.app = originalApp;
    }
  },
  "donations",
  "requests",
  "dispatches"
);
