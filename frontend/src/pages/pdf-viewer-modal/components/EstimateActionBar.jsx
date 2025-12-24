import React from 'react';
import { useNavigate } from 'react-router-dom';
import Icon from '../../../components/AppIcon';
import Button from '../../../components/ui/Button';

const EstimateActionBar = ({ 
  fileName = "inspection-report.pdf",
  onGenerateEstimate,
  isGenerating = false 
}) => {
  const navigate = useNavigate();

  const handleGenerateEstimate = () => {
    if (onGenerateEstimate) {
      onGenerateEstimate();
    } else {
      // Default navigation to estimate generation
      navigate('/estimate-generation-results');
    }
  };

  return (
    <div className="bg-card border-t border-border p-4">
      <div className="max-w-4xl mx-auto">
        {/* Mobile Layout */}
        <div className="lg:hidden space-y-3">
          <div className="text-center">
            <h3 className="text-sm font-medium text-foreground">
              Ready to generate estimate?
            </h3>
            <p className="text-xs text-muted-foreground mt-1">
              Get detailed repair costs and recommendations
            </p>
          </div>
          
          <div className="space-y-2">
            <Button
              variant="default"
              size="lg"
              fullWidth
              iconName="Calculator"
              iconPosition="left"
              loading={isGenerating}
              onClick={handleGenerateEstimate}
            >
              {isGenerating ? 'Generating...' : 'Generate Estimate'}
            </Button>
            
            <div className="grid grid-cols-2 gap-2">
              <Button
                variant="outline"
                size="sm"
                iconName="Eye"
                iconPosition="left"
              >
                Quick Preview
              </Button>
              <Button
                variant="outline"
                size="sm"
                iconName="Settings"
                iconPosition="left"
              >
                Options
              </Button>
            </div>
          </div>
        </div>

        {/* Desktop Layout */}
        <div className="hidden lg:flex items-center justify-between">
          {/* Left Section - Document Info */}
          <div className="flex items-center space-x-4">
            <div className="flex items-center justify-center w-10 h-10 bg-primary/10 rounded-lg">
              <Icon name="FileText" size={20} className="text-primary" />
            </div>
            <div>
              <h3 className="text-sm font-medium text-foreground">
                {fileName}
              </h3>
              <p className="text-xs text-muted-foreground">
                Ready for estimate generation
              </p>
            </div>
          </div>

          {/* Center Section - Quick Stats */}
          <div className="flex items-center space-x-6">
            <div className="text-center">
              <p className="text-lg font-semibold text-foreground">12</p>
              <p className="text-xs text-muted-foreground">Issues Found</p>
            </div>
            <div className="text-center">
              <p className="text-lg font-semibold text-foreground">5</p>
              <p className="text-xs text-muted-foreground">High Priority</p>
            </div>
            <div className="text-center">
              <p className="text-lg font-semibold text-foreground">3</p>
              <p className="text-xs text-muted-foreground">Systems</p>
            </div>
          </div>

          {/* Right Section - Actions */}
          <div className="flex items-center space-x-3">
            <Button
              variant="outline"
              size="sm"
              iconName="Eye"
              iconPosition="left"
            >
              Quick Preview
            </Button>
            
            <Button
              variant="outline"
              size="sm"
              iconName="Settings"
              iconPosition="left"
            >
              Options
            </Button>
            
            <Button
              variant="default"
              size="lg"
              iconName="Calculator"
              iconPosition="left"
              loading={isGenerating}
              onClick={handleGenerateEstimate}
            >
              {isGenerating ? 'Generating...' : 'Generate Estimate'}
            </Button>
          </div>
        </div>

        {/* Processing Indicator */}
        {isGenerating && (
          <div className="mt-4 p-3 bg-primary/5 border border-primary/20 rounded-lg">
            <div className="flex items-center space-x-3">
              <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
              <div className="flex-1">
                <p className="text-sm font-medium text-foreground">
                  Analyzing inspection report...
                </p>
                <p className="text-xs text-muted-foreground">
                  This may take a few moments while we process your document
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default EstimateActionBar;