import React, { useEffect, useState } from 'react';
import Icon from '../AppIcon';

const Toast = ({ message, type = 'success', duration = 3000, onClose }) => {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(false);
      setTimeout(() => {
        if (onClose) onClose();
      }, 300); // Wait for fade out animation
    }, duration);

    return () => clearTimeout(timer);
  }, [duration, onClose]);

  const getIcon = () => {
    switch (type) {
      case 'success':
        return 'CheckCircle';
      case 'error':
        return 'AlertCircle';
      case 'warning':
        return 'AlertTriangle';
      case 'info':
        return 'Info';
      default:
        return 'CheckCircle';
    }
  };

  const getStyles = () => {
    switch (type) {
      case 'success':
        return 'bg-success/10 border-success text-success';
      case 'error':
        return 'bg-destructive/10 border-destructive text-destructive';
      case 'warning':
        return 'bg-warning/10 border-warning text-warning';
      case 'info':
        return 'bg-primary/10 border-primary text-primary';
      default:
        return 'bg-success/10 border-success text-success';
    }
  };

  if (!isVisible) return null;

  return (
    <div
      className={`fixed top-20 right-4 z-40 flex items-center space-x-3 px-4 py-3 rounded-lg border transition-all duration-300 ${
        isVisible ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-full'
      } ${
        type === 'info' 
          ? 'bg-white border-border text-foreground shadow-lg' 
          : getStyles()
      }`}
    >
      <Icon name={getIcon()} size={20} className="flex-shrink-0" />
      <p className="text-sm font-medium">{message}</p>
    </div>
  );
};

export default Toast;
