const jwt = require('jsonwebtoken');
const config = require('../config');
const AppError = require('../errors/appError');
const { getRepository } = require('../repositories');

/**
 * Authentication middleware verifying JWT from cookie or Bearer header.
 */
async function authenticate(req, res, next) {
  try {
    let token = null;

    if (req.cookies && req.cookies.token) {
      token = req.cookies.token;
    } else if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
      token = req.headers.authorization.slice(7);
    }

    if (!token) {
      throw AppError.unauthorized('Authentication required: please log in');
    }

    const payload = jwt.verify(token, config.jwtSecret);
    const repo = getRepository();

    const member = await repo.getMemberById(payload.profileId, payload.memberId);
    if (!member || !member.active) {
      throw AppError.unauthorized('Account is inactive or not found');
    }

    const profile = await repo.getProfile(payload.profileId);
    if (!profile) {
      throw AppError.unauthorized('Profile not found');
    }

    req.user = {
      profileId: payload.profileId,
      memberId: member.id,
      role: member.role,
      permissions: member.permissions || {},
      email: member.email,
      name: member.name
    };
    req.profile = profile;

    return next();
  } catch (err) {
    return next(err);
  }
}

module.exports = authenticate;
