import React from 'react';
import Icon from '../../../components/AppIcon';
import Image from '../../../components/AppImage';

const TestimonialsSection = () => {
  const testimonials = [
    {
      id: 1,
      name: 'Sarah Johnson',
      role: 'Homeowner',
      location: 'Austin, TX',
      avatar: 'https://images.unsplash.com/photo-1494790108755-2616b612b786?w=150&h=150&fit=crop&crop=face',
      content: `Consultabid saved me thousands on my home purchase. The inspection report was overwhelming, but their detailed analysis helped me prioritize repairs and negotiate with the seller. The cost estimates were spot-on compared to actual contractor quotes.`,
      rating: 5
    },
    {
      id: 2,
      name: 'Michael Rodriguez',
      role: 'Real Estate Agent',
      location: 'Denver, CO',
      avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&h=150&fit=crop&crop=face',
      content: `As a realtor, I use Consultabid for all my clients' inspection reports. It helps them understand repair costs upfront and makes negotiations smoother. My clients love the detailed breakdowns and professional reports.`,
      rating: 5
    },
    {
      id: 3,
      name: 'Jennifer Chen',role: 'Property Investor',location: 'Seattle, WA',avatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150&h=150&fit=crop&crop=face',
      content: `I analyze 20+ properties monthly, and Consultabid has become essential to my workflow. The market rate comparisons and timeline recommendations help me make quick investment decisions with confidence.`,
      rating: 5
    }
  ];

  const stats = [
    {
      number: '10,000+',
      label: 'Properties Analyzed',
      icon: 'Home'
    },
    {
      number: '$2.5M+',
      label: 'Repair Costs Estimated',
      icon: 'DollarSign'
    },
    {
      number: '98%',
      label: 'Accuracy Rate',
      icon: 'Target'
    },
    {
      number: '4.9/5',
      label: 'Customer Rating',
      icon: 'Star'
    }
  ];

  const renderStars = (rating) => {
    return Array.from({ length: 5 }, (_, index) => (
      <Icon
        key={index}
        name="Star"
        size={16}
        className={index < rating ? 'text-yellow-400 fill-current' : 'text-gray-300'}
      />
    ));
  };

  return (
    <section className="py-16 lg:py-24 bg-white">
      <div className="container mx-auto px-4 lg:px-6">
        {/* Stats Section */}
        <div className="mb-20">
          <div className="text-center mb-12">
            <h2 className="text-3xl lg:text-4xl font-bold text-gray-900 mb-4">
              Trusted by Thousands
            </h2>
            <p className="text-xl text-gray-600">
              Join property professionals who rely on our accurate estimates
            </p>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-8">
            {stats?.map((stat, index) => (
              <div key={index} className="text-center">
                <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Icon name={stat?.icon} size={24} className="text-primary" />
                </div>
                <div className="text-3xl lg:text-4xl font-bold text-gray-900 mb-2">
                  {stat?.number}
                </div>
                <div className="text-gray-600">
                  {stat?.label}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Testimonials */}
        <div>
          <div className="text-center mb-16">
            <h2 className="text-3xl lg:text-5xl font-bold text-gray-900 mb-6">
              What Our Users Say
            </h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              Real feedback from homeowners, agents, and investors who use Consultabid daily
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {testimonials?.map((testimonial) => (
              <div key={testimonial?.id} className="bg-gray-50 rounded-2xl p-8 relative">
                {/* Quote Icon */}
                <div className="absolute top-6 right-6 w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center">
                  <Icon name="Quote" size={16} className="text-primary" />
                </div>

                {/* Rating */}
                <div className="flex items-center space-x-1 mb-6">
                  {renderStars(testimonial?.rating)}
                </div>

                {/* Content */}
                <p className="text-gray-700 mb-8 leading-relaxed">
                  "{testimonial?.content}"
                </p>

                {/* Author */}
                <div className="flex items-center space-x-4">
                  <div className="w-12 h-12 rounded-full overflow-hidden flex-shrink-0">
                    <Image
                      src={testimonial?.avatar}
                      alt={testimonial?.name}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div>
                    <div className="font-semibold text-gray-900">
                      {testimonial?.name}
                    </div>
                    <div className="text-sm text-gray-600">
                      {testimonial?.role} • {testimonial?.location}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Trust Signals */}
        <div className="mt-20 text-center">
          <div className="inline-flex items-center space-x-8 bg-gray-50 rounded-2xl px-8 py-6">
            <div className="flex items-center space-x-2">
              <Icon name="Shield" size={20} className="text-green-500" />
              <span className="text-sm font-medium text-gray-700">SSL Secured</span>
            </div>
            <div className="flex items-center space-x-2">
              <Icon name="Lock" size={20} className="text-blue-500" />
              <span className="text-sm font-medium text-gray-700">GDPR Compliant</span>
            </div>
            <div className="flex items-center space-x-2">
              <Icon name="Award" size={20} className="text-purple-500" />
              <span className="text-sm font-medium text-gray-700">Industry Certified</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default TestimonialsSection;