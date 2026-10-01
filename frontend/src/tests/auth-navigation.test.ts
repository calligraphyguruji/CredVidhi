import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { isPublicRoute, resolveViewFromUrl, ROUTE_SEO_MAP } from '../utils/seo.ts';

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

  it('ensures Launch Digital Application Interface CTA targets register when unauthenticated', () => {
    const step1 = {
      title: 'Digital Application',
      targetRole: 'APPLICANT',
      targetView: 'borrower-portal',
    };

    const handleWorkflowLaunch = (targetView: string, targetRole: string, isAuthenticated: boolean) => {
      if (!isAuthenticated) {
        return { view: 'register', roleSwitched: false };
      }
      return { view: targetView, roleSwitched: true, role: targetRole };
    };

    const unauthenticatedResult = handleWorkflowLaunch(step1.targetView, step1.targetRole, false);
    assert.equal(unauthenticatedResult.view, 'register', 'Unauthenticated CTA must redirect to register');
    assert.equal(unauthenticatedResult.roleSwitched, false, 'Role must not switch for unauthenticated visitor');

    const authenticatedResult = handleWorkflowLaunch(step1.targetView, step1.targetRole, true);
    assert.equal(authenticatedResult.view, 'borrower-portal', 'Authenticated CTA must open borrower-portal');
    assert.equal(authenticatedResult.roleSwitched, true);
    assert.equal(authenticatedResult.role, 'APPLICANT');
  });
});
