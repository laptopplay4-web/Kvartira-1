const baseUrl = 'http://127.0.0.1:8090';

async function testUser(phone, password, label) {
  const authRes = await fetch(`${baseUrl}/api/collections/users/auth-with-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identity: phone, password }),
  });
  const auth = await authRes.json();
  if (!auth.token) {
    console.log(label, 'AUTH FAIL', authRes.status, auth);
    return;
  }
  const headers = { Authorization: auth.token };
  const endpoints = [
    ['lessons', '/api/collections/lessons/records?perPage=3'],
    ['events', '/api/collections/events/records?perPage=3'],
    ['assignments', '/api/collections/assignments/records?perPage=3'],
    ['skill_progress', '/api/collections/student_skill_progress/records?perPage=3'],
    ['users_teachers', '/api/collections/users/records?filter=role="teacher"&perPage=3'],
  ];
  for (const [name, path] of endpoints) {
    const res = await fetch(`${baseUrl}${path}`, { headers });
    const body = await res.text();
    console.log(`${label} ${name}: ${res.status} ${body.slice(0, 150)}`);
  }
}

await testUser('+79001234567', 'student123', 'demo');
await testUser('+79008887766', 'test1234', 'new');
