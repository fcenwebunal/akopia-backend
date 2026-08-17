// ─────────────────────────────────────────────────────────────
// 02_codes.js — BeforeCreate hooks for auto-generated codes
// ─────────────────────────────────────────────────────────────

onRecordBeforeCreateRequest("donations", (e) => {
  try {
    var record = e.record;
    if (!record.get("code") || record.get("code") === "") {
      record.set("code", generateSequenceCode("DON-", "donations"));
    }
  } catch (err) {
    console.error("Error generating donation code:", err);
    throw new BadRequestError("Error generando código de donación");
  }
  return e.next();
});

onRecordBeforeCreateRequest("requests", (e) => {
  try {
    var record = e.record;
    if (!record.get("code") || record.get("code") === "") {
      record.set("code", generateSequenceCode("SOL-", "requests"));
    }
  } catch (err) {
    console.error("Error generating request code:", err);
    throw new BadRequestError("Error generando código de solicitud");
  }
  return e.next();
});

onRecordBeforeCreateRequest("dispatches", (e) => {
  try {
    var record = e.record;
    if (!record.get("code") || record.get("code") === "") {
      record.set("code", generateSequenceCode("DES-", "dispatches"));
    }
  } catch (err) {
    console.error("Error generating dispatch code:", err);
    throw new BadRequestError("Error generando código de despacho");
  }
  return e.next();
});
