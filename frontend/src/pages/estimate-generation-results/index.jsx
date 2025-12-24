import React, { useState, useEffect, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import Header from '../../components/ui/Header';
import Breadcrumb from '../../components/ui/Breadcrumb';
import Icon from '../../components/AppIcon';
import Button from '../../components/ui/Button';
import Toast from '../../components/ui/Toast';
import { logout } from '../../utils/logout';
import { api } from '../../utils/api';
import { useNotifications } from '../../contexts/NotificationContext';
import { isAdminUser } from '../../utils/admin';

// Import all components
import GenerationOptions from './components/GenerationOptions';
import ProcessingIndicator from './components/ProcessingIndicator';
import EstimateOverview from './components/EstimateOverview';
import DetailedBreakdown from './components/DetailedBreakdown';
import CostCalculator from './components/CostCalculator';
import PriorityRecommendations from './components/PriorityRecommendations';
import ExportOptions from './components/ExportOptions';

const EstimateGenerationResults = () => {
  const [currentStep, setCurrentStep] = useState('options'); // options, processing, results, waiting
  const [activeTab, setActiveTab] = useState('overview');
  const [processingStep, setProcessingStep] = useState(0);
  const [processingProgress, setProcessingProgress] = useState(0);
  const [analysisType, setAnalysisType] = useState('detailed');
  const [estimateData, setEstimateData] = useState(null);
  const [user, setUser] = useState(null);
  const [files, setFiles] = useState([]);
  const [selectedFile, setSelectedFile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);
  const [paymentSession, setPaymentSession] = useState(null);
  const [paymentStatus, setPaymentStatus] = useState(null); // null, PENDING, PAID, EXPIRED, FAILED

  const location = useLocation();
  const navigate = useNavigate();
  const { addNotification } = useNotifications();
  const isAdminAccount = useMemo(() => isAdminUser(user), [user]);

  const PAID_FILES_KEY = 'consultabid_paid_files';

  const loadPaidFiles = () => {
    try {
      const raw = localStorage.getItem(PAID_FILES_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  };

  const persistPaidFile = (fileId) => {
    if (!fileId) return;
    const existing = loadPaidFiles();
    if (existing.includes(fileId)) return;
    try {
      localStorage.setItem(PAID_FILES_KEY, JSON.stringify([...existing, fileId]));
    } catch {
      // ignore
    }
  };

  const isFilePaidLocally = (fileId) => loadPaidFiles().includes(fileId);

  // Load pending payment session from storage on mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem('consultabid_payment_session');
      if (raw) {
        const parsed = JSON.parse(raw);
        setPaymentSession(parsed);
      }
    } catch (err) {
      console.warn('Failed to load payment session:', err);
    }
  }, []);

  // Restore paid status for selected file (e.g., after refresh)
  useEffect(() => {
    if (selectedFile?.id && isFilePaidLocally(selectedFile.id)) {
      setPaymentStatus('PAID');
    }
  }, [selectedFile?.id]);

  // Fetch user and files on mount
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        
        // Get user from localStorage
        const storedUser = localStorage.getItem('user');
        if (storedUser) {
          setUser(JSON.parse(storedUser));
        }
        
        // Check if we should set active tab from location state (e.g., returning from PDF viewer)
        if (location?.state?.activeTab) {
          setActiveTab(location.state.activeTab);
        }
        
        // Fetch files from API
        const filesResponse = await api.get('/api/files');
        if (filesResponse && filesResponse.success && filesResponse.data) {
          const allFiles = filesResponse.data.map(file => ({
            id: file.id,
            name: file.name,
            size: file.size,
            sizeFormatted: `${(file.size / (1024 * 1024)).toFixed(2)} MB`,
            uploadDate: file.uploadDate,
            uploadDateFormatted: new Date(file.uploadDate).toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
              year: 'numeric'
            }),
            fileUrl: file.fileUrl,
            pages: file.pages || null,
            hasEstimate: file.hasEstimate || false,
            estimateId: file.estimateId || null,
            status: file.status || 'completed'
          }));
          
          setFiles(allFiles);
          
          // If file is passed via location state, use it, otherwise use first file
          let fileToSelect = null;
          if (location?.state?.file) {
            fileToSelect = allFiles.find(f => f.id === location.state.file.id) || allFiles[0] || null;
          } else {
            fileToSelect = allFiles[0] || null;
          }
          
          // Set selected file
          if (fileToSelect) {
            setSelectedFile(fileToSelect);

            // Only auto-load estimate if explicitly requested via location state
            // This happens when user clicks "Estimate" button
            if (location?.state?.autoLoadEstimate && fileToSelect.hasEstimate) {
              // Load estimate after a short delay to ensure state is set
              setTimeout(() => {
                loadExistingEstimate(fileToSelect);
              }, 100);
            } else {
              // Default: show options page, but if we have activeTab, show results
              if (location?.state?.activeTab) {
                // If returning with activeTab, we need to load the estimate first
                if (fileToSelect.hasEstimate) {
                  setTimeout(() => {
                    loadExistingEstimate(fileToSelect);
                  }, 100);
                } else {
                  setCurrentStep('options');
                }
              } else {
                setCurrentStep('options');
              }
            }
          } else {
            setCurrentStep('options');
          }
        }
      } catch (err) {
        console.error('Error fetching files:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [location?.state]);

  // Get file data for display (use selected file or fallback)
  const fileData = selectedFile ? {
    name: selectedFile.name,
    size: selectedFile.sizeFormatted,
    uploadDate: selectedFile.uploadDateFormatted,
    pages: selectedFile.pages || 10 // Use actual page count if available
  } : null;

  // Tab order: Overview -> Detailed Breakdown -> Download -> Cost Calculator -> Recommendations
  const tabs = [
    { id: 'overview', label: 'Overview', icon: 'PieChart', disabled: false },
    { id: 'breakdown', label: 'Detailed Breakdown', icon: 'List', disabled: false },
    { id: 'export', label: 'Download', icon: 'Download', disabled: false },
    { id: 'calculator', label: 'Cost Calculator', icon: 'Calculator', disabled: true },
    { id: 'recommendations', label: 'Recommendations', icon: 'Target', disabled: true }
  ];

  const breadcrumbItems = [
    { label: 'Dashboard', path: '/dashboard-overview', isHome: true },
    { label: 'Files', path: '/file-upload-management' },
    { label: fileData?.name || 'Select File', path: null },
    { label: 'Estimate', path: null, isLast: true }
  ];

  // Load existing estimate for a file
  const loadExistingEstimate = async (file) => {
    if (!file.hasEstimate || !file.id) {
      return;
    }

    try {
      setCurrentStep('processing');
      setProcessingProgress(0);
      setProcessingStep(0);
      
      // Show a quick loading state
      setProcessingProgress(50);
      setProcessingStep(1);
      
      // Call the process-estimate endpoint which will return existing data if available
      const response = await api.post(`/api/files/${file.id}/process-estimate`, {
        analysisType: analysisType
      }, {
        timeout: 30000 // 30 seconds timeout for fetching existing data
      });
      
      if (response && response.success && response.data) {
        setProcessingProgress(100);
        setProcessingStep(3);
        
        // Wait a moment for UI update
        setTimeout(() => {
          setCurrentStep('results');
          
          // Calculate critical issues count from totals_by_severity
          const totalsBySeverity = response.data.extraction?.summary?.totals_by_severity || [];
          let criticalCount = 0;
          if (Array.isArray(totalsBySeverity)) {
            const criticalEntry = totalsBySeverity.find(s => 
              s.severity?.toLowerCase().includes('critical') || 
              s.severity?.toLowerCase().includes('safety')
            );
            criticalCount = criticalEntry?.count || 0;
          }
          
          const estimateDataToSet = {
            totalCost: response.data.estimate?.summary?.total_usd || response.data.estimate?.summary?.total_estimate || response.data.estimate?.totalAmount || 0,
            issuesFound: response.data.extraction?.summary?.total_issues || response.data.extraction?.issues?.length || 0,
            criticalIssues: criticalCount,
            timeline: '6-8 weeks',
            generatedAt: new Date().toISOString(),
            extractionData: response.data.extraction,
            estimateData: response.data.estimate
          };
          
          // Debug: Log the data structure being set
          console.log('=== loadExistingEstimate: Setting Estimate Data ===');
          console.log('Full response.data:', response.data);
          console.log('response.data.estimate:', response.data.estimate);
          console.log('response.data.extraction:', response.data.extraction);
          console.log('estimateDataToSet:', estimateDataToSet);
          console.log('Estimate items count:', response.data.estimate?.items?.length || 0);
          console.log('Estimate issues count (legacy):', response.data.estimate?.issues?.length || 0);
          console.log('Extraction issues count:', response.data.extraction?.issues?.length || 0);
          if (response.data.estimate?.items?.length > 0) {
            console.log('First estimate item:', response.data.estimate.items[0]);
          } else if (response.data.estimate?.issues?.length > 0) {
            console.log('First estimate issue (legacy):', response.data.estimate.issues[0]);
          }
          if (response.data.extraction?.issues?.length > 0) {
            console.log('First extraction issue:', response.data.extraction.issues[0]);
          }
          console.log('=== End loadExistingEstimate Debug ===');
          
          setEstimateData(estimateDataToSet);

          // Show success toast
          setToast({
            message: 'Estimate loaded successfully',
            type: 'success'
          });
          
          // Add notification
          addNotification({
            type: 'success',
            title: 'Estimate Ready',
            message: `Estimate for ${file?.name || 'your file'} has been generated successfully`,
          });
        }, 500);
      }
    } catch (error) {
      console.error('Error loading existing estimate:', error);
      
      // Check if it's a 503 error (service overloaded)
      const isServiceOverloaded = error.status === 503 || 
                                  error?.data?.errorCode === 'SERVICE_OVERLOADED' ||
                                  error?.message?.includes('503') ||
                                  error?.message?.includes('overloaded') ||
                                  error?.message?.includes('temporarily unavailable');
      
      if (isServiceOverloaded) {
        setToast({
          message: 'Currently we are facing error, please retry after some time',
          type: 'error'
        });
        
        // Also add notification
        addNotification({
          type: 'error',
          title: 'Service Temporarily Unavailable',
          message: 'Currently we are facing error, please retry after some time',
        });
      }
      
      // If error loading, go to options to allow reprocessing
      setCurrentStep('options');
    }
  };

  const clearPaymentSession = () => {
    setPaymentSession(null);
    localStorage.removeItem('consultabid_payment_session');
  };

  const startPaymentFlow = async (amountTier) => {
    if (!selectedFile?.id) {
      setToast({
        message: 'Please select a PDF file first',
        type: 'warning'
      });
      return;
    }

    try {
      if (isAdminAccount) {
        clearPaymentSession();
        setPaymentStatus('PAID');
        setToast({
          message: 'Admin access detected. Payment is not required for this account.',
          type: 'success'
        });
        return;
      }

      setToast({
        message: 'Redirecting to payment... please use the same email you are logged in with.',
        type: 'info'
      });

      addNotification({
        type: 'info',
        title: 'Payment Required',
        message: 'Use your account email for payment to avoid delays.',
      });

      const response = await api.post('/api/payments/start', {
        fileId: selectedFile.id,
        amountTier,
      });

      if (response?.data?.paymentId) {
        const session = {
          id: response.data.paymentId,
          amountTier,
          expiresAt: response.data.expiresAt,
        };
        setPaymentSession(session);
        setPaymentStatus('PENDING');
        localStorage.setItem('consultabid_payment_session', JSON.stringify(session));
      }

      if (response?.data?.redirectUrl) {
        window.alert('Please pay using the same email you are logged in with.');
        window.location.href = response.data.redirectUrl;
      }
    } catch (error) {
      console.error('startPaymentFlow error:', error);
      setToast({
        message: 'Unable to start payment. Please try again.',
        type: 'error'
      });
    }
  };

  useEffect(() => {
    if (isAdminAccount) {
      setPaymentStatus('PAID');
      clearPaymentSession();
      return;
    }
    if (!paymentSession?.id) return;

    let cancelled = false;
    const expiresAtMs = paymentSession.expiresAt
      ? new Date(paymentSession.expiresAt).getTime()
      : Date.now() + 2 * 60 * 1000;

    const poll = async () => {
      if (cancelled) return;
      if (Date.now() > expiresAtMs) {
        setPaymentStatus('EXPIRED');
        clearPaymentSession();
        setToast({
          message: 'Payment window expired. Please retry.',
          type: 'warning'
        });
        return;
      }

      try {
        const resp = await api.get(`/api/payments/status/${paymentSession.id}`);
        const status = resp?.data?.data?.status || resp?.data?.status || null;
        if (status) {
          setPaymentStatus(status);
        }

        if (status === 'PAID') {
          if (selectedFile?.id) {
            persistPaidFile(selectedFile.id);
          }
          clearPaymentSession();
          setToast({
            message: 'Payment confirmed. You can generate your estimate.',
            type: 'success'
          });
          return;
        }
      } catch (err) {
        console.warn('Payment status poll failed:', err?.message || err);
      }

      setTimeout(poll, 5000);
    };

    poll();

    return () => {
      cancelled = true;
    };
  }, [paymentSession?.id, isAdminAccount]);

  // Process PDF through Gemini pipeline
  const processEstimate = async (fileId) => {
    try {
      setCurrentStep('processing');
      setProcessingProgress(0);
      setProcessingStep(0);

      // Simulate progress updates (since the actual processing takes time)
      let currentProgress = 0;
      const progressInterval = setInterval(() => {
        setProcessingProgress(prev => {
          if (prev >= 90) {
            currentProgress = prev;
            return prev; // Don't go to 100 until we get response
          }
          currentProgress = prev + Math.random() * 5;
          return currentProgress;
        });
        
        setProcessingStep(prev => {
          const step = Math.floor(currentProgress / 25);
          return Math.min(step, 3);
        });
      }, 2000);

      // Call backend API to process PDF (this can take several minutes)
      const response = await api.post(`/api/files/${fileId}/process-estimate`, {
        analysisType: analysisType
      }, {
        timeout: 600000 // 10 minutes timeout for long-running requests
      });

      clearInterval(progressInterval);

      if (response && response.success) {
        // Update progress
        setProcessingProgress(100);
        setProcessingStep(3);

        // Wait a moment for UI update
        setTimeout(() => {
          setCurrentStep('results');
          
          // Calculate critical issues count from totals_by_severity
          const totalsBySeverity = response.data.extraction?.summary?.totals_by_severity || [];
          let criticalCount = 0;
          if (Array.isArray(totalsBySeverity)) {
            const criticalEntry = totalsBySeverity.find(s => 
              s.severity?.toLowerCase().includes('critical') || 
              s.severity?.toLowerCase().includes('safety')
            );
            criticalCount = criticalEntry?.count || 0;
          }
          
          const estimateDataToSet = {
            totalCost: response.data.estimate?.summary?.total_usd || response.data.estimate?.summary?.total_estimate || response.data.estimate?.totalAmount || 0,
            issuesFound: response.data.extraction?.summary?.total_issues || response.data.extraction?.issues?.length || 0,
            criticalIssues: criticalCount,
            timeline: '6-8 weeks',
            generatedAt: new Date().toISOString(),
            extractionData: response.data.extraction,
            estimateData: response.data.estimate
          };
          
          // Debug: Log the data structure being set
          console.log('=== processEstimate: Setting Estimate Data ===');
          console.log('Full response.data:', response.data);
          console.log('response.data.estimate:', response.data.estimate);
          console.log('response.data.extraction:', response.data.extraction);
          console.log('estimateDataToSet:', estimateDataToSet);
          console.log('Estimate items count:', response.data.estimate?.items?.length || 0);
          console.log('Estimate issues count (legacy):', response.data.estimate?.issues?.length || 0);
          console.log('Extraction issues count:', response.data.extraction?.issues?.length || 0);
          if (response.data.estimate?.items?.length > 0) {
            console.log('First estimate item:', response.data.estimate.items[0]);
          } else if (response.data.estimate?.issues?.length > 0) {
            console.log('First estimate issue (legacy):', response.data.estimate.issues[0]);
          }
          if (response.data.extraction?.issues?.length > 0) {
            console.log('First extraction issue:', response.data.extraction.issues[0]);
          }
          console.log('=== End processEstimate Debug ===');
          
          setEstimateData(estimateDataToSet);

          // Show success toast
          setToast({
            message: 'Estimation done',
            type: 'success'
          });
          
          // Add notification
          addNotification({
            type: 'success',
            title: 'Estimate Generated',
            message: `Your estimate for ${selectedFile?.name || 'the selected file'} is ready`,
          });
        }, 1000);
      } else {
        throw new Error(response?.message || 'Failed to process estimate');
      }
    } catch (error) {
      console.error('Error processing estimate:', error);

      // Check if it's a 429 error (processing already running)
      if (error.status === 429) {
        setCurrentStep('options'); // Stay on options page

        setToast({
          message: 'An estimate is already being generated. Please try again shortly.',
          type: 'warning'
        });

        addNotification({
          type: 'warning',
          title: 'Processing in Progress',
          message: 'An estimate is already in progress for this file. Please retry in a moment.',
        });
        return;
      }

      // Check if it's a 503 error (service overloaded)
      const isServiceOverloaded = error.status === 503 ||
                                  error?.data?.errorCode === 'SERVICE_OVERLOADED' ||
                                  error?.message?.includes('503') ||
                                  error?.message?.includes('overloaded') ||
                                  error?.message?.includes('temporarily unavailable');

      if (isServiceOverloaded) {
        setToast({
          message: 'Currently we are facing error, please retry after some time',
          type: 'error'
        });

        // Also add notification
        addNotification({
          type: 'error',
          title: 'Service Temporarily Unavailable',
          message: 'Currently we are facing error, please retry after some time',
        });
      } else {
        setToast({
          message: error.message || 'Failed to generate estimate. Please try again.',
          type: 'error'
        });
      }

      setCurrentStep('options');
    }
  };

  const handleGenerate = async (selectedType) => {
    if (!selectedFile?.id) {
      setToast({
        message: 'Please select a PDF file first',
        type: 'warning'
      });
      return;
    }

    const tier = selectedType === 'full' ? '89' : '39';

    // Require payment before generation (admins bypass)
    if (!isAdminAccount && paymentStatus !== 'PAID') {
      setToast({
        message: 'Payment required before generating an estimate. Redirecting to payment...',
        type: 'info'
      });
      await startPaymentFlow(tier);
      return;
    }

    setAnalysisType(selectedType);
    setActiveTab('overview');
    setToast({
      message: 'Generating your estimate...',
      type: 'info'
    });

    await processEstimate(selectedFile.id);
  };

  const handleCalculatorUpdate = (newTotal) => {
    setEstimateData(prev => ({
      ...prev,
      totalCost: newTotal
    }));
  };

  const handleExport = (exportConfig) => {
    // Simulate export process
    console.log('Exporting with config:', exportConfig);
    // In real app, this would trigger the actual export
  };

  const handleLogout = async () => {
    await logout(navigate);
  };

  const handleFileSelect = (file) => {
    setSelectedFile(file);
    setEstimateData(null);
    
    // When manually selecting a file on the estimate page, always show options
    // Auto-loading only happens when coming from the Estimate button
    setCurrentStep('options');
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 'options':
        return (
          <div className="space-y-6">
            {/* File Selection */}
            {files.length > 0 && (
              <div className="bg-card border border-border rounded-lg p-6">
                <h3 className="text-lg font-semibold text-foreground mb-4">Select PDF File</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {files.map((file) => (
                    <div
                      key={file.id}
                      onClick={() => handleFileSelect(file)}
                      className={`p-4 border rounded-lg cursor-pointer transition-all ${
                        selectedFile?.id === file.id
                          ? 'border-primary bg-primary/5'
                          : 'border-border hover:border-primary/50'
                      }`}
                    >
                      <div className="flex items-start space-x-3">
                        <div className="p-2 bg-primary/10 rounded-lg">
                          <Icon name="FileText" size={20} className="text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="font-medium text-foreground truncate">{file.name}</h4>
                          <p className="text-sm text-muted-foreground mt-1">
                            {file.sizeFormatted} • {file.uploadDateFormatted}
                          </p>
                          {file.hasEstimate && (
                            <span className="inline-flex items-center mt-2 text-xs text-success">
                              <Icon name="CheckCircle" size={12} className="mr-1" />
                              Estimate available
                            </span>
                          )}
                        </div>
                        {selectedFile?.id === file.id && (
                          <Icon name="CheckCircle" size={20} className="text-primary flex-shrink-0" />
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* File Information */}
            {selectedFile && fileData ? (
              <div className="bg-card border border-border rounded-lg p-6">
                <div className="flex items-center space-x-4">
                  <div className="p-3 bg-primary/10 rounded-lg">
                    <Icon name="FileText" size={24} className="text-primary" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center space-x-3">
                      <h2 className="text-lg font-semibold text-foreground">{fileData.name}</h2>
                    </div>
                    <div className="flex items-center space-x-4 text-sm text-muted-foreground mt-1">
                      <span>{fileData.size}</span>
                      <span>•</span>
                      <span>{fileData.pages} pages</span>
                      <span>•</span>
                      <span>Uploaded {fileData.uploadDate}</span>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={async () => {
                      if (!selectedFile?.id) return;
                      try {
                        // Get preview URL from backend (includes authentication token)
                        const response = await api.get(`/api/files/${selectedFile.id}/preview`);
                        if (response && response.success && response.data && response.data.previewUrl) {
                          // Open preview URL in new tab with worker proxy and authentication
                          window.open(response.data.previewUrl, '_blank', 'noopener,noreferrer');
                        } else {
                          console.error('Failed to get preview URL');
                        }
                      } catch (err) {
                        console.error('Error getting preview URL:', err);
                      }
                    }}
                    iconName="Eye"
                    iconPosition="left"
                  >
                    View PDF
                  </Button>
                </div>
              </div>
            ) : (
              <div className="bg-card border border-border rounded-lg p-6 text-center">
                <Icon name="FileText" size={48} className="text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-medium text-foreground mb-2">No files available</h3>
                <p className="text-muted-foreground mb-4">Upload PDF files to generate estimates</p>
                <Button
                  variant="default"
                  onClick={() => navigate('/file-upload-management')}
                  iconName="Upload"
                  iconPosition="left"
                >
                  Upload Files
                </Button>
              </div>
            )}
            
            {selectedFile && (
              <GenerationOptions
                onGenerate={handleGenerate}
                isProcessing={currentStep === 'processing'}
                hasEstimate={selectedFile.hasEstimate}
                onStartPayment={startPaymentFlow}
                paymentStatus={paymentStatus}
                isAdminUser={isAdminAccount}
                onViewEstimate={() => {
                  if (selectedFile.hasEstimate) {
                    loadExistingEstimate(selectedFile);
                  }
                }}
              />
            )}
          </div>
        );

      case 'processing':
        return (
          <ProcessingIndicator
            currentStep={processingStep}
            totalSteps={4}
            stepName={['Analyzing Document', 'Identifying Issues', 'Calculating Costs', 'Generating Report']?.[processingStep]}
            progress={processingProgress}
          />
        );

      case 'results':
        return (
          <div className="space-y-6">
            {/* Results Header */}
            <div className="bg-card border border-border rounded-lg p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-xl font-semibold text-foreground">Estimate Complete</h2>
                  <p className="text-muted-foreground">
                    Analysis completed for {fileData?.name} • {analysisType} analysis
                  </p>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="flex items-center space-x-1 text-sm text-accent">
                    <Icon name="CheckCircle" size={16} />
                    <span>Generated successfully</span>
                  </div>
                </div>
              </div>

              {/* Quick Stats */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center p-3 bg-muted/30 rounded-lg">
                  <p className="text-2xl font-bold text-primary">
                    ${typeof estimateData?.totalCost === 'number' ? estimateData.totalCost.toLocaleString() : '0'}
                  </p>
                  <p className="text-sm text-muted-foreground">Total Estimate</p>
                </div>
                <div className="text-center p-3 bg-muted/30 rounded-lg">
                  <p className="text-2xl font-bold text-foreground">{estimateData?.issuesFound || 0}</p>
                  <p className="text-sm text-muted-foreground">Issues Found</p>
                </div>
                <div className="text-center p-3 bg-muted/30 rounded-lg">
                  <p className="text-2xl font-bold text-error">{estimateData?.criticalIssues || 0}</p>
                  <p className="text-sm text-muted-foreground">Critical</p>
                </div>
                <div className="text-center p-3 bg-muted/30 rounded-lg">
                  <p className="text-lg font-bold text-foreground">{estimateData?.timeline || '6-8 weeks'}</p>
                  <p className="text-sm text-muted-foreground">Timeline</p>
                </div>
              </div>
            </div>
            {/* Tab Navigation */}
            <div className="bg-card border border-border rounded-lg">
              <div className="border-b border-border">
                <nav className="flex space-x-0 overflow-x-auto">
                  {tabs?.map((tab) => (
                    <button
                      key={tab?.id}
                      onClick={() => !tab?.disabled && setActiveTab(tab?.id)}
                      disabled={tab?.disabled}
                      className={`flex items-center space-x-2 px-4 py-3 text-sm font-medium border-b-2 transition-smooth whitespace-nowrap ${
                        tab?.disabled
                          ? 'border-transparent text-muted-foreground/50 cursor-not-allowed opacity-50'
                          : activeTab === tab?.id
                          ? 'border-primary text-primary bg-primary/5'
                          : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
                      }`}
                    >
                      <Icon name={tab?.icon} size={16} />
                      <span>{tab?.label}</span>
                    </button>
                  ))}
                </nav>
              </div>

              <div className="p-6">
                {activeTab === 'overview' && <EstimateOverview estimateData={estimateData} />}
                {activeTab === 'breakdown' && <DetailedBreakdown estimateData={estimateData} />}
                {activeTab === 'calculator' && <CostCalculator onCalculate={handleCalculatorUpdate} />}
                {activeTab === 'recommendations' && <PriorityRecommendations recommendations={[]} />}
                {activeTab === 'export' && <ExportOptions estimateData={estimateData} selectedFile={selectedFile} onExport={handleExport} />}
              </div>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Header notifications={2} onLogout={handleLogout} />
      
      {/* Houston Area Toast - Show on estimate page but not on overview, breakdown, or download tabs */}
      {!toast && !(currentStep === 'results' && (activeTab === 'overview' || activeTab === 'breakdown' || activeTab === 'export')) && (
        <Toast
          message="We are currently operating exclusively in the Texas."
          type="info"
          duration={999999}
          onClose={() => {}}
        />
      )}

      {/* Toast Notification */}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
      
      <main className="pt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Breadcrumb */}
          <div className="mb-6">
            <Breadcrumb customItems={breadcrumbItems} />
          </div>

          {/* Page Header */}
          <div className="mb-8">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold text-foreground">Estimate Generation & Results</h1>
                <p className="text-muted-foreground mt-1">
                  {currentStep === 'options' && 'Choose your analysis type to get started'}
                  {currentStep === 'processing' && 'Analyzing your inspection report'}
                  {currentStep === 'results' && 'Your estimate is ready for review'}
                </p>
              </div>
              
              {currentStep === 'results' && (
                <div className="flex space-x-3">
                  <Button
                    variant="outline"
                    onClick={() => setCurrentStep('options')}
                    iconName="RotateCcw"
                    iconPosition="left"
                  >
                    New Analysis
                  </Button>
                  <Button
                    variant="default"
                    onClick={() => setActiveTab('export')}
                    iconName="Download"
                    iconPosition="left"
                  >
                    Download Report
                  </Button>
                </div>
              )}
            </div>
          </div>

          {/* Step Content */}
          {loading ? (
            <div className="text-center py-12">
              <div className="w-16 h-16 mx-auto mb-4 bg-muted rounded-full flex items-center justify-center">
                <Icon name="Loader2" size={24} className="text-muted-foreground animate-spin" />
              </div>
              <p className="text-muted-foreground">Loading files...</p>
            </div>
          ) : (
            renderStepContent()
          )}
        </div>
      </main>
    </div>
  );
};

export default EstimateGenerationResults;
