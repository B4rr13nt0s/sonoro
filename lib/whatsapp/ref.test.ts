import test from "node:test";
import assert from "node:assert/strict";

import { buildOrderRef } from "./ref.ts";

test("buildOrderRef: tiene forma SNR-XXXXX", () => {
  const ref = buildOrderRef("2026-08-21T10:00:00.000Z");
  assert.match(ref, /^SNR-[0-9A-Z]{5}$/);
});

test("buildOrderRef: es determinista — mismo createdAt, mismo ref", () => {
  const a = buildOrderRef("2026-08-21T10:00:00.000Z");
  const b = buildOrderRef("2026-08-21T10:00:00.000Z");
  assert.equal(a, b);
});

test("buildOrderRef: createdAt distinto produce ref distinto", () => {
  const a = buildOrderRef("2026-08-21T10:00:00.000Z");
  const b = buildOrderRef("2026-08-21T10:00:00.001Z");
  assert.notEqual(a, b);
});
