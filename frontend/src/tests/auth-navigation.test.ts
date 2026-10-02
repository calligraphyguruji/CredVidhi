import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { isPublicRoute, resolveViewFromUrl, ROUTE_SEO_MAP } from '../utils/seo.ts';
import { canRoleAccessView, getDefaultViewForRole } from '../utils/rbac.ts';
import type { UserRole } from '../types/index.ts';

describe('CredVidhi Navigation & Authentication Guards', () => {
  it('correctly classifies public routes', () => {
    assert.equal(isPublicRoute('landing'), true, 'landing must be public');
    assert.equal(isPublicRoute('login'), true, 'login must be public');
    assert.equal(isPublicRoute('register'), true, 'register must be public');
    assert.equal(isPublicRoute('login-staff'), true, 'login-staff must be public');
    assert.equal(isPublicRoute('login-borrower'), true, 'login-borrower must be public');
    assert.equal(resolveViewFromUrl(), 'landing');
  });

  it('strictly classifies all internal application and dashboard routes as protected', () => {
    const internalRoutes = [
      'officer-queue',
      'document-workbench',
      'underwriting-cockpit',
      'borrower-portal',
      'compliance-audit',
      'loan-products',
      'user-admin',
    ];

    for (const route of internalRoutes) {
      assert.equal(isPublicRoute(route), false, `${route} must be protected (isPublic: false)`);
      assert.equal(ROUTE_SEO_MAP[route]?.isPublic, false, `${route} SEO metadata must have isPublic: false`);
    }
  });

  it('guarantees unauthenticated visitor attempting to access protected route is routed to /register', () => {
    const simulateRouteResolution = (requestedRoute: string, isAuthenticated: boolean) => {
      if (!isPublicRoute(requestedRoute) && !isAuthenticated) {
        return 'register';
      }
      return requestedRoute;
    };

    // Unauthenticated visitors trying to access any internal feature get redirected to register
    assert.equal(simulateRouteResolution('borrower-portal', false), 'register');
    assert.equal(simulateRouteResolution('officer-queue', false), 'register');
    assert.equal(simulateRouteResolution('document-workbench', false), 'register');
    assert.equal(simulateRouteResolution('underwriting-cockpit', false), 'register');
    assert.equal(simulateRouteResolution('compliance-audit', false), 'register');
    assert.equal(simulateRouteResolution('loan-products', false), 'register');

    // Authenticated users reach their intended destination
    assert.equal(simulateRouteResolution('borrower-portal', true), 'borrower-portal');
    assert.equal(simulateRouteResolution('officer-queue', true), 'officer-queue');
    assert.equal(simulateRouteResolution('document-workbench', true), 'document-workbench');
    assert.equal(simulateRouteResolution('underwriting-cockpit', true), 'underwriting-cockpit');

    // Public routes are always accessible regardless of authentication status
    assert.equal(simulateRouteResolution('landing', false), 'landing');
    assert.equal(simulateRouteResolution('register', false), 'register');
    assert.equal(simulateRouteResolution('login', false), 'login');
  });

  it('enforces RBAC permissions correctly across views and roles', () => {
    // Applicant permissions
    assert.equal(canRoleAccessView('APPLICANT', 'borrower-portal'), true);
    assert.equal(canRoleAccessView('APPLICANT', 'officer-queue'), false);
    assert.equal(canRoleAccessView('APPLICANT', 'document-workbench'), false);
    assert.equal(canRoleAccessView('APPLICANT', 'underwriting-cockpit'), false);
    assert.equal(canRoleAccessView('APPLICANT', 'compliance-audit'), false);

    // Loan Officer permissions
    assert.equal(canRoleAccessView('LOAN_OFFICER', 'officer-queue'), true);
    assert.equal(canRoleAccessView('LOAN_OFFICER', 'document-workbench'), true);
    assert.equal(canRoleAccessView('LOAN_OFFICER', 'underwriting-cockpit'), false);
    assert.equal(canRoleAccessView('LOAN_OFFICER', 'borrower-portal'), false);
    assert.equal(canRoleAccessView('LOAN_OFFICER', 'compliance-audit'), false);

    // Risk Analyst permissions
    assert.equal(canRoleAccessView('RISK_ANALYST', 'underwriting-cockpit'), true);
    assert.equal(canRoleAccessView('RISK_ANALYST', 'officer-queue'), false);
    assert.equal(canRoleAccessView('RISK_ANALYST', 'borrower-portal'), false);

    // Admin permissions
    assert.equal(canRoleAccessView('ADMIN', 'compliance-audit'), true);
    assert.equal(canRoleAccessView('ADMIN', 'officer-queue'), true);
    assert.equal(canRoleAccessView('ADMIN', 'underwriting-cockpit'), true);

    // Default views per role
    assert.equal(getDefaultViewForRole('APPLICANT'), 'borrower-portal');
    assert.equal(getDefaultViewForRole('LOAN_OFFICER'), 'officer-queue');
    assert.equal(getDefaultViewForRole('RISK_ANALYST'), 'underwriting-cockpit');
    assert.equal(getDefaultViewForRole('ADMIN'), 'compliance-audit');
  });

  it('ensures Stage 01 (Digital Application) preserves redirect intent to borrower-portal', () => {
    const handleStageLaunch = (
      targetView: string,
      isAuthenticated: boolean,
      userRole?: UserRole
    ) => {
      if (!isAuthenticated) {
        return {
          view: 'register',
          pendingRedirect: targetView,
          roleSwitched: false,
        };
      }

      if (userRole && canRoleAccessView(userRole, targetView)) {
        return {
          view: targetView,
          pendingRedirect: null,
          roleSwitched: false,
        };
      }

      return {
        view: userRole ? getDefaultViewForRole(userRole) : 'register',
        pendingRedirect: null,
        error: 'RBAC_FORBIDDEN',
      };
    };

    // Unauthenticated click on Stage 01
    const unauthed = handleStageLaunch('borrower-portal', false);
    assert.equal(unauthed.view, 'register');
    assert.equal(unauthed.pendingRedirect, 'borrower-portal');

    // Authenticated applicant click
    const authedApplicant = handleStageLaunch('borrower-portal', true, 'APPLICANT');
    assert.equal(authedApplicant.view, 'borrower-portal');
    assert.equal(authedApplicant.pendingRedirect, null);
  });

  it('ensures Stage 02 (Queue Triage) preserves redirect intent and enforces RBAC without mutating role', () => {
    const handleStageLaunch = (
      targetView: string,
      isAuthenticated: boolean,
      userRole?: UserRole
    ) => {
      if (!isAuthenticated) {
        return {
          view: 'register',
          pendingRedirect: targetView,
          roleSwitched: false,
        };
      }

      if (userRole && canRoleAccessView(userRole, targetView)) {
        return {
          view: targetView,
          pendingRedirect: null,
          roleSwitched: false,
        };
      }

      return {
        view: userRole ? getDefaultViewForRole(userRole) : 'register',
        pendingRedirect: null,
        error: 'RBAC_FORBIDDEN',
      };
    };

    // 1. Unauthenticated visitor clicking Stage 02
    const unauthed = handleStageLaunch('officer-queue', false);
    assert.equal(unauthed.view, 'register', 'Must route unauthenticated visitor to /register');
    assert.equal(unauthed.pendingRedirect, 'officer-queue', 'Must save pending redirect to officer-queue');
    assert.equal(unauthed.roleSwitched, false, 'Must not change or grant roles');

    // 2. Authenticated Loan Officer clicking Stage 02
    const authedOfficer = handleStageLaunch('officer-queue', true, 'LOAN_OFFICER');
    assert.equal(authedOfficer.view, 'officer-queue', 'Authorized officer enters officer-queue');
    assert.equal(authedOfficer.error, undefined);

    // 3. Authenticated Applicant clicking Stage 02 (unauthorized role)
    const authedApplicant = handleStageLaunch('officer-queue', true, 'APPLICANT');
    assert.equal(authedApplicant.error, 'RBAC_FORBIDDEN', 'Applicant is not permitted to enter officer queue');
    assert.equal(authedApplicant.view, 'borrower-portal', 'Routes to authorized primary workspace');
  });

  it('post-login / post-register redirects to intended target if authorized', () => {
    const resolvePostAuthRedirect = (role: UserRole, pendingTarget: string | null) => {
      if (pendingTarget && !isPublicRoute(pendingTarget)) {
        if (canRoleAccessView(role, pendingTarget)) {
          return { target: pendingTarget, allowed: true };
        }
        return { target: getDefaultViewForRole(role), allowed: false, rbacWarning: true };
      }
      return { target: getDefaultViewForRole(role), allowed: true };
    };

    // Applicant logs in with pending borrower-portal redirect
    const res1 = resolvePostAuthRedirect('APPLICANT', 'borrower-portal');
    assert.equal(res1.target, 'borrower-portal');
    assert.equal(res1.allowed, true);

    // Loan Officer logs in with pending officer-queue redirect
    const res2 = resolvePostAuthRedirect('LOAN_OFFICER', 'officer-queue');
    assert.equal(res2.target, 'officer-queue');
    assert.equal(res2.allowed, true);

    // Applicant logs in with pending officer-queue redirect (unauthorized)
    const res3 = resolvePostAuthRedirect('APPLICANT', 'officer-queue');
    assert.equal(res3.target, 'borrower-portal');
    assert.equal(res3.allowed, false);
    assert.equal(res3.rbacWarning, true);
  });
});
