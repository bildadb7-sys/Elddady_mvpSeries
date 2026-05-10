
import React, { useState, useEffect, useRef } from 'react';
import { Vroom as VroomType, Product, User } from '../types';
import { api } from '../api';
import { supabase } from '../supabaseClient';
import ShareModal from './ShareModal';

interface VroomsProps {
    initialVroomData?: VroomType;
    onAddToCart: (product: Product) => void;
    onProductClick: (product: Product) => void;
    onShare: (product: Product) => void;
    currentUser: User;
    onUserClick?: (userId: string) => void;
}

const AddProductToVroomModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    products: Product[];
    onAdd: (productId: string) => void;
}> = ({ isOpen, onClose, products, onAdd }) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4">
            <div className="bg-card w-full max-w-md rounded-xl p-6 animate-in zoom-in-95 max-h-[80vh] overflow-y-auto">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-xl font-bold">Add Products to Vroom</h3>
                    <button onClick={onClose}><i className="fas fa-times"></i></button>
                </div>
                {products.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                        <p>No new products found.</p>
                        <p className="text-xs mt-2">Post new products first to add them here.</p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {products.map(p => (
                            <div key={p.id} className="flex items-center gap-3 p-2 border border-border rounded-lg hover:bg-muted/50 transition-colors">
                                <div className="relative w-12 h-12">
                                    <img src={p.image} className="w-full h-full rounded object-cover" alt={p.name} />
                                    {p.isOutOfStock && <div className="absolute inset-0 bg-black/60 rounded flex items-center justify-center text-[8px] text-white font-bold uppercase">Sold</div>}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <h4 className="font-bold text-sm truncate">{p.name}</h4>
                                    <p className={`text-xs ${p.isOutOfStock ? 'text-muted-foreground line-through' : 'text-muted-foreground'}`}>
                                        {p.currency} {p.price.toFixed(2)}
                                    </p>
                                </div>
                                <button
                                    onClick={() => !p.isOutOfStock && onAdd(p.id)}
                                    disabled={p.isOutOfStock}
                                    className={`px-3 py-1.5 rounded text-xs font-bold ${p.isOutOfStock ? 'bg-muted text-muted-foreground' : 'bg-primary text-primary-foreground hover:bg-primary/90'}`}
                                >
                                    Add
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

const Vrooms: React.FC<VroomsProps> = ({ initialVroomData, onAddToCart, onProductClick, onShare, currentUser, onUserClick }) => {
    const [view, setView] = useState<'dashboard' | 'detail'>('dashboard');
    const [selectedVroom, setSelectedVroom] = useState<VroomType | null>(initialVroomData || null);
    const [loadingDetails, setLoadingDetails] = useState(false);

    const [myVroom, setMyVroom] = useState<VroomType | null>(null);
    const [followingVrooms, setFollowingVrooms] = useState<VroomType[]>([]);
    const [suggestedVrooms, setSuggestedVrooms] = useState<VroomType[]>([]);
    const [loading, setLoading] = useState(true);

    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [isCreateVroomModalOpen, setIsCreateVroomModalOpen] = useState(false);
    const [isAddProductModalOpen, setIsAddProductModalOpen] = useState(false);
    const [availableProducts, setAvailableProducts] = useState<Product[]>([]);
    const [isShareModalOpen, setIsShareModalOpen] = useState(false);

    const [detailFormData, setDetailFormData] = useState({ name: '', description: '', isPublic: true, coverImage: '' });
    const [createVroomData, setCreateVroomData] = useState({ name: '', description: '', coverImage: '', isPublic: true });
    const [isCreating, setIsCreating] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [uploadingBanner, setUploadingBanner] = useState(false);

    const createCoverInputRef = useRef<HTMLInputElement>(null);
    const editCoverInputRef = useRef<HTMLInputElement>(null);

    // Lazy Load Detail Logic
    useEffect(() => {
        const loadDetails = async () => {
            if (initialVroomData) {
                setLoadingDetails(true);
                try {
                    const fullVroom = await api.getVroomById(initialVroomData.id);
                    setSelectedVroom(fullVroom);
                } catch (e) {
                    console.error("Failed to load vroom details", e);
                    setSelectedVroom(initialVroomData);
                } finally {
                    setLoadingDetails(false);
                }
                setView('detail');
            }
        };
        loadDetails();
    }, [initialVroomData]);

    // Sync Global Events for Follow Status
    useEffect(() => {
        const handleFollowChange = (e: CustomEvent) => {
            const { vroomId, isFollowing, followers } = e.detail;

            // 1. Update Detail View if active
            setSelectedVroom(prev => {
                if (prev && prev.id === vroomId) {
                    return { ...prev, isFollowing, followers };
                }
                return prev;
            });

            // 2. Update Suggested List (Sync follow status)
            setSuggestedVrooms(prev => prev.map(v =>
                v.id === vroomId ? { ...v, isFollowing, followers } : v
            ));

            // 3. Update Following List
            if (isFollowing) {
                setFollowingVrooms(prev => {
                    if (prev.some(v => v.id === vroomId)) {
                        return prev.map(v => v.id === vroomId ? { ...v, isFollowing, followers } : v);
                    }

                    // If not in following list, we need to add it.
                    // We can't easily access suggestedVrooms here without a ref, 
                    // so we'll just fetch it from the API to be safe and ensure we have full data.
                    api.getVroomById(vroomId).then(vroom => {
                        setFollowingVrooms(current => {
                            if (current.some(v => v.id === vroomId)) return current;
                            return [...current, { ...vroom, isFollowing: true, followers }];
                        });
                    }).catch(console.error);

                    return prev;
                });
            } else {
                // Unfollow: Remove from list
                setFollowingVrooms(prev => prev.filter(v => v.id !== vroomId));
            }
        };

        const handleViewed = (e: CustomEvent) => {
            const { vroomId, newCount } = e.detail;
            const incrementView = (v: VroomType) => v.id === vroomId ? { ...v, views: newCount != null ? newCount.toString() : (parseInt(v.views || '0') + 1).toString() } : v;

            setSelectedVroom(prev => prev ? incrementView(prev) : prev);
            setMyVroom(prev => prev ? incrementView(prev) : prev);
            setFollowingVrooms(prev => prev.map(incrementView));
            setSuggestedVrooms(prev => prev.map(incrementView));
        };

        window.addEventListener('vroom-follow-changed' as any, handleFollowChange);
        window.addEventListener('vroom-viewed' as any, handleViewed);

        // Real-time updates for vrooms (followers and views)
        const channel = supabase.channel('vrooms-dashboard-updates')
            .on(
                'postgres_changes',
                { event: 'UPDATE', schema: 'public', table: 'vrooms' },
                (payload) => {
                    const updatedVroom = payload.new as any;

                    // Update selected vroom if active
                    setSelectedVroom(prev => {
                        if (prev && prev.id === updatedVroom.id) {
                            return {
                                ...prev,
                                followers: updatedVroom.followers_count || 0,
                                views: updatedVroom.views_count?.toString() || prev.views
                            };
                        }
                        return prev;
                    });

                    // Update my vroom
                    setMyVroom(prev => {
                        if (prev && prev.id === updatedVroom.id) {
                            return {
                                ...prev,
                                followers: updatedVroom.followers_count || 0,
                                views: updatedVroom.views_count?.toString() || prev.views
                            };
                        }
                        return prev;
                    });

                    // Update following vrooms
                    setFollowingVrooms(prev => prev.map(v => {
                        if (v.id === updatedVroom.id) {
                            return {
                                ...v,
                                followers: updatedVroom.followers_count || 0,
                                views: updatedVroom.views_count?.toString() || v.views
                            };
                        }
                        return v;
                    }));

                    // Update suggested vrooms
                    setSuggestedVrooms(prev => prev.map(v => {
                        if (v.id === updatedVroom.id) {
                            return {
                                ...v,
                                followers: updatedVroom.followers_count || 0,
                                views: updatedVroom.views_count?.toString() || v.views
                            };
                        }
                        return v;
                    }));
                }
            )
            .subscribe();

        return () => {
            window.removeEventListener('vroom-follow-changed' as any, handleFollowChange);
            window.removeEventListener('vroom-viewed' as any, handleViewed);
            supabase.removeChannel(channel);
        };
    }, []);

    useEffect(() => {
        if (selectedVroom?.id) api.recordVroomView(selectedVroom.id);
    }, [selectedVroom?.id]);

    useEffect(() => {
        const fetchDashboard = async () => {
            try {
                const data = await api.getVroomsDashboard();
                setMyVroom(data.myVroom);
                setFollowingVrooms(data.following);
                setSuggestedVrooms(data.suggested);
                setLoading(false);
            } catch (e) { console.error(e); setLoading(false); }
        };
        if (view === 'dashboard') fetchDashboard();
    }, [view]);

    const handleVroomClick = async (vroom: VroomType) => {
        setView('detail');
        setLoadingDetails(true);
        try {
            const fullDetails = await api.getVroomById(vroom.id);
            setSelectedVroom(fullDetails);
        } catch (e) {
            console.error(e);
            setSelectedVroom(vroom);
        } finally {
            setLoadingDetails(false);
        }
    };

    const handleBackToDashboard = () => { setSelectedVroom(null); setView('dashboard'); };

    const handleFollowToggle = async (e: React.MouseEvent, vroomId: string) => {
        e.stopPropagation();
        try {
            await api.toggleFollowVroom(vroomId);
        } catch (e) { alert("Failed to update follow status"); }
    };

    const handleLike = async (e: React.MouseEvent, product: Product) => {
        e.stopPropagation();
        try {
            const { likes, isLiked } = await api.toggleLike(product.id);
            setSelectedVroom(prev => prev ? ({
                ...prev,
                products: prev.products.map(p => p.id === product.id ? { ...p, likes, isLiked } : p)
            }) : null);
        } catch (e) { console.error(e); }
    };

    const handleBookmark = async (e: React.MouseEvent, product: Product) => {
        e.stopPropagation();
        try {
            const { isBookmarked } = await api.toggleBookmark(product.id);
            setSelectedVroom(prev => prev ? ({
                ...prev,
                products: prev.products.map(p => p.id === product.id ? { ...p, isBookmarked } : p)
            }) : null);
        } catch (e) { console.error(e); }
    };

    const handleShareLocal = async (e: React.MouseEvent, product: Product) => {
        e.stopPropagation();
        try {
            const newCount = await api.incrementShare(product.id);
            setSelectedVroom(prev => prev ? ({
                ...prev,
                products: prev.products.map(p => p.id === product.id ? { ...p, sharesCount: newCount } : p)
            }) : null);
        } catch (e) { console.error(e); }
        onShare(product);
    };

    const handleEditClick = () => {
        if (!selectedVroom) return;
        setDetailFormData({
            name: selectedVroom.name,
            description: selectedVroom.description,
            isPublic: selectedVroom.isPublic !== false,
            coverImage: selectedVroom.coverImage
        });
        setIsMenuOpen(false); setIsEditModalOpen(true);
    };

    const handleBannerUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setUploadingBanner(true);
            try {
                const file = e.target.files[0];
                const res: any = await api.updateProfileImage('vroom', file);
                setDetailFormData(prev => ({ ...prev, coverImage: res.url }));
            } catch (e) {
                alert("Failed to upload banner");
            } finally {
                setUploadingBanner(false);
            }
        }
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedVroom) return;
        try {
            const updated = await api.updateVroom(selectedVroom.id, detailFormData);
            setSelectedVroom(updated);
            if (myVroom && myVroom.id === updated.id) {
                setMyVroom(updated);
            }
            setIsEditModalOpen(false);
        } catch (e) {
            alert("Failed to update vroom");
        }
    };

    const handleAddProductClick = async () => {
        if (!selectedVroom) return;
        try {
            const products = await api.getAvailableProductsForVroom(selectedVroom.id);
            setAvailableProducts(products);
            setIsAddProductModalOpen(true);
        } catch (e) {
            console.error(e);
            alert("Failed to load products");
        }
    };

    const handleAddProductToVroom = async (productId: string) => {
        if (!selectedVroom) return;
        try {
            const updatedVroom = await api.addProductToVroom(selectedVroom.id, productId);
            setSelectedVroom(updatedVroom);
            setMyVroom(updatedVroom);
            setIsAddProductModalOpen(false);
        } catch (e) {
            alert("Failed to add product");
        }
    };

    const handleCreateVroom = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsCreating(true);
        try {
            const newVroom = await api.createVroom(createVroomData);
            setMyVroom(newVroom);
            setIsCreateVroomModalOpen(false);
            setCreateVroomData({ name: '', description: '', coverImage: '', isPublic: true });
        } catch (e) {
            alert("Failed to create vroom");
        } finally {
            setIsCreating(false);
        }
    };

    const handleCreateCoverUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setUploading(true);
            try {
                const file = e.target.files[0];
                const res: any = await api.updateProfileImage('vroom', file);
                setCreateVroomData(prev => ({ ...prev, coverImage: res.url }));
            } catch (e) {
                alert("Failed to upload cover image");
            } finally {
                setUploading(false);
            }
        }
    };

    const isOwner = selectedVroom?.ownerId === currentUser.id;

    if (view === 'detail' && selectedVroom) {
        return (
            <div className="flex-1 min-h-screen bg-background pb-20">
                {/* Header */}
                <div className="h-64 relative bg-muted group">
                    <img src={selectedVroom.coverImage} className="w-full h-full object-cover" alt="Cover" />
                    <div className="absolute top-4 left-4">
                        <button onClick={handleBackToDashboard} className="bg-black/50 hover:bg-black/70 text-white rounded-full w-10 h-10 flex items-center justify-center backdrop-blur-sm transition-all">
                            <i className="fas fa-arrow-left"></i>
                        </button>
                    </div>
                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-6 pt-20">
                        <div className="flex justify-between items-end">
                            <div className="text-white">
                                <div className="flex items-center gap-3">
                                    <h1 className="text-3xl font-black uppercase tracking-tight">{selectedVroom.name}</h1>
                                    {!selectedVroom.isPublic && (
                                        <span className="bg-black/50 backdrop-blur-md px-2 py-1 rounded text-[10px] font-bold uppercase tracking-widest border border-white/20">
                                            <i className="fas fa-lock mr-1"></i> Private
                                        </span>
                                    )}
                                </div>
                                <p className="text-sm font-medium opacity-90 line-clamp-2 max-w-xl">{selectedVroom.description}</p>
                                <div className="flex gap-4 mt-2 text-[10px] font-bold uppercase tracking-widest opacity-80">
                                    <span>{selectedVroom.productCount} Products</span>
                                    <span>{selectedVroom.followers} Followers</span>
                                    <span>{selectedVroom.views} Views</span>
                                </div>
                            </div>
                            <div className="flex gap-2">
                                {isOwner ? (
                                    <>
                                        <button onClick={handleAddProductClick} className="bg-[#E86C44] text-white px-4 py-2 rounded-lg font-black text-xs uppercase hover:bg-[#d6623e] transition-colors">
                                            <i className="fas fa-plus mr-1"></i> Add Product
                                        </button>
                                        <button onClick={handleEditClick} className="bg-white/20 text-white px-4 py-2 rounded-lg font-black text-xs uppercase hover:bg-white/30 transition-colors backdrop-blur-sm">
                                            Edit
                                        </button>
                                    </>
                                ) : (
                                    <button
                                        onClick={(e) => handleFollowToggle(e, selectedVroom.id)}
                                        className={`px-6 py-2 rounded-lg font-black text-xs uppercase transition-colors ${selectedVroom.isFollowing ? 'bg-white text-black' : 'bg-[#E86C44] text-white'}`}
                                    >
                                        {selectedVroom.isFollowing ? 'Following' : 'Follow'}
                                    </button>
                                )}
                                <button onClick={() => setIsShareModalOpen(true)} className="bg-white/20 text-white w-10 h-10 rounded-lg flex items-center justify-center hover:bg-white/30 transition-colors backdrop-blur-sm">
                                    <i className="fas fa-share"></i>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Products */}
                {loadingDetails ? (
                    <div className="p-20 text-center flex flex-col items-center gap-4">
                        <i className="fas fa-circle-notch fa-spin text-[#E86C44] text-2xl"></i>
                        <p className="text-muted-foreground text-sm font-bold uppercase tracking-widest">Loading Showcase...</p>
                    </div>
                ) : (
                    <div className="p-4 md:p-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {selectedVroom.products.map(product => (
                            <div key={product.id} className="bg-card rounded-xl border border-border overflow-hidden group">
                                <div className="aspect-square bg-muted relative overflow-hidden cursor-pointer" onClick={() => onProductClick(product)}>
                                    <img src={product.image} className="w-full h-full object-cover transition-transform group-hover:scale-105" alt={product.name} />
                                    {product.isOutOfStock && (
                                        <div className="absolute inset-0 bg-black/60 flex items-center justify-center z-10 pointer-events-none">
                                            <span className="border-2 border-white text-white font-black text-xs px-2 py-1 transform -rotate-12 uppercase tracking-widest opacity-80">
                                                Sold Out
                                            </span>
                                        </div>
                                    )}
                                </div>
                                <div className="p-3">
                                    <h3 className="font-bold text-sm truncate">{product.name}</h3>
                                    <p className={`text-xs font-bold mt-1 ${product.isOutOfStock ? 'text-muted-foreground line-through' : 'text-[#E86C44]'}`}>
                                        {product.currency} {product.price.toFixed(2)}
                                    </p>

                                    {/* Action Bar */}
                                    <div className="flex items-stretch gap-1 h-11 mt-2 bg-muted/20 rounded-lg p-1">
                                        {product.userId !== currentUser.id && (
                                            <button
                                                onClick={(e) => { e.stopPropagation(); if (!product.isOutOfStock) onAddToCart(product); }}
                                                title={product.isOutOfStock ? "Out of Stock" : "Add to Cart"}
                                                disabled={product.isOutOfStock}
                                                className={`flex-1 text-white rounded-md flex items-center justify-center transition-colors shadow-sm active:scale-95 ${product.isOutOfStock ? 'bg-muted-foreground cursor-not-allowed opacity-50' : 'bg-[#E86C44] hover:bg-[#d6623e]'}`}
                                            >
                                                {product.isOutOfStock ? <span className="text-[8px] font-bold uppercase">Sold</span> : <i className="fas fa-shopping-cart text-xs"></i>}
                                            </button>
                                        )}

                                        <button
                                            onClick={(e) => handleLike(e, product)}
                                            className="flex-1 bg-white border border-border rounded-md flex flex-col items-center justify-center hover:bg-muted/50 active:scale-95 transition-transform"
                                        >
                                            <i className={`${product.isLiked ? 'fas' : 'far'} fa-heart text-[#E86C44] text-[10px]`}></i>
                                            <span className="text-[8px] font-bold mt-0.5 leading-none">{product.likes > 0 ? product.likes.toLocaleString() : '0'}</span>
                                        </button>

                                        <button
                                            onClick={(e) => handleShareLocal(e, product)}
                                            className="flex-1 bg-white border border-border rounded-md flex flex-col items-center justify-center hover:bg-muted/50 active:scale-95 transition-transform"
                                        >
                                            <i className="fas fa-share text-foreground text-[10px]"></i>
                                            <span className="text-[8px] font-bold mt-0.5 leading-none">{(product.sharesCount || 0) > 0 ? (product.sharesCount || 0).toLocaleString() : '0'}</span>
                                        </button>

                                        <button
                                            onClick={(e) => handleBookmark(e, product)}
                                            className="flex-1 bg-white border border-border rounded-md flex items-center justify-center hover:bg-muted/50 active:scale-95 transition-transform"
                                        >
                                            <i className={`${product.isBookmarked ? 'fas' : 'far'} fa-bookmark text-[#E86C44] text-[10px]`}></i>
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* Modals */}
                <AddProductToVroomModal
                    isOpen={isAddProductModalOpen}
                    onClose={() => setIsAddProductModalOpen(false)}
                    products={availableProducts}
                    onAdd={handleAddProductToVroom}
                />
                <ShareModal
                    isOpen={isShareModalOpen}
                    onClose={() => setIsShareModalOpen(false)}
                    productName={selectedVroom.name}
                    productUrl={`${window.location.origin}/#/vroom/${selectedVroom.id}`}
                    title="Share Vroom"
                />

                {isEditModalOpen && (
                    <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-4 backdrop-blur-sm">
                        <div className="bg-card w-full max-w-md rounded-2xl p-6 shadow-xl animate-in zoom-in-95">
                            <div className="flex justify-between items-center mb-6 border-b border-border pb-4">
                                <h3 className="text-xl font-black uppercase tracking-tight">Edit Vroom</h3>
                                <button onClick={() => setIsEditModalOpen(false)}><i className="fas fa-times"></i></button>
                            </div>

                            <form onSubmit={handleSave} className="space-y-4">
                                {/* Cover Image Edit */}
                                <div
                                    className="h-32 bg-muted rounded-xl relative overflow-hidden group cursor-pointer border-2 border-dashed border-border hover:border-[#E86C44] transition-colors"
                                    onClick={() => editCoverInputRef.current?.click()}
                                >
                                    {detailFormData.coverImage ? (
                                        <img src={detailFormData.coverImage} className="w-full h-full object-cover" />
                                    ) : (
                                        <div className="absolute inset-0 flex items-center justify-center text-muted-foreground flex-col">
                                            <i className="fas fa-cloud-upload-alt text-2xl mb-1"></i>
                                            <span className="text-[10px] font-bold uppercase">Upload Banner</span>
                                        </div>
                                    )}
                                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                        <span className="text-white text-xs font-bold">{uploadingBanner ? 'Uploading...' : 'Change Cover'}</span>
                                    </div>
                                </div>
                                <input type="file" ref={editCoverInputRef} className="hidden" accept="image/*" onChange={handleBannerUpload} />

                                <div>
                                    <label className="text-[10px] font-black uppercase text-muted-foreground ml-1">Vroom Name</label>
                                    <input
                                        value={detailFormData.name}
                                        onChange={e => setDetailFormData(p => ({ ...p, name: e.target.value }))}
                                        className="w-full p-3 border rounded-xl bg-background font-medium outline-none focus:border-[#E86C44]"
                                        placeholder="Name"
                                    />
                                </div>
                                <div>
                                    <label className="text-[10px] font-black uppercase text-muted-foreground ml-1">Description</label>
                                    <textarea
                                        value={detailFormData.description}
                                        onChange={e => setDetailFormData(p => ({ ...p, description: e.target.value }))}
                                        className="w-full p-3 border rounded-xl bg-background font-medium h-24 resize-none outline-none focus:border-[#E86C44]"
                                        placeholder="Description"
                                    />
                                </div>

                                <div className="flex items-center gap-3 p-3 bg-muted/20 rounded-xl border border-border">
                                    <div className={`w-10 h-6 rounded-full p-1 cursor-pointer transition-colors ${detailFormData.isPublic ? 'bg-[#E86C44]' : 'bg-muted-foreground'}`} onClick={() => setDetailFormData(p => ({ ...p, isPublic: !p.isPublic }))}>
                                        <div className={`w-4 h-4 bg-white rounded-full shadow-sm transition-transform ${detailFormData.isPublic ? 'translate-x-4' : 'translate-x-0'}`}></div>
                                    </div>
                                    <div>
                                        <label className="text-xs font-bold block cursor-pointer" onClick={() => setDetailFormData(p => ({ ...p, isPublic: !p.isPublic }))}>
                                            {detailFormData.isPublic ? 'Public' : 'Private'}
                                        </label>
                                        <p className="text-[10px] text-muted-foreground">
                                            {detailFormData.isPublic ? 'Visible to everyone on Explore' : 'Only visible via direct link'}
                                        </p>
                                    </div>
                                </div>

                                <div className="flex justify-end gap-3 pt-4 border-t border-border">
                                    <button type="button" onClick={() => setIsEditModalOpen(false)} className="px-6 py-2 border rounded-xl font-bold text-xs uppercase hover:bg-muted">Cancel</button>
                                    <button type="submit" disabled={uploadingBanner} className="px-6 py-2 bg-[#E86C44] text-white rounded-xl font-bold text-xs uppercase hover:brightness-110 shadow-lg">Save Changes</button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}
            </div>
        );
    }

    return (
        <div className="flex-1 min-h-screen bg-background p-4 md:p-6 pb-20">
            <div className="flex items-center justify-between mb-6">
                <h1 className="text-2xl font-black uppercase tracking-tight">Vrooms</h1>
                {!myVroom && (
                    <button onClick={() => setIsCreateVroomModalOpen(true)} className="bg-[#E86C44] text-white px-4 py-2 rounded-lg font-bold text-xs uppercase hover:bg-[#d6623e] shadow-md">
                        <i className="fas fa-plus mr-1"></i> Create Store
                    </button>
                )}
            </div>

            <div className="space-y-8">
                {/* My Vroom */}
                {myVroom && (
                    <section>
                        <h2 className="text-sm font-bold text-muted-foreground uppercase tracking-widest mb-3">My Vroom</h2>
                        <div onClick={() => handleVroomClick(myVroom)} className="bg-card border border-border rounded-xl overflow-hidden hover:shadow-lg transition-all cursor-pointer h-48 relative group">
                            <img src={myVroom.coverImage} className="w-full h-full object-cover transition-transform group-hover:scale-105" alt={myVroom.name} />

                            {/* Private Indicator */}
                            {!myVroom.isPublic && (
                                <div className="absolute top-3 right-3 bg-black/60 backdrop-blur-md text-white px-3 py-1 rounded-full text-[10px] font-bold uppercase border border-white/20 z-10 flex items-center gap-1">
                                    <i className="fas fa-lock"></i> Private
                                </div>
                            )}

                            <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent flex flex-col justify-end p-6">
                                <h3 className="text-white text-xl font-black uppercase tracking-tight">{myVroom.name}</h3>
                                <div className="flex gap-3 text-white/80 text-xs font-bold uppercase mt-1">
                                    <span>{myVroom.followers} Followers</span>
                                    <span>{myVroom.views} Views</span>
                                </div>
                            </div>
                        </div>
                    </section>
                )}

                {/* Vrooms You are Following */}
                {followingVrooms.length > 0 && (
                    <section>
                        <h2 className="text-sm font-bold text-muted-foreground uppercase tracking-widest mb-3">Vrooms You are Following</h2>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {followingVrooms.map(vroom => (
                                <div key={vroom.id} onClick={() => handleVroomClick(vroom)} className="bg-card border border-border rounded-xl p-3 flex gap-3 cursor-pointer hover:bg-muted/30 transition-colors">
                                    <img src={vroom.coverImage} className="w-16 h-16 rounded-lg object-cover" alt={vroom.name} />
                                    <div className="flex-1 min-w-0">
                                        <h4 className="font-bold text-sm truncate">{vroom.name}</h4>
                                        <p className="text-xs text-muted-foreground truncate">{vroom.ownerName}</p>
                                        <div className="flex items-center gap-1 mt-1 text-[10px] text-[#E86C44] font-bold">
                                            <i className="fas fa-eye"></i> {vroom.views}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </section>
                )}

                {/* Vrooms you might like */}
                <section>
                    <h2 className="text-sm font-bold text-muted-foreground uppercase tracking-widest mb-3">Vrooms you might like</h2>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {suggestedVrooms.map(vroom => (
                            <div key={vroom.id} onClick={() => handleVroomClick(vroom)} className="bg-card border border-border rounded-xl overflow-hidden cursor-pointer hover:shadow-md transition-all">
                                <div className="h-32 bg-muted relative">
                                    <img src={vroom.coverImage} className="w-full h-full object-cover" alt={vroom.name} />
                                    <div className="absolute top-2 right-2 bg-black/60 text-white text-[10px] font-bold px-2 py-1 rounded">
                                        {vroom.productCount} Items
                                    </div>
                                </div>
                                <div className="p-3">
                                    <h4 className="font-bold text-sm truncate">{vroom.name}</h4>
                                    <p className="text-xs text-muted-foreground mb-3 truncate">by {vroom.ownerName}</p>

                                    {/* Follow Button - HIDDEN for owner */}
                                    {vroom.ownerId !== currentUser.id && (
                                        <button
                                            onClick={(e) => handleFollowToggle(e, vroom.id)}
                                            className={`w-full py-1.5 rounded text-xs font-bold uppercase transition-colors ${vroom.isFollowing ? 'bg-muted text-foreground' : 'bg-[#E86C44] text-white hover:bg-[#d6623e]'}`}
                                        >
                                            {vroom.isFollowing ? 'Following' : 'Follow'}
                                        </button>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </section>
            </div>

            {isCreateVroomModalOpen && (
                <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4">
                    <div className="bg-card w-full max-w-md rounded-xl p-6 animate-in zoom-in-95">
                        <h3 className="text-xl font-bold mb-4">Create New Vroom</h3>
                        <form onSubmit={handleCreateVroom} className="space-y-4">
                            {/* Create Vroom Image Upload */}
                            <div
                                className="h-32 bg-muted rounded-xl relative overflow-hidden group cursor-pointer border-2 border-dashed border-border hover:border-[#E86C44] transition-colors"
                                onClick={() => createCoverInputRef.current?.click()}
                            >
                                {createVroomData.coverImage ? (
                                    <img src={createVroomData.coverImage} className="w-full h-full object-cover" />
                                ) : (
                                    <div className="absolute inset-0 flex items-center justify-center text-muted-foreground flex-col">
                                        <i className="fas fa-cloud-upload-alt text-2xl mb-1"></i>
                                        <span className="text-[10px] font-bold uppercase">Upload Banner</span>
                                    </div>
                                )}
                                {uploading && (
                                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                                        <span className="text-white text-xs font-bold">Uploading...</span>
                                    </div>
                                )}
                            </div>
                            <input type="file" ref={createCoverInputRef} className="hidden" accept="image/*" onChange={handleCreateCoverUpload} />

                            <input
                                type="text"
                                placeholder="Vroom Name"
                                required
                                value={createVroomData.name}
                                onChange={(e) => setCreateVroomData(p => ({ ...p, name: e.target.value }))}
                                className="w-full p-2 border rounded bg-background"
                            />
                            <textarea
                                placeholder="Description"
                                value={createVroomData.description}
                                onChange={(e) => setCreateVroomData(p => ({ ...p, description: e.target.value }))}
                                className="w-full p-2 border rounded bg-background resize-none"
                            />

                            <div className="flex items-center gap-3 p-3 bg-muted/20 rounded-xl border border-border">
                                <div className={`w-10 h-6 rounded-full p-1 cursor-pointer transition-colors ${createVroomData.isPublic ? 'bg-[#E86C44]' : 'bg-muted-foreground'}`} onClick={() => setCreateVroomData(p => ({ ...p, isPublic: !p.isPublic }))}>
                                    <div className={`w-4 h-4 bg-white rounded-full shadow-sm transition-transform ${createVroomData.isPublic ? 'translate-x-4' : 'translate-x-0'}`}></div>
                                </div>
                                <div>
                                    <label className="text-xs font-bold block cursor-pointer" onClick={() => setCreateVroomData(p => ({ ...p, isPublic: !p.isPublic }))}>
                                        {createVroomData.isPublic ? 'Public' : 'Private'}
                                    </label>
                                    <p className="text-[10px] text-muted-foreground">
                                        {createVroomData.isPublic ? 'Visible to everyone on Explore' : 'Only visible via direct link'}
                                    </p>
                                </div>
                            </div>

                            <div className="flex justify-end gap-2 pt-2">
                                <button type="button" onClick={() => setIsCreateVroomModalOpen(false)} className="px-4 py-2 border rounded">Cancel</button>
                                <button type="submit" disabled={isCreating || uploading} className="px-4 py-2 bg-[#E86C44] text-white rounded font-bold">
                                    {isCreating ? 'Creating...' : 'Create'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Vrooms;
