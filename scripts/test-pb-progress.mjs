const baseUrl = 'http://127.0.0.1:8090';

const authRes = await fetch(`${baseUrl}/api/collections/users/auth-with-password`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ identity: '+79001234567', password: 'student123' }),
});
const auth = await authRes.json();
if (!auth.token) {
  console.error('AUTH FAIL', auth);
  process.exit(1);
}

const headers = { Authorization: auth.token };
const studentId = auth.record.id;

const paths = [
  ['skill_progress', `/api/collections/student_skill_progress/records?filter=student="${studentId}"&perPage=5`],
  ['progress_history -created', `/api/collections/progress_history/records?filter=student="${studentId}"&sort=-created&perPage=5`],
  ['progress_history -id', `/api/collections/progress_history/records?filter=student="${studentId}"&sort=-id&perPage=5`],
  ['user_achievements', `/api/collections/user_achievements/records?filter=student="${studentId}"&perPage=5`],
  ['achievement_defs', '/api/collections/achievement_definitions/records?perPage=5'],
  ['progress_goals', `/api/collections/progress_goals/records?filter=student="${studentId}"&perPage=5`],
  ['skills', '/api/collections/skills/records?perPage=5'],
];

for (const [name, path] of paths) {
  const res = await fetch(`${baseUrl}${path}`, { headers });
  const body = await res.text();
  console.log(`${name}: ${res.status} ${body.slice(0, 250)}`);
}

// Try create notification with read:false
const notifRes = await fetch(`${baseUrl}/api/collections/notifications/records`, {
  method: 'POST',
  headers: { ...headers, 'Content-Type': 'application/json' },
  body: JSON.stringify({
    user: studentId,
    type: 'system',
    title: 'test',
    body: 'test',
    read: false,
    link: '/profile/progress',
  }),
});
console.log('notif create:', notifRes.status, (await notifRes.text()).slice(0, 200));
