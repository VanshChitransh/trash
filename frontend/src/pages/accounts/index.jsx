import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '../../components/ui/Header';
import Breadcrumb from '../../components/ui/Breadcrumb';
import Toast from '../../components/ui/Toast';
import Icon from '../../components/AppIcon';
import { api } from '../../utils/api';
import { logout } from '../../utils/logout';
import ProfileSection from './components/ProfileSection';
import SecuritySection from './components/SecuritySection';
import AccountDetailsSection from './components/AccountDetailsSection';
import ConnectedAccountsSection from './components/ConnectedAccountsSection';

const Accounts = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);
  const [activeTab, setActiveTab] = useState('profile');

  useEffect(() => {
    const fetchUser = async () => {
      try {
        setLoading(true);
        const result = await api.get('/api/auth/me');
        if (result && result.user) {
          setUser(result.user);
          localStorage.setItem('user', JSON.stringify(result.user));
        }
      } catch (error) {
        console.error('Error fetching user:', error);
        setToast({
          message: 'Failed to load account information',
          type: 'error'
        });
      } finally {
        setLoading(false);
      }
    };

    fetchUser();
  }, []);

  const handleLogout = async () => {
    await logout();
    navigate('/authentication-hub');
  };

  const handleUserUpdate = (updatedUser) => {
    setUser(updatedUser);
    localStorage.setItem('user', JSON.stringify(updatedUser));
    setToast({
      message: 'Profile updated successfully',
      type: 'success'
    });
  };

  const tabs = [
    { id: 'profile', label: 'Profile', icon: 'User' },
    { id: 'security', label: 'Security', icon: 'Lock' },
    { id: 'account', label: 'Account', icon: 'Settings' },
    { id: 'connected', label: 'Connected Accounts', icon: 'Link2' },
  ];

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Header onLogout={handleLogout} />
        <main className="pt-16">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header onLogout={handleLogout} />
      <main className="pt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <Breadcrumb />
          
          <div className="mt-8">
            <h1 className="text-3xl font-bold text-foreground mb-2">Account Settings</h1>
            <p className="text-muted-foreground mb-8">
              Manage your account information, security settings, and preferences
            </p>

            <div className="flex flex-col lg:flex-row gap-8">
              {/* Sidebar Navigation */}
              <div className="lg:w-64 flex-shrink-0">
                <nav className="bg-card rounded-lg border border-border p-2 space-y-1">
                  {tabs.map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={`w-full flex items-center space-x-3 px-4 py-3 rounded-md text-sm font-medium transition-smooth ${
                        activeTab === tab.id
                          ? 'bg-primary text-primary-foreground'
                          : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                      }`}
                    >
                      <Icon name={tab.icon} size={18} />
                      <span>{tab.label}</span>
                    </button>
                  ))}
                </nav>
              </div>

              {/* Main Content */}
              <div className="flex-1">
                <div className="bg-card rounded-lg border border-border p-6">
                  {activeTab === 'profile' && (
                    <ProfileSection 
                      user={user} 
                      onUserUpdate={handleUserUpdate}
                      onError={(message) => setToast({ message, type: 'error' })}
                    />
                  )}
                  
                  {activeTab === 'security' && (
                    <SecuritySection 
                      user={user}
                      onSuccess={(message) => setToast({ message, type: 'success' })}
                      onError={(message) => setToast({ message, type: 'error' })}
                    />
                  )}
                  
                  {activeTab === 'account' && (
                    <AccountDetailsSection user={user} />
                  )}
                  
                  {activeTab === 'connected' && (
                    <ConnectedAccountsSection 
                      user={user}
                      onUpdate={() => {
                        // Refresh user data
                        api.get('/api/auth/me').then(result => {
                          if (result && result.user) {
                            setUser(result.user);
                            localStorage.setItem('user', JSON.stringify(result.user));
                          }
                        });
                      }}
                    />
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  );
};

export default Accounts;

