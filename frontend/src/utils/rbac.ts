import type { UserRole } from '../types';
import { isPublicRoute } from './seo.ts';

/**
 * Maps each view/route to the roles permitted to access it.
 * Public views (landing, login, register, etc.) are accessible by anyone (or null restriction).
 * Internal views enforce strict role permissions.
 */
export const VIEW_ROLE_PERMISSIONS: Record<string, UserRole[]> = {
  // Public views
  landing: ['APPLICANT', 'LOAN_OFFICER', 'RISK_ANALYST', 'ADMIN'],
  login: ['APPLICANT', 'LOAN_OFFICER', 'RISK_ANALYST', 'ADMIN'],
  register: ['APPLICANT', 'LOAN_OFFICER', 'RISK_ANALYST', 'ADMIN'],
  'login-staff': ['LOAN_OFFICER', 'RISK_ANALYST', 'ADMIN'],
  'login-borrower': ['APPLICANT'],

  // Internal views
  'borrower-portal': ['APPLICANT'],
  'officer-queue': ['LOAN_OFFICER', 'ADMIN'],
  'document-workbench': ['LOAN_OFFICER', 'ADMIN'],
  'underwriting-cockpit': ['RISK_ANALYST', 'ADMIN'],
  'compliance-audit': ['ADMIN'],
  'loan-products': ['ADMIN'],
  'user-admin': ['ADMIN'],
};

/**
 * Validates whether a given view name is registered in CredVidhi.
 */
export function isValidAppView(view: string): boolean {
  return view in VIEW_ROLE_PERMISSIONS || isPublicRoute(view);
}

/**
 * Returns default landing view for a role when authorized.
 */
export function getDefaultViewForRole(role: UserRole): string {
  switch (role) {
    case 'APPLICANT':
      return 'borrower-portal';
    case 'LOAN_OFFICER':
      return 'officer-queue';
    case 'RISK_ANALYST':
      return 'underwriting-cockpit';
    case 'ADMIN':
      return 'compliance-audit';
    default:
      return 'borrower-portal';
  }
}

/**
 * Checks whether a given role is authorized to access a given view.
 * Fails closed: unmapped internal routes are denied.
 */
export function canRoleAccessView(role: UserRole, view: string): boolean {
  if (isPublicRoute(view)) {
    return true;
  }
  const allowed = VIEW_ROLE_PERMISSIONS[view];
  if (!allowed) {
    // Fail closed: unregistered internal views are forbidden
    return false;
  }
  return allowed.includes(role);
}
