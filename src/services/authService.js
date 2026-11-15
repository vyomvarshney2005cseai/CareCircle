const jwt = require('jsonwebtoken');
const config = require('../config');
const AppError = require('../errors/appError');
const { ROLES } = require('../constants/roles');
const { DEFAULT_ROLE_PERMISSIONS } = require('../constants/permissions');
const { generateRandomPasscode, hashPasscode, comparePasscode } = require('../utils/passcode');
const { getRepository } = require('../repositories');
const { recordAudit } = require('./auditService');
const logger = require('../utils/logger');

const LOCKOUT_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes

/**
 * Generate a signed JWT token.
 * @param {string} profileId
 * @param {object} member
 * @returns {string}
 */
function signToken(profileId, member) {
  return jwt.sign(
    {
      profileId,
      memberId: member.id,
      role: member.role,
      email: member.email,
      name: member.name
    },
    config.jwtSecret,
    { expiresIn: '7d' }
  );
}

/**
 * Register a new elder profile and primary elder member.
 * @param {{ elderName: string, elderEmail: string, passcode: string, timezone?: string }} data
 */
async function registerElder({ elderName, elderEmail, passcode, timezone = 'Asia/Kolkata' }) {
  const repo = getRepository();

  // Create Profile
  const profile = await repo.createProfile({
    elderName,
    elderEmail,
    timezone,
    settings: {
      requireElderApprovalForEdits: false,
      escalationMinutes: { remindElder: 0, missedAfter: 30, alertCaretakerAfter: 60 }
    }
  });

  // Hash passcode
  const passcodeHash = await hashPasscode(passcode);

  // Create Elder Member with all permissions
  const elderMember = await repo.createMember(profile.id, {
    name: elderName,
    email: elderEmail,
    role: ROLES.ELDER,
    passcodeHash,
    permissions: DEFAULT_ROLE_PERMISSIONS[ROLES.ELDER],
    active: true
  });

  await recordAudit(profile.id, {
    actorMemberId: elderMember.id,
    actorName: elderMember.name,
    action: 'CREATE_PROFILE',
    entity: 'profile',
    entityId: profile.id,
    summary: `Profile created for ${elderName}`
  });

  const token = signToken(profile.id, elderMember);

  return {
    profile,
    member: {
      id: elderMember.id,
      name: elderMember.name,
      email: elderMember.email,
      role: elderMember.role,
      permissions: elderMember.permissions
    },
    token
  };
}

/**
 * Generate an invite passcode for a caretaker or family member.
 * Shown ONCE to the elder, stored hashed.
 * @param {string} profileId
 * @param {object} actorElder
 * @param {{ role: string, permissions?: object, expiresInDays?: number }} data
 */
async function createInvite(profileId, actorElder, { role, permissions, expiresInDays = 7 }) {
  const repo = getRepository();
  const profile = await repo.getProfile(profileId);
  if (!profile) {
    throw AppError.notFound('Profile not found');
  }

  // Generate 8-character random alphanumeric passcode
  const rawInviteCode = generateRandomPasscode(8);
  const codeHash = await hashPasscode(rawInviteCode);

  const expiresAt = new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000).toISOString();
  const defaultPerms = DEFAULT_ROLE_PERMISSIONS[role] || DEFAULT_ROLE_PERMISSIONS[ROLES.FAMILY];
  const assignedPermissions = { ...defaultPerms, ...(permissions || {}) };

  const invite = await repo.createInvite(profileId, {
    codeHash,
    role,
    permissions: assignedPermissions,
    expiresAt,
    createdBy: actorElder.memberId,
    active: true
  });

  await recordAudit(profileId, {
    actorMemberId: actorElder.memberId,
    actorName: actorElder.name,
    action: 'CREATE_INVITE',
    entity: 'invite',
    entityId: invite.id,
    summary: `Created invite for role ${role} (expires ${expiresAt.slice(0, 10)})`
  });

  return {
    inviteId: invite.id,
    inviteCode: rawInviteCode, // Shown ONCE
    role: invite.role,
    permissions: invite.permissions,
    expiresAt: invite.expiresAt
  };
}

/**
 * Join an existing profile using profileId + 8-char inviteCode + personal details.
 * @param {{ profileId: string, inviteCode: string, name: string, email: string, passcode: string }} data
 */
async function joinProfile({ profileId, inviteCode, name, email, passcode }) {
  const repo = getRepository();
  const profile = await repo.getProfile(profileId);
  if (!profile) {
    throw AppError.notFound('CareCircle profile not found');
  }

  const existingMember = await repo.getMemberByEmail(profileId, email);
  if (existingMember) {
    throw AppError.conflict('A member with this email already exists in this CareCircle profile');
  }

  // Find matching active invite
  const invites = await repo.listInvites(profileId);
  const now = new Date();
  let matchedInvite = null;

  for (const inv of invites) {
    if (!inv.active) continue;
    if (inv.expiresAt && new Date(inv.expiresAt) < now) continue;

    const matches = await comparePasscode(inviteCode, inv.codeHash);
    if (matches) {
      matchedInvite = inv;
      break;
    }
  }

  if (!matchedInvite) {
    throw AppError.badRequest('Invalid, expired, or already used invite passcode');
  }

  // Hash the new member's personal passcode
  const passcodeHash = await hashPasscode(passcode);

  const newMember = await repo.createMember(profileId, {
    name,
    email,
    role: matchedInvite.role,
    passcodeHash,
    permissions: matchedInvite.permissions,
    active: true
  });

  // Deactivate single-use invite
  await repo.updateInvite(profileId, matchedInvite.id, {
    active: false,
    usedBy: newMember.id,
    usedAt: now.toISOString()
  });

  await recordAudit(profileId, {
    actorMemberId: newMember.id,
    actorName: newMember.name,
    action: 'JOIN_PROFILE',
    entity: 'member',
    entityId: newMember.id,
    summary: `${name} joined CareCircle as ${matchedInvite.role}`
  });

  const token = signToken(profileId, newMember);

  return {
    profile,
    member: {
      id: newMember.id,
      name: newMember.name,
      email: newMember.email,
      role: newMember.role,
      permissions: newMember.permissions
    },
    token
  };
}

/**
 * Login with profileId + email + passcode.
 * Enforces rate limiting & lockout after 5 consecutive failures.
 * @param {{ profileId: string, email: string, passcode: string }} data
 */
async function login({ profileId, email, passcode }) {
  const repo = getRepository();
  const profile = await repo.getProfile(profileId);

  // If profile not found, dummy hash comparison to avoid timing analysis
  if (!profile) {
    await hashPasscode('dummy-timing-defense');
    throw AppError.unauthorized('Invalid profile ID, email, or passcode');
  }

  const member = await repo.getMemberByEmail(profileId, email);
  if (!member || !member.active) {
    await hashPasscode('dummy-timing-defense');
    throw AppError.unauthorized('Invalid profile ID, email, or passcode');
  }

  const now = new Date();

  // Check temporary lockout
  if (member.lockoutUntil && new Date(member.lockoutUntil) > now) {
    const minutesLeft = Math.ceil((new Date(member.lockoutUntil) - now) / 60000);
    logger.warn({ memberId: member.id, profileId }, 'Blocked login attempt on locked account');
    throw AppError.locked(
      `Account is temporarily locked due to multiple failed login attempts. Try again in ${minutesLeft} minute(s).`
    );
  }

  const isMatch = await comparePasscode(passcode, member.passcodeHash);

  if (!isMatch) {
    const failedAttempts = (member.failedLoginAttempts || 0) + 1;
    let lockoutUntil = null;

    if (failedAttempts >= LOCKOUT_ATTEMPTS) {
      lockoutUntil = new Date(Date.now() + LOCKOUT_DURATION_MS).toISOString();
      logger.warn(
        { memberId: member.id, profileId, failedAttempts },
        'Account locked after consecutive failed logins'
      );
    }

    await repo.updateMember(profileId, member.id, {
      failedLoginAttempts: failedAttempts,
      lockoutUntil
    });

    if (lockoutUntil) {
      throw AppError.locked(
        'Too many failed attempts. Your account has been temporarily locked for 15 minutes.'
      );
    }

    throw AppError.unauthorized('Invalid profile ID, email, or passcode');
  }

  // Login successful: reset failed attempts if any
  if (member.failedLoginAttempts > 0 || member.lockoutUntil) {
    await repo.updateMember(profileId, member.id, {
      failedLoginAttempts: 0,
      lockoutUntil: null
    });
  }

  const token = signToken(profileId, member);

  return {
    profile,
    member: {
      id: member.id,
      name: member.name,
      email: member.email,
      role: member.role,
      permissions: member.permissions
    },
    token
  };
}

module.exports = {
  registerElder,
  createInvite,
  joinProfile,
  login,
  signToken
};
