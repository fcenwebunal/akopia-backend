// ─────────────────────────────────────────────────────────────
// 04_audit.pb.js — Audit trail for the collections that matter
//
// Runs after e.next(), so only writes that actually succeeded are
// logged. A failure to write the trail is logged and swallowed:
// losing an audit line is bad, but rejecting an otherwise valid
// operation because of it is worse.
// ─────────────────────────────────────────────────────────────

onRecordCreateRequest((e) => {
  const { getOperatorId, createAuditLog } = require(`${__hooks}/utils/helpers.js`);
  const { AUDIT_FIELDS } = require(`${__hooks}/utils/config.js`);

  e.next();

  try {
    const fields = AUDIT_FIELDS[e.collection.name];
    const operatorId = getOperatorId(e);
    if (!fields || !operatorId) {
      return;
    }

    const snapshot = {};
    for (const field of fields) {
      snapshot[field] = e.record.get(field);
    }

    createAuditLog(
      e.app,
      e.collection.name,
      e.record.id,
      "create",
      { data: snapshot },
      operatorId,
      null
    );
  } catch (err) {
    console.error(
      "Error creating audit log for " + e.collection.name + " create:",
      err
    );
  }
},
"donations",
"donation_items",
"requests",
"request_items",
"reservations",
"dispatches",
"deliveries",
"users");

onRecordUpdateRequest((e) => {
  const { getOperatorId, createAuditLog } = require(`${__hooks}/utils/helpers.js`);
  const { AUDIT_FIELDS } = require(`${__hooks}/utils/config.js`);

  const fields = AUDIT_FIELDS[e.collection.name];
  const previous = fields ? e.record.original() : null;

  e.next();

  try {
    const operatorId = getOperatorId(e);
    if (!fields || !operatorId) {
      return;
    }

    const changes = [];
    for (const field of fields) {
      const oldValue = previous.get(field);
      const newValue = e.record.get(field);
      if (String(oldValue) !== String(newValue)) {
        changes.push({ field: field, old_value: oldValue, new_value: newValue });
      }
    }

    if (changes.length === 0) {
      return;
    }

    let statusField = null;
    if (fields.includes("classification_status")) {
      statusField = "classification_status";
    } else if (fields.includes("status")) {
      statusField = "status";
    }

    const isStatusChange =
      statusField && changes.some((change) => change.field === statusField);

    createAuditLog(
      e.app,
      e.collection.name,
      e.record.id,
      isStatusChange ? "status_change" : "update",
      { changes: changes },
      operatorId,
      null
    );
  } catch (err) {
    console.error(
      "Error creating audit log for " + e.collection.name + " update:",
      err
    );
  }
},
"donations",
"donation_items",
"requests",
"request_items",
"reservations",
"dispatches",
"deliveries",
"users");
