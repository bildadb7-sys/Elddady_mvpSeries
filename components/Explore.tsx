
import React, { useState, useEffect } from 'react';
import { Product, Vroom, User } from '../types';
import { api } from '../api';
import { supabase } from '../supabaseClient';
import TrendingList from './TrendingList';
import { useCurrency } from '../context/useCurrency';
import { VideoWithWatermark } from './VideoWithWatermark';

interface ExploreProps {
    onAddToCart: (product: Product) => void;
    onProductClick: (product: Product) => void;
    onShare: (product: Product) => void;
    onVroomClick?: (vroom: Vroom) => void;
    initialSearchQuery?: string;
    currentUser: User;
    onUserClick?: (userId: string) => void;
}

const Explore: React.FC<ExploreProps> = ({ onAddToCart, onProductClick, onShare, onVroomClick, initialSearchQuery, currentUser, onUserClick }) => {
    const { convertPrice, formatPrice, userCurrency } = useCurrency();
    const [activeCategory, setActiveCategory] = useState('All Categories');
    const [activeTab, setActiveTab] = useState('Discover');
    const [searchQuery, setSearchQuery] = useState(initialSearchQuery || '');

    const [filterType, setFilterType] = useState('All');
    const [sortOrder, setSortOrder] = useState('Most Recent');

    const [items, setItems] = useState<{ products: Product[], vrooms: Vroom[] }>({ products: [], vrooms: [] });
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (initialSearchQuery !== undefined) {
            setSearchQuery(initialSearchQuery);
        }
    }, [initialSearchQuery]);

    // Real-time Push: Listen for new Public Vrooms
    useEffect(() => {
        const handleFollowChange = (e: CustomEvent) => {
            const { vroomId, followers } = e.detail;
            setItems(prev => ({
                ...prev,
                vrooms: prev.vrooms.map(v => v.id === vroomId ? { ...v, followers } : v)
            }));
        };

        const handleViewed = (e: CustomEvent) => {
            const { vroomId, newCount } = e.detail;
            setItems(prev => ({
                ...prev,
                vrooms: prev.vrooms.map(v => v.id === vroomId ? { ...v, views: newCount != null ? newCount.toString() : (parseInt(v.views || '0') + 1).toString(), recent_views: newCount != null ? newCount : (v.recent_views || 0) + 1 } : v)
            }));
        };

        window.addEventListener('vroom-follow-changed' as any, handleFollowChange);
        window.addEventListener('vroom-viewed' as any, handleViewed);

        const channel = supabase.channel('explore-vrooms-push')
            .on(
                'postgres_changes',
                { event: 'INSERT', schema: 'public', table: 'vrooms', filter: 'is_public=eq.true' },
                async (payload) => {
                    const newVroomRaw = payload.new;

                    // Simple client-side filter to respect search context
                    if (searchQuery && !newVroomRaw.name.toLowerCase().includes(searchQuery.toLowerCase())) {
                        return;
                    }

                    // Fetch owner details for UI display
                    const { data: profile } = await supabase
                        .from('profiles')
                        .select('name')
                        .eq('id', newVroomRaw.owner_id)
                        .single();

                    const newVroom: Vroom = {
                        id: newVroomRaw.id,
                        name: newVroomRaw.name,
                        description: newVroomRaw.description || '',
                        coverImage: newVroomRaw.cover_image,
                        productCount: 0,
                        followers: 0,
                        views: '0',
                        ownerName: profile?.name || 'Unknown',
                        ownerId: newVroomRaw.owner_id,
                        isPublic: true,
                        products: []
                    };

                    // Auto-Push to top of list
                    setItems(prev => ({
                        ...prev,
                        vrooms: [newVroom, ...prev.vrooms]
                    }));
                }
            )
            .on(
                'postgres_changes',
                { event: 'UPDATE', schema: 'public', table: 'vrooms' },
                (payload) => {
                    const updatedVroomRaw = payload.new as any;
                    setItems(prev => {
                        const newVrooms = prev.vrooms.map(v => {
                            if (v.id === updatedVroomRaw.id) {
                                return {
                                    ...v,
                                    followers: updatedVroomRaw.followers_count || 0,
                                    views: updatedVroomRaw.views_count?.toString() || v.views,
                                    recent_views: updatedVroomRaw.views_count
                                };
                            }
                            return v;
                        });
                        return { ...prev, vrooms: newVrooms };
                    });
                }
            )
            .subscribe();

        return () => {
            window.removeEventListener('vroom-follow-changed' as any, handleFollowChange);
            window.removeEventListener('vroom-viewed' as any, handleViewed);
            supabase.removeChannel(channel);
        };
    }, [searchQuery]);

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            try {
                const results = await api.search(searchQuery);
                setItems({ products: results.products, vrooms: results.vrooms });
            } catch (e) {
                console.error(e);
            } finally {
                setLoading(false);
            }
        };

        // Immediate fetch if empty (initial load), debounce otherwise
        if (!searchQuery) {
            fetchData();
        } else {
            const timer = setTimeout(fetchData, 300);
            return () => clearTimeout(timer);
        }
    }, [searchQuery]);

    const categories = [
        'All Categories',
        'Electronics & Technology',
        'Fashion & Apparel',
        'Home, Garden & Living',
        'Health & Beauty',
        'Sports & Outdoors',
        'Toys, Kids & Baby'
    ];

    const getDisplayItems = () => {
        let displayProducts = [...items.products];
        let displayVrooms = [...items.vrooms];

        if (activeCategory !== 'All Categories') {
            const cat = activeCategory.toLowerCase();
            let keywords: string[] = [];
            if (cat.includes('electronics')) keywords = ['electronic', 'tech', 'gadget', 'camera', 'phone', 'laptop', 'monitor'];
            else if (cat.includes('fashion')) keywords = ['fashion', 'apparel', 'clothing', 'wear', 'dress', 'shirt', 'shoe', 'vintage'];
            else if (cat.includes('home')) keywords = ['home', 'garden', 'living', 'furniture', 'decor', 'sofa', 'lamp'];
            else if (cat.includes('health')) keywords = ['health', 'beauty', 'skin', 'makeup', 'care'];
            else if (cat.includes('sports')) keywords = ['sport', 'outdoor', 'gym', 'fitness', 'yoga'];
            else if (cat.includes('toys')) keywords = ['toy', 'kid', 'baby', 'game', 'lego'];
            else keywords = [cat];

            const match = (text?: string) => {
                if (!text) return false;
                const t = text.toLowerCase();
                return keywords.some(k => t.includes(k));
            };

            displayProducts = displayProducts.filter(p => match(p.category) || match(p.description) || match(p.name));
            displayVrooms = displayVrooms.filter(v => match(v.name) || match(v.description));
        }

        if (sortOrder === 'Price: Low to High') {
            displayProducts.sort((a, b) => (a.price || 0) - (b.price || 0));
        } else if (sortOrder === 'Price: High to Low') {
            displayProducts.sort((a, b) => (b.price || 0) - (a.price || 0));
        }

        let combined: (Product | Vroom)[] = [];
        if (filterType === 'All') combined = [...displayProducts, ...displayVrooms];
        else if (filterType === 'Products') combined = [...displayProducts];
        else if (filterType === 'Vrooms') combined = [...displayVrooms];

        return combined;
    };

    const handleLike = async (e: React.MouseEvent, product: Product) => {
        e.stopPropagation();
        try {
            const { likes, isLiked } = await api.toggleLike(product.id);
            setItems(prev => ({
                ...prev,
                products: prev.products.map(p => p.id === product.id ? { ...p, likes, isLiked } : p)
            }));
        } catch (e) { console.error(e); }
    };

    const handleBookmark = async (e: React.MouseEvent, product: Product) => {
        e.stopPropagation();
        try {
            const { isBookmarked } = await api.toggleBookmark(product.id);
            setItems(prev => ({
                ...prev,
                products: prev.products.map(p => p.id === product.id ? { ...p, isBookmarked } : p)
            }));
        } catch (e) { console.error(e); }
    };

    const handleShareLocal = async (e: React.MouseEvent, product: Product) => {
        e.stopPropagation();
        try {
            const newCount = await api.incrementShare(product.id);
            setItems(prev => ({
                ...prev,
                products: prev.products.map(p => p.id === product.id ? { ...p, sharesCount: newCount } : p)
            }));
        } catch (e) { console.error(e); }
        onShare(product);
    };

    const handleToggleStock = async (e: React.MouseEvent, product: Product) => {
        e.stopPropagation();
        try {
            const newStatus = !product.isOutOfStock;
            await api.toggleStockStatus(product.id, newStatus);
            setItems(prev => ({
                ...prev,
                products: prev.products.map(p => p.id === product.id ? { ...p, isOutOfStock: newStatus } : p)
            }));
        } catch (e) {
            console.error(e);
            alert("Failed to toggle stock status");
        }
    };

    const displayItems = getDisplayItems();
    const isVroom = (item: Product | Vroom): item is Vroom => (item as Vroom).productCount !== undefined;

    return (
        <div className="flex-1 min-h-screen bg-background pb-10">
            <div className="p-4 space-y-6">
                <div className="space-y-4">
                    <div className="flex gap-2">
                        <div className="relative flex-1">
                            <i className="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"></i>
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Search products, vrooms..."
                                className="w-full pl-10 pr-4 py-2 border border-border rounded-lg bg-background focus:outline-none focus:ring-1 focus:ring-primary"
                            />
                        </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                        <select value={filterType} onChange={(e) => setFilterType(e.target.value)} className="flex-1 min-w-[110px] px-3 py-2 border border-border rounded-lg bg-background text-sm">
                            <option value="All">All Types</option>
                            <option value="Products">Products</option>
                            <option value="Vrooms">Vrooms</option>
                        </select>
                        <select value={activeCategory} onChange={(e) => setActiveCategory(e.target.value)} className="flex-[2] min-w-[180px] px-3 py-2 border border-border rounded-lg bg-background text-sm">
                            {categories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                        </select>
                        <select value={sortOrder} onChange={(e) => setSortOrder(e.target.value)} className="flex-1 min-w-[140px] px-3 py-2 border border-border rounded-lg bg-background text-sm">
                            <option value="Most Recent">Most Recent</option>
                            <option value="Price: Low to High">Price: Low to High</option>
                            <option value="Price: High to Low">Price: High to Low</option>
                        </select>
                    </div>
                </div>

                <div className="flex border-b border-border">
                    {['Discover', 'Trending'].map(tab => (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab)}
                            className={`flex-1 px-6 py-3 text-sm font-bold transition-colors border-b-2 flex items-center justify-center
                      ${activeTab === tab ? 'border-primary text-primary' : 'border-transparent text-muted-foreground'}
                    `}
                        >
                            <i className={`fas fa-${tab === 'Discover' ? 'compass' : 'fire'} mr-2`}></i>
                            {tab}
                        </button>
                    ))}
                </div>

                <div className="space-y-4">
                    {activeTab === 'Trending' ? (
                        <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                            <TrendingList
                                onHashtagClick={(tag) => {
                                    setSearchQuery(tag);
                                    setActiveTab('Discover');
                                }}
                            />

                            <div className="mt-8">
                                <h4 className="font-bold mb-4 px-1">Trending Products</h4>
                                <div className="explore-grid grid grid-cols-2 gap-2 p-2 md:grid-cols-3 lg:grid-cols-4">
                                    {[...displayItems].filter(item => !isVroom(item)).sort((a: any, b: any) => (b.likes || 0) - (a.likes || 0)).slice(0, 4).map((product: any) => (
                                        <div key={product.id} className="bg-card rounded-xl border border-border overflow-hidden hover:shadow-md transition-shadow group flex flex-col">
                                            <div className="relative aspect-square overflow-hidden bg-black cursor-pointer w-full" onClick={() => onProductClick(product)}>
                                                <img src={product.image} alt={product.name} className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105" />
                                                {product.isOutOfStock && (
                                                    <div className="absolute inset-0 bg-black/60 flex items-center justify-center z-10 pointer-events-none">
                                                        <span className="border-2 border-white text-white font-black text-xs px-2 py-1 transform -rotate-12 uppercase tracking-widest opacity-80">
                                                            Sold Out
                                                        </span>
                                                    </div>
                                                )}
                                            </div>
                                            <div className="p-2 flex flex-col flex-1">
                                                <h4 className="font-bold truncate text-sm cursor-pointer hover:underline mb-0.5" onClick={() => onProductClick(product)}>{product.name}</h4>
                                                <span className={`font-bold text-sm ${product.isOutOfStock ? 'text-muted-foreground line-through decoration-1' : 'text-[#E86C44]'}`}>
                                                    {formatPrice(convertPrice(product.price, product.currency), userCurrency)}
                                                </span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    ) : (
                        <>
                            <h3 className="font-bold text-lg text-foreground flex items-center justify-between">
                                <span>{filterType === 'All' ? 'Explore' : filterType} Results</span>
                                <span className="text-sm font-normal text-muted-foreground">{displayItems.length} items</span>
                            </h3>

                            {loading ? (
                                <div className="text-center py-20"><i className="fas fa-circle-notch fa-spin text-2xl text-primary"></i></div>
                            ) : displayItems.length === 0 ? (
                                <div className="text-center py-20 flex flex-col items-center justify-center opacity-60">
                                    <i className="fas fa-search text-4xl mb-4 text-muted-foreground"></i>
                                    <p className="font-bold text-lg">No results found</p>
                                    <p className="text-sm text-muted-foreground">Try adjusting your search or filters.</p>
                                    <button onClick={() => { setSearchQuery(''); setActiveCategory('All Categories'); setFilterType('All'); }} className="mt-4 text-primary font-bold text-sm hover:underline">Clear Filters</button>
                                </div>
                            ) : (
                                <div className="explore-grid grid grid-cols-2 gap-2 p-2 md:grid-cols-3 lg:grid-cols-4">
                                    {displayItems.map((item) => {
                                        if (isVroom(item)) {
                                            return (
                                                <div
                                                    key={item.id}
                                                    onClick={() => onVroomClick && onVroomClick(item)}
                                                    className="bg-card rounded-xl border border-border overflow-hidden hover:shadow-md hover:border-[#E86C44]/50 transition-all group cursor-pointer"
                                                >
                                                    <div className="relative aspect-square overflow-hidden bg-muted">
                                                        <img src={item.coverImage} alt={item.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                                                        <div className="absolute inset-0 bg-black/20 flex items-center justify-center text-center p-2">
                                                            <div className="bg-white/90 text-foreground px-2 py-1 rounded-full text-[10px] font-bold shadow-sm"><i className="fas fa-store mr-1"></i> Vroom</div>
                                                        </div>
                                                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-end justify-center pb-2 opacity-0 group-hover:opacity-100">
                                                            <span className="bg-[#E86C44] text-white text-[10px] font-bold px-3 py-1 rounded-full shadow">View Vroom</span>
                                                        </div>
                                                    </div>
                                                    <div className="p-2 space-y-1">
                                                        <h4 className="font-bold truncate text-sm group-hover:text-[#E86C44] transition-colors">{item.name}</h4>
                                                        {item.ownerName && (
                                                            <p className="text-[10px] text-muted-foreground truncate">
                                                                by <span
                                                                    className="cursor-pointer hover:text-[#E86C44] hover:underline transition-colors"
                                                                    onClick={(e) => { e.stopPropagation(); item.ownerId && onUserClick && onUserClick(item.ownerId); }}
                                                                >{item.ownerName}</span>
                                                            </p>
                                                        )}
                                                        <div className="flex items-center gap-2 text-[10px] font-medium text-muted-foreground">
                                                            <span>{item.productCount} Products</span>
                                                            <span>·</span>
                                                            <span>{item.followers} Followers</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        } else {
                                            const product = item as Product;
                                            return (
                                                <div key={product.id} className="bg-card rounded-xl border border-border overflow-hidden hover:shadow-md transition-shadow group flex flex-col">
                                                    <div className="relative aspect-square overflow-hidden bg-black cursor-pointer w-full" onClick={() => onProductClick(product)}>
                                                        {product.isOutOfStock && (
                                                            <div className="absolute inset-0 bg-black/60 flex items-center justify-center z-10 pointer-events-none">
                                                                <span className="border-2 border-white text-white font-black text-xs px-2 py-1 transform -rotate-12 uppercase tracking-widest opacity-80">
                                                                    Sold Out
                                                                </span>
                                                            </div>
                                                        )}
                                                        {product.video ? (
                                                            <><VideoWithWatermark src={product.video} containerClassName="w-full h-full" className="w-full h-full object-cover opacity-80" muted playsInline userId={product.userId} /><div className="absolute inset-0 flex items-center justify-center pointer-events-none"><div className="w-8 h-8 bg-black/50 rounded-full flex items-center justify-center backdrop-blur-sm"><i className="fas fa-play text-white text-xs ml-0.5"></i></div></div></>
                                                        ) : (
                                                            <img src={product.image} alt={product.name} className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105" />
                                                        )}
                                                    </div>
                                                    <div className="p-2 flex flex-col flex-1">
                                                        <h4 className="font-bold truncate text-sm cursor-pointer hover:underline mb-0.5" onClick={() => onProductClick(product)}>{product.name}</h4>
                                                        <div className="flex items-center justify-between mb-2">
                                                            <span className={`font-bold text-sm ${product.isOutOfStock ? 'text-muted-foreground line-through decoration-1' : 'text-[#E86C44]'}`}>
                                                                {formatPrice(convertPrice(product.price, product.currency), userCurrency)}
                                                            </span>
                                                        </div>

                                                        {/* Action Buttons: Well Balanced & Synced */}
                                                        <div className="flex items-stretch gap-1 h-11 mt-auto bg-muted/20 rounded-lg p-1">
                                                            {product.userId !== currentUser.id ? (
                                                                <button
                                                                    data-title={product.isOutOfStock ? "Sold Out" : "Cart"}
                                                                    onClick={(e) => { e.stopPropagation(); if (!product.isOutOfStock) onAddToCart(product); }}
                                                                    disabled={product.isOutOfStock}
                                                                    className={`custom-tooltip flex-1 text-white rounded-md flex items-center justify-center shadow-sm transition-all ${product.isOutOfStock
                                                                        ? 'bg-muted-foreground cursor-not-allowed opacity-50'
                                                                        : 'bg-[#E86C44] hover:bg-[#d6623e] active:scale-90'
                                                                        }`}
                                                                >
                                                                    {product.isOutOfStock ? (
                                                                        <i className="fas fa-ban text-xs"></i>
                                                                    ) : (
                                                                        <i className="fas fa-shopping-cart text-xs"></i>
                                                                    )}
                                                                </button>
                                                            ) : (
                                                                <button
                                                                    data-title="Toggle Stock"
                                                                    onClick={(e) => handleToggleStock(e, product)}
                                                                    className={`custom-tooltip flex-1 rounded-md flex items-center justify-center shadow-sm transition-all text-white ${product.isOutOfStock ? 'bg-green-600' : 'bg-red-500'}`}
                                                                >
                                                                    <i className={`fas ${product.isOutOfStock ? 'fa-check' : 'fa-ban'} text-xs`}></i>
                                                                </button>
                                                            )}

                                                            <button
                                                                data-title="Like"
                                                                onClick={(e) => handleLike(e, product)}
                                                                className="custom-tooltip flex-1 bg-white border border-border rounded-md flex flex-col items-center justify-center active:scale-95 transition-transform"
                                                            >
                                                                <i className={`${product.isLiked ? 'fas' : 'far'} fa-heart text-[#E86C44] text-[10px]`}></i>
                                                                <span className="text-[8px] font-bold mt-0.5 leading-none">{product.likes > 0 ? product.likes.toLocaleString() : '0'}</span>
                                                            </button>

                                                            <button
                                                                data-title="Share"
                                                                onClick={(e) => handleShareLocal(e, product)}
                                                                className="custom-tooltip flex-1 bg-white border border-border rounded-md flex flex-col items-center justify-center active:scale-95 transition-transform"
                                                            >
                                                                <i className="fas fa-share text-foreground text-[10px]"></i>
                                                                <span className="text-[8px] font-bold mt-0.5 leading-none">{(product.sharesCount || 0) > 0 ? (product.sharesCount || 0).toLocaleString() : '0'}</span>
                                                            </button>

                                                            <button
                                                                data-title="Bookmark"
                                                                onClick={(e) => handleBookmark(e, product)}
                                                                className="custom-tooltip flex-1 bg-white border border-border rounded-md flex items-center justify-center active:scale-95 transition-transform"
                                                            >
                                                                <i className={`${product.isBookmarked ? 'fas' : 'far'} fa-bookmark text-[#E86C44] text-[10px]`}></i>
                                                            </button>
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        }
                                    })}
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

export default Explore;
