import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import Button from '../../../components/ui/Button';
import Icon from '../../../components/AppIcon';

const Header = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  const navigationItems = [
    { label: 'How It Works', href: '#features' },
    { label: 'Pricing', href: '#pricing' },
    { label: 'Contact', href: '#contact' }
  ];

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const handleNavigation = (path) => {
    if (path?.startsWith('#')) {
      // Smooth scroll to section
      const element = document.querySelector(path);
      if (element) {
        element?.scrollIntoView({ behavior: 'smooth' });
      }
    } else {
      navigate(path);
    }
    setIsMenuOpen(false);
  };

  const handleLogin = () => {
    navigate('/authentication-hub', { state: { mode: 'login' } });
  };

  const handleSignup = () => {
    navigate('/authentication-hub', { state: { mode: 'signup' } });
  };

  return (
    <header className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
      isScrolled 
        ? 'bg-white/95 backdrop-blur-md shadow-sm' 
        : 'bg-transparent'
    }`}>
      <div className="container mx-auto px-4 lg:px-6">
        <div className="flex items-center justify-between h-16 lg:h-20">
          {/* Logo */}
        <div className="flex items-center space-x-3">
            <div className="w-24 h-24">
              <img src="/logo.png" alt="Consultabid Logo" className="w-24 h-24 object-contain" />
            </div>
          </div>

          {/* Desktop Navigation */}
          <nav className="hidden lg:flex items-center space-x-8">
            {navigationItems?.map((item) => (
              <button
                key={item?.href}
                onClick={() => handleNavigation(item?.href)}
                className="text-gray-700 hover:text-primary font-medium transition-smooth"
              >
                {item?.label}
              </button>
            ))}
          </nav>

          {/* Desktop Actions */}
          <div className="hidden lg:flex items-center space-x-4">
            <Button 
              variant="ghost" 
              onClick={handleLogin}
            >
              Log In
            </Button>
            <Button 
              variant="default" 
              onClick={handleSignup}
              iconName="ArrowRight"
              iconPosition="right"
            >
              Get Started
            </Button>
          </div>

          {/* Mobile Menu Button */}
          <button
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className="lg:hidden p-2 text-gray-700 hover:text-primary transition-smooth"
          >
            <Icon name={isMenuOpen ? "X" : "Menu"} size={24} />
          </button>
        </div>

        {/* Mobile Menu */}
        {isMenuOpen && (
          <div className="lg:hidden bg-white border-t border-gray-200 shadow-lg animate-slide-down">
            <nav className="px-4 py-6 space-y-4">
              {navigationItems?.map((item) => (
                <button
                  key={item?.href}
                  onClick={() => handleNavigation(item?.href)}
                  className="block w-full text-left text-gray-700 hover:text-primary font-medium py-2 transition-smooth"
                >
                  {item?.label}
                </button>
              ))}
              
              <div className="pt-4 border-t border-gray-200 space-y-3">
                <Button 
                  variant="outline" 
                  onClick={handleLogin}
                  className="w-full"
                >
                  Log In
                </Button>
                <Button 
                  variant="default" 
                  onClick={handleSignup}
                  iconName="ArrowRight"
                  iconPosition="right"
                  className="w-full"
                >
                  Get Started
                </Button>
              </div>
            </nav>
          </div>
        )}
      </div>
    </header>
  );
};

export default Header;
