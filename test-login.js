import fetch from "node-fetch";

const res = await fetch("https://haff-picklepulse.vercel.app/api/auth?action=login", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ email: "gianaiboboyero@users.noreply.github.com", password: "password" })
});
console.log(res.status);
const text = await res.text();
console.log(text);
