import React from 'react';
import Icon from '../../../components/AppIcon';

const TrustSignals = () => {
  const trustFeatures = [
    {
      icon: 'Shield',
      title: 'SSL Encrypted',
      description: 'Your data is protected with 256-bit SSL encryption'
    },
    {
      icon: 'Lock',
      title: 'Privacy First',
      description: 'We never share your personal information'
    },
    {
      icon: 'Award',
      title: 'Industry Certified',
      description: 'Trusted by 10,000+ property professionals'
    }
  ];

  const testimonials = [
    {
      name: 'Sarah Johnson',
      role: 'Real Estate Agent',
      content: `Consultabid transformed how I provide estimates to clients. The accuracy and speed are incredible.`,
      rating: 5
    },
    {
      name: 'Mike Chen',
      role: 'Property Investor',
      content: `I've saved thousands by getting accurate repair estimates before making investment decisions.`,
      rating: 5
    }
  ];

  return (
    <div className="space-y-8">
      {/* Trust Features */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {trustFeatures?.map((feature, index) => (
          <div key={index} className="flex items-center space-x-3 p-4 bg-muted/50 rounded-lg">
            <div className="flex-shrink-0 w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
              <Icon name={feature?.icon} size={20} className="text-primary" />
            </div>
            <div>
              <h4 className="text-sm font-medium text-foreground">{feature?.title}</h4>
              <p className="text-xs text-muted-foreground">{feature?.description}</p>
            </div>
          </div>
        ))}
      </div>
      {/* Testimonials */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-foreground text-center">
          Trusted by Professionals
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {testimonials?.map((testimonial, index) => (
            <div key={index} className="p-4 bg-card border border-border rounded-lg">
              <div className="flex items-center space-x-1 mb-2">
                {[...Array(testimonial?.rating)]?.map((_, i) => (
                  <Icon key={i} name="Star" size={14} className="text-yellow-400 fill-current" />
                ))}
              </div>
              
              <p className="text-sm text-muted-foreground mb-3">
                "{testimonial?.content}"
              </p>
              
              <div>
                <p className="text-sm font-medium text-foreground">{testimonial?.name}</p>
                <p className="text-xs text-muted-foreground">{testimonial?.role}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
      {/* Security Badges */}
      <div className="flex items-center justify-center space-x-6 pt-4 border-t border-border">
        <div className="flex items-center space-x-2">
          <Icon name="Shield" size={16} className="text-green-600" />
          <span className="text-xs text-muted-foreground">SOC 2 Compliant</span>
        </div>
        
        <div className="flex items-center space-x-2">
          <Icon name="Lock" size={16} className="text-blue-600" />
          <span className="text-xs text-muted-foreground">GDPR Ready</span>
        </div>
        
        <div className="flex items-center space-x-2">
          <Icon name="CheckCircle" size={16} className="text-green-600" />
          <span className="text-xs text-muted-foreground">99.9% Uptime</span>
        </div>
      </div>
    </div>
  );
};

export default TrustSignals;