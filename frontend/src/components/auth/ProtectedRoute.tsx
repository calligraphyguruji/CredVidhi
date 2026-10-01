import React, { useEffect } from 'react';
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
  const { isAuthenticated, setActiveView } = useApp();

  useEffect(() => {
    if (!isAuthenticated) {
      setActiveView('register');
    }
  }, [isAuthenticated, setActiveView]);

  if (!isAuthenticated) {
    // Prevent rendering protected application data or views before authentication
    return null;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
