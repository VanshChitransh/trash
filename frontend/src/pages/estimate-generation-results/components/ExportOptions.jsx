import React, { useState } from 'react';
import Icon from '../../../components/AppIcon';
import Button from '../../../components/ui/Button';
import { api, API_BASE_URL, getToken } from '../../../utils/api';
import { useNotifications } from '../../../contexts/NotificationContext';

const ExportOptions = ({ estimateData, selectedFile, onExport }) => {
  const { addNotification } = useNotifications();
  const [isDownloading, setIsDownloading] = useState(false);
  const [isViewing, setIsViewing] = useState(false);
  const [isGeneratingForDownload, setIsGeneratingForDownload] = useState(false);
  const [pdfUrl, setPdfUrl] = useState(null);

  // Helper function to generate PDF (shared by view and download)
  // Does not set loading state - caller is responsible for managing loading state
  const generatePdfIfNeeded = async () => {
    if (pdfUrl) {
      return pdfUrl;
    }

    if (!selectedFile?.id) {
      const error = new Error('No file selected. Please select a file first.');
      addNotification({
        type: 'error',
        title: 'Error',
        message: error.message,
      });
      throw error;
    }

    try {
      // Generate PDF without setting global loading state
      const response = await api.post(`/api/files/${selectedFile.id}/generate-estimate-pdf`);
      
      if (response && response.success && response.data) {
        const generatedUrl = response.data.pdfUrl;
        setPdfUrl(generatedUrl);
        addNotification({
          type: 'success',
          title: 'PDF Generated',
          message: 'Estimate PDF has been generated successfully',
        });
        
        if (onExport) {
          onExport({ pdfUrl: response.data.pdfUrl, fileName: response.data.fileName });
        }
        
        return generatedUrl;
      } else {
        const error = new Error(response?.message || 'Failed to generate PDF');
        addNotification({
          type: 'error',
          title: 'Generation Failed',
          message: error.message,
        });
        throw error;
      }
    } catch (error) {
      console.error('Error generating PDF:', error);
      if (!error.message.includes('Failed to generate estimate PDF') && 
          !error.message.includes('No file selected')) {
        addNotification({
          type: 'error',
          title: 'Generation Failed',
          message: error.message || 'Failed to generate estimate PDF. Please try again.',
        });
      }
      throw error;
    }
  };

  // Download PDF
  const handleDownloadPdf = async () => {
    try {
      // Check if PDF needs to be generated first
      const needsGeneration = !pdfUrl;
      
      if (needsGeneration) {
        setIsGeneratingForDownload(true);
      } else {
        setIsDownloading(true);
      }
      
      // Generate PDF if needed
      await generatePdfIfNeeded();
      
      // After generation, switch to downloading state
      if (needsGeneration) {
        setIsGeneratingForDownload(false);
        setIsDownloading(true);
      }

      // Use backend proxy endpoint to download PDF (handles CORS)
      // Get token using the centralized getToken function
      const token = getToken();
      
      // Debug: Log token status
      console.log('Download PDF - Token status:', {
        hasToken: !!token,
        hasAuthToken: !!localStorage.getItem('authToken'),
        hasUserData: !!localStorage.getItem('user'),
        isAuthenticated: localStorage.getItem('isAuthenticated')
      });
      
      if (!token) {
        addNotification({
          type: 'error',
          title: 'Session Expired',
          message: 'Please login again to download PDFs',
        });
        throw new Error('Authentication required. Please login again.');
      }

      // Fetch the PDF through backend proxy
      const downloadUrl = `${API_BASE_URL}/api/files/${selectedFile.id}/download-estimate-pdf`;
      const response = await fetch(downloadUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/pdf',
        },
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `Failed to fetch PDF: ${response.status} ${response.statusText}`);
      }
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = selectedFile?.name?.replace('.pdf', '') + '-estimate.pdf' || 'estimate.pdf';
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      addNotification({
        type: 'success',
        title: 'Download Started',
        message: 'PDF download has started',
      });
    } catch (error) {
      console.error('Error downloading PDF:', error);
      addNotification({
        type: 'error',
        title: 'Download Failed',
        message: error.message || 'Failed to download PDF. Please try again.',
      });
    } finally {
      setIsDownloading(false);
      setIsGeneratingForDownload(false);
    }
  };

  // View PDF
  const handleViewPdf = async () => {
    try {
      setIsViewing(true);
      
      // Generate PDF if needed (isViewing is already true, so view button shows loading)
      await generatePdfIfNeeded();
      
      // Use backend proxy endpoint to view PDF (handles CORS)
      // Get token using the centralized getToken function
      const token = getToken();
      
      // Debug: Log token status
      console.log('View PDF - Token status:', {
        hasToken: !!token,
        hasAuthToken: !!localStorage.getItem('authToken'),
        hasUserData: !!localStorage.getItem('user'),
        isAuthenticated: localStorage.getItem('isAuthenticated')
      });
      
      if (!token) {
        addNotification({
          type: 'error',
          title: 'Session Expired',
          message: 'Please login again to view PDFs',
        });
        throw new Error('Authentication required. Please login again.');
      }

      // Open PDF through backend proxy in new tab
      const viewUrl = `${API_BASE_URL}/api/files/${selectedFile.id}/download-estimate-pdf?token=${encodeURIComponent(token)}`;
      window.open(viewUrl, '_blank', 'noopener,noreferrer');
    } catch (error) {
      console.error('Error viewing PDF:', error);
      addNotification({
        type: 'error',
        title: 'View Failed',
        message: error.message || 'Failed to view PDF. Please try again.',
      });
    } finally {
      setIsViewing(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Download Header */}
      <div className="bg-card border border-border rounded-lg p-6">
        <div className="flex items-center space-x-3 mb-4">
          <div className="p-2 bg-primary/10 rounded-lg">
            <Icon name="Download" size={24} className="text-primary" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-foreground">Download Estimate</h2>
            <p className="text-muted-foreground">Download or view your estimate as a PDF report</p>
          </div>
        </div>
      </div>

      {/* PDF Export Card */}
      <div className="bg-card border border-border rounded-lg p-6">
        <div className="flex items-start space-x-4">
          <div className="p-3 bg-primary/10 rounded-lg">
            <Icon name="FileText" size={32} className="text-primary" />
                </div>
                <div className="flex-1">
            <h3 className="text-lg font-semibold text-foreground mb-2">PDF Report</h3>
            <p className="text-muted-foreground mb-4">
              Professional PDF document with all estimate details, charts, and formatting. 
              Print-ready and shareable.
            </p>
            
            <div className="flex flex-wrap gap-2 mb-4">
              <span className="px-3 py-1 text-xs bg-muted text-muted-foreground rounded-full">
                Print-ready
              </span>
              <span className="px-3 py-1 text-xs bg-muted text-muted-foreground rounded-full">
                Professional formatting
              </span>
              <span className="px-3 py-1 text-xs bg-muted text-muted-foreground rounded-full">
                Charts included
              </span>
              <span className="px-3 py-1 text-xs bg-muted text-muted-foreground rounded-full">
                Shareable
                      </span>
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <Button
                variant="outline"
                size="lg"
                onClick={handleViewPdf}
                disabled={isViewing || isDownloading || isGeneratingForDownload || !selectedFile?.id}
                loading={isViewing}
                iconName={!isViewing ? "Eye" : null}
                iconPosition="left"
              >
                {isViewing ? 'Generating...' : 'View PDF'}
              </Button>
              
              <Button
                variant="default"
                size="lg"
                onClick={handleDownloadPdf}
                disabled={isDownloading || isGeneratingForDownload || isViewing || !selectedFile?.id}
                loading={isDownloading || isGeneratingForDownload}
                iconName={!(isDownloading || isGeneratingForDownload) ? "Download" : null}
                iconPosition="left"
              >
                {isGeneratingForDownload ? 'Generating...' : isDownloading ? 'Downloading...' : 'Download PDF'}
              </Button>
            </div>

            {pdfUrl && (
              <div className="mt-4 p-3 bg-success/10 border border-success/20 rounded-lg">
                <div className="flex items-center space-x-2 text-sm text-success">
                  <Icon name="CheckCircle" size={16} />
                  <span>PDF generated successfully. You can now view or download it.</span>
                </div>
            </div>
            )}
          </div>
        </div>
      </div>

      {/* Info Section */}
      <div className="bg-card border border-border rounded-lg p-6">
        <div className="flex items-start space-x-3">
          <Icon name="Info" size={20} className="text-primary mt-0.5" />
          <div>
            <h4 className="font-medium text-foreground mb-2">About PDF Download</h4>
            <p className="text-sm text-muted-foreground">
              The PDF report includes all estimate details, cost breakdowns, category summaries,
              and priority recommendations. The PDF is generated on-demand and typically takes
              less than 30 seconds to create.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ExportOptions;