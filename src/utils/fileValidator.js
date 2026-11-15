const multer = require('multer');
const AppError = require('../errors/appError');

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5MB
const ALLOWED_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

/**
 * Known file signatures ("magic bytes") per allowed MIME type.
 * WebP needs both the RIFF container header and the WEBP chunk tag.
 */
const MAGIC_SIGNATURES = new Map([
  ['image/jpeg', [{ offset: 0, bytes: [0xff, 0xd8, 0xff] }]],
  ['image/png', [{ offset: 0, bytes: [0x89, 0x50, 0x4e, 0x47] }]],
  [
    'image/webp',
    [
      { offset: 0, bytes: [0x52, 0x49, 0x46, 0x46] },
      { offset: 8, bytes: [0x57, 0x45, 0x42, 0x50] }
    ]
  ]
]);

/**
 * Check whether a buffer contains the given byte sequence at an offset.
 * @param {Buffer} buffer
 * @param {{offset: number, bytes: number[]}} signature
 * @returns {boolean}
 */
function matchesSignature(buffer, { offset, bytes }) {
  return bytes.every((byte, i) => buffer[offset + i] === byte);
}

/**
 * Validate image buffer header against known magic bytes.
 * @param {Buffer} buffer
 * @param {string} mimeType
 * @returns {boolean}
 */
function validateMagicBytes(buffer, mimeType) {
  if (!buffer || buffer.length < 12) return false;
  const signatures = MAGIC_SIGNATURES.get(mimeType);
  return Boolean(signatures) && signatures.every((sig) => matchesSignature(buffer, sig));
}

/**
 * Multer memory storage configuration for prescription images.
 */
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_FILE_SIZE_BYTES
  },
  fileFilter: (req, file, cb) => {
    if (!ALLOWED_MIME_TYPES.has(file.mimetype.toLowerCase())) {
      return cb(
        AppError.badRequest('Invalid file type. Only JPEG, PNG, and WebP images are allowed.')
      );
    }
    return cb(null, true);
  }
});

module.exports = {
  upload,
  validateMagicBytes,
  MAX_FILE_SIZE_BYTES,
  ALLOWED_MIME_TYPES
};
