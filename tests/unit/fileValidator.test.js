const { validateMagicBytes, MAX_FILE_SIZE_BYTES, ALLOWED_MIME_TYPES } = require('../../src/utils/fileValidator');

describe('File Validator & Magic Bytes', () => {
  it('confirms 5MB size limit and allowed MIME types', () => {
    expect(MAX_FILE_SIZE_BYTES).toBe(5 * 1024 * 1024);
    expect(ALLOWED_MIME_TYPES.has('image/jpeg')).toBe(true);
    expect(ALLOWED_MIME_TYPES.has('image/png')).toBe(true);
    expect(ALLOWED_MIME_TYPES.has('image/webp')).toBe(true);
    expect(ALLOWED_MIME_TYPES.has('application/pdf')).toBe(false);
  });

  it('validates genuine JPEG magic bytes (FF D8 FF)', () => {
    const validJpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01]);
    expect(validateMagicBytes(validJpeg, 'image/jpeg')).toBe(true);
  });

  it('validates genuine PNG magic bytes (89 50 4E 47)', () => {
    const validPng = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d]);
    expect(validateMagicBytes(validPng, 'image/png')).toBe(true);
  });

  it('validates genuine WebP magic bytes (RIFF...WEBP)', () => {
    const validWebp = Buffer.from([
      0x52, 0x49, 0x46, 0x46, // RIFF
      0x24, 0x00, 0x00, 0x00, // size
      0x57, 0x45, 0x42, 0x50  // WEBP
    ]);
    expect(validateMagicBytes(validWebp, 'image/webp')).toBe(true);
  });

  it('rejects spoofed file with fake extension and wrong magic bytes', () => {
    const fakeFile = Buffer.from('This is a plain text file masquerading as an image header.');
    expect(validateMagicBytes(fakeFile, 'image/jpeg')).toBe(false);
    expect(validateMagicBytes(fakeFile, 'image/png')).toBe(false);
    expect(validateMagicBytes(fakeFile, 'image/webp')).toBe(false);
  });

  it('rejects buffers shorter than 12 bytes or null buffers', () => {
    expect(validateMagicBytes(Buffer.from([0xff, 0xd8]), 'image/jpeg')).toBe(false);
    expect(validateMagicBytes(null, 'image/jpeg')).toBe(false);
    expect(validateMagicBytes(undefined, 'image/png')).toBe(false);
  });
});
