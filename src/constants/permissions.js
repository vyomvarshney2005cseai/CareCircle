const { ROLES } = require('./roles');

/**
 * Granular permissions controlling access to profile resources.
 */
const PERMISSIONS = Object.freeze({
  CAN_VIEW_MEDS: 'canViewMeds',
  CAN_EDIT_MEDS: 'canEditMeds',
  CAN_VIEW_APPOINTMENTS: 'canViewAppointments',
  CAN_EDIT_APPOINTMENTS: 'canEditAppointments',
  CAN_VIEW_ADHERENCE: 'canViewAdherence',
  RECEIVE_ALERTS: 'receiveAlerts'
});

/**
 * Default permission matrices by member role.
 */
const DEFAULT_ROLE_PERMISSIONS = Object.freeze({
  [ROLES.ELDER]: {
    canViewMeds: true,
    canEditMeds: true,
    canViewAppointments: true,
    canEditAppointments: true,
    canViewAdherence: true,
    receiveAlerts: true
  },
  [ROLES.CARETAKER]: {
    canViewMeds: true,
    canEditMeds: true,
    canViewAppointments: true,
    canEditAppointments: true,
    canViewAdherence: true,
    receiveAlerts: true
  },
  [ROLES.FAMILY]: {
    canViewMeds: true,
    canEditMeds: false,
    canViewAppointments: true,
    canEditAppointments: false,
    canViewAdherence: true,
    receiveAlerts: true
  }
});

module.exports = {
  PERMISSIONS,
  DEFAULT_ROLE_PERMISSIONS
};
