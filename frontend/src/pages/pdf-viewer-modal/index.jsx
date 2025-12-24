import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import Header from '../../components/ui/Header';
import PDFHeader from './components/PDFHeader';
import PDFViewer from './components/PDFViewer';
import ThumbnailSidebar from './components/ThumbnailSidebar';
import EstimateActionBar from './components/EstimateActionBar';
import { api } from '../../utils/api';
import { logout } from '../../utils/logout';

const PDFViewerModal = () => {
  const navigate = useNavigate();
  const location = useLocation();
  
  // Get file info from navigation state or use defaults
  const fileInfo = location?.state?.file || {
    name: "home-inspection-report.pdf",
    size: "2.4 MB",
    uploadDate: "2025-08-21",
    pages: 10
  };

  // Use actual page count from file, fallback to 10
  const totalPages = fileInfo?.pages || 10;

  // PDF Viewer State
  const [currentPage, setCurrentPage] = useState(1);
  const [zoomLevel, setZoomLevel] = useState(100);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isHeaderMenuOpen, setIsHeaderMenuOpen] = useState(false);
  const [isGeneratingEstimate, setIsGeneratingEstimate] = useState(false);

  // Debug: Log file info in development
  useEffect(() => {
    if (import.meta.env.DEV && fileInfo?.fileUrl) {
      console.log('📄 PDF Viewer - File info:', {
        name: fileInfo.name,
        fileUrl: fileInfo.fileUrl,
        id: fileInfo.id,
      });
    }
  }, [fileInfo]);

  // Mock user data
  const mockUser = {
    name: "John Smith",
    email: "john.smith@email.com",
    avatar: "https://randomuser.me/api/portraits/men/1.jpg"
  };

  // Handle page changes
  const handlePageChange = (page) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
    }
  };

  // Handle zoom changes
  const handleZoomChange = (zoom) => {
    setZoomLevel(zoom);
  };

  // Handle modal close
  const handleClose = () => {
    // Check if we came from estimate page with return info
    const returnPath = location?.state?.returnPath;
    const returnTab = location?.state?.returnTab;
    
    if (returnPath) {
      // Navigate back to the specified path
      if (returnTab) {
        // If we need to return to a specific tab, we can pass it in state
        navigate(returnPath, { state: { activeTab: returnTab } });
      } else {
        navigate(returnPath);
      }
    } else {
      // Default: go to file upload management
      navigate('/file-upload-management');
    }
  };

  // Handle file actions
  const handleDownload = async () => {
    if (!fileInfo?.fileUrl) {
      alert('File URL not available');
      return;
    }
    
    try {
      if (import.meta.env.DEV) {
        console.log('📥 Downloading file from:', fileInfo.fileUrl);
      }
      
      // Fetch the PDF as a blob and download it
      // This works better with cross-origin resources
      const response = await fetch(fileInfo.fileUrl, {
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
      link.download = fileInfo.name || 'file.pdf';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      // Clean up the blob URL after a delay
      setTimeout(() => {
        window.URL.revokeObjectURL(blobUrl);
      }, 100);
    } catch (error) {
      console.error('❌ Download error:', error);
      // Fallback: open in new tab (browser will handle download)
      alert('Direct download failed. Opening file in new tab...');
      window.open(fileInfo.fileUrl, '_blank');
    }
  };

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({
        title: fileInfo?.name,
        text: 'Check out this inspection report',
        url: fileInfo?.fileUrl || window.location?.href
      });
    } else {
      // Fallback - copy to clipboard
      const urlToShare = fileInfo?.fileUrl || window.location?.href;
      navigator.clipboard?.writeText(urlToShare);
      alert('Link copied to clipboard!');
    }
  };

  const handleDelete = async () => {
    if (!fileInfo?.id) {
      alert('File ID not available');
      return;
    }
    
    if (window.confirm(`Are you sure you want to delete "${fileInfo?.name}"?`)) {
      try {
        const response = await api.delete(`/api/files/${fileInfo.id}`);
        if (response.success) {
          alert('File deleted successfully!');
          navigate('/file-upload-management');
        } else {
          alert('Failed to delete file');
        }
      } catch (error) {
        console.error('Delete error:', error);
        alert('Failed to delete file: ' + (error.message || 'Unknown error'));
      }
    }
  };

  // Handle estimate generation
  const handleGenerateEstimate = () => {
    setIsGeneratingEstimate(true);
    
    // Mock processing delay
    setTimeout(() => {
      setIsGeneratingEstimate(false);
      navigate('/estimate-generation-results', {
        state: {
          sourceFile: fileInfo,
          generatedAt: new Date()?.toISOString()
        }
      });
    }, 3000);
  };

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyPress = (e) => {
      switch (e?.key) {
        case 'Escape':
          handleClose();
          break;
        case 'ArrowLeft':
          if (currentPage > 1) {
            handlePageChange(currentPage - 1);
          }
          break;
        case 'ArrowRight':
          if (currentPage < totalPages) {
            handlePageChange(currentPage + 1);
          }
          break;
        case '+': case'=':
          if (e?.ctrlKey || e?.metaKey) {
            e?.preventDefault();
            handleZoomChange(Math.min(zoomLevel + 25, 200));
          }
          break;
        case '-':
          if (e?.ctrlKey || e?.metaKey) {
            e?.preventDefault();
            handleZoomChange(Math.max(zoomLevel - 25, 50));
          }
          break;
        default:
          break;
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [currentPage, fileInfo?.pages, zoomLevel]);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (!event?.target?.closest('.header-menu')) {
        setIsHeaderMenuOpen(false);
      }
    };

    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  // Auto-open sidebar on desktop
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 1024) {
        setIsSidebarOpen(true);
      } else {
        setIsSidebarOpen(false);
      }
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <div className="fixed inset-0 z-50 bg-background">
      {/* Header */}
      <Header 
        notifications={3}
        onLogout={async () => await logout(navigate)}
      />
      {/* Main Content */}
      <div className="flex flex-col h-screen pt-16">
        {/* PDF Header */}
        <PDFHeader
          fileName={fileInfo?.name}
          onClose={handleClose}
          onDownload={handleDownload}
          onShare={handleShare}
          onDelete={handleDelete}
          isMenuOpen={isHeaderMenuOpen}
          onMenuToggle={() => setIsHeaderMenuOpen(!isHeaderMenuOpen)}
        />

        {/* Content Area */}
        <div className="flex flex-1 overflow-hidden">
          {/* Thumbnail Sidebar */}
          <ThumbnailSidebar
            isOpen={isSidebarOpen}
            onToggle={() => setIsSidebarOpen(!isSidebarOpen)}
            currentPage={currentPage}
            totalPages={totalPages}
            onPageSelect={handlePageChange}
          />

          {/* PDF Viewer */}
          <PDFViewer
            pdfUrl={fileInfo?.fileUrl || fileInfo?.url}
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={handlePageChange}
            zoomLevel={zoomLevel}
            onZoomChange={handleZoomChange}
          />
        </div>

        {/* Estimate Action Bar */}
        <EstimateActionBar
          fileName={fileInfo?.name}
          onGenerateEstimate={handleGenerateEstimate}
          isGenerating={isGeneratingEstimate}
        />
      </div>
      {/* Loading Overlay */}
      {isGeneratingEstimate && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-60 flex items-center justify-center">
          <div className="bg-card p-6 rounded-lg shadow-moderate max-w-sm w-full mx-4">
            <div className="text-center space-y-4">
              <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto"></div>
              <div>
                <h3 className="text-lg font-semibold text-foreground">
                  Generating Estimate
                </h3>
                <p className="text-sm text-muted-foreground mt-2">
                  Analyzing your inspection report and calculating repair costs...
                </p>
              </div>
              <div className="w-full bg-muted rounded-full h-2">
                <div className="bg-primary h-2 rounded-full animate-pulse" style={{ width: '60%' }}></div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PDFViewerModal;