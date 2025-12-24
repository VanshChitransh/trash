import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Icon from '../../../components/AppIcon';
import JSZip from 'jszip';
import { api } from '../../../utils/api';
import { useNotifications } from '../../../contexts/NotificationContext';

const QuickActions = ({ files = [], onRefresh }) => {
  const navigate = useNavigate();
  const { addNotification } = useNotifications();
  const [downloading, setDownloading] = useState(false);

  const completedFiles = files?.filter(file => file?.status === 'completed');
  const processingFiles = files?.filter(file => file?.status === 'processing');
  const failedFiles = files?.filter(file => file?.status === 'failed');

  const quickActionItems = [
    {
      title: 'Generate Estimates',
      description: 'Create detailed cost estimates from completed reports',
      icon: 'Calculator',
      color: 'bg-primary text-primary-foreground hover:bg-primary/90',
      action: () => navigate('/estimate-generation-results', {
        state: {
          autoLoadEstimate: false // Don't auto-load, show options page
        }
      }),
      disabled: completedFiles?.length === 0,
      badge: completedFiles?.length > 0 ? completedFiles?.length : null
    },
    {
      title: 'Download All',
      description: 'Download all completed files as a ZIP archive',
      icon: 'Download',
      color: 'bg-accent text-accent-foreground',
      action: async () => {
        if (completedFiles?.length === 0) return;
        
        setDownloading(true);
        try {
          const zip = new JSZip();
          let downloadCount = 0;
          
          // Download each file and add to ZIP
          for (const file of completedFiles) {
            try {
              if (!file.fileUrl) {
                console.warn(`File ${file.name} has no URL, skipping`);
                continue;
              }
              
              // Fetch the file
              const response = await fetch(file.fileUrl, {
                method: 'GET',
                credentials: 'include',
                headers: {
                  'Accept': 'application/pdf',
                },
              });
              
              if (!response.ok) {
                console.warn(`Failed to fetch ${file.name}: ${response.status}`);
                continue;
              }
              
              const blob = await response.blob();
              zip.file(file.name, blob);
              downloadCount++;
            } catch (error) {
              console.error(`Error downloading ${file.name}:`, error);
            }
          }
          
          if (downloadCount === 0) {
            addNotification({
              type: 'error',
              title: 'Download Failed',
              message: 'No files could be downloaded',
            });
            setDownloading(false);
            return;
          }
          
          // Generate ZIP file
          const zipBlob = await zip.generateAsync({ type: 'blob' });
          
          // Create download link
          const url = window.URL.createObjectURL(zipBlob);
          const link = document.createElement('a');
          link.href = url;
          link.download = `consultabid-files-${new Date().toISOString().split('T')[0]}.zip`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          window.URL.revokeObjectURL(url);
          
          addNotification({
            type: 'success',
            title: 'Download Complete',
            message: `Downloaded ${downloadCount} file${downloadCount > 1 ? 's' : ''} as ZIP`,
          });
        } catch (error) {
          console.error('Error creating ZIP:', error);
          addNotification({
            type: 'error',
            title: 'Download Failed',
            message: 'Failed to create ZIP archive',
          });
        } finally {
          setDownloading(false);
        }
      },
      disabled: completedFiles?.length === 0 || downloading,
      badge: null
    },
    {
      title: 'Refresh Status',
      description: 'Check for updates on processing files',
      icon: 'RefreshCw',
      color: 'bg-card border border-border text-foreground hover:bg-muted hover:border-border',
      action: onRefresh,
      disabled: false,
      badge: processingFiles?.length > 0 ? `${processingFiles?.length} processing` : null
    }
  ];

  return (
    <div className="bg-card border border-border rounded-lg p-4 lg:p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-foreground">Quick Actions</h3>
        <div className="text-sm text-muted-foreground">
          {files?.length} total files
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {quickActionItems?.map((item, index) => (
          <button
            key={index}
            onClick={item?.action}
            disabled={item?.disabled}
            className={`relative p-4 rounded-lg text-left transition-all duration-200 hover:scale-[1.02] hover:shadow-moderate disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 disabled:hover:shadow-none ${item?.color} ${
              item?.color?.includes('border') ? 'shadow-subtle' : ''
            }`}
          >
            {downloading && item?.title === 'Download All' && (
              <div className="absolute inset-0 flex items-center justify-center bg-background/50 rounded-lg">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
              </div>
            )}
            <div className="flex items-start space-x-3">
              <div className="flex-shrink-0">
                <Icon name={item?.icon} size={24} />
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="font-medium mb-1">{item?.title}</h4>
                <p className="text-sm opacity-90 line-clamp-2">
                  {item?.description}
                </p>
              </div>
            </div>
            
            {item?.badge && (
              <div className="absolute top-2 right-2 bg-background/90 backdrop-blur-sm px-2 py-1 rounded-full min-w-[24px] flex items-center justify-center">
                <span className="text-xs font-semibold">{item?.badge}</span>
              </div>
            )}
          </button>
        ))}
      </div>
      {/* Status Summary */}
      <div className="mt-6 pt-4 border-t border-border">
        <div className="flex flex-wrap gap-4 text-sm">
          <div className="flex items-center space-x-2">
            <div className="w-2 h-2 bg-success rounded-full"></div>
            <span className="text-muted-foreground">
              {completedFiles?.length} Completed
            </span>
          </div>
          
          {processingFiles?.length > 0 && (
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 bg-warning rounded-full animate-pulse"></div>
              <span className="text-muted-foreground">
                {processingFiles?.length} Processing
              </span>
            </div>
          )}
          
          {failedFiles?.length > 0 && (
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 bg-destructive rounded-full"></div>
              <span className="text-muted-foreground">
                {failedFiles?.length} Failed
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default QuickActions;
