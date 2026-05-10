import React, { useState } from 'react';
import { api } from '../api';
import { useAppSettings } from '../hooks/useAppSettings';
import { useCurrency } from '../context/useCurrency';

interface PromoteModalProps {
  isOpen: boolean;
  onClose: () => void;
  itemType: 'product' | 'vroom';
  itemId: string;
  itemName: string;
  onSuccess?: () => void;
}

const PromoteModal: React.FC<PromoteModalProps> = ({ isOpen, onClose, itemType, itemId, itemName, onSuccess }) => {
  const { settings, loading } = useAppSettings();
  const { formatPrice, userCurrency } = useCurrency();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [budget, setBudget] = useState<number | ''>('');

  if (!isOpen) return null;
  if (loading || !settings) return <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"><i className="fas fa-spinner fa-spin text-white text-3xl"></i></div>;

  const ppcCost = settings.ppc_cost;

  const handlePromote = async () => {
    setIsSubmitting(true);
    try {
      if (itemType === 'product') {
        if (!budget || budget < ppcCost) {
          alert(`Budget must be at least ${formatPrice(ppcCost, userCurrency)}`);
          setIsSubmitting(false);
          return;
        }
        await api.startBoost(itemId, Number(budget));
      } else {
        await api.startPromotion(itemType, itemId);
      }
      alert("Promotion started successfully!");
      if (onSuccess) onSuccess();
      onClose();
    } catch (error: any) {
      console.error(error);
      alert(error.message || "Failed to start promotion.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-card w-full max-w-md rounded-2xl shadow-2xl overflow-hidden border border-border animate-in fade-in zoom-in-95 duration-200">
        <div className="p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold">Boost "{itemName}"</h2>
            <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
              <i className="fas fa-times"></i>
            </button>
          </div>

          <div className="space-y-4">
            <div className="bg-primary/10 p-4 rounded-xl border border-primary/20">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-primary-foreground">
                  <i className="fas fa-rocket"></i>
                </div>
                <h3 className="font-semibold text-primary">Reach More Customers, Boost Sales</h3>
              </div>
              <p className="text-sm text-muted-foreground">
                Your ad will run until your budget is exhausted.
              </p>
            </div>

            {itemType === 'product' && (
              <div className="py-3 border-b border-border flex flex-col gap-2">
                <label className="text-muted-foreground font-bold">Total Budget Limit ({userCurrency})</label>
                <input
                  type="number"
                  min={ppcCost}
                  placeholder={`e.g. ${ppcCost * 10}`}
                  value={budget}
                  onChange={(e) => setBudget(Number(e.target.value) || '')}
                  className="p-3 border border-border rounded-xl font-bold bg-background text-foreground"
                />
                <span className="text-xs text-muted-foreground text-center">Boost stops automatically when limit is reached.</span>
              </div>
            )}

            <div className="text-xs text-muted-foreground text-center">
              By clicking start, you agree to the terms of service.
            </div>

            <button
              onClick={handlePromote}
              disabled={loading || isSubmitting || !settings?.ads_enabled}
              className="w-full py-3 bg-primary text-primary-foreground font-bold rounded-xl hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isSubmitting ? (
                <i className="fas fa-spinner fa-spin"></i>
              ) : (
                <>
                  <i className="fas fa-bolt"></i>
                  Start Promotion (click)
                </>
              )}
            </button>

            {!settings?.ads_enabled && !loading && (
              <p className="text-red-500 text-xs text-center font-bold">
                Ads are currently disabled by the platform.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default PromoteModal;
