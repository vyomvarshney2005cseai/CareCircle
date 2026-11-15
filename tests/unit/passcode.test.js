const { generateRandomPasscode, hashPasscode, comparePasscode } = require('../../src/utils/passcode');

describe('Passcode Utility', () => {
  it('generates an 8-character random passcode', () => {
    const code = generateRandomPasscode(8);
    expect(code).toBeDefined();
    expect(typeof code).toBe('string');
    expect(code.length).toBe(8);
    // Should be alphanumeric
    expect(/^[A-Z0-9]+$/.test(code)).toBe(true);
  });

  it('generates unique passcodes on subsequent calls', () => {
    const code1 = generateRandomPasscode(8);
    const code2 = generateRandomPasscode(8);
    expect(code1).not.toBe(code2);
  });

  it('hashes and compares passcodes accurately', async () => {
    const plain = 'secretPass123';
    const hash = await hashPasscode(plain);

    expect(hash).not.toBe(plain);
    expect(typeof hash).toBe('string');

    const isValid = await comparePasscode(plain, hash);
    expect(isValid).toBe(true);

    const isInvalid = await comparePasscode('wrongPassword', hash);
    expect(isInvalid).toBe(false);
  });
});
