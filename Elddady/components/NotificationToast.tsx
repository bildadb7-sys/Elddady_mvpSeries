
import React, { useEffect, useState } from 'react';
import { AppNotification } from '../types';

interface NotificationToastProps {
  notification: AppNotification;
  onClose: (id: string) => void;
  onClick: (notification: AppNotification) => void;
}

const NotificationToast: React.FC<NotificationToastProps> = ({ notification, onClose, onClick }) => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Trigger slide-in animation
    requestAnimationFrame(() => setIsVisible(true));

    // Auto dismiss after 5 seconds
    const timer = setTimeout(() => {
      setIsVisible(false);
      setTimeout(() => onClose(notification.id), 300); // Wait for slide-out
    }, 5000);

    return () => clearTimeout(timer);
  }, [notification.id, onClose]);

  const getIcon = () => {
    switch (notification.type) {
      case 'message': return 'fa-comment-alt';
      case 'order': return 'fa-box-open';
      case 'system': return 'fa-bell';
      default: return 'fa-info-circle';
    }
  };

  const getColor = () => {
    switch (notification.type) {
      case 'message': return 'bg-blue-500';
      case 'order': return 'bg-[#E86C44]';
      case 'system': return 'bg-zinc-800';
      default: return 'bg-primary';
    }
  };

  return (
    <div 
      className={`
        relative w-full max-w-sm bg-card/95 backdrop-blur-md border border-border shadow-2xl rounded-2xl p-4 mb-3 
        transition-all duration-300 transform cursor-pointer flex items-start gap-4 overflow-hidden
        ${isVisible ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0'}
      `}
      onClick={() => onClick(notification)}
    >
      <div className={`w-10 h-10 rounded-full ${getColor()} flex items-center justify-center text-white shadow-lg flex-shrink-0`}>
        <i className={`fas ${getIcon()} text-lg`}></i>
      </div>
      
      <div className="flex-1 min-w-0 pt-0.5">
        <h4 className="font-bold text-sm text-foreground truncate">{notification.title}</h4>
        <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{notification.message}</p>
        <span className="text-[10px] text-muted-foreground/60 mt-1 block">Just now</span>
      </div>

      <button 
        onClick={(e) => { e.stopPropagation(); setIsVisible(false); setTimeout(() => onClose(notification.id), 300); }}
        className="text-muted-foreground hover:text-foreground transition-colors p-1"
      >
        <i className="fas fa-times text-xs"></i>
      </button>

      {/* Progress bar visual for auto-dismiss */}
      <div className="absolute bottom-0 left-0 h-1 bg-gradient-to-r from-transparent via-primary/20 to-transparent w-full animate-pulse opacity-50"></div>
    </div>
  );
};

export default NotificationToast;
