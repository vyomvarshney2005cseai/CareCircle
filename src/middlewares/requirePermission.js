const { ROLES } = require('../constants/roles');
const AppError = require('../errors/appError');

/**
 * Middleware factory requiring a specific permission flag or elder role.
 * @param {string} permissionKey - e.g. 'canViewMeds', 'canEditMeds'
 */
function requirePermission(permissionKey) {
  return (req, res, next) => {
    if (!req.user) {
      return next(AppError.unauthorized('Authentication required'));
    }

    // Elder role has full bypass authority across all operations
    if (req.user.role === ROLES.ELDER) {
      return next();
    }

    if (req.user.permissions && req.user.permissions[permissionKey] === true) {
      return next();
    }

    return next(AppError.forbidden(`Missing required permission: ${permissionKey}`));
  };
}

/**
 * Middleware requiring strictly the 'elder' role (e.g. for inviting members, altering approvals, revoking).
 */
function requireElder() {
  return (req, res, next) => {
    if (!req.user) {
      return next(AppError.unauthorized('Authentication required'));
    }

    if (req.user.role !== ROLES.ELDER) {
      return next(AppError.forbidden('Only the elder profile owner can perform this action'));
    }

    return next();
  };
}

module.exports = {
  requirePermission,
  requireElder
};
