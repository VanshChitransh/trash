import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import Icon from '../AppIcon';

const Breadcrumb = ({ customItems = null, className = "" }) => {
  const location = useLocation();
  const navigate = useNavigate();

  const routeMap = {
    '/dashboard-overview': 'Dashboard',
    '/file-upload-management': 'Files',
    '/pdf-viewer-modal': 'PDF Viewer',
    '/estimate-generation-results': 'Estimates',
    '/account': 'Account',
    '/help': 'Help',
    '/settings': 'Settings'
  };

  const generateBreadcrumbs = () => {
    if (customItems) return customItems;

    const pathSegments = location?.pathname?.split('/')?.filter(Boolean);
    const breadcrumbs = [{ label: 'Dashboard', path: '/dashboard-overview', isHome: true }];

    let currentPath = '';
    pathSegments?.forEach((segment, index) => {
      currentPath += `/${segment}`;
      const label = routeMap?.[currentPath] || segment?.replace(/-/g, ' ')?.replace(/\b\w/g, l => l?.toUpperCase());
      
      if (currentPath !== '/dashboard-overview') {
        breadcrumbs?.push({
          label,
          path: currentPath,
          isLast: index === pathSegments?.length - 1
        });
      }
    });

    return breadcrumbs;
  };

  const breadcrumbs = generateBreadcrumbs();

  // Don't show breadcrumbs on dashboard
  if (location?.pathname === '/dashboard-overview' || location?.pathname === '/') {
    return null;
  }

  const handleNavigation = (path) => {
    if (path) {
      navigate(path);
    }
  };

  return (
    <nav className={`flex items-center space-x-1 text-sm ${className}`} aria-label="Breadcrumb">
      <ol className="flex items-center space-x-1">
        {breadcrumbs?.map((item, index) => (
          <li key={item?.path || index} className="flex items-center">
            {index > 0 && (
              <Icon 
                name="ChevronRight" 
                size={16} 
                className="text-muted-foreground mx-2" 
              />
            )}
            
            {item?.isLast ? (
              <span className="text-foreground font-medium">
                {item?.label}
              </span>
            ) : (
              <button
                onClick={() => handleNavigation(item?.path)}
                className="flex items-center space-x-1 text-muted-foreground hover:text-foreground transition-smooth"
              >
                {item?.isHome && (
                  <Icon name="Home" size={14} />
                )}
                <span>{item?.label}</span>
              </button>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
};

export default Breadcrumb;