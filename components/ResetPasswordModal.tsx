import React, { useState } from 'react';
import { supabase } from '../supabaseClient';

interface ResetPasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const ResetPasswordModal: React.FC<ResetPasswordModalProps> = ({ isOpen, onClose }) => {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setIsSubmitting(true);
    setError(null);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      alert("Password has been successfully reset!");
      onClose();
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to update password');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-card w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden border border-border animate-in fade-in zoom-in-95 duration-200">
        <div className="p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-bold">Reset Password</h2>
            <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
              <i className="fas fa-times"></i>
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {error && <div className="text-red-500 text-sm font-bold bg-red-100 p-3 rounded-xl">{error}</div>}
            
            <div className="space-y-2">
              <label className="text-xs font-bold text-muted-foreground uppercase">New Password</label>
              <input
                type="password"
                className="w-full px-4 py-3 bg-background border border-border rounded-xl focus:outline-none focus:border-primary"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
              />
            </div>
            
            <div className="space-y-2">
              <label className="text-xs font-bold text-muted-foreground uppercase">Confirm New Password</label>
              <input
                type="password"
                className="w-full px-4 py-3 bg-background border border-border rounded-xl focus:outline-none focus:border-primary"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
              />
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3 bg-primary text-primary-foreground rounded-xl font-bold hover:opacity-90 disabled:opacity-50 mt-4 shadow-md transition-all"
            >
              {isSubmitting ? <i className="fas fa-spinner fa-spin"></i> : "Update Password"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default ResetPasswordModal;
