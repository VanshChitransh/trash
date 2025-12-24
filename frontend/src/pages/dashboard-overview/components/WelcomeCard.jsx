import React, { useState, useEffect } from 'react';
import Icon from '../../../components/AppIcon';
import Button from '../../../components/ui/Button';

const WelcomeCard = ({ userName, lastLoginAt, onGetStarted, onWatchDemo }) => {
  const [lastLoginText, setLastLoginText] = useState('');

  // Format last login time and update in real-time
  useEffect(() => {
    const formatLastLogin = () => {
      if (!lastLoginAt) {
        setLastLoginText('Never');
        return;
      }

      const lastLogin = new Date(lastLoginAt);
      const now = new Date();
      const diffMs = now - lastLogin;
      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMs / 3600000);
      const diffDays = Math.floor(diffMs / 86400000);

      if (diffMins < 1) {
        setLastLoginText('Just now');
      } else if (diffMins < 60) {
        setLastLoginText(`${diffMins} minute${diffMins !== 1 ? 's' : ''} ago`);
      } else if (diffHours < 24) {
        if (diffHours === 1 && diffMins < 60) {
          setLastLoginText('1 hour ago');
        } else {
          setLastLoginText(`${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`);
        }
      } else if (diffDays === 1) {
        setLastLoginText('Yesterday');
      } else if (diffDays < 7) {
        setLastLoginText(`${diffDays} days ago`);
      } else {
        // Format as date for older logins
        const isToday = lastLogin.toDateString() === now.toDateString();
        if (isToday) {
          setLastLoginText(`Today at ${lastLogin.toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
            hour12: true
          })}`);
        } else {
          setLastLoginText(lastLogin.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: lastLogin.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
            hour: 'numeric',
            minute: '2-digit',
            hour12: true
          }));
        }
      }
    };

    formatLastLogin();

    // Update every minute for real-time display
    const interval = setInterval(formatLastLogin, 60000);

    return () => clearInterval(interval);
  }, [lastLoginAt]);
  return (
    <div className="bg-gradient-to-r from-primary to-secondary text-white rounded-lg shadow-moderate overflow-hidden">
      <div className="p-6 lg:p-8">
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <h1 className="text-2xl lg:text-3xl font-bold mb-2">
              Welcome back, {userName}!
            </h1>
            <p className="text-primary-foreground/80 mb-6 max-w-md">
              Transform your inspection reports into actionable estimates. Upload a report to get started with detailed cost analysis.
            </p>
            
            <div className="flex flex-col sm:flex-row gap-3">
              <Button 
                variant="secondary" 
                onClick={onGetStarted}
                iconName="Upload"
                iconPosition="left"
              >
                Upload First Report
              </Button>
              <Button 
                variant="outline" 
                onClick={onWatchDemo}
                iconName="Play"
                iconPosition="left"
                className="border-white/20 text-white hover:bg-white/10 opacity-50 cursor-not-allowed"
                disabled
              >
                Watch Demo
              </Button>
            </div>
          </div>
          
          <div className="hidden lg:block flex-shrink-0 ml-8">
            <div className="w-36 h-36 bg-white/80 backdrop-blur rounded-full flex items-center justify-center shadow-lg ring-4 ring-white/50">
              <img src="/logo.png" alt="Consultabid Logo" className="w-20 h-20 object-contain drop-shadow" />
            </div>
          </div>
        </div>
      </div>
      
      <div className="bg-black/10 px-6 lg:px-8 py-4">
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <Icon name="Shield" size={16} />
              <span>Secure & Private</span>
            </div>
            <div className="flex items-center space-x-2">
              <Icon name="Zap" size={16} />
              <span>Fast & Accurate</span>
            </div>
          </div>
          <div className="text-primary-foreground/60">
            Last login: {lastLoginText || 'Never'}
          </div>
        </div>
      </div>
    </div>
  );
};

export default WelcomeCard;
