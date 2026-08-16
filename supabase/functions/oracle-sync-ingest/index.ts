import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.110.7";

const MAX_BODY_BYTES = 1_000_000;
const MAX_ROWS = 500;
const MAX_CLOCK_SKEW_SECONDS = 300;
const ENTITY_TYPES = new Set(["product", "barcode", "warehouse", "stock_batch"]);

type SyncMode = "dry-run" | "apply";

type SyncRow = {
  entityType: string;
  sourceKey: string;
  idempotencyKey: string;
  sourceUpdatedAt?: string | null;
  payload: Record<string, unknown>;
};

type SyncEnvelope = {
  batchId: string;
  sourceSystem: string;
  mode: SyncMode;
  rows: SyncRow[];
};

function json(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

function timingSafeEqual(left: string, right: string) {
  if (left.length !== right.length) return false;
  let diff = 0;
  for (let index = 0; index < left.length; index += 1) {
    diff |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return diff === 0;
}

async function hmacHex(secret: string, value: string) {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(value));
  return Array.from(new Uint8Array(signature), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function serviceKey() {
  const legacy = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (legacy) return legacy;

  const modernKeys = Deno.env.get("SUPABASE_SECRET_KEYS");
  if (modernKeys) {
    const parsed = JSON.parse(modernKeys) as Record<string, string>;
    if (parsed.default) return parsed.default;
  }

  throw new Error("Supabase server key is unavailable");
}

function validateEnvelope(value: unknown): value is SyncEnvelope {
  if (!value || typeof value !== "object") return false;
  const envelope = value as Partial<SyncEnvelope>;
  if (!envelope.batchId || typeof envelope.batchId !== "string" || envelope.batchId.length > 160) return false;
  if (!envelope.sourceSystem || typeof envelope.sourceSystem !== "string" || envelope.sourceSystem.length > 120) return false;
  if (envelope.mode !== "dry-run" && envelope.mode !== "apply") return false;
  if (!Array.isArray(envelope.rows) || envelope.rows.length === 0 || envelope.rows.length > MAX_ROWS) return false;

  return envelope.rows.every((row) => {
    if (!row || typeof row !== "object") return false;
    if (!ENTITY_TYPES.has(row.entityType)) return false;
    if (!row.sourceKey || typeof row.sourceKey !== "string" || row.sourceKey.length > 240) return false;
    if (!/^[a-f0-9]{64}$/i.test(row.idempotencyKey ?? "")) return false;
    if (!row.payload || typeof row.payload !== "object" || Array.isArray(row.payload)) return false;
    if (row.sourceUpdatedAt && Number.isNaN(Date.parse(row.sourceUpdatedAt))) return false;
    return true;
  });
}

function optionalText(payload: Record<string, unknown>, key: string) {
  const value = payload[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function productFrom(row: SyncRow) {
  const storeCode = optionalText(row.payload, "store_code");
  const nameAr = optionalText(row.payload, "name_ar");
  if (!storeCode || !nameAr) return null;

  return {
    store_code: storeCode,
    name_ar: nameAr,
    name_en: optionalText(row.payload, "name_en"),
    brand: optionalText(row.payload, "brand"),
    generic_name: optionalText(row.payload, "generic_name"),
    strength: optionalText(row.payload, "strength"),
    dosage_form: optionalText(row.payload, "dosage_form"),
    manufacturer: optionalText(row.payload, "manufacturer"),
    barcode: optionalText(row.payload, "barcode"),
  };
}

Deno.serve(async (request) => {
  if (request.method !== "POST") return json(405, { error: "method_not_allowed" });

  const declaredLength = Number(request.headers.get("content-length") ?? "0");
  if (declaredLength > MAX_BODY_BYTES) return json(413, { error: "payload_too_large" });

  const timestampHeader = request.headers.get("x-sync-timestamp") ?? "";
  const signatureHeader = (request.headers.get("x-sync-signature") ?? "").toLowerCase();
  const timestamp = Number(timestampHeader);
  const nowSeconds = Math.floor(Date.now() / 1000);
  if (!Number.isFinite(timestamp) || Math.abs(nowSeconds - timestamp) > MAX_CLOCK_SKEW_SECONDS) {
    return json(401, { error: "stale_or_invalid_timestamp" });
  }

  const rawBody = await request.text();
  if (new TextEncoder().encode(rawBody).byteLength > MAX_BODY_BYTES) {
    return json(413, { error: "payload_too_large" });
  }

  const hmacSecret = Deno.env.get("ORACLE_SYNC_HMAC_SECRET") ?? "";
  if (!hmacSecret) return json(503, { error: "sync_secret_not_configured" });

  const expectedSignature = await hmacHex(hmacSecret, `${timestampHeader}.${rawBody}`);
  if (!/^[a-f0-9]{64}$/.test(signatureHeader) || !timingSafeEqual(signatureHeader, expectedSignature)) {
    return json(401, { error: "invalid_signature" });
  }

  let envelope: unknown;
  try {
    envelope = JSON.parse(rawBody);
  } catch {
    return json(400, { error: "invalid_json" });
  }
  if (!validateEnvelope(envelope)) return json(400, { error: "invalid_envelope" });

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, serviceKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const runRecord = {
    batch_id: envelope.batchId,
    source_system: envelope.sourceSystem,
    mode: envelope.mode,
    status: "receiving",
    received_rows: envelope.rows.length,
    metadata: { connector: "oracle-oledb-x86", protocol: 1 },
    started_at: new Date().toISOString(),
  };

  const { error: runError } = await supabase.from("oracle_sync_runs").upsert(runRecord, {
    onConflict: "batch_id",
  });
  if (runError) return json(500, { error: "run_log_failed" });

  const stagingRows = envelope.rows.map((row) => ({
    batch_id: envelope.batchId,
    source_system: envelope.sourceSystem,
    entity_type: row.entityType,
    source_key: row.sourceKey,
    idempotency_key: row.idempotencyKey.toLowerCase(),
    payload: row.payload,
    source_updated_at: row.sourceUpdatedAt ?? null,
    status: "received",
  }));

  const { error: stagingError } = await supabase.from("oracle_sync_staging").upsert(stagingRows, {
    onConflict: "idempotency_key",
    ignoreDuplicates: true,
  });
  if (stagingError) {
    await supabase.from("oracle_sync_runs").update({ status: "failed", error: "staging_failed" }).eq("batch_id", envelope.batchId);
    return json(500, { error: "staging_failed" });
  }

  const productRows = envelope.rows.map((row) => ({ row, product: row.entityType === "product" ? productFrom(row) : null }));
  const validProducts = productRows.filter((item) => item.product !== null);
  const invalidProductKeys = productRows
    .filter((item) => item.row.entityType === "product" && item.product === null)
    .map((item) => item.row.idempotencyKey.toLowerCase());

  if (envelope.mode === "dry-run") {
    await supabase.from("oracle_sync_staging").update({ status: "validated" }).eq("batch_id", envelope.batchId).eq("status", "received");
    if (invalidProductKeys.length > 0) {
      await supabase.from("oracle_sync_staging").update({ status: "failed", error: "product_requires_store_code_and_name_ar" }).in("idempotency_key", invalidProductKeys);
    }
    await supabase.from("oracle_sync_runs").update({
      status: invalidProductKeys.length > 0 ? "failed" : "validated",
      skipped_rows: envelope.rows.length - invalidProductKeys.length,
      error_rows: invalidProductKeys.length,
      completed_at: new Date().toISOString(),
    }).eq("batch_id", envelope.batchId);
    return json(200, {
      batchId: envelope.batchId,
      mode: envelope.mode,
      received: envelope.rows.length,
      applied: 0,
      rejected: invalidProductKeys.length,
    });
  }

  let applied = 0;
  if (validProducts.length > 0) {
    const { data: affectedRows, error: productError } = await supabase.rpc("apply_oracle_sync_products", {
      p_rows: validProducts.map((item) => item.product!),
    });
    if (productError) {
      await supabase.from("oracle_sync_runs").update({ status: "failed", error: "product_apply_failed" }).eq("batch_id", envelope.batchId);
      return json(500, { error: "product_apply_failed" });
    }

    const appliedKeys = validProducts.map((item) => item.row.idempotencyKey.toLowerCase());
    await supabase.from("oracle_sync_staging").update({ status: "applied", applied_at: new Date().toISOString() }).in("idempotency_key", appliedKeys);
    applied = typeof affectedRows === "number" ? affectedRows : appliedKeys.length;
  }

  if (invalidProductKeys.length > 0) {
    await supabase.from("oracle_sync_staging").update({ status: "failed", error: "product_requires_store_code_and_name_ar" }).in("idempotency_key", invalidProductKeys);
  }

  const stagedOnly = envelope.rows.length - applied - invalidProductKeys.length;
  await supabase.from("oracle_sync_staging").update({ status: "validated" }).eq("batch_id", envelope.batchId).eq("status", "received");
  await supabase.from("oracle_sync_runs").update({
    status: invalidProductKeys.length > 0 ? "failed" : "completed",
    applied_rows: applied,
    skipped_rows: stagedOnly,
    error_rows: invalidProductKeys.length,
    completed_at: new Date().toISOString(),
  }).eq("batch_id", envelope.batchId);

  return json(200, {
    batchId: envelope.batchId,
    mode: envelope.mode,
    received: envelope.rows.length,
    applied,
    stagedOnly,
    rejected: invalidProductKeys.length,
  });
});
