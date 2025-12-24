import React from 'react';
import Icon from '../../../components/AppIcon';

const AccountDetailsSection = ({ user }) => {
  const getSubscriptionBadge = (status) => {
    const badges = {
      FREE: { label: 'Free', color: 'bg-muted text-muted-foreground' },
      PAID: { label: 'Paid', color: 'bg-success/10 text-success' },
      TRIAL: { label: 'Trial', color: 'bg-primary/10 text-primary' },
      EXPIRED: { label: 'Expired', color: 'bg-warning/10 text-warning' },
      CANCELLED: { label: 'Cancelled', color: 'bg-destructive/10 text-destructive' },
    };
    return badges[status] || badges.FREE;
  };

  const subscriptionBadge = getSubscriptionBadge(user?.subscriptionStatus);

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-foreground">Account Details</h2>
        <p className="text-sm text-muted-foreground mt-1">
          View your account information and subscription status
        </p>
      </div>

      <div className="space-y-6">
        {/* Subscription Status */}
        <div className="bg-card rounded-lg border border-border p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-medium text-foreground">Subscription Status</h3>
            <span className={`px-3 py-1 rounded-full text-xs font-medium ${subscriptionBadge.color}`}>
              {subscriptionBadge.label}
            </span>
          </div>
          
          {user?.subscriptionStatus === 'PAID' || user?.subscriptionStatus === 'TRIAL' ? (
            <div className="space-y-3">
              {user?.subscriptionStartDate && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Started</span>
                  <span className="text-foreground font-medium">
                    {formatDate(user.subscriptionStartDate)}
                  </span>
                </div>
              )}
              {user?.subscriptionEndDate && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">
                    {user.subscriptionStatus === 'TRIAL' ? 'Trial Ends' : 'Renews'}
                  </span>
                  <span className="text-foreground font-medium">
                    {formatDate(user.subscriptionEndDate)}
                  </span>
                </div>
              )}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              You're currently on the free plan. Upgrade to unlock premium features.
            </p>
          )}
        </div>

        {/* Account Information */}
        <div className="bg-card rounded-lg border border-border p-6">
          <h3 className="font-medium text-foreground mb-4">Account Information</h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between py-3 border-b border-border">
              <div className="flex items-center space-x-3">
                <Icon name="User" size={20} className="text-muted-foreground" />
                <span className="text-sm text-muted-foreground">User ID</span>
              </div>
              <span className="text-sm font-mono text-foreground">
                {user?.id?.substring(0, 8)}...
              </span>
            </div>

            <div className="flex items-center justify-between py-3 border-b border-border">
              <div className="flex items-center space-x-3">
                <Icon name="Mail" size={20} className="text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Email</span>
              </div>
              <span className="text-sm text-foreground">{user?.email}</span>
            </div>

            <div className="flex items-center justify-between py-3 border-b border-border">
              <div className="flex items-center space-x-3">
                <Icon name="Calendar" size={20} className="text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Member Since</span>
              </div>
              <span className="text-sm text-foreground">
                {formatDate(user?.createdAt)}
              </span>
            </div>

            {user?.lastLoginAt && (
              <div className="flex items-center justify-between py-3">
                <div className="flex items-center space-x-3">
                  <Icon name="Clock" size={20} className="text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">Last Login</span>
                </div>
                <span className="text-sm text-foreground">
                  {formatDate(user.lastLoginAt)}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Authentication Provider */}
        <div className="bg-card rounded-lg border border-border p-6">
          <h3 className="font-medium text-foreground mb-4">Authentication</h3>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Icon 
                name={user?.authProvider === 'GOOGLE' ? 'Chrome' : 'Mail'} 
                size={20} 
                className="text-muted-foreground" 
              />
              <div>
                <p className="text-sm font-medium text-foreground">
                  {user?.authProvider === 'GOOGLE' ? 'Google Account' : 'Email Account'}
                </p>
                <p className="text-xs text-muted-foreground">
                  {user?.emailVerified 
                    ? 'Email verified' 
                    : user?.authProvider === 'GOOGLE' 
                      ? 'Verified via Google' 
                      : 'Email not verified'}
                </p>
              </div>
            </div>
            {user?.emailVerified && (
              <Icon name="CheckCircle" size={20} className="text-success" />
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AccountDetailsSection;




