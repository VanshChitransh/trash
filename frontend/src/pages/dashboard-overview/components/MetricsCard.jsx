import React from 'react';
import Icon from '../../../components/AppIcon';

const MetricsCard = ({ title, value, change, changeType, icon, color = "primary" }) => {
  const getColorClasses = (color) => {
    const colors = {
      primary: "bg-primary/10 text-primary",
      success: "bg-emerald-100 text-emerald-600",
      warning: "bg-amber-100 text-amber-600",
      error: "bg-red-100 text-red-600"
    };
    return colors?.[color] || colors?.primary;
  };

  const getChangeColor = (type) => {
    return type === 'positive' ? 'text-emerald-600' : type === 'negative' ? 'text-red-600' : 'text-gray-500';
  };

  return (
    <div className="bg-card border border-border rounded-lg p-6 shadow-subtle hover:shadow-moderate transition-smooth">
      <div className="flex items-center justify-between mb-4">
        <div className={`p-3 rounded-lg ${getColorClasses(color)}`}>
          <Icon name={icon} size={24} />
        </div>
        {change && (
          <div className={`flex items-center space-x-1 ${getChangeColor(changeType)}`}>
            <Icon 
              name={changeType === 'positive' ? 'TrendingUp' : changeType === 'negative' ? 'TrendingDown' : 'Minus'} 
              size={16} 
            />
            <span className="text-sm font-medium">{change}</span>
          </div>
        )}
      </div>
      <div>
        <h3 className="text-2xl font-bold text-foreground mb-1">{value}</h3>
        <p className="text-sm text-muted-foreground">{title}</p>
      </div>
    </div>
  );
};

export default MetricsCard;