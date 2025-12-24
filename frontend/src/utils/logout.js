import { api } from './api';

/**
 * Centralized logout function that:
 * 1. Calls the backend logout API
 * 2. Clears all localStorage data
 * 3. Clears all sessionStorage data
 * 4. Redirects to authentication hub
 * 
 * @param {Function} navigate - React Router navigate function
 */
export const logout = async (navigate) => {
  try {
    // Call backend logout API to clear server-side session
    await api.post('/api/auth/logout', {}, { ignoreStatuses: [401, 500] });
  } catch (error) {
    // Continue with logout even if API call fails
    console.warn('Logout API call failed, continuing with local cleanup:', error);
  }

  // Clear all localStorage data
  try {
    localStorage.clear();
  } catch (error) {
    console.error('Error clearing localStorage:', error);
  }

  // Clear all sessionStorage data
  try {
    sessionStorage.clear();
  } catch (error) {
    console.error('Error clearing sessionStorage:', error);
  }

  // Redirect to authentication hub (sign in/sign up page)
  if (navigate) {
    navigate('/authentication-hub', { 
      replace: true,
      state: { mode: 'login' } // Set default to login tab
    });
  } else {
    // Fallback if navigate is not provided
    window.location.href = '/authentication-hub';
  }
};

