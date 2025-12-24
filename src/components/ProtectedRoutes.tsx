import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import type { ReactElement } from 'react';

export function ProtectedRoute({ children }: { children: ReactElement }) {
  const auth = useAuth();
  const location = useLocation();

  if (!auth.isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return children;
}