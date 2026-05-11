
import React, { useState, useEffect } from 'react';
import { api } from '../api';
import { Vroom } from '../types';

interface PopularVroomsListProps {
  onVroomClick: (vroom: Vroom) => void;
}

const PopularVroomsList: React.FC<PopularVroomsListProps> = ({ onVroomClick }) => {
  const [vrooms, setVrooms] = useState<Vroom[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPopularVrooms = async () => {
      try {
        const data = await api.getPopularVrooms();
        // Limit to 15 for a snappy horizontal list
        setVrooms(data.slice(0, 15));
      } catch (e) {
        console.error("Failed to fetch popular vrooms:", e);
      } finally {
        setLoading(false);
      }
    };
    fetchPopularVrooms();
  }, []);

  if (!loading && vrooms.length === 0) {
    return null; // Don't show empty container
  }

  return (
    <div className="w-full bg-background/50 backdrop-blur-sm border-b border-border/50">
      {/* 
         Horizontal Scroll Container 
         - no-scrollbar: Hides scrollbar for clean look
         - overflow-x-auto: Enables horizontal scrolling
         - snap-x: Snap effect for better touch feel
      */}
      <div className="flex gap-3 overflow-x-auto py-4 px-4 no-scrollbar scroll-smooth snap-x snap-mandatory">
        
        {loading ? (
          // Loading Skeletons
          [1, 2, 3, 4].map((i) => (
            <div 
              key={i} 
              className="flex-shrink-0 w-24 h-36 bg-muted rounded-2xl animate-pulse border border-border"
            />
          ))
        ) : (
          vrooms.map((vroom) => (
            <button
              key={vroom.id}
              onClick={() => onVroomClick(vroom)}
              className="flex-shrink-0 relative group active:scale-95 transition-transform outline-none snap-start"
            >
              {/* 
                  The 'Round Corner Rectangle' 
                  w-24 (96px) x h-36 (144px) with rounded-2xl 
              */}
              <div className="w-24 h-36 rounded-2xl overflow-hidden border-[3px] border-[#E86C44] shadow-md relative">
                <img 
                  src={vroom.coverImage} 
                  alt={vroom.name} 
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                />
                
                {/* Gradient Overlay for Text Readability */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/10 to-transparent flex flex-col justify-end p-2 text-left">
                  <span className="text-white text-[10px] font-black truncate leading-tight uppercase tracking-tighter shadow-black drop-shadow-md">
                    {vroom.name}
                  </span>
                  <div className="flex items-center gap-1 text-[#E86C44] text-[9px] font-bold mt-0.5">
                    <i className="fas fa-eye text-[8px]"></i>
                    {vroom.views}
                  </div>
                </div>
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  );
};

export default PopularVroomsList;
