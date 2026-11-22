import { createHash } from "crypto";

// Qdrant point IDs must be an unsigned integer or a valid UUID string —
// not an arbitrary string like our chunk id ("elden-ring-combat-chunk-0").
// To satisfy that while still avoiding duplicate points on repeated
// ingestion (see the Phase 5 "avoid duplicate points" requirement), we
// derive a deterministic UUID v5 from (documentId, chunkIndex): the same
// chunk always maps to the same point ID, so re-ingesting upserts the
// existing point instead of creating a new one alongside it.
//
// Implemented locally (RFC 4122 §4.3, SHA-1 based) rather than adding a
// dependency for this one function — Node's crypto module has everything
// needed.

// A fixed, arbitrary namespace UUID for this application. Any valid UUID
// works as a v5 namespace as long as it's used consistently — changing
// this later would change every derived point ID.
const NAMESPACE = "6f9c3b2a-6e6d-4a2b-9f0e-2f7c8f1a9d3e";

export function deterministicPointId(documentId: string, chunkIndex: number): string {
  return uuidV5(`${documentId}::${chunkIndex}`, NAMESPACE);
}

function uuidV5(name: string, namespace: string): string {
  const namespaceBytes = uuidToBytes(namespace);
  const nameBytes = Buffer.from(name, "utf-8");

  const hash = createHash("sha1")
    .update(Buffer.concat([namespaceBytes, nameBytes]))
    .digest();

  const bytes = hash.subarray(0, 16);

  // Set version (5) in byte 6's high nibble.
  bytes[6] = (bytes[6] & 0x0f) | 0x50;
  // Set variant (RFC 4122) in byte 8's top two bits.
  bytes[8] = (bytes[8] & 0x3f) | 0x80;

  return bytesToUuid(bytes);
}

function uuidToBytes(uuid: string): Buffer {
  const hex = uuid.replace(/-/g, "");
  return Buffer.from(hex, "hex");
}

function bytesToUuid(bytes: Buffer): string {
  const hex = bytes.toString("hex");
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20, 32),
  ].join("-");
}
