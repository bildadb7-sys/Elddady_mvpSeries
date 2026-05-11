
import React, { useState, useEffect } from 'react';
import { api } from '../api';

interface TrendingListProps {
  onHashtagClick: (tag: string) => void;
  title?: string;
  className?: string;
}

const TrendingList: React.FC<TrendingListProps> = ({ onHashtagClick, title = "Trending", className = "" }) => {
  const [trendingTags, setTrendingTags] = useState<{ tag: string, score?: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const [visibleCount, setVisibleCount] = useState(4);

  useEffect(() => {
    const fetchTrending = async () => {
      try {
        const tags = await api.getTrendingTags();
        setTrendingTags(tags);
      } catch (e) {
        console.error("Failed to fetch trending tags", e);
      } finally {
        setLoading(false);
      }
    };
    fetchTrending();
  }, []);

  const handleShowMore = () => {
    setVisibleCount(prev => prev + 6);
  };

  return (
    <div className={`bg-card rounded-xl border border-border overflow-hidden flex-shrink-0 ${className}`}>
      <div className="p-3 border-b border-border bg-muted/20">
        <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
          <i className="fas fa-fire text-orange-500"></i>
          {title}
        </h3>
      </div>
      <div className="divide-y divide-border">
        {loading ? (
          <div className="p-4 text-center text-xs text-muted-foreground animate-pulse">
            Looking for trends...
          </div>
        ) : trendingTags.length > 0 ? (
          <>
            {trendingTags.slice(0, visibleCount).map((item, i) => {
              // Parse tag if it's stored as a JSON string (e.g. {"tag": "jeans", "weight": 5})
              let displayTag = item.tag;
              try {
                if (typeof displayTag === 'string' && (displayTag.trim().startsWith('{') || displayTag.trim().startsWith('['))) {
                  const parsed = JSON.parse(displayTag);
                  if (parsed.tag) displayTag = parsed.tag;
                } else if (typeof displayTag === 'object' && displayTag !== null) {
                  if ((displayTag as any).tag) displayTag = (displayTag as any).tag;
                  else displayTag = JSON.stringify(displayTag);
                }
              } catch (e) {
                // Keep original if parse fails
              }

              // Ensure it's a string for rendering
              if (typeof displayTag !== 'string') {
                displayTag = String(displayTag);
              }

              return (
                <div
                  key={i}
                  onClick={() => onHashtagClick(displayTag)}
                  className="p-4 hover:bg-muted/50 transition-colors cursor-pointer group"
                >
                  <div className="flex items-center justify-between">
                    <div className="min-w-0">
                      <p className="font-semibold text-sm text-foreground truncate">#{displayTag}</p>
                      <p className="text-[10px] text-muted-foreground">Trending in your region</p>
                    </div>
                    <i className="fas fa-chart-line text-accent/70 group-hover:text-accent text-xs"></i>
                  </div>
                </div>
              );
            })}

            {visibleCount < trendingTags.length && (
              <button
                onClick={handleShowMore}
                className="w-full py-3 text-xs font-bold text-primary hover:bg-muted/50 transition-colors text-center border-t border-border/50"
              >
                Show More
              </button>
            )}
          </>
        ) : (
          <div className="p-4 text-center text-xs text-muted-foreground">
            No active trends found.
          </div>
        )}
      </div>
    </div>
  );
};

export default TrendingList;
