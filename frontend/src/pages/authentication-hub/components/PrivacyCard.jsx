import React, { useState } from 'react';
import Icon from '../../../components/AppIcon';

const PrivacyCard = ({ onAccept, onDecline }) => {
  const [isAgreed, setIsAgreed] = useState(false);

  const handleAccept = () => {
    if (isAgreed) {
      onAccept();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      
      {/* Privacy Card */}
      <div className="relative bg-card border border-border rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="bg-primary/5 border-b border-border px-6 py-4">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
              <Icon name="Shield" size={20} className="text-primary" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-foreground">Privacy & Terms Agreement</h2>
              <p className="text-sm text-muted-foreground">Please read and accept the terms below to continue.</p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 max-h-[60vh] overflow-y-auto">
          {/* Privacy & Terms Agreement */}
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-foreground mb-3">Privacy & Terms Agreement</h3>
            <div className="text-sm text-muted-foreground leading-relaxed space-y-3">
              <p>
                Please read and accept the terms below to continue. Consultabid does not review, verify, or guarantee the accuracy,
                completeness, or interpretation of any home inspection report you provide. All repair costs shown in your Home
                Repair Estimate are non-binding estimates for general informational purposes only. Actual costs may vary
                substantially based on market conditions, contractor pricing, scope of work, and conditions specific to the
                property.
              </p>
              <p>
                Any prioritization or categorization of repairs is based solely on the information contained in your inspection
                report and Consultabid's independent judgment, without on-site evaluation or professional determination as defined
                by applicable Texas regulations. These recommendations are not professional advice, do not replace licensed
                contractor assessments, and should not be relied upon for safety, structural, or compliance decisions.
              </p>
              <p>
                Your use of the Home Repair Estimate confirms your acknowledgment that Consultabid is not acting as a licensed
                inspector, contractor, engineer, or professional advisor under Texas law, and that you agree to Consultabid's Terms
                of Use and Privacy Policy.
              </p>
            </div>
          </div>

          {/* Important Note */}
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-foreground mb-3">Important Note</h3>
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
              <div className="flex items-start space-x-3">
                <Icon name="AlertTriangle" size={20} className="text-amber-600 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-amber-800 leading-relaxed">
                  <p>
                    Consultabid's service is designed strictly for estimation and negotiation support. We do not guarantee that any
                    estimated price will reflect actual repair costs.
                  </p>
                  <p className="mt-2">
                    Our pricing is based on average rates for similar repairs within your area; however, hidden conditions,
                    additional findings, or contractor-specific pricing may result in higher or lower final costs compared to the
                    estimate provided.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Contractor List Notice */}
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-foreground mb-3">Contractor List Notice</h3>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-start space-x-3">
                <Icon name="Info" size={20} className="text-blue-700 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-blue-900 leading-relaxed space-y-2">
                  <p>
                    The contractor list provided through Consult-A-Bid is offered solely as a general reference. It is compiled
                    through basic review and publicly available information to ensure contractors meet minimal qualification
                    standards. The list is updated periodically as new information becomes available.
                  </p>
                  <p>
                    I understand that I am free to choose any contractor I prefer, whether or not they appear on Consultabid's list.
                    If I decide to hire a contractor from the provided list, I acknowledge that it is my responsibility to conduct
                    my own due diligence to confirm that the contractor is appropriate for my specific needs and project
                    requirements.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* User Acknowledgment */}
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-foreground mb-3">User Acknowledgment</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              By proceeding, you confirm that you have read and understood all sections above, including the Disclaimer, Important
              Note, and Contractor List Notice. You agree to the privacy terms and acknowledge that all repair costs provided are
              estimates only and may differ from actual expenses.
            </p>
          </div>

          {/* Agreement Checkbox */}
          <div className="flex items-start space-x-3 p-4 bg-muted/30 rounded-lg">
            <div className="flex-shrink-0 mt-1">
              <input
                type="checkbox"
                id="privacy-agreement"
                checked={isAgreed}
                onChange={(e) => setIsAgreed(e.target.checked)}
                className="w-4 h-4 text-primary bg-background border-border rounded focus:ring-primary focus:ring-2"
              />
            </div>
            <label htmlFor="privacy-agreement" className="text-sm text-foreground leading-relaxed cursor-pointer">
              I acknowledge and accept the Privacy & Terms Agreement, Important Note, Contractor List Notice, and the estimates-only
              nature of all repair costs.
            </label>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="bg-muted/30 border-t border-border px-6 py-4">
          <div className="flex items-center justify-between">
            <button
              onClick={onDecline}
              className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-smooth"
            >
              Decline
            </button>
            <button
              onClick={handleAccept}
              disabled={!isAgreed}
              className={`px-6 py-2 text-sm font-medium rounded-lg transition-all duration-200 ${
                isAgreed
                  ? 'bg-primary text-accent-foreground hover:bg-primary/90 shadow-md hover:shadow-lg'
                  : 'bg-muted text-muted-foreground cursor-not-allowed'
              }`}
            >
              Accept & Continue
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PrivacyCard;
