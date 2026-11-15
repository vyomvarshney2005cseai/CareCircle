const crypto = require('crypto');
const bcrypt = require('bcryptjs');

const BCRYPT_SALT_ROUNDS = 10;
const PASSCODE_CHARS = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';

/**
 * Generate a cryptographically secure random alphanumeric passcode.
 * @param {number} [length=8]
 * @returns {string}
 */
function generateRandomPasscode(length = 8) {
  const bytes = crypto.randomBytes(length);
  let result = '';
  for (let i = 0; i < length; i += 1) {
    result += PASSCODE_CHARS[bytes[i] % PASSCODE_CHARS.length];
  }
  return result;
}

/**
 * Hash a passcode using bcryptjs.
 * @param {string} passcode
 * @returns {Promise<string>}
 */
async function hashPasscode(passcode) {
  return bcrypt.hash(passcode, BCRYPT_SALT_ROUNDS);
}

/**
 * Compare a plain passcode with a stored hash.
 * @param {string} passcode
 * @param {string} hash
 * @returns {Promise<boolean>}
 */
async function comparePasscode(passcode, hash) {
  if (!passcode || !hash) return false;
  return bcrypt.compare(passcode, hash);
}

module.exports = {
  generateRandomPasscode,
  hashPasscode,
  comparePasscode
};
