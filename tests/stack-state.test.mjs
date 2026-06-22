import assert from "node:assert/strict";
import test from "node:test";

import {
  buildSharedPayload,
  includeStackedPlayersInCheckIns,
} from "../apps/web/src/lib/supabase/sessionTransform.ts";

test("stacked players remain checked in when the session array is stale", () => {
  assert.deepEqual(
    includeStackedPlayersInCheckIns(["player-1"], [
      "player-1",
      "player-2",
      "vacant",
      "reserved",
    ]),
    ["player-1", "player-2"]
  );
});

test("shared state preserves a persisted stack when check-ins lag behind", () => {
  const payload = buildSharedPayload({
    id: "session-1",
    checkedInPlayerIds: [],
    updatedAt: "2026-06-22T12:00:00.000Z",
    settings: {
      adminCheckedInIds: ["player-1"],
      stackOrder: ["player-1", "player-2", "vacant", "reserved"],
      matches: [],
    },
  });

  assert.equal("unchanged" in payload, false);
  assert.deepEqual(payload.checkedInPlayerIds, ["player-1", "player-2"]);
  assert.deepEqual(payload.stackOrder, [
    "player-1",
    "player-2",
    "vacant",
    "reserved",
  ]);
});
