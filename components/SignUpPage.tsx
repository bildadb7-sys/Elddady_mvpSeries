
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';

interface SignUpPageProps {
    onSignUpSuccess: (user: any) => void;
    onSwitchToLogin: () => void;
}

const SignUpPage: React.FC<SignUpPageProps> = ({ onSignUpSuccess, onSwitchToLogin }) => {
    const navigate = useNavigate();
    const [formData, setFormData] = useState({
        firstName: '',
        secondName: '',
        gender: '',
        dob: '',
        mobile: '',
        email: '',
        country: '',
        password: ''
    });
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [agreedToTerms, setAgreedToTerms] = useState(false);

    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [validationErrors, setValidationErrors] = useState<string[]>([]);

    // Password Complexity Regex:
    // - At least one digit
    // - At least one uppercase letter
    // - At least one special character
    // - Min length 12
    const passwordRegex = /^(?=.*[0-9])(?=.*[A-Z])(?=.*[!@#$%^&*])[a-zA-Z0-9!@#$%^&*]{12,}$/;

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        setFormData({
            ...formData,
            [e.target.name]: e.target.value
        });
    };

    // Validate Password on Change
    useEffect(() => {
        const errors = [];
        const pw = formData.password;

        if (pw) {
            if (pw.length < 12) errors.push("Minimum 12 characters");
            if (!/(?=.*[0-9])/.test(pw)) errors.push("At least one number");
            if (!/(?=.*[A-Z])/.test(pw)) errors.push("At least one uppercase letter");
            if (!/(?=.*[!@#$%^&*])/.test(pw)) errors.push("At least one special character (!@#$%^&*)");
        }
        setValidationErrors(errors);
    }, [formData.password]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        // Client-side Validation Checks
        if (validationErrors.length > 0) {
            setError("Password is too weak. Please meet all requirements.");
            return;
        }

        if (formData.password !== confirmPassword) {
            setError("Passwords do not match.");
            return;
        }

        if (!agreedToTerms) {
            setError("You must agree to the terms and conditions.");
            return;
        }

        setIsLoading(true);

        try {
            const { user } = await api.signup(formData);
            onSignUpSuccess(user);
        } catch (err: any) {
            setError(err.message || 'Failed to sign up. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-background flex items-center justify-center p-4 font-sans">
            <div className="max-w-5xl w-full grid grid-cols-1 md:grid-cols-2 gap-12 items-center">

                {/* Left Side - Branding */}
                <div className="hidden md:flex flex-col items-center justify-center text-center space-y-6">
                    <img src="/ELDDADY2_transprnt_Y2.svg" alt="Elddady Logo" className="w-64 lg:w-80 h-auto object-contain drop-shadow-xl" />
                    <div className="space-y-2">
                        <p className="text-muted-foreground text-xl tracking-wide">Excelio in it</p>
                    </div>
                </div>

                {/* Right Side - Form */}
                <div className="bg-transparent md:bg-card md:p-8 md:rounded-xl md:shadow-none w-full max-w-md mx-auto md:max-w-full">
                    <div className="mb-8">
                        <h2 className="text-2xl font-bold text-foreground mb-1">Sign Up</h2>
                        <p className="text-muted-foreground text-sm">Create your Elddady account</p>
                    </div>

                    {error && (
                        <div className="mb-4 p-3 bg-red-100 border border-red-200 text-red-700 text-sm rounded-lg flex items-center gap-2">
                            <i className="fas fa-exclamation-circle"></i>
                            {error}
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-4">
                        {/* Name Row */}
                        <div className="grid grid-cols-2 gap-4">
                            <input
                                type="text"
                                name="firstName"
                                placeholder="First Name *"
                                required
                                value={formData.firstName}
                                onChange={handleChange}
                                className="w-full px-4 py-3 rounded-lg border border-input bg-background focus:outline-none focus:ring-1 focus:ring-[#E86C44]"
                            />
                            <input
                                type="text"
                                name="secondName"
                                placeholder="Second Name *"
                                required
                                value={formData.secondName}
                                onChange={handleChange}
                                className="w-full px-4 py-3 rounded-lg border border-input bg-background focus:outline-none focus:ring-1 focus:ring-[#E86C44]"
                            />
                        </div>

                        {/* Gender & DOB Row */}
                        <div className="grid grid-cols-2 gap-4">
                            <select
                                name="gender"
                                value={formData.gender}
                                onChange={handleChange}
                                className="w-full px-4 py-3 rounded-lg border border-input bg-background focus:outline-none focus:ring-1 focus:ring-[#E86C44] text-muted-foreground"
                            >
                                <option value="">Select Gender</option>
                                <option value="Male">Male</option>
                                <option value="Female">Female</option>
                                <option value="Other">Other</option>
                            </select>
                            <input
                                type="date"
                                name="dob"
                                value={formData.dob}
                                onChange={handleChange}
                                className="w-full px-4 py-3 rounded-lg border border-input bg-background focus:outline-none focus:ring-1 focus:ring-[#E86C44] text-muted-foreground"
                            />
                        </div>

                        <input
                            type="tel"
                            name="mobile"
                            placeholder="Mobile Number"
                            value={formData.mobile}
                            onChange={handleChange}
                            className="w-full px-4 py-3 rounded-lg border border-input bg-background focus:outline-none focus:ring-1 focus:ring-[#E86C44]"
                        />

                        <input
                            type="email"
                            name="email"
                            placeholder="Email *"
                            required
                            value={formData.email}
                            onChange={handleChange}
                            className="w-full px-4 py-3 rounded-lg border border-input bg-background focus:outline-none focus:ring-1 focus:ring-[#E86C44]"
                        />

                        <input
                            type="text"
                            name="country"
                            placeholder="Country of Residence"
                            value={formData.country}
                            onChange={handleChange}
                            className="w-full px-4 py-3 rounded-lg border border-input bg-background focus:outline-none focus:ring-1 focus:ring-[#E86C44]"
                        />

                        {/* Password Field with Toggle */}
                        <div className="relative">
                            <input
                                type={showPassword ? "text" : "password"}
                                name="password"
                                placeholder="Password *"
                                required
                                value={formData.password}
                                onChange={handleChange}
                                className="w-full px-4 py-3 rounded-lg border border-input bg-background focus:outline-none focus:ring-1 focus:ring-[#E86C44] pr-10"
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                            >
                                <i className={`fas ${showPassword ? 'fa-eye-slash' : 'fa-eye'}`}></i>
                            </button>
                        </div>

                        {/* Helper Text for Password Requirements */}
                        {formData.password && (
                            <div className="text-xs space-y-1 pl-1">
                                <p className={validationErrors.includes("Minimum 12 characters") ? "text-destructive" : "text-green-600"}>
                                    <i className={`fas ${validationErrors.includes("Minimum 12 characters") ? "fa-times" : "fa-check"} mr-1`}></i>
                                    Min 12 characters
                                </p>
                                <p className={validationErrors.includes("At least one number") ? "text-destructive" : "text-green-600"}>
                                    <i className={`fas ${validationErrors.includes("At least one number") ? "fa-times" : "fa-check"} mr-1`}></i>
                                    One Number
                                </p>
                                <p className={validationErrors.includes("At least one uppercase letter") ? "text-destructive" : "text-green-600"}>
                                    <i className={`fas ${validationErrors.includes("At least one uppercase letter") ? "fa-times" : "fa-check"} mr-1`}></i>
                                    One Uppercase Letter
                                </p>
                                <p className={validationErrors.includes("At least one special character (!@#$%^&*)") ? "text-destructive" : "text-green-600"}>
                                    <i className={`fas ${validationErrors.includes("At least one special character (!@#$%^&*)") ? "fa-times" : "fa-check"} mr-1`}></i>
                                    One Special Char
                                </p>
                            </div>
                        )}

                        {/* Confirm Password Field */}
                        <div className="relative">
                            <input
                                type={showConfirmPassword ? "text" : "password"}
                                name="confirmPassword"
                                placeholder="Confirm Password *"
                                required
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                className={`w-full px-4 py-3 rounded-lg border bg-background focus:outline-none focus:ring-1 pr-10 ${confirmPassword && formData.password !== confirmPassword ? 'border-destructive focus:ring-destructive' : 'border-input focus:ring-[#E86C44]'}`}
                            />
                            <button
                                type="button"
                                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                            >
                                <i className={`fas ${showConfirmPassword ? 'fa-eye-slash' : 'fa-eye'}`}></i>
                            </button>
                        </div>
                        {confirmPassword && formData.password !== confirmPassword && (
                            <p className="text-xs text-destructive pl-1">Passwords do not match</p>
                        )}

                        {/* Terms and Conditions Checkbox */}
                        <div className="flex items-start gap-2 pt-2 px-1">
                            <div className="flex items-center h-5">
                                <input
                                    id="agreedToTerms"
                                    type="checkbox"
                                    checked={agreedToTerms}
                                    onChange={(e) => setAgreedToTerms(e.target.checked)}
                                    className="w-4 h-4 text-[#E86C44] border-gray-300 rounded focus:ring-[#E86C44] cursor-pointer"
                                />
                            </div>
                            <label htmlFor="agreedToTerms" className="text-xs text-muted-foreground cursor-pointer">
                                I agree to Elddady's T&C <button type="button" onClick={() => navigate('/terms')} className="text-[#E86C44] hover:underline font-bold">Terms of Service</button> and <button type="button" onClick={() => navigate('/privacy')} className="text-[#E86C44] hover:underline font-bold">Privacy Policy</button>.
                            </label>
                        </div>

                        <button
                            type="submit"
                            disabled={isLoading || validationErrors.length > 0 || formData.password !== confirmPassword || !agreedToTerms}
                            className="w-full bg-[#E86C44] text-white py-3 rounded-lg font-bold hover:bg-[#d6623e] transition-colors flex items-center justify-center gap-2 mt-6 disabled:opacity-50 disabled:cursor-not-allowed shadow-md"
                        >
                            {isLoading ? 'Creating Account...' : 'Sign Up'} <i className="fas fa-arrow-right"></i>
                        </button>

                        <div className="text-center mt-4">
                            <p className="text-sm text-muted-foreground">
                                Already have an account?
                                <button type="button" onClick={onSwitchToLogin} className="text-[#E86C44] hover:underline ml-1 font-medium">
                                    Sign In
                                </button>
                            </p>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default SignUpPage;
