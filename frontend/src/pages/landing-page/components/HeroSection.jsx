import React from 'react';
import { useNavigate } from 'react-router-dom';
import Button from '../../../components/ui/Button';
import Icon from '../../../components/AppIcon';

const HeroSection = () => {
  const navigate = useNavigate();

  const handleUploadReport = () => {
    navigate('/authentication-hub', { state: { mode: 'signup' } });
  };

  const handleSeeSample = () => {
    // Scroll to a sample section or open a modal
    const sampleSection = document.querySelector('#pricing');
    if (sampleSection) {
      sampleSection.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <section className="relative bg-gradient-to-br from-blue-50 to-indigo-100 pt-20 pb-16 lg:pt-32 lg:pb-24">
      <div className="container mx-auto px-4 lg:px-6">
        <div className="max-w-4xl mx-auto text-center">
          {/* Main Headline */}
          <h1 className="text-4xl lg:text-6xl font-bold text-gray-900 mb-6 leading-tight">
            Get Fast, Accurate Repair Estimates From Your Home Inspection Report
          </h1>

          {/* Subheadline */}
          <p className="text-xl lg:text-2xl text-gray-600 mb-4 max-w-3xl mx-auto leading-relaxed">
            Upload your inspection report and receive clear, itemized repair costs — all at a price that won't break the bank.
          </p>
          
          <p className="text-lg text-gray-500 mb-8 max-w-2xl mx-auto">
            Serving Houston and surrounding communities.
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center space-y-4 sm:space-y-0 sm:space-x-4 mb-12">
            <Button 
              variant="default" 
              size="lg" 
              onClick={handleUploadReport}
              iconName="Upload"
              iconPosition="left"
              className="w-full sm:w-auto"
            >
              Upload Your Report
            </Button>
            <Button 
              variant="outline" 
              size="lg"
              onClick={handleSeeSample}
              className="w-full sm:w-auto"
            >
              See Sample Estimate
            </Button>
          </div>
        </div>
      </div>

      {/* Background Decoration */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-10 w-20 h-20 bg-blue-200/30 rounded-full blur-xl"></div>
        <div className="absolute bottom-20 right-10 w-32 h-32 bg-indigo-200/30 rounded-full blur-xl"></div>
      </div>
    </section>
  );
};

export default HeroSection;