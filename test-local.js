import fetch from "node-fetch";

const res = await fetch("https://haff-picklepulse.vercel.app/api/auth?action=register", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ email: "testloadsforever@example.com", password: "Password1!", displayName: "Test Loads Forever" })
});
console.log(res.status);
const text = await res.text();
console.log(text);
