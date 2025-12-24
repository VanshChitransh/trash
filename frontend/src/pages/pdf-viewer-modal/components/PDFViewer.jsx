import React, { useState, useRef, useEffect } from 'react';
import Icon from '../../../components/AppIcon';
import Button from '../../../components/ui/Button';

const PDFViewer = ({ 
  pdfUrl, 
  currentPage = 1, 
  totalPages = 10,
  onPageChange,
  zoomLevel = 100,
  onZoomChange 
}) => {
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [pdfBlobUrl, setPdfBlobUrl] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const viewerRef = useRef(null);
  const blobUrlRef = useRef(null);

  // Mock PDF pages for demonstration
  const mockPages = Array.from({ length: totalPages }, (_, i) => ({
    id: i + 1,
    content: `Page ${i + 1} Content\n\nThis is a mock PDF page showing inspection report details. In a real implementation, this would display actual PDF content using a library like react-pdf or pdf.js.\n\nSample inspection findings:\n• Electrical panel needs updating\n• Minor plumbing leak in basement\n• Roof shingles require replacement\n• HVAC system maintenance needed\n\nEstimated repair costs and recommendations would be displayed here with detailed breakdowns and priority levels.`,
    thumbnail: `https://picsum.photos/120/160?random=${i + 1}`
  }));

  useEffect(() => {
    // Load PDF from URL using fetch with credentials
    // This automatically sends httpOnly cookies for authentication
    
    // Cleanup previous blob URL if exists
    if (blobUrlRef.current) {
      URL.revokeObjectURL(blobUrlRef.current);
      blobUrlRef.current = null;
    }
    
    if (pdfUrl) {
      setIsLoading(true);
      setLoadError(null);
      
      // Fetch PDF with credentials (sends httpOnly cookies automatically)
      fetch(pdfUrl, {
        method: 'GET',
        credentials: 'include', // This sends cookies automatically
        headers: {
          'Accept': 'application/pdf',
        },
      })
        .then(response => {
          if (!response.ok) {
            throw new Error(`Failed to load PDF: ${response.status} ${response.statusText}`);
          }
          return response.blob();
        })
        .then(blob => {
          // Create blob URL for the iframe
          const blobUrl = URL.createObjectURL(blob);
          blobUrlRef.current = blobUrl;
          setPdfBlobUrl(blobUrl);
          setIsLoading(false);
          
          if (import.meta.env.DEV) {
            console.log('✅ PDF loaded successfully, size:', blob.size, 'bytes');
          }
        })
        .catch(error => {
          console.error('❌ Error loading PDF:', error);
          setLoadError(error.message || 'Failed to load PDF');
          setIsLoading(false);
        });
    } else {
      setIsLoading(false);
    }
    
    // Cleanup: revoke blob URL when component unmounts or URL changes
    return () => {
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current);
        blobUrlRef.current = null;
      }
    };
  }, [pdfUrl]);

  const handleZoomIn = () => {
    const newZoom = Math.min(zoomLevel + 25, 200);
    onZoomChange(newZoom);
  };

  const handleZoomOut = () => {
    const newZoom = Math.max(zoomLevel - 25, 50);
    onZoomChange(newZoom);
  };

  const handleFitToWidth = () => {
    onZoomChange(100);
  };

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-muted/30">
        <div className="text-center space-y-4">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto"></div>
          <div className="space-y-2">
            <p className="text-sm font-medium text-foreground">Loading PDF...</p>
            <p className="text-xs text-muted-foreground">Please wait while we prepare your document</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col bg-muted/30">
      {/* Toolbar */}
      <div className="flex items-center justify-between p-3 bg-card border-b border-border">
        {/* Left Controls */}
        <div className="flex items-center space-x-2">
          <Button
            variant="ghost"
            size="sm"
            iconName="ZoomOut"
            onClick={handleZoomOut}
            disabled={zoomLevel <= 50}
          />
          <span className="text-sm font-medium text-foreground min-w-[60px] text-center">
            {zoomLevel}%
          </span>
          <Button
            variant="ghost"
            size="sm"
            iconName="ZoomIn"
            onClick={handleZoomIn}
            disabled={zoomLevel >= 200}
          />
          <Button
            variant="ghost"
            size="sm"
            iconName="Maximize2"
            onClick={handleFitToWidth}
          />
        </div>

        {/* Center - Page Navigation */}
        <div className="flex items-center space-x-2">
          <Button
            variant="ghost"
            size="sm"
            iconName="ChevronLeft"
            onClick={() => onPageChange(currentPage - 1)}
            disabled={currentPage <= 1}
          />
          <div className="flex items-center space-x-2">
            <input
              type="number"
              value={currentPage}
              onChange={(e) => {
                const page = parseInt(e?.target?.value);
                if (page >= 1 && page <= totalPages) {
                  onPageChange(page);
                }
              }}
              className="w-12 h-8 text-center text-sm border border-border rounded bg-input text-foreground"
              min="1"
              max={totalPages}
            />
            <span className="text-sm text-muted-foreground">of {totalPages}</span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            iconName="ChevronRight"
            onClick={() => onPageChange(currentPage + 1)}
            disabled={currentPage >= totalPages}
          />
        </div>

        {/* Right Controls */}
        <div className="flex items-center space-x-2">
          <Button
            variant="ghost"
            size="sm"
            iconName="Search"
            onClick={() => setIsSearchOpen(!isSearchOpen)}
          />
        </div>
      </div>
      {/* Search Bar */}
      {isSearchOpen && (
        <div className="p-3 bg-card border-b border-border">
          <div className="flex items-center space-x-2">
            <div className="flex-1 relative">
              <Icon name="Search" size={16} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search in document..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e?.target?.value)}
                className="w-full pl-10 pr-4 py-2 text-sm border border-border rounded-md bg-input text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <Button
              variant="ghost"
              size="sm"
              iconName="X"
              onClick={() => setIsSearchOpen(false)}
            />
          </div>
        </div>
      )}
      {/* PDF Content */}
      <div 
        ref={viewerRef}
        className="flex-1 overflow-auto p-4"
        style={{ backgroundColor: '#f5f5f5' }}
      >
        {loadError ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center space-y-4 max-w-md">
              <div className="w-16 h-16 mx-auto bg-destructive/10 rounded-full flex items-center justify-center">
                <Icon name="AlertCircle" size={32} className="text-destructive" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-foreground mb-2">Failed to Load PDF</h3>
                <p className="text-sm text-muted-foreground">{loadError}</p>
              </div>
              <Button
                variant="outline"
                onClick={() => {
                  setLoadError(null);
                  if (pdfUrl) {
                    // Retry loading
                    setIsLoading(true);
                    fetch(pdfUrl, {
                      method: 'GET',
                      credentials: 'include',
                      headers: { 'Accept': 'application/pdf' },
                    })
                      .then(response => {
                        if (!response.ok) throw new Error(`Failed: ${response.status}`);
                        return response.blob();
                      })
                      .then(blob => {
                        const blobUrl = URL.createObjectURL(blob);
                        setPdfBlobUrl(blobUrl);
                        setIsLoading(false);
                      })
                      .catch(error => {
                        setLoadError(error.message || 'Failed to load PDF');
                        setIsLoading(false);
                      });
                  }
                }}
              >
                Retry
              </Button>
            </div>
          </div>
        ) : pdfBlobUrl ? (
          <div className="max-w-full mx-auto">
            <div 
              className="bg-white shadow-moderate rounded-lg overflow-hidden"
              style={{ 
                transform: `scale(${zoomLevel / 100})`,
                transformOrigin: 'top center',
                marginBottom: zoomLevel > 100 ? '2rem' : '0'
              }}
            >
              {/* PDF Viewer - using iframe with blob URL */}
              <iframe
                src={`${pdfBlobUrl}#toolbar=0`}
                title="PDF Viewer"
                className="w-full"
                style={{ 
                  height: '80vh',
                  minHeight: '600px',
                  border: 'none'
                }}
                onLoad={() => {
                  if (import.meta.env.DEV) {
                    console.log('✅ PDF iframe loaded successfully');
                  }
                }}
                onError={(e) => {
                  console.error('❌ PDF iframe load error:', e);
                  setLoadError('Failed to display PDF in viewer');
                }}
              />
            </div>
          </div>
        ) : pdfUrl ? null : (
          <div className="max-w-4xl mx-auto">
            <div 
              className="bg-white shadow-moderate rounded-lg overflow-hidden"
              style={{ 
                transform: `scale(${zoomLevel / 100})`,
                transformOrigin: 'top center',
                marginBottom: zoomLevel > 100 ? '2rem' : '0'
              }}
            >
              {/* Mock PDF Page Content - fallback when no URL */}
              <div className="p-8 min-h-[800px]">
                <div className="space-y-6">
                  <div className="text-center border-b border-gray-200 pb-4">
                    <h1 className="text-2xl font-bold text-gray-900">
                      Home Inspection Report
                    </h1>
                    <p className="text-gray-600 mt-2">
                      Property Address: 123 Main Street, Anytown, USA
                    </p>
                    <p className="text-gray-600">
                      Inspection Date: August 21, 2025
                    </p>
                  </div>

                  <div className="space-y-4">
                    <h2 className="text-xl font-semibold text-gray-900">
                      Page {currentPage} - {currentPage === 1 ? 'Executive Summary' : 
                       currentPage === 2 ? 'Electrical Systems' :
                       currentPage === 3 ? 'Plumbing Systems' :
                       currentPage === 4 ? 'HVAC Systems' :
                       currentPage === 5 ? 'Roofing & Exterior': 'Additional Findings'}
                    </h2>
                    
                    <div className="prose max-w-none">
                      <p className="text-gray-700 leading-relaxed whitespace-pre-line">
                        {mockPages?.[currentPage - 1]?.content}
                      </p>
                    </div>

                    {/* Mock inspection images */}
                    <div className="grid grid-cols-2 gap-4 mt-6">
                      <div className="space-y-2">
                        <img 
                          src={`https://picsum.photos/300/200?random=${currentPage}1`}
                          alt="Inspection finding"
                          className="w-full h-32 object-cover rounded border"
                        />
                        <p className="text-xs text-gray-600">Finding #{currentPage}.1</p>
                      </div>
                      <div className="space-y-2">
                        <img 
                          src={`https://picsum.photos/300/200?random=${currentPage}2`}
                          alt="Inspection finding"
                          className="w-full h-32 object-cover rounded border"
                        />
                        <p className="text-xs text-gray-600">Finding #{currentPage}.2</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default PDFViewer;