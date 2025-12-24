import React from 'react';
import Icon from '../../../components/AppIcon';


const QuickActionsCard = ({ onUploadFile, onViewEstimates, onGetHelp }) => {
  const quickActions = [
    {
      id: 'upload',
      title: 'Upload Report',
      description: 'Upload a new inspection report for analysis',
      icon: 'Upload',
      color: 'primary',
      action: onUploadFile
    },
    {
      id: 'estimates',
      title: 'View Estimates',
      description: 'Review your generated cost estimates',
      icon: 'Calculator',
      color: 'success',
      action: onViewEstimates
    },
    {
      id: 'help',
      title: 'Get Help',
      description: 'Access help center and support',
      icon: 'HelpCircle',
      color: 'warning',
      action: onGetHelp
    }
  ];

  const getColorClasses = (color) => {
    const colors = {
      primary: "bg-primary/10 text-primary hover:bg-primary/20",
      success: "bg-emerald-100 text-emerald-600 hover:bg-emerald-200",
      warning: "bg-amber-100 text-amber-600 hover:bg-amber-200",
      error: "bg-red-100 text-red-600 hover:bg-red-200"
    };
    return colors?.[color] || colors?.primary;
  };

  return (
    <div className="bg-card border border-border rounded-lg shadow-subtle">
      <div className="p-6 border-b border-border">
        <h2 className="text-lg font-semibold text-foreground">Quick Actions</h2>
        <p className="text-sm text-muted-foreground mt-1">Common tasks and shortcuts</p>
      </div>
      <div className="p-6">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {quickActions?.map((action) => (
            <button
              key={action?.id}
              onClick={action?.action}
              disabled={action?.id === 'help'}
              className={`p-4 border border-border rounded-lg hover:shadow-moderate transition-smooth text-left group ${
                action?.id === 'help' ? 'opacity-50 cursor-not-allowed' : ''
              }`}
            >
              <div className={`w-12 h-12 rounded-lg flex items-center justify-center mb-3 transition-smooth ${getColorClasses(action?.color)}`}>
                <Icon name={action?.icon} size={24} />
              </div>
              <h3 className="text-sm font-semibold text-foreground mb-1 group-hover:text-primary transition-smooth">
                {action?.title}
              </h3>
              <p className="text-xs text-muted-foreground">
                {action?.description}
              </p>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default QuickActionsCard;