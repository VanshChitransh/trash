import React from 'react';
import Icon from '../../../components/AppIcon';

const ProcessingIndicator = ({ currentStep, totalSteps, stepName, progress }) => {
  const steps = [
    { name: 'Analyzing Document', icon: 'FileText' },
    { name: 'Identifying Issues', icon: 'Search' },
    { name: 'Calculating Costs', icon: 'Calculator' },
    { name: 'Generating Report', icon: 'FileCheck' }
  ];

  return (
    <div className="bg-card rounded-lg border border-border p-6">
      <div className="text-center mb-6">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-primary/10 rounded-full mb-4">
          <Icon name="Loader2" size={32} className="text-primary animate-spin" />
        </div>
        <h2 className="text-xl font-semibold text-foreground mb-2">Analyzing Your Report</h2>
        <p className="text-muted-foreground">We are processing your inspection report to generate accurate estimates</p>
      </div>
      <div className="mb-6">
        <div className="flex justify-between text-sm text-muted-foreground mb-2">
          <span>{stepName}</span>
          <span>{Math.round(progress)}%</span>
        </div>
        <div className="w-full bg-muted rounded-full h-2">
          <div 
            className="bg-primary h-2 rounded-full transition-all duration-300"
            style={{ width: `${progress}%` }}
          ></div>
        </div>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {steps?.map((step, index) => (
          <div
            key={index}
            className={`flex flex-col items-center p-3 rounded-lg transition-smooth ${
              index < currentStep
                ? 'bg-accent/10 text-accent'
                : index === currentStep
                ? 'bg-primary/10 text-primary' :'bg-muted/50 text-muted-foreground'
            }`}
          >
            <div className={`p-2 rounded-full mb-2 ${
              index < currentStep
                ? 'bg-accent text-accent-foreground'
                : index === currentStep
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted'
            }`}>
              {index < currentStep ? (
                <Icon name="Check" size={16} />
              ) : (
                <Icon name={step?.icon} size={16} />
              )}
            </div>
            <span className="text-xs text-center font-medium">{step?.name}</span>
          </div>
        ))}
      </div>
      <div className="mt-6 p-4 bg-muted/50 rounded-lg">
        <div className="flex items-center space-x-2 text-sm text-muted-foreground">
          <Icon name="Info" size={16} />
          <span>This process typically takes 2-3 minutes depending on report complexity</span>
        </div>
      </div>
    </div>
  );
};

export default ProcessingIndicator;