import React from 'react';
import Icon from '../../../components/AppIcon';
import Button from '../../../components/ui/Button';

const RecentUploadsCard = ({ files, onViewAll, onUploadNew, onViewFile }) => {
  const getStatusColor = (status) => {
    const colors = {
      'completed': 'text-emerald-600 bg-emerald-100',
      'processing': 'text-amber-600 bg-amber-100',
      'failed': 'text-red-600 bg-red-100',
      'pending': 'text-gray-600 bg-gray-100'
    };
    return colors?.[status] || colors?.pending;
  };

  const getStatusIcon = (status) => {
    const icons = {
      'completed': 'CheckCircle',
      'processing': 'Clock',
      'failed': 'XCircle',
      'pending': 'Clock'
    };
    return icons?.[status] || 'Clock';
  };

  return (
    <div className="bg-card border border-border rounded-lg shadow-subtle">
      <div className="p-6 border-b border-border">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-foreground">Recent Uploads</h2>
          <Button variant="outline" size="sm" onClick={onViewAll}>
            View All
          </Button>
        </div>
      </div>
      <div className="p-6">
        {files?.length === 0 ? (
          <div className="text-center py-8">
            <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
              <Icon name="FileText" size={24} className="text-muted-foreground" />
            </div>
            <h3 className="text-lg font-medium text-foreground mb-2">No files uploaded yet</h3>
            <p className="text-muted-foreground mb-4">Upload your first inspection report to get started</p>
            <Button onClick={onUploadNew} iconName="Upload" iconPosition="left">
              Upload Report
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {files?.map((file) => (
              <div key={file?.id} className="flex items-center space-x-4 p-4 border border-border rounded-lg hover:bg-muted/50 transition-smooth">
                <div className="flex-shrink-0">
                  <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center">
                    <Icon name="FileText" size={20} className="text-primary" />
                  </div>
                </div>
                
                <div className="flex-1 min-w-0">
                  <h4 className="text-sm font-medium text-foreground truncate">{file?.name}</h4>
                  <p className="text-xs text-muted-foreground">{file?.uploadDate}</p>
                </div>
                
                <div className="flex items-center space-x-2">
                  <span className={`inline-flex items-center space-x-1 px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(file?.status)}`}>
                    <Icon name={getStatusIcon(file?.status)} size={12} />
                    <span className="capitalize">{file?.status}</span>
                  </span>
                  
                  {file?.status === 'completed' && (
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      iconName="Eye"
                      onClick={() => onViewFile?.(file.id)}
                    >
                      View
                    </Button>
                  )}
                </div>
              </div>
            ))}
            
            {files?.length > 0 && (
              <div className="pt-4 border-t border-border">
                <Button 
                  variant="outline" 
                  fullWidth 
                  onClick={onUploadNew}
                  iconName="Plus" 
                  iconPosition="left"
                >
                  Upload Another Report
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default RecentUploadsCard;