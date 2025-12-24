// Mock authentication service for frontend testing
// Note: Test credentials have been removed. Use actual backend authentication.

// Simulate API delay
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

export const mockAuth = {
  // Mock user verification
  async getCurrentUser() {
    await delay(500);
    const isAuthenticated = localStorage.getItem('isAuthenticated') === 'true';
    if (isAuthenticated) {
      const userData = localStorage.getItem('user');
      return userData ? JSON.parse(userData) : null;
    }
    return null;
  }
};
