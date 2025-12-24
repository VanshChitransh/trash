import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Icon from '../../../components/AppIcon';
import Button from '../../../components/ui/Button';
import Input from '../../../components/ui/Input';

const Footer = () => {
  const navigate = useNavigate();
  const currentYear = new Date()?.getFullYear();
  const [email, setEmail] = useState('');
  const [subscribeStatus, setSubscribeStatus] = useState(null); // null, 'success', 'error'
  const [isSubmitting, setIsSubmitting] = useState(false);

  const footerSections = [
    {
      title: 'Quick Links',
      links: [
        { label: 'Home', href: '/' },
        { label: 'Pricing', href: '#pricing' },
        { label: 'How It Works', href: '#features' },
        { label: 'FAQs', href: '#faqs' },
        { label: 'Contact', href: '#contact' },
        { label: 'Upload Report', href: '/authentication-hub' }
      ]
    },
    {
      title: 'Services',
      links: [
        { label: 'Home Inspection Report Review', href: '#features' },
        { label: 'Repair Cost Estimation', href: '#pricing' },
        { label: 'Investor Deal Evaluation', href: '#features' },
        { label: 'Pre-Listing Repair Estimates', href: '#features' }
      ]
    },
    {
      title: 'Support',
      links: [
        { label: 'Help Center', href: '/help' },
        { label: 'Terms & Conditions', href: '/terms' },
        { label: 'Privacy Policy', href: '/privacy' },
        { label: 'Refund Policy', href: '/refund' },
        { label: 'Contact Us', href: '#contact' }
      ]
    }
  ];

  const socialLinks = [
    { name: 'Facebook', icon: 'Facebook', href: 'https://facebook.com/consultabid' },
    { name: 'Instagram', icon: 'Instagram', href: 'https://instagram.com/consultabid' },
    { name: 'Linkedin', icon: 'Linkedin', href: 'https://linkedin.com/company/consultabid' }
  ];

  const handleNavigation = (href) => {
    if (href?.startsWith('#')) {
      const element = document.querySelector(href);
      if (element) {
        element?.scrollIntoView({ behavior: 'smooth' });
      }
    } else if (href?.startsWith('http')) {
      window.open(href, '_blank', 'noopener noreferrer');
    } else {
      navigate(href);
    }
  };

  const handleNewsletterSubmit = async (e) => {
    e?.preventDefault();

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || !emailRegex.test(email)) {
      setSubscribeStatus('error');
      return;
    }

    setIsSubmitting(true);

    try {
      // TODO: Replace with actual API call to subscribe endpoint
      // await api.post('/api/newsletter/subscribe', { email });

      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));

      setSubscribeStatus('success');
      setEmail('');

      // Reset success message after 5 seconds
      setTimeout(() => {
        setSubscribeStatus(null);
      }, 5000);
    } catch (error) {
      console.error('Newsletter subscription error:', error);
      setSubscribeStatus('error');

      // Reset error message after 5 seconds
      setTimeout(() => {
        setSubscribeStatus(null);
      }, 5000);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      {/* Newsletter Section (separated from footer) */}
      <section className="bg-gray-900 text-white border-b border-gray-800">
        <div className="container mx-auto px-4 lg:px-6 py-10">
          <div className="max-w-3xl mx-auto text-center">
            <div className="flex items-center justify-center mb-4">
              <Icon name="Mail" size={24} className="text-primary mr-2" />
              <h3 className="text-xl font-semibold text-white">Subscribe to Our Newsletter</h3>
            </div>
            <p className="text-gray-400 text-sm mb-6">
              Get the latest updates, tips, and exclusive offers delivered straight to your inbox.
            </p>

            <form
              onSubmit={handleNewsletterSubmit}
              className="flex flex-col sm:flex-row gap-3 max-w-2xl mx-auto justify-center sm:items-center"
            >
              <Input
                type="email"
                placeholder="Enter your email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="flex-1 bg-gray-800 border-gray-700 text-white placeholder:text-gray-500 focus:border-primary"
                disabled={isSubmitting}
              />
              <Button
                type="submit"
                variant="default"
                size="default"
                loading={isSubmitting}
                disabled={isSubmitting}
                className="sm:w-auto"
              >
                Subscribe
              </Button>
            </form>

            {/* Status Messages */}
            {subscribeStatus === 'success' && (
              <div className="mt-4 p-3 bg-green-900/30 border border-green-700 rounded-lg text-green-400 text-sm">
                <Icon name="CheckCircle" size={16} className="inline mr-2" />
                Thank you for subscribing! Check your inbox for confirmation.
              </div>
            )}
            {subscribeStatus === 'error' && (
              <div className="mt-4 p-3 bg-red-900/30 border border-red-700 rounded-lg text-red-400 text-sm">
                <Icon name="AlertCircle" size={16} className="inline mr-2" />
                Please enter a valid email address.
              </div>
            )}
          </div>
        </div>
      </section>

      <footer className="bg-gray-900 text-white">
        <div className="container mx-auto px-4 lg:px-6">
          {/* Main Footer Content */}
          <div className="py-16 lg:py-20">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-8 lg:gap-12">
              {/* Company Info */}
              <div className="lg:col-span-2">
                <div className="flex items-center space-x-3 mb-6">
                  <div className="flex items-center justify-center w-14 h-14 bg-white rounded-lg">
                    <img src="/logo.png" alt="Consultabid Logo" className="w-12 h-12 object-contain" />
                  </div>
                  <span className="text-2xl font-bold">Consultabid</span>
                </div>

                <p className="text-gray-400 mb-6 leading-relaxed">
                  Fast, Affordable Home Repair Estimates. Turning your home inspection report into clear, reliable repair cost insights. Serving Houston and nearby areas.
                </p>

                {/* Contact Info */}
                <div className="space-y-2 mb-6 text-sm text-gray-400">
                  <div className="flex items-center space-x-2">
                    <Icon name="Mail" size={16} />
                    <a href="mailto:support@consultabid.com" className="hover:text-white transition-smooth">
                      support@consultabid.com
                    </a>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Icon name="Phone" size={16} />
                    <span>+1 (xxx) xxx-xxxx</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Icon name="MapPin" size={16} />
                    <span>Houston, Texas</span>
                  </div>
                </div>

                {/* Social Links */}
                <div>
                  <p className="text-sm text-gray-400 mb-3">Stay Connected</p>
                  <p className="text-xs text-gray-500 mb-3">Follow us for updates, guides, and tips:</p>
                  <div className="flex items-center space-x-4">
                    {socialLinks?.map((social) => (
                      <button
                        key={social?.name}
                        onClick={() => handleNavigation(social?.href)}
                        className="w-10 h-10 bg-gray-800 hover:bg-primary rounded-lg flex items-center justify-center transition-smooth"
                        aria-label={social?.name}
                      >
                        <Icon name={social?.icon} size={20} />
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Footer Links */}
              {footerSections?.map((section) => (
                <div key={section?.title} className="lg:col-span-1">
                  <h3 className="font-semibold text-white mb-4">
                    {section?.title}
                  </h3>
                  <ul className="space-y-3">
                    {section?.links?.map((link) => (
                      <li key={link?.label}>
                        <button
                          onClick={() => handleNavigation(link?.href)}
                          className="text-gray-400 hover:text-white transition-smooth text-left text-sm"
                        >
                          {link?.label}
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>

          {/* Bottom Footer */}
          <div className="py-6 border-t border-gray-800">
            <div className="flex flex-col items-center justify-center space-y-2 text-center">
              <div className="text-gray-400 text-sm">© {currentYear} Consultabid. All rights reserved.</div>
              <div className="text-gray-500 text-xs">Clarity. Confidence. Better decisions.</div>
            </div>
          </div>
        </div>
      </footer>
    </>
  );
};

export default Footer;
