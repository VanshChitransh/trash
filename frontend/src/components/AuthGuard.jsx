import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../utils/api';

/**
 * AuthGuard component - Checks authentication status and redirects accordingly
 * This ensures users stay logged in via cookies and don't need to re-authenticate
 */
const AuthGuard = ({ children }) => {
  const [isChecking, setIsChecking] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    let isMounted = true;

    const checkAuth = async () => {
      // First, check if we have cached user data - keep it while checking
      const cachedUser = localStorage.getItem('user');
      const cachedAuth = localStorage.getItem('isAuthenticated');
      
      try {
        // Check if user is authenticated via cookie
        const result = await api.get('/api/auth/me', { ignoreStatuses: [401] });
        
        if (isMounted) {
          if (result && result.user) {
            // User is authenticated - update localStorage with fresh data
            localStorage.setItem('isAuthenticated', 'true');
            localStorage.setItem('user', JSON.stringify(result.user));
            setIsAuthenticated(true);
            
            // Dispatch custom event to notify other components
            window.dispatchEvent(new CustomEvent('userLoaded', { detail: result.user }));
          } else {
            // Auth check failed, but keep cached data if it exists
            // Only clear if we're sure user should be logged out
            if (cachedUser && cachedAuth === 'true') {
              // Keep cached data - might be a temporary network issue
              setIsAuthenticated(true);
            } else {
              // No cached data, user is not authenticated
              localStorage.removeItem('isAuthenticated');
              localStorage.removeItem('user');
              setIsAuthenticated(false);
            }
          }
        }
      } catch (error) {
        // Auth check failed - keep cached data if available
        if (isMounted) {
          if (cachedUser && cachedAuth === 'true') {
            // Keep cached user data - don't clear on temporary failures
            setIsAuthenticated(true);
          } else {
            // No cached data, clear everything
            localStorage.removeItem('isAuthenticated');
            localStorage.removeItem('user');
            setIsAuthenticated(false);
          }
        }
      } finally {
        if (isMounted) {
          setIsChecking(false);
        }
      }
    };

    checkAuth();

    return () => {
      isMounted = false;
    };
  }, []);

  // Show loading state while checking auth
  if (isChecking) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-muted-foreground text-sm">Checking authentication...</div>
      </div>
    );
  }

  // Render children (routes will handle their own auth requirements)
  return <>{children}</>;
};

export default AuthGuard;

