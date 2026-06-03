
import React, { useState, useEffect, useRef } from 'react';
import { Product, User, Comment, Reaction } from '../types';
import { api } from '../api';
import { CURRENT_USER } from '../constants';
import { useCurrency } from '../context/useCurrency';
import { VideoWithWatermark } from './VideoWithWatermark';

interface ProductDetailModalProps {
  product: Product | null;
  isOpen: boolean;
  onClose: () => void;
  currentUser: User;
  onAddToCart: (product: Product) => void;
  onShare: (product: Product) => void;
  onUserClick?: (userId: string) => void;
}

const EMOJIS = ['😀', '😂', '😍', '🥺', '😭', '🔥', '❤️', '👍', '✨', '💯', '🙌', '🎉', '🛍️', '💸'];
const REACTION_EMOJIS = ['❤️', '😂', '😮', '😢', '🔥', '👍', '🙏'];

const CommentItem: React.FC<{ 
  comment: Comment; 
  onReply: (parentId: string, content: string, image?: string) => void;
  onReact: (commentId: string, emoji: string) => void;
  depth?: number;
  onUserClick?: (userId: string) => void;
}> = ({ comment, onReply, onReact, depth = 0, onUserClick }) => {
  const [showReplyInput, setShowReplyInput] = useState(false);
  const [showReactionPicker, setShowReactionPicker] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [replyImage, setReplyImage] = useState<string | null>(null);
  const [showEmoji, setShowEmoji] = useState(false);
  const replyFileRef = useRef<HTMLInputElement>(null);

  const handleReplySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyText.trim() && !replyImage) return;
    onReply(comment.id, replyText, replyImage || undefined);
    setReplyText('');
    setReplyImage(null);
    setShowReplyInput(false);
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (ev) => setReplyImage(ev.target?.result as string);
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className={`relative ${depth > 0 ? 'ml-8 mt-4' : 'mb-6'}`}>
      {depth > 0 && <div className="thread-line" />}
      
      <div className="flex gap-3">
        <img 
          src={comment.user.avatar} 
          alt={comment.user.name} 
          className="w-9 h-9 rounded-full object-cover flex-shrink-0 border border-border cursor-pointer hover:opacity-80 transition-opacity" 
          onClick={(e) => { e.stopPropagation(); onUserClick && onUserClick(comment.user.id); }}
        />
        <div className="flex-1 min-w-0">
          <div 
            className="relative comment-bubble p-3 rounded-2xl rounded-tl-none group"
            onDoubleClick={() => setShowReactionPicker(true)}
          >
            <div className="flex justify-between items-center mb-1">
              <span 
                className="font-bold text-sm text-[#E86C44] cursor-pointer hover:underline"
                onClick={(e) => { e.stopPropagation(); onUserClick && onUserClick(comment.user.id); }}
              >
                @{comment.user.handle.replace('@','')}
              </span>
              <span className="text-[10px] text-muted-foreground">{comment.timestamp}</span>
            </div>
            <p className="comment-text mb-2">{comment.content}</p>
            {comment.image && (
              <img src={comment.image} className="rounded-lg max-h-40 object-cover border border-border/50" alt="attachment" />
            )}

            {/* Reactions Display */}
            {comment.reactions && comment.reactions.length > 0 && (
              <div className="absolute -bottom-3 right-2 flex gap-1 bg-card border border-border px-1.5 py-0.5 rounded-full shadow-sm">
                {comment.reactions.map(r => (
                  <span key={r.emoji} className="text-[10px] flex items-center gap-1">
                    {r.emoji} <span className="font-bold text-muted-foreground">{r.count}</span>
                  </span>
                ))}
              </div>
            )}

            {/* Floating Picker */}
            {showReactionPicker && (
              <div className="absolute -top-10 left-0 flex gap-1 bg-card border border-border p-1 rounded-full shadow-xl z-20 animate-in fade-in zoom-in-90">
                {REACTION_EMOJIS.map(emoji => (
                  <button 
                    key={emoji}
                    onClick={() => { onReact(comment.id, emoji); setShowReactionPicker(false); }}
                    className="hover:scale-125 transition-transform px-1"
                  >
                    {emoji}
                  </button>
                ))}
                <button onClick={() => setShowReactionPicker(false)} className="px-1 text-muted-foreground"><i className="fas fa-times text-xs"></i></button>
              </div>
            )}
          </div>
          
          <div className="flex gap-4 mt-2 ml-1">
             <button 
                onClick={() => setShowReplyInput(!showReplyInput)}
                className="text-[11px] font-bold text-muted-foreground hover:text-[#E86C44] transition-colors"
             >
               REPLY
             </button>
             <button 
                onClick={() => setShowReactionPicker(!showReactionPicker)}
                className="text-[11px] font-bold text-muted-foreground hover:text-[#E86C44] transition-colors"
             >
               REACT
             </button>
          </div>

          {showReplyInput && (
            <div className="mt-3 space-y-2 animate-in slide-in-from-top-2 duration-200">
               {replyImage && (
                 <div className="relative inline-block">
                    <img src={replyImage} className="h-20 w-20 rounded-lg object-cover border border-primary/30" />
                    <button onClick={() => setReplyImage(null)} className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full w-4 h-4 flex items-center justify-center text-[10px]"><i className="fas fa-times"></i></button>
                 </div>
               )}
               <form onSubmit={handleReplySubmit} className="flex gap-2 items-center">
                  <div className="flex-1 relative">
                    <input 
                        autoFocus
                        type="text"
                        value={replyText}
                        onChange={(e) => setReplyText(e.target.value)}
                        placeholder="Write a reply..."
                        className="w-full bg-background border border-border rounded-full px-4 py-1.5 pr-20 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-[#E86C44]"
                    />
                    <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                        <button type="button" onClick={() => setShowEmoji(!showEmoji)} className="text-muted-foreground hover:text-primary p-1"><i className="far fa-smile"></i></button>
                        <button type="button" onClick={() => replyFileRef.current?.click()} className="text-muted-foreground hover:text-primary p-1"><i className="fas fa-camera"></i></button>
                    </div>
                  </div>
                  <button type="submit" className="text-[#E86C44] px-2"><i className="fas fa-paper-plane"></i></button>
                  <input type="file" ref={replyFileRef} className="hidden" accept="image/*" onChange={handleImageSelect} />
               </form>
               {showEmoji && (
                  <div className="flex flex-wrap gap-1 bg-card border border-border p-2 rounded-xl">
                      {EMOJIS.map(e => <button key={e} type="button" onClick={() => {setReplyText(p => p + e); setShowEmoji(false);}} className="hover:scale-125 transition-transform p-1">{e}</button>)}
                  </div>
               )}
            </div>
          )}

          {comment.replies && comment.replies.length > 0 && (
            <div className="mt-2">
              {comment.replies.map(reply => (
                <CommentItem 
                  key={reply.id} 
                  comment={reply} 
                  onReply={onReply} 
                  onReact={onReact}
                  depth={depth + 1} 
                  onUserClick={onUserClick}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const ProductDetailModal: React.FC<ProductDetailModalProps> = ({ 
  product, 
  isOpen, 
  onClose, 
  currentUser,
  onAddToCart,
  onShare,
  onUserClick
}) => {
  const { convertPrice, formatPrice, userCurrency } = useCurrency();
  const [comments, setComments] = useState<Comment[]>([]);
  const [localProduct, setLocalProduct] = useState<Product | null>(null);
  const [newComment, setNewComment] = useState('');
  const [commentImage, setCommentImage] = useState<string | null>(null);
  const [showEmoji, setShowEmoji] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (product) {
      setLocalProduct(product);
      // Fetch latest comments from DB
      api.getComments(product.id).then(setComments);
    }
  }, [product]);

  if (!isOpen || !localProduct) return null;

  const updateReactionInTree = (list: Comment[], commentId: string, emoji: string, userId: string): Comment[] => {
    return list.map(c => {
      if (c.id === commentId) {
        const currentReactions = c.reactions || [];
        const existingIdx = currentReactions.findIndex(r => r.emoji === emoji);
        
        let updatedReactions: Reaction[] = [...currentReactions];
        if (existingIdx > -1) {
          const reaction = updatedReactions[existingIdx];
          if (reaction.userIds.includes(userId)) {
            const newUserIds = reaction.userIds.filter(id => id !== userId);
            if (newUserIds.length === 0) {
              updatedReactions = updatedReactions.filter(r => r.emoji !== emoji);
            } else {
              updatedReactions[existingIdx] = { ...reaction, userIds: newUserIds, count: newUserIds.length };
            }
          } else {
            updatedReactions[existingIdx] = { ...reaction, userIds: [...reaction.userIds, userId], count: reaction.count + 1 };
          }
        } else {
          updatedReactions.push({ emoji, count: 1, userIds: [userId] });
        }
        return { ...c, reactions: updatedReactions };
      }
      if (c.replies && c.replies.length > 0) {
        return { ...c, replies: updateReactionInTree(c.replies, commentId, emoji, userId) };
      }
      return c;
    });
  };

  const addCommentToTree = (list: Comment[], parentId: string, newCommentObj: Comment): Comment[] => {
    return list.map(c => {
      if (c.id === parentId) {
        return { ...c, replies: [newCommentObj, ...(c.replies || [])] };
      }
      if (c.replies && c.replies.length > 0) {
        return { ...c, replies: addCommentToTree(c.replies, parentId, newCommentObj) };
      }
      return c;
    });
  };

  const handlePostComment = async (parentId: string | null = null, content: string = newComment, image?: string) => {
    const trimmedContent = content.trim();
    if (!trimmedContent && !image && !commentImage) return;

    const finalImage = image || commentImage;
    
    // Clear inputs immediately for UX
    if (!parentId) {
        setNewComment('');
        setCommentImage(null);
        setShowEmoji(false);
    }

    try {
      const newCommentData = await api.addComment(localProduct.id, trimmedContent, parentId, finalImage || undefined);
      
      // Update state with real data from DB
      if (parentId) {
        setComments(prev => addCommentToTree(prev, parentId, newCommentData));
      } else {
        setComments(prev => [newCommentData, ...prev]);
      }
    } catch (err) {
      console.error("Failed to post comment", err);
      alert("Failed to post comment. Please try again.");
    }
  };

  const handleReactToComment = async (commentId: string, emoji: string) => {
    // Optimistic
    setComments(prev => updateReactionInTree(prev, commentId, emoji, currentUser.id));
    
    try {
        await api.addCommentReaction(localProduct.id, commentId, emoji);
    } catch (e) {
        // Revert on error
        setComments(prev => updateReactionInTree(prev, commentId, emoji, currentUser.id)); 
        console.error(e);
    }
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (ev) => setCommentImage(ev.target?.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleToggleStock = async () => {
      try {
          const newStatus = !localProduct.isOutOfStock;
          await api.toggleStockStatus(localProduct.id, newStatus);
          setLocalProduct(prev => prev ? ({ ...prev, isOutOfStock: newStatus }) : null);
      } catch (e) {
          console.error(e);
          alert("Failed to update stock status.");
      }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="bg-background w-full max-w-2xl h-full md:h-[90vh] md:max-h-[900px] md:rounded-3xl overflow-hidden shadow-2xl flex flex-col animate-in zoom-in-95 duration-300 border border-border">
        
        <div className="absolute top-4 left-4 z-50">
            <button onClick={onClose} className="bg-black/50 hover:bg-black/70 text-white rounded-full w-10 h-10 flex items-center justify-center backdrop-blur-sm transition-all">
                <i className="fas fa-times"></i>
            </button>
        </div>

        <div className="flex-grow overflow-y-auto custom-scrollbar no-scrollbar">
            <div className="w-full bg-black aspect-square md:aspect-video flex items-center justify-center relative">
                {localProduct.isOutOfStock && (
                    <div className="absolute inset-0 bg-black/60 flex items-center justify-center z-10 pointer-events-none">
                        <span className="border-2 border-white text-white font-black text-2xl px-6 py-3 transform -rotate-12 uppercase tracking-widest opacity-80">
                            Out of Stock
                        </span>
                    </div>
                )}
                {localProduct.video ? (
                    <VideoWithWatermark src={localProduct.video} controls containerClassName="h-full w-full" className="h-full w-full object-contain" userId={localProduct.userId} />
                ) : (
                    <img src={localProduct.image} alt={localProduct.name} className="h-full w-full object-contain" />
                )}
            </div>

            <div className="p-6 border-b border-border bg-card/30">
                 <div className="flex justify-between items-start gap-4 mb-4">
                    <div className="flex-1">
                        <h2 className="text-2xl font-bold text-foreground mb-1">{localProduct.name}</h2>
                        <span className={`font-bold text-2xl ${localProduct.isOutOfStock ? 'text-muted-foreground line-through decoration-2' : 'text-[#E86C44]'}`}>
                            {formatPrice(convertPrice(localProduct.price, localProduct.currency), userCurrency)}
                        </span>
                    </div>
                    {localProduct.userId !== currentUser.id ? (
                        <button 
                            onClick={() => !localProduct.isOutOfStock && onAddToCart(localProduct)} 
                            disabled={localProduct.isOutOfStock}
                            className={`px-6 py-3 rounded-full font-bold transition-all shadow-lg flex-shrink-0 ${
                                localProduct.isOutOfStock 
                                ? 'bg-muted-foreground text-white cursor-not-allowed opacity-50' 
                                : 'bg-[#E86C44] text-white hover:brightness-110 shadow-[#E86C44]/20'
                            }`}
                        >
                            {localProduct.isOutOfStock ? 'SOLD OUT' : 'ADD TO CART'}
                        </button>
                    ) : (
                        <button 
                            onClick={handleToggleStock}
                            className={`px-6 py-3 rounded-full font-bold transition-all shadow-lg flex-shrink-0 flex items-center gap-2 ${
                                localProduct.isOutOfStock 
                                ? 'bg-green-600 text-white hover:bg-green-700' 
                                : 'bg-red-500 text-white hover:bg-red-600'
                            }`}
                        >
                            <i className={`fas ${localProduct.isOutOfStock ? 'fa-check-circle' : 'fa-ban'}`}></i>
                            {localProduct.isOutOfStock ? 'MARK AVAILABLE' : 'MARK OUT OF STOCK'}
                        </button>
                    )}
                 </div>
                 <p className="text-muted-foreground text-base leading-relaxed">{localProduct.description}</p>
            </div>

            <div className="px-6 py-4 flex items-center gap-2 border-b border-border sticky top-0 bg-background z-10">
                <span className="text-foreground font-bold text-sm tracking-widest">COMMENTS</span>
                <span className="bg-primary/10 text-primary px-2 py-0.5 rounded-full text-xs font-bold">{comments.length}</span>
            </div>

            <div className="p-6 pb-24">
                {comments.length > 0 ? (
                    comments.map(comment => (
                        <CommentItem 
                          key={comment.id} 
                          comment={comment} 
                          onReply={(pid, content, img) => handlePostComment(pid, content, img)} 
                          onReact={handleReactToComment}
                          onUserClick={onUserClick}
                        />
                    ))
                ) : (
                    <div className="h-40 flex flex-col items-center justify-center text-muted-foreground">
                        <i className="far fa-comments text-4xl mb-3 opacity-20"></i>
                        <p className="text-sm">No comments yet. Start the conversation!</p>
                    </div>
                )}
            </div>
        </div>

        <div className="p-4 md:p-6 border-t border-border bg-card shadow-[0_-10px_30px_rgba(0,0,0,0.05)]">
            <div className="max-w-3xl mx-auto space-y-3">
                {commentImage && (
                    <div className="relative inline-block ml-14">
                        <img src={commentImage} className="h-24 w-24 rounded-xl object-cover border border-primary/30 shadow-md" alt="upload preview" />
                        <button onClick={() => setCommentImage(null)} className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center shadow-md hover:bg-red-600 transition-colors">
                            <i className="fas fa-times text-xs"></i>
                        </button>
                    </div>
                )}
                
                {showEmoji && (
                  <div className="ml-14 flex flex-wrap gap-2 bg-background border border-border p-3 rounded-2xl animate-in fade-in slide-in-from-bottom-2">
                      {EMOJIS.map(e => <button key={e} type="button" onClick={() => {setNewComment(p => p + e); setShowEmoji(false);}} className="text-xl hover:scale-125 transition-transform">{e}</button>)}
                  </div>
                )}

                <form onSubmit={(e) => { e.preventDefault(); handlePostComment(); }} className="flex items-center gap-3">
                    <img src={currentUser.avatar} className="w-10 h-10 rounded-full object-cover border border-border hidden sm:block" alt="Me" />
                    <div className="flex-1 relative group">
                        <input
                            type="text"
                            value={newComment}
                            onChange={(e) => setNewComment(e.target.value)}
                            placeholder="Add a public comment..."
                            className="w-full bg-background text-foreground placeholder:text-muted-foreground rounded-full pl-6 pr-24 py-3 text-sm focus:outline-none focus:ring-1 focus:ring-[#E86C44] border border-border group-hover:border-primary/50 transition-all"
                        />
                        <div className="absolute right-12 top-1/2 -translate-y-1/2 flex items-center gap-1">
                            <button 
                                type="button" 
                                onClick={() => setShowEmoji(!showEmoji)} 
                                className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${showEmoji ? 'text-primary bg-primary/10' : 'text-muted-foreground hover:text-primary hover:bg-muted'}`}
                            >
                                <i className="far fa-smile text-lg"></i>
                            </button>
                            <button 
                                type="button" 
                                onClick={() => fileInputRef.current?.click()} 
                                className="w-8 h-8 rounded-full flex items-center justify-center text-muted-foreground hover:text-primary hover:bg-muted transition-colors"
                            >
                                <i className="fas fa-camera text-base"></i>
                            </button>
                        </div>
                        <button
                            type="submit"
                            disabled={!newComment.trim() && !commentImage}
                            className="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 flex items-center justify-center text-[#E86C44] disabled:opacity-30 transition-opacity"
                        >
                            <i className="fas fa-paper-plane text-lg"></i>
                        </button>
                        <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleImageSelect} />
                    </div>
                </form>
            </div>
        </div>
      </div>
    </div>
  );
};

export default ProductDetailModal;
