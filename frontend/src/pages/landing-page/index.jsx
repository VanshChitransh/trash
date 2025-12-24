import React, { useEffect } from 'react';
import Header from './components/Header';
import HeroSection from './components/HeroSection';
import FeaturesSection from './components/FeaturesSection';
import PricingSection from './components/PricingSection';
import Footer from './components/Footer';

const LandingPage = () => {
  useEffect(() => {
    // Set page title
    document.title = 'Consultabid - Fast, Accurate Repair Estimates From Your Home Inspection Report';
    
    // Add meta description
    const metaDescription = document.querySelector('meta[name="description"]');
    if (metaDescription) {
      metaDescription?.setAttribute('content', 'Upload your inspection report and receive clear, itemized repair costs. Serving Houston and surrounding communities. Get accurate repair estimates at affordable prices.');
    }

    // Smooth scrolling for anchor links
    const handleSmoothScroll = (e) => {
      const href = e?.target?.getAttribute('href');
      if (href && href?.startsWith('#')) {
        e?.preventDefault();
        const element = document.querySelector(href);
        if (element) {
          element?.scrollIntoView({ behavior: 'smooth' });
        }
      }
    };

    document.addEventListener('click', handleSmoothScroll);
    return () => document.removeEventListener('click', handleSmoothScroll);
  }, []);

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <Header />

      {/* Main Content */}
      <main>
        {/* Hero Section */}
        <HeroSection />

        {/* Features Section - Includes Short Description, How It Works, Why Choose, Who We Serve */}
        <div id="features">
          <FeaturesSection />
        </div>

        {/* Pricing Section */}
        <div id="pricing">
          <PricingSection />
        </div>
      </main>

      {/* Footer */}
      <Footer />
    </div>
  );
};

export default LandingPage;