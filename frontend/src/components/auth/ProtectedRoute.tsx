import React, { useEffect } from 'react';
import { isPublicRoute } from '../../utils/seo';
import { canRoleAccessView, getDefaultViewForRole } from '../../utils/rbac';
import { useApp } from '../../context/AppContext';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

/**
 * ProtectedRoute Guard:
 * Ensures visitors cannot view or access internal dashboards, queues, or workbench interfaces
 * without an authenticated session. Unauthenticated access redirects immediately to /register.
 */
export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const { isAuthenticated, isSyncing, dataError, refreshFromBackend, setActiveView, currentRole, activeView } = useApp();

  useEffect(() => {
    if (isPublicRoute(activeView)) return;
    if (!isAuthenticated && !isSyncing && !dataError) {
      setActiveView('register');
    } else if (isAuthenticated && !canRoleAccessView(currentRole, activeView)) {
      setActiveView(getDefaultViewForRole(currentRole));
    }
  }, [isAuthenticated, isSyncing, dataError, setActiveView, currentRole, activeView]);

  if (!isAuthenticated && isSyncing) return <p role="status">Verifying your session…</p>;
  if (!isAuthenticated && dataError) return <div role="alert"><p>{dataError}</p><button onClick={() => void refreshFromBackend()}>Retry</button></div>;
  if (!isAuthenticated) {
    // Prevent rendering protected application data or views before authentication
    return null;
  }

  if (!canRoleAccessView(currentRole, activeView)) return null;
  return <>{children}</>;
};

export default ProtectedRoute;
