
import React, { useState, useEffect, useRef } from 'react';
import { Post, Product, Vroom, User } from '../types';
import { api } from '../api';
import { useDwellDetection } from '../hooks/useDwellDetection';
import PopularVroomsList from './PopularVroomsList';
import { useCurrency } from '../context/useCurrency';

interface FeedProps {
    posts: Post[];
    onAddToCart: (product: Product) => void;
    onProductClick: (product: Product) => void;
    onShare: (product: Product) => void;
    onVroomClick: (vroom: Vroom) => void;
    onUserClick?: (userId: string) => void;
    isLoading?: boolean;
    currentUser: User;
}

const FeedPost: React.FC<{
    post: Post;
    index: number;
    onDwell: (post: Post, index: number) => void;
    onAddToCart: (product: Product) => void;
    onProductClick: (product: Product) => void;
    onShare: (product: Product) => void;
    handleLike: (product: Product) => void;
    handleBookmark: (product: Product) => void;
    onUserClick?: (userId: string) => void;
    currentUser: User;
}> = ({ post, index, onDwell, onAddToCart, onProductClick, onShare, handleLike, handleBookmark, onUserClick, currentUser }) => {
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const { convertPrice, formatPrice, userCurrency } = useCurrency();

    // Local state for product to handle immediate UI updates (like stock toggle)
    const [product, setProduct] = useState(post.product);

    useEffect(() => {
        setProduct(post.product);
    }, [post.product]);

    const dwellRef = useDwellDetection(() => {
        onDwell(post, index);
    }, 3000);

    const handleReport = async () => {
        const reason = prompt("Why are you reporting this post? (e.g., Inappropriate, Spam, Offensive)");
        if (reason) {
            try {
                await api.reportPost(post.id, reason);
                alert("Post reported successfully. Our team will review it.");
            } catch (e) {
                alert("Failed to report post.");
            }
        }
        setIsMenuOpen(false);
    };

    const handleToggleStock = async () => {
        try {
            const newStatus = !product.isOutOfStock;
            // Immediate UI update
            setProduct(prev => ({ ...prev, isOutOfStock: newStatus }));
            setIsMenuOpen(false);

            // DB Update
            await api.toggleStockStatus(product.id, newStatus);
        } catch (e) {
            console.error(e);
            // Revert on failure
            setProduct(prev => ({ ...prev, isOutOfStock: !prev.isOutOfStock }));
            alert("Failed to update stock status. Please check your connection.");
        }
    };

    const isRecommended = post.id.startsWith('rec-');
    const isDiscovery = post.id.startsWith('disc-');
    const isOwner = currentUser.id === product.userId;

    const handleProductClick = () => {
        if (product.isSponsored && product.userId && product.userId !== currentUser.id) {
            api.registerBoostClick(product.id, currentUser.id);
        }
        onProductClick(product);
    };

    // Currency Conversion
    const displayPrice = convertPrice(product.price, product.currency);
    const formattedPrice = formatPrice(displayPrice, userCurrency);

    return (
        <div ref={dwellRef} className={`p-6 relative border-b border-border/50 ${isRecommended ? 'bg-[#E86C44]/5' : ''}`}>
            {isRecommended && (
                <div className="mb-4 flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-[#E86C44] animate-in fade-in slide-in-from-left-2">
                    <div className="w-5 h-5 bg-[#E86C44] text-white rounded-full flex items-center justify-center">
                        <i className="fas fa-sparkles text-[10px]"></i>
                    </div>
                    Based on your interest
                </div>
            )}
            {isDiscovery && (
                <div className="mb-4 flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-accent animate-in fade-in slide-in-from-left-2">
                    <div className="w-5 h-5 bg-accent text-white rounded-full flex items-center justify-center">
                        <i className="fas fa-bolt text-[10px]"></i>
                    </div>
                    Fresh for you
                </div>
            )}

            <div className="absolute top-4 right-6 z-10">
                <button onClick={() => setIsMenuOpen(!isMenuOpen)} className="p-2 text-muted-foreground hover:text-foreground">
                    <i className="fas fa-ellipsis-h"></i>
                </button>
                {isMenuOpen && (
                    <div className="absolute right-0 top-10 w-56 bg-card border border-border rounded-xl shadow-xl z-20 overflow-hidden animate-in fade-in zoom-in-95">
                        {isOwner && (
                            <button
                                onClick={handleToggleStock}
                                className={`w-full text-left px-4 py-3 text-sm font-bold flex items-center gap-3 transition-colors ${product.isOutOfStock ? 'text-green-600 hover:bg-green-50' : 'text-red-500 hover:bg-red-50'}`}
                            >
                                <i className={`fas ${product.isOutOfStock ? 'fa-check-circle' : 'fa-ban'}`}></i>
                                {product.isOutOfStock ? 'Mark as In Stock' : 'Mark as Out of Stock'}
                            </button>
                        )}
                        <button onClick={handleReport} className="w-full text-left px-4 py-3 text-sm hover:bg-muted text-destructive font-bold flex items-center gap-3">
                            <i className="fas fa-flag"></i> Report Post
                        </button>
                        <button onClick={() => setIsMenuOpen(false)} className="w-full text-left px-4 py-3 text-sm hover:bg-muted text-muted-foreground flex items-center gap-3 border-t border-border">
                            <i className="fas fa-times"></i> Cancel
                        </button>
                    </div>
                )}
            </div>

            <div className="flex space-x-3">
                <img
                    src={post.user.avatar}
                    alt={post.user.name}
                    className="w-10 h-10 rounded-full object-cover flex-shrink-0 cursor-pointer hover:opacity-80 transition-opacity"
                    onClick={() => onUserClick && onUserClick(post.user.id)}
                />

                <div className="flex-1 min-w-0 space-y-4">
                    <div className="flex items-center space-x-2 flex-wrap">
                        <span
                            className="font-semibold text-base cursor-pointer hover:underline"
                            onClick={() => onUserClick && onUserClick(post.user.id)}
                        >
                            {post.user.name}
                        </span>
                        <span
                            className="text-muted-foreground text-sm cursor-pointer hover:underline"
                            onClick={() => onUserClick && onUserClick(post.user.id)}
                        >
                            {post.user.handle}
                        </span>
                        <span className="text-muted-foreground text-sm">·</span>
                        <span className={`text-xs font-bold ${isRecommended ? 'text-[#E86C44]' : 'text-muted-foreground'}`}>{post.timestamp}</span>
                    </div>

                    <div className="space-y-4">
                        <p className="text-base leading-relaxed whitespace-pre-line text-foreground/90">{post.content}</p>

                        {/* Seamless Product Card Unit - Zero separation visible */}
                        <div className="flex flex-col border border-border/10 rounded-2xl bg-transparent shadow-none">
                            {/* Media Container - Rounded corners & boundary added */}
                            <div className="cursor-pointer hover:opacity-95 transition-opacity bg-black rounded-2xl overflow-hidden border-b border-border/10 relative">
                                {/* Out of Stock Overlay */}
                                {product.isOutOfStock && (
                                    <div className="absolute inset-0 bg-black/60 flex items-center justify-center z-10 pointer-events-none">
                                        <span className="border-4 border-white text-white font-black text-2xl px-6 py-3 transform -rotate-12 uppercase tracking-widest opacity-80">
                                            Out of Stock
                                        </span>
                                    </div>
                                )}

                                {product.video ? (
                                    <video src={product.video} controls playsInline className="w-full max-h-[600px] object-contain" />
                                ) : (
                                    <img src={product.image} alt={product.name} onClick={handleProductClick} className="w-full object-contain max-h-[600px]" />
                                )}
                            </div>

                            {/* Integrated Description Area - Transparent Background & No Shadows */}
                            <div className="bg-transparent p-4">
                                <div className="flex items-center justify-between mb-2 cursor-pointer hover:opacity-80 transition-opacity" onClick={handleProductClick}>
                                    <h4 className="font-bold text-lg truncate pr-2 uppercase tracking-tight">{product.name}</h4>
                                    <span className={`text-xl font-black whitespace-nowrap ${product.isOutOfStock ? 'text-muted-foreground line-through decoration-2' : 'text-[#E86C44]'}`}>
                                        {formattedPrice}
                                    </span>
                                </div>
                                <p className="text-sm text-muted-foreground mb-4 line-clamp-2 leading-relaxed">{product.description}</p>

                                <div className="flex items-stretch gap-2 h-12">
                                    {product.userId !== currentUser.id && (
                                        <button
                                            data-title={product.isOutOfStock ? "Out of Stock" : "Cart"}
                                            onClick={() => !product.isOutOfStock && onAddToCart(product)}
                                            disabled={product.isOutOfStock}
                                            className={`custom-tooltip text-white px-6 rounded-xl flex items-center justify-center transition-colors shadow-none ${product.isOutOfStock
                                                    ? 'bg-muted-foreground cursor-not-allowed opacity-50'
                                                    : 'bg-[#E86C44] hover:bg-[#d6623e] active:scale-95'
                                                }`}
                                        >
                                            {product.isOutOfStock ? (
                                                <span className="text-[10px] font-bold uppercase whitespace-nowrap">Sold Out</span>
                                            ) : (
                                                <i className="fas fa-shopping-cart text-lg"></i>
                                            )}
                                        </button>
                                    )}
                                    <button
                                        data-title="Like"
                                        onClick={() => handleLike(product)}
                                        className={`custom-tooltip flex-1 bg-background border border-border/40 rounded-xl flex flex-col md:flex-row items-center justify-center gap-0.5 md:gap-2 hover:bg-muted/50 active:scale-95 shadow-none transition-colors ${product.isLiked ? 'bg-red-50/50' : ''}`}
                                    >
                                        <i className={`${product.isLiked ? 'fas text-red-500' : 'far text-[#E86C44]'} fa-heart text-base transition-transform ${product.isLiked ? 'scale-110' : ''}`}></i>
                                        <span className={`text-[10px] md:text-xs font-black ${product.isLiked ? 'text-red-500' : 'text-foreground'}`}>{product.likes}</span>
                                    </button>
                                    <button data-title="Comment" onClick={handleProductClick} className="custom-tooltip flex-1 bg-background border border-border/40 rounded-xl flex flex-col md:flex-row items-center justify-center gap-0.5 md:gap-2 hover:bg-muted/50 active:scale-95 shadow-none">
                                        <i className="far fa-comment text-foreground text-base"></i>
                                        <span className="text-[10px] md:text-xs font-black text-foreground">{product.commentsCount}</span>
                                    </button>
                                    <button data-title="Share" onClick={() => onShare(product)} className="custom-tooltip flex-1 bg-background border border-border/40 rounded-xl flex flex-col md:flex-row items-center justify-center gap-0.5 md:gap-2 hover:bg-muted/50 active:scale-95 shadow-none">
                                        <i className="fas fa-share text-foreground text-base"></i>
                                        <span className="text-[10px] md:text-xs font-black text-foreground">{product.sharesCount || 0}</span>
                                    </button>
                                    <button data-title="Bookmark" onClick={() => handleBookmark(product)} className="custom-tooltip w-12 bg-background border border-border/40 rounded-xl flex items-center justify-center hover:bg-muted/50 active:scale-95 shadow-none">
                                        <i className={`${product.isBookmarked ? 'fas' : 'far'} fa-bookmark text-[#E86C44] text-base`}></i>
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

const Feed: React.FC<FeedProps> = ({ posts, onAddToCart, onProductClick, onShare, onVroomClick, onUserClick, isLoading, currentUser }) => {
    const [feedPosts, setFeedPosts] = useState<Post[]>([]);
    const processedPosts = useRef<Set<string>>(new Set());

    useEffect(() => {
        if (posts.length > 0 && feedPosts.length === 0) {
            setFeedPosts(posts);
        } else if (posts.length > 0 && feedPosts.length > 0) {
            // Careful sync: only update if posts changed significantly or to refresh comments
            const postsMap = new Map(posts.map(p => [p.id, p]));
            setFeedPosts(prev => prev.map(p => {
                const updated = postsMap.get(p.id);
                if (updated) {
                    return {
                        ...p,
                        product: {
                            ...p.product,
                            commentsCount: updated.product.commentsCount,
                            sharesCount: updated.product.sharesCount,
                            isOutOfStock: updated.product.isOutOfStock // Sync stock status updates from DB refetch
                        }
                    };
                }
                return p;
            }));
        }
    }, [posts]);

    const handleLike = async (product: Product) => {
        // 1. Optimistic Update
        const wasLiked = product.isLiked;
        const originalLikes = product.likes;

        const newLikes = wasLiked ? Math.max(0, originalLikes - 1) : originalLikes + 1;
        const newIsLiked = !wasLiked;

        const updatePosts = (currentPosts: Post[]) => currentPosts.map(p => {
            if (p.product.id === product.id) {
                return { ...p, product: { ...p.product, likes: newLikes, isLiked: newIsLiked } };
            }
            return p;
        });

        setFeedPosts(prev => updatePosts(prev));

        // 2. API Call
        try {
            const { likes, isLiked } = await api.toggleLike(product.id);
            // 3. Reconcile with actual server response
            setFeedPosts(prev => prev.map(p => {
                if (p.product.id === product.id) {
                    return { ...p, product: { ...p.product, likes, isLiked } };
                }
                return p;
            }));
        } catch (e) {
            // Revert on error
            console.error(e);
            setFeedPosts(prev => prev.map(p => {
                if (p.product.id === product.id) {
                    return { ...p, product: { ...p.product, likes: originalLikes, isLiked: wasLiked } };
                }
                return p;
            }));
        }
    };

    const handleBookmark = async (product: Product) => {
        try {
            const { isBookmarked } = await api.toggleBookmark(product.id);
            setFeedPosts(prev => prev.map(p => {
                if (p.product.id === product.id) {
                    return { ...p, product: { ...p.product, isBookmarked } };
                }
                return p;
            }));
        } catch (e) { console.error(e); }
    };

    const handleShareAction = (product: Product) => {
        // Trigger API increment then show modal
        api.incrementShare(product.id).then(newCount => {
            setFeedPosts(prev => prev.map(p => {
                if (p.product.id === product.id) {
                    return { ...p, product: { ...p.product, sharesCount: newCount } };
                }
                return p;
            }));
        });
        onShare(product);
    }

    const handleDwell = async (post: Post, index: number) => {
        if (processedPosts.current.has(post.id)) return;
        processedPosts.current.add(post.id);

        try {
            const recs = await api.getRecommendations(post.product.id);
            let discoveryItems: Post[] = [];
            if (Math.random() > 0.75) {
                const discoveryData = await api.getDiscovery();
                // Cast to Post[] - assuming api.getDiscovery returns items matching Post structure
                discoveryItems = discoveryData as unknown as Post[];
            }

            if (recs.length === 0 && discoveryItems.length === 0) return;
            const insertIndex = index + 2;

            setFeedPosts((prev: Post[]) => {
                const newFeed = [...prev];

                const candidates = [...recs, ...discoveryItems] as Post[];

                const uniqueRecs = candidates.filter((r: Post) =>
                    !newFeed.some((existing: Post) => existing.product.id === r.product.id)
                );

                if (uniqueRecs.length > 0) {
                    newFeed.splice(insertIndex, 0, ...uniqueRecs.slice(0, 2));
                }
                return newFeed;
            });
        } catch (e) {
            console.error("Failed to fetch intelligent recommendations", e);
        }
    };

    return (
        <div className="flex-1 min-h-screen">
            {/* Vrooms Bar - Mobile Only */}
            <div className="md:hidden">
                <PopularVroomsList onVroomClick={onVroomClick} />
            </div>

            <div className="divide-y divide-border">
                {feedPosts.map((post, idx) => (
                    <FeedPost
                        key={`${post.id}-${idx}`}
                        index={idx}
                        post={post}
                        onDwell={handleDwell}
                        onAddToCart={onAddToCart}
                        onProductClick={onProductClick}
                        onShare={handleShareAction}
                        handleLike={handleLike}
                        handleBookmark={handleBookmark}
                        onUserClick={onUserClick}
                        currentUser={currentUser}
                    />
                ))}
            </div>

            {isLoading && (
                <div className="p-8 text-center text-muted-foreground animate-pulse flex items-center justify-center gap-2">
                    <i className="fas fa-circle-notch fa-spin text-[#E86C44]"></i> Curating your feed...
                </div>
            )}
        </div>
    );
};

export default Feed;
