// ─────────────────────────────────────────────────────────────
// 02_codes.pb.js — Auto-generated sequential codes
//
// The code is assigned before e.next(), so it is already on the
// record by the time PocketBase validates the required field.
// ─────────────────────────────────────────────────────────────

onRecordCreateRequest(
  (e) => {
    const { generateSequenceCode } = require(`${__hooks}/utils/helpers.js`);
    const { CODE_PREFIXES } = require(`${__hooks}/utils/config.js`);

    const config = CODE_PREFIXES[e.collection.name];

    if (config && !e.record.get("code")) {
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
    }

    e.next();
  },
  "donations",
  "requests",
  "dispatches"
);
