import assert from "node:assert/strict";
import test from "node:test";

import { requeueFinishedPlayers } from "../apps/web/src/lib/utils.ts";

test("finished players return to the tail of the stack in match order", () => {
  assert.deepEqual(
    requeueFinishedPlayers(
      ["waiting-1", "player-2", "vacant", "waiting-2", "player-1"],
      ["player-1", "player-2", "player-3", "player-4"]
    ),
    ["waiting-1", "vacant", "waiting-2", "player-1", "player-2", "player-3", "player-4"]
  );
});

test("requeue ignores vacant match slots and duplicate player ids", () => {
  assert.deepEqual(
    requeueFinishedPlayers(["waiting-1"], ["player-1", "vacant-2", "player-1", "reserved"]),
    ["waiting-1", "player-1"]
  );
});
