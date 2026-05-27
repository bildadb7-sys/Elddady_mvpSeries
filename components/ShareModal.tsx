
import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';

interface ConvPreview {
  id: string;
  isGroup: boolean;
  name: string;
  avatar?: string;
}

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  productName: string;
  productUrl: string;
  title?: string;
  productId?: string;
  productImage?: string;
  productDescription?: string;
  productPrice?: number;
  productCurrency?: string;
}

const ShareModal: React.FC<ShareModalProps> = ({ isOpen, onClose, productName, productUrl, title, productId, productImage, productDescription, productPrice, productCurrency }) => {
  const [copied, setCopied] = useState(false);
  const [showMsgPicker, setShowMsgPicker] = useState(false);
  const [conversations, setConversations] = useState<ConvPreview[]>([]);
  const [loadingConvs, setLoadingConvs] = useState(false);
  const [sentTo, setSentTo] = useState<Record<string, boolean>>({});
  const [sending, setSending] = useState<string | null>(null);

  const encodedUrl = encodeURIComponent(productUrl);
  const whatsappText = encodeURIComponent(`Check out "${productName}" on Elddady: ${productUrl}`);
  const twitterText = encodeURIComponent(`Check out "${productName}" on Elddady`);

  // Load conversations when picker opens
  useEffect(() => {
    if (!showMsgPicker) return;
    setLoadingConvs(true);
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoadingConvs(false); return; }

      const { data: participations } = await supabase
        .from('conversation_participants')
        .select(`
          conversation_id,
          conversation:conversations(
            id, is_group, group_name, group_photo,
            conversation_participants(user_id, user:profiles!user_id(name, handle, avatar))
          )
        `)
        .eq('user_id', user.id);

      const convs: ConvPreview[] = (participations || []).map((p: any) => {
        const c = p.conversation;
        if (!c) return null;
        if (c.is_group) {
          return { id: c.id, isGroup: true, name: c.group_name || 'Group Chat', avatar: c.group_photo };
        }
        // DM: find the other participant
        const other = c.conversation_participants?.find((cp: any) => cp.user_id !== user.id);
        const otherUser = other?.user;
        return {
          id: c.id,
          isGroup: false,
          name: otherUser?.name || otherUser?.handle || 'User',
          avatar: otherUser?.avatar
        };
      }).filter(Boolean) as ConvPreview[];

      setConversations(convs);
      setLoadingConvs(false);
    })();
  }, [showMsgPicker]);

  const handleSendToConv = async (convId: string) => {
    setSending(convId);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setSending(null); return; }

    // Build rich product card payload if full product data is available
    let shareMessage: string;
    if (productId && productImage && productPrice !== undefined && productCurrency) {
      const payload = {
        id: productId,
        name: productName,
        description: productDescription || '',
        price: productPrice,
        currency: productCurrency,
        image: productImage,
        productUrl: productUrl
      };
      shareMessage = `__PRODUCT_CARD__${JSON.stringify(payload)}`;
    } else {
      shareMessage = `📦 Check out "${productName}" on Elddady!\n🔗 ${productUrl}`;
    }

    await supabase.from('messages').insert({
      conversation_id: convId,
      sender_id: user.id,
      content: shareMessage
    });
    await supabase.from('conversations').update({ last_message_at: new Date().toISOString() }).eq('id', convId);
    setSentTo(prev => ({ ...prev, [convId]: true }));
    setSending(null);
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(productUrl);
    } catch {
      const el = document.createElement('textarea');
      el.value = productUrl;
      document.body.appendChild(el); el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  if (!isOpen) return null;

  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodedUrl}`;

  const shareOptions = [
    {
      name: 'Messages',
      icon: 'fas fa-comments',
      bg: 'bg-[#E86C44]',
      action: () => setShowMsgPicker(true)
    },
    {
      name: 'WhatsApp',
      icon: 'fab fa-whatsapp',
      bg: 'bg-green-500',
      action: () => window.open(`https://wa.me/?text=${whatsappText}`, '_blank')
    },
    {
      name: 'X / Twitter',
      icon: 'fab fa-x-twitter',
      bg: 'bg-black',
      action: () => window.open(`https://twitter.com/intent/tweet?text=${twitterText}&url=${encodedUrl}`, '_blank')
    },
    {
      name: 'Facebook',
      icon: 'fab fa-facebook',
      bg: 'bg-blue-600',
      action: () => window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`, '_blank')
    },
  ];

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={(e) => { if (e.target === e.currentTarget) { setShowMsgPicker(false); onClose(); } }}
    >
      <div className="bg-card w-full max-w-sm rounded-2xl shadow-2xl border border-border animate-in zoom-in-95 duration-200 overflow-hidden">

        {/* Header */}
        <div className="flex justify-between items-center px-6 py-4 border-b border-border bg-muted/30">
          <div>
            {showMsgPicker
              ? <button onClick={() => setShowMsgPicker(false)} className="flex items-center gap-2 font-black text-sm uppercase tracking-tight hover:text-[#E86C44] transition-colors">
                  <i className="fas fa-arrow-left text-xs"></i> Back
                </button>
              : <>
                  <h3 className="font-black text-base uppercase tracking-tight">{title || 'Share'}</h3>
                  <p className="text-[10px] text-muted-foreground font-medium truncate max-w-[220px]">{productName}</p>
                </>
            }
          </div>
          <button onClick={() => { setShowMsgPicker(false); onClose(); }} className="w-8 h-8 rounded-full bg-background border border-border flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors">
            <i className="fas fa-times text-sm"></i>
          </button>
        </div>

        {/* In-App Message Picker */}
        {showMsgPicker ? (
          <div className="p-4 max-h-[420px] overflow-y-auto space-y-2">
            <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-3">Send to a chat or group</p>
            {loadingConvs && (
              <div className="flex justify-center py-10">
                <i className="fas fa-spinner fa-spin text-[#E86C44] text-xl"></i>
              </div>
            )}
            {!loadingConvs && conversations.length === 0 && (
              <p className="text-center py-8 text-muted-foreground font-bold text-sm">No conversations found.</p>
            )}
            {conversations.map(conv => (
              <div key={conv.id} className="flex items-center gap-3 p-3 rounded-xl border border-border hover:border-[#E86C44]/40 hover:bg-muted/20 transition-all">
                {/* Avatar */}
                {conv.avatar
                  ? <img src={conv.avatar} className="w-10 h-10 rounded-full object-cover shrink-0" />
                  : <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${conv.isGroup ? 'bg-purple-500' : 'bg-[#E86C44]'} text-white font-black text-sm`}>
                      <i className={`fas ${conv.isGroup ? 'fa-users' : 'fa-user'} text-xs`}></i>
                    </div>
                }
                <div className="flex-1 min-w-0">
                  <p className="font-black text-sm truncate">{conv.name}</p>
                  <p className="text-[10px] text-muted-foreground font-medium">{conv.isGroup ? 'Group Chat' : 'Direct Message'}</p>
                </div>
                <button
                  onClick={() => handleSendToConv(conv.id)}
                  disabled={!!sentTo[conv.id] || sending === conv.id}
                  className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shrink-0 ${
                    sentTo[conv.id]
                      ? 'bg-green-100 text-green-700 border border-green-200'
                      : 'bg-[#E86C44] text-white hover:bg-[#d6623e] active:scale-95 shadow-sm'
                  }`}
                >
                  {sending === conv.id
                    ? <i className="fas fa-spinner fa-spin"></i>
                    : sentTo[conv.id] ? <><i className="fas fa-check mr-1"></i>Sent!</>
                    : 'Send'}
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-6 space-y-6">
            {/* Share Buttons */}
            <div className="grid grid-cols-4 gap-3">
              {shareOptions.map((opt) => (
                <button key={opt.name} onClick={opt.action} className="flex flex-col items-center gap-2 group">
                  <div className={`w-12 h-12 ${opt.bg} text-white rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform shadow-lg`}>
                    <i className={`${opt.icon} text-lg`}></i>
                  </div>
                  <span className="text-[9px] font-black text-muted-foreground uppercase tracking-wide">{opt.name}</span>
                </button>
              ))}
            </div>

            {/* QR Code */}
            <div className="flex flex-col items-center py-4 bg-white rounded-2xl border border-border/50">
              <img src={qrCodeUrl} alt="QR Code" className="w-36 h-36 object-contain" />
              <p className="text-[10px] text-muted-foreground mt-2 font-bold uppercase tracking-widest">Scan to Open</p>
            </div>

            {/* Copy Link */}
            <div className="flex items-center gap-2 p-3 border-2 border-border rounded-xl bg-muted/20 focus-within:border-[#E86C44] transition-colors">
              <i className="fas fa-link text-muted-foreground text-sm ml-1"></i>
              <input
                type="text" readOnly value={productUrl}
                className="flex-1 bg-transparent text-sm text-foreground outline-none truncate font-medium"
                onClick={(e) => (e.target as HTMLInputElement).select()}
              />
              <button
                onClick={handleCopy}
                className={`px-4 py-1.5 rounded-lg text-xs font-black uppercase tracking-widest transition-all shadow-sm ${copied
                  ? 'bg-green-500 text-white'
                  : 'bg-[#E86C44] text-white hover:bg-[#d6623e]'}`}
              >
                {copied ? <><i className="fas fa-check mr-1"></i>Copied!</> : 'Copy'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ShareModal;
