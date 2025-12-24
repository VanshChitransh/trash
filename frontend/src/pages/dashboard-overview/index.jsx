import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '../../components/ui/Header';
import Breadcrumb from '../../components/ui/Breadcrumb';
import MetricsCard from './components/MetricsCard';
import RecentUploadsCard from './components/RecentUploadsCard';
import QuickActionsCard from './components/QuickActionsCard';
import ActivityFeed from './components/ActivityFeed';
import UsageChart from './components/UsageChart';
import WelcomeCard from './components/WelcomeCard';
import { logout } from '../../utils/logout';
import { api } from '../../utils/api';

// Component to display real-time last login
const LastLoginDisplay = ({ lastLoginAt }) => {
  const [displayText, setDisplayText] = useState('');

  useEffect(() => {
    const formatLastLogin = () => {
      if (!lastLoginAt) {
        setDisplayText('Never');
        return;
      }

      const lastLogin = new Date(lastLoginAt);
      const now = new Date();
      const diffMs = now - lastLogin;
      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMs / 3600000);
      const diffDays = Math.floor(diffMs / 86400000);

      if (diffMins < 1) {
        setDisplayText('Just now');
      } else if (diffMins < 60) {
        setDisplayText(`${diffMins} minute${diffMins !== 1 ? 's' : ''} ago`);
      } else if (diffHours < 24) {
        setDisplayText(`${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`);
      } else if (diffDays === 1) {
        setDisplayText('Yesterday');
      } else if (diffDays < 7) {
        setDisplayText(`${diffDays} days ago`);
      } else {
        const isToday = lastLogin.toDateString() === now.toDateString();
        if (isToday) {
          setDisplayText(`Today at ${lastLogin.toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
            hour12: true
          })}`);
        } else {
          setDisplayText(lastLogin.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: lastLogin.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
            hour: 'numeric',
            minute: '2-digit',
            hour12: true
          }));
        }
      }
    };

    formatLastLogin();
    const interval = setInterval(formatLastLogin, 60000);
    return () => clearInterval(interval);
  }, [lastLoginAt]);

  return <span>{displayText || 'Never'}</span>;
};

const DashboardOverview = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState(() => {
    // Load user from localStorage on mount
    try {
      const storedUser = localStorage.getItem('user');
      if (storedUser) {
        return JSON.parse(storedUser);
      }
    } catch (error) {
      console.error('Error loading user from localStorage:', error);
    }
    // Fallback to default if no user found
    return {
      name: "User",
      email: "",
      role: "user"
    };
  });

  // Fetch latest user data from API to get real-time lastLoginAt
  useEffect(() => {
    const fetchUserData = async () => {
      try {
        const response = await api.get('/api/auth/me', { ignoreStatuses: [401] });
        if (response && response.user) {
          // Update localStorage with latest user data
          localStorage.setItem('user', JSON.stringify(response.user));
          setUser(response.user);
        }
      } catch (error) {
        console.error('Error fetching user data:', error);
        // Fallback to localStorage if API fails
        try {
          const storedUser = localStorage.getItem('user');
          if (storedUser) {
            const userData = JSON.parse(storedUser);
            setUser(userData);
          }
        } catch (e) {
          console.error('Error loading user from localStorage:', e);
        }
      }
    };

    // Fetch immediately
    fetchUserData();

    // Also check for user updates from AuthGuard
    const loadUser = () => {
      try {
        const storedUser = localStorage.getItem('user');
        if (storedUser) {
          const userData = JSON.parse(storedUser);
          setUser(userData);
        }
      } catch (error) {
        console.error('Error loading user from localStorage:', error);
      }
    };

    // Listen for storage events
    const handleStorage = (e) => {
      if (e.key === 'user') {
        loadUser();
      }
    };
    
    // Listen for custom userLoaded event from AuthGuard
    const handleUserLoaded = () => {
      loadUser();
    };
    
    window.addEventListener('storage', handleStorage);
    window.addEventListener('userLoaded', handleUserLoaded);

    // Refresh user data periodically to get real-time lastLoginAt
    const refreshInterval = setInterval(() => {
      fetchUserData();
    }, 30000); // Refresh every 30 seconds

    // Refresh when page becomes visible
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        fetchUserData();
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener('userLoaded', handleUserLoaded);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      clearInterval(refreshInterval);
    };
  }, []);

  // Real data from API
  const [recentFiles, setRecentFiles] = useState([]);
  const [activities, setActivities] = useState([]);
  const [chartData, setChartData] = useState([]);
  const [dashboardStats, setDashboardStats] = useState({
    reportsProcessed: 0,
    totalEstimates: 0,
    costSavings: 0,
    activeProjects: 0
  });
  const [loading, setLoading] = useState(true);

  // Fetch dashboard data
  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        setLoading(true);
        
        // Fetch files
        const filesResponse = await api.get('/api/files');
        if (filesResponse && filesResponse.success && filesResponse.data) {
          const allFiles = filesResponse.data.map(file => ({
            id: file.id,
            name: file.name,
            uploadDate: new Date(file.uploadDate).toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
              year: 'numeric'
            }),
            status: file.status || 'completed',
            size: `${(file.size / (1024 * 1024)).toFixed(2)} MB`
          }));
          
          // Get recent 5 files
          const recent = allFiles.slice(0, 5);
          setRecentFiles(recent);
          
          // Calculate stats
          const completedFiles = allFiles.filter(f => f.status === 'completed');
          const filesWithEstimates = allFiles.filter(f => f.hasEstimate);
          
          setDashboardStats({
            reportsProcessed: allFiles.length,
            totalEstimates: filesWithEstimates.length,
            costSavings: filesWithEstimates.length * 500, // Estimate $500 savings per estimate
            activeProjects: completedFiles.length
          });
          
          // Generate activities from files
          const fileActivities = filesResponse.data.slice(0, 10).map((file) => ({
            id: file.id,
            fileId: file.id, // Store file ID for viewing
            type: file.hasEstimate ? 'completed' : file.status || 'completed',
            title: file.hasEstimate ? 'Estimate Generated' : file.status === 'completed' ? 'File Uploaded' : 'Report Processing',
            description: file.hasEstimate 
              ? `Cost estimate completed for ${file.name}`
              : file.status === 'completed'
              ? `Successfully uploaded ${file.name}`
              : `${file.name} is being analyzed`,
            timestamp: new Date(file.uploadDate),
            actionable: file.hasEstimate || file.status === 'completed'
          }));
          setActivities(fileActivities);
          
          // Generate chart data (last 6 months)
          const now = new Date();
          const months = [];
          for (let i = 5; i >= 0; i--) {
            const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
            months.push(date.toLocaleDateString('en-US', { month: 'short' }));
          }
          
          // Group files by month
          const monthlyData = months.map((month, index) => {
            const monthStart = new Date(now.getFullYear(), now.getMonth() - (5 - index), 1);
            const monthEnd = new Date(now.getFullYear(), now.getMonth() - (5 - index) + 1, 0);
            const filesInMonth = filesResponse.data.filter(file => {
              const fileDate = new Date(file.uploadDate);
              return fileDate >= monthStart && fileDate <= monthEnd;
            });
            return { month, reports: filesInMonth.length };
          });
          
          setChartData(monthlyData);
        }
      } catch (err) {
        console.error('Error fetching dashboard data:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, []);

  // Navigation handlers
  const handleUploadFile = () => {
    navigate('/file-upload-management');
  };

  const handleViewEstimates = () => {
    navigate('/estimate-generation-results');
  };

  const handleGetHelp = () => {
    navigate('/help');
  };

  const handleViewAllFiles = () => {
    navigate('/file-upload-management');
  };

  // Handle viewing a file PDF
  const handleViewFile = async (fileId) => {
    try {
      // Get preview URL from backend (includes authentication token)
      const response = await api.get(`/api/files/${fileId}/preview`);
      
      if (response && response.success && response.data && response.data.previewUrl) {
        // Open preview URL in new tab with worker proxy and authentication
        window.open(response.data.previewUrl, '_blank', 'noopener,noreferrer');
      } else {
        throw new Error('Invalid response from server');
      }
    } catch (err) {
      console.error('Error getting preview URL:', err);
      // Fallback: navigate to file page if preview fails
      navigate(`/file-upload-management`);
    }
  };

  // Handle viewing an activity (file or estimate)
  const handleViewActivity = async (activity) => {
    if (activity?.fileId) {
      await handleViewFile(activity.fileId);
    } else if (activity?.id) {
      // Fallback to using activity ID as file ID
      await handleViewFile(activity.id);
    }
  };

  const handleWatchDemo = () => {
    // Mock demo functionality
    console.log('Opening demo video...');
  };

  const handleLogout = async () => {
    await logout(navigate);
  };

  return (
    <div className="min-h-screen bg-background">
      <Header 
        onLogout={handleLogout}
      />
      <main className="pt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <Breadcrumb />
          
          {/* Welcome Section */}
          <div className="mb-8">
            <WelcomeCard 
              userName={user?.name}
              lastLoginAt={user?.lastLoginAt}
              onGetStarted={handleUploadFile}
              onWatchDemo={handleWatchDemo}
            />
          </div>

          {/* Metrics Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <MetricsCard
              title="Reports Processed"
              value={dashboardStats.reportsProcessed.toString()}
              change=""
              changeType="neutral"
              icon="FileText"
              color="primary"
            />
            <MetricsCard
              title="Total Estimates"
              value={dashboardStats.totalEstimates.toString()}
              change=""
              changeType="neutral"
              icon="Calculator"
              color="success"
            />
            <MetricsCard
              title="Cost Savings"
              value={`$${dashboardStats.costSavings.toLocaleString()}`}
              change=""
              changeType="neutral"
              icon="DollarSign"
              color="warning"
            />
            <MetricsCard
              title="Active Projects"
              value={dashboardStats.activeProjects.toString()}
              change=""
              changeType="neutral"
              icon="Briefcase"
              color="primary"
            />
          </div>

          {/* Main Content Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
            {/* Left Column - Recent Uploads & Quick Actions */}
            <div className="lg:col-span-2 space-y-8">
              <RecentUploadsCard
                files={recentFiles}
                onViewAll={handleViewAllFiles}
                onUploadNew={handleUploadFile}
                onViewFile={handleViewFile}
              />
              
              <QuickActionsCard
                onUploadFile={handleUploadFile}
                onViewEstimates={handleViewEstimates}
                onGetHelp={handleGetHelp}
              />
            </div>

            {/* Right Column - Activity Feed */}
            <div className="lg:col-span-1">
              <ActivityFeed 
                activities={activities} 
                onViewActivity={handleViewActivity}
              />
            </div>
          </div>

          {/* Usage Chart */}
          <div className="mb-8">
            <UsageChart 
              data={chartData}
              title="Monthly Usage Overview"
            />
          </div>


        </div>
      </main>
    </div>
  );
};

export default DashboardOverview;