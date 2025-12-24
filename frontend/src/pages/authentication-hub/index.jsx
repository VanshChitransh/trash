import React, { useState, useEffect } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import Icon from '../../components/AppIcon';
import LoginForm from './components/LoginForm';
import RegisterForm from './components/RegisterForm';
import ForgotPasswordModal from './components/ForgotPasswordModal';
import TrustSignals from './components/TrustSignals';
import PrivacyCard from './components/PrivacyCard';
import DashboardOverview from '../dashboard-overview';
import { api } from '../../utils/api';

const AuthenticationHub = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [activeTab, setActiveTab] = useState('login');
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [isChecking, setIsChecking] = useState(true);
  const [showPrivacyCard, setShowPrivacyCard] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // Set active tab based on navigation state
  useEffect(() => {
    if (location.state?.mode === 'login') {
      setActiveTab('login');
    } else if (location.state?.mode === 'signup') {
      setActiveTab('register');
    }
  }, [location.state]);

  // Check if user is already authenticated (backend session)
  useEffect(() => {
    let isMounted = true;
    (async () => {
      try {
        const result = await api.get('/api/auth/me', { ignoreStatuses: [401] });
        if (isMounted && result && result.user) {
          localStorage.setItem('isAuthenticated', 'true');
          localStorage.setItem('user', JSON.stringify(result.user));
          setIsAuthenticated(true);
          setShowPrivacyCard(true);
          return;
        }
      } catch (e) {
        // Not authenticated; continue to auth hub
      } finally {
        if (isMounted) setIsChecking(false);
      }
    })();
    return () => { isMounted = false; };
  }, []);

  const handleTabSwitch = (tab) => {
    setActiveTab(tab);
  };

  const handleSwitchToRegister = () => {
    setActiveTab('register');
  };

  const handleSwitchToLogin = () => {
    setActiveTab('login');
  };

  const handleForgotPassword = () => {
    setShowForgotPassword(true);
  };

  const handleCloseForgotPassword = () => {
    setShowForgotPassword(false);
  };

  // Handle successful authentication - show privacy card instead of direct redirect
  const handleAuthenticationSuccess = (userData) => {
    localStorage.setItem('isAuthenticated', 'true');
    localStorage.setItem('user', JSON.stringify(userData));
    setIsAuthenticated(true);
    setShowPrivacyCard(true);
  };

  const handlePrivacyAccept = () => {
    setShowPrivacyCard(false);
    navigate('/dashboard-overview');
  };

  const handlePrivacyDecline = () => {
    setShowPrivacyCard(false);
    setIsAuthenticated(false);
    localStorage.removeItem('isAuthenticated');
    localStorage.removeItem('user');
  };

  if (isChecking) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-muted-foreground text-sm">Checking session...</div>
      </div>
    );
  }

  // Show Privacy Card if user is authenticated
  if (showPrivacyCard && isAuthenticated) {
    return (
      <div className="min-h-screen">
        {/* Blurred Dashboard in Background */}
        <div className="fixed inset-0 blur-sm scale-105">
          <DashboardOverview />
        </div>
        
        {/* Privacy Card Overlay */}
        <PrivacyCard 
          onAccept={handlePrivacyAccept}
          onDecline={handlePrivacyDecline}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Simplified Header */}
      <header className="border-b border-border bg-card">
        <div className="flex items-center justify-between h-16 px-4 lg:px-6 max-w-7xl mx-auto">
          {/* Logo */}
          <Link to="/landing-page" className="flex items-center space-x-3">
            <div className="w-20 h-20">
              <img src="/logo.png" alt="Consultabid Logo" className="w-20 h-20 object-contain" />
            </div>
          </Link>

          {/* Back to Home */}
          <Link
            to="/landing-page"
            className="flex items-center space-x-2 text-sm text-muted-foreground hover:text-foreground transition-smooth"
          >
            <Icon name="ArrowLeft" size={16} />
            <span>Back to Home</span>
          </Link>
        </div>
      </header>
      {/* Main Content */}
      <main className="flex-1 py-12 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-start">
            {/* Left Side - Authentication Forms */}
            <div className="order-2 lg:order-1">
              <div className="bg-card border border-border rounded-xl shadow-subtle p-8">
                {/* Tab Navigation */}
              <div className="flex space-x-1 mb-8 bg-muted rounded-lg p-1">
                <button
                  onClick={() => handleTabSwitch('login')}
                  className={`flex-1 py-2 px-4 text-sm font-medium rounded-md transition-all duration-200
                    ${
                      activeTab === 'login'
                        ? 'bg-primary text-accent-foreground shadow-md scale-105'
                        : 'hover:bg-primary/90 hover:scale-110'
                    }
                  `}
                >
                  Sign In
                </button>

                <button
                  onClick={() => handleTabSwitch('register')}
                  className={`flex-1 py-2 px-4 text-sm font-medium rounded-md transition-all duration-200
                    ${
                      activeTab === 'register'
                        ? 'bg-primary text-accent-foreground shadow-md scale-105'
                        : 'hover:bg-primary/90 hover:scale-110'
                    }
                  `}
                >
                  Sign Up
                </button>
              </div>


                {/* Form Content */}
                <div className="transition-all duration-300">
                  {activeTab === 'login' ? (
                    <LoginForm
                      onSwitchToRegister={handleSwitchToRegister}
                      onForgotPassword={handleForgotPassword}
                      onAuthenticationSuccess={handleAuthenticationSuccess}
                    />
                  ) : (
                    <RegisterForm 
                      onSwitchToLogin={handleSwitchToLogin}
                      onAuthenticationSuccess={handleAuthenticationSuccess}
                    />
                  )}
                </div>
              </div>
            </div>

            {/* Right Side - Trust Signals & Information */}
            <div className="order-1 lg:order-2 space-y-8">
              <div className="text-center lg:text-left">
                <h1 className="text-3xl lg:text-4xl font-bold text-foreground mb-4">
                  Transform Your Property Inspections
                </h1>
                <p className="text-lg text-muted-foreground mb-6">
                  Get accurate repair estimates from your inspection reports in minutes, 
                  not hours. Join thousands of professionals who trust Consultabid.
                </p>
                
                <div className="flex items-center justify-center lg:justify-start space-x-6 text-sm text-muted-foreground">
                  <div className="flex items-center space-x-2">
                    <Icon name="Users" size={16} className="text-primary" />
                    <span>10,000+ Users</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Icon name="FileText" size={16} className="text-primary" />
                    <span>50,000+ Reports</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Icon name="Clock" size={16} className="text-primary" />
                    <span>2 Min Setup</span>
                  </div>
                </div>
              </div>

              {/* Trust Signals Component */}
              <TrustSignals />

              {/* Key Features */}
              <div className="bg-muted/30 rounded-xl p-6">
                <h3 className="text-lg font-semibold text-foreground mb-4">
                  Why Choose Consultabid?
                </h3>
                
                <div className="space-y-4">
                  <div className="flex items-start space-x-3">
                    <div className="flex-shrink-0 w-6 h-6 bg-primary/10 rounded-full flex items-center justify-center mt-0.5">
                      <Icon name="Zap" size={12} className="text-primary" />
                    </div>
                    <div>
                      <h4 className="text-sm font-medium text-foreground">Advanced Analysis</h4>
                      <p className="text-xs text-muted-foreground">
                        Sophisticated algorithms analyze your reports for accurate estimates
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-start space-x-3">
                    <div className="flex-shrink-0 w-6 h-6 bg-primary/10 rounded-full flex items-center justify-center mt-0.5">
                      <Icon name="DollarSign" size={12} className="text-primary" />
                    </div>
                    <div>
                      <h4 className="text-sm font-medium text-foreground">Market-Based Pricing</h4>
                      <p className="text-xs text-muted-foreground">
                        Real-time pricing data from local contractors and suppliers
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-start space-x-3">
                    <div className="flex-shrink-0 w-6 h-6 bg-primary/10 rounded-full flex items-center justify-center mt-0.5">
                      <Icon name="BarChart3" size={12} className="text-primary" />
                    </div>
                    <div>
                      <h4 className="text-sm font-medium text-foreground">Detailed Breakdowns</h4>
                      <p className="text-xs text-muted-foreground">
                        Comprehensive cost analysis with priority recommendations
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
      {/* Forgot Password Modal */}
      <ForgotPasswordModal
        isOpen={showForgotPassword}
        onClose={handleCloseForgotPassword}
      />
      {/* Footer */}
      <footer className="border-t border-border bg-card py-8">
        <div className="max-w-7xl mx-auto px-4 text-center">
          <div className="flex items-center justify-center space-x-6 text-xs text-muted-foreground">
            <Link to="/privacy" className="hover:text-foreground transition-smooth">
              Privacy Policy
            </Link>
            <Link to="/terms" className="hover:text-foreground transition-smooth">
              Terms of Service
            </Link>
            <Link to="/help" className="hover:text-foreground transition-smooth">
              Help Center
            </Link>
          </div>
          
          <p className="text-xs text-muted-foreground mt-4">
            © {new Date()?.getFullYear()} Consultabid. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
};

export default AuthenticationHub;
