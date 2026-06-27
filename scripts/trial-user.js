import { assignTrialToUser, createTrialUser, getUserByEmail, updateUser } from '../db.js';

const [, , email, ...args] = process.argv;
const maybeDays = Number(args.at(-1));
const hasDays = Number.isFinite(maybeDays) && maybeDays > 0;
const days = hasDays ? maybeDays : 30;
const password = hasDays ? args.at(-2) : args.at(-1);
const nameParts = args.slice(0, hasDays ? -2 : -1);
const name = nameParts.join(' ').trim();

if (!email || !name || !password) {
  console.error('Usage: npm run trial:user -- email@example.com Full Name Password123 [days]');
  process.exit(1);
}

const existing = await getUserByEmail(email);
let user;

if (existing) {
  await assignTrialToUser({ email, days, password });
  user = await updateUser(existing.id, { name });
} else {
  user = await createTrialUser({ name, email, password });
}

console.log(JSON.stringify({
  email: user.email,
  name: user.name,
  subscriptionStatus: user.subscriptionStatus,
  trialEndsAt: user.trialEndsAt,
  trialDaysRemaining: user.trialDaysRemaining,
}, null, 2));
