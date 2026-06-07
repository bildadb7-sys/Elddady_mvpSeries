
import React, { useState, useEffect, useRef } from 'react';
import { api } from '../api';
import { CartItem, DetailedDispute } from '../types';
import TagManager from './TagManager';
import { applyWatermark } from '../utils/imageProcessor';
import { useCurrency } from '../context/useCurrency';
import { VideoWithWatermark } from './VideoWithWatermark';
import { CURRENT_USER } from '../constants';

// --- File Dispute Modal ---

interface FileDisputeModalProps {
  isOpen: boolean;
  onClose: () => void;
  orderId: string;
  onSubmitted: () => void;
}

export const FileDisputeModal: React.FC<FileDisputeModalProps> = ({ isOpen, onClose, orderId, onSubmitted }) => {
  const [claims, setClaims] = useState('');
  const [photos, setPhotos] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const photoInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) {
      Array.from(files).forEach((file: File) => {
        const reader = new FileReader();
        reader.onload = (ev) => {
          if (ev.target?.result) {
            setPhotos(prev => [...prev, ev.target!.result as string]);
          }
        };
        reader.readAsDataURL(file);
      });
    }
  };

  const removePhoto = (index: number) => {
    setPhotos(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!claims.trim()) return alert("Please provide details for your claim.");

    setIsSubmitting(true);
    try {
      await api.disputeOrder(orderId, claims, photos);
      alert("Dispute filed successfully. Support will contact you shortly.");
      onSubmitted();
      onClose();
    } catch (e) {
      alert("Failed to file dispute.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-[110] flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="bg-card rounded-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto shadow-2xl animate-in zoom-in-95 duration-300">
        <div className="flex items-center justify-between p-6 border-b border-border sticky top-0 bg-card z-10">
          <h3 className="text-xl font-black tracking-tight flex items-center gap-2">
            <i className="fas fa-exclamation-triangle text-[#E86C44]"></i> FILE A DISPUTE
          </h3>
          <button onClick={onClose} className="p-2 hover:bg-muted rounded-full">
            <i className="fas fa-times"></i>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          <div className="bg-blue-50 border border-blue-100 p-4 rounded-xl text-blue-900 text-sm">
            <p className="font-bold mb-1">Dispute for Order #{orderId.slice(-6)}</p>
            <p className="opacity-80 leading-relaxed">Provide as much detail as possible to speed up the investigation. Your funds are currently safe in escrow.</p>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-bold text-foreground">CLAIM DETAILS & EVIDENCE SUMMARY</label>
            <textarea
              required
              value={claims}
              onChange={(e) => setClaims(e.target.value)}
              placeholder="What went wrong? (e.g., Damaged items, Missing parts, Counterfeit, etc.)"
              className="w-full px-4 py-3 bg-background border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-[#E86C44] min-h-[150px] text-sm leading-relaxed"
            />
          </div>

          <div className="space-y-3">
            <label className="text-sm font-bold text-foreground">NECESSARY PHOTOS (MAX 5)</label>
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-3">
              {photos.map((p, idx) => (
                <div key={idx} className="relative aspect-square rounded-lg overflow-hidden border border-border bg-muted">
                  <img src={p} className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() => removePhoto(idx)}
                    className="absolute top-1 right-1 bg-black/50 text-white w-5 h-5 rounded-full flex items-center justify-center text-[10px]"
                  >
                    <i className="fas fa-times"></i>
                  </button>
                </div>
              ))}
              {photos.length < 5 && (
                <button
                  type="button"
                  onClick={() => photoInputRef.current?.click()}
                  className="aspect-square rounded-lg border-2 border-dashed border-border flex flex-col items-center justify-center text-muted-foreground hover:border-[#E86C44] hover:text-[#E86C44] transition-all"
                >
                  <i className="fas fa-camera text-lg mb-1"></i>
                  <span className="text-[10px] font-bold">ADD PHOTO</span>
                </button>
              )}
            </div>
            <input type="file" ref={photoInputRef} multiple accept="image/*" onChange={handlePhotoUpload} className="hidden" />
          </div>

          <div className="pt-4 flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-3 border border-border rounded-xl font-bold text-sm hover:bg-muted transition-colors"
            >
              CANCEL
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-[2] px-4 py-3 bg-[#E86C44] text-white rounded-xl font-black text-sm tracking-widest hover:brightness-110 shadow-lg shadow-[#E86C44]/20 transition-all flex items-center justify-center gap-2"
            >
              {isSubmitting ? <i className="fas fa-circle-notch fa-spin"></i> : <i className="fas fa-paper-plane"></i>}
              SUBMIT DISPUTE
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// --- Review Dispute Modal ---

interface ReviewDisputeModalProps {
  isOpen: boolean;
  onClose: () => void;
  orderId: string;
  onWithdrawn: () => void;
}

export const ReviewDisputeModal: React.FC<ReviewDisputeModalProps> = ({ isOpen, onClose, orderId, onWithdrawn }) => {
  const [dispute, setDispute] = useState<DetailedDispute | null>(null);
  const [loading, setLoading] = useState(true);
  const [timeLeft, setTimeLeft] = useState<string>('');
  const [isWithdrawing, setIsWithdrawing] = useState(false);

  useEffect(() => {
    if (isOpen) {
      const fetchDispute = async () => {
        try {
          const d = await api.getDisputeByOrderId(orderId);
          setDispute(d);
        } finally {
          setLoading(false);
        }
      };
      fetchDispute();
    }
  }, [isOpen, orderId]);

  useEffect(() => {
    if (!dispute) return;
    const interval = setInterval(() => {
      const submissionTime = new Date(dispute.timestamp).getTime();
      const now = Date.now();
      const thirtyMinutes = 30 * 60 * 1000;
      const elapsed = now - submissionTime;
      const remaining = thirtyMinutes - elapsed;

      if (remaining <= 0) {
        setTimeLeft('Window closed');
        clearInterval(interval);
      } else {
        const mins = Math.floor(remaining / 60000);
        const secs = Math.floor((remaining % 60000) / 1000);
        setTimeLeft(`${mins}:${secs.toString().padStart(2, '0')} remaining`);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [dispute]);

  if (!isOpen) return null;

  const handleWithdraw = async () => {
    const confirmed = window.confirm("Are you sure you want to withdraw this dispute? You will be able to confirm delivery and release funds to the seller immediately after.");
    if (!confirmed) return;

    setIsWithdrawing(true);
    try {
      await api.cancelDispute(orderId);
      alert("Dispute withdrawn. The order status has been restored.");
      onWithdrawn();
      onClose();
    } catch (e) {
      alert("Failed to withdraw dispute. Please try again.");
    } finally {
      setIsWithdrawing(false);
    }
  };

  const isWindowExpired = timeLeft === 'Window closed';

  return (
    <div className="fixed inset-0 bg-black/60 z-[110] flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="bg-card rounded-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto shadow-2xl animate-in zoom-in-95 duration-300">
        <div className="flex items-center justify-between p-6 border-b border-border sticky top-0 bg-card z-10">
          <h3 className="text-xl font-black tracking-tight flex items-center gap-2 uppercase">
            <i className="fas fa-search text-primary"></i> Review My Dispute
          </h3>
          <button onClick={onClose} className="p-2 hover:bg-muted rounded-full transition-colors">
            <i className="fas fa-times text-lg"></i>
          </button>
        </div>

        {loading ? (
          <div className="p-20 text-center flex flex-col items-center gap-4">
            <i className="fas fa-circle-notch fa-spin text-3xl text-primary"></i>
            <p className="text-sm font-bold text-muted-foreground animate-pulse">Loading claim details...</p>
          </div>
        ) : !dispute ? (
          <div className="p-20 text-center flex flex-col items-center gap-3">
            <i className="fas fa-ghost text-4xl text-muted-foreground opacity-20"></i>
            <p className="text-sm font-medium text-muted-foreground">No active dispute found for this order.</p>
            <button onClick={onClose} className="mt-4 text-primary font-bold hover:underline">Go Back</button>
          </div>
        ) : (
          <div className="p-6 space-y-6">
            {/* Status Card */}
            <div className="flex justify-between items-center bg-zinc-50 border border-zinc-100 p-5 rounded-2xl shadow-sm">
              <div>
                <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-1">Withdraw Window</p>
                <div className={`flex items-center gap-2 text-sm font-black ${isWindowExpired ? 'text-zinc-400' : 'text-[#E86C44]'}`}>
                  {!isWindowExpired && <i className="fas fa-clock animate-pulse"></i>}
                  {timeLeft}
                </div>
              </div>
              <div className="text-right">
                <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-1">Submitted On</p>
                <p className="text-sm font-bold text-zinc-600">{new Date(dispute.timestamp).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}</p>
              </div>
            </div>

            {/* Claims Section */}
            <div className="space-y-2">
              <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">My Stated Claims</label>
              <div className="text-zinc-900 font-medium leading-relaxed bg-zinc-50 p-5 rounded-2xl border border-zinc-100 italic">
                "{dispute.claims}"
              </div>
            </div>

            {/* Photos Section */}
            {dispute.evidencePhotos.length > 0 && (
              <div className="space-y-2">
                <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">Evidence Photos ({dispute.evidencePhotos.length})</label>
                <div className="flex flex-wrap gap-3">
                  {dispute.evidencePhotos.map((p, i) => (
                    <div key={i} className="group relative w-20 h-20 rounded-xl overflow-hidden border border-zinc-200 shadow-sm cursor-zoom-in">
                      <img src={p} className="w-full h-full object-cover transition-transform group-hover:scale-110" />
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                        <i className="fas fa-search-plus text-white opacity-0 group-hover:opacity-100 text-xs"></i>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="pt-4 flex flex-col gap-3">
              {!isWindowExpired && (
                <button
                  onClick={handleWithdraw}
                  disabled={isWithdrawing}
                  className="w-full py-4 bg-[#E86C44] text-white rounded-xl font-black text-xs tracking-widest hover:brightness-110 shadow-lg shadow-[#E86C44]/20 transition-all flex items-center justify-center gap-2 active:scale-[0.98]"
                >
                  {isWithdrawing ? <i className="fas fa-circle-notch fa-spin"></i> : <i className="fas fa-undo"></i>}
                  WITHDRAW DISPUTE & RESTORE ORDER
                </button>
              )}

              <button
                onClick={onClose}
                className="w-full py-3 border border-border rounded-xl font-bold text-xs tracking-widest hover:bg-muted transition-colors uppercase text-zinc-600"
              >
                Keep Dispute Open
              </button>

              {isWindowExpired ? (
                <div className="bg-amber-50 border border-amber-100 p-4 rounded-xl flex items-start gap-3">
                  <i className="fas fa-info-circle text-amber-500 mt-0.5"></i>
                  <p className="text-[10px] text-amber-800 font-medium leading-relaxed">
                    The 30-minute self-review window has expired. Your dispute is now being formally reviewed by our safety team. You can no longer withdraw it manually.
                  </p>
                </div>
              ) : (
                <p className="text-[10px] text-center text-muted-foreground italic font-medium">
                  Withdrawing will cancel the investigation and restore your ability to confirm delivery.
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// --- Checkout Modal ---

interface CheckoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  cartItems: CartItem[];
}

export const CheckoutModal: React.FC<CheckoutModalProps> = ({ isOpen, onClose, onConfirm, cartItems }) => {
  const [step, setStep] = useState(1);
  const [isProcessing, setIsProcessing] = useState(false);
  const [walletBalance, setWalletBalance] = useState(0);
  const [shippingData, setShippingData] = useState({
    recipientName: '',
    country: '',
    state: '',
    city: '',
    street: ''
  });

  const { userCurrency, convertPrice, formatPrice } = useCurrency();

  // Fetch balance on open
  useEffect(() => {
    if (isOpen) {
      api.getMe().then(user => setWalletBalance(user.walletBalance || 0));
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleShippingChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setShippingData(prev => ({ ...prev, [name]: value }));
  };

  const handleNext = () => {
    // Basic validation logic
    if (!shippingData.recipientName || !shippingData.country || !shippingData.street) {
      alert("Please fill in the required shipping fields.");
      return;
    }
    setStep(2);
  };

  const calculateTotal = () => {
    return cartItems.reduce((sum, item) => {
      // Convert each item to user currency for accurate total display
      const itemTotal = item.price * item.quantity;
      const convertedTotal = convertPrice(itemTotal, item.currency);
      return sum + convertedTotal;
    }, 0);
  };

  const totalAmount = calculateTotal();
  const hasSufficientFunds = walletBalance >= totalAmount;

  const handleSubmit = async () => {
    if (!hasSufficientFunds) {
      alert("Insufficient funds. Please fund your Cashy Wallet.");
      return;
    }

    setIsProcessing(true);

    try {
      // Create an individual order for EACH item to ensure each product
      // is recorded individually in the database and ledger
      for (const item of cartItems) {
        await api.createOrder([item], shippingData);
      }

      // Notify each seller via the messaging system
      const me = await api.getMe();
      await api.notifySellerOnCheckout(cartItems, me.name || 'A buyer');

      // Default to success for user experience
      onConfirm(); // This just clears the cart in parent
      setStep(3); // Move to tracking/success
    } catch (e: any) {
      alert(`Failed to place order: ${e.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleClose = () => {
    setStep(1);
    onClose();
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4">
      <div className="bg-card rounded-xl p-6 max-w-lg w-full max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in duration-200">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-semibold">
            {step === 1 ? 'Shipping Details' : step === 2 ? 'Cashy Wallet Payment' : 'Order Placed'}
          </h3>
          <button onClick={handleClose} className="text-muted-foreground hover:text-foreground">
            <i className="fas fa-times text-xl"></i>
          </button>
        </div>

        {/* Steps Indicator */}
        <div className="flex items-center mb-6 text-sm">
          <div className={`flex items-center gap-2 ${step === 1 ? 'text-primary font-bold' : 'text-muted-foreground'}`}>
            <div className={`w-6 h-6 rounded-full flex items-center justify-center border ${step >= 1 ? 'border-primary bg-primary text-white' : 'border-muted-foreground'}`}>
              {step > 1 ? <i className="fas fa-check text-xs"></i> : '1'}
            </div>
            Shipping
          </div>
          <div className={`w-10 h-[1px] mx-2 ${step > 1 ? 'bg-primary' : 'bg-border'}`}></div>
          <div className={`flex items-center gap-2 ${step === 2 ? 'text-primary font-bold' : 'text-muted-foreground'}`}>
            <div className={`w-6 h-6 rounded-full flex items-center justify-center border ${step >= 2 ? 'border-primary bg-primary text-white' : 'border-muted-foreground'}`}>
              {step > 2 ? <i className="fas fa-check text-xs"></i> : '2'}
            </div>
            Wallet
          </div>
          <div className={`w-10 h-[1px] mx-2 ${step > 2 ? 'bg-primary' : 'bg-border'}`}></div>
          <div className={`flex items-center gap-2 ${step === 3 ? 'text-primary font-bold' : 'text-muted-foreground'}`}>
            <div className={`w-6 h-6 rounded-full flex items-center justify-center border ${step >= 3 ? 'border-primary bg-primary text-white' : 'border-muted-foreground'}`}>3</div>
            Success
          </div>
        </div>

        {step === 1 && (
          <div className="space-y-4 animate-in slide-in-from-right duration-200">
            <div>
              <label className="block text-sm font-medium mb-1">Recipient Name <span className="text-xs text-muted-foreground">(As in official documents)</span></label>
              <input
                type="text"
                name="recipientName"
                value={shippingData.recipientName}
                onChange={handleShippingChange}
                placeholder="Full legal name"
                className="w-full px-4 py-2 border border-input rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Country</label>
              <select
                name="country"
                value={shippingData.country}
                onChange={handleShippingChange}
                className="w-full px-4 py-2 border border-input rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="">Select Country</option>
                <option value="United States">United States</option>
                <option value="United Kingdom">United Kingdom</option>
                <option value="Canada">Canada</option>
                <option value="Kenya">Kenya</option>
                <option value="Nigeria">Nigeria</option>
                <option value="South Africa">South Africa</option>
                <option value="India">India</option>
                <option value="China">China</option>
                <option value="Australia">Australia</option>
              </select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">County/State/Province</label>
                <input
                  type="text"
                  name="state"
                  value={shippingData.state}
                  onChange={handleShippingChange}
                  placeholder="State"
                  className="w-full px-4 py-2 border border-input rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">City/Town</label>
                <input
                  type="text"
                  name="city"
                  value={shippingData.city}
                  onChange={handleShippingChange}
                  placeholder="City"
                  className="w-full px-4 py-2 border border-input rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Street Address</label>
              <textarea
                name="street"
                value={shippingData.street}
                onChange={handleShippingChange}
                placeholder="Street, Apartment, Suite, Unit, etc."
                className="w-full px-4 py-2 border border-input rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary h-20 resize-none"
              ></textarea>
            </div>

            <div className="flex space-x-3 pt-4">
              <button
                onClick={handleClose}
                className="flex-1 border border-border py-2 px-4 rounded-lg text-foreground hover:bg-muted transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleNext}
                className="flex-1 bg-primary text-primary-foreground py-2 px-4 rounded-lg hover:bg-primary/90 transition-colors font-medium"
              >
                Next
              </button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4 animate-in slide-in-from-right duration-200">
            <div className="bg-muted/30 p-4 rounded-lg mb-4 border border-border">
              <div className="flex justify-between items-start text-sm">
                <div>
                  <p className="font-bold">{shippingData.recipientName || "Recipient"}</p>
                  <p className="text-muted-foreground">{shippingData.street}</p>
                  <p className="text-muted-foreground">{shippingData.city}, {shippingData.state}, {shippingData.country}</p>
                </div>
                <button onClick={() => setStep(1)} className="text-primary text-xs font-bold hover:underline">Edit</button>
              </div>
            </div>

            <div className="bg-gradient-to-r from-blue-600 to-blue-800 text-white rounded-xl p-6 shadow-md">
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-medium opacity-80">My Wallet Balance</span>
                <i className="fas fa-wallet opacity-80"></i>
              </div>
              <div className="text-3xl font-bold">{formatPrice(walletBalance, userCurrency)}</div>
            </div>

            <div className="flex justify-between items-center py-2 border-b border-border">
              <span className="font-medium">Order Total</span>
              <span className="font-bold text-xl">{formatPrice(totalAmount, userCurrency)}</span>
            </div>

            {!hasSufficientFunds && (
              <div className="bg-red-100 border border-red-200 text-red-700 p-3 rounded-lg text-sm flex items-center gap-2">
                <i className="fas fa-exclamation-circle"></i>
                <span>Insufficient funds. Please fund your wallet in Profile.</span>
              </div>
            )}

            {hasSufficientFunds && (
              <div className="bg-green-50 border border-green-200 text-green-700 p-3 rounded-lg text-xs flex items-center gap-2">
                <i className="fas fa-lock"></i>
                <span>Funds will be held in Central Pool Escrow until delivery is confirmed.</span>
              </div>
            )}

            <div className="flex space-x-3 pt-4">
              <button
                onClick={() => setStep(1)}
                className="flex-1 border border-border py-2 px-4 rounded-lg text-foreground hover:bg-muted transition-colors"
                disabled={isProcessing}
              >
                Back
              </button>
              <button
                onClick={handleSubmit}
                disabled={isProcessing || !hasSufficientFunds}
                className={`flex-1 py-2 px-4 rounded-lg font-bold shadow-md flex items-center justify-center gap-2 transition-colors ${hasSufficientFunds
                    ? 'bg-green-600 text-white hover:bg-green-700'
                    : 'bg-muted text-muted-foreground cursor-not-allowed'
                  }`}
              >
                {isProcessing ? (
                  <>Processing...</>
                ) : (
                  <><i className="fas fa-check-circle text-xs"></i> Pay & Place Order</>
                )}
              </button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-6 text-center animate-in fade-in zoom-in">
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto text-green-600 shadow-sm animate-bounce">
              <i className="fas fa-box-open text-3xl"></i>
            </div>
            <div>
              <h3 className="text-2xl font-bold mb-1">Order Placed!</h3>
              <p className="text-muted-foreground text-sm">Funds have been deducted and are held in Central Pool Escrow.</p>
            </div>

            {/* Info Box Matching Annotation */}
            <div className="bg-blue-50 border-2 border-blue-200 p-5 rounded-xl text-left text-sm text-blue-900 shadow-sm">
              <p className="font-bold mb-2 flex items-center gap-2 text-base">
                <i className="fas fa-info-circle text-blue-600"></i> What happens next?
              </p>
              <ul className="list-disc list-inside space-y-2 opacity-90 text-sm pl-1">
                <li>The seller has been notified to ship your items.</li>
                <li>Once you receive the items, go to your <span className="font-bold text-blue-700">Profile &gt; Cashy Wallet &gt; Orders</span> to confirm delivery.</li>
                <li>Confirming delivery releases the funds to the seller.</li>
              </ul>
            </div>

            <div className="pt-2">
              <button onClick={handleClose} className="w-full bg-[#E86C44] text-white py-3 rounded-lg font-bold hover:bg-[#d6623e] transition-colors shadow-md">
                Close
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};


// --- Post Product Modal ---

interface PostModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: any) => void;
}

export const PostModal: React.FC<PostModalProps> = ({ isOpen, onClose, onSubmit }) => {
  const { availableCurrencies, userCurrency } = useCurrency();
  const [currency, setCurrency] = useState(userCurrency || 'USD');
  const [userHandle, setUserHandle] = useState<string>('');

  useEffect(() => {
    if (userCurrency) {
      setCurrency(userCurrency);
    }
  }, [userCurrency]);

  // Fetch current user's handle for watermark
  useEffect(() => {
    if (isOpen) {
      api.getMe().then(me => setUserHandle(me.handle || '')).catch(() => {});
    }
  }, [isOpen]);

  const [name, setName] = useState('');
  const [category, setCategory] = useState('Electronics & Technology');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [media, setMedia] = useState<string | null>(null);
  const [mediaList, setMediaList] = useState<string[]>([]);
  const [mediaType, setMediaType] = useState<'image' | 'video'>('image');
  const [isWatermarking, setIsWatermarking] = useState(false);

  // Tagging State (Managed via TagManager)
  const [finalTags, setFinalTags] = useState<{ tag: string, weight: number }[]>([]);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const categories = [
    'Electronics & Technology',
    'Fashion & Apparel',
    'Home, Garden & Living',
    'Health & Beauty',
    'Sports & Outdoors',
    'Toys, Kids & Baby',
    'Others'
  ];

  if (!isOpen) return null;

  const handleSubmit = () => {
    // Basic validation
    if (!name || !price || !description) {
      alert("Please fill in all required fields.");
      return;
    }

    const finalMediaList = mediaList.length > 0 && media 
      ? [media, ...mediaList.filter(m => m !== media)] 
      : mediaList;

    onSubmit({
      name,
      description,
      price,
      currency,
      media,
      mediaList: finalMediaList,
      mediaType,
      category,
      tags: finalTags
    });

    // Reset form
    setName('');
    setDescription('');
    setPrice('');
    setCurrency('USD');
    setMedia(null);
    setMediaList([]);
    setMediaType('image');
    setCategory('Electronics & Technology');
    setFinalTags([]);
    onClose();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    if (files[0].type.startsWith('image/')) {
        // If they had a video before, reset it
        if (mediaType === 'video') {
            setMediaList([]);
            setMedia(null);
            setMediaType('image');
        }

        const currentCount = mediaType === 'video' ? 0 : mediaList.length;
        if (currentCount + files.length > 3) {
            alert("You can upload a maximum of 3 images total.");
            e.target.value = '';
            return;
        }

        setIsWatermarking(true);
        try {
            const newMediaList: string[] = [];
            for (let i = 0; i < files.length; i++) {
                const file = files[i];
                if (!file.type.startsWith('image/')) {
                    alert("Please select only images or one video.");
                    return;
                }
                if (file.size > 10 * 1024 * 1024) { // 10MB limit
                    alert(`Image ${file.name} exceeds 10MB limit.`);
                    return;
                }
                const watermarkedBlob = await applyWatermark(file, userHandle || undefined);
                const reader = new FileReader();
                const base64 = await new Promise<string>((resolve) => {
                    reader.onload = (ev) => resolve(ev.target?.result as string);
                    reader.readAsDataURL(watermarkedBlob);
                });
                newMediaList.push(base64);
            }
            
            
            setMediaList(prev => {
                const combined = mediaType === 'video' ? newMediaList : [...prev, ...newMediaList];
                if (!media) setMedia(combined[0]);
                return combined;
            });
            setMediaType('image');
        } catch (err) {
            console.error(err);
            alert("Failed to apply watermark.");
        } finally {
            setIsWatermarking(false);
            e.target.value = ''; // Reset input
        }
    } else if (files[0].type.startsWith('video/')) {
      const file = files[0];
      if (file.size > 15 * 1024 * 1024) { // 15MB limit
        alert("Video size exceeds 15MB limit.");
        e.target.value = '';
        return;
      }
      // Video handling remains direct
      const reader = new FileReader();
      reader.onload = (ev) => {
        if (ev.target?.result) {
          setMedia(ev.target.result as string);
          setMediaList([]);
          setMediaType('video');
        }
      };
      reader.readAsDataURL(file);
      e.target.value = ''; // Reset input
    }
  };

  const handleClose = () => {
    setMedia(null);
    setMediaList([]);
    setMediaType('image');
    setCategory('Electronics & Technology');
    setFinalTags([]);
    onClose();
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-card rounded-xl p-6 max-w-lg w-full max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in duration-200">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-semibold">Post New Product</h3>
          <button onClick={handleClose} className="text-muted-foreground hover:text-foreground">
            <i className="fas fa-times text-xl"></i>
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">Product Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter product name..."
              className="w-full px-4 py-2 border border-input rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Category</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full px-4 py-2 border border-input rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-ring"
            >
              {categories.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe your product thoroughly to get better auto-tags (e.g. 'Vintage blue leather jacket with silver zipper')"
              className="w-full px-4 py-2 border border-input rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-ring h-24 resize-none"
            ></textarea>
          </div>

          {/* New Tag Manager Component */}
          <TagManager
            description={description}
            tags={finalTags}
            onTagsChange={setFinalTags}
          />

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">Price</label>
              <input
                type="number"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="0.00"
                step="0.01"
                className="w-full px-4 py-2 border border-input rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Currency</label>
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className="w-full px-4 py-2 border border-input rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-ring"
              >
                {availableCurrencies.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Media</label>
            <div
              className="border-2 border-dashed border-input rounded-lg p-8 text-center hover:border-primary transition-colors cursor-pointer relative flex flex-col items-center justify-center min-h-[150px]"
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                type="file"
                ref={fileInputRef}
                className="hidden"
                accept="image/*,video/*"
                multiple
                onChange={handleFileChange}
              />

              {isWatermarking ? (
                <div className="flex flex-col items-center">
                  <i className="fas fa-circle-notch fa-spin text-2xl text-primary mb-2"></i>
                  <p className="text-sm font-bold text-primary">Applying Protection...</p>
                </div>
              ) : mediaList.length > 0 && mediaType === 'image' ? (
                <div className="w-full h-full relative flex flex-col p-2">
                    <div className="flex gap-2 justify-center flex-wrap">
                        {mediaList.map((m, idx) => (
                            <div key={idx} className={`relative cursor-pointer border-4 ${media === m ? 'border-primary' : 'border-transparent'}`} onClick={(e) => { e.stopPropagation(); setMedia(m); }}>
                                <img src={m} alt={`Preview ${idx}`} className="h-32 w-32 object-cover rounded" />
                                {media === m && <div className="absolute top-1 left-1 bg-primary text-white text-[10px] px-1 rounded font-bold shadow-md">MAIN VIEW</div>}
                                <button type="button" className="absolute -top-3 -right-3 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center shadow-lg hover:bg-red-600 z-10" onClick={(e) => { 
                                    e.stopPropagation(); 
                                    const newList = mediaList.filter((_, i) => i !== idx);
                                    setMediaList(newList);
                                    if (media === m) setMedia(newList[0] || null);
                                }}>
                                    <i className="fas fa-times text-xs"></i>
                                </button>
                            </div>
                        ))}
                        {mediaList.length < 3 && (
                            <div className="h-32 w-32 border-2 border-dashed border-input rounded flex flex-col items-center justify-center cursor-pointer hover:border-primary hover:bg-primary/5 transition-colors" onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}>
                                <i className="fas fa-plus text-2xl text-muted-foreground mb-1"></i>
                                <span className="text-xs text-muted-foreground font-semibold">Add Image</span>
                            </div>
                        )}
                    </div>
                  <div className="absolute top-0 right-0 bg-black/50 text-white rounded-full p-1 hover:bg-black/70 cursor-pointer hidden" onClick={(e) => { e.stopPropagation(); setMediaList([]); setMedia(null); }}>
                    <i className="fas fa-times"></i>
                  </div>
                </div>
              ) : media && mediaType === 'video' ? (
                <div className="w-full h-full relative">
                  <VideoWithWatermark src={media} className="max-h-48 w-full object-contain rounded" controls={false} userId={CURRENT_USER.id} />
                  <div className="absolute top-2 right-2 bg-black/50 text-white rounded-full p-1 hover:bg-black/70" onClick={(e) => { e.stopPropagation(); setMedia(null); }}>
                    <i className="fas fa-times"></i>
                  </div>
                </div>
              ) : (
                <>
                  <i className="fas fa-cloud-upload-alt text-2xl text-muted-foreground mb-2"></i>
                  <p className="text-muted-foreground">Click to upload up to 3 images or 1 video</p>
                  <p className="text-xs text-muted-foreground mt-1">Images up to 10MB, Video up to 15MB</p>
                </>
              )}
            </div>
          </div>

          <div className="flex space-x-3 pt-4">
            <button
              onClick={handleClose}
              className="flex-1 border border-border py-2 px-4 rounded-lg text-foreground hover:bg-muted transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              className="flex-1 bg-primary text-primary-foreground py-2 px-4 rounded-lg hover:bg-primary/90 transition-colors"
            >
              Post Product
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// --- Forward Message Modal ---

interface ForwardMessageModalProps {
  isOpen: boolean;
  onClose: () => void;
  message: any | null;
  conversations: any[];
  onForward: (conversationId: string, message: any) => Promise<void>;
}

export const ForwardMessageModal: React.FC<ForwardMessageModalProps> = ({ isOpen, onClose, message, conversations, onForward }) => {
  const [isForwarding, setIsForwarding] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  if (!isOpen || !message) return null;

  const filtered = conversations.filter(c => {
    const name = c.isGroup ? c.groupName : c.user?.name;
    return name?.toLowerCase().includes(searchQuery.toLowerCase());
  });

  const handleForward = async (conversationId: string) => {
    setIsForwarding(true);
    try {
      await onForward(conversationId, message);
      onClose();
    } catch (e) {
      alert("Failed to forward message.");
    } finally {
      setIsForwarding(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-[120] flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-card w-full max-w-md rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh]">
        <div className="p-4 border-b border-border flex items-center justify-between">
          <h3 className="font-bold text-lg">Forward Message</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><i className="fas fa-times"></i></button>
        </div>
        <div className="p-4 border-b border-border bg-muted/30">
           <p className="text-sm italic opacity-80 truncate border-l-2 border-primary pl-2">{message.content || 'Photo'}</p>
        </div>
        <div className="p-4">
          <input type="text" placeholder="Search chats..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="w-full px-4 py-2 border border-input rounded-lg bg-background focus:ring-1 focus:ring-primary outline-none" />
        </div>
        <div className="flex-1 overflow-y-auto min-h-[50px] p-2 space-y-1">
          {filtered.map(c => {
            const name = c.isGroup ? c.groupName : c.user?.name;
            const photo = c.isGroup ? c.groupPhoto : c.user?.avatar;
            return (
              <div key={c.id} className="flex items-center justify-between p-2 hover:bg-muted/50 rounded-lg cursor-pointer" onClick={() => handleForward(c.id)}>
                <div className="flex items-center gap-3 overflow-hidden">
                  <img src={photo} className="w-10 h-10 rounded-full object-cover" />
                  <span className="font-semibold truncate text-sm">{name}</span>
                </div>
                <button disabled={isForwarding} className="px-3 py-1 bg-primary text-primary-foreground rounded-full text-[10px] font-bold shadow-sm hover:brightness-110 disabled:opacity-50">Send</button>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  );
};
