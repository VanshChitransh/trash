import React, { useState, useEffect } from 'react';
import Icon from '../../../components/AppIcon';
import Button from '../../../components/ui/Button';
import { api } from '../../../utils/api';

const ConnectedAccountsSection = ({ user, onUpdate }) => {
  const [connectedAccounts, setConnectedAccounts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchConnectedAccounts = async () => {
      try {
        // Fetch connected accounts from backend
        // For now, we'll show based on authProvider
        const accounts = [];
        
        if (user?.authProvider === 'GOOGLE') {
          accounts.push({
            provider: 'google',
            name: 'Google',
            email: user.email,
            connected: true,
            icon: 'Chrome',
          });
        } else {
          accounts.push({
            provider: 'email',
            name: 'Email',
            email: user.email,
            connected: true,
            icon: 'Mail',
          });
        }

        setConnectedAccounts(accounts);
      } catch (error) {
        console.error('Error fetching connected accounts:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchConnectedAccounts();
  }, [user]);

  const handleDisconnect = async (provider) => {
    if (window.confirm(`Are you sure you want to disconnect your ${provider} account?`)) {
      try {
        // This would call a backend endpoint to disconnect
        // For now, we'll just show a message
        alert('Account disconnection is not yet implemented. Please contact support if needed.');
      } catch (error) {
        console.error('Error disconnecting account:', error);
      }
    }
  };

  const getProviderIcon = (provider) => {
    switch (provider) {
      case 'google':
        return 'Chrome';
      case 'email':
        return 'Mail';
      default:
        return 'Link2';
    }
  };

  const getProviderColor = (provider) => {
    switch (provider) {
      case 'google':
        return 'text-blue-600';
      case 'email':
        return 'text-muted-foreground';
      default:
        return 'text-foreground';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-foreground">Connected Accounts</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Manage accounts connected to your Consultabid profile
        </p>
      </div>

      <div className="space-y-4">
        {connectedAccounts.map((account) => (
          <div
            key={account.provider}
            className="bg-card rounded-lg border border-border p-6"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <div className={`w-12 h-12 rounded-full bg-muted flex items-center justify-center ${getProviderColor(account.provider)}`}>
                  <Icon name={account.icon} size={24} />
                </div>
                <div>
                  <h3 className="font-medium text-foreground">{account.name}</h3>
                  <p className="text-sm text-muted-foreground">{account.email}</p>
                </div>
              </div>
              <div className="flex items-center space-x-3">
                {account.connected && (
                  <span className="flex items-center space-x-2 text-sm text-success">
                    <Icon name="CheckCircle" size={16} />
                    <span>Connected</span>
                  </span>
                )}
                {account.provider !== 'email' && account.connected && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDisconnect(account.provider)}
                    iconName="X"
                    iconPosition="left"
                  >
                    Disconnect
                  </Button>
                )}
              </div>
            </div>
          </div>
        ))}

        {/* Add Account Section */}
        {user?.authProvider !== 'GOOGLE' && (
          <div className="bg-muted/50 rounded-lg border border-border p-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-medium text-foreground mb-1">Connect Google Account</h3>
                <p className="text-sm text-muted-foreground">
                  Link your Google account for easier sign-in
                </p>
              </div>
              <Button
                variant="outline"
                onClick={() => {
                  // This would trigger Google OAuth flow
                  alert('Google account connection is not yet implemented.');
                }}
                iconName="Chrome"
                iconPosition="left"
              >
                Connect
              </Button>
            </div>
          </div>
        )}
      </div>

      <div className="bg-muted/50 rounded-lg border border-border p-4">
        <div className="flex items-start space-x-3">
          <Icon name="Info" size={20} className="text-primary flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-foreground mb-1">About Connected Accounts</p>
            <p className="text-xs text-muted-foreground">
              Connecting multiple accounts allows you to sign in using any of your connected methods.
              Your data and preferences are shared across all connected accounts.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ConnectedAccountsSection;

