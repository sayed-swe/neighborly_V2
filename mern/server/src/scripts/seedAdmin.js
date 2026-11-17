/**
 * Creates (or promotes) an admin account. Admins are never self-selected at sign-up.
 * Usage: npm run seed:admin -- --email admin@example.com --name "Site Admin" --password "S0me-long-pass"
 */
import { parseArgs } from 'node:util';
import bcrypt from 'bcryptjs';
import env from '../config/env.js';
import { connectDB, disconnectDB } from '../config/db.js';
import { User } from '../modules/users/user.model.js';
import { email as emailSchema, password as passwordSchema, name as nameSchema } from '../modules/auth/auth.schemas.js';

const { values } = parseArgs({
  options: { email: { type: 'string' }, name: { type: 'string', default: 'Neighborly Admin' }, password: { type: 'string' } },
});

try {
  const email = emailSchema.parse(values.email);
  const name = nameSchema.parse(values.name);
  await connectDB();
  const existing = await User.findOne({ email });
  if (existing) {
    await User.updateOne({ _id: existing._id }, { role: 'admin', status: 'active', emailVerified: true, $inc: { tokenVersion: 1 } });
    console.log(`✅ Promoted ${email} to admin`);
  } else {
    const password = passwordSchema.parse(values.password);
    await User.create({
      name, email, role: 'admin', emailVerified: true, emailVerifiedAt: new Date(),
      passwordHash: await bcrypt.hash(password, env.BCRYPT_ROUNDS),
    });
    console.log(`✅ Created admin ${email}`);
  }
} catch (err) {
  console.error('❌', err.issues?.map((i) => i.message).join(', ') ?? err.message);
  process.exitCode = 1;
} finally {
  await disconnectDB();
}
