/**
 * User roles within CareCircle profiles.
 */
const ROLES = Object.freeze({
  ELDER: 'elder',
  CARETAKER: 'caretaker',
  FAMILY: 'family'
});

const ALL_ROLES = Object.values(ROLES);

module.exports = {
  ROLES,
  ALL_ROLES
};
