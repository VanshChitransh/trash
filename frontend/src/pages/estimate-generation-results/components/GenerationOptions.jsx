import React, { useState } from 'react';
import Button from '../../../components/ui/Button';
import Icon from '../../../components/AppIcon';

// comment: Component for selecting generation options and handling coupon codes
// comment: Component for selecting generation options and handling coupon codes
// comment: Component for selecting generation options and handling coupon codes
const GenerationOptions = ({
  onGenerate,
  isProcessing,
  onViewEstimate,
  hasEstimate,
  onStartPayment,
  paymentStatus,
  isAdminUser,
}) => {
  const [selectedOption, setSelectedOption] = useState('standard');
  const [couponCode, setCouponCode] = useState('');
  const [couponApplied, setCouponApplied] = useState(false);
  const [couponError, setCouponError] = useState('');

  const options = [
    {
      id: 'standard',
      title: 'Standard Estimate',
      description: 'Clear, itemized estimate with all essential details',
      features: ['Itemized list of all repair findings', 'Labor + material cost breakdowns', 'Houston-based pricing', 'Delivered in 24–48 hours', 'Ideal for buyers, sellers, and realtors'],
      price: 39,
      icon: 'FileText',
      recommended: true
    },
    {
      id: 'full',
      title: 'Full Detailed Estimate',
      description: 'Most accurate and detailed repair cost insight',
      features: ['Full line-by-line review of entire inspection report', 'Precise repair cost calculations', 'Priority delivery', 'Locally tuned price data', 'Great for investors, high-value homes, and renovation planning'],
      price: 89,
      couponPrice: 39,
      hasCoupon: true,
      icon: 'Target',
      recommended: false
    }
  ];

  const handleApplyCoupon = () => {
    // Simple coupon validation - you can enhance this with backend validation
    const validCoupons = ['SAVE50', 'WELCOME', 'DISCOUNT50'];

    if (validCoupons.includes(couponCode.toUpperCase())) {
      setCouponApplied(true);
      setCouponError('');
    } else {
      setCouponApplied(false);
      setCouponError('Invalid coupon code');
    }
  };

  const handleRemoveCoupon = () => {
    setCouponCode('');
    setCouponApplied(false);
    setCouponError('');
  };

  const getDisplayPrice = (option) => {
    if (option.hasCoupon && couponApplied) {
      return option.couponPrice;
    }
    return option.price;
  };

  const handleGenerate = () => {
    onGenerate(selectedOption, couponApplied ? couponCode : null);
  };

  const handlePayNow = () => {
    const tier = selectedOption === 'full' ? '89' : '39';
    if (onStartPayment) {
      onStartPayment(tier);
    }
  };

  const currentTierLabel = selectedOption === 'full' ? '$89' : '$39';
  const isPaid = paymentStatus === 'PAID' || isAdminUser;
  const showPaymentButton = isAdminUser || !isPaid;
  const paymentStatusLabel = isAdminUser ? 'Admin access (no payment required)' : (paymentStatus || 'Not started');
  const payButtonLabel = isAdminUser ? 'Payment disabled for admin' : `Pay ${currentTierLabel}`;

  return (
    <div className="bg-card rounded-lg border border-border p-6">
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-foreground mb-2">Choose Analysis Type</h2>
        <p className="text-muted-foreground">Select the level of detail for your estimate generation</p>
        <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-md text-sm text-amber-800">
          {isAdminUser ? (
            <>
              Admin account detected. Payment is disabled and the button below is grayed out. Current tier: {currentTierLabel}. Payment status: {paymentStatusLabel}.
            </>
          ) : (
            <>
              Please pay with the same email you are logged in with. Current tier: {currentTierLabel}. Payment status: {paymentStatusLabel}.
            </>
          )}
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        {options?.map((option) => (
          <div
            key={option?.id}
            className={`relative border rounded-lg p-4 cursor-pointer transition-smooth ${
              selectedOption === option?.id
                ? 'border-primary bg-primary/5' :'border-border hover:border-primary/50'
            }`}
            onClick={() => setSelectedOption(option?.id)}
          >
            {option?.recommended && (
              <div className="absolute -top-2 left-4 bg-accent text-accent-foreground text-xs px-2 py-1 rounded-full">
                Recommended
              </div>
            )}
            
            <div className="flex items-start space-x-3">
              <div className={`p-2 rounded-md ${
                selectedOption === option?.id ? 'bg-primary text-primary-foreground' : 'bg-muted'
              }`}>
                <Icon name={option?.icon} size={20} />
              </div>
              
              <div className="flex-1">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-medium text-foreground">{option?.title}</h3>
                  <div className="text-right">
                    {option?.hasCoupon && couponApplied ? (
                      <div className="flex items-center space-x-2">
                        <span className="text-xs text-muted-foreground line-through">${option?.price}</span>
                        <span className="text-sm font-semibold text-green-600">${getDisplayPrice(option)}</span>
                      </div>
                    ) : (
                      <span className="text-sm font-semibold text-primary">${option?.price}</span>
                    )}
                  </div>
                </div>
                
                <p className="text-sm text-muted-foreground mb-3">{option?.description}</p>
                
                <ul className="space-y-1">
                  {option?.features?.map((feature, index) => (
                    <li key={index} className="flex items-center space-x-2 text-sm text-muted-foreground">
                      <Icon name="Check" size={14} className="text-accent" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
              </div>
              
              <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                selectedOption === option?.id
                  ? 'border-primary bg-primary' :'border-border'
              }`}>
                {selectedOption === option?.id && (
                  <div className="w-2 h-2 bg-white rounded-full"></div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Coupon Code Section */}
      {selectedOption === 'full' && (
        <div className="mb-6 p-4 bg-muted/30 rounded-lg border border-border">
          <div className="flex items-start space-x-3">
            <Icon name="Tag" size={20} className="text-primary mt-1" />
            <div className="flex-1">
              <h3 className="font-medium text-foreground mb-2">Have a Coupon Code?</h3>
              <p className="text-sm text-muted-foreground mb-3">
                Apply your coupon to get the Full Detailed Estimate for just $39
              </p>

              {!couponApplied ? (
                <div className="flex items-start space-x-2">
                  <div className="flex-1">
                    <input
                      type="text"
                      value={couponCode}
                      onChange={(e) => {
                        setCouponCode(e.target.value.toUpperCase());
                        setCouponError('');
                      }}
                      placeholder="Enter coupon code"
                      className="w-full px-3 py-2 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                    {couponError && (
                      <p className="text-xs text-red-500 mt-1">{couponError}</p>
                    )}
                  </div>
                  <Button
                    variant="outline"
                    size="md"
                    onClick={handleApplyCoupon}
                    disabled={!couponCode}
                  >
                    Apply
                  </Button>
                </div>
              ) : (
                <div className="flex items-center justify-between p-3 bg-green-50 border border-green-200 rounded-md">
                  <div className="flex items-center space-x-2">
                    <Icon name="Check" size={16} className="text-green-600" />
                    <span className="text-sm font-medium text-green-800">
                      Coupon "{couponCode}" applied! You save $50
                    </span>
                  </div>
                  <button
                    onClick={handleRemoveCoupon}
                    className="text-xs text-green-700 hover:text-green-900 underline"
                  >
                    Remove
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-wrap justify-end gap-3">
        {showPaymentButton && (
          <Button
            variant="outline"
            size="lg"
            onClick={handlePayNow}
            iconName="CreditCard"
            iconPosition="left"
            disabled={isProcessing || isAdminUser}
            className={isAdminUser ? 'cursor-not-allowed opacity-60' : ''}
          >
            {payButtonLabel}
          </Button>
        )}

        {hasEstimate ? (
          <>
            <Button
              variant="outline"
              size="lg"
              onClick={handleGenerate}
              loading={isProcessing}
              iconName="RefreshCw"
              iconPosition="left"
              disabled={isProcessing || !isPaid}
            >
              Regenerate Estimate
            </Button>
            <Button
              variant="default"
              size="lg"
              onClick={onViewEstimate}
              iconName="Eye"
              iconPosition="left"
            >
              View Estimate
            </Button>
          </>
        ) : (
          <Button
            variant="default"
            size="lg"
            onClick={handleGenerate}
            loading={isProcessing}
            iconName="Play"
            iconPosition="left"
            disabled={isProcessing || !isPaid}
          >
            {isProcessing ? 'Generating Analysis...' : 'Generate Estimate'}
          </Button>
        )}
      </div>
    </div>
  );
};

export default GenerationOptions;
