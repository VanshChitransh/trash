import React from 'react';
import Icon from '../../../components/AppIcon';

const FeaturesSection = () => {
  const howItWorks = [
    {
      step: 'Step 1',
      title: 'Upload Your Inspection Report',
      description: 'PDF, images, or scanned documents — we handle it all.',
      icon: 'Upload'
    },
    {
      step: 'Step 2',
      title: 'We Review & Break Down Every Finding',
      description: 'Our team interprets your report line by line to identify all repair items.',
      icon: 'Search'
    },
    {
      step: 'Step 3',
      title: 'Get a Clear, Itemized Cost Estimate',
      description: 'Receive a detailed breakdown of what the repairs should realistically cost in Houston\'s current market.',
      icon: 'FileText'
    },
    {
      step: 'Step 4',
      title: 'Make Confident Decisions',
      description: 'Use the estimate to negotiate, plan, or budget with total confidence.',
      icon: 'CheckCircle'
    }
  ];

  const whyChoose = [
    {
      title: 'Affordable & Transparent',
      description: 'Get accurate repair cost estimates at a fraction of what traditional estimators charge.',
      icon: 'DollarSign'
    },
    {
      title: 'Houston-Focused Pricing',
      description: 'We use local labor + material rates specific to Houston and nearby neighborhoods.',
      icon: 'MapPin'
    },
    {
      title: 'Quick Turnaround',
      description: 'Most estimates are delivered in as little as 2–12 hours.',
      icon: 'Clock'
    },
    {
      title: 'Perfect for Homebuyers & Investors',
      description: 'Know exactly what you\'re getting into before closing or renovating.',
      icon: 'Home'
    },
    {
      title: 'No Contractor Pressure',
      description: 'We don\'t sell repairs — you get unbiased, honest numbers.',
      icon: 'Shield'
    },
    {
      title: 'Detailed Documentation',
      description: 'Receive comprehensive, itemized breakdowns you can share with lenders, agents, or contractors.',
      icon: 'FileCheck'
    }
  ];

  const whoWeServe = [
    {
      title: 'Home Buyers',
      description: 'Understand the true cost of repairs before finalizing your offer.',
      icon: 'Users'
    },
    {
      title: 'Sellers',
      description: 'Price your home accurately or plan pre-listing repairs.',
      icon: 'Home'
    },
    {
      title: 'Real Estate Investors',
      description: 'Evaluate deals faster with real-world cost breakdowns.',
      icon: 'TrendingUp'
    },
    {
      title: 'Realtors',
      description: 'Add more value to your clients with reliable, third-party estimates.',
      icon: 'User'
    }
  ];

  return (
    <section className="py-16 lg:py-24 bg-white">
      <div className="container mx-auto px-4 lg:px-6">
        {/* Short Description Section */}
        <div className="max-w-4xl mx-auto text-center mb-20">
          <p className="text-xl lg:text-2xl text-gray-700 leading-relaxed">
            Consultabid helps homeowners, buyers, and investors turn confusing inspection reports into easy-to-understand repair cost estimates. No guesswork. No overpriced contractors. Just clarity, speed, and fair pricing.
          </p>
        </div>

        {/* How It Works Section */}
        <div className="mb-20">
          <div className="text-center mb-16">
            <h2 className="text-3xl lg:text-5xl font-bold text-gray-900 mb-6">
              How It Works
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 max-w-7xl mx-auto">
            {howItWorks?.map((item, index) => (
              <div key={index} className="relative">
                <div className="bg-white rounded-xl p-8 shadow-subtle hover:shadow-moderate hover:bg-blue-50 transition-smooth h-full cursor-pointer">
                  <div className="flex items-center justify-center w-16 h-16 bg-primary/10 rounded-full mb-6 mx-auto">
                    <span className="text-xl font-semibold text-primary">{item?.step}</span>
                  </div>
                  <div className="w-16 h-16 bg-primary/10 rounded-lg flex items-center justify-center mb-4 mx-auto">
                    <Icon name={item?.icon} size={40} className="text-primary" />
                  </div>
                  <h3 className="text-xl font-semibold text-gray-900 mb-4 text-center">
                    {item?.title}
                  </h3>
                  <p className="text-gray-600 leading-relaxed text-center">
                    {item?.description}
                  </p>
                </div>
                {index < howItWorks?.length - 1 && (
                  <div className="hidden lg:flex absolute top-1/2 left-full transform -translate-y-1/2 -translate-x-1/2 items-center justify-center z-10 ml-4">
                    <Icon name="ArrowRight" size={24} className="text-primary/40" />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Why Choose Consultabid Section */}
        <div className="mb-20 bg-gray-50 rounded-2xl p-12">
          <div className="text-center mb-16">
            <h2 className="text-3xl lg:text-5xl font-bold text-gray-900 mb-6">
              Why Choose Consultabid
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 max-w-6xl mx-auto">
            {whyChoose?.map((item, index) => (
              <div
                key={index}
                className="bg-white rounded-xl p-6 shadow-subtle hover:shadow-moderate hover:-translate-y-1 hover:bg-blue-50 transition-smooth"
              >
                <div className="flex items-start space-x-4">
                  <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Icon name={item?.icon} size={26} className="text-primary" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">
                      {item?.title}
                    </h3>
                    <p className="text-gray-600 leading-relaxed">
                      {item?.description}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Who We Serve Section */}
        <div>
          <div className="text-center mb-16">
            <h2 className="text-3xl lg:text-5xl font-bold text-gray-900 mb-6">
              Who We Serve
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 max-w-7xl mx-auto">
            {whoWeServe?.map((item, index) => (
              <div
                key={index}
                className="bg-white rounded-xl p-8 shadow-subtle hover:shadow-moderate hover:-translate-y-1 hover:bg-blue-50 transition-smooth text-center"
              >
                <div className="w-18 h-18 bg-primary/10 rounded-full flex items-center justify-center mb-6 mx-auto">
                  <Icon name={item?.icon} size={40} className="text-primary" />
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-4">
                  {item?.title}
                </h3>
                <p className="text-gray-600 leading-relaxed">
                  {item?.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

export default FeaturesSection;
