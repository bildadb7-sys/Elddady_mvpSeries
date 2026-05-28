
import React, { useState, useEffect } from 'react';
import { Vroom as VroomType, Product } from '../types';
import { CURRENT_USER } from '../constants';
import { APP_URL } from '../constants';
import { api } from '../api';
import { supabase } from '../supabaseClient';

interface VroomProps {
    vroom: VroomType;
    onAddToCart: (product: Product) => void;
    onProductClick: (product: Product) => void;
    onShare: (product: Product) => void;
    onUserClick?: (userId: string) => void;
}

const Vroom: React.FC<VroomProps> = ({ vroom, onAddToCart, onProductClick, onShare, onUserClick }) => {
    // Local state to handle updates (mocking persistence)
    const [currentVroom, setCurrentVroom] = useState(vroom);

    // Dropdown & Modal state
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);

    // Edit Form state
    const [formData, setFormData] = useState({
        name: vroom.name,
        description: vroom.description,
        isPublic: vroom.isPublic
    });

    // Real-time updates for followers and views
    useEffect(() => {
        const handleFollowChange = (e: CustomEvent) => {
            const { vroomId, isFollowing, followers } = e.detail;
            if (currentVroom.id === vroomId) {
                setCurrentVroom(prev => ({ ...prev, isFollowing, followers }));
            }
        };

        const handleViewed = (e: CustomEvent) => {
            const { vroomId, newCount } = e.detail;
            if (currentVroom.id === vroomId) {
                setCurrentVroom(prev => ({ ...prev, views: newCount != null ? newCount.toString() : (parseInt(prev.views || '0') + 1).toString() }));
            }
        };

        window.addEventListener('vroom-follow-changed' as any, handleFollowChange);
        window.addEventListener('vroom-viewed' as any, handleViewed);

        const channel = supabase.channel(`vroom-${currentVroom.id}-updates`)
            .on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'vrooms',
                    filter: `id=eq.${currentVroom.id}`
                },
                (payload) => {
                    const updatedVroom = payload.new as any;
                    setCurrentVroom(prev => ({
                        ...prev,
                        followers: updatedVroom.followers_count || 0,
                        views: updatedVroom.views_count?.toString() || prev.views
                    }));
                }
            )
            .subscribe();

        return () => {
            window.removeEventListener('vroom-follow-changed' as any, handleFollowChange);
            window.removeEventListener('vroom-viewed' as any, handleViewed);
            supabase.removeChannel(channel);
        };
    }, [currentVroom.id]);

    // Check ownership
    const isOwner = currentVroom.ownerName === CURRENT_USER.name || currentVroom.ownerId === CURRENT_USER.id;

    const handleEditClick = () => {
        setFormData({
            name: currentVroom.name,
            description: currentVroom.description,
            isPublic: currentVroom.isPublic
        });
        setIsMenuOpen(false);
        setIsEditModalOpen(true);
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const updated = await api.updateVroom(currentVroom.id, formData);
            setCurrentVroom(updated);
            setIsEditModalOpen(false);
        } catch (e) {
            alert("Failed to update vroom");
        }
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleCheckboxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, checked } = e.target;
        setFormData(prev => ({ ...prev, [name]: checked }));
    };

    const handleLike = async (product: Product) => {
        try {
            const { likes, isLiked } = await api.toggleLike(product.id);
            setCurrentVroom(prev => ({
                ...prev,
                products: prev.products.map(p => p.id === product.id ? { ...p, likes, isLiked } : p)
            }));
        } catch (e) { console.error(e); }
    };

    const handleBookmark = async (product: Product) => {
        try {
            const { isBookmarked } = await api.toggleBookmark(product.id);
            setCurrentVroom(prev => ({
                ...prev,
                products: prev.products.map(p => p.id === product.id ? { ...p, isBookmarked } : p)
            }));
        } catch (e) { console.error(e); }
    };

    const handleShareVroom = () => {
        const url = `${APP_URL}/vroom/${currentVroom.id}`;
        navigator.clipboard.writeText(url);
        alert(currentVroom.isPublic ? "Vroom link copied!" : "Private link copied! Only people with this link can view this Vroom.");
    }

    const handleToggleStock = async (product: Product) => {
        try {
            const newStatus = !product.isOutOfStock;
            await api.toggleStockStatus(product.id, newStatus);
            setCurrentVroom(prev => ({
                ...prev,
                products: prev.products.map(p => p.id === product.id ? { ...p, isOutOfStock: newStatus } : p)
            }));
        } catch (e) {
            console.error(e);
            alert("Failed to toggle stock");
        }
    };

    return (
        <div className="flex-1 p-4 md:p-6 min-h-screen bg-background pb-20 relative">
            <div className="w-full space-y-6">

                {/* Vroom Header Card */}
                <div className="bg-card rounded-xl border border-border overflow-hidden relative">
                    {/* Cover Image */}
                    <div className="h-48 md:h-56 w-full bg-muted relative">
                        <img
                            src={currentVroom.coverImage}
                            alt="Cover"
                            className="w-full h-full object-cover"
                        />
                        {!currentVroom.isPublic && (
                            <div className="absolute top-4 left-4 bg-black/60 text-white px-3 py-1 rounded-full text-xs font-bold uppercase backdrop-blur-sm border border-white/20 flex items-center gap-2">
                                <i className="fas fa-lock"></i> Private
                            </div>
                        )}
                    </div>

                    <div className="p-6 pt-12 md:pt-6 relative">
                        <div className="flex flex-col md:flex-row gap-4 md:items-start">
                            {/* Icon - Floating on Desktop */}
                            <div className="absolute -top-10 left-6 md:static md:block hidden">
                                {/* Placeholder */}
                            </div>

                            <div className="flex-1 flex flex-col md:flex-row gap-4">
                                {/* Icon */}
                                <div className="w-16 h-16 md:w-16 md:h-16 flex-shrink-0 text-primary">
                                    <i className="fas fa-store text-5xl"></i>
                                </div>

                                <div className="flex-1 space-y-3">
                                    {/* Title Row */}
                                    <div className="flex items-start justify-between relative">
                                        <div>
                                            <div className="flex items-center gap-3">
                                                <h1 className="text-2xl font-bold text-foreground uppercase tracking-tight">{currentVroom.name}</h1>
                                            </div>
                                            <p className="text-muted-foreground text-sm mt-1">{currentVroom.description}</p>
                                        </div>

                                        {/* Options Menu */}
                                        <div className="flex items-center gap-2 relative">
                                            {currentVroom.isPublic ? (
                                                <span className="bg-[#E86C44] text-white text-[10px] px-2 py-0.5 rounded font-bold uppercase">Public</span>
                                            ) : (
                                                <span className="bg-muted text-muted-foreground text-[10px] px-2 py-0.5 rounded font-bold uppercase border border-border">Private</span>
                                            )}

                                            <div className="relative">
                                                <button
                                                    onClick={() => setIsMenuOpen(!isMenuOpen)}
                                                    className="w-8 h-8 flex items-center justify-center rounded border border-border hover:bg-muted text-muted-foreground"
                                                >
                                                    <i className="fas fa-ellipsis-v text-xs"></i>
                                                </button>

                                                {/* Dropdown Menu */}
                                                {isMenuOpen && (
                                                    <>
                                                        <div className="fixed inset-0 z-10" onClick={() => setIsMenuOpen(false)}></div>
                                                        <div className="absolute right-0 top-full mt-2 w-48 bg-card border border-border rounded-lg shadow-lg z-20 overflow-hidden">
                                                            {isOwner && (
                                                                <button
                                                                    onClick={handleEditClick}
                                                                    className="w-full text-left px-4 py-3 text-sm hover:bg-muted transition-colors flex items-center gap-2"
                                                                >
                                                                    <i className="fas fa-edit text-muted-foreground"></i> Edit Vroom
                                                                </button>
                                                            )}
                                                            <button className="w-full text-left px-4 py-3 text-sm hover:bg-muted transition-colors flex items-center gap-2 text-destructive">
                                                                <i className="fas fa-flag"></i> Report
                                                            </button>
                                                        </div>
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Owner & Stats */}
                                    <div className="flex flex-col gap-2">
                                        <div className="flex items-center gap-2">
                                            <div className="w-6 h-6 bg-muted rounded-full flex items-center justify-center overflow-hidden">
                                                <i className="fas fa-user text-xs text-muted-foreground"></i>
                                            </div>
                                            <span
                                                className="text-sm font-medium text-foreground/80 cursor-pointer hover:text-[#E86C44] hover:underline transition-colors"
                                                onClick={() => currentVroom.ownerId && onUserClick && onUserClick(currentVroom.ownerId)}
                                            >
                                                {currentVroom.ownerName || 'Owner'}
                                            </span>
                                        </div>
                                        <div className="flex gap-4 text-xs text-muted-foreground font-medium">
                                            <span>{currentVroom.products.length} products</span>
                                            <span>{currentVroom.followers} followers</span>
                                        </div>
                                    </div>

                                    {/* Buttons */}
                                    <div className="flex gap-3 pt-2">
                                        {isOwner && (
                                            <button className="bg-[#E86C44] text-white px-6 py-2 rounded text-sm font-bold flex items-center gap-2 hover:bg-[#d6623e] transition-colors shadow-sm">
                                                <i className="fas fa-plus text-xs"></i> Add Product
                                            </button>
                                        )}
                                        <button onClick={handleShareVroom} className="border border-border bg-background text-foreground px-6 py-2 rounded text-sm font-medium flex items-center gap-2 hover:bg-muted transition-colors shadow-sm">
                                            <i className="fas fa-share text-xs"></i> Share
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Products Grid */}
                <div>
                    <h2 className="text-base font-bold mb-4 text-foreground">Products ({currentVroom.products.length})</h2>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {currentVroom.products.map(product => (
                            <div key={product.id} className="bg-card rounded-xl border border-border overflow-hidden group hover:shadow-md transition-shadow">
                                {/* Image */}
                                <div
                                    className="aspect-[4/3] bg-muted relative overflow-hidden border-b border-border cursor-pointer"
                                    onClick={() => onProductClick(product)}
                                >
                                    <img
                                        src={product.image}
                                        alt={product.name}
                                        className="w-full h-full object-cover"
                                    />
                                    {product.isOutOfStock && (
                                        <div className="absolute inset-0 bg-black/60 flex items-center justify-center z-10 pointer-events-none">
                                            <span className="border-2 border-white text-white font-black text-xs px-2 py-1 transform -rotate-12 uppercase tracking-widest opacity-80">
                                                Sold Out
                                            </span>
                                        </div>
                                    )}
                                </div>

                                {/* Details */}
                                <div className="p-4 bg-background">
                                    <h3
                                        className="font-bold text-foreground text-sm mb-1 cursor-pointer hover:underline"
                                        onClick={() => onProductClick(product)}
                                    >
                                        {product.name}
                                    </h3>
                                    <p className="text-xs text-muted-foreground mb-3 line-clamp-2 min-h-[2.5em]">{product.description}</p>

                                    <div className="flex items-center justify-between mb-2">
                                        <span className={`font-bold text-base ${product.isOutOfStock ? 'text-muted-foreground line-through decoration-2' : 'text-[#E86C44]'}`}>
                                            {product.currency} {product.price.toFixed(2)}
                                        </span>
                                    </div>

                                    <div className="text-[10px] text-muted-foreground mb-4">
                                        by <span
                                            className="cursor-pointer hover:text-[#E86C44] hover:underline transition-colors"
                                            onClick={(e) => { e.stopPropagation(); currentVroom.ownerId && onUserClick && onUserClick(currentVroom.ownerId); }}
                                        >{currentVroom.ownerName || 'Owner'}</span>
                                    </div>

                                    {/* Reaction Buttons Row - Compact Grid */}
                                    <div className="flex items-stretch gap-1.5 h-10">
                                        {/* Cart Button (Left) */}
                                        {product.userId !== CURRENT_USER.id ? (
                                            <button
                                                onClick={() => !product.isOutOfStock && onAddToCart(product)}
                                                title={product.isOutOfStock ? "Sold Out" : "Add to Cart"}
                                                disabled={product.isOutOfStock}
                                                className={`px-3 rounded-lg flex items-center justify-center transition-colors shadow-sm ${product.isOutOfStock ? 'bg-muted-foreground cursor-not-allowed opacity-50 text-white' : 'bg-[#E86C44] text-white hover:bg-[#d6623e]'}`}
                                            >
                                                <i className="fas fa-shopping-cart text-sm"></i>
                                            </button>
                                        ) : (
                                            <button
                                                onClick={() => handleToggleStock(product)}
                                                title="Toggle Stock"
                                                className={`px-3 rounded-lg flex items-center justify-center transition-colors shadow-sm ${product.isOutOfStock ? 'bg-green-600 text-white' : 'bg-red-500 text-white'}`}
                                            >
                                                <i className={`fas ${product.isOutOfStock ? 'fa-check' : 'fa-ban'} text-sm`}></i>
                                            </button>
                                        )}

                                        {/* Likes */}
                                        <button
                                            onClick={() => handleLike(product)}
                                            title="Like"
                                            className="flex-1 bg-white border border-border rounded-lg flex flex-col items-center justify-center hover:bg-muted/50"
                                        >
                                            <i className={`${product.isLiked ? 'fas' : 'far'} fa-heart text-[#E86C44] text-[10px] mb-0.5`}></i>
                                            <span className="text-[9px] font-medium text-foreground">{product.likes}</span>
                                        </button>

                                        {/* Comments */}
                                        <button
                                            onClick={() => onProductClick(product)}
                                            title="Comment"
                                            className="flex-1 bg-white border border-border rounded-lg flex flex-col items-center justify-center hover:bg-muted/50"
                                        >
                                            <i className="far fa-comment text-foreground text-[10px] mb-0.5"></i>
                                            <span className="text-[9px] font-medium text-foreground">{product.commentsCount || 0}</span>
                                        </button>

                                        {/* Shares */}
                                        <button
                                            onClick={() => onShare(product)}
                                            title="Share"
                                            className="flex-1 bg-white border border-border rounded-lg flex flex-col items-center justify-center hover:bg-muted/50"
                                        >
                                            <i className="fas fa-share text-foreground text-[10px] mb-0.5"></i>
                                            <span className="text-[9px] font-medium text-foreground">{product.sharesCount || 0}</span>
                                        </button>

                                        {/* Bookmark */}
                                        <button
                                            onClick={() => handleBookmark(product)}
                                            title="Bookmark"
                                            className="flex-1 bg-white border border-border rounded-lg flex items-center justify-center hover:bg-muted/50"
                                        >
                                            <i className={`${product.isBookmarked ? 'fas' : 'far'} fa-bookmark text-[#E86C44] text-xs`}></i>
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

            </div>

            {/* Edit Vroom Modal */}
            {isEditModalOpen && (
                <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4">
                    <div className="bg-card rounded-xl w-full max-w-md animate-in fade-in zoom-in duration-200">
                        <div className="flex items-center justify-between p-6 border-b border-border">
                            <h3 className="text-xl font-bold">Edit Vroom</h3>
                            <button onClick={() => setIsEditModalOpen(false)} className="text-muted-foreground hover:text-foreground">
                                <i className="fas fa-times text-xl"></i>
                            </button>
                        </div>

                        <form onSubmit={handleSave} className="p-6 space-y-4">
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Vroom Name</label>
                                <input
                                    type="text"
                                    name="name"
                                    value={formData.name}
                                    onChange={handleInputChange}
                                    className="w-full px-4 py-2 bg-background border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                                    required
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-medium">Description</label>
                                <textarea
                                    name="description"
                                    value={formData.description}
                                    onChange={handleInputChange}
                                    className="w-full px-4 py-2 bg-background border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-primary h-24 resize-none"
                                ></textarea>
                            </div>

                            <div className="flex items-center gap-3 p-3 bg-muted/20 rounded-xl border border-border">
                                <div className={`w-10 h-6 rounded-full p-1 cursor-pointer transition-colors ${formData.isPublic ? 'bg-[#E86C44]' : 'bg-muted-foreground'}`} onClick={() => setFormData(p => ({ ...p, isPublic: !p.isPublic }))}>
                                    <div className={`w-4 h-4 bg-white rounded-full shadow-sm transition-transform ${formData.isPublic ? 'translate-x-4' : 'translate-x-0'}`}></div>
                                </div>
                                <div>
                                    <label className="text-xs font-bold block cursor-pointer" onClick={() => setFormData(p => ({ ...p, isPublic: !p.isPublic }))}>
                                        {formData.isPublic ? 'Public' : 'Private'}
                                    </label>
                                    <p className="text-[10px] text-muted-foreground">
                                        {formData.isPublic ? 'Visible to everyone on Explore' : 'Only visible via direct link'}
                                    </p>
                                </div>
                            </div>

                            <div className="flex justify-end gap-3 pt-4">
                                <button
                                    type="button"
                                    onClick={() => setIsEditModalOpen(false)}
                                    className="px-4 py-2 border border-border rounded-lg hover:bg-muted transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="px-4 py-2 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition-colors"
                                >
                                    Save Changes
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

        </div>
    );
};

export default Vroom;
