let authLoading = false;
let authError = "";
let authMode = "login";

async function handleAuthSubmit() {
  authError = "";
  authLoading = true;
  console.log("Start: loading =", authLoading);
  try {
    const res = {
      ok: false,
      text: async () => '{"error": "Supabase not configured"}'
    };
    const text = await res.text();
    const data = text ? JSON.parse(text) : {};
    if (!res.ok) throw new Error(data.error ?? "Unable to continue");
  } catch (reason) {
    authError = reason instanceof Error ? reason.message : "Unable to continue";
    console.log("Catch: error =", authError);
  } finally {
    authLoading = false;
    console.log("Finally: loading =", authLoading);
  }
}

handleAuthSubmit();
