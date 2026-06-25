import fetch from 'node-fetch';

async function main() {
  const res = await fetch('https://haffleisureclub.com/api/state?action=pull');
  const data = await res.json();
  console.log('Shared State:', JSON.stringify(data, null, 2));
}

main().catch(console.error);
