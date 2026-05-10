
import React, { useState, useEffect } from 'react';
import { api } from '../api';
import { supabase } from '../supabaseClient';
import { Vroom, SearchResults, User } from '../types';
import TrendingList from './TrendingList';

interface RightSidebarProps {
    isOpen: boolean;
    onClose: () => void;
    onHashtagClick: (tag: string) => void;
    onVroomClick: (vroom: Vroom) => void;
    currentUser: User;
    onUserClick?: (userId: string) => void;
}

const RightSidebar: React.FC<RightSidebarProps> = ({ isOpen, onClose, onHashtagClick, onVroomClick, currentUser, onUserClick }) => {
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<SearchResults | null>(null);
    const [popularVrooms, setPopularVrooms] = useState<any[]>([]);
    const [visibleVroomsCount, setVisibleVroomsCount] = useState(4);

    useEffect(() => {
        const fetchPopularVrooms = async () => {
            try {
                const vrooms = await api.getPopularVrooms();
                const sortedVrooms = [...vrooms].sort((a, b) => (b.recent_views || 0) - (a.recent_views || 0));
                setPopularVrooms(sortedVrooms);
            } catch (e) {
                console.error("Failed to fetch popular vrooms", e);
            }
        }
        fetchPopularVrooms();
    }, []);

    // Listen for global follow changes to sync UI state
    useEffect(() => {
        const handleFollowChange = (e: CustomEvent) => {
            const { vroomId, isFollowing, followers } = e.detail;

            setPopularVrooms(prev => prev.map(v =>
                v.id === vroomId ? { ...v, isFollowing, followers } : v
            ));

            setSearchResults(prev => {
                if (!prev) return null;
                return {
                    ...prev,
                    vrooms: prev.vrooms.map(v => v.id === vroomId ? { ...v, isFollowing, followers } : v)
                };
            });
        };

        const handleViewed = (e: CustomEvent) => {
            const { vroomId, newCount } = e.detail;
            const incrementView = (v: any) => v.id === vroomId ? { ...v, views: newCount != null ? newCount.toString() : (parseInt(v.views || '0') + 1).toString(), recent_views: newCount != null ? newCount : (v.recent_views || 0) + 1 } : v;

            setPopularVrooms(prev => prev.map(incrementView));
            setSearchResults(prev => {
                if (!prev) return null;
                return {
                    ...prev,
                    vrooms: prev.vrooms.map(incrementView)
                };
            });
        };

        window.addEventListener('vroom-follow-changed' as any, handleFollowChange);
        window.addEventListener('vroom-viewed' as any, handleViewed);

        // Real-time updates for vrooms (followers and views)
        const channel = supabase.channel('right-sidebar-vrooms')
            .on(
                'postgres_changes',
                { event: 'UPDATE', schema: 'public', table: 'vrooms' },
                (payload) => {
                    const updatedVroom = payload.new as any;

                    setPopularVrooms(prev => prev.map(v => {
                        if (v.id === updatedVroom.id) {
                            return {
                                ...v,
                                followers: updatedVroom.followers_count || 0,
                                recent_views: updatedVroom.views_count
                            };
                        }
                        return v;
                    }));

                    setSearchResults(prev => {
                        if (!prev) return null;
                        return {
                            ...prev,
                            vrooms: prev.vrooms.map(v => {
                                if (v.id === updatedVroom.id) {
                                    return {
                                        ...v,
                                        followers: updatedVroom.followers_count || 0,
                                        views: updatedVroom.views_count?.toString() || v.views,
                                        recent_views: updatedVroom.views_count
                                    };
                                }
                                return v;
                            })
                        };
                    });
                }
            )
            .subscribe();

        return () => {
            window.removeEventListener('vroom-follow-changed' as any, handleFollowChange);
            window.removeEventListener('vroom-viewed' as any, handleViewed);
            supabase.removeChannel(channel);
        };
    }, []);

    const toggleFollowVroom = async (id: string) => {
        try {
            await api.toggleFollowVroom(id);
        } catch (e) {
            console.error(e);
        }
    };

    useEffect(() => {
        const doSearch = async () => {
            if (!searchQuery.trim()) {
                setSearchResults(null);
                return;
            }
            try {
                const results = await api.search(searchQuery);
                setSearchResults(results);
            } catch (e) {
                console.error("Search failed", e);
            }
        };

        const debounce = setTimeout(doSearch, 300);
        return () => clearTimeout(debounce);
    }, [searchQuery]);

    const handleShowMoreVrooms = () => {
        setVisibleVroomsCount(prev => prev + 6);
    };

    const hasResults = searchResults && (
        searchResults.users.length > 0 ||
        searchResults.products.length > 0 ||
        searchResults.vrooms.length > 0 ||
        searchResults.hashtags.length > 0
    );

    return (
        <>
            {/* Overlay for Mobile */}
            {isOpen && (
                <div
                    className="fixed inset-0 bg-black/50 z-40 md:hidden"
                    onClick={onClose}
                ></div>
            )}

            {/* Sidebar Container */}
            <div className={`
        fixed inset-y-0 right-0 z-50 w-80 bg-card p-4 flex flex-col transition-transform duration-300 shadow-xl
        md:static md:translate-x-0 md:h-screen md:w-full md:bg-transparent md:px-4 lg:px-6 xl:px-8 md:pt-4 md:shadow-none
        ${isOpen ? 'translate-x-0' : 'translate-x-full md:translate-x-0'}
      `}>
                {/* Mobile Header with Close */}
                <div className="flex items-center justify-between md:hidden mb-4 flex-shrink-0">
                    <h2 className="text-lg font-bold">Search</h2>
                    <button onClick={onClose} className="p-2 rounded-full hover:bg-muted">
                        <i className="fas fa-times"></i>
                    </button>
                </div>

                {/* Content Wrapper */}
                <div className="w-full max-w-[320px] mx-auto flex flex-col h-full">

                    {/* Search Bar */}
                    <div className="bg-muted/30 rounded-full p-3 border border-border/50 focus-within:bg-background focus-within:border-primary focus-within:ring-1 focus-within:ring-primary transition-all flex-shrink-0 mb-6">
                        <div className="flex items-center space-x-3">
                            <i className="fas fa-search text-muted-foreground ml-2"></i>
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Search..."
                                className="bg-transparent outline-none flex-1 text-sm text-foreground placeholder:text-muted-foreground w-full"
                            />
                            {searchQuery && (
                                <button onClick={() => setSearchQuery('')} className="text-muted-foreground hover:text-foreground mr-1">
                                    <i className="fas fa-times-circle"></i>
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Scrollable Content Area */}
                    <div className="flex-1 overflow-y-auto no-scrollbar space-y-6 pb-10">
                        {searchQuery ? (
                            <div className="space-y-6 animate-in fade-in slide-in-from-top-2 duration-200">
                                {!hasResults && (
                                    <div className="text-center py-8 text-muted-foreground">
                                        <i className="fas fa-search text-2xl mb-2 opacity-50"></i>
                                        <p>No results</p>
                                    </div>
                                )}

                                {/* Users Results */}
                                {searchResults && searchResults.users.length > 0 && (
                                    <div className="bg-card rounded-xl border border-border overflow-hidden">
                                        <div className="p-3 border-b border-border bg-muted/20">
                                            <h3 className="text-sm font-bold text-foreground">People</h3>
                                        </div>
                                        <div className="divide-y divide-border">
                                            {searchResults.users.map((user) => (
                                                <div 
                                                    key={user.id} 
                                                    className="p-3 hover:bg-muted/50 transition-colors cursor-pointer flex items-center gap-3"
                                                    onClick={() => onUserClick && onUserClick(user.id)}
                                                >
                                                    <img src={user.avatar} alt={user.name} className="w-8 h-8 rounded-full object-cover" />
                                                    <div className="min-w-0">
                                                        <div className="font-bold text-sm truncate">{user.name}</div>
                                                        <div className="text-[10px] text-muted-foreground truncate hover:underline">{user.handle}</div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Hashtags Results */}
                                {searchResults && searchResults.hashtags.length > 0 && (
                                    <div className="bg-card rounded-xl border border-border overflow-hidden">
                                        <div className="p-3 border-b border-border bg-muted/20">
                                            <h3 className="text-sm font-bold text-foreground">Hashtags</h3>
                                        </div>
                                        <div className="divide-y divide-border">
                                            {searchResults.hashtags.map((tag) => (
                                                <div
                                                    key={tag}
                                                    onClick={() => onHashtagClick(tag)}
                                                    className="p-3 hover:bg-muted/50 transition-colors cursor-pointer flex justify-between items-center"
                                                >
                                                    <span className="font-medium text-sm text-primary truncate">{tag}</span>
                                                    <i className="fas fa-chevron-right text-xs text-muted-foreground"></i>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Vrooms Results */}
                                {searchResults && searchResults.vrooms.length > 0 && (
                                    <div className="bg-card rounded-xl border border-border overflow-hidden">
                                        <div className="p-3 border-b border-border bg-muted/20">
                                            <h3 className="text-sm font-bold text-foreground">Vrooms</h3>
                                        </div>
                                        <div className="divide-y divide-border">
                                            {searchResults.vrooms.map((vroom) => (
                                                <div key={vroom.id} className="p-3 hover:bg-muted/50 transition-colors cursor-pointer flex items-center gap-3" onClick={() => onVroomClick(vroom)}>
                                                    <div className="w-8 h-8 bg-muted rounded-lg flex items-center justify-center flex-shrink-0 overflow-hidden">
                                                        <img src={vroom.coverImage} className="w-full h-full object-cover" />
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <div className="font-bold text-sm truncate">{vroom.name}</div>
                                                    </div>
                                                    {vroom.ownerId !== currentUser.id && (
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                toggleFollowVroom(vroom.id);
                                                            }}
                                                            className={`px-3 py-1 rounded text-[10px] font-bold transition-colors ${vroom.isFollowing
                                                                ? 'bg-background border border-border text-foreground hover:bg-muted'
                                                                : 'bg-primary text-primary-foreground hover:bg-primary/90'
                                                                }`}
                                                        >
                                                            {vroom.isFollowing ? 'Following' : 'Follow'}
                                                        </button>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Products Results */}
                                {searchResults && searchResults.products.length > 0 && (
                                    <div className="bg-card rounded-xl border border-border overflow-hidden">
                                        <div className="p-3 border-b border-border bg-muted/20">
                                            <h3 className="text-sm font-bold text-foreground">Products</h3>
                                        </div>
                                        <div className="divide-y divide-border">
                                            {searchResults.products.map((product) => (
                                                <div key={product.id} className="p-3 hover:bg-muted/50 transition-colors cursor-pointer flex items-center gap-3">
                                                    <img src={product.image} alt={product.name} className="w-8 h-8 rounded-lg object-cover" />
                                                    <div className="flex-1 min-w-0">
                                                        <div className="font-bold text-sm truncate">{product.name}</div>
                                                        <div className="text-xs text-[#E86C44] font-bold">{product.currency} {product.price.toFixed(2)}</div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <>
                                <TrendingList onHashtagClick={onHashtagClick} />

                                {/* Popular Vrooms */}
                                <div className="bg-card rounded-xl border border-border overflow-hidden flex-shrink-0">
                                    <div className="p-3 border-b border-border bg-muted/20">
                                        <h3 className="text-sm font-bold text-foreground">Popular Vrooms</h3>
                                    </div>
                                    <div className="divide-y divide-border">
                                        {popularVrooms.length > 0 ? (
                                            <>
                                                {popularVrooms.slice(0, visibleVroomsCount).map(vroom => (
                                                    <div
                                                        key={vroom.id}
                                                        onClick={() => onVroomClick(vroom)}
                                                        className="p-3 hover:bg-muted/50 transition-colors cursor-pointer"
                                                    >
                                                        <div className="flex items-start space-x-2">
                                                            <img src={vroom.coverImage} alt={vroom.name} className="w-10 h-10 rounded-lg object-cover flex-shrink-0" />
                                                            <div className="flex-1 min-w-0">
                                                                <p className="font-bold text-xs uppercase leading-tight truncate">{vroom.name}</p>
                                                                <div className="flex items-center gap-1 mt-1 text-[10px] font-bold text-orange-500">
                                                                    <i className="fas fa-fire"></i>
                                                                    <span>{vroom.recent_views} Views</span>
                                                                </div>
                                                            </div>
                                                        </div>
                                                        {vroom.ownerId !== currentUser.id && (
                                                            <button
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    toggleFollowVroom(vroom.id);
                                                                }}
                                                                className={`w-fit px-4 mx-auto block mt-2 py-1 rounded text-[10px] font-bold transition-colors ${vroom.isFollowing
                                                                    ? 'bg-background border border-border text-foreground hover:bg-muted'
                                                                    : 'bg-primary text-primary-foreground hover:bg-primary/90'
                                                                    }`}
                                                            >
                                                                {vroom.isFollowing ? 'Following' : 'Follow'}
                                                            </button>
                                                        )}
                                                    </div>
                                                ))}
                                                {visibleVroomsCount < popularVrooms.length && (
                                                    <button
                                                        onClick={handleShowMoreVrooms}
                                                        className="w-full py-3 text-xs font-bold text-primary hover:bg-muted/50 transition-colors text-center border-t border-border/50"
                                                    >
                                                        Show More
                                                    </button>
                                                )}
                                            </>
                                        ) : (
                                            <div className="p-4 text-center text-xs text-muted-foreground">
                                                Calculating popularity...
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div className="text-[10px] text-muted-foreground flex flex-wrap gap-x-3 gap-y-1 px-2 pb-10 flex-shrink-0">
                                    <span className="hover:underline cursor-pointer">Terms</span>
                                    <span className="hover:underline cursor-pointer">Privacy</span>
                                    <span className="hover:underline cursor-pointer">© 2025 Elddady</span>
                                </div>
                            </>
                        )}
                    </div>
                </div>

            </div>
        </>
    );
};

export default RightSidebar;
