
import React, { useEffect, useState } from 'react';
import { CartItem } from '../types';
import { useCurrency } from '../context/useCurrency';

interface CartOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  cartItems: CartItem[];
  onRemoveItem: (id: string) => void;
  onUpdateQuantity: (id: string, newQty: number) => void;
  onCheckout: () => void;
}

const CartOverlay: React.FC<CartOverlayProps> = ({ 
  isOpen, 
  onClose, 
  cartItems, 
  onRemoveItem,
  onUpdateQuantity,
  onCheckout 
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const { userCurrency, convertPrice, formatPrice } = useCurrency();

  useEffect(() => {
    if (isOpen) {
      setIsVisible(true);
    } else {
      const timer = setTimeout(() => setIsVisible(false), 300);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  if (!isVisible && !isOpen) return null;

  // Calculate total in user preferred currency
  const totalAmount = cartItems.reduce((acc, item) => {
      const itemTotal = item.price * item.quantity;
      return acc + convertPrice(itemTotal, item.currency);
  }, 0);

  return (
    <div className={`fixed inset-0 z-[100] transition-opacity duration-300 ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
      <div 
        className="absolute inset-0 bg-black/50 backdrop-blur-sm" 
        onClick={onClose}
      ></div>
      
      {/* Container: Right Sidebar on Desktop, Bottom Sheet on Mobile */}
      <div 
        className={`absolute bg-card shadow-2xl transition-transform duration-300 transform flex flex-col
          md:right-0 md:top-0 md:h-full md:w-full md:max-sm ${isOpen ? 'md:translate-x-0' : 'md:translate-x-full'}
          bottom-0 left-0 right-0 h-[80vh] rounded-t-[24px] md:rounded-none ${isOpen ? 'translate-y-0' : 'translate-y-full'}
        `}
      >
        {/* Handle for Mobile Drag Visual */}
        <div className="w-12 h-1.5 bg-border rounded-full mx-auto mt-3 md:hidden"></div>

        <div className="p-6 border-b border-border flex items-center justify-between">
          <h3 className="text-xl font-bold">Shopping Cart</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground w-8 h-8 flex items-center justify-center rounded-full hover:bg-muted transition-colors">
            <i className="fas fa-times text-lg"></i>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 md:p-6 no-scrollbar">
          {cartItems.length === 0 ? (
            <div className="text-center text-muted-foreground mt-20 flex flex-col items-center">
              <div className="w-20 h-20 bg-muted rounded-full flex items-center justify-center mb-4">
                <i className="fas fa-shopping-basket text-3xl opacity-30"></i>
              </div>
              <p className="font-medium text-lg">Your cart is empty</p>
              <button onClick={onClose} className="mt-4 text-primary font-bold text-sm">Continue Shopping</button>
            </div>
          ) : (
            <div className="space-y-4">
              {cartItems.map((item, idx) => {
                const displayPrice = convertPrice(item.price, item.currency);
                return (
                  <div key={`${item.id}-${idx}`} className="flex items-center space-x-4 p-3 bg-muted/30 rounded-2xl border border-border/50 animate-in fade-in slide-in-from-right-4 duration-300">
                    <img src={item.image} alt={item.name} className="w-20 h-20 object-cover rounded-xl shadow-sm flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <h4 className="font-bold text-sm truncate">{item.name}</h4>
                      <p className="text-xs text-primary font-black mt-1 uppercase tracking-tight">
                          {formatPrice(displayPrice, userCurrency)}
                      </p>
                      
                      {/* Interactive Quantity Stepper */}
                      <div className="flex items-center gap-3 mt-3">
                          <div className="flex items-center border border-border rounded-lg overflow-hidden bg-background shadow-sm">
                              <button 
                                  onClick={() => onUpdateQuantity(item.id, item.quantity - 1)}
                                  className="w-8 h-8 flex items-center justify-center hover:bg-muted transition-colors text-[#E86C44] active:scale-90"
                                  aria-label="Decrease quantity"
                              >
                                  <i className="fas fa-minus text-[10px]"></i>
                              </button>
                              <span className="w-8 text-center text-xs font-black text-foreground">
                                  {item.quantity}
                              </span>
                              <button 
                                  onClick={() => onUpdateQuantity(item.id, item.quantity + 1)}
                                  className="w-8 h-8 flex items-center justify-center hover:bg-muted transition-colors text-[#E86C44] active:scale-90"
                                  aria-label="Increase quantity"
                              >
                                  <i className="fas fa-plus text-[10px]"></i>
                              </button>
                          </div>
                      </div>
                    </div>
                    <button 
                      onClick={() => onRemoveItem(item.id)}
                      className="text-muted-foreground hover:text-destructive p-2 transition-colors active:scale-90"
                      title="Remove item"
                    >
                      <i className="fas fa-trash-alt text-sm"></i>
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="p-6 border-t border-border bg-card/80 backdrop-blur-md pb-safe">
          <div className="space-y-4">
            <div className="flex justify-between items-end">
              <span className="text-muted-foreground font-black text-[10px] uppercase tracking-widest">SUBTOTAL</span>
              <div className="text-right">
                  <div className="text-2xl font-black text-foreground tracking-tighter">
                      {formatPrice(totalAmount, userCurrency)}
                  </div>
              </div>
            </div>
            <button 
              onClick={onCheckout}
              disabled={cartItems.length === 0}
              className={`w-full py-4 rounded-2xl font-black text-xs uppercase tracking-widest transition-all shadow-xl active:scale-[0.98] ${
                cartItems.length === 0 
                  ? 'bg-muted text-muted-foreground cursor-not-allowed shadow-none'
                  : 'bg-primary text-primary-foreground hover:brightness-110 shadow-primary/20'
              }`}
            >
              Checkout Now
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CartOverlay;
