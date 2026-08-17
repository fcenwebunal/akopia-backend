// ─────────────────────────────────────────────────────────────
// 04_audit.js — Audit logging hooks for critical collections
// ─────────────────────────────────────────────────────────────

function _getAuditSnapshot(record, fields) {
  var snapshot = {};
  for (var i = 0; i < fields.length; i++) {
    snapshot[fields[i]] = record.get(fields[i]);
  }
  return snapshot;
}

function _getChangedFields(record, fields) {
  var changes = [];
  for (var i = 0; i < fields.length; i++) {
    var field = fields[i];
    var oldVal = record.getOriginal(field);
    var newVal = record.get(field);
    if (String(oldVal) !== String(newVal)) {
      changes.push({
        field: field,
        old_value: oldVal,
        new_value: newVal,
      });
    }
  }
  return changes;
}

function registerAuditHooks(collectionName, fields) {
  var statusField = null;
  if (fields.indexOf("classification_status") !== -1) {
    statusField = "classification_status";
  } else if (fields.indexOf("status") !== -1) {
    statusField = "status";
  }

  onRecordAfterCreateRequest(collectionName, (e) => {
    try {
      var record = e.record;
      var operatorId = getOperatorId(e);
      if (!operatorId) return;

      createAuditLog(
        collectionName,
        record.id,
        "create",
        { data: _getAuditSnapshot(record, fields) },
        operatorId,
        null
      );
    } catch (err) {
      console.error(
        "Error creating audit log for " + collectionName + " create:",
        err
      );
    }
  });

  onRecordAfterUpdateRequest(collectionName, (e) => {
    try {
      var record = e.record;
      var operatorId = getOperatorId(e);
      if (!operatorId) return;

      var changes = _getChangedFields(record, fields);
      if (changes.length === 0) return;

      var action = "update";
      if (statusField) {
        var statusChanges = changes.filter(function (c) {
          return c.field === statusField;
        });
        if (statusChanges.length > 0) {
          action = "status_change";
        }
      }

      createAuditLog(
        collectionName,
        record.id,
        action,
        { changes: changes },
        operatorId,
        null
      );
    } catch (err) {
      console.error(
        "Error creating audit log for " + collectionName + " update:",
        err
      );
    }
  });
}

// ── Register audit hooks for each collection ─────────────────

registerAuditHooks("donations", [
  "code",
  "donor_type",
  "donor_name",
  "donor_phone",
  "donor_email",
  "donor_rfc",
  "notes",
  "operator_id",
]);

registerAuditHooks("donation_items", [
  "product_id",
  "quantity",
  "classification_status",
  "location_id",
  "unit_id",
  "rejection_reason",
]);

registerAuditHooks("requests", [
  "code",
  "status",
  "priority",
  "destination",
  "requester_name",
  "requester_phone",
  "requester_institution",
  "approved_by",
  "rejection_reason",
]);

registerAuditHooks("request_items", [
  "product_id",
  "unit_id",
  "quantity_requested",
  "quantity_fulfilled",
  "status",
]);

registerAuditHooks("reservations", [
  "request_item_id",
  "inventory_id",
  "quantity_reserved",
  "status",
]);

registerAuditHooks("dispatches", [
  "code",
  "driver_name",
  "driver_phone",
  "vehicle_plate",
  "destination",
  "dispatch_date",
  "brigade",
]);

registerAuditHooks("deliveries", [
  "dispatch_id",
  "receiver_name",
  "receiver_phone",
  "status",
  "delivery_date",
]);

registerAuditHooks("users", [
  "full_name",
  "role",
  "phone",
  "active",
]);
