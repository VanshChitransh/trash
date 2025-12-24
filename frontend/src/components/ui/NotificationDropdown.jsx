import React, { useState, useEffect, useRef } from 'react';
import Icon from '../AppIcon';
import { useNotifications } from '../../contexts/NotificationContext';

const NotificationDropdown = () => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);
  const { notifications, unreadCount, markAsRead, markAllAsRead, removeNotification } = useNotifications();

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('click', handleClickOutside);
    }

    return () => {
      document.removeEventListener('click', handleClickOutside);
    };
  }, [isOpen]);

  const getIcon = (type) => {
    switch (type) {
      case 'success':
        return 'CheckCircle';
      case 'error':
        return 'AlertCircle';
      case 'warning':
        return 'AlertTriangle';
      default:
        return 'Info';
    }
  };

  const getColor = (type) => {
    switch (type) {
      case 'success':
        return 'text-success';
      case 'error':
        return 'text-destructive';
      case 'warning':
        return 'text-warning';
      default:
        return 'text-primary';
    }
  };

  const formatTime = (timestamp) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 text-muted-foreground hover:text-foreground transition-smooth"
      >
        <Icon name="Bell" size={20} />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-error text-error-foreground text-xs rounded-full h-5 w-5 flex items-center justify-center font-medium">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 md:w-96 bg-popover border border-border rounded-lg shadow-moderate animate-slide-down z-[200] max-h-[500px] flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-border">
            <h3 className="font-semibold text-foreground">Notifications</h3>
            {unreadCount > 0 && (
              <button
                onClick={markAllAsRead}
                className="text-xs text-primary hover:underline"
              >
                Mark all as read
              </button>
            )}
          </div>

          {/* Notifications List */}
          <div className="overflow-y-auto flex-1">
            {notifications.length === 0 ? (
              <div className="p-8 text-center">
                <Icon name="Bell" size={48} className="text-muted-foreground mx-auto mb-3 opacity-50" />
                <p className="text-sm text-muted-foreground">No notifications</p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {notifications.map((notification) => (
                  <div
                    key={notification.id}
                    className={`p-4 hover:bg-muted/50 transition-smooth cursor-pointer ${
                      !notification.read ? 'bg-primary/5' : ''
                    }`}
                    onClick={() => {
                      if (!notification.read) {
                        markAsRead(notification.id);
                      }
                    }}
                  >
                    <div className="flex items-start space-x-3">
                      <Icon
                        name={getIcon(notification.type)}
                        size={20}
                        className={`flex-shrink-0 mt-0.5 ${getColor(notification.type)}`}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <p className="text-sm font-medium text-foreground">
                              {notification.title}
                            </p>
                            {notification.message && (
                              <p className="text-xs text-muted-foreground mt-1">
                                {notification.message}
                              </p>
                            )}
                          </div>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              removeNotification(notification.id);
                            }}
                            className="ml-2 text-muted-foreground hover:text-foreground transition-smooth"
                          >
                            <Icon name="X" size={14} />
                          </button>
                        </div>
                        <div className="flex items-center justify-between mt-2">
                          <span className="text-xs text-muted-foreground">
                            {formatTime(notification.timestamp)}
                          </span>
                          {!notification.read && (
                            <span className="w-2 h-2 bg-primary rounded-full"></span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationDropdown;





