import assert from "node:assert/strict";
import test from "node:test";
import { destinationForAuthIntent } from "./auth-routing.ts";

test("organizers continue to the dashboard where event state determines their next step", () => {
  assert.equal(destinationForAuthIntent("organizer"), "/dashboard");
});

test("payees continue to agreement review", () => {
  assert.equal(destinationForAuthIntent("payee"), "/agreements");
});
