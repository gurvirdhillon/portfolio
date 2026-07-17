const crypto = require('crypto');

const password = process.argv[2];
if (!password) {
  console.error('Usage: npm run hash-admin-password -- "your password"');
  process.exit(1);
}

const salt = crypto.randomBytes(16);
const hash = crypto.scryptSync(password, salt, 64);
console.log(`ADMIN_PASSWORD_HASH=scrypt$${salt.toString('hex')}$${hash.toString('hex')}`);
