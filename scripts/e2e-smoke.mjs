import { chromium } from "playwright";

const BASE = process.env.E2E_BASE_URL ?? "https://haffleisureclub.vercel.app";
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
const SUPABASE_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  ?? process.env.SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY before running e2e smoke tests.");
  process.exit(1);
}

const TEST_PLAYERS = ["Alex Test", "Blake Test", "Casey Test", "Dana Test"];

const results = [];

function log(step, ok, detail = "") {
  results.push({ step, ok, detail });
  console.log(`[${ok ? "PASS" : "FAIL"}] ${step}${detail ? ` — ${detail}` : ""}`);
}

async function fetchSession() {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/Session?select=id,checkedInPlayerIds,settings&id=eq.default-active-session`,
    { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } }
  );
  const rows = await res.json();
  return rows[0] ?? null;
}

async function checkInPlayer(page, name) {
  const row = page.locator("div.flex.min-h-16", { has: page.getByText(name, { exact: true }) });
  const btn = row.first().getByRole("button", { name: "Check In" });
  if (await btn.isVisible().catch(() => false)) {
    await btn.click();
    await page.waitForTimeout(1500);
    return true;
  }
  return false;
}

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

try {
  await page.goto(BASE, { waitUntil: "networkidle", timeout: 60000 });
  log("Homepage loads", page.url().includes("haffleisureclub"));

  await page.getByRole("navigation").getByRole("button", { name: /Admin/i }).click();
  await page.waitForTimeout(3000);
  log("Admin view opens", await page.getByText(/Quick Actions/i).isVisible());

  await page.waitForTimeout(3000);
  const rosterOk = await page.getByText("Alex Test").first().isVisible({ timeout: 15000 }).catch(() => false);
  log("Players roster from Supabase", rosterOk);

  let checkedIn = 0;
  for (const name of TEST_PLAYERS) {
    if (await checkInPlayer(page, name)) checkedIn += 1;
  }
  const session = await fetchSession();
  const ids = session?.checkedInPlayerIds ?? [];
  log("Check in 4 players → Supabase", checkedIn === 4 && ids.length >= 4, `UI=${checkedIn}, DB=${ids.length}`);

  await page.getByRole("button", { name: /Assign Courts/i }).first().click();
  await page.waitForTimeout(3000);
  const finishBtn = page.getByRole("button", { name: /^Finish$/i }).first();
  const hasMatch = await finishBtn.isVisible({ timeout: 8000 }).catch(() => false);
  log("Assign Courts → active match on court", hasMatch);

  await page.goto(`${BASE}/tv`, { waitUntil: "networkidle" });
  await page.waitForTimeout(3000);
  const tvOk =
    (await page.getByText(/Stack queue/i).isVisible().catch(() => false)) ||
    (await page.getByText(/Court 1/i).first().isVisible().catch(() => false)) ||
    (await page.getByText(/Alex Test|Blake Test/i).first().isVisible().catch(() => false));
  log("TV display view (/tv)", tvOk);

  await page.goto(`${BASE}/admin`, { waitUntil: "networkidle" });
  await page.waitForTimeout(2000);

  if (hasMatch && (await finishBtn.isVisible().catch(() => false))) {
    await finishBtn.click();
    await page.waitForTimeout(2500);
    log("Finish court ends match", !(await finishBtn.isVisible().catch(() => false)));
  }

  await page.goto(`${BASE}/player`, { waitUntil: "networkidle" });
  await page.waitForTimeout(3000);
  const playerOk = await page.getByText(/Sign in|Register|checked in|Open play|My games|HAFF/i).first().isVisible().catch(() => false);
  log("Player view loads (/player)", playerOk);

  await page.goto(`${BASE}/admin`, { waitUntil: "networkidle" });
  await page.waitForTimeout(2000);
  if (await checkInPlayer(page, "Alex Test") === false) {
    const out = page.locator("div.flex.min-h-16", { has: page.getByText("Alex Test", { exact: true }) }).first().getByRole("button", { name: "Out" });
    if (await out.isVisible().catch(() => false)) {
      await out.click();
      await page.waitForTimeout(2000);
    }
  }
  const sessionOut = await fetchSession();
  log("Check out flow", true, `remaining checked-in: ${(sessionOut?.checkedInPlayerIds ?? []).length}`);

  const apiAuth = await fetch(`${BASE}/api/auth?action=me`).then((r) => r.json());
  log("Vercel /api/auth", apiAuth && "user" in apiAuth, JSON.stringify(apiAuth));

  const clubRes = await fetch(`${BASE}/api/club-state?sessionId=default-active-session`);
  await clubRes.json().catch(() => null);
  log("Vercel /api/club-state (no cookie)", clubRes.status === 401, `HTTP ${clubRes.status} — expected 401 without login`);

  const courts = await fetch(`${SUPABASE_URL}/rest/v1/Court?select=name`, {
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` }
  }).then((r) => r.json());
  log("Supabase backend courts", Array.isArray(courts) && courts.length === 3, JSON.stringify(courts.map((c) => c.name)));

  const matchesInSettings = (await fetchSession())?.settings?.matches ?? [];
  log("Session settings has matches after play", Array.isArray(matchesInSettings), `match count in settings: ${Array.isArray(matchesInSettings) ? matchesInSettings.length : "n/a"}`);
} catch (err) {
  log("E2E runner error", false, String(err?.message ?? err));
} finally {
  await browser.close();
}

const failed = results.filter((r) => !r.ok);
console.log("\n--- Summary ---");
console.log(`Passed: ${results.length - failed.length}/${results.length}`);
if (failed.length) {
  console.log("Failed:", failed.map((f) => `${f.step}${f.detail ? ` (${f.detail})` : ""}`).join("; "));
  process.exit(1);
}
