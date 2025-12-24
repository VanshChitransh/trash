import React from 'react';
import { useNavigate } from 'react-router-dom';
import Icon from '../../../components/AppIcon';
import Button from '../../../components/ui/Button';

const FileItem = ({
  file,
  viewMode = 'list',
  isSelected = false,
  onSelect,
  onView,
  onDelete,
  onDownload,
  onEstimate,
  waitPeriod
}) => {
  const navigate = useNavigate();

  const handleEstimate = () => {
    if (onEstimate) {
      onEstimate(file);
      return;
    }
    navigate('/estimate-generation-results', {
      state: {
        file,
        autoLoadEstimate: !!file?.hasEstimate // Load the estimate when available
      }
    });
  };

  const handleViewEstimate = () => {
    // Navigate to estimate page to view the estimate
    navigate('/estimate-generation-results', {
      state: {
        file: file,
        autoLoadEstimate: true
      }
    });
  };
  const getStatusColor = (status) => {
    switch (status) {
      case 'completed':
        return 'bg-success text-success-foreground';
      case 'processing':
        return 'bg-warning text-warning-foreground';
      case 'failed':
        return 'bg-destructive text-destructive-foreground';
      case 'pending':
      default:
        return 'bg-muted text-muted-foreground';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'completed':
        return 'CheckCircle';
      case 'processing':
        return 'Loader2';
      case 'failed':
        return 'XCircle';
      case 'pending':
      default:
        return 'Clock';
    }
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i))?.toFixed(2)) + ' ' + sizes?.[i];
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date?.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (viewMode === 'grid') {
    return (
      <div className={`bg-card border border-border rounded-lg p-4 hover:shadow-moderate transition-all duration-200 overflow-hidden ${waitPeriod ? 'opacity-60' : 'opacity-100'}`}>
        <div className="flex items-start justify-between mb-3">
          <input
            type="checkbox"
            checked={isSelected}
            onChange={(e) => onSelect(e?.target?.checked)}
            className="rounded border-border mt-1"
          />
          {waitPeriod ? (
            <div className="flex items-center space-x-2 bg-orange-100 dark:bg-orange-900/20 text-orange-700 dark:text-orange-400 px-2 py-1 rounded-full text-xs font-medium">
              <Icon name="Clock" size={12} />
              <span>
                {String(waitPeriod.remainingHours).padStart(2, '0')}:
                {String(waitPeriod.remainingMinutes).padStart(2, '0')}:
                {String(waitPeriod.remainingSeconds).padStart(2, '0')}
              </span>
            </div>
          ) : (
            <div className={`px-2 py-1 rounded-full text-xs font-medium flex items-center space-x-1 ${getStatusColor(file?.status)}`}>
              <Icon
                name={getStatusIcon(file?.status)}
                size={12}
                className={file?.status === 'processing' ? 'animate-spin' : ''}
              />
              <span className="capitalize">{file?.status}</span>
            </div>
          )}
        </div>
        <div className="flex items-center space-x-3 mb-3">
          <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center flex-shrink-0">
            <Icon name="FileText" size={20} className="text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="font-medium text-foreground truncate" title={file?.name}>
              {file?.name}
            </h4>
            <p className="text-sm text-muted-foreground">
              {formatFileSize(file?.size)}
            </p>
          </div>
        </div>
        <div className="text-xs text-muted-foreground mb-4">
          Uploaded {formatDate(file?.uploadDate)}
        </div>
        {file?.progress !== undefined && file?.progress < 100 && (
          <div className="mb-4">
            <div className="flex justify-between text-xs text-muted-foreground mb-1">
              <span>Uploading...</span>
              <span>{file?.progress}%</span>
            </div>
            <div className="w-full bg-muted rounded-full h-2">
              <div 
                className="bg-primary h-2 rounded-full transition-all duration-300"
                style={{ width: `${file?.progress}%` }}
              />
            </div>
          </div>
        )}
        <div className="flex items-center justify-between gap-2 overflow-hidden">
          <Button
            variant="outline"
            size="sm"
            iconName="Eye"
            onClick={onView}
            disabled={file?.status !== 'completed'}
            className="flex-shrink-0"
          >
            View
          </Button>

          <div className="flex items-center gap-1 flex-shrink-0">
            {waitPeriod ? (
              <div className="relative group">
                <Button
                  variant="outline"
                  size="sm"
                  iconName="Clock"
                  disabled={true}
                  className="flex-shrink-0 cursor-not-allowed opacity-50"
                >
                  Processing
                </Button>
                {/* Tooltip */}
                <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 hidden group-hover:block z-50 whitespace-nowrap">
                  <div className="bg-gray-900 text-white text-xs rounded-lg py-2 px-3 shadow-lg">
                    Processing... {waitPeriod.remainingHours}h {waitPeriod.remainingMinutes}m left
                    <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900"></div>
                  </div>
                </div>
              </div>
            ) : file?.hasEstimate ? (
              <Button
                variant="default"
                size="sm"
                iconName="Eye"
                onClick={handleViewEstimate}
                className="flex-shrink-0"
              >
                View Estimate
              </Button>
            ) : (
              <Button
                variant="outline"
                size="sm"
                iconName="Calculator"
                onClick={handleEstimate}
                disabled={!!waitPeriod}
                className="flex-shrink-0"
              >
                Estimate
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              iconName="Download"
              onClick={onDownload}
              disabled={file?.status !== 'completed'}
              className="flex-shrink-0"
              title="Download"
            />
            <Button
              variant="ghost"
              size="sm"
              iconName="Trash2"
              onClick={onDelete}
              className="text-destructive hover:text-destructive flex-shrink-0"
              title="Delete"
            />
          </div>
        </div>
      </div>
    );
  }

  // List view
  return (
    <div className={`bg-card border border-border rounded-lg hover:shadow-subtle transition-all duration-200 ${waitPeriod ? 'opacity-60' : 'opacity-100'}`}>
      <div className="hidden lg:grid grid-cols-[32px_1fr_100px_100px_140px_140px] gap-4 items-center p-3 lg:p-4">
        <div className="flex items-center justify-center">
          <input
            type="checkbox"
            checked={isSelected}
            onChange={(e) => onSelect(e?.target?.checked)}
            className="rounded border-border"
          />
        </div>

        <div className="flex items-center space-x-3 min-w-0">
          <div className="w-8 h-8 bg-primary/10 rounded flex items-center justify-center flex-shrink-0">
            <Icon name="FileText" size={16} className="text-primary" />
          </div>
          <div className="flex items-center space-x-2 min-w-0">
            <h4 className="font-medium text-foreground truncate" title={file?.name}>
              {file?.name}
            </h4>
            {waitPeriod && (
              <div className="flex items-center space-x-1 bg-orange-100 dark:bg-orange-900/20 text-orange-700 dark:text-orange-400 px-2 py-0.5 rounded-full text-xs font-medium flex-shrink-0">
                <Icon name="Clock" size={12} />
                <span>
                  {String(waitPeriod.remainingHours).padStart(2, '0')}:
                  {String(waitPeriod.remainingMinutes).padStart(2, '0')}:
                  {String(waitPeriod.remainingSeconds).padStart(2, '0')}
                </span>
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center justify-center">
          {waitPeriod ? (
            <div className="flex items-center space-x-1 bg-orange-100 dark:bg-orange-900/20 text-orange-700 dark:text-orange-400 px-2 py-1 rounded-full text-xs font-medium">
              <Icon name="Clock" size={12} />
              <span>Processing</span>
            </div>
          ) : (
            <div className={`px-2 py-1 rounded-full text-xs font-medium flex items-center space-x-1 ${getStatusColor(file?.status)}`}>
              <Icon
                name={getStatusIcon(file?.status)}
                size={12}
                className={file?.status === 'processing' ? 'animate-spin' : ''}
              />
              <span className="capitalize">{file?.status}</span>
            </div>
          )}
        </div>
        
        <div className="flex items-center justify-center text-sm text-muted-foreground">
          {formatFileSize(file?.size)}
        </div>
        
        <div className="flex items-center justify-center text-sm text-muted-foreground">
          {formatDate(file?.uploadDate)}
        </div>
        
        <div className="flex items-center justify-center space-x-1">
          <Button
            variant="ghost"
            size="sm"
            iconName="Eye"
            onClick={onView}
            disabled={file?.status !== 'completed'}
            title="View"
          />
          {waitPeriod ? (
            <div className="relative group">
              <Button
                variant="ghost"
                size="sm"
                iconName="Clock"
                disabled={true}
                className="cursor-not-allowed opacity-50"
                title="Processing"
              />
              <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 hidden group-hover:block z-50 whitespace-nowrap">
                <div className="bg-gray-900 text-white text-xs rounded-lg py-2 px-3 shadow-lg">
                  Processing... {waitPeriod.remainingHours}h {waitPeriod.remainingMinutes}m left
                  <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900"></div>
                </div>
              </div>
            </div>
          ) : file?.hasEstimate ? (
            <Button
              variant="ghost"
              size="sm"
              iconName="FileText"
              onClick={handleViewEstimate}
              title="View Estimate"
            />
          ) : (
            <Button
              variant="ghost"
              size="sm"
              iconName="Calculator"
              onClick={handleEstimate}
              disabled={!!waitPeriod}
              title="Estimate"
            />
          )}
          <Button
            variant="ghost"
            size="sm"
            iconName="Download"
            onClick={onDownload}
            disabled={file?.status !== 'completed'}
            title="Download"
          />
          <Button
            variant="ghost"
            size="sm"
            iconName="Trash2"
            onClick={onDelete}
            className="text-destructive hover:text-destructive"
            title="Delete"
          />
        </div>
      </div>
      
      {/* Mobile view */}
      <div className="lg:hidden flex items-center p-3 lg:p-4">
        <div className="w-8 flex-shrink-0">
          <input
            type="checkbox"
            checked={isSelected}
            onChange={(e) => onSelect(e?.target?.checked)}
            className="rounded border-border"
          />
        </div>

        <div className="flex-1 min-w-0 flex items-center space-x-3">
          <div className="w-8 h-8 bg-primary/10 rounded flex items-center justify-center flex-shrink-0">
            <Icon name="FileText" size={16} className="text-primary" />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center space-x-2">
              <h4 className="font-medium text-foreground truncate" title={file?.name}>
                {file?.name}
              </h4>
              {waitPeriod && (
                <div className="flex items-center space-x-1 bg-orange-100 dark:bg-orange-900/20 text-orange-700 dark:text-orange-400 px-2 py-0.5 rounded-full text-xs font-medium flex-shrink-0">
                  <Icon name="Clock" size={10} />
                  <span className="text-[10px]">
                    {String(waitPeriod.remainingHours).padStart(2, '0')}:
                    {String(waitPeriod.remainingMinutes).padStart(2, '0')}
                  </span>
                </div>
              )}
            </div>
            <div className="flex items-center space-x-4 text-sm text-muted-foreground">
              <span>{formatFileSize(file?.size)}</span>
              <span>{formatDate(file?.uploadDate)}</span>
            </div>
          </div>
        </div>

        {/* Mobile Actions */}
        <div className="lg:hidden flex items-center space-x-1 ml-2">
          <Button
            variant="ghost"
            size="sm"
            iconName="Eye"
            onClick={onView}
            disabled={file?.status !== 'completed'}
            title="View"
          />
          {waitPeriod ? (
            <Button
              variant="ghost"
              size="sm"
              iconName="Clock"
              disabled={true}
              className="cursor-not-allowed opacity-50"
              title="Processing"
            />
          ) : file?.hasEstimate ? (
            <Button
              variant="ghost"
              size="sm"
              iconName="FileText"
              onClick={handleViewEstimate}
              title="View Estimate"
            />
          ) : (
            <Button
              variant="ghost"
              size="sm"
              iconName="Calculator"
              onClick={handleEstimate}
              disabled={!!waitPeriod}
              title="Estimate"
            />
          )}
          <Button
            variant="ghost"
            size="sm"
            iconName="MoreVertical"
            onClick={() => {}} // Could open action menu
          />
        </div>
      </div>
      {/* Progress bar for uploading files */}
      {file?.progress !== undefined && file?.progress < 100 && (
        <div className="px-3 pb-3 lg:px-4 lg:pb-4">
          <div className="flex justify-between text-xs text-muted-foreground mb-1">
            <span>Uploading...</span>
            <span>{file?.progress}%</span>
          </div>
          <div className="w-full bg-muted rounded-full h-2">
            <div 
              className="bg-primary h-2 rounded-full transition-all duration-300"
              style={{ width: `${file?.progress}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default FileItem;
