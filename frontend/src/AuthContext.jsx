/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { jwtDecode } from 'jwt-decode';
import { loginUser, logoutUser, setAccessToken, attemptTokenRefresh } from './utils/api';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Initialize auth state: check token validity, fallback to silent refresh if needed
  useEffect(() => {
    const initializeAuth = async () => {
      const token = localStorage.getItem('djsce-token');
      const savedUser = localStorage.getItem('djsce-auth-session');

      if (token) {
        try {
          const { exp } = jwtDecode(token);
          if (Date.now() < exp * 1000) {
            if (savedUser) {
              setUser(JSON.parse(savedUser));
            }
            setLoading(false);
            return;
          }
        } catch {
          // Token is invalid/malformed, proceed to refresh
        }
      }

      // Try silent refresh
      try {
        const refreshedToken = await attemptTokenRefresh();
        if (refreshedToken) {
          const updatedUser = localStorage.getItem('djsce-auth-session');
          if (updatedUser) {
            setUser(JSON.parse(updatedUser));
          } else {
            const decoded = jwtDecode(refreshedToken);
            setUser({ id: decoded.id, role: decoded.role });
          }
        } else {
          setUser(null);
          setAccessToken(null);
          localStorage.removeItem('djsce-auth-session');
          localStorage.removeItem('djsce-token');
        }
      } catch {
        setUser(null);
        setAccessToken(null);
        localStorage.removeItem('djsce-auth-session');
        localStorage.removeItem('djsce-token');
      } finally {
        setLoading(false);
      }
    };

    initializeAuth();
  }, []);

  const logout = useCallback(async () => {
    try {
      // Tell the backend to invalidate the refresh token
      await logoutUser();
    } catch {
      // Even if the API call fails, clear the local state
    }
    setUser(null);
    setAccessToken(null);
    localStorage.removeItem('djsce-auth-session');
    localStorage.removeItem('djsce-token');
  }, []);

  // Periodic check for token expiration
  useEffect(() => {
    if (loading) return;

    const checkToken = async () => {
      const token = localStorage.getItem('djsce-token');
      if (token) {
        try {
          const { exp } = jwtDecode(token);
          if (Date.now() >= exp * 1000) {
            const refreshedToken = await attemptTokenRefresh();
            if (refreshedToken) {
              const updatedUser = localStorage.getItem('djsce-auth-session');
              if (updatedUser) {
                setUser(JSON.parse(updatedUser));
              }
            } else {
              window.dispatchEvent(new Event('auth:session-expired'));
            }
          }
        } catch {
          window.dispatchEvent(new Event('auth:session-expired'));
        }
      }
    };

    checkToken();
    // Check every minute
    const interval = setInterval(checkToken, 60000);
    return () => clearInterval(interval);
  }, [loading]);

  const login = async (email, password, role) => {
    try {
      const data = await loginUser(email, password);

      // Ensure the role matches what they selected on the frontend tab
      if (data.user.role !== role) {
        return { success: false, message: 'Invalid username or password for this role.' };
      }

      setUser(data.user);
      localStorage.setItem('djsce-auth-session', JSON.stringify(data.user));

      // Store the short-lived access token in memory (and localStorage for reload)
      if (data.token) {
        setAccessToken(data.token);
      }

      return { success: true };
    } catch (error) {
      return { success: false, message: error.message || 'incorrect username' };
    }
  };

  const updateUser = (newUserData) => {
    setUser(newUserData);
    localStorage.setItem('djsce-auth-session', JSON.stringify(newUserData));
  };

  // Listen for session-expired events from api.js (fired when refresh fails)
  useEffect(() => {
    const handleSessionExpired = () => {
      setUser(null);
      setAccessToken(null);
      localStorage.removeItem('djsce-auth-session');
      localStorage.removeItem('djsce-token');
    };

    window.addEventListener('auth:session-expired', handleSessionExpired);
    return () => {
      window.removeEventListener('auth:session-expired', handleSessionExpired);
    };
  }, []);

  return (
    <AuthContext.Provider value={{ user, login, logout, loading, updateUser }}>
      {!loading && children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
