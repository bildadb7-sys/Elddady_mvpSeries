
import React, { useState } from 'react';
import SignUpPage from './SignUpPage';
import { api } from '../api';
import CaptchaGuard from './CaptchaGuard';

interface LandingPageProps {
    onLogin: (email: string, password: string) => Promise<void>;
    onSignUp: (user: any) => void;
    isGoogleBlocked?: boolean; // true when a Google user has no profile
}

const LandingPage: React.FC<LandingPageProps> = ({ onLogin, onSignUp, isGoogleBlocked = false }) => {
    // Default to signup if visitor arrived via a share link (hasn't signed up yet)
    const hasSharedLink = !!localStorage.getItem('redirect_after_auth');
    const [view, setView] = useState<'login' | 'signup' | 'forgot' | 'google_blocked'>(
        isGoogleBlocked ? 'google_blocked' : hasSharedLink ? 'signup' : 'login'
    );
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [resetEmail, setResetEmail] = useState('');
    const [resetSent, setResetSent] = useState(false);
    const [loading, setLoading] = useState(false);
    const [successMessage, setSuccessMessage] = useState('');
    const [errorMessage, setErrorMessage] = useState('');

    // Captcha State
    const [captchaToken, setCaptchaToken] = useState<string>('');
    const captchaProvider = import.meta.env?.VITE_CAPTCHA_PROVIDER;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSuccessMessage(''); // Clear success message on login attempt
        setErrorMessage('');

        // Enforce captcha if provider is configured
        if (captchaProvider && !captchaToken) {
            setErrorMessage("Please complete the security check.");
            return;
        }

        setLoading(true);
        try {
            // Pass captcha token to API
            await api.login(email, password, captchaToken);
            // On success, the auth state in App.tsx will change and unmount this component
        } catch (err) {
            // Explicitly overriding whatever error Supabase sends to match requirements
            setErrorMessage("Wrong email or password, try again.");
            setLoading(false);
            // Optional: Reset captcha logic could go here if the token becomes invalid after use
            // setCaptchaToken(''); 
        }
    };

    const handleGoogleLogin = async () => {
        setLoading(true);
        setErrorMessage('');
        try {
            await api.googleLogin();
            // Page will redirect to Google — no further code runs until the user comes back.
        } catch (e: any) {
            const msg = String(e?.message || '').toLowerCase();
            // The before_user_created hook returns a 403 with our custom message
            if (msg.includes('no account found') || msg.includes('sign up first') || e?.status === 403) {
                setView('google_blocked');
            } else {
                setErrorMessage(`Google Sign-In failed: ${e.message}`);
            }
            setLoading(false);
        }
    };

    const handleForgotPassword = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            await api.forgotPassword(resetEmail);
            setResetSent(true);
        } catch (e: any) {
            alert(`Failed to send reset request: ${e.message}`);
        } finally {
            setLoading(false);
        }
    };

    if (view === 'google_blocked') {
        return (
            <div className="min-h-screen bg-gradient-to-br from-background to-muted flex items-center justify-center p-4">
                <div className="max-w-md w-full">
                    <div className="text-center mb-8 flex justify-center">
                        <img src="/ELDDADY2_transprnt_Y2.svg" alt="Elddady Logo" className="h-28 w-auto object-contain drop-shadow-lg mb-2" />
                    </div>
                    <div className="bg-card rounded-lg p-8 shadow-lg border border-border text-center space-y-5 animate-in slide-in-from-bottom-5 duration-500">
                        <div className="w-16 h-16 bg-red-100 text-red-500 rounded-full flex items-center justify-center mx-auto">
                            <i className="fas fa-user-slash text-2xl"></i>
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-foreground mb-2">Account Not Found</h2>
                            <p className="text-sm text-muted-foreground">
                                No Elddady account is linked to this Google address.
                                You need to <strong>sign up first</strong> with your email and password,
                                then you can use Google to sign in.
                            </p>
                        </div>
                        <div className="flex flex-col gap-3 pt-2">
                            <button
                                onClick={() => { setView('signup'); setErrorMessage(''); setSuccessMessage(''); }}
                                className="w-full bg-[#E86C44] text-white py-3 px-4 rounded-lg font-bold hover:bg-[#d6623e] transition-colors"
                            >
                                <i className="fas fa-user-plus mr-2"></i>Create an Account
                            </button>
                            <button
                                onClick={() => { setView('login'); setErrorMessage(''); }}
                                className="w-full border border-border text-foreground py-3 px-4 rounded-lg font-medium hover:bg-muted transition-colors"
                            >
                                <i className="fab fa-google text-red-500 mr-2"></i>Try a Different Google Account
                            </button>
                            <button
                                onClick={() => setView('login')}
                                className="text-sm text-muted-foreground hover:text-foreground mt-1"
                            >
                                ← Back to Sign In
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    if (view === 'signup') {
        return <SignUpPage
            onSignUpSuccess={(user) => {
                // Automatically redirect to login with a success message
                setSuccessMessage("Account created successfully! Please sign in.");
                setView('login');
            }}
            onSwitchToLogin={() => {
                setSuccessMessage('');
                setErrorMessage('');
                setView('login');
            }}
        />;
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-background to-muted flex items-center justify-center p-4">
            <div className="max-w-md w-full">
                {/* Logo and Title */}
                <div className="text-center mb-8 flex flex-col items-center">
                    <img src="/ELDDADY2_transprnt_Y2.svg" alt="Elddady Logo" className="h-32 w-auto object-contain drop-shadow-lg mb-4" />
                    <p className="text-muted-foreground text-lg">Excellio in it</p>
                </div>

                {/* Auth Card */}
                <div className="bg-card rounded-lg p-8 shadow-lg border border-border animate-in slide-in-from-bottom-5 duration-500 relative overflow-hidden">

                    {loading && (
                        <div className="absolute inset-0 bg-background/50 flex items-center justify-center z-10">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                        </div>
                    )}

                    {view === 'login' && (
                        <div className="space-y-6">
                            {/* Messages */}
                            {successMessage && (
                                <div className="p-3 bg-green-100 border border-green-200 text-green-700 text-sm rounded-lg flex items-center gap-2 animate-in fade-in slide-in-from-top-2">
                                    <i className="fas fa-check-circle"></i>
                                    {successMessage}
                                </div>
                            )}
                            {errorMessage && (
                                <div className="p-3 bg-red-100 border border-red-200 text-red-700 text-sm rounded-lg flex items-center gap-2 animate-in fade-in slide-in-from-top-2">
                                    <i className="fas fa-exclamation-circle"></i>
                                    {errorMessage}
                                </div>
                            )}

                            {/* Google Auth */}
                            <button
                                onClick={handleGoogleLogin}
                                disabled={loading}
                                className="w-full bg-white border border-border rounded-lg py-3 px-4 flex items-center justify-center space-x-3 hover:bg-gray-50 transition-colors disabled:opacity-70"
                            >
                                <i className="fab fa-google text-red-500"></i>
                                <span className="font-medium text-gray-800">Continue with Google</span>
                            </button>

                            <div className="relative">
                                <div className="absolute inset-0 flex items-center">
                                    <div className="w-full border-t border-border"></div>
                                </div>
                                <div className="relative flex justify-center text-sm">
                                    <span className="bg-card px-4 text-muted-foreground">or</span>
                                </div>
                            </div>

                            {/* Email Form */}
                            <form onSubmit={handleSubmit} className="space-y-4">
                                <input
                                    type="email"
                                    placeholder="Email address"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="w-full px-4 py-3 border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-[#E86C44] bg-background"
                                    required
                                />

                                {/* Password Input with Toggle */}
                                <div className="relative">
                                    <input
                                        type={showPassword ? "text" : "password"}
                                        placeholder="Password"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        className="w-full px-4 py-3 border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-[#E86C44] bg-background pr-10"
                                        required
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                                    >
                                        <i className={`fas ${showPassword ? 'fa-eye-slash' : 'fa-eye'}`}></i>
                                    </button>
                                </div>

                                {/* Vendor-Agnostic Captcha Guard */}
                                {captchaProvider && (
                                    <CaptchaGuard
                                        provider={captchaProvider}
                                        onVerify={(token) => setCaptchaToken(token)}
                                    />
                                )}

                                <button
                                    type="submit"
                                    disabled={loading || (!!captchaProvider && !captchaToken)}
                                    className="w-full bg-[#E86C44] text-white py-3 px-4 rounded-lg font-bold hover:bg-[#d6623e] transition-colors disabled:opacity-70"
                                >
                                    Sign In
                                </button>
                            </form>

                            <div className="text-center space-y-2">
                                <button
                                    onClick={() => { setView('forgot'); setSuccessMessage(''); setErrorMessage(''); }}
                                    className="text-sm text-accent hover:underline"
                                >
                                    Forgot password?
                                </button>
                                <p className="text-sm text-muted-foreground">
                                    Don't have an account?
                                    <button
                                        onClick={() => { setView('signup'); setSuccessMessage(''); setErrorMessage(''); }}
                                        className="text-[#E86C44] hover:underline ml-1 font-medium"
                                    >
                                        Sign up
                                    </button>
                                </p>
                            </div>
                        </div>
                    )}

                    {view === 'forgot' && (
                        <div className="space-y-6">
                            <div className="flex items-center gap-3 mb-2">
                                <button onClick={() => { setView('login'); setSuccessMessage(''); setErrorMessage(''); }} className="text-muted-foreground hover:text-foreground">
                                    <i className="fas fa-arrow-left"></i>
                                </button>
                                <h2 className="text-xl font-bold">Reset Password</h2>
                            </div>

                            {!resetSent ? (
                                <form onSubmit={handleForgotPassword} className="space-y-4">
                                    <p className="text-sm text-muted-foreground">
                                        Enter your email address and we'll send you a link to reset your password.
                                    </p>
                                    <input
                                        type="email"
                                        placeholder="Email address"
                                        value={resetEmail}
                                        onChange={(e) => setResetEmail(e.target.value)}
                                        className="w-full px-4 py-3 border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-[#E86C44] bg-background"
                                        required
                                    />
                                    <button
                                        type="submit"
                                        disabled={loading}
                                        className="w-full bg-[#E86C44] text-white py-3 px-4 rounded-lg font-bold hover:bg-[#d6623e] transition-colors disabled:opacity-70"
                                    >
                                        Send Reset Link
                                    </button>
                                </form>
                            ) : (
                                <div className="text-center py-6">
                                    <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
                                        <i className="fas fa-check text-2xl"></i>
                                    </div>
                                    <h3 className="text-lg font-bold mb-2">Link Sent!</h3>
                                    <p className="text-sm text-muted-foreground mb-6">
                                        We've sent a password reset link to <span className="font-medium text-foreground">{resetEmail}</span>.
                                    </p>
                                    <button
                                        onClick={() => { setView('login'); setResetSent(false); setResetEmail(''); setSuccessMessage(''); setErrorMessage(''); }}
                                        className="text-[#E86C44] font-medium hover:underline"
                                    >
                                        Back to Sign In
                                    </button>
                                </div>
                            )}
                        </div>
                    )}

                </div>
            </div>
        </div>
    );
};

export default LandingPage;