import fetch from 'node-fetch';

async function main() {
  const res = await fetch('https://haffleisureclub.com/api/auth?action=me');
  console.log(res.status, await res.text());
}

main().catch(console.error);
