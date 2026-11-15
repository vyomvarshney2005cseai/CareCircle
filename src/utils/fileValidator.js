const multer = require('multer');
const AppError = require('../errors/appError');

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5MB
const ALLOWED_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

/**
 * Validate image buffer header against known magic bytes.
 * @param {Buffer} buffer
 * @param {string} mimeType
 * @returns {boolean}
 */
function validateMagicBytes(buffer, mimeType) {
  if (!buffer || buffer.length < 12) return false;

  // JPEG: FF D8 FF
  if (mimeType === 'image/jpeg') {
    return buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  }

  // PNG: 89 50 4E 47
  if (mimeType === 'image/png') {
    return buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47;
  }

  // WebP: RIFF (bytes 0-3) and WEBP (bytes 8-11)
  if (mimeType === 'image/webp') {
    const isRiff =
      buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46;
    const isWebp =
      buffer[8] === 0x57 && buffer[9] === 0x45 && buffer[10] === 0x42 && buffer[11] === 0x50;
    return isRiff && isWebp;
  }

  return false;
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
