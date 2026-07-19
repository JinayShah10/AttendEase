import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../AuthContext';

const ProtectedRoute = ({ children, requiredRole }) => {
  const { user } = useAuth();
  const location = useLocation();

  if (!user) {
    // Redirect to login if no user is authenticated
    return <Navigate to="/" state={{ from: location }} replace />;
  }

  if (requiredRole && user.role !== requiredRole) {
    // Redirect to home if user doesn't have the required role
    // This handles case where a faculty tries to access /admin
    return <Navigate to="/" replace />;
  }

  return children;
};

export default ProtectedRoute;
