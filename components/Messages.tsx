import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Conversation, Message, User, Reaction, SharedProduct, Product } from '../types';
import { api } from '../api';
import { APP_URL } from '../constants';
import { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from '../supabaseClient';

interface MessagesProps {
    conversations: Conversation[];
    onSendMessage?: (conversationId: string, content: string, replyToId?: string, image?: string) => void;
    currentUser: User;
    onUserClick?: (userId: string) => void;
    onMarkAsRead?: (conversationId: string) => void;
    onForward?: (msg: Message) => void;
    onInternalLink?: (path: string) => void;
    onProductClick?: (product: Product) => void;
    onAddToCart?: (product: Product) => void;
}

const REACTION_EMOJIS = ['❤️', '😂', '😮', '😢', '🔥', '👍', '🙏'];

const formatDateHeader = (dateStr?: string) => {
    if (!dateStr) return 'TODAY';
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return 'TODAY';

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const msgDate = new Date(date);
    msgDate.setHours(0, 0, 0, 0);

    const diffTime = today.getTime() - msgDate.getTime();
    const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return "TODAY";
    if (diffDays > 0 && diffDays < 7) {
        const days = ["SUNDAY", "MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"];
        return days[msgDate.getDay()];
    }
    const options: Intl.DateTimeFormatOptions = { month: 'long', day: 'numeric', year: 'numeric' };
    return msgDate.toLocaleDateString('en-US', options);
};

const formatLastActive = (dateStr?: string) => {
    if (!dateStr) return 'Offline';
    const date = new Date(dateStr);
    const now = new Date();
    const diff = Math.floor((now.getTime() - date.getTime()) / 1000); // seconds

    if (diff < 60) return 'Just now';
    if (diff < 120) return '1m ago'; // 2 mins is online threshold
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return date.toLocaleDateString();
};

// Detects URLs in text and renders them as clickable links.
// Internal product/vroom URLs navigate within the app via onInternalLink.
// Recognises both the current origin and the canonical elddady.com domain.
const ELDDADY_HOSTS = ['elddady.com', 'www.elddady.com'];
const isElddadyOrigin = (url: URL) => {
    return url.origin === window.location.origin || ELDDADY_HOSTS.some(h => url.hostname === h);
};

const renderMessageContent = (text: string, onInternalLink?: (path: string) => void) => {
    const URL_REGEX = /(https?:\/\/[^\s]+|www\.[^\s]+)/g;
    const parts = text.split(URL_REGEX);
    URL_REGEX.lastIndex = 0;
    return parts.map((part, i) => {
        if (!URL_REGEX.test(part)) { URL_REGEX.lastIndex = 0; return <span key={i}>{part}</span>; }
        URL_REGEX.lastIndex = 0;
        try {
            const href = part.startsWith('http') ? part : `https://${part}`;
            const url = new URL(href);
            // Match clean path: /product/id or /vroom/id
            const internalPathMatch = url.pathname.match(/\/(product|vroom)\/([^/?#]+)/);
            // Also handle legacy hash-style: /#/product/id
            const hashMatch = (url.hash || '').match(/\/(product|vroom)\/([^/?#]+)/);
            const match = internalPathMatch || hashMatch;
            const isSameOrigin = isElddadyOrigin(url);

            if (isSameOrigin && match && onInternalLink) {
                const path = `/${match[1]}/${match[2]}`;
                return (
                    <button
                        key={i}
                        onClick={(e) => { e.stopPropagation(); onInternalLink(path); }}
                        className="underline decoration-dotted underline-offset-2 opacity-90 hover:opacity-100 hover:decoration-solid transition-all break-all text-left"
                        style={{ color: 'inherit', background: 'none', border: 'none', padding: 0, cursor: 'pointer', font: 'inherit' }}
                    >
                        {part}
                    </button>
                );
            }

            return (
                <a
                    key={i}
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="underline decoration-dotted underline-offset-2 opacity-90 hover:opacity-100 hover:decoration-solid transition-all break-all"
                    style={{ color: 'inherit' }}
                >
                    {part}
                </a>
            );
        } catch {
            return <span key={i}>{part}</span>;
        }
    });
};

const CollapsibleMessageText: React.FC<{ content: string; isDeleted?: boolean; onInternalLink?: (url: string) => void; isMe?: boolean }> = ({ content, isDeleted, onInternalLink, isMe }) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const [isTruncated, setIsTruncated] = useState(false);
    const textRef = useRef<HTMLParagraphElement>(null);

    useEffect(() => {
        const pElement = textRef.current;
        if (pElement) {
            // Check if scrollHeight is strictly greater than clientHeight to detect truncation
            setIsTruncated(pElement.scrollHeight > pElement.clientHeight);
        }
        // Returns to wrapped state on component unmount automatically via initial state
    }, [content]);

    return (
        <div className="flex flex-col relative w-full group">
            <p 
                ref={textRef} 
                className={`whitespace-pre-wrap break-words ${isDeleted ? 'italic text-primary-foreground/70' : ''} ${!isExpanded ? 'line-clamp-[8]' : ''}`}
            >
                {renderMessageContent(content, onInternalLink)}
            </p>
            {isTruncated && !isExpanded && (
                <button 
                  onClick={(e) => { e.stopPropagation(); setIsExpanded(true); }}
                  className={`text-[12px] font-bold mt-1 self-start select-none underline decoration-dotted underline-offset-2 ${isMe ? 'text-primary-foreground/80 hover:text-primary-foreground' : 'text-primary hover:text-primary/80'}`}
                >
                  Read More
                </button>
            )}
            {isExpanded && (
                <button 
                  onClick={(e) => { e.stopPropagation(); setIsExpanded(false); }}
                  className={`text-[12px] font-bold mt-1 self-start select-none underline decoration-dotted underline-offset-2 ${isMe ? 'text-primary-foreground/80 hover:text-primary-foreground' : 'text-primary hover:text-primary/80'}`}
                >
                  Show Less
                </button>
            )}
        </div>
    );
};


// --- Product Card Sharing ---

const PRODUCT_CARD_PREFIX = '__PRODUCT_CARD__';

const parseSharedProduct = (content: string): SharedProduct | null => {
    if (!content || !content.startsWith(PRODUCT_CARD_PREFIX)) return null;
    try {
        const json = content.slice(PRODUCT_CARD_PREFIX.length);
        const data = JSON.parse(json);
        if (data && data.id && data.name && data.image) return data as SharedProduct;
    } catch { /* not valid JSON */ }
    return null;
};

const SharedProductCard: React.FC<{
    product: SharedProduct;
    isMe: boolean;
    currentUser: User;
    onProductClick?: (product: Product) => void;
    onAddToCart?: (product: Product) => void;
}> = ({ product, isMe, currentUser, onProductClick, onAddToCart }) => {
    // Live product data (fetched from API), falls back to embedded snapshot
    const [liveData, setLiveData] = useState<Product | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isLiked, setIsLiked] = useState(false);
    const [likes, setLikes] = useState(0);
    const [isBookmarked, setIsBookmarked] = useState(false);

    // Fetch fresh product data on mount
    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const fresh = await api.getProductById(product.id);
                if (!cancelled && fresh) {
                    setLiveData(fresh);
                    setIsLiked(!!fresh.isLiked);
                    setLikes(fresh.likes || 0);
                    setIsBookmarked(!!fresh.isBookmarked);
                }
            } catch {
                // Product may have been deleted — keep embedded snapshot
            } finally {
                if (!cancelled) setIsLoading(false);
            }
        })();
        return () => { cancelled = true; };
    }, [product.id]);

    // Use live data if available, otherwise embedded snapshot
    const displayName = liveData?.name ?? product.name;
    const displayDesc = liveData?.description ?? product.description;
    const displayPrice = liveData?.price ?? product.price;
    const displayCurrency = liveData?.currency ?? product.currency;
    const displayImage = liveData?.image ?? product.image;
    const isOutOfStock = liveData?.isOutOfStock ?? false;

    // Build a Product-shaped object for callbacks
    const toProduct = (): Product => ({
        id: product.id,
        name: displayName,
        description: displayDesc,
        price: displayPrice,
        currency: displayCurrency,
        image: displayImage,
        likes: likes,
        isLiked: isLiked,
        isBookmarked: isBookmarked,
        isOutOfStock: isOutOfStock,
        userId: liveData?.userId
    });

    const handleLike = async (e: React.MouseEvent) => {
        e.stopPropagation();
        const wasLiked = isLiked;
        setIsLiked(!wasLiked);
        setLikes(prev => wasLiked ? Math.max(0, prev - 1) : prev + 1);
        try {
            const result = await api.toggleLike(product.id);
            setIsLiked(result.isLiked);
            setLikes(result.likes);
        } catch {
            setIsLiked(wasLiked);
            setLikes(prev => wasLiked ? prev + 1 : Math.max(0, prev - 1));
        }
    };

    const handleBookmark = async (e: React.MouseEvent) => {
        e.stopPropagation();
        try {
            const result = await api.toggleBookmark(product.id);
            setIsBookmarked(result.isBookmarked);
        } catch { /* ignore */ }
    };

    const handleAddToCart = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (isOutOfStock) return;
        if (onAddToCart) onAddToCart(toProduct());
    };

    const handleCardClick = () => {
        if (onProductClick) onProductClick(toProduct());
    };

    // Format price with currency symbol
    const formatPrice = (price: number, currency: string) => {
        try {
            return new Intl.NumberFormat('en-US', { style: 'currency', currency: currency || 'USD' }).format(price);
        } catch {
            return `${currency || '$'}${price.toFixed(2)}`;
        }
    };

    return (
        <div className="w-[280px] rounded-xl overflow-hidden border border-border/30 bg-white dark:bg-zinc-900 shadow-sm">
            {/* Product Image */}
            <div
                className="relative cursor-pointer hover:opacity-95 transition-opacity bg-black"
                onClick={handleCardClick}
            >
                <img
                    src={displayImage}
                    alt={displayName}
                    className={`w-full h-[180px] object-cover transition-opacity ${isLoading ? 'opacity-80' : ''}`}
                />
                {/* Gradient overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />
                {/* Shared badge */}
                <div className="absolute top-2 left-2 bg-black/50 backdrop-blur-sm text-white text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded-full flex items-center gap-1">
                    <i className="fas fa-shopping-bag text-[8px]" />
                    Product
                </div>
                {/* Out of stock overlay */}
                {isOutOfStock && (
                    <div className="absolute inset-0 bg-black/60 flex items-center justify-center pointer-events-none">
                        <span className="border-2 border-white text-white font-black text-sm px-4 py-1.5 transform -rotate-12 uppercase tracking-widest opacity-80">
                            Out of Stock
                        </span>
                    </div>
                )}
                {/* Loading shimmer */}
                {isLoading && (
                    <div className="absolute bottom-2 right-2">
                        <i className="fas fa-circle-notch fa-spin text-white/70 text-xs" />
                    </div>
                )}
            </div>

            {/* Product Info */}
            <div className="p-3 space-y-2">
                <div
                    className="flex items-center justify-between cursor-pointer hover:opacity-80 transition-opacity"
                    onClick={handleCardClick}
                >
                    <h4 className="font-bold text-sm truncate pr-2 uppercase tracking-tight text-foreground">
                        {displayName}
                    </h4>
                    <span className={`text-sm font-black whitespace-nowrap ${isOutOfStock ? 'text-muted-foreground line-through decoration-2' : 'text-[#E86C44]'}`}>
                        {formatPrice(displayPrice, displayCurrency)}
                    </span>
                </div>

                {displayDesc && (
                    <p className="text-[11px] text-muted-foreground line-clamp-2 leading-relaxed">
                        {displayDesc}
                    </p>
                )}

                {/* Action Buttons */}
                <div className="flex items-stretch gap-1.5 h-9 pt-1">
                    <button
                        onClick={handleAddToCart}
                        disabled={isOutOfStock}
                        className={`text-white px-3 rounded-lg flex items-center justify-center active:scale-95 transition-all shadow-sm ${
                            isOutOfStock
                                ? 'bg-muted-foreground cursor-not-allowed opacity-50'
                                : 'bg-[#E86C44] hover:bg-[#d6623e]'
                        }`}
                        title={isOutOfStock ? 'Out of Stock' : 'Add to Cart'}
                    >
                        {isOutOfStock
                            ? <span className="text-[8px] font-bold uppercase whitespace-nowrap">Sold</span>
                            : <i className="fas fa-shopping-cart text-xs" />
                        }
                    </button>
                    <button
                        onClick={handleLike}
                        className={`flex-1 bg-background border border-border/40 rounded-lg flex items-center justify-center gap-1 hover:bg-muted/50 active:scale-95 transition-all ${isLiked ? 'bg-red-50/50' : ''}`}
                        title="Like"
                    >
                        <i className={`${isLiked ? 'fas text-red-500' : 'far text-[#E86C44]'} fa-heart text-xs transition-transform ${isLiked ? 'scale-110' : ''}`} />
                        {likes > 0 && <span className={`text-[9px] font-black ${isLiked ? 'text-red-500' : 'text-foreground'}`}>{likes}</span>}
                    </button>
                    <button
                        onClick={handleBookmark}
                        className="w-9 bg-background border border-border/40 rounded-lg flex items-center justify-center hover:bg-muted/50 active:scale-95 transition-all"
                        title="Bookmark"
                    >
                        <i className={`${isBookmarked ? 'fas' : 'far'} fa-bookmark text-[#E86C44] text-xs`} />
                    </button>
                </div>
            </div>
        </div>
    );
};


const ChatList: React.FC<{
    conversations: Conversation[];
    onSelectChat: (id: string) => void;
    onCreateGroup: () => void;
    onJoinGroup: () => void;
    currentUser: User;
    onUserClick?: (userId: string) => void;
}> = ({ conversations, onSelectChat, onCreateGroup, onJoinGroup, currentUser, onUserClick }) => {

    const [filter, setFilter] = useState<'all' | 'groups' | 'starred'>('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [dbUsers, setDbUsers] = useState<User[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Debounced DB search — fires 300ms after user stops typing
    const searchUsersFromDb = useCallback(async (query: string) => {
        if (!query || query.trim().length < 2) {
            setDbUsers([]);
            setIsSearching(false);
            return;
        }
        setIsSearching(true);
        try {
            const q = query.trim();
            const { data, error } = await supabase
                .from('profiles')
                .select('id, name, handle, avatar')
                .or(`name.ilike.%${q}%,handle.ilike.%${q}%`)
                .neq('id', currentUser.id)
                .limit(15);
            if (!error && data) {
                setDbUsers(data.map((p: any) => ({
                    id: p.id,
                    name: p.name,
                    handle: p.handle,
                    avatar: p.avatar,
                    isOnline: false
                })));
            }
        } catch (e) {
            console.error('User search failed:', e);
        } finally {
            setIsSearching(false);
        }
    }, [currentUser.id]);

    useEffect(() => {
        if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
        if (!searchQuery.trim()) {
            setDbUsers([]);
            return;
        }
        searchTimerRef.current = setTimeout(() => {
            searchUsersFromDb(searchQuery);
        }, 300);
        return () => { if (searchTimerRef.current) clearTimeout(searchTimerRef.current); };
    }, [searchQuery, searchUsersFromDb]);

    const queryLower = searchQuery.trim().toLowerCase();

    const filteredConversations = conversations.map(c => {
        if (filter === 'starred') {
            const starredMsgs = c.messages.filter(m => m.starredBy?.includes(currentUser.id));
            if (starredMsgs.length === 0) return null;
            return { ...c, messages: starredMsgs, lastMessage: starredMsgs[starredMsgs.length - 1].content };
        }
        return c;
    }).filter(Boolean) as Conversation[];

    let displayConvs = filteredConversations.filter(c => {
        if (filter === 'groups') return c.isGroup;
        return true;
    });

    // Local conversation search filter
    if (queryLower) {
        displayConvs = displayConvs.filter(c => {
            if (c.isGroup) {
                return c.groupName?.toLowerCase().includes(queryLower);
            }
            const userName = c.user?.name?.toLowerCase() || '';
            const userHandle = (c.user?.handle || '').toLowerCase();
            return userName.includes(queryLower) || userHandle.includes(queryLower);
        });
    }

    // DB users that are NOT already in displayed conversations
    const existingUserIds = new Set(conversations.filter(c => !c.isGroup && c.user).map(c => c.user!.id));
    const newDbUsers = dbUsers.filter(u => !existingUserIds.has(u.id));

    const handleStartDm = async (userId: string) => {
        try {
            const conv = await api.startDirectMessage(userId);
            if (conv && conv.id) {
                onSelectChat(conv.id);
            }
        } catch (e) {
            console.error('Failed to start DM:', e);
        }
    };

    return (
        <div className="flex flex-col h-full bg-background relative">
            {/* Header */}
            <div className="p-4 pt-6 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-muted overflow-hidden border border-border">
                        <img src={currentUser.avatar} alt="Me" className="w-full h-full object-cover" />
                    </div>
                    <div className="flex items-baseline gap-8">
                        <button
                            onClick={() => setFilter('all')}
                            className={`text-2xl font-bold transition-colors ${filter === 'all' ? 'text-primary underline decoration-primary underline-offset-8' : 'text-foreground hover:text-foreground/80'}`}
                        >
                            Chats
                        </button>
                        <button
                            onClick={() => setFilter('groups')}
                            className={`text-2xl font-bold transition-colors ${filter === 'groups' ? 'text-primary underline decoration-primary underline-offset-8' : 'text-foreground hover:text-foreground/80'}`}
                        >
                            Groups
                        </button>
                        <button
                            onClick={() => setFilter('starred')}
                            className={`text-2xl font-bold transition-colors ${filter === 'starred' ? 'text-primary underline decoration-primary underline-offset-8' : 'text-foreground hover:text-foreground/80'}`}
                        >
                            Starred
                        </button>
                    </div>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={onJoinGroup}
                        title="Join Group via ID"
                        className="w-10 h-10 rounded-full bg-muted text-foreground flex items-center justify-center hover:bg-muted/80 transition-colors"
                    >
                        <i className="fas fa-link"></i>
                    </button>
                    <button
                        onClick={onCreateGroup}
                        title="Create New Group"
                        className="w-10 h-10 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center justify-center hover:bg-primary/90 transition-transform active:scale-95"
                    >
                        <i className="fas fa-plus text-lg"></i>
                    </button>
                </div>
            </div>

            {/* Search */}
            <div className="px-4 pb-4">
                <div className="relative">
                    <input
                        type="text"
                        placeholder="Search users by name or @handle..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full bg-muted/50 text-foreground placeholder:text-muted-foreground px-5 py-3 rounded-2xl border-none focus:ring-1 focus:ring-primary/50 outline-none"
                    />
                    {searchQuery ? (
                        <button
                            onClick={() => { setSearchQuery(''); setDbUsers([]); }}
                            className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                        >
                            <i className="fas fa-times"></i>
                        </button>
                    ) : (
                        <i className="fas fa-search absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground"></i>
                    )}
                </div>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto px-2 space-y-1 pb-4">
                {/* Conversation results */}
                {displayConvs
                    .slice()
                    .sort((a, b) => (b.lastMessageTimestamp || 0) - (a.lastMessageTimestamp || 0))
                    .map(conv => {
                        const isGroup = conv.isGroup;
                        const name = isGroup ? conv.groupName : conv.user?.name;
                        const photo = isGroup ? conv.groupPhoto : conv.user?.avatar;

                        // Online Status Logic
                        const isOnline = !isGroup && conv.user?.isOnline;
                        const lastActive = !isGroup ? formatLastActive(conv.user?.lastSeenAt as any) : '';

                        return (
                            <div
                                key={conv.id}
                                onClick={() => onSelectChat(conv.id)}
                                className="flex items-center gap-4 p-3 rounded-2xl hover:bg-muted/30 cursor-pointer transition-colors group"
                            >
                                <div className="relative" onClick={(e) => {
                                    if (!isGroup && conv.user && onUserClick) {
                                        e.stopPropagation();
                                        onUserClick(conv.user.id);
                                    }
                                }}>
                                    <img src={photo} alt={name} className="w-14 h-14 rounded-full object-cover border-2 border-background shadow-sm" />
                                    {isOnline && <div className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-green-500 rounded-full border-2 border-background animate-pulse"></div>}
                                </div>

                                <div className="flex-1 min-w-0">
                                    <div className="flex justify-between items-baseline mb-1">
                                        <h3 className="font-bold text-base text-foreground truncate pr-2 flex items-center gap-2">
                                            {isGroup && <i className="fas fa-users text-xs text-muted-foreground"></i>}
                                            <span 
                                                className={!isGroup ? "cursor-pointer hover:underline" : ""} 
                                                onClick={(e) => {
                                                    if (!isGroup && conv.user && onUserClick) {
                                                        e.stopPropagation();
                                                        onUserClick(conv.user.id);
                                                    }
                                                }}
                                            >
                                                {name}
                                            </span>
                                        </h3>
                                        <span className={`text-[10px] font-medium ${conv.unreadCount && conv.unreadCount > 0 ? 'text-primary' : 'text-muted-foreground'}`}>
                                            {conv.lastMessageTime}
                                        </span>
                                    </div>
                                    <div className="flex justify-between items-center">
                                        <p className={`text-sm truncate pr-4 ${conv.unreadCount && conv.unreadCount > 0 ? 'font-bold text-foreground' : 'text-muted-foreground'}`}>
                                            {isGroup && conv.messages.length > 0 && !conv.messages[conv.messages.length - 1].isMe ?
                                                <span className="font-semibold text-foreground mr-1">{conv.messages[conv.messages.length - 1].senderName}:</span>
                                                : null}
                                            {conv.lastMessage?.startsWith('__PRODUCT_CARD__') ? '📦 Shared a product' : conv.lastMessage}
                                        </p>
                                        {conv.unreadCount && conv.unreadCount > 0 ? (
                                            <span className="bg-primary text-white text-[10px] font-bold px-2 py-0.5 rounded-full min-w-[20px] text-center">{conv.unreadCount}</span>
                                        ) : !isGroup && !isOnline && (
                                            <span className="text-[9px] text-muted-foreground opacity-60">{lastActive}</span>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )
                    })}

                {/* DB search results — users not in existing conversations */}
                {queryLower && newDbUsers.length > 0 && (
                    <>
                        <div className="px-3 pt-4 pb-1">
                            <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">People on Elddady</p>
                        </div>
                        {newDbUsers.map(user => (
                            <div
                                key={user.id}
                                onClick={() => handleStartDm(user.id)}
                                className="flex items-center gap-4 p-3 rounded-2xl hover:bg-muted/30 cursor-pointer transition-colors"
                            >
                                <div className="relative">
                                    <img src={user.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name)}&background=E86C44&color=fff`} alt={user.name} className="w-14 h-14 rounded-full object-cover border-2 border-background shadow-sm" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <h3 className="font-bold text-base text-foreground truncate">{user.name}</h3>
                                    <p className="text-sm text-muted-foreground truncate">{user.handle}</p>
                                </div>
                                <div className="text-[10px] text-primary font-bold uppercase tracking-widest flex items-center gap-1">
                                    <i className="fas fa-paper-plane text-[9px]"></i> Message
                                </div>
                            </div>
                        ))}
                    </>
                )}

                {/* Loading indicator */}
                {isSearching && (
                    <div className="flex justify-center py-4">
                        <i className="fas fa-circle-notch fa-spin text-primary"></i>
                    </div>
                )}

                {/* No results state */}
                {queryLower && displayConvs.length === 0 && newDbUsers.length === 0 && !isSearching && (
                    <div className="text-center py-10 text-muted-foreground">
                        <i className="fas fa-search text-2xl mb-3 opacity-40"></i>
                        <p className="font-bold text-sm">No users found for "{searchQuery}"</p>
                        <p className="text-xs mt-1">Try a different name or @handle</p>
                    </div>
                )}

                {!queryLower && filteredConversations.length === 0 && (
                    <div className="text-center py-10 text-muted-foreground">
                        <p>No {filter === 'groups' ? 'groups' : 'chats'} found.</p>
                    </div>
                )}
            </div>
        </div>
    );
};

const ChatDetail: React.FC<{
    chat: Conversation;
    onBack: () => void;
    onSendMessage: (content: string, replyToId?: string, image?: string) => void;
    onOpenGroupInfo: () => void;
    onReact: (messageId: string, emoji: string) => void;
    onNewMessageReceived: (msg: Message, eventType?: string) => void;
    currentUser: User;
    onUserClick?: (userId: string) => void;
    onMarkAsRead?: (conversationId: string) => void;
    onForward?: (msg: Message) => void;
    onInternalLink?: (path: string) => void;
    onProductClick?: (product: Product) => void;
    onAddToCart?: (product: Product) => void;
}> = ({ chat, onBack, onSendMessage, onOpenGroupInfo, onReact, onNewMessageReceived, currentUser, onUserClick, onMarkAsRead, onForward, onInternalLink, onProductClick, onAddToCart }) => {
    const [newMessage, setNewMessage] = useState('');
    const [replyTo, setReplyTo] = useState<Message | null>(null);
    const [showEmojiPicker, setShowEmojiPicker] = useState(false);
    const [activeReactionId, setActiveReactionId] = useState<string | null>(null);

    // Media Preview State
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);

    // Tagging / Mention State
    const [showMentions, setShowMentions] = useState(false);
    const [mentionQuery, setMentionQuery] = useState('');
    const [typingUsers, setTypingUsers] = useState<Map<string, { name: string; handle: string }>>(new Map());

    // Edit Message State
    const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
    const [editContent, setEditContent] = useState('');

    const messagesEndRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const channelRef = useRef<RealtimeChannel | null>(null);
    const presenceChannelRef = useRef<RealtimeChannel | null>(null);
    const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const isTypingRef = useRef(false);

    const handleTyping = (isTyping: boolean) => {
        if (typingTimeoutRef.current) {
            clearTimeout(typingTimeoutRef.current);
            typingTimeoutRef.current = null;
        }

        if (isTyping) {
            if (!isTypingRef.current) {
                isTypingRef.current = true;
                presenceChannelRef.current?.track({ user_id: currentUser.id, name: currentUser.name, handle: currentUser.handle, typing: true });
            }
            typingTimeoutRef.current = setTimeout(() => {
                isTypingRef.current = false;
                presenceChannelRef.current?.track({ user_id: currentUser.id, name: currentUser.name, handle: currentUser.handle, typing: false });
            }, 3000);
        } else {
            if (isTypingRef.current) {
                isTypingRef.current = false;
                presenceChannelRef.current?.track({ user_id: currentUser.id, name: currentUser.name, handle: currentUser.handle, typing: false });
            }
        }
    };

    const EMOJIS = ['😀', '😂', '😍', '🥺', '😭', '😡', '👍', '👎', '🎉', '🔥', '❤️', '💔', '🤝', '👋'];

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
        // Mark as read when entering
        api.markConversationAsRead(chat.id);
        if (chat.unreadCount && chat.unreadCount > 0) {
            onMarkAsRead && onMarkAsRead(chat.id);
        }
    }, [chat.id, chat.messages.length]);

    // Real-time subscription for messages in this specific chat
    useEffect(() => {
        if (!chat.id) return;

        // Subscribe
        channelRef.current = api.subscribeToMessages(chat.id, (msg, eventType) => {
            onNewMessageReceived(msg, eventType);
            // Also mark as read if user is viewing this chat
            api.markConversationAsRead(chat.id);
            onMarkAsRead && onMarkAsRead(chat.id);
            if (eventType !== 'UPDATE' && eventType !== 'DELETE') {
                scrollToBottom();
            }
        });

        // Presence for typing indicators
        const presenceChannel = supabase.channel(`typing:${chat.id}`);
        presenceChannelRef.current = presenceChannel;
        presenceChannel
            .on('presence', { event: 'sync' }, () => {
                const state = presenceChannel.presenceState();
                const newTyping = new Map<string, { name: string; handle: string }>();
                for (const key in state) {
                    const users = state[key] as any[];
                    for (const u of users) {
                        if (u.typing && u.user_id !== currentUser.id) {
                            newTyping.set(u.user_id, { name: u.name || 'Someone', handle: u.handle || '' });
                        }
                    }
                }
                setTypingUsers(newTyping);
            })
            .subscribe(async (status) => {
                if (status === 'SUBSCRIBED') {
                    await presenceChannel.track({ user_id: currentUser.id, name: currentUser.name, handle: currentUser.handle, typing: false });
                }
            });

        return () => {
            if (channelRef.current) channelRef.current.unsubscribe();
            presenceChannel.unsubscribe();
            presenceChannelRef.current = null;
            if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
            isTypingRef.current = false;
        };
    }, [chat.id]);

    const handleSend = () => {
        if (newMessage.trim() || previewUrl) {
            onSendMessage(newMessage.trim(), replyTo?.id, previewUrl || undefined);
            setNewMessage('');
            setReplyTo(null);
            setPreviewUrl(null);
            if (textareaRef.current) {
                textareaRef.current.style.height = 'auto';
            }
            handleTyping(false);
        }
    };

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            const reader = new FileReader();
            reader.onload = (ev) => {
                if (ev.target?.result) {
                    setPreviewUrl(ev.target.result as string);
                }
            };
            reader.readAsDataURL(file);
            e.target.value = '';
        }
    };


    const name = chat.isGroup ? chat.groupName : chat.user?.name;
    const photo = chat.isGroup ? chat.groupPhoto : chat.user?.avatar;
    const isOnline = !chat.isGroup && chat.user?.isOnline;
    const lastActive = !chat.isGroup ? formatLastActive(chat.user?.lastSeenAt as any) : '';

    return (
        <div className="flex flex-col h-full relative bg-white/90 backdrop-blur-sm">
            {/* Chat Header */}
            <div className="p-4 flex items-center justify-between border-b border-border/50">
                <div className="flex items-center gap-4 cursor-pointer" onClick={chat.isGroup ? onOpenGroupInfo : (!chat.isGroup && chat.user && onUserClick ? () => onUserClick(chat.user!.id) : undefined)}>
                    <button
                        onClick={(e) => { e.stopPropagation(); onBack(); }}
                        className="w-10 h-10 rounded-full hover:bg-muted flex items-center justify-center text-muted-foreground"
                    >
                        <i className="fas fa-arrow-left text-lg"></i>
                    </button>
                    <div className="relative">
                        <img src={photo} alt={name} className="w-12 h-12 rounded-full object-cover" />
                        {!chat.isGroup && isOnline && (
                            <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-background"></div>
                        )}
                    </div>
                    <div>
                        <h2 className="font-bold text-lg leading-tight flex items-center gap-2">
                            {name}
                            {chat.isGroup && <i className="fas fa-chevron-right text-xs text-muted-foreground"></i>}
                        </h2>
                        <p className="text-sm text-muted-foreground font-medium">
                            {chat.isGroup
                                ? `${chat.participants?.length || 0} members`
                                : (isOnline ? 'Active Now' : `Active ${lastActive}`)
                            }
                        </p>
                    </div>
                </div>
                {chat.isGroup && (
                    <button onClick={onOpenGroupInfo} className="w-10 h-10 rounded-full hover:bg-muted flex items-center justify-center text-primary font-bold shadow-sm border border-border" title="Group Info">
                        <i className="fas fa-info-circle text-lg"></i>
                    </button>
                )}
            </div>

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-6 no-scrollbar">
                {chat.messages.reduce((acc: any[], msg: Message, index: number, array: Message[]) => {
                    const currentHeader = formatDateHeader(msg.createdAt || new Date().toISOString());
                    const prevMsg = index > 0 ? array[index - 1] : null;
                    const prevHeader = prevMsg ? formatDateHeader(prevMsg.createdAt || new Date().toISOString()) : null;

                    if (currentHeader !== prevHeader) {
                        acc.push(
                            <div key={`header-${index}`} className="text-center my-4">
                                <span className="text-[11px] font-bold text-muted-foreground bg-muted/60 px-3 py-1 rounded-full uppercase tracking-wider shadow-sm">
                                    {currentHeader}
                                </span>
                            </div>
                        );
                    }

                    acc.push(
                        msg.isSystem ? (
                            <div key={msg.id} className="flex justify-center">
                                <div className="bg-muted/50 border border-border text-muted-foreground text-[11px] px-4 py-2 rounded-xl max-w-[85%] text-center whitespace-pre-wrap leading-relaxed">
                                    {renderMessageContent(msg.content, onInternalLink)}
                                </div>
                            </div>
                        ) : (
                            <div key={msg.id} id={`msg-${msg.id}`} className={`flex flex-col ${msg.isMe ? 'items-end' : 'items-start'} group relative ${msg.isDeleted ? 'opacity-60' : ''}`}>
                                {chat.isGroup && !msg.isMe && !msg.isDeleted && (
                                    <span
                                        className="text-[10px] text-muted-foreground ml-2 mb-1 font-semibold cursor-pointer hover:text-[#E86C44] hover:underline transition-colors"
                                        onClick={() => onUserClick && onUserClick(msg.senderId)}
                                    >{msg.senderName}</span>
                                )}

                                <div className={`max-w-[85%] relative ${msg.isMe ? 'flex flex-row-reverse' : 'flex flex-row'} items-end gap-2`}>
                                    {chat.isGroup && !msg.isMe && (
                                        <img
                                            src={msg.senderAvatar}
                                            className="w-6 h-6 rounded-full mb-1 cursor-pointer"
                                            onClick={() => onUserClick && onUserClick(msg.senderId)}
                                        />
                                    )}

                                    <div
                                        className={`relative rounded-2xl shadow-sm border text-sm leading-relaxed transition-all ${
                                            parseSharedProduct(msg.content)
                                                ? `p-1 ${msg.isMe ? 'bg-primary/10 border-primary/20 rounded-tr-sm' : 'bg-zinc-50 dark:bg-zinc-800/50 border-border/50 rounded-tl-sm'}`
                                                : `px-5 py-3 ${msg.isMe
                                                    ? 'bg-primary border-transparent text-primary-foreground rounded-tr-sm'
                                                    : 'bg-zinc-100 dark:bg-zinc-800 border-border text-foreground rounded-tl-sm'
                                                }`
                                        } ${msg.isDeleted ? 'italic' : ''}`}
                                        onDoubleClick={() => !msg.isDeleted && setActiveReactionId(msg.id)}
                                    >
                                        {/* Reply Quote Block */}
                                        {msg.replyTo && (
                                            <div
                                                className={`mb-2 p-2 rounded text-xs border-l-2 cursor-pointer transition-colors ${msg.isMe ? 'bg-black/10 border-white/50 hover:bg-black/20' : 'bg-black/5 border-primary/50 hover:bg-black/10'}`}
                                                onClick={() => document.getElementById(`msg-${msg.replyTo?.id}`)?.scrollIntoView({ behavior: 'smooth' })}
                                            >
                                                <div className="font-bold opacity-80">{msg.replyTo.senderName}</div>
                                                <div className="truncate opacity-70">{msg.replyTo.content}</div>
                                            </div>
                                        )}

                                        {/* Image Attachment */}
                                        {msg.image && (
                                            <div className="mb-2">
                                                <img src={msg.image} alt="Attachment" className="rounded-lg max-h-60 object-cover" />
                                            </div>
                                        )}

                                        {editingMessageId === msg.id ? (
                                            <div className="flex flex-col gap-2 min-w-[200px] mt-1">
                                                <textarea
                                                    autoFocus
                                                    className="text-black placeholder:text-zinc-500 p-2 text-sm rounded bg-white/90 resize-none w-full focus:outline-none focus:ring-1 focus:ring-primary"
                                                    value={editContent}
                                                    onChange={(e) => setEditContent(e.target.value)}
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Enter' && !e.shiftKey) {
                                                            e.preventDefault();
                                                            if (editContent.trim()) {
                                                                api.editMessage(msg.id, editContent);
                                                            }
                                                            setEditingMessageId(null);
                                                        }
                                                        if (e.key === 'Escape') setEditingMessageId(null);
                                                    }}
                                                />
                                                <div className="flex justify-end gap-2 text-[10px]">
                                                    <button onClick={() => setEditingMessageId(null)} className="text-white hover:underline transition-colors">Cancel</button>
                                                    <button onClick={() => { if (editContent.trim()) api.editMessage(msg.id, editContent); setEditingMessageId(null); }} className="bg-white/20 px-3 py-1 rounded font-bold text-white hover:bg-white/30 transition-colors">Save</button>
                                                </div>
                                            </div>
                                        ) : (() => {
                                            const sharedProduct = parseSharedProduct(msg.content);
                                            if (sharedProduct) {
                                                return (
                                                    <SharedProductCard
                                                        product={sharedProduct}
                                                        isMe={msg.isMe}
                                                        currentUser={currentUser}
                                                        onProductClick={onProductClick}
                                                        onAddToCart={onAddToCart}
                                                    />
                                                );
                                            }
                                            return msg.content ? <CollapsibleMessageText content={msg.content} isDeleted={msg.isDeleted} onInternalLink={onInternalLink} isMe={msg.isMe} /> : null;
                                        })()}
                                        <span className={`text-[10px] block text-right mt-1.5 opacity-70 flex items-center justify-end gap-1 ${msg.isMe ? 'text-primary-foreground' : 'text-muted-foreground'}`}>
                                            {msg.isEdited && !msg.isDeleted && <i className="fas fa-pen text-[8px] opacity-70" title="Edited"></i>}
                                            {msg.starredBy?.includes(currentUser.id) && !msg.isDeleted && <i className="fas fa-star text-yellow-400" title="Starred"></i>}
                                            {msg.timestamp}
                                            {msg.isMe && (!msg.status || msg.status === 'sent') && <i className="fas fa-check text-[10px] text-zinc-300 ml-1" title="Sent"></i>}
                                            {msg.isMe && msg.status === 'delivered' && <i className="fas fa-check-double text-[10px] text-zinc-300 ml-1" title="Delivered"></i>}
                                            {msg.isMe && msg.status === 'read' && <i className="fas fa-check-double text-[10px] text-green-400 ml-1 shadow-sm" title="Read"></i>}
                                        </span>

                                        {/* Reactions Display */}
                                        {msg.reactions && msg.reactions.length > 0 && (
                                            <div className={`absolute -bottom-3 ${msg.isMe ? 'right-2' : 'left-2'} flex gap-1 bg-card border border-border px-1.5 py-0.5 rounded-full shadow-sm`}>
                                                {msg.reactions.map(r => (
                                                    <span key={r.emoji} className="text-[10px] flex items-center gap-1">
                                                        {r.emoji} <span className="font-bold text-muted-foreground">{r.count}</span>
                                                    </span>
                                                ))}
                                            </div>
                                        )}

                                        {/* Quick Reaction Picker */}
                                        {activeReactionId === msg.id && (
                                            <div className={`absolute -top-10 ${msg.isMe ? 'right-0' : 'left-0'} flex gap-1 bg-card border border-border p-1.5 rounded-full shadow-xl z-10 animate-in fade-in zoom-in-90`}>
                                                {REACTION_EMOJIS.map(emoji => (
                                                    <button
                                                        key={emoji}
                                                        onClick={() => { onReact(msg.id, emoji); setActiveReactionId(null); }}
                                                        className="hover:scale-125 transition-transform p-0.5"
                                                    >
                                                        {emoji}
                                                    </button>
                                                ))}
                                                <button onClick={() => setActiveReactionId(null)} className="ml-1 text-muted-foreground"><i className="fas fa-times text-xs"></i></button>
                                            </div>
                                        )}
                                    </div>

                                    {/* Actions Button (Hover) */}
                                    {!msg.isDeleted && (
                                        <div className="opacity-0 group-hover:opacity-100 transition-opacity flex flex-col gap-1">
                                        <button onClick={() => setReplyTo(msg)} className="p-1 text-muted-foreground hover:text-primary transition-colors" title="Reply">
                                            <i className="fas fa-reply text-xs"></i>
                                        </button>
                                        <button onClick={() => setActiveReactionId(activeReactionId === msg.id ? null : msg.id)} className="p-1 text-muted-foreground hover:text-primary transition-colors" title="React">
                                            <i className="far fa-face-smile text-xs"></i>
                                        </button>
                                        <button onClick={() => api.toggleStarMessage(msg.id)} className="p-1 text-muted-foreground hover:text-yellow-500 transition-colors" title="Star">
                                            <i className={`${msg.starredBy?.includes(currentUser.id) ? 'fas text-yellow-500' : 'far'} fa-star text-xs`}></i>
                                        </button>
                                        {onForward && (
                                            <button onClick={() => onForward(msg)} className="p-1 text-muted-foreground hover:text-green-500 transition-colors" title="Forward">
                                                <i className="fas fa-share text-xs"></i>
                                            </button>
                                        )}
                                        {msg.isMe && (!msg.createdAt || Date.now() - new Date(msg.createdAt).getTime() < 180000) && (
                                            <button onClick={() => { setEditingMessageId(msg.id); setEditContent(msg.content); }} className="p-1 text-muted-foreground hover:text-secondary transition-colors" title="Edit">
                                                <i className="fas fa-pen text-xs"></i>
                                            </button>
                                        )}
                                        {msg.isMe && (
                                            <button onClick={() => { if (confirm("Delete message?")) api.deleteMessage(msg.id) }} className="p-1 text-muted-foreground hover:text-destructive transition-colors" title="Delete">
                                                <i className="far fa-trash-alt text-xs"></i>
                                            </button>
                                        )}
                                    </div>
                                    )}
                                </div>
                            </div>
                        )
                    );
                    return acc;
                }, [])}
                <div ref={messagesEndRef} />
            </div>

            {/* Reply Banner */}
            {replyTo && (
                <div className="bg-muted/30 border-t border-b border-border p-3 flex justify-between items-center backdrop-blur-sm">
                    <div className="flex-1 border-l-4 border-primary pl-3">
                        <div className="text-xs text-primary font-bold">Replying to {replyTo.senderName || 'User'}</div>
                        <div className="text-sm text-muted-foreground truncate">{replyTo.content || 'Photo'}</div>
                    </div>
                    <button onClick={() => setReplyTo(null)} className="p-2 text-muted-foreground hover:text-foreground">
                        <i className="fas fa-times"></i>
                    </button>
                </div>
            )}

            {/* Input Footer */}
            <div className="p-4 pb-6 relative">
                {showEmojiPicker && (
                    <div className="absolute bottom-24 left-4 bg-card border border-border rounded-xl shadow-xl p-3 grid grid-cols-7 gap-2 z-50 animate-in zoom-in-95 w-max">
                        {EMOJIS.map(emoji => (
                            <button
                                key={emoji}
                                onClick={() => { setNewMessage(prev => prev + emoji); setShowEmojiPicker(false); handleTyping(true); }}
                                className="text-2xl hover:bg-muted rounded p-1 transition-colors"
                            >
                                {emoji}
                            </button>
                        ))}
                    </div>
                )}

                <div className="flex items-end gap-3">
                    <button
                        onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                        className={`mb-2 transition-colors p-2 ${showEmojiPicker ? 'text-primary' : 'text-muted-foreground hover:text-primary'}`}
                    >
                        <i className="far fa-smile text-xl"></i>
                    </button>

                    <div className="flex-1 flex flex-col bg-zinc-700 rounded-3xl relative border border-transparent focus-within:border-primary/50 overflow-hidden">

                        {/* Mention Overlays */}
                        {showMentions && chat.isGroup && (
                            <div className="absolute bottom-full left-0 mb-2 w-64 bg-card border border-border shadow-xl rounded-xl z-50">
                                <div className="p-2 bg-muted/30 border-b border-border text-xs font-bold text-muted-foreground">Mentions</div>
                                <div className="max-h-48 overflow-y-auto">
                                    {chat.participants?.filter(p => !mentionQuery || (p.name && p.name.toLowerCase().includes(mentionQuery)) || (p.handle && p.handle.toLowerCase().includes(mentionQuery))).map(p => (
                                        <button
                                            key={p.id}
                                            className="w-full px-3 py-2 flex items-center gap-2 hover:bg-muted text-left"
                                            onClick={() => {
                                                const words = newMessage.split(' ');
                                                words.pop();
                                                const updatedMsg = words.join(' ') + (words.length > 0 ? ' ' : '') + `@${p.name.replace(/\s+/g, '')} `;
                                                setNewMessage(updatedMsg);
                                                setShowMentions(false);
                                                textareaRef.current?.focus();
                                                handleTyping(true);
                                            }}
                                        >
                                            <img src={p.avatar} className="w-6 h-6 rounded-full object-cover" />
                                            <span className="font-semibold text-sm">{p.name}</span>
                                            {p.handle && <span className="text-xs text-muted-foreground">@{p.handle}</span>}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Typing Indicator UI */}
                        {typingUsers.size > 0 && (
                            <div className="absolute -top-9 left-2 text-xs font-semibold flex items-center gap-1.5 z-10 bg-background/90 backdrop-blur-sm rounded-full px-3 py-1.5 pointer-events-none shadow-sm border border-border/40" style={{ animation: 'fadeSlideUp 0.25s ease-out' }}>
                                <span className="text-foreground/80 flex items-center flex-wrap">
                                    {Array.from(typingUsers.values()).map((u, i, arr) => (
                                        <span key={i}>
                                            <span className="text-primary font-bold">@{u.handle || u.name}</span>
                                            {arr.length > 1 && i < arr.length - 1 ? <span className="text-muted-foreground">,&nbsp;</span> : null}
                                        </span>
                                    ))}
                                    <span className="ml-1 text-muted-foreground">{typingUsers.size === 1 ? 'is typing' : 'are typing'}</span>
                                </span>
                                <span className="flex gap-[3px] ml-0.5 items-center">
                                    <span className="w-[5px] h-[5px] bg-primary rounded-full typing-wave-dot" style={{ animationDelay: '0s' }}></span>
                                    <span className="w-[5px] h-[5px] bg-primary rounded-full typing-wave-dot" style={{ animationDelay: '0.15s' }}></span>
                                    <span className="w-[5px] h-[5px] bg-primary rounded-full typing-wave-dot" style={{ animationDelay: '0.3s' }}></span>
                                    <span className="w-[5px] h-[5px] bg-primary rounded-full typing-wave-dot" style={{ animationDelay: '0.45s' }}></span>
                                </span>
                            </div>
                        )}

                        {previewUrl && (
                            <div className="relative p-2 flex items-start justify-start w-fit mt-1 ml-2">
                                <img src={previewUrl} className="h-20 w-auto rounded-lg object-contain bg-black/20" />
                                <button className="absolute -top-1 -right-1 bg-destructive text-white rounded-full w-5 h-5 flex items-center justify-center text-[10px]" onClick={() => setPreviewUrl(null)}>x</button>
                            </div>
                        )}

                        <div className="flex items-end w-full relative">
                            <textarea
                                ref={textareaRef}
                                value={newMessage}
                                onChange={(e) => {
                                    const val = e.target.value;
                                    setNewMessage(val);
                                    if (textareaRef.current) {
                                        textareaRef.current.style.height = 'auto';
                                        textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 140) + 'px';
                                    }

                                    const lastWord = val.split(' ').pop() || '';
                                    if (lastWord.startsWith('@')) {
                                        setShowMentions(true);
                                        setMentionQuery(lastWord.slice(1).toLowerCase());
                                    } else {
                                        setShowMentions(false);
                                    }

                                    handleTyping(val.length > 0);
                                }}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' && !e.shiftKey) {
                                        e.preventDefault();
                                        handleSend();
                                    }
                                }}
                                placeholder={replyTo ? "Type your reply..." : "Type a message..."}
                                rows={1}
                                className="w-full bg-transparent text-white placeholder:text-zinc-400 px-4 py-3 pr-10 resize-none overflow-y-auto min-h-[40px] focus:outline-none"
                            />

                            <button
                                onClick={() => fileInputRef.current?.click()}
                                className="absolute right-3 bottom-3 text-muted-foreground hover:text-foreground"
                            >
                                <i className="fas fa-paperclip text-lg"></i>
                            </button>
                        </div>

                        <input
                            type="file"
                            ref={fileInputRef}
                            className="hidden"
                            accept="image/*"
                            onChange={handleFileSelect}
                        />
                    </div>

                    <button
                        onClick={handleSend}
                        disabled={!newMessage.trim() && !previewUrl}
                        className="mb-1 w-12 h-12 rounded-full bg-primary text-primary-foreground flex items-center justify-center hover:bg-primary/90 transition-transform active:scale-95 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <i className="fas fa-paper-plane text-lg"></i>
                    </button>
                </div>
            </div>
        </div>
    );
};

// --- Modals ---

const CreateGroupModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (name: string, photo: string, members: string[]) => void;
    currentUser: User;
}> = ({ isOpen, onClose, onSubmit, currentUser }) => {
    const [groupName, setGroupName] = useState('');
    const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
    const [users, setUsers] = useState<User[]>([]);
    const [filterName, setFilterName] = useState('');

    useEffect(() => {
        if (isOpen) api.getAllUsers().then(setUsers);
    }, [isOpen]);

    if (!isOpen) return null;

    const toggleUser = (id: string) => {
        setSelectedUsers(prev => prev.includes(id) ? prev.filter(u => u !== id) : [...prev, id]);
    };

    const handleSubmit = () => {
        if (!groupName) return alert("Group name is required");
        onSubmit(groupName, '', selectedUsers);
        onClose();
        setGroupName('');
        setSelectedUsers([]);
    };

    const filteredUsers = users.filter(u => u.name.toLowerCase().includes(filterName.toLowerCase()) && u.id !== currentUser.id);

    return (
        <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4">
            <div className="bg-card w-full max-w-md rounded-xl p-6 animate-in zoom-in-95">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-xl font-bold">New Group</h3>
                    <button onClick={onClose}><i className="fas fa-times"></i></button>
                </div>

                <div className="space-y-4">
                    <div className="flex justify-center mb-4">
                        <div className="w-20 h-20 bg-muted rounded-full flex items-center justify-center text-muted-foreground border border-dashed border-border">
                            <i className="fas fa-camera text-2xl"></i>
                        </div>
                    </div>

                    <input
                        type="text"
                        placeholder="Group Name"
                        value={groupName}
                        onChange={(e) => setGroupName(e.target.value)}
                        className="w-full px-4 py-2 rounded-lg bg-background border border-input focus:ring-1 focus:ring-primary outline-none"
                    />

                    <div className="max-h-60 border border-border rounded-lg p-2 space-y-2 flex flex-col">
                        <input
                            type="text"
                            placeholder="Search people..."
                            value={filterName}
                            onChange={(e) => setFilterName(e.target.value)}
                            className="w-full px-3 py-1.5 mb-2 rounded bg-muted/50 border-none text-xs focus:ring-0"
                        />
                        <p className="text-xs text-muted-foreground font-bold px-2">MEMBERS ({selectedUsers.length})</p>
                        <div className="overflow-y-auto flex-1 space-y-1">
                            {filteredUsers.map(user => (
                                <div key={user.id} onClick={() => toggleUser(user.id)} className="flex items-center gap-3 p-2 hover:bg-muted rounded-lg cursor-pointer">
                                    <div className={`w-5 h-5 rounded border flex items-center justify-center ${selectedUsers.includes(user.id) ? 'bg-primary border-primary' : 'border-muted-foreground'}`}>
                                        {selectedUsers.includes(user.id) && <i className="fas fa-check text-white text-xs"></i>}
                                    </div>
                                    <img src={user.avatar} className="w-8 h-8 rounded-full object-cover" alt={user.name} />
                                    <span className="text-sm font-medium">{user.name}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    <button
                        onClick={handleSubmit}
                        className="w-full bg-primary text-primary-foreground py-2 rounded-lg font-bold hover:bg-primary/90"
                    >
                        Create Group
                    </button>
                </div>
            </div>
        </div>
    );
};

const GroupInfoModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    group: Conversation;
    onAddMember: (userId: string) => void;
    onRemoveMember: (userId: string) => void;
    onMakeAdmin: (userId: string) => void;
    onRemoveAdmin: (userId: string) => void;
    onLeaveGroup: () => void;
    onUpdatePhoto: (file: File) => Promise<void>;
    onUpdateInfo: (name: string, description: string) => Promise<void>;
    currentUser: User;
    onUserClick?: (userId: string) => void;
}> = ({ isOpen, onClose, group, onAddMember, onRemoveMember, onLeaveGroup, currentUser, onUserClick, onMakeAdmin, onRemoveAdmin, onUpdatePhoto, onUpdateInfo }) => {
    const [isAddMode, setIsAddMode] = useState(false);
    const [availableUsers, setAvailableUsers] = useState<User[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [isEditingInfo, setIsEditingInfo] = useState(false);
    const [editName, setEditName] = useState(group.groupName || '');
    const [editDesc, setEditDesc] = useState(group.groupDescription || '');
    const photoInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        setEditName(group.groupName || '');
        setEditDesc(group.groupDescription || '');
    }, [group.groupName, group.groupDescription]);

    useEffect(() => {
        if (isOpen && isAddMode) {
            api.getAllUsers().then(users => {
                const participants = new Set(group.participants?.map(p => p.id));
                setAvailableUsers(users.filter(u => !participants.has(u.id)));
            });
        }
    }, [isOpen, isAddMode, group]);

    if (!isOpen) return null;

    const isOwner = group.ownerId === currentUser.id;
    const myParticipant = group.participants?.find((p: any) => p.id === currentUser.id);
    const isAdmin = isOwner || myParticipant?.isAdmin;
    const filteredAvailable = availableUsers.filter(u => u.name.toLowerCase().includes(searchTerm.toLowerCase()));

    return (
        <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4">
            <div className="bg-card w-full max-w-md rounded-xl p-6 animate-in zoom-in-95 max-h-[90vh] overflow-y-auto">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-xl font-bold">Group Info</h3>
                    <button onClick={onClose}><i className="fas fa-times"></i></button>
                </div>

                <div className="text-center mb-6">
                    {/* Photo wrapper – fixed size so the absolute overlay sits exactly on the image */}
                    <div className="relative w-24 h-24 rounded-full mx-auto mb-3 overflow-hidden border-4 border-background shadow-lg">
                        <img src={previewUrl || group.groupPhoto} className="w-full h-full object-cover" alt={group.groupName} />
                        {isAdmin && (
                            <>
                                <button
                                    onClick={() => photoInputRef.current?.click()}
                                    disabled={isUploadingPhoto}
                                    className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity cursor-pointer"
                                    title="Change group photo"
                                >
                                    {isUploadingPhoto
                                        ? <i className="fas fa-circle-notch fa-spin text-white text-xl"></i>
                                        : <i className="fas fa-camera text-white text-xl"></i>}
                                </button>
                                <input
                                    type="file"
                                    ref={photoInputRef}
                                    className="hidden"
                                    accept="image/*"
                                    onChange={async (e) => {
                                        if (!e.target.files?.[0]) return;
                                        const file = e.target.files[0];
                                        // Instant local preview
                                        const localUrl = URL.createObjectURL(file);
                                        setPreviewUrl(localUrl);
                                        setIsUploadingPhoto(true);
                                        try {
                                            await onUpdatePhoto(file);
                                        } catch (err: any) {
                                            setPreviewUrl(null); // revert preview on failure
                                            alert(err.message || 'Failed to update photo');
                                        } finally {
                                            setIsUploadingPhoto(false);
                                            e.target.value = '';
                                        }
                                    }}
                                />
                            </>
                        )}
                    </div>

                    {isEditingInfo && isAdmin ? (
                        <div className="flex flex-col gap-2 mb-2 items-center w-full">
                            <input
                                type="text"
                                value={editName}
                                onChange={e => setEditName(e.target.value)}
                                placeholder="Group Name"
                                className="w-full text-center text-lg font-bold bg-muted/50 border border-border rounded p-1"
                            />
                            <textarea
                                value={editDesc}
                                onChange={e => setEditDesc(e.target.value)}
                                placeholder="Add a group description..."
                                className="w-full text-center text-sm bg-muted/50 border border-border rounded p-1 resize-none"
                                rows={2}
                            />
                            <div className="flex gap-2">
                                <button onClick={() => setIsEditingInfo(false)} className="text-xs px-3 py-1 bg-muted rounded">Cancel</button>
                                <button onClick={async () => {
                                    try {
                                        await onUpdateInfo(editName, editDesc);
                                        setIsEditingInfo(false);
                                    } catch (e: any) {
                                        alert(e.message || 'Failed to update info');
                                    }
                                }} className="text-xs px-3 py-1 bg-primary text-white font-bold rounded">Save</button>
                            </div>
                        </div>
                    ) : (
                        <div className="flex flex-col items-center">
                            <div className="flex items-center gap-2">
                                <h2 className="text-2xl font-bold">{group.groupName}</h2>
                                {isAdmin && <button onClick={() => setIsEditingInfo(true)} className="text-muted-foreground hover:text-foreground text-sm"><i className="fas fa-edit"></i></button>}
                            </div>
                            {group.groupDescription && <p className="text-sm text-muted-foreground mt-1 px-4">{group.groupDescription}</p>}
                            {!group.groupDescription && isAdmin && (
                                <p className="text-xs text-primary cursor-pointer hover:underline mt-1" onClick={() => setIsEditingInfo(true)}>+ Add Description</p>
                            )}
                        </div>
                    )}

                    <p className="text-muted-foreground text-sm mt-2">{group.participants?.length} members</p>
                    <div className="mt-2 space-y-2">
                        <div className="text-xs bg-muted py-1 px-3 rounded-full inline-block select-all">
                            ID: <span className="font-mono">{group.id}</span>
                        </div>
                        <div>
                            <button
                                onClick={() => {
                                    const link = `${APP_URL}/messages?group=${group.id}`;
                                    navigator.clipboard.writeText(link).then(() => alert('Invite link copied!')).catch(() => prompt('Copy this link:', link));
                                }}
                                className="flex items-center gap-2 text-xs text-primary font-bold hover:underline"
                            >
                                <i className="fas fa-link"></i> Copy Invite Link
                            </button>
                        </div>
                    </div>
                </div>

                <div className="space-y-4">
                    <div className="flex justify-between items-center">
                        <h4 className="font-bold text-sm text-muted-foreground">PARTICIPANTS</h4>
                        {isAdmin && (
                            <button onClick={() => setIsAddMode(!isAddMode)} className="text-primary text-xs font-bold hover:underline">
                                {isAddMode ? 'CANCEL' : 'ADD PARTICIPANT'}
                            </button>
                        )}
                    </div>

                    {isAddMode && (
                        <div className="bg-muted/30 p-2 rounded-lg mb-2 space-y-2">
                            <input
                                type="text"
                                placeholder="Search user..."
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                                className="w-full text-xs p-2 rounded border border-border"
                            />
                            <div className="max-h-32 overflow-y-auto">
                                {filteredAvailable.length === 0 ? <p className="text-xs text-center p-2 text-muted-foreground">No users found</p> :
                                    filteredAvailable.map(u => (
                                        <div key={u.id} className="flex justify-between items-center p-2 hover:bg-muted rounded-lg">
                                            <div className="flex items-center gap-2">
                                                <img src={u.avatar} className="w-6 h-6 rounded-full object-cover" alt={u.name} />
                                                <span className="text-sm">{u.name}</span>
                                            </div>
                                            <button onClick={() => { onAddMember(u.id); setIsAddMode(false); }} className="text-primary text-xs font-bold hover:bg-primary/10 p-1 rounded"><i className="fas fa-plus"></i> ADD</button>
                                        </div>
                                    ))}
                            </div>
                        </div>
                    )}

                    <div className="space-y-2 max-h-60 overflow-y-auto">
                        {group.participants?.map(p => (
                            <div key={p.id} className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/50">
                                <div className="flex items-center gap-3 cursor-pointer" onClick={() => onUserClick && onUserClick(p.id)}>
                                    <img src={p.avatar} alt={p.name} className="w-10 h-10 rounded-full object-cover" />
                                    <div>
                                        <div className="font-medium text-sm flex items-center">
                                            {p.name} {p.id === currentUser.id && ' (You)'}
                                            {p.id === group.ownerId ? <span className="text-[10px] text-primary font-bold ml-2 bg-primary/10 px-1.5 py-0.5 rounded uppercase">Owner</span> :
                                                (p as any).isAdmin ? <span className="text-[10px] text-green-500 font-bold ml-2 bg-green-500/10 px-1.5 py-0.5 rounded uppercase">Admin</span> : null}
                                        </div>
                                    </div>
                                </div>
                                {isAdmin && p.id !== currentUser.id && (
                                    <div className="flex items-center gap-1">
                                        {!(p as any).isAdmin ? (
                                            <button onClick={() => onMakeAdmin(p.id)} className="text-[10px] text-primary font-bold hover:bg-primary/10 px-2 py-1 rounded transition-colors uppercase">Make Admin</button>
                                        ) : p.id !== group.ownerId ? (
                                            <button onClick={() => onRemoveAdmin(p.id)} className="text-[10px] text-muted-foreground font-bold hover:bg-muted px-2 py-1 rounded transition-colors uppercase">Revoke Admin</button>
                                        ) : null}
                                        <button onClick={() => onRemoveMember(p.id)} className="text-destructive hover:bg-destructive/10 p-2 rounded transition-colors" title="Remove">
                                            <i className="fas fa-trash-alt"></i>
                                        </button>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>

                    <div className="pt-6 border-t border-border">
                        <button
                            onClick={onLeaveGroup}
                            className="w-full py-3 text-destructive font-bold bg-destructive/10 rounded-lg hover:bg-destructive/20 transition-colors"
                        >
                            <i className="fas fa-sign-out-alt mr-2"></i> Leave Group
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

const JoinGroupModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    onJoin: (id: string) => void;
}> = ({ isOpen, onClose, onJoin }) => {
    const [input, setInput] = useState('');
    if (!isOpen) return null;

    const handleJoin = () => {
        // Accept both raw group IDs and shareable URLs (e.g. ?group=<id>)
        let id = input.trim();
        try {
            const url = new URL(id);
            const param = url.searchParams.get('group');
            if (param) id = param;
        } catch { /* not a URL, use as-is */ }
        if (!id) return alert('Please enter a Group ID or invite link.');
        onJoin(id);
        onClose();
    };

    return (
        <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4">
            <div className="bg-card w-full max-w-sm rounded-xl p-6 animate-in zoom-in-95">
                <h3 className="text-lg font-bold mb-2">Join Group</h3>
                <p className="text-xs text-muted-foreground mb-4">Paste a Group ID or a shareable invite link.</p>
                <input
                    type="text"
                    placeholder="Group ID or invite link..."
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleJoin()}
                    className="w-full px-4 py-2 border border-input rounded-lg mb-4 bg-background focus:outline-none focus:ring-1 focus:ring-primary"
                />
                <div className="flex gap-2">
                    <button onClick={onClose} className="flex-1 py-2 border border-border rounded-lg hover:bg-muted">Cancel</button>
                    <button onClick={handleJoin} className="flex-1 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90">Join</button>
                </div>
            </div>
        </div>
    );
}

const ForwardMessageModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    message: Message | null;
    conversations: Conversation[];
    onForward: (targetConversationId: string) => void;
}> = ({ isOpen, onClose, message, conversations, onForward }) => {
    if (!isOpen || !message) return null;

    return (
        <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4">
            <div className="bg-card w-full max-w-sm rounded-xl p-6 animate-in zoom-in-95 flex flex-col max-h-[80vh]">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-bold">Forward Message</h3>
                    <button onClick={onClose} className="rounded-full w-8 h-8 hover:bg-muted flex items-center justify-center"><i className="fas fa-times"></i></button>
                </div>

                <div className="p-3 bg-muted rounded-lg border border-border text-sm mb-4 truncate text-muted-foreground italic flex flex-col gap-2">
                    {message.image && <img src={message.image} className="w-16 h-16 object-cover rounded-md" />}
                    {(() => {
                        const sp = parseSharedProduct(message.content);
                        if (sp) return <span className="flex items-center gap-2 not-italic"><i className="fas fa-shopping-bag text-[#E86C44]" /> <span className="font-bold text-foreground">{sp.name}</span></span>;
                        return message.content || 'Photo';
                    })()}
                </div>

                <p className="text-xs text-muted-foreground font-bold mb-2 uppercase tracking-wider">Recent Chats</p>
                <div className="flex-1 overflow-y-auto space-y-1 mb-4 border border-border border-dashed rounded-lg p-2 no-scrollbar">
                    {conversations.length === 0 && <div className="text-center text-xs text-muted-foreground p-4">No recent chats</div>}
                    {conversations.map(c => (
                        <button
                            key={c.id}
                            className="w-full flex items-center gap-3 p-2 hover:bg-muted rounded-lg transition-colors text-left"
                            onClick={() => onForward(c.id)}
                        >
                            <img src={c.isGroup ? c.groupPhoto : c.user?.avatar} className="w-8 h-8 rounded-full border border-background shadow-sm object-cover" />
                            <span className="font-semibold text-sm truncate flex-1">{c.isGroup ? c.groupName : c.user?.name}</span>
                            <i className="fas fa-share text-xs text-muted-foreground opacity-50"></i>
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
};

// --- Main Component ---

const Messages: React.FC<MessagesProps> = ({ conversations: initialConversations, onSendMessage, currentUser, onUserClick, onMarkAsRead, onForward, onInternalLink, onProductClick, onAddToCart }) => {
    const [activeChatId, setActiveChatId] = useState<string | null>(null);
    const [conversations, setConversations] = useState(initialConversations);
    const [forwardMessage, setForwardMessage] = useState<Message | null>(null);

    // Modal States
    const [isCreateGroupOpen, setIsCreateGroupOpen] = useState(false);
    const [isGroupInfoOpen, setIsGroupInfoOpen] = useState(false);
    const [isJoinGroupOpen, setIsJoinGroupOpen] = useState(false);

    const handleSelectChat = (id: string) => {
        setActiveChatId(id);
        const conv = conversations.find(c => c.id === id);
        if (conv && conv.unreadCount && conv.unreadCount > 0) {
            setConversations(prev => prev.map(c => c.id === id ? { ...c, unreadCount: 0 } : c));
            if (onMarkAsRead) onMarkAsRead(id);
        }
    };

    // Sync props state
    useEffect(() => {
        setConversations(initialConversations);
    }, [initialConversations]);

    // Deep-link: Auto-join if URL contains ?group=<id>
    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const groupId = params.get('group');
        if (groupId) {
            handleJoinGroup(groupId);
            // Clean the URL so it doesn't re-trigger on re-renders
            const cleanUrl = window.location.pathname;
            window.history.replaceState({}, '', cleanUrl);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Presence Subscription (Listen for Online Status Changes)
    useEffect(() => {
        const channel = supabase.channel('online-users')
            .on(
                'postgres_changes',
                { event: 'UPDATE', schema: 'public', table: 'profiles' },
                (payload) => {
                    const updatedProfile = payload.new;
                    setConversations(prev => prev.map(c => {
                        // Update for DM partner
                        if (!c.isGroup && c.user?.id === updatedProfile.id) {
                            return {
                                ...c,
                                user: {
                                    ...c.user,
                                    isOnline: (Date.now() - new Date(updatedProfile.last_seen_at).getTime()) < 120000,
                                    lastSeenAt: updatedProfile.last_seen_at
                                } as any
                            };
                        }
                        return c;
                    }));
                }
            )
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, []);

    // Global Conversation Listener: Syncs the list when any conversation updates (e.g. new message)
    useEffect(() => {
        let timeoutId: any;
        const fetchConvs = () => {
            clearTimeout(timeoutId);
            timeoutId = setTimeout(async () => {
                try {
                    const latestConvs = await api.getConversations();
                    setConversations(latestConvs);
                } catch (e) {
                    console.error("Failed to sync conversations list", e);
                }
            }, 800); // Debounce to allow DB transactions to fully settle
        };

        const channel = supabase.channel('conversation-updates')
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'conversations' },
                fetchConvs
            )
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'conversation_participants' },
                fetchConvs
            )
            .subscribe();

        return () => {
            clearTimeout(timeoutId);
            supabase.removeChannel(channel);
        };
    }, []);

    const activeChat = conversations.find(c => c.id === activeChatId);

    const handleNewMessageReceived = (msg: Message, eventType?: string) => {
        if (!msg || !msg.id) return;
        setConversations(prev => prev.map(c => {
            if (c.id === activeChatId) {
                if (eventType === 'DELETE') {
                    return {
                        ...c,
                        messages: c.messages.filter(m => m.id !== msg.id)
                    };
                }
                if (eventType === 'UPDATE') {
                    return {
                        ...c,
                        messages: c.messages.map(m => m.id === msg.id ? { ...m, ...msg, reactions: m.reactions } : m)
                    };
                }
                const exists = c.messages.some(m => m.id === msg.id || (m.isMe && m.id.startsWith('temp-') && m.content === msg.content));
                if (exists) {
                    return {
                        ...c,
                        messages: c.messages.map(m => ((m.id === msg.id) || (m.isMe && m.id.startsWith('temp-') && m.content === msg.content)) ? msg : m)
                    };
                }
                return { ...c, messages: [...c.messages, msg], lastMessage: msg.content, lastMessageTime: msg.timestamp };
            }
            return c;
        }));
    };

    const handleReact = async (messageId: string, emoji: string) => {
        // Placeholder: Reactions would need a DB table update
        // Currently UI only
        if (!activeChatId) return;

        // Optimistic Update
        setConversations(prev => prev.map(c => {
            if (c.id === activeChatId) {
                const newMessages = c.messages.map(m => {
                    if (m.id === messageId) {
                        const currentReactions = m.reactions || [];
                        const existingIdx = currentReactions.findIndex(r => r.emoji === emoji);

                        let updatedReactions: Reaction[] = [...currentReactions];
                        if (existingIdx > -1) {
                            const reaction = updatedReactions[existingIdx];
                            if (reaction.userIds.includes(currentUser.id)) {
                                // Remove reaction
                                const newUserIds = reaction.userIds.filter(id => id !== currentUser.id);
                                if (newUserIds.length === 0) {
                                    updatedReactions = updatedReactions.filter(r => r.emoji !== emoji);
                                } else {
                                    updatedReactions[existingIdx] = { ...reaction, userIds: newUserIds, count: newUserIds.length };
                                }
                            } else {
                                // Add to existing
                                updatedReactions[existingIdx] = {
                                    ...reaction,
                                    userIds: [...reaction.userIds, currentUser.id],
                                    count: reaction.count + 1
                                };
                            }
                        } else {
                            // New reaction
                            updatedReactions.push({ emoji, count: 1, userIds: [currentUser.id] });
                        }
                        return { ...m, reactions: updatedReactions };
                    }
                    return m;
                });
                return { ...c, messages: newMessages };
            }
            return c;
        }));
        
        // Push reaction to DB
        api.reactToMessage(messageId, emoji).catch(console.error);
    };

    const handleCreateGroup = async (name: string, photo: string, members: string[]) => {
        try {
            const newGroup = await api.createGroup(name, photo, members);
            setConversations(prev => [newGroup, ...prev]);
            setIsCreateGroupOpen(false);
            setActiveChatId(newGroup.id);
        } catch (e: any) {
            console.error('createGroup error:', e);
            alert(`Failed to create group: ${e?.message || e?.details || JSON.stringify(e)}`);
        }
    };

    const handleJoinGroup = async (id: string) => {
        try {
            const joinedGroup = await api.joinGroup(id);
            if (joinedGroup && joinedGroup.id) {
                setConversations(prev => [joinedGroup, ...prev]);
                setActiveChatId(joinedGroup.id);
            }
            setIsJoinGroupOpen(false);
        } catch (e: any) {
            console.error('joinGroup error:', e);
            alert(`Failed to join group: ${e?.message || e?.details || 'ID might be invalid.'}`);
        }
    };

    const handleLeaveGroup = async () => {
        if (!activeChatId) return;
        if (confirm("Are you sure you want to leave this group?")) {
            try {
                await api.leaveGroup(activeChatId);
                setConversations(prev => prev.filter(c => c.id !== activeChatId));
                setActiveChatId(null);
                setIsGroupInfoOpen(false);
            } catch (e) {
                alert("Failed to leave group");
            }
        }
    };

    const handleAddMember = async (userId: string) => {
        if (!activeChat) return;
        try {
            await api.addGroupMember(activeChat.id, userId);
            // Refresh list to update participants
            const updated = await api.getConversations();
            setConversations(updated);
        } catch (e) {
            alert("Failed to add member");
        }
    };

    const handleRemoveMember = async (userId: string) => {
        if (!activeChat) return;
        if (!confirm("Remove user from group?")) return;
        try {
            await api.removeGroupMember(activeChat.id, userId);
            // Refresh list
            const updated = await api.getConversations();
            setConversations(updated);
        } catch (e) {
            alert("Failed to remove member");
        }
    };

    const handleMakeAdmin = async (userId: string) => {
        if (!activeChat) return;
        try {
            await api.makeGroupAdmin(activeChat.id, userId);
            const updated = await api.getConversations();
            setConversations(updated);
        } catch (e) {
            alert("Failed to make admin");
        }
    };

    const handleRemoveAdmin = async (userId: string) => {
        if (!activeChat) return;
        try {
            await api.removeGroupAdmin(activeChat.id, userId);
            const updated = await api.getConversations();
            setConversations(updated);
        } catch (e) {
            alert("Failed to remove admin");
        }
    };

    const handleUpdateGroupPhoto = async (file: File) => {
        if (!activeChat) return;
        try {
            const newPhotoUrl = await api.updateGroupPhoto(activeChat.id, file);
            setConversations(prev => prev.map(c =>
                c.id === activeChat.id ? { ...c, groupPhoto: newPhotoUrl } : c
            ));
        } catch (e: any) {
            alert(e.message || 'Failed to update group photo');
        }
    };

    const handleUpdateGroupInfo = async (name: string, description: string) => {
        if (!activeChat) return;
        try {
            await api.updateGroupInfo(activeChat.id, name, description);
            setConversations(prev => prev.map(c =>
                c.id === activeChat.id ? { ...c, groupName: name, groupDescription: description } : c
            ));
        } catch (e: any) {
            throw e; // Modal catches this
        }
    };

    return (
        <div className="h-screen w-full overflow-hidden bg-background">
            <CreateGroupModal
                isOpen={isCreateGroupOpen}
                onClose={() => setIsCreateGroupOpen(false)}
                onSubmit={handleCreateGroup}
                currentUser={currentUser}
            />
            <JoinGroupModal
                isOpen={isJoinGroupOpen}
                onClose={() => setIsJoinGroupOpen(false)}
                onJoin={handleJoinGroup}
            />
            <ForwardMessageModal
                isOpen={!!forwardMessage}
                onClose={() => setForwardMessage(null)}
                message={forwardMessage}
                conversations={conversations}
                onForward={async (targetId) => {
                    if (forwardMessage) {
                        try {
                            await api.sendMessage(targetId, forwardMessage.content, undefined, forwardMessage.image);
                        } catch (e: any) {
                            console.error("Failed to forward:", e);
                        }
                        setForwardMessage(null);
                        setActiveChatId(targetId);
                    }
                }}
            />
            {activeChat && activeChat.isGroup && (
                <GroupInfoModal
                    isOpen={isGroupInfoOpen}
                    onClose={() => setIsGroupInfoOpen(false)}
                    group={activeChat}
                    onAddMember={handleAddMember}
                    onRemoveMember={handleRemoveMember}
                    onLeaveGroup={handleLeaveGroup}
                    currentUser={currentUser}
                    onUserClick={onUserClick}
                    onMakeAdmin={handleMakeAdmin}
                    onRemoveAdmin={handleRemoveAdmin}
                    onUpdatePhoto={handleUpdateGroupPhoto}
                    onUpdateInfo={handleUpdateGroupInfo}
                />
            )}

            {activeChatId ? (
                <ChatDetail
                    chat={conversations.find(c => c.id === activeChatId)!}
                    onBack={() => setActiveChatId(null)}
                    onSendMessage={(content, replyToId, image) => {
                        // OPTIMISTIC UPDATE
                        const newMsg: Message = {
                            id: 'temp-' + Date.now().toString(),
                            senderId: currentUser.id,
                            senderName: currentUser.name,
                            senderAvatar: currentUser.avatar,
                            content,
                            image,
                            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                            createdAt: new Date().toISOString(),
                            isMe: true
                        };
                        setConversations(prev => prev.map(c =>
                            c.id === activeChatId
                                ? { ...c, messages: [...c.messages, newMsg], lastMessage: content || 'Image', lastMessageTime: newMsg.timestamp }
                                : c
                        ));
                        onSendMessage?.(activeChatId, content, replyToId, image);
                    }}
                    onOpenGroupInfo={() => setIsGroupInfoOpen(true)}
                    onReact={handleReact}
                    onNewMessageReceived={handleNewMessageReceived}
                    currentUser={currentUser}
                    onUserClick={onUserClick}
                    onMarkAsRead={onMarkAsRead}
                    onForward={onForward ? onForward : setForwardMessage}
                    onInternalLink={onInternalLink}
                    onProductClick={onProductClick}
                    onAddToCart={onAddToCart}
                />
            ) : (
                <ChatList
                    conversations={conversations}
                    onSelectChat={handleSelectChat}
                    onCreateGroup={() => setIsCreateGroupOpen(true)}
                    onJoinGroup={() => setIsJoinGroupOpen(true)}
                    currentUser={currentUser}
                    onUserClick={onUserClick}
                />
            )}
        </div>
    );
};

export default Messages;
