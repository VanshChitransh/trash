import React from 'react';
import { useNavigate } from 'react-router-dom';
import Button from '../../../components/ui/Button';
import Icon from '../../../components/AppIcon';

const CTASection = () => {
  const navigate = useNavigate();

  const handleGetStarted = () => {
    navigate('/authentication-hub');
  };

  const handleWatchDemo = () => {
    // In a real app, this would open a demo video modal
    console.log('Opening demo video...');
  };

  return (
    <section className="py-16 lg:py-24 bg-gradient-to-r from-primary to-secondary">
      <div className="container mx-auto px-4 lg:px-6">
        <div className="max-w-4xl mx-auto text-center text-white">
          {/* Main CTA Content */}
          <div className="mb-12">
            <h2 className="text-3xl lg:text-5xl font-bold mb-6">
              Ready to Transform Your Inspection Reports?
            </h2>
            <p className="text-xl lg:text-2xl opacity-90 mb-8 max-w-3xl mx-auto leading-relaxed">
              Join thousands of property professionals who trust Consultabid for accurate repair estimates.
              Start your free trial today and see the difference our detailed analysis makes.
            </p>
          </div>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center space-y-4 sm:space-y-0 sm:space-x-6 mb-12">
            <Button
              variant="secondary"
              size="lg"
              onClick={handleGetStarted}
              iconName="ArrowRight"
              iconPosition="right"
              className="w-full sm:w-auto bg-white text-primary hover:bg-gray-50"
            >
              Start Free Trial
            </Button>
            <Button
              variant="ghost"
              size="lg"
              onClick={handleWatchDemo}
              iconName="Play"
              iconPosition="left"
              className="w-full sm:w-auto text-white border-white hover:bg-white/10"
            >
              Watch Demo
            </Button>
          </div>

          {/* Trust Indicators */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 max-w-2xl mx-auto">
            <div className="flex flex-col items-center">
              <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center mb-3">
                <Icon name="Clock" size={24} className="text-white" />
              </div>
              <div className="font-semibold mb-1">2-Minute Setup</div>
              <div className="text-sm opacity-80">Get started instantly</div>
            </div>
            
            <div className="flex flex-col items-center">
              <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center mb-3">
                <Icon name="CreditCard" size={24} className="text-white" />
              </div>
              <div className="font-semibold mb-1">No Credit Card</div>
              <div className="text-sm opacity-80">Required for trial</div>
            </div>
            
            <div className="flex flex-col items-center">
              <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center mb-3">
                <Icon name="Users" size={24} className="text-white" />
              </div>
              <div className="font-semibold mb-1">Join 10,000+</div>
              <div className="text-sm opacity-80">Happy customers</div>
            </div>
          </div>

          {/* Additional Benefits */}
          <div className="mt-12 pt-8 border-t border-white/20">
            <div className="flex flex-col sm:flex-row items-center justify-center space-y-4 sm:space-y-0 sm:space-x-8 text-sm opacity-90">
              <div className="flex items-center space-x-2">
                <Icon name="Shield" size={16} />
                <span>30-day money-back guarantee</span>
              </div>
              <div className="flex items-center space-x-2">
                <Icon name="Headphones" size={16} />
                <span>24/7 customer support</span>
              </div>
              <div className="flex items-center space-x-2">
                <Icon name="Zap" size={16} />
                <span>Cancel anytime</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Background Decoration */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-10 w-24 h-24 bg-white/10 rounded-full blur-xl"></div>
        <div className="absolute bottom-1/4 right-10 w-32 h-32 bg-white/10 rounded-full blur-xl"></div>
      </div>
    </section>
  );
};

export default CTASection;