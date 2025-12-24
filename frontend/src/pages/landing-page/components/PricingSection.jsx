import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Button from '../../../components/ui/Button';
import Icon from '../../../components/AppIcon';

const PricingSection = () => {
  const navigate = useNavigate();
  const [tooltipVisible, setTooltipVisible] = useState(null);

  const pricingPlans = [
    {
      id: 'standard',
      name: 'Standard Estimate',
      description: 'Perfect for: Anyone who wants a clear, itemized estimate without going too deep.',
      price: 39,
      features: [
        'Itemized list of all repair findings',
        'Labor + material cost breakdowns',
        'Houston-based pricing',
        'Delivered in 24–48 hours',
        'Ideal for buyers, sellers, and realtors'
      ],
      popular: false
    },
    {
      id: 'full',
      name: 'Full Detailed Estimate',
      description: 'Perfect for: Clients needing the most accurate and detailed repair cost insight.',
      price: 89,
      couponPrice: 39,
      hasCoupon: true,
      features: [
        'Full line-by-line review of your entire inspection report',
        'Precise repair cost calculations',
        'Priority delivery',
        'Locally tuned price data',
        'Great for investors, high-value homes, and renovation planning',
        'Best value with coupon code'
      ],
      popular: false
    }
  ];

  const handleSelectPlan = (planId) => {
    navigate('/authentication-hub', { state: { selectedPlan: planId } });
  };

  return (
    <section className="py-16 lg:py-24 bg-gray-50">
      <div className="container mx-auto px-4 lg:px-6">
        {/* Section Header */}
        <div className="text-center mb-16">
          <h2 className="text-3xl lg:text-5xl font-bold text-gray-900 mb-6">
            Simple, Honest Pricing — No Hidden Fees
          </h2>
          <p className="text-xl text-gray-600 mb-4 max-w-3xl mx-auto">
            Get accurate repair estimates without paying contractor markups or overpriced consultation fees. Choose the plan that fits your needs.
          </p>
        </div>

        {/* Pricing Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-5xl mx-auto mb-12">
          {pricingPlans?.map((plan) => (
            <div
              key={plan?.id}
              className={`relative bg-white rounded-2xl shadow-moderate hover:shadow-hover transition-smooth p-8 ${plan?.popular
                ? 'ring-2 ring-primary lg:scale-105'
                : 'border border-gray-200'
                }`}
            >
              {/* Popular Badge */}
              {plan?.popular && (
                <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                  <div className="bg-primary text-white px-4 py-1 rounded-full text-sm font-medium">
                    Most Popular
                  </div>
                </div>
              )}

              {/* Plan Header */}
              <div className="text-center mb-8">
                <h3 className="text-2xl font-bold text-gray-900 mb-4">
                  {plan?.name}
                </h3>
                <div className="mb-4">
                  <div className="flex items-baseline justify-center">
                    <span className="text-5xl font-bold text-gray-900">
                      ${plan?.price}
                    </span>
                  </div>
                  {plan?.hasCoupon && (
                    <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded-lg">
                      <div className="text-sm font-medium text-green-800 mb-1">
                        💰 Special Offer
                      </div>
                      <div className="text-xs text-green-700">
                        Get this plan for <span className="font-bold">${plan?.couponPrice}</span> with a valid coupon code
                      </div>
                    </div>
                  )}
                </div>
                <p className="text-gray-600 text-sm mb-6">
                  {plan?.description}
                </p>

                {/* CTA Button */}
                <Button
                  variant="default"
                  size="lg"
                  onClick={() => handleSelectPlan(plan?.id)}
                  className="w-full mb-6"
                >
                  Get Started
                </Button>
              </div>

              {/* Features List */}
              <div>
                <div className="text-sm font-semibold text-gray-900 mb-4">You Get:</div>
                <div className="space-y-3">
                  {plan?.features?.map((feature, index) => (
                    <div key={index} className="flex items-start space-x-3">
                      <Icon
                        name="Check"
                        size={16}
                        className="text-green-500 mt-1 flex-shrink-0"
                      />
                      <span className="text-gray-700 text-sm">
                        {feature}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Help Section */}
        <div className="text-center max-w-2xl mx-auto">
          <p className="text-gray-600 mb-4">
            Need Help Choosing?
          </p>
          <p className="text-sm text-gray-500 mb-6">
            If you're unsure which plan fits your situation best, share your inspection report and we'll point you in the right direction — no pressure, no upselling.
          </p>
        </div>
      </div>
    </section>
  );
};

export default PricingSection;