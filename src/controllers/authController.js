const authService = require('../services/authService');
const config = require('../config');
const {
  registerElderSchema,
  loginSchema,
  createInviteSchema,
  joinSchema
} = require('../utils/validators');

const COOKIE_NAME = 'token';
const COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: 'strict',
  secure: config.env === 'production',
  maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
};

/**
 * Register a new elder and profile.
 */
async function registerElder(req, res, next) {
  try {
    const validated = registerElderSchema.parse(req.body);
    const result = await authService.registerElder(validated);

    res.cookie(COOKIE_NAME, result.token, COOKIE_OPTIONS);
    return res.status(201).json({
      data: {
        profile: result.profile,
        member: result.member,
        token: result.token
      }
    });
  } catch (err) {
    return next(err);
  }
}

/**
 * Generate an invite passcode (Elder only).
 */
async function createInvite(req, res, next) {
  try {
    const validated = createInviteSchema.parse(req.body);
    const result = await authService.createInvite(
      req.params.profileId || req.user.profileId,
      req.user,
      validated
    );
    return res.status(201).json({ data: result });
  } catch (err) {
    return next(err);
  }
}

/**
 * Join an existing profile via invite passcode.
 */
async function join(req, res, next) {
  try {
    const validated = joinSchema.parse(req.body);
    const result = await authService.joinProfile(validated);

    res.cookie(COOKIE_NAME, result.token, COOKIE_OPTIONS);
    return res.status(201).json({
      data: {
        profile: result.profile,
        member: result.member,
        token: result.token
      }
    });
  } catch (err) {
    return next(err);
  }
}

/**
 * Login with profileId + email + passcode.
 */
async function login(req, res, next) {
  try {
    const validated = loginSchema.parse(req.body);
    const result = await authService.login(validated);

    res.cookie(COOKIE_NAME, result.token, COOKIE_OPTIONS);
    return res.status(200).json({
      data: {
        profile: result.profile,
        member: result.member,
        token: result.token
      }
    });
  } catch (err) {
    return next(err);
  }
}

/**
 * Clear authentication session cookie.
 */
async function logout(req, res) {
  res.clearCookie(COOKIE_NAME, {
    httpOnly: true,
    sameSite: 'strict',
    secure: config.env === 'production'
  });
  return res.status(200).json({ data: { message: 'Logged out successfully' } });
}

/**
 * Return currently authenticated user and active profile.
 */
async function getMe(req, res) {
  return res.status(200).json({
    data: {
      user: req.user,
      profile: req.profile
    }
  });
}

module.exports = {
  registerElder,
  createInvite,
  join,
  login,
  logout,
  getMe
};
