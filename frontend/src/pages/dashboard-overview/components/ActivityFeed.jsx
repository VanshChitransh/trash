import React from 'react';
import Icon from '../../../components/AppIcon';

const ActivityFeed = ({ activities, onViewActivity }) => {
  const getActivityIcon = (type) => {
    const icons = {
      'upload': 'Upload',
      'processing': 'Loader',
      'completed': 'CheckCircle',
      'estimate': 'Calculator',
      'payment': 'CreditCard',
      'error': 'AlertCircle'
    };
    return icons?.[type] || 'Bell';
  };

  const getActivityColor = (type) => {
    const colors = {
      'upload': 'text-blue-600 bg-blue-100',
      'processing': 'text-amber-600 bg-amber-100',
      'completed': 'text-emerald-600 bg-emerald-100',
      'estimate': 'text-purple-600 bg-purple-100',
      'payment': 'text-green-600 bg-green-100',
      'error': 'text-red-600 bg-red-100'
    };
    return colors?.[type] || 'text-gray-600 bg-gray-100';
  };

  const formatTimeAgo = (timestamp) => {
    const now = new Date();
    const time = new Date(timestamp);
    const diffInMinutes = Math.floor((now - time) / (1000 * 60));
    
    if (diffInMinutes < 1) return 'Just now';
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
    if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)}h ago`;
    return `${Math.floor(diffInMinutes / 1440)}d ago`;
  };

  return (
    <div className="bg-card border border-border rounded-lg shadow-subtle">
      <div className="p-6 border-b border-border">
        <h2 className="text-lg font-semibold text-foreground">Recent Activity</h2>
        <p className="text-sm text-muted-foreground mt-1">Your latest actions and updates</p>
      </div>
      <div className="p-6">
        {activities?.length === 0 ? (
          <div className="text-center py-8">
            <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
              <Icon name="Activity" size={24} className="text-muted-foreground" />
            </div>
            <h3 className="text-lg font-medium text-foreground mb-2">No recent activity</h3>
            <p className="text-muted-foreground">Your activity will appear here once you start using the platform</p>
          </div>
        ) : (
          <div className="space-y-4 max-h-96 overflow-y-auto">
            {activities?.map((activity) => (
              <div key={activity?.id} className="flex items-start space-x-3">
                <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${getActivityColor(activity?.type)}`}>
                  <Icon name={getActivityIcon(activity?.type)} size={16} />
                </div>
                
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-foreground">
                    <span className="font-medium">{activity?.title}</span>
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {activity?.description}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {formatTimeAgo(activity?.timestamp)}
                  </p>
                </div>
                
                {activity?.actionable && (
                  <button 
                    className="flex-shrink-0 text-primary hover:text-primary/80 transition-smooth"
                    onClick={() => onViewActivity?.(activity)}
                    title="View file"
                  >
                    <Icon name="ExternalLink" size={16} />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default ActivityFeed;