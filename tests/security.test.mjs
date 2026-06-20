import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  captchaRequired,
  feedbackHashSecret,
  isAllowedAvatarUrl,
  loginFailureBucket,
  publicPlayerDto,
  publicPlayerSelectSql,
  publicReservationDto,
  validPassword
} from "../api/_security.ts";

describe("validPassword", () => {
  it("rejects short passwords", () => {
    assert.equal(validPassword(""), false);
    assert.equal(validPassword("abc"), false);
    assert.equal(validPassword("1234567"), false);
  });

  it("accepts passwords with at least 8 characters", () => {
    assert.equal(validPassword("12345678"), true);
    assert.equal(validPassword("long-enough-secret"), true);
  });
});

describe("publicPlayerDto", () => {
  it("omits phone and email from public roster responses", () => {
    const dto = publicPlayerDto({
      id: "p1",
      displayName: "Alex",
      fullName: "Alex Test",
      phone: "09171234567",
      email: "alex@example.com",
      skillLevel: "Beginner",
      rating: 2,
      statusNote: "VIP",
      status: "Active",
      tags: ["Member"],
      totalGamesPlayed: 1,
      totalDaysPlayed: 1,
      version: 1,
      updatedAt: new Date("2026-01-01")
    });
    assert.equal(dto.displayName, "Alex");
    assert.equal("phone" in dto, false);
    assert.equal("email" in dto, false);
    assert.equal("statusNote" in dto, false);
  });
});

describe("publicReservationDto", () => {
  const reservation = {
    id: "r1",
    courtId: "c1",
    startTime: new Date("2026-06-20T10:00:00Z"),
    endTime: new Date("2026-06-20T11:00:00Z"),
    approvalStatus: "CONFIRMED",
    createdAt: new Date("2026-06-19T10:00:00Z"),
    requesterUserId: "user-host",
    requester: {
      email: "host@example.com",
      player: { displayName: "Host Player" }
    }
  };

  it("hides requester email from anonymous viewers", () => {
    const dto = publicReservationDto(reservation, null);
    assert.equal(dto.requester.email, undefined);
    assert.equal(dto.requester.player.displayName, "Host Player");
  });

  it("shows full reservation to admin", () => {
    const dto = publicReservationDto(reservation, { id: "admin", role: "ADMIN" });
    assert.equal(dto.requester.email, "host@example.com");
  });

  it("shows full reservation to the host", () => {
    const dto = publicReservationDto(reservation, { id: "user-host", role: "MEMBER" });
    assert.equal(dto.requester.email, "host@example.com");
  });
});

describe("feedbackHashSecret", () => {
  it("requires secret in production", () => {
    assert.throws(
      () => feedbackHashSecret({ VERCEL_ENV: "production", FEEDBACK_HASH_SECRET: "" }),
      /FEEDBACK_HASH_SECRET/
    );
  });

  it("allows dev fallback outside production", () => {
    assert.equal(
      feedbackHashSecret({ NODE_ENV: "development", FEEDBACK_HASH_SECRET: "" }),
      "haff-cadiz-dev-only"
    );
  });
});

describe("captchaRequired", () => {
  it("is required in production when turnstile is configured", () => {
    assert.equal(
      captchaRequired({ VERCEL_ENV: "production", TURNSTILE_SECRET_KEY: "secret" }),
      true
    );
  });
});

describe("loginFailureBucket", () => {
  it("normalizes email and uses the first forwarded IP", () => {
    assert.equal(
      loginFailureBucket("Admin@Example.com", "203.0.113.1, 198.51.100.2"),
      "admin@example.com:203.0.113.1"
    );
  });
});

describe("publicPlayerSelectSql", () => {
  it("excludes phone, email, and statusNote from browser roster queries", () => {
    const select = publicPlayerSelectSql();
    assert.match(select, /displayName/);
    assert.doesNotMatch(select, /\bphone\b/);
    assert.doesNotMatch(select, /\bemail\b/);
    assert.doesNotMatch(select, /statusNote/);
  });
});

describe("isAllowedAvatarUrl", () => {
  const base = "https://example.supabase.co";

  it("allows project avatar storage URLs", () => {
    assert.equal(
      isAllowedAvatarUrl(`${base}/storage/v1/object/public/avatars/p1/v1.webp`, base),
      true
    );
  });

  it("rejects external avatar URLs", () => {
    assert.equal(isAllowedAvatarUrl("https://evil.example/photo.jpg", base), false);
  });
});
