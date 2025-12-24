import React, { useState } from 'react';
import Icon from '../../../components/AppIcon';
import Button from '../../../components/ui/Button';

const PriorityRecommendations = ({ recommendations }) => {
  const [selectedTimeframe, setSelectedTimeframe] = useState('immediate');

  const mockRecommendations = [
    {
      id: 1,
      title: 'Address Water Line Leak Immediately',
      priority: 'Critical',
      urgency: 'Immediate',
      timeframe: 'immediate',
      cost: 2800,
      timeline: '1-2 days',
      impact: 'Prevents water damage and mold growth',
      consequences: 'Continued water damage, potential structural issues, mold growth',
      steps: [
        'Shut off main water supply',
        'Contact licensed plumber',
        'Document damage for insurance',
        'Monitor for additional leaks'
      ],
      seasonalNote: 'Can be done any time of year',
      budgetTip: 'Get multiple quotes to ensure fair pricing',
      diyPossible: false,
      estimatedSavings: 0
    },
    {
      id: 2,
      title: 'Upgrade Electrical Panel',
      priority: 'High',
      urgency: 'Within 30 days',
      timeframe: 'short',
      cost: 3200,
      timeline: '2-3 days',
      impact: 'Improves electrical safety and capacity',
      consequences: 'Risk of electrical fires, code violations, insurance issues',
      steps: [
        'Schedule electrical inspection',
        'Obtain necessary permits',
        'Hire certified electrician',
        'Update home insurance'
      ],
      seasonalNote: 'Best done in mild weather',
      budgetTip: 'May qualify for energy efficiency rebates',
      diyPossible: false,
      estimatedSavings: 0
    },
    {
      id: 3,
      title: 'Replace Damaged Roof Shingles',
      priority: 'Medium',
      urgency: 'Within 60 days',
      timeframe: 'medium',
      cost: 4200,
      timeline: '3-5 days',
      impact: 'Prevents water infiltration and interior damage',
      consequences: 'Water leaks, interior damage, higher repair costs',
      steps: [
        'Inspect entire roof system',
        'Order matching shingles',
        'Schedule during dry weather',
        'Consider full roof inspection'
      ],
      seasonalNote: 'Best done in spring or summer',
      budgetTip: 'Consider bundling with gutter cleaning',
      diyPossible: true,
      estimatedSavings: 1500
    },
    {
      id: 4,
      title: 'Seal Foundation Cracks',
      priority: 'High',
      urgency: 'Within 45 days',
      timeframe: 'short',
      cost: 1800,
      timeline: '1-2 days',
      impact: 'Prevents water intrusion and structural issues',
      consequences: 'Water damage, foundation deterioration, basement flooding',
      steps: [
        'Monitor cracks for growth',
        'Ensure proper drainage',
        'Apply professional sealant',
        'Install moisture monitoring'
      ],
      seasonalNote: 'Best done in spring or fall',
      budgetTip: 'Address before winter freeze-thaw cycles',
      diyPossible: false,
      estimatedSavings: 0
    },
    {
      id: 5,
      title: 'Regular HVAC Maintenance',
      priority: 'Low',
      urgency: 'Within 90 days',
      timeframe: 'long',
      cost: 150,
      timeline: '1 hour',
      impact: 'Maintains system efficiency and air quality',
      consequences: 'Reduced efficiency, higher energy bills, system failure',
      steps: [
        'Replace air filters',
        'Clean vents and ducts',
        'Schedule professional tune-up',
        'Check thermostat settings'
      ],
      seasonalNote: 'Best done before heating/cooling seasons',
      budgetTip: 'Regular maintenance prevents costly repairs',
      diyPossible: true,
      estimatedSavings: 50
    }
  ];

  const timeframes = [
    { id: 'immediate', label: 'Immediate (0-7 days)', color: 'error' },
    { id: 'short', label: 'Short-term (1-3 months)', color: 'warning' },
    { id: 'medium', label: 'Medium-term (3-6 months)', color: 'accent' },
    { id: 'long', label: 'Long-term (6+ months)', color: 'primary' }
  ];

  const priorityConfig = {
    'Critical': { color: 'error', icon: 'AlertTriangle', bgColor: 'bg-error/10' },
    'High': { color: 'warning', icon: 'AlertCircle', bgColor: 'bg-warning/10' },
    'Medium': { color: 'accent', icon: 'Info', bgColor: 'bg-accent/10' },
    'Low': { color: 'primary', icon: 'CheckCircle', bgColor: 'bg-primary/10' }
  };

  const filteredRecommendations = mockRecommendations?.filter(rec => 
    selectedTimeframe === 'all' || rec?.timeframe === selectedTimeframe
  );

  const getTotalCostForTimeframe = () => {
    return filteredRecommendations?.reduce((total, rec) => total + rec?.cost, 0);
  };

  const getTotalSavings = () => {
    return filteredRecommendations?.reduce((total, rec) => total + rec?.estimatedSavings, 0);
  };

  return (
    <div className="space-y-6">
      {/* Timeframe Filter */}
      <div className="bg-card border border-border rounded-lg p-6">
        <h2 className="text-xl font-semibold text-foreground mb-4">Priority Timeline</h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-4">
          {timeframes?.map((timeframe) => (
            <button
              key={timeframe?.id}
              onClick={() => setSelectedTimeframe(timeframe?.id)}
              className={`p-3 rounded-lg border transition-smooth text-left ${
                selectedTimeframe === timeframe?.id
                  ? `border-${timeframe?.color} bg-${timeframe?.color}/10 text-${timeframe?.color}`
                  : 'border-border hover:border-primary/50 text-muted-foreground'
              }`}
            >
              <div className="font-medium text-sm">{timeframe?.label}</div>
              <div className="text-xs opacity-80">
                {mockRecommendations?.filter(r => r?.timeframe === timeframe?.id)?.length} items
              </div>
            </button>
          ))}
        </div>
        
        <div className="flex items-center justify-between p-4 bg-muted/30 rounded-lg">
          <div>
            <p className="text-sm text-muted-foreground">Total cost for selected timeframe</p>
            <p className="text-xl font-semibold text-foreground">${getTotalCostForTimeframe()?.toLocaleString()}</p>
          </div>
          {getTotalSavings() > 0 && (
            <div className="text-right">
              <p className="text-sm text-muted-foreground">Potential DIY savings</p>
              <p className="text-lg font-semibold text-accent">${getTotalSavings()?.toLocaleString()}</p>
            </div>
          )}
        </div>
      </div>
      {/* Recommendations List */}
      <div className="space-y-4">
        {filteredRecommendations?.map((rec) => {
          const config = priorityConfig?.[rec?.priority];
          
          return (
            <div key={rec?.id} className={`bg-card border border-border rounded-lg overflow-hidden ${config?.bgColor}`}>
              <div className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-start space-x-3 flex-1">
                    <div className={`p-2 rounded-lg bg-${config?.color}/20`}>
                      <Icon name={config?.icon} size={20} className={`text-${config?.color}`} />
                    </div>
                    
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-2">
                        <h3 className="font-semibold text-foreground">{rec?.title}</h3>
                        <span className={`px-2 py-1 text-xs rounded-full bg-${config?.color}/20 text-${config?.color}`}>
                          {rec?.priority}
                        </span>
                        {rec?.diyPossible && (
                          <span className="px-2 py-1 text-xs bg-accent/20 text-accent rounded-full">
                            DIY Possible
                          </span>
                        )}
                      </div>
                      
                      <p className="text-muted-foreground mb-3">{rec?.impact}</p>
                      
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                        <div className="flex items-center space-x-2">
                          <Icon name="Clock" size={14} className="text-muted-foreground" />
                          <span className="text-muted-foreground">Timeline: {rec?.timeline}</span>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Icon name="AlertCircle" size={14} className="text-muted-foreground" />
                          <span className="text-muted-foreground">Urgency: {rec?.urgency}</span>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Icon name="Calendar" size={14} className="text-muted-foreground" />
                          <span className="text-muted-foreground">{rec?.seasonalNote}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="text-right">
                    <p className="text-xl font-semibold text-foreground">${rec?.cost?.toLocaleString()}</p>
                    {rec?.estimatedSavings > 0 && (
                      <p className="text-sm text-accent">Save ${rec?.estimatedSavings?.toLocaleString()} DIY</p>
                    )}
                  </div>
                </div>

                {/* Consequences Warning */}
                <div className="bg-error/5 border border-error/20 rounded-lg p-4 mb-4">
                  <div className="flex items-start space-x-2">
                    <Icon name="AlertTriangle" size={16} className="text-error mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-error mb-1">If not addressed:</p>
                      <p className="text-sm text-muted-foreground">{rec?.consequences}</p>
                    </div>
                  </div>
                </div>

                {/* Action Steps */}
                <div className="mb-4">
                  <h4 className="font-medium text-foreground mb-2">Recommended Steps:</h4>
                  <ol className="space-y-1">
                    {rec?.steps?.map((step, index) => (
                      <li key={index} className="flex items-start space-x-2 text-sm text-muted-foreground">
                        <span className="flex items-center justify-center w-5 h-5 bg-primary/20 text-primary rounded-full text-xs font-medium mt-0.5">
                          {index + 1}
                        </span>
                        <span>{step}</span>
                      </li>
                    ))}
                  </ol>
                </div>

                {/* Budget Tip */}
                <div className="bg-accent/5 border border-accent/20 rounded-lg p-3 mb-4">
                  <div className="flex items-start space-x-2">
                    <Icon name="Lightbulb" size={16} className="text-accent mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-accent mb-1">Budget Tip:</p>
                      <p className="text-sm text-muted-foreground">{rec?.budgetTip}</p>
                    </div>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex flex-wrap gap-2">
                  <Button variant="default" size="sm" iconName="Calendar">
                    Schedule
                  </Button>
                  <Button variant="outline" size="sm" iconName="Users">
                    Find Contractors
                  </Button>
                  <Button variant="ghost" size="sm" iconName="Download">
                    Get Quote
                  </Button>
                  {rec?.diyPossible && (
                    <Button variant="ghost" size="sm" iconName="Wrench">
                      DIY Guide
                    </Button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
      {filteredRecommendations?.length === 0 && (
        <div className="text-center py-8">
          <Icon name="CheckCircle" size={48} className="text-accent mx-auto mb-4" />
          <p className="text-foreground font-medium mb-2">No items in this timeframe</p>
          <p className="text-muted-foreground">Select a different timeframe to view recommendations</p>
        </div>
      )}
      {/* Summary Actions */}
      <div className="bg-card border border-border rounded-lg p-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between space-y-4 md:space-y-0">
          <div>
            <h3 className="font-semibold text-foreground mb-1">Ready to get started?</h3>
            <p className="text-muted-foreground">Create a comprehensive action plan for your repairs</p>
          </div>
          <div className="flex space-x-3">
            <Button variant="outline" iconName="Download">
              Export Plan
            </Button>
            <Button variant="default" iconName="Calendar">
              Create Schedule
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PriorityRecommendations;