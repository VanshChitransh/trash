import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';

const NotificationContext = createContext();

export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
};

const STORAGE_KEY = 'consultabid_notifications';
const MAX_NOTIFICATIONS = 50;

export const NotificationProvider = ({ children }) => {
  const [notifications, setNotifications] = useState(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  // Save to localStorage whenever notifications change
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(notifications));
    } catch (error) {
      console.error('Error saving notifications:', error);
    }
  }, [notifications]);

  const addNotification = useCallback((notification) => {
    const newNotification = {
      id: `notif-${Date.now()}-${Math.random()}`,
      type: notification.type || 'info', // 'success', 'error', 'warning', 'info'
      title: notification.title || 'Notification',
      message: notification.message || '',
      timestamp: new Date().toISOString(),
      read: false,
      ...notification
    };

    setNotifications(prev => {
      const updated = [newNotification, ...prev];
      // Keep only the most recent MAX_NOTIFICATIONS
      return updated.slice(0, MAX_NOTIFICATIONS);
    });

    return newNotification.id;
  }, []);

  const markAsRead = useCallback((id) => {
    setNotifications(prev =>
      prev.map(notif =>
        notif.id === id ? { ...notif, read: true } : notif
      )
    );
  }, []);

  const markAllAsRead = useCallback(() => {
    setNotifications(prev =>
      prev.map(notif => ({ ...notif, read: true }))
    );
  }, []);

  const removeNotification = useCallback((id) => {
    setNotifications(prev => prev.filter(notif => notif.id !== id));
  }, []);

  const clearAll = useCallback(() => {
    setNotifications([]);
  }, []);

  const unreadCount = notifications.filter(n => !n.read).length;

  const value = useMemo(() => ({
    notifications,
    unreadCount,
    addNotification,
    markAsRead,
    markAllAsRead,
    removeNotification,
    clearAll,
  }), [notifications, addNotification, markAsRead, markAllAsRead, removeNotification, clearAll]);

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
};

NotificationProvider.displayName = 'NotificationProvider';

