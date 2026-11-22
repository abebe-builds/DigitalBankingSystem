// Quick smoke test: login as customer dev user via the running server
const res = await fetch('http://localhost:3000/api/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: 'customer@dev.local', password: 'DevPass123!' }),
});
const json = await res.json();
console.log('Status:', res.status);
console.log('Body:', JSON.stringify(json, null, 2));
console.log('Set-Cookie present:', !!res.headers.get('set-cookie'));
