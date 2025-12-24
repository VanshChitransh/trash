import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '../../components/ui/Header';
import Breadcrumb from '../../components/ui/Breadcrumb';
import FileUploadZone from './components/FileUploadZone';
import FileList from './components/FileList';
import ProcessingStatus from './components/ProcessingStatus';
import QuickActions from './components/QuickActions';
import Icon from '../../components/AppIcon';
import Button from '../../components/ui/Button';
import ViewPdfModal from '../../components/ViewPdfModal';
import { api } from '../../utils/api';
import { logout } from '../../utils/logout';
import { useNotifications } from '../../contexts/NotificationContext';

const FileUploadManagement = () => {
  const navigate = useNavigate();
  const { addNotification } = useNotifications();
  const [files, setFiles] = useState([]);
  const [isUploading, setIsUploading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [viewModalOpen, setViewModalOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [user] = useState({
    name: "John Smith",
    email: "john.smith@email.com"
  });

  // Fetch files from API
  const fetchFiles = useCallback(async (showLoading = true) => {
    try {
      if (showLoading) {
        setLoading(true);
      }
      setError(null);
      const response = await api.get('/api/files');
      if (response && response.success && response.data) {
        // Map the response to match frontend format
        // All uploaded files should be "completed" (upload is complete)
        // "isProcessed" indicates if the file has been processed for estimate generation
        const formattedFiles = response.data.map(file => ({
          id: file.id,
          name: file.name,
          size: file.size,
          uploadDate: file.uploadDate,
          status: file.status || 'completed', // All uploaded files are "completed"
          progress: 100, // Upload is always complete when fetched from server
          fileUrl: file.fileUrl,
          mimeType: file.mimeType,
          pages: file.pages || null,
          hasEstimate: file.hasEstimate || false,
          estimateId: file.estimateId || null,
        }));
        if (import.meta.env.DEV) {
          console.log('📋 Files fetched from server:', formattedFiles.length, 'files');
        }
        setFiles(formattedFiles);
      }
    } catch (err) {
      console.error('Error fetching files:', err);
      setError(err.message || 'Failed to load files');
      // If 401, user might not be authenticated
      if (err.status === 401) {
        navigate('/authentication-hub');
      }
    } finally {
      if (showLoading) {
        setLoading(false);
      }
    }
  }, [navigate]);

  useEffect(() => {
    fetchFiles();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Debug: Log files changes in development
  useEffect(() => {
    if (import.meta.env.DEV) {
      console.log('📊 Files state updated:', files.length, 'files');
      if (files.length > 0) {
        console.log('📄 Latest file:', files[0]?.name, files[0]?.status);
      }
    }
  }, [files]);

  const handleFilesUpload = async (uploadedFiles) => {
    setIsUploading(true);
    setError(null);

    try {
      // Upload files one by one
      const uploadPromises = uploadedFiles.map(async (file) => {
        // Add file to list with pending status
        const tempId = `temp-${Date.now()}-${Math.random()}`;
        const tempFile = {
          id: tempId,
          name: file.name,
          size: file.size,
          uploadDate: new Date().toISOString(),
          status: "pending",
          progress: 0,
          fileUrl: null,
        };

        setFiles(prev => [tempFile, ...prev]);

        try {
          // Upload file
          const response = await api.upload('/api/files/upload', file);
          
          if (response && response.success && response.data) {
            // Update file with server response
            // File upload is complete, so status should be "completed"
            // "isProcessed" indicates if the file has been processed for estimate generation, not upload status
            const uploadedFile = {
              id: response.data.id,
              name: response.data.fileName,
              size: response.data.fileSize,
              uploadDate: response.data.uploadedAt,
              status: "completed", // Upload is complete
              progress: 100,
              fileUrl: response.data.fileUrl,
              mimeType: response.data.mimeType,
            };

            // Log in development
            if (import.meta.env.DEV && response.data.debug) {
              console.log('📄 File uploaded successfully:', {
                fileName: uploadedFile.name,
                fileUrl: response.data.debug.fileUrl,
                size: uploadedFile.size,
                id: uploadedFile.id,
              });
            }

            // Remove temp file and add the uploaded file at the beginning
            setFiles(prev => {
              // Create a new array to ensure React detects the change
              const filtered = prev.filter(f => f.id !== tempId);
              // Check if file already exists to avoid duplicates
              const exists = filtered.some(f => f.id === uploadedFile.id);
              if (!exists) {
                const updated = [uploadedFile, ...filtered];
                if (import.meta.env.DEV) {
                  console.log('✅ File list updated. Total files:', updated.length);
                  console.log('📄 Added file:', uploadedFile.name, 'Status:', uploadedFile.status);
                }
                // Add notification
                addNotification({
                  type: 'success',
                  title: 'File Uploaded',
                  message: `${uploadedFile.name} has been uploaded successfully`,
                });
                return updated;
              }
              if (import.meta.env.DEV) {
                console.log('⚠️ File already exists in list');
              }
              return [...filtered]; // Return new array to trigger re-render
            });

            return uploadedFile;
          } else {
            throw new Error('Invalid response from server');
          }
        } catch (err) {
          console.error('Error uploading file:', err);
          // Update file status to failed
          setFiles(prev => prev.map(f =>
            f.id === tempId ? { ...f, status: "failed", progress: 0 } : f
          ));

          // Show specific error notification for storage limit
          if (err.data?.error === 'STORAGE_LIMIT_EXCEEDED') {
            addNotification({
              type: 'error',
              title: 'Storage Limit Exceeded',
              message: err.message || 'Please delete some files to free up space.',
            });
          } else {
            addNotification({
              type: 'error',
              title: 'Upload Failed',
              message: err.message || 'Failed to upload file',
            });
          }

          throw err;
        }
      });

      const results = await Promise.all(uploadPromises);
      
      // All files have been uploaded and added to state
      // The immediate state update should be sufficient
      if (import.meta.env.DEV) {
        console.log('✅ All files uploaded successfully:', results.length);
      }
    } catch (err) {
      console.error('Upload error:', err);
      setError(err.message || 'Failed to upload files');
    } finally {
      setIsUploading(false);
    }
  };

  const handleFileDelete = async (fileId) => {
    const fileToDelete = files.find(f => f.id === fileId);
    if (!window.confirm('Are you sure you want to delete this file?')) {
      return;
    }

    try {
      const response = await api.delete(`/api/files/${fileId}`);
      if (response.success) {
        setFiles(prev => prev.filter(file => file.id !== fileId));
        // Add notification
        addNotification({
          type: 'info',
          title: 'File Deleted',
          message: fileToDelete ? `${fileToDelete.name} has been deleted` : 'File has been deleted',
        });
      }
    } catch (err) {
      console.error('Error deleting file:', err);
      setError(err.message || 'Failed to delete file');
      addNotification({
        type: 'error',
        title: 'Delete Failed',
        message: err.message || 'Failed to delete file',
      });
    }
  };

  // Note: Removed helper functions for preview URL construction
  // The PDF viewer now fetches PDFs directly using fetch with credentials,
  // which automatically sends httpOnly cookies for authentication

  const handleFileView = async (file) => {
    if (import.meta.env.DEV) {
      console.log('👁️ handleFileView - File clicked:', file);
      console.log('👁️ handleFileView - fileUrl:', file.fileUrl);
    }
    
    if (!file.id) {
      setError('File ID not available');
      return;
    }

    try {
      // Get preview URL from backend (includes authentication token)
      const response = await api.get(`/api/files/${file.id}/preview`);
      
      if (response && response.success && response.data && response.data.previewUrl) {
        if (import.meta.env.DEV) {
          console.log('✅ Preview URL obtained, opening in new tab:', response.data.previewUrl);
        }
        
        // Open preview URL in new tab with worker proxy and authentication
        window.open(response.data.previewUrl, '_blank', 'noopener,noreferrer');
      } else {
        throw new Error('Invalid response from server');
      }
    } catch (err) {
      console.error('❌ Error getting preview URL:', err);
      setError(err.message || 'Failed to open file preview');
      
      // Fallback: try navigating to modal if preview URL fails
      if (file.fileUrl) {
        if (import.meta.env.DEV) {
          console.log('⚠️ Falling back to PDF viewer modal');
        }
        navigate('/pdf-viewer-modal', { 
          state: { 
            file: {
              ...file,
              pages: file.pages || 10
            }
          } 
        });
      }
    }
  };
  
  const handleCloseViewModal = () => {
    setViewModalOpen(false);
    setSelectedFile(null);
  };

  // Handle estimate generation by routing to the estimate page for real-time processing
  const handleEstimate = (file) => {
    navigate('/estimate-generation-results', {
      state: {
        file,
        autoLoadEstimate: !!file?.hasEstimate,
      }
    });
  };

  const handleFileDownload = async (file) => {
    try {
      if (!file.fileUrl) {
        setError('File URL not available');
        return;
      }
      
      if (import.meta.env.DEV) {
        console.log('📥 Downloading file from:', file.fileUrl);
      }
      
      // Fetch the PDF as a blob and download it
      // This works better with cross-origin resources from R2
      const response = await fetch(file.fileUrl, {
        method: 'GET',
        headers: {
          'Accept': 'application/pdf',
        },
      });
      
      if (!response.ok) {
        throw new Error(`Failed to fetch file: ${response.status} ${response.statusText}`);
      }
      
      const blob = await response.blob();
      
      if (import.meta.env.DEV) {
        console.log('✅ File fetched successfully, size:', blob.size, 'bytes');
      }
      
      const blobUrl = window.URL.createObjectURL(blob);
      
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = file.name || 'file.pdf';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      // Clean up the blob URL after a delay
      setTimeout(() => {
        window.URL.revokeObjectURL(blobUrl);
      }, 100);
    } catch (err) {
      console.error('❌ Error downloading file:', err);
      // Fallback: open in new tab (browser will handle download)
      if (file.fileUrl) {
        window.open(file.fileUrl, '_blank');
      } else {
        setError(err.message || 'Failed to download file');
      }
    }
  };

  const handleBulkDelete = async (fileIds) => {
    if (!window.confirm(`Are you sure you want to delete ${fileIds.length} file(s)?`)) {
      return;
    }

    try {
      const deletePromises = fileIds.map(id => api.delete(`/api/files/${id}`));
      await Promise.all(deletePromises);
      setFiles(prev => prev.filter(file => !fileIds.includes(file.id)));
    } catch (err) {
      console.error('Error deleting files:', err);
      setError(err.message || 'Failed to delete files');
    }
  };

  const handleBulkDownload = async (fileIds) => {
    try {
      // Download files one by one
      for (const id of fileIds) {
        const file = files.find(f => f.id === id);
        if (file) {
          await handleFileDownload(file);
          // Small delay between downloads
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }
    } catch (err) {
      console.error('Error downloading files:', err);
      setError(err.message || 'Failed to download files');
    }
  };

  const handleRefresh = () => {
    fetchFiles();
  };

  const handleLogout = async () => {
    await logout(navigate);
  };

  return (
    <div className="min-h-screen bg-background">
      <Header 
        notifications={3}
        onLogout={handleLogout}
      />
      <main className="pt-16">
        <div className="container mx-auto px-4 py-6 lg:px-6 lg:py-8">
          {/* Breadcrumb */}
          <div className="mb-6">
            <Breadcrumb />
          </div>

          {/* Page Header */}
          <div className="mb-8">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
              <div>
                <h1 className="text-2xl lg:text-3xl font-bold text-foreground mb-2">
                  File Upload & Management
                </h1>
                <p className="text-muted-foreground">
                  Upload inspection reports and manage your files. Generate estimates from completed reports.
                </p>
              </div>
              
              <div className="flex items-center gap-3">
                <Button
                  variant="outline"
                  iconName="RefreshCw"
                  onClick={handleRefresh}
                >
                  Refresh
                </Button>
                <Button
                  variant="default"
                  iconName="Calculator"
                  onClick={() => navigate('/estimate-generation-results', {
                    state: {
                      autoLoadEstimate: false // Don't auto-load, show options page
                    }
                  })}
                  disabled={files?.filter(f => f?.status === 'completed')?.length === 0}
                >
                  Generate Estimates
                </Button>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 lg:gap-8">
            {/* Main Content */}
            <div className="xl:col-span-2 space-y-6 lg:space-y-8">
              {/* Upload Zone */}
              <div className="bg-card border border-border rounded-lg p-6 lg:p-8">
                <FileUploadZone
                  onFilesUpload={handleFilesUpload}
                  isUploading={isUploading}
                  acceptedTypes={['.pdf']}
                />
              </div>

              {/* File List */}
              <div className="bg-card border border-border rounded-lg p-4 lg:p-6">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xl font-semibold text-foreground">
                    Uploaded Files
                  </h2>
                  <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                    <Icon name="FileText" size={16} />
                    <span>{files?.length} files</span>
                  </div>
                </div>

                {error && (
                  <div className="mb-4 p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-sm text-destructive">
                    {error}
                  </div>
                )}

                {loading ? (
                  <div className="text-center py-12">
                    <div className="w-16 h-16 mx-auto mb-4 bg-muted rounded-full flex items-center justify-center">
                      <Icon name="Loader2" size={24} className="text-muted-foreground animate-spin" />
                    </div>
                    <p className="text-muted-foreground">Loading files...</p>
                  </div>
                ) : (
                  <FileList
                    files={files}
                    onFileDelete={handleFileDelete}
                    onFileView={handleFileView}
                    onFileDownload={handleFileDownload}
                    onBulkDelete={handleBulkDelete}
                    onBulkDownload={handleBulkDownload}
                    onEstimate={handleEstimate}
                  />
                )}
              </div>
            </div>

            {/* Sidebar */}
            <div className="space-y-6">
              {/* Processing Status */}
              <ProcessingStatus files={files} />
              
              {/* Quick Actions */}
              <QuickActions 
                files={files} 
                onRefresh={handleRefresh}
              />

              {/* Help Card */}
              <div className="bg-card border border-border rounded-lg p-4 lg:p-6">
                <div className="flex items-start space-x-3">
                  <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Icon name="HelpCircle" size={16} className="text-primary" />
                  </div>
                  <div>
                    <h3 className="font-medium text-foreground mb-2">Need Help?</h3>
                    <p className="text-sm text-muted-foreground mb-3">
                      Learn how to upload files and generate estimates effectively.
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      iconName="ExternalLink"
                      onClick={() => navigate('/help')}
                    >
                      View Guide
                    </Button>
                  </div>
                </div>
              </div>

              {/* Storage Info */}
              <div className="bg-card border border-border rounded-lg p-4 lg:p-6">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-medium text-foreground">Storage Usage</h3>
                  <span className="text-sm text-muted-foreground">
                    {(() => {
                      const totalBytes = files.reduce((sum, file) => sum + (file.size || 0), 0);
                      const totalMB = totalBytes / (1024 * 1024);
                      const percentage = Math.min((totalMB / 100) * 100, 100);
                      return `${Math.round(percentage)}% used`;
                    })()}
                  </span>
                </div>

                <div className="w-full bg-muted rounded-full h-2 mb-3">
                  <div
                    className="bg-primary h-2 rounded-full transition-all duration-500"
                    style={{
                      width: `${(() => {
                        const totalBytes = files.reduce((sum, file) => sum + (file.size || 0), 0);
                        const totalMB = totalBytes / (1024 * 1024);
                        return Math.min((totalMB / 100) * 100, 100);
                      })()}%`
                    }}
                  />
                </div>

                <div className="flex justify-between text-sm text-muted-foreground">
                  <span>
                    {(() => {
                      const totalBytes = files.reduce((sum, file) => sum + (file.size || 0), 0);
                      const totalMB = totalBytes / (1024 * 1024);
                      return `${totalMB.toFixed(1)} MB used`;
                    })()}
                  </span>
                  <span>100 MB total</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
      
      {/* PDF View Modal */}
      <ViewPdfModal
        open={viewModalOpen}
        onClose={handleCloseViewModal}
        fileUrl={selectedFile?.fileUrl}
        title={selectedFile?.name}
        downloadFileName={selectedFile?.name}
        height={700}
        width={900}
      />
    </div>
  );
};

export default FileUploadManagement;
