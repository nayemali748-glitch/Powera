import React, { useState, useEffect, useRef } from 'react';
import appLogo from '../assets/images/power_round_logo_1787860440979.jpg';
import { 
  ShieldCheck, 
  Lock, 
  User, 
  Phone, 
  CheckCircle2, 
  ArrowRight, 
  KeyRound, 
  AlertCircle,
  Eye, 
  EyeOff, 
  HelpCircle, 
  ArrowLeft, 
  Check, 
  Globe 
} from 'lucide-react';
import { UserSession, UserAccount } from '../types';
import { fetchUsers, loginUser, resetUserPassword } from '../services/api';
import { normalizeUniversalText, normalizePassword, isUserMatch } from '../utils/textNormalizer';
import { Language } from '../utils/translations';

interface LoginScreenProps {
  onLogin?: (session: UserSession) => void;
  onLoginSuccess?: (session: UserSession) => void;
  lang?: Language;
  onOpenLanguageModal?: () => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ 
  onLogin, 
  onLoginSuccess, 
  lang = 'en',
  onOpenLanguageModal 
}) => {
  const onProceedSession = onLoginSuccess || onLogin || (() => {});
  const handleSuccess = (session: UserSession) => {
    localStorage.setItem('power_user_session', JSON.stringify(session));
    const isAdminUser = Boolean(
      session.role !== 'worker' &&
      (session.role === 'admin' || session.idNo === '8695716192' || session.idNo === 'controller' || session.idNo === 'administration')
    );
    if (isAdminUser) {
      localStorage.setItem('power_is_admin', 'true');
    } else {
      localStorage.removeItem('power_is_admin');
    }
    onProceedSession(session);
  };

  // Screen mode: 'login' | 'forgot' (Create account removed as per request)
  const [mode, setMode] = useState<'login' | 'forgot'>('login');

  // --- LOGIN STATE ---
  const [loginId, setLoginId] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const isLoggingInRef = useRef(false);

  // --- FORGOT PASSWORD STATE ---
  const [forgotStep, setForgotStep] = useState<1 | 2>(1);
  const [forgotId, setForgotId] = useState('');
  const [forgotPhone, setForgotPhone] = useState('');
  const [targetAccount, setTargetAccount] = useState<UserAccount | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setNewConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);

  // General Status Messages
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Clear messages on mode switch
  useEffect(() => {
    setError(null);
    setSuccessMsg(null);
  }, [mode]);

  // Handle Login Submit - 1 Request with Submission Lock
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoggingInRef.current || isLoggingIn || loading) {
      return;
    }
    setError(null);

    const cleanId = normalizeUniversalText(loginId);
    const cleanPass = normalizePassword(loginPassword);

    if (!cleanId) {
      setError('Please enter your User ID');
      return;
    }

    if (!cleanPass) {
      setError('Please enter your Password');
      return;
    }

    isLoggingInRef.current = true;
    setIsLoggingIn(true);
    setLoading(true);

    try {
      const session = await loginUser(cleanId, cleanPass);
      handleSuccess(session);
    } catch (err: any) {
      setError(err.message || 'Invalid User ID or Password. Please try again.');
    } finally {
      isLoggingInRef.current = false;
      setIsLoggingIn(false);
      setLoading(false);
    }
  };

  // Forgot Password Step 1: Verify ID
  const handleForgotVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const cleanForgotId = normalizeUniversalText(forgotId);

    if (!cleanForgotId) {
      setError('Please enter your Login User ID');
      return;
    }

    setLoading(true);
    try {
      const latestUsers = await fetchUsers();
      const found = latestUsers.find((a) => a && isUserMatch(cleanForgotId, a));

      if (!found) {
        setError('User ID not found! Please check and enter a valid Login ID.');
        return;
      }

      setTargetAccount(found);
      setForgotStep(2);
    } catch (err: any) {
      setError(err.message || 'Error verifying user ID');
    } finally {
      setLoading(false);
    }
  };

  // Forgot Password Step 2: Set New Password
  const handleForgotResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!targetAccount) return;

    const cleanNewPass = normalizePassword(newPassword);
    const cleanConfirm = normalizePassword(confirmNewPassword);

    if (!cleanNewPass || cleanNewPass.length < 4) {
      setError('New password must be at least 4 characters/digits');
      return;
    }

    if (cleanNewPass !== cleanConfirm) {
      setError('Passwords do not match! Please re-type.');
      return;
    }

    setLoading(true);

    try {
      await resetUserPassword(targetAccount.idNo, cleanNewPass, targetAccount.phone);

      setSuccessMsg(`Password successfully changed! Please sign in with your new password.`);
      setLoginId(targetAccount.idNo);
      setLoginPassword(cleanNewPass);
      setForgotStep(1);
      setTargetAccount(null);
      setNewPassword('');
      setNewConfirmPassword('');
      setMode('login');
    } catch (err: any) {
      setError(err.message || 'Failed to reset password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col justify-center items-center p-4 sm:p-6 lg:p-8 font-sans selection:bg-blue-600 selection:text-white">
      {/* Background Graphic Accents */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden opacity-30">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-blue-400 rounded-full blur-3xl"></div>
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-amber-300 rounded-full blur-3xl"></div>
      </div>

      <div className="w-full max-w-md bg-white rounded-2xl border border-slate-200/90 shadow-xl overflow-hidden relative z-10">
        {/* Header Branding */}
        <div className="bg-slate-900 text-white p-6 sm:p-7 text-center relative overflow-hidden">
          <div className="absolute inset-0 bg-linear-to-b from-blue-600/15 to-transparent pointer-events-none"></div>

          {onOpenLanguageModal && (
            <button
              type="button"
              onClick={onOpenLanguageModal}
              className="absolute top-4 right-4 p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-blue-300 hover:text-white border border-blue-500/30 flex items-center gap-1.5 text-xs font-bold transition-all shadow-xs cursor-pointer z-20"
              title="Change Language"
            >
              <Globe className="w-3.5 h-3.5 text-blue-400" />
              <span className="uppercase text-[10px]">{lang}</span>
            </button>
          )}
          
          <div className="inline-block relative mb-3">
            <img 
              src={appLogo} 
              alt="Power Logo" 
              className="w-16 h-16 sm:w-20 sm:h-20 rounded-full object-cover shadow-lg border-2 border-amber-400 p-0.5 bg-white mx-auto ring-4 ring-slate-800"
              referrerPolicy="no-referrer"
            />
            <span className="absolute bottom-0 right-0 w-4 h-4 bg-emerald-500 rounded-full border-2 border-slate-900 animate-pulse"></span>
          </div>

          <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white flex items-center justify-center gap-2">
            <span>Power of Construction</span>
          </h1>
          <p className="text-xs text-amber-400 font-bold tracking-wider mt-1">
            App Developed By Nayem
          </p>
          <p className="text-xs text-slate-400 mt-1.5">
            {mode === 'login' && 'Sign in with your User ID & Password'}
            {mode === 'forgot' && 'Password Reset & Account Recovery'}
          </p>
        </div>

        {/* Dynamic Navigation Header if mode is forgot */}
        {mode !== 'login' && (
          <div className="bg-slate-50 px-4 py-2.5 border-b border-slate-200 flex items-center justify-between">
            <button
              type="button"
              onClick={() => {
                setMode('login');
                setError(null);
              }}
              className="text-xs font-bold text-slate-600 hover:text-blue-600 flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to Sign In</span>
            </button>
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Password Recovery
            </span>
          </div>
        )}

        {/* Main Content Area */}
        <div className="p-6 sm:p-7 space-y-5">
          {/* Notifications */}
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl flex items-start gap-2.5 text-xs text-red-700 font-semibold animate-in fade-in duration-200">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-600 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-start gap-2.5 text-xs text-emerald-800 font-semibold animate-in fade-in duration-200">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600 mt-0.5" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* ========================================================= */}
          {/* 1. LOGIN MODE */}
          {/* ========================================================= */}
          {mode === 'login' && (
            <>
              <form onSubmit={handleLoginSubmit} className="space-y-4">
                {/* User ID Input */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <User className="w-3.5 h-3.5 text-slate-500" />
                      <span>User ID <span className="text-red-500">*</span></span>
                    </span>
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      required
                      value={loginId}
                      onChange={(e) => setLoginId(e.target.value)}
                      placeholder="Enter your User ID"
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-bold text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all placeholder:text-slate-400 font-mono"
                    />
                  </div>
                </div>

                {/* Password Input */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                      <KeyRound className="w-3.5 h-3.5 text-slate-500" />
                      <span>Password <span className="text-red-500">*</span></span>
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        setForgotId(loginId || '');
                        setMode('forgot');
                      }}
                      className="text-xs font-bold text-blue-600 hover:text-blue-700 hover:underline cursor-pointer flex items-center gap-1"
                    >
                      <span>Forgot Password?</span>
                    </button>
                  </div>
                  <div className="relative">
                    <input
                      type={showLoginPassword ? 'text' : 'password'}
                      required
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      placeholder="Enter your password"
                      className="w-full pl-3.5 pr-10 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-medium text-slate-900 tracking-wider focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                    />
                    <button
                      type="button"
                      onClick={() => setShowLoginPassword(!showLoginPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                    >
                      {showLoginPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={loading || isLoggingIn}
                  className="w-full py-3 px-4 rounded-xl text-white font-bold text-sm bg-blue-600 hover:bg-blue-700 shadow-md shadow-blue-600/20 transition-all flex items-center justify-center gap-2 active:scale-[0.99] cursor-pointer disabled:opacity-70 disabled:cursor-not-allowed mt-2"
                >
                  {loading ? (
                    <span className="flex items-center gap-2">
                      <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                      <span>Signing In...</span>
                    </span>
                  ) : (
                    <>
                      <Lock className="w-4 h-4" />
                      <span>Sign In</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>

              {/* Secure Info Note */}
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center gap-2 text-xs text-slate-600">
                <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Secure Encrypted Connection • Authorized WBSEDCL Personnel</span>
              </div>
            </>
          )}

          {/* ========================================================= */}
          {/* 2. FORGOT / RESET PASSWORD MODE */}
          {/* ========================================================= */}
          {mode === 'forgot' && (
            <div className="space-y-4">
              {forgotStep === 1 ? (
                <form onSubmit={handleForgotVerify} className="space-y-4">
                  <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-800">
                    <p className="font-bold flex items-center gap-1.5 mb-1">
                      <HelpCircle className="w-4 h-4 text-blue-600" />
                      <span>Password Recovery</span>
                    </p>
                    <p>Enter your registered <strong>User ID</strong> to verify your account and set a new password.</p>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center justify-between">
                      <span className="flex items-center gap-1.5">
                        <User className="w-3.5 h-3.5 text-slate-500" />
                        <span>User ID <span className="text-red-500">*</span></span>
                      </span>
                    </label>
                    <input
                      type="text"
                      required
                      value={forgotId}
                      onChange={(e) => setForgotId(e.target.value)}
                      placeholder="Enter your User ID"
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
                      <Phone className="w-3.5 h-3.5 text-slate-500" />
                      <span>Registered Mobile Number (Optional)</span>
                    </label>
                    <input
                      type="tel"
                      value={forgotPhone}
                      onChange={(e) => setForgotPhone(e.target.value)}
                      placeholder="Enter registered mobile number"
                      className="w-full px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs sm:text-sm font-medium text-slate-900 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    />
                  </div>

                  <button
                    type="submit"
                    className="w-full py-3 px-4 rounded-xl text-white font-bold text-sm bg-blue-600 hover:bg-blue-700 shadow-md shadow-blue-600/20 transition-all flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <span>Verify ID & Proceed</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </form>
              ) : (
                <form onSubmit={handleForgotResetPassword} className="space-y-4 animate-in fade-in">
                  <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800">
                    <p className="font-bold">Account Verified</p>
                    <p className="text-[11px] text-emerald-700 mt-0.5">Please set a new password for this account.</p>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center justify-between">
                      <span className="flex items-center gap-1.5">
                        <KeyRound className="w-3.5 h-3.5 text-slate-500" />
                        <span>New Password <span className="text-red-500">*</span></span>
                      </span>
                      <button
                        type="button"
                        onClick={() => setShowNewPassword(!showNewPassword)}
                        className="text-[10px] text-slate-400 hover:text-slate-600 cursor-pointer"
                      >
                        {showNewPassword ? 'Hide' : 'Show'}
                      </button>
                    </label>
                    <input
                      type={showNewPassword ? 'text' : 'password'}
                      required
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Minimum 4 characters/digits"
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">
                      Confirm New Password <span className="text-red-500">*</span>
                    </label>
                    <input
                      type={showNewPassword ? 'text' : 'password'}
                      required
                      value={confirmNewPassword}
                      onChange={(e) => setNewConfirmPassword(e.target.value)}
                      placeholder="Re-enter your new password"
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-3 px-4 rounded-xl text-white font-bold text-sm bg-emerald-600 hover:bg-emerald-700 shadow-md shadow-emerald-600/20 transition-all flex items-center justify-center gap-2 cursor-pointer"
                  >
                    {loading ? (
                      <span>Saving...</span>
                    ) : (
                      <>
                        <Check className="w-4 h-4" />
                        <span>Update & Save Password</span>
                      </>
                    )}
                  </button>
                </form>
              )}
            </div>
          )}
        </div>

        {/* Footer info */}
        <div className="bg-slate-50 px-6 py-3.5 border-t border-slate-100 flex items-center justify-center text-xs font-bold text-slate-700">
          <span className="tracking-wide text-slate-800 font-extrabold">App Developed By Nayem</span>
        </div>
      </div>
    </div>
  );
};
