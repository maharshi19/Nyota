import { getUserByEmail, updateUser } from '../db.js';

const [, , email] = process.argv;

if (!email) {
  console.error('Usage: npm run trial:expire -- email@example.com');
  process.exit(1);
}

const user = await getUserByEmail(email);
if (!user) {
  console.error(`No active user found for ${email}`);
  process.exit(1);
}

const expiredAt = new Date(Date.now() - 60 * 1000).toISOString().replace(/\.\d{3}Z$/, 'Z');
const updated = await updateUser(user.id, {
  subscriptionStatus: 'trialing',
  trialEndsAt: expiredAt,
});

console.log(JSON.stringify({
  email: updated.email,
  subscriptionStatus: updated.subscriptionStatus,
  trialEndsAt: updated.trialEndsAt,
  trialDaysRemaining: updated.trialDaysRemaining,
}, null, 2));
