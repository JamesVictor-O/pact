import assert from "node:assert/strict";
import test from "node:test";
import { destinationForAuthIntent } from "./auth-routing.ts";

test("organizers continue to event creation", () => {
  assert.equal(destinationForAuthIntent("organizer"), "/events/new");
});

test("payees continue to agreement review", () => {
  assert.equal(destinationForAuthIntent("payee"), "/agreements");
});
