import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import Icon from '../AppIcon';
import Button from './Button';
import { logout } from '../../utils/logout';
import NotificationDropdown from './NotificationDropdown';
import { useNotifications } from '../../contexts/NotificationContext';

const Header = ({ user = null, onLogout = () => {} }) => {
  const { unreadCount } = useNotifications();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  // Read user from localStorage when no user prop provided
  // Initialize from localStorage immediately so it's available on first render
  const [storedUser, setStoredUser] = useState(() => {
    try {
      const raw = localStorage.getItem('user');
      if (raw) {
        return JSON.parse(raw);
      }
    } catch (_) {}
    return null;
  });
  
  // Load user from localStorage on mount and when it changes
  useEffect(() => {
    const loadUser = () => {
      try {
        const raw = localStorage.getItem('user');
        if (raw) {
          const userData = JSON.parse(raw);
          setStoredUser(userData);
        } else {
          setStoredUser(null);
        }
      } catch (_) {
        setStoredUser(null);
      }
    };

    // Load immediately (in case it was updated)
    loadUser();

    // Listen for storage events (cross-tab updates)
    const handleStorage = (e) => {
      if (e.key === 'user') {
        loadUser();
      }
    };
    
    // Listen for custom userLoaded event from AuthGuard
    const handleUserLoaded = () => {
      loadUser();
    };
    
    window.addEventListener('storage', handleStorage);
    window.addEventListener('userLoaded', handleUserLoaded);

    // Also check localStorage periodically in case it was updated by AuthGuard
    // This handles the case where AuthGuard updates localStorage after Header mounts
    const intervalId = setInterval(() => {
      loadUser();
    }, 100); // Check every 100ms for first 2 seconds after mount

    setTimeout(() => {
      clearInterval(intervalId);
    }, 2000);

    return () => {
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener('userLoaded', handleUserLoaded);
      clearInterval(intervalId);
    };
  }, []);

  const effectiveUser = user || storedUser;
  
  // Debug log in development
  if (process.env.NODE_ENV === 'development' && effectiveUser) {
    console.log('Header - User data:', effectiveUser);
  }
  
  // Show actual user data - initialized from localStorage so available immediately
  // Try multiple possible field names for name
  const userName = effectiveUser?.name || effectiveUser?.displayName || effectiveUser?.userName || '';
  const userEmail = effectiveUser?.email || '';
  const userAvatar = effectiveUser?.avatar || effectiveUser?.photoURL || null;
  
  // Get first letter of name for avatar fallback
  const getInitials = (name) => {
    if (!name) return 'U';
    const parts = name.trim().split(' ');
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return name[0].toUpperCase();
  };
  
  const userInitials = getInitials(userName);

  const navigationItems = [
    { label: 'Dashboard', path: '/dashboard-overview', icon: 'LayoutDashboard' },
    { label: 'Files', path: '/file-upload-management', icon: 'FileText' },
    { label: 'Estimates', path: '/estimate-generation-results', icon: 'Calculator' },
    { label: 'Account', path: '/account', icon: 'User' }
  ];

  const isActivePath = (path) => {
    return location?.pathname === path || location?.pathname?.startsWith(path);
  };

  const handleNavigation = (path) => {
    navigate(path);
    setIsMenuOpen(false);
  };

  const handleProfileToggle = () => {
    setIsProfileOpen(!isProfileOpen);
  };

  const handleLogout = async () => {
    setIsProfileOpen(false);
    // Call the centralized logout function
    await logout(navigate);
    // Also call the onLogout prop if provided (for any additional cleanup)
    onLogout();
  };

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (!event?.target?.closest('.profile-dropdown') && !event?.target?.closest('.profile-button')) {
        setIsProfileOpen(false);
      }
      if (!event?.target?.closest('.mobile-menu') && !event?.target?.closest('.menu-button')) {
        setIsMenuOpen(false);
      }
    };

    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  return (
    <header className="fixed top-0 left-0 right-0 z-100 bg-card border-b border-border">
      <div className="flex items-center justify-between h-16 px-4 lg:px-6">
        {/* Logo */}
      <div className="flex items-center space-x-3">
        <div className="w-24 h-24">
          <img src="/logo.png" alt="Consultabid Logo" className="w-24 h-24 object-contain" />
        </div>
      </div>

        {/* Desktop Navigation */}
        <nav className="hidden lg:flex items-center space-x-1">
          {navigationItems?.map((item) => (
            <button
              key={item?.path}
              onClick={() => handleNavigation(item?.path)}
              className={`flex items-center space-x-2 px-3 py-2 rounded-md text-sm font-medium transition-smooth ${
                isActivePath(item?.path)
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted'
              }`}
            >
              <Icon name={item?.icon} size={16} />
              <span>{item?.label}</span>
            </button>
          ))}
        </nav>

        {/* Desktop Actions */}
        <div className="hidden lg:flex items-center space-x-4">
          {/* Notifications */}
          <NotificationDropdown />

          {/* Profile Dropdown */}
          <div className="relative">
            <button
              onClick={handleProfileToggle}
              className="profile-button flex items-center space-x-2 p-2 rounded-md hover:bg-muted transition-smooth"
            >
              {userAvatar ? (
                <img src={userAvatar} alt={userName} className="w-8 h-8 rounded-full object-cover" />
              ) : (
                <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center text-white text-sm font-semibold">
                  {userInitials}
                </div>
              )}
              <span className="text-sm font-medium text-foreground hidden md:block">{userName || 'User'}</span>
              <Icon name="ChevronDown" size={16} className="text-muted-foreground" />
            </button>

            {isProfileOpen && (
              <div className="profile-dropdown absolute right-0 mt-2 w-56 bg-popover border border-border rounded-lg shadow-moderate animate-slide-down">
                <div className="p-3 border-b border-border">
                  <div className="flex items-center space-x-3">
                    {userAvatar ? (
                      <img src={userAvatar} alt={userName} className="w-10 h-10 rounded-full object-cover" />
                    ) : (
                      <div className="w-10 h-10 bg-primary rounded-full flex items-center justify-center text-white text-sm font-semibold">
                        {userInitials}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{userName || 'User'}</p>
                      <p className="text-xs text-muted-foreground truncate">{userEmail || ''}</p>
                    </div>
                  </div>
                </div>
                <div className="py-1">
                  <button
                    onClick={() => handleNavigation('/account')}
                    className="flex items-center space-x-2 w-full px-3 py-2 text-sm text-foreground hover:bg-muted transition-smooth"
                  >
                    <Icon name="Settings" size={16} />
                    <span>Settings</span>
                  </button>
                  <button
                    onClick={() => handleNavigation('/help')}
                    className="flex items-center space-x-2 w-full px-3 py-2 text-sm text-foreground hover:bg-muted transition-smooth opacity-50 cursor-not-allowed"
                    disabled
                  >
                    <Icon name="HelpCircle" size={16} />
                    <span>Help</span>
                  </button>
                  <hr className="my-1 border-border" />
                  <button
                    onClick={handleLogout}
                    className="flex items-center space-x-2 w-full px-3 py-2 text-sm text-destructive hover:bg-muted transition-smooth"
                  >
                    <Icon name="LogOut" size={16} />
                    <span>Sign out</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Mobile Menu Button */}
        <button
          onClick={() => setIsMenuOpen(!isMenuOpen)}
          className="menu-button lg:hidden p-2 text-muted-foreground hover:text-foreground transition-smooth"
        >
          <Icon name={isMenuOpen ? "X" : "Menu"} size={24} />
        </button>
      </div>
      {/* Mobile Menu */}
      {isMenuOpen && (
        <div className="mobile-menu lg:hidden bg-card border-t border-border animate-slide-down">
          <nav className="px-4 py-4 space-y-2">
            {navigationItems?.map((item) => (
              <button
                key={item?.path}
                onClick={() => handleNavigation(item?.path)}
                className={`flex items-center space-x-3 w-full px-3 py-3 rounded-md text-sm font-medium transition-smooth ${
                  isActivePath(item?.path)
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                }`}
              >
                <Icon name={item?.icon} size={20} />
                <span>{item?.label}</span>
              </button>
            ))}
          </nav>

          {/* Mobile Profile Section */}
          <div className="px-4 py-4 border-t border-border">
            <div className="flex items-center space-x-3 mb-4">
              {userAvatar ? (
                <img src={userAvatar} alt={userName} className="w-10 h-10 rounded-full object-cover" />
              ) : (
                <div className="w-10 h-10 bg-primary rounded-full flex items-center justify-center text-white text-sm font-semibold">
                  {userInitials}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">
                  {userName || 'User'}
                </p>
                <p className="text-xs text-muted-foreground truncate">
                  {userEmail || ''}
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <button
                onClick={() => handleNavigation('/account')}
                className="flex items-center space-x-3 w-full px-3 py-2 text-sm text-foreground hover:bg-muted rounded-md transition-smooth"
              >
                <Icon name="settings" size={16} />
                <span>settings</span>
              </button>
              <button
                onClick={() => handleNavigation('/help')}
                className="flex items-center space-x-3 w-full px-3 py-2 text-sm text-foreground hover:bg-muted rounded-md transition-smooth opacity-50 cursor-not-allowed"
                disabled
              >
                <Icon name="HelpCircle" size={16} />
                <span>Help</span>
              </button>
              <button
                onClick={handleLogout}
                className="flex items-center space-x-3 w-full px-3 py-2 text-sm text-destructive hover:bg-muted rounded-md transition-smooth"
              >
                <Icon name="LogOut" size={16} />
                <span>Sign out</span>
              </button>
            </div>

            {/* Notifications in Mobile */}
            <div className="mt-4 pt-4 border-t border-border">
              <div className="flex items-center justify-between w-full px-3 py-2 text-sm text-foreground">
                <div className="flex items-center space-x-3">
                  <Icon name="Bell" size={16} />
                  <span>Notifications</span>
                </div>
                {unreadCount > 0 && (
                  <span className="bg-error text-error-foreground text-xs rounded-full h-5 w-5 flex items-center justify-center">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </header>
  );
};

export default Header;
