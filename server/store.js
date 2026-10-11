// Bounded in-memory store (FIFO eviction). Swap for a database in production:
// the interface (put/get/list) is deliberately tiny. Entries are deep-frozen
// so stored audit snapshots are immutable.

import { stableStringify } from "../src/engine/hash.js";

function deepFreeze(o) {
  if (o && typeof o === "object" && !Object.isFrozen(o)) {
    Object.freeze(o);
    Object.values(o).forEach(deepFreeze);
  }
  return o;
}

class Bucket {
  constructor(max) {
    this.max = max;
    this.map = new Map();
  }
  get(id) {
    return this.map.get(id);
  }
  has(id) {
    return this.map.has(id);
  }
  set(id, value) {
    if (!this.map.has(id) && this.map.size >= this.max) this.map.delete(this.map.keys().next().value);
    this.map.set(id, deepFreeze(value));
  }
  values() {
    return [...this.map.values()];
  }
  /** Values whose key starts with `prefix` (used for per-tenant listing). */
  valuesWithPrefix(prefix) {
    const out = [];
    for (const [k, v] of this.map) if (k.startsWith(prefix)) out.push(v);
    return out;
  }
}

export class Store {
  constructor(maxEntries = 5000) {
    this.mandates = new Bucket(maxEntries);
    this.executions = new Bucket(maxEntries);
    this.audits = new Bucket(maxEntries);
  }

  /**
   * Insert an immutable record. Same id + same content is an idempotent replay;
   * same id + different content is a conflict (never silently overwritten).
   * @returns {{status: "created"|"replayed"|"conflict", record: object}}
   */
  putImmutable(bucket, id, record) {
    const existing = bucket.get(id);
    if (!existing) {
      bucket.set(id, record);
      return { status: "created", record: bucket.get(id) };
    }
    const same = stableStringify(existing) === stableStringify(record);
    return { status: same ? "replayed" : "conflict", record: existing };
  }

  /** Audits belonging to one tenant for one execution id. */
  auditsForExecution(tenant, executionId) {
    return this.audits.valuesWithPrefix(`${tenant}:`).filter((a) => a.execution.caseId === executionId);
  }
}
