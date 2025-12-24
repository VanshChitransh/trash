/**
 * ViewPdfModal - A reusable modal component for previewing PDF files from Cloudflare R2 via Worker proxy
 * 
 * REQUIRED ENVIRONMENT VARIABLE:
 * Set one of the following (checked in order):
 * - NEXT_PUBLIC_PREVIEW_BASE_URL (Next.js)
 * - VITE_PREVIEW_BASE_URL (Vite)
 * - REACT_APP_PREVIEW_BASE_URL (CRA)
 * 
 * Example value: https://preview-proxy.your-domain.workers.dev
 * 
 * The Worker proxy must:
 * - Return files with inline disposition
 * - Support byte-range requests
 * - Accept the R2 object key as the path
 */

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import Icon from './AppIcon';
import Button from './ui/Button';
import { cn } from '../utils/cn';

/**
 * Get preview base URL from environment variables
 * Checks in order: NEXT_PUBLIC_PREVIEW_BASE_URL, VITE_PREVIEW_BASE_URL, REACT_APP_PREVIEW_BASE_URL
 */
const getPreviewBaseUrl = () => {
  if (typeof window === 'undefined') return null;
  
  // Check in priority order
  // For Vite: import.meta.env
  // For Next.js: process.env (but NEXT_PUBLIC_* vars are available in browser)
  // For CRA: process.env (REACT_APP_* vars are available in browser)
  let baseUrl = null;
  
  // Helper to validate URL (ignore placeholders)
  const isValidUrl = (url) => {
    if (!url) return false;
    // Ignore placeholder/example URLs
    if (url.includes('your-worker-url') || url.includes('your-domain') || url.includes('example.com')) {
      return false;
    }
    return true;
  };
  
  // Try Vite first (most common for this project)
  if (typeof import.meta !== 'undefined' && import.meta.env) {
    const envUrl = import.meta.env.VITE_PREVIEW_BASE_URL;
    if (isValidUrl(envUrl)) {
      baseUrl = envUrl;
    }
  }
  
  // Try Next.js or CRA (process.env)
  if (!baseUrl && typeof process !== 'undefined' && process.env) {
    const envUrl = process.env.NEXT_PUBLIC_PREVIEW_BASE_URL || 
                   process.env.REACT_APP_PREVIEW_BASE_URL;
    if (isValidUrl(envUrl)) {
      baseUrl = envUrl;
    }
  }
  
  // Fallback: check window object (some build systems inject env vars here)
  if (!baseUrl && typeof window !== 'undefined') {
    const envUrl = window.__NEXT_PUBLIC_PREVIEW_BASE_URL__ ||
                   window.__VITE_PREVIEW_BASE_URL__ ||
                   window.__REACT_APP_PREVIEW_BASE_URL__;
    if (isValidUrl(envUrl)) {
      baseUrl = envUrl;
    }
  }
  
  // Default fallback: use the configured Worker proxy
  if (!baseUrl) {
    baseUrl = 'https://consultabid-r2-proxy.consultabid.workers.dev';
    console.log('🔧 Using default worker URL:', baseUrl);
  } else {
    console.log('✅ Using configured worker URL:', baseUrl);
  }
  
  return baseUrl;
};

/**
 * Normalize base URL to ensure proper trailing slash handling
 */
const normalizeBaseUrl = (url) => {
  if (!url) return null;
  // Remove trailing slashes, we'll add one when concatenating
  return url.replace(/\/+$/, '');
};

/**
 * Normalize and sanitize file key
 * - Remove leading slashes
 * - Prevent path traversal (block ../ sequences)
 * - URI encode the key
 */
const normalizeFileKey = (key) => {
  if (!key) return null;
  
  // Remove leading slashes
  let normalized = key.replace(/^\/+/, '');
  
  // Block path traversal attempts
  if (normalized.includes('../') || normalized.includes('..\\')) {
    console.warn('⚠️ Path traversal attempt blocked:', key);
    return null;
  }
  
  // Split by / and encode each segment separately to preserve structure
  const segments = normalized.split('/').map(segment => encodeURIComponent(segment));
  return segments.join('/');
};

/**
 * Extract file key from a full file URL
 * Handles both new and old R2 public URLs
 */
const extractFileKeyFromUrl = (fileUrl) => {
  if (!fileUrl) return null;
  
  try {
    const url = new URL(fileUrl);
    // Extract pathname and remove leading slash
    const path = url.pathname.replace(/^\/+/, '');
    return path || null;
  } catch (e) {
    // If URL parsing fails, try to extract manually
    const match = fileUrl.match(/\/uploads\/.+/);
    if (match) {
      return match[0].replace(/^\/+/, '');
    }
    return null;
  }
};

/**
 * ViewPdfModal Component
 * 
 * @param {Object} props
 * @param {boolean} props.open - Whether the modal is open
 * @param {Function} props.onClose - Callback when modal should close
 * @param {string} props.fileKey - The R2 object key (e.g., "uploads/userId/file.pdf")
 * @param {string} [props.fileUrl] - Full file URL (alternative to fileKey, key will be extracted)
 * @param {string} [props.title] - Optional title for the modal header
 * @param {string} [props.downloadFileName] - Optional filename for download (defaults to fileKey)
 * @param {number} [props.height] - Modal height in pixels (default: 700)
 * @param {number} [props.width] - Modal width in pixels (default: 900)
 * @param {Function} [props.onOpened] - Optional callback when modal opens
 * @param {Function} [props.onLoaded] - Optional callback when PDF loads successfully
 * @param {Function} [props.onError] - Optional callback when PDF fails to load
 * @param {Function} [props.onClosed] - Optional callback when modal closes
 */
const ViewPdfModal = ({
  open,
  onClose,
  fileKey: fileKeyProp,
  fileUrl,
  title,
  downloadFileName,
  height = 700,
  width = 900,
  onOpened,
  onLoaded,
  onError,
  onClosed,
}) => {
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);
  const [loadTimeout, setLoadTimeout] = useState(null);
  const [iframeKey, setIframeKey] = useState(0); // Force remount on retry
  
  const modalRef = useRef(null);
  const iframeRef = useRef(null);
  const previousActiveElementRef = useRef(null);
  const previewUrlRef = useRef(null);
  
  // Get normalized file key
  const fileKey = useMemo(() => {
    if (fileKeyProp) {
      return normalizeFileKey(fileKeyProp);
    }
    if (fileUrl) {
      const extracted = extractFileKeyFromUrl(fileUrl);
      return extracted ? normalizeFileKey(extracted) : null;
    }
    return null;
  }, [fileKeyProp, fileUrl]);
  
  // Get preview base URL
  const previewBaseUrl = useMemo(() => {
    const baseUrl = getPreviewBaseUrl();
    return baseUrl ? normalizeBaseUrl(baseUrl) : null;
  }, []);
  
  // Helper function to get auth token from cookies
  const getAuthToken = useCallback(() => {
    if (typeof document === 'undefined') return null;
    const cookies = document.cookie.split(';');
    for (let cookie of cookies) {
      const [name, value] = cookie.trim().split('=');
      if (name === 'token') {
        return decodeURIComponent(value);
      }
    }
    return null;
  }, []);

  // Build preview URL with authentication token
  const previewUrl = useMemo(() => {
    if (!previewBaseUrl || !fileKey) return null;
    const token = getAuthToken();
    if (token) {
      return `${previewBaseUrl}/${fileKey}?token=${encodeURIComponent(token)}`;
    }
    return `${previewBaseUrl}/${fileKey}`;
  }, [previewBaseUrl, fileKey, getAuthToken]);
  
  // Store preview URL in ref for download link
  useEffect(() => {
    previewUrlRef.current = previewUrl;
    
    // Debug logging
    if (import.meta.env?.DEV && previewUrl) {
      console.log('🔍 ViewPdfModal - Preview URL constructed:', previewUrl);
      console.log('🔍 ViewPdfModal - File key:', fileKey);
      console.log('🔍 ViewPdfModal - Preview base URL:', previewBaseUrl);
    }
  }, [previewUrl, fileKey, previewBaseUrl]);
  
  // Test if Worker URL is accessible
  const testWorkerUrl = useCallback(async (url) => {
    try {
      // Try to fetch with HEAD request to test accessibility
      // Use no-cors to avoid CORS errors, just check if domain resolves
      const response = await fetch(url, { 
        method: 'HEAD',
        mode: 'no-cors'
      });
      return true;
    } catch (error) {
      if (import.meta.env?.DEV) {
        console.error('❌ ViewPdfModal - Worker URL test failed:', error);
        console.error('❌ ViewPdfModal - URL:', url);
      }
      return false;
    }
  }, []);
  
  // Monitor network requests for the preview URL
  useEffect(() => {
    if (!open || !previewUrl) return;
    
    // Create a performance observer to monitor network requests
    if (import.meta.env?.DEV && 'PerformanceObserver' in window) {
      try {
        const observer = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            if (entry.name.includes(previewUrl) || entry.name.includes('workers.dev')) {
              if (import.meta.env?.DEV) {
                console.log('🌐 ViewPdfModal - Network request:', {
                  url: entry.name,
                  type: entry.initiatorType || entry.entryType,
                  duration: entry.duration,
                  transferSize: entry.transferSize,
                  encodedBodySize: entry.encodedBodySize,
                });
              }
            }
          }
        });
        
        observer.observe({ entryTypes: ['resource', 'navigation'] });
        
        return () => observer.disconnect();
      } catch (error) {
        if (import.meta.env?.DEV) {
          console.warn('⚠️ ViewPdfModal - PerformanceObserver not available:', error);
        }
      }
    }
  }, [open, previewUrl]);
  
  // Handle modal open/close
  useEffect(() => {
    if (open && previewUrl) {
      // Debug logging
      if (import.meta.env?.DEV) {
        console.log('📂 ViewPdfModal - Opening modal');
        console.log('📂 ViewPdfModal - fileUrl prop:', fileUrl);
        console.log('📂 ViewPdfModal - fileKey prop:', fileKeyProp);
        console.log('📂 ViewPdfModal - Extracted fileKey:', fileKey);
        console.log('📂 ViewPdfModal - Preview URL:', previewUrl);
        console.log('📂 ViewPdfModal - Check Network tab in DevTools for request details');
      }
      
      // Store previous active element for focus restoration
      previousActiveElementRef.current = document.activeElement;
      
      // Call onOpened callback
      if (onOpened) {
        onOpened();
      }
      
      // Reset state
      setIsLoading(true);
      setHasError(false);
      setErrorMessage(null);
      setIframeKey(prev => prev + 1); // Force iframe remount
      
      // Test Worker URL accessibility before loading
      if (previewUrl && previewUrl.includes('.workers.dev')) {
        testWorkerUrl(previewUrl).then(isAccessible => {
          if (!isAccessible) {
            if (import.meta.env?.DEV) {
              console.warn('⚠️ ViewPdfModal - Worker URL may not be accessible');
              console.warn('⚠️ ViewPdfModal - URL:', previewUrl);
            }
            // Still try to load, but reduce timeout
            const timeout = setTimeout(() => {
              setHasError(true);
              setErrorMessage('Worker proxy not accessible. Please ensure the Cloudflare Worker is deployed and configured correctly.');
              setIsLoading(false);
              if (onError) {
                onError('timeout');
              }
            }, 5000); // Shorter timeout for Worker
            setLoadTimeout(timeout);
          } else {
            // Worker is accessible, use normal timeout
            const timeout = setTimeout(() => {
              setHasError(true);
              setErrorMessage('Loading timeout. The PDF may be large or the connection is slow.');
              setIsLoading(false);
              if (onError) {
                onError('timeout');
              }
            }, 10000);
            setLoadTimeout(timeout);
          }
        }).catch(() => {
          // If test fails, still try to load with shorter timeout
          const timeout = setTimeout(() => {
            setHasError(true);
            setErrorMessage('Worker proxy not accessible. Please ensure the Cloudflare Worker is deployed and configured correctly.');
            setIsLoading(false);
            if (onError) {
              onError('timeout');
            }
          }, 5000);
          setLoadTimeout(timeout);
        });
      } else {
        // Not a Worker URL, use normal timeout
        const timeout = setTimeout(() => {
          setHasError(true);
          setErrorMessage('Loading timeout. The PDF may be large or the connection is slow.');
          setIsLoading(false);
          if (onError) {
            onError('timeout');
          }
        }, 10000);
        setLoadTimeout(timeout);
      }
    } else {
      // Clear timeout on close
      if (loadTimeout) {
        clearTimeout(loadTimeout);
        setLoadTimeout(null);
      }
      
      // Restore focus
      if (previousActiveElementRef.current && previousActiveElementRef.current.focus) {
        previousActiveElementRef.current.focus();
      }
      
      // Call onClosed callback
      if (onClosed) {
        onClosed();
      }
    }
    
    return () => {
      if (loadTimeout) {
        clearTimeout(loadTimeout);
      }
    };
  }, [open, previewUrl, isLoading, onOpened, onClosed, onError, testWorkerUrl]);

  // Handle iframe load
  const handleIframeLoad = useCallback(() => {
    if (import.meta.env?.DEV) {
      console.log('✅ ViewPdfModal - Iframe loaded successfully');
    }
    
    setIsLoading(false);
    setHasError(false);
    setErrorMessage(null);
    
    if (loadTimeout) {
      clearTimeout(loadTimeout);
      setLoadTimeout(null);
    }
    
    if (onLoaded) {
      onLoaded();
    }
  }, [loadTimeout, onLoaded]);
  
  // Handle iframe error
  const handleIframeError = useCallback(() => {
    if (import.meta.env?.DEV) {
      console.error('❌ ViewPdfModal - PDF failed to load');
      console.error('❌ ViewPdfModal - Preview URL was:', previewUrlRef.current);
      console.error('❌ ViewPdfModal - Check browser Network tab for detailed error');
    }
    
    setIsLoading(false);
    setHasError(true);
    
    // Check if Worker domain might be the issue
    const workerUrl = previewUrlRef.current;
    if (workerUrl && workerUrl.includes('.workers.dev')) {
      setErrorMessage('Failed to load PDF. The Cloudflare Worker proxy may not be deployed or configured. Check that the Worker is accessible at the preview URL.');
    } else {
      setErrorMessage('Failed to load PDF. The file may not be available or there was a network error.');
    }
    
    if (loadTimeout) {
      clearTimeout(loadTimeout);
      setLoadTimeout(null);
    }
    
    if (onError) {
      onError('network');
    }
  }, [loadTimeout, onError]);
  
  // Handle retry
  const handleRetry = useCallback(() => {
    setIsLoading(true);
    setHasError(false);
    setErrorMessage(null);
    setIframeKey(prev => prev + 1); // Force iframe remount
    
    // Reset timeout
    if (loadTimeout) {
      clearTimeout(loadTimeout);
    }
    
    const timeout = setTimeout(() => {
      setHasError(true);
      setErrorMessage('Loading timeout. The PDF may be large or the connection is slow.');
      setIsLoading(false);
      if (onError) {
        onError('timeout');
      }
    }, 10000);
    
    setLoadTimeout(timeout);
  }, [loadTimeout, onError]);
  
  // Handle Escape key
  useEffect(() => {
    const handleEscape = (e) => {
      if (open && e.key === 'Escape') {
        onClose();
      }
    };
    
    if (open) {
      document.addEventListener('keydown', handleEscape);
      return () => document.removeEventListener('keydown', handleEscape);
    }
  }, [open, onClose]);
  
  // Focus trap
  useEffect(() => {
    if (!open || !modalRef.current) return;
    
    const modal = modalRef.current;
    const focusableElements = modal.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];
    
    const handleTab = (e) => {
      if (e.key !== 'Tab') return;
      
      if (e.shiftKey) {
        if (document.activeElement === firstElement) {
          e.preventDefault();
          lastElement?.focus();
        }
      } else {
        if (document.activeElement === lastElement) {
          e.preventDefault();
          firstElement?.focus();
        }
      }
    };
    
    // Focus first element when modal opens
    if (firstElement) {
      firstElement.focus();
    }
    
    modal.addEventListener('keydown', handleTab);
    return () => modal.removeEventListener('keydown', handleTab);
  }, [open]);
  
  // Handle backdrop click
  const handleBackdropClick = useCallback((e) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  }, [onClose]);
  
  // Handle download
  const handleDownload = useCallback(async () => {
    if (!previewUrlRef.current) return;
    
    try {
      // Fetch the file as a blob to force download regardless of Content-Disposition header
      const response = await fetch(previewUrlRef.current);
      if (!response.ok) {
        throw new Error(`Failed to fetch file: ${response.status} ${response.statusText}`);
      }
      
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      
      // Create download link
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = downloadFileName || fileKey?.split('/').pop() || 'document.pdf';
      link.rel = 'noopener noreferrer';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      // Clean up blob URL after a short delay
      setTimeout(() => {
        URL.revokeObjectURL(blobUrl);
      }, 100);
    } catch (error) {
      console.error('Download failed:', error);
      // Fallback to direct link download if fetch fails
      const link = document.createElement('a');
      link.href = previewUrlRef.current;
      link.download = downloadFileName || fileKey?.split('/').pop() || 'document.pdf';
      link.rel = 'noopener noreferrer';
      link.target = '_blank';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  }, [downloadFileName, fileKey]);
  
  // Handle open in new tab
  const handleOpenInNewTab = useCallback(() => {
    if (!previewUrlRef.current) return;
    window.open(previewUrlRef.current, '_blank', 'noopener,noreferrer');
  }, []);
  
  // Don't render if not open
  if (!open) return null;
  
  // Configuration error state
  if (!previewBaseUrl) {
    return (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
        onClick={handleBackdropClick}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
      >
        <div
          ref={modalRef}
          className="bg-card border border-border rounded-lg p-6 max-w-md w-full mx-4 shadow-lg"
          onClick={(e) => e.stopPropagation()}
        >
          <h2 id="modal-title" className="text-lg font-semibold mb-4">
            Configuration Required
          </h2>
          <p className="text-muted-foreground mb-4">
            The preview proxy base URL is not configured. Please set one of the following environment variables:
          </p>
          <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground mb-4">
            <li><code>VITE_PREVIEW_BASE_URL</code> (Vite)</li>
            <li><code>NEXT_PUBLIC_PREVIEW_BASE_URL</code> (Next.js)</li>
            <li><code>REACT_APP_PREVIEW_BASE_URL</code> (CRA)</li>
          </ul>
          <p className="text-sm text-muted-foreground mb-4">
            Example: <code>https://preview-proxy.your-domain.workers.dev</code>
          </p>
          <Button onClick={onClose} className="w-full">
            Close
          </Button>
        </div>
      </div>
    );
  }
  
  // Missing file key error
  if (!fileKey) {
    return (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
        onClick={handleBackdropClick}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
      >
        <div
          ref={modalRef}
          className="bg-card border border-border rounded-lg p-6 max-w-md w-full mx-4 shadow-lg"
          onClick={(e) => e.stopPropagation()}
        >
          <h2 id="modal-title" className="text-lg font-semibold mb-4">
            Invalid File
          </h2>
          <p className="text-muted-foreground mb-4">
            Unable to determine the file key. Please provide a valid fileKey or fileUrl prop.
          </p>
          <Button onClick={onClose} className="w-full">
            Close
          </Button>
        </div>
      </div>
    );
  }
  
  // Determine display title
  const displayTitle = title || fileKey.split('/').pop() || 'PDF Preview';
  const truncatedTitle = displayTitle.length > 50 
    ? `${displayTitle.substring(0, 47)}...` 
    : displayTitle;
  
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={handleBackdropClick}
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
    >
      <div
        ref={modalRef}
        className={cn(
          "bg-card border border-border rounded-lg shadow-lg flex flex-col",
          "max-w-[95vw] max-h-[95vh] w-full",
          "transform transition-all"
        )}
        style={{ width: `${Math.min(width, window.innerWidth * 0.95)}px`, height: `${Math.min(height, window.innerHeight * 0.95)}px` }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h2
            id="modal-title"
            className="text-lg font-semibold truncate flex-1 mr-4"
            title={displayTitle}
          >
            {truncatedTitle}
          </h2>
          
          <div className="flex items-center gap-2">
            {/* Open in new tab */}
            <Button
              variant="ghost"
              size="sm"
              onClick={handleOpenInNewTab}
              aria-label="Open PDF in new tab"
              title="Open in new tab"
            >
              <Icon name="ExternalLink" size={16} />
            </Button>
            
            {/* Download */}
            <Button
              variant="ghost"
              size="sm"
              onClick={handleDownload}
              aria-label="Download PDF"
              title="Download PDF"
            >
              <Icon name="Download" size={16} />
            </Button>
            
            {/* Close */}
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              aria-label="Close modal"
              title="Close"
            >
              <Icon name="X" size={16} />
            </Button>
          </div>
        </div>
        
        {/* Body */}
        <div className="flex-1 relative overflow-hidden">
          {/* Loading state */}
          {isLoading && !hasError && (
            <div className="absolute inset-0 flex items-center justify-center bg-background/80 z-10">
              <div className="text-center">
                <Icon name="Loader2" size={32} className="animate-spin text-primary mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">Loading PDF...</p>
              </div>
            </div>
          )}
          
          {/* Error state */}
          {hasError && (
            <div className="absolute inset-0 flex items-center justify-center bg-background z-10 p-6">
              <div className="text-center max-w-md">
                <Icon name="AlertCircle" size={32} className="text-destructive mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">Failed to Load PDF</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  {errorMessage || 'The PDF could not be loaded. It may not be available or there was a network error.'}
                </p>
                {import.meta.env?.DEV && previewUrl && (
                  <div className="text-xs text-muted-foreground bg-muted p-3 rounded text-left mb-4 max-w-md">
                    <p><strong>Preview URL:</strong></p>
                    <p className="break-all">{previewUrl}</p>
                    <p className="mt-2"><strong>Debug Steps:</strong></p>
                    <ol className="list-decimal list-inside space-y-1 mt-1">
                      <li>Open browser DevTools → Network tab</li>
                      <li>Look for the request to the Worker URL</li>
                      <li>Check if it returns 404, DNS error, or CORS error</li>
                      <li>Verify Worker is deployed at: {previewBaseUrl}</li>
                      <li>Test Worker URL directly in browser: <a href={previewUrl} target="_blank" rel="noopener noreferrer" className="text-primary underline">Open in new tab</a></li>
                    </ol>
                    <p className="mt-2"><strong>Common Issues:</strong></p>
                    <ul className="list-disc list-inside space-y-1 mt-1">
                      <li>Worker not deployed or domain doesn't exist</li>
                      <li>R2 bucket binding not configured in Worker</li>
                      <li>CORS headers not set correctly</li>
                      <li>File doesn't exist in R2 bucket</li>
                    </ul>
                  </div>
                )}
                <div className="flex gap-2 justify-center flex-wrap">
                  <Button onClick={handleRetry} variant="outline">
                    <Icon name="RefreshCw" size={16} className="mr-2" />
                    Retry
                  </Button>
                  <Button onClick={handleOpenInNewTab} variant="outline">
                    <Icon name="ExternalLink" size={16} className="mr-2" />
                    Open in New Tab
                  </Button>
                  <Button onClick={onClose} variant="ghost">
                    Close
                  </Button>
                </div>
              </div>
            </div>
          )}
          
          {/* PDF iframe */}
          {previewUrl ? (
            <iframe
              key={iframeKey}
              ref={iframeRef}
              src={previewUrl}
              className={cn(
                "w-full h-full border-0",
                (isLoading || hasError) && "opacity-0 pointer-events-none"
              )}
              title={displayTitle}
              onLoad={handleIframeLoad}
              onError={handleIframeError}
              aria-label={`PDF preview: ${displayTitle}`}
              allow="fullscreen"
              onLoadStart={() => {
                if (import.meta.env?.DEV) {
                  console.log('🔄 ViewPdfModal - Iframe started loading:', previewUrl);
                }
              }}
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center bg-background z-10">
              <div className="text-center p-6">
                <Icon name="AlertCircle" size={32} className="text-destructive mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">Invalid Preview URL</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Unable to construct preview URL. Please check the configuration.
                </p>
                {import.meta.env?.DEV && (
                  <div className="text-xs text-muted-foreground bg-muted p-3 rounded text-left max-w-md">
                    <p><strong>Preview URL:</strong> {previewUrl || 'null'}</p>
                    <p><strong>File Key:</strong> {fileKey || 'null'}</p>
                    <p><strong>Base URL:</strong> {previewBaseUrl || 'null'}</p>
                    <p><strong>File URL Prop:</strong> {fileUrl || 'null'}</p>
                    <p><strong>File Key Prop:</strong> {fileKeyProp || 'null'}</p>
                  </div>
                )}
                <Button onClick={onClose} className="mt-4">
                  Close
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ViewPdfModal;

