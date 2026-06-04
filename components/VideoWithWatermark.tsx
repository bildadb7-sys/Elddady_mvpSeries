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
      api.getPublicProfile(userId).then(user => {
        if (user && user.handle) {
          setHandle(user.handle);
        }
      }).catch(() => {});
    }
  }, [userId, handle]);
  
  return (
    <div className={`relative flex items-center justify-center overflow-hidden ${containerClassName}`} style={{ containerType: 'inline-size' }}>
      <video {...props} className={className} />
      <div className="absolute bottom-[4cqi] right-[4cqi] flex flex-col items-end pointer-events-none z-10" style={{ paddingBottom: 'max(16px, 4cqi)', paddingRight: 'max(16px, 4cqi)' }}>
        <span 
          className="font-bold opacity-95" 
          style={{ 
            color: '#E86C44',
            fontFamily: "'HK MODULAR', sans-serif", 
            textShadow: '2px 2px 4px rgba(0,0,0,0.85)',
            fontSize: 'max(24px, 6cqi)',
            lineHeight: '1.2'
          }}
        >
          ELDDADY
        </span>
        {handle && (
          <span 
            className="text-white opacity-90" 
            style={{ 
              fontFamily: "'Lastica', sans-serif", 
              textShadow: '2px 2px 4px rgba(0,0,0,0.85)',
              fontSize: 'max(12px, 3cqi)',
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
