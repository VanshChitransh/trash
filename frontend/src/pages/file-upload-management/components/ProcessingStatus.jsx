import React from 'react';
import Icon from '../../../components/AppIcon';

const ProcessingStatus = ({ files = [] }) => {
  const getStatusCounts = () => {
    const counts = {
      pending: 0,
      processing: 0,
      completed: 0,
      failed: 0
    };

    files?.forEach(file => {
      // Only count actual processing/pending files, not completed ones
      // Completed files should not show as processing
      if (file.status === 'completed' || file.status === 'failed') {
        counts[file.status] = (counts?.[file?.status] || 0) + 1;
      } else if (file.status === 'processing' || file.status === 'pending') {
        // Only show processing if file is actually not completed yet
        if (file.progress !== undefined && file.progress < 100) {
          counts[file.status] = (counts?.[file?.status] || 0) + 1;
        } else {
          // If progress is 100, it's actually completed
          counts.completed = (counts.completed || 0) + 1;
        }
      } else {
        // Default to completed for unknown statuses
        counts.completed = (counts.completed || 0) + 1;
      }
    });

    return counts;
  };

  const statusCounts = getStatusCounts();
  const totalFiles = files?.length;

  if (totalFiles === 0) return null;

  const statusItems = [
    {
      key: 'completed',
      label: 'Completed',
      count: statusCounts?.completed,
      icon: 'CheckCircle',
      color: 'text-success',
      bgColor: 'bg-success/10'
    },
    {
      key: 'processing',
      label: 'Processing',
      count: statusCounts?.processing,
      icon: 'Loader2',
      color: 'text-warning',
      bgColor: 'bg-warning/10',
      animate: true
    },
    {
      key: 'pending',
      label: 'Pending',
      count: statusCounts?.pending,
      icon: 'Clock',
      color: 'text-muted-foreground',
      bgColor: 'bg-muted'
    },
    {
      key: 'failed',
      label: 'Failed',
      count: statusCounts?.failed,
      icon: 'XCircle',
      color: 'text-destructive',
      bgColor: 'bg-destructive/10'
    }
  ];

  const completionPercentage = totalFiles > 0 ? Math.round((statusCounts?.completed / totalFiles) * 100) : 0;

  return (
    <div className="bg-card border border-border rounded-lg p-4 lg:p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-foreground">Processing Status</h3>
        <div className="text-sm text-muted-foreground">
          {statusCounts?.completed} of {totalFiles} completed
        </div>
      </div>
      {/* Overall Progress */}
      <div className="mb-6">
        <div className="flex justify-between text-sm text-muted-foreground mb-2">
          <span>Overall Progress</span>
          <span>{completionPercentage}%</span>
        </div>
        <div className="w-full bg-muted rounded-full h-3">
          <div 
            className="bg-primary h-3 rounded-full transition-all duration-500 ease-out"
            style={{ width: `${completionPercentage}%` }}
          />
        </div>
      </div>
      {/* Status Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statusItems?.map((item) => (
          <div
            key={item?.key}
            className={`${item?.bgColor} rounded-lg p-4 text-center transition-all duration-200 hover:scale-105`}
          >
            <div className={`w-8 h-8 mx-auto mb-2 flex items-center justify-center ${item?.color}`}>
              <Icon 
                name={item?.icon} 
                size={20} 
                className={item?.animate && item?.count > 0 ? 'animate-spin' : ''} 
              />
            </div>
            <div className="text-2xl font-bold text-foreground mb-1">
              {item?.count}
            </div>
            <div className="text-xs text-muted-foreground font-medium">
              {item?.label}
            </div>
          </div>
        ))}
      </div>
      {/* Active Processing Indicator */}
      {statusCounts?.processing > 0 && (
        <div className="mt-4 p-3 bg-warning/10 border border-warning/20 rounded-lg">
          <div className="flex items-center space-x-2">
            <Icon name="Loader2" size={16} className="text-warning animate-spin" />
            <span className="text-sm font-medium text-warning">
              {statusCounts?.processing} file{statusCounts?.processing !== 1 ? 's' : ''} currently processing
            </span>
          </div>
          <div className="text-xs text-muted-foreground mt-1">
            Processing typically takes 2-5 minutes per file
          </div>
        </div>
      )}
      {/* Failed Files Alert */}
      {statusCounts?.failed > 0 && (
        <div className="mt-4 p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
          <div className="flex items-center space-x-2">
            <Icon name="AlertTriangle" size={16} className="text-destructive" />
            <span className="text-sm font-medium text-destructive">
              {statusCounts?.failed} file{statusCounts?.failed !== 1 ? 's' : ''} failed to process
            </span>
          </div>
          <div className="text-xs text-muted-foreground mt-1">
            Check file format and try uploading again
          </div>
        </div>
      )}
    </div>
  );
};

export default ProcessingStatus;