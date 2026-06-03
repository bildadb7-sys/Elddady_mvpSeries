import React, { useEffect, useState } from 'react';
import { api } from '../api';

interface VideoWithWatermarkProps extends React.VideoHTMLAttributes<HTMLVideoElement> {
  userHandle?: string;
  userId?: string;
  containerClassName?: string;
}

export const VideoWithWatermark: React.FC<VideoWithWatermarkProps> = ({ 
  userHandle, 
  userId, 
  containerClassName = '',
  className = '', 
  ...props 
}) => {
  const [handle, setHandle] = useState<string | undefined>(userHandle);
  
  useEffect(() => {
    if (!handle && userId) {
      // Try to fetch the user's profile to get the handle
      api.getUserProfile(userId).then(user => {
        if (user && user.handle) {
          setHandle(user.handle);
        }
      }).catch(() => {});
    }
  }, [userId, handle]);
  
  return (
    <div className={`relative flex items-center justify-center overflow-hidden ${containerClassName}`}>
      <video {...props} className={className} />
      <div className="absolute bottom-3 right-3 flex flex-col items-end pointer-events-none z-10">
        <span 
          className="text-white font-bold opacity-75" 
          style={{ 
            fontFamily: "'HK MODULAR', sans-serif", 
            textShadow: '1px 1px 2px rgba(0,0,0,0.8), -1px -1px 2px rgba(0,0,0,0.8), 0px 0px 4px rgba(0,0,0,1)',
            fontSize: 'min(5vw, 24px)',
            lineHeight: '1.2'
          }}
        >
          ELDDADY
        </span>
        {handle && (
          <span 
            className="text-white opacity-75" 
            style={{ 
              fontFamily: "'Lastica', sans-serif", 
              textShadow: '1px 1px 2px rgba(0,0,0,0.8), -1px -1px 2px rgba(0,0,0,0.8), 0px 0px 4px rgba(0,0,0,1)',
              fontSize: 'min(3vw, 14px)',
              lineHeight: '1'
            }}
          >
            {handle.startsWith('@') ? handle : `@${handle}`}
          </span>
        )}
      </div>
    </div>
  );
};
