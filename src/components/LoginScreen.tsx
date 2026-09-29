import React, { useState, useRef } from 'react';
import appLogo from '../assets/images/power_round_logo_1787860440979.jpg';
import { 
  ShieldCheck, 
  User, 
  CheckCircle2, 
  ArrowRight, 
  KeyRound, 
  AlertCircle,
  Globe,
  Eye,
  EyeOff
} from 'lucide-react';
import { UserSession } from '../types';
import { loginUser } from '../services/api';
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
      (session.role === 'admin' || session.idNo === '8695716192' || session.phone?.includes('8695716192') || session.idNo === 'controller' || session.idNo === 'admin')
    );
    if (isAdminUser) {
      localStorage.setItem('power_is_admin', 'true');
    } else {
      localStorage.removeItem('power_is_admin');
    }
    onProceedSession(session);
  };

  // Form states - empty by default, no prefilled values
  const [loginId, setLoginId] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Status states
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Submission lock ref to prevent duplicate concurrent requests
  const isSubmittingRef = useRef<boolean>(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmittingRef.current || loading) return;

    setError(null);
    setSuccessMsg(null);

    const cleanId = loginId.trim();
    const cleanPass = password.trim();

    if (!cleanId) {
      setError(lang === 'bn' ? 'অনুগ্রহ করে ইউজার আইডি বা মোবাইল নম্বর দিন' : 'Please enter User ID or Phone Number');
      return;
    }

    if (!cleanPass) {
      setError(lang === 'bn' ? 'অনুগ্রহ করে পাসওয়ার্ড বা পিন দিন' : 'Please enter PIN or Password');
      return;
    }

    isSubmittingRef.current = true;
    setLoading(true);

    try {
      const session = await loginUser(cleanId, cleanPass);
      setSuccessMsg(lang === 'bn' ? 'লগইন সফল হয়েছে! প্রবেশ করা হচ্ছে...' : 'Login successful! Redirecting...');
      handleSuccess(session);
    } catch (err: any) {
      console.error('Login error:', err);
      const msg = err.message || (lang === 'bn' ? 'ভুল ইউজার আইডি বা পাসওয়ার্ড! সঠিক তথ্য দিন।' : 'Invalid User ID or Password.');
      setError(msg);
    } finally {
      isSubmittingRef.current = false;
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
          <p className="text-xs text-slate-400 mt-1.5 flex items-center justify-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>Google Sheets & Apps Script Backend</span>
          </p>
        </div>

        {/* Main Form */}
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

          <form onSubmit={handleSubmit} autoComplete="off" className="space-y-4">
            {/* Hidden dummy inputs to prevent aggressive browser autofill */}
            <input type="text" style={{ display: 'none' }} tabIndex={-1} aria-hidden="true" autoComplete="off" />
            <input type="password" style={{ display: 'none' }} tabIndex={-1} aria-hidden="true" autoComplete="new-password" />

            {/* Field 1: User ID / Phone Number */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-slate-500" />
                  <span>
                    {lang === 'bn' ? 'ইউজার আইডি / মোবাইল নম্বর' : 'User ID / Phone Number'} <span className="text-red-500">*</span>
                  </span>
                </span>
              </label>

              <input
                type="text"
                name="auth_login_id"
                id="auth_login_id"
                required
                value={loginId}
                onChange={(e) => setLoginId(e.target.value)}
                placeholder=""
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="none"
                spellCheck={false}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-bold text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all font-mono tracking-wider"
              />
            </div>

            {/* Field 2: Password / PIN */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <KeyRound className="w-3.5 h-3.5 text-slate-500" />
                  <span>
                    {lang === 'bn' ? 'পাসওয়ার্ড / পিন (PIN)' : 'Password / PIN'} <span className="text-red-500">*</span>
                  </span>
                </span>
              </label>

              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  name="auth_login_pwd"
                  id="auth_login_pwd"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder=""
                  autoComplete="new-password"
                  className="w-full pl-3.5 pr-10 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-bold text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all font-mono tracking-wider"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading || !loginId.trim() || !password.trim()}
              className="w-full py-3 px-4 rounded-xl text-white font-bold text-sm bg-blue-600 hover:bg-blue-700 shadow-md shadow-blue-600/20 transition-all flex items-center justify-center gap-2 active:scale-[0.99] cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed mt-2"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                  <span>{lang === 'bn' ? 'যাচাই করা হচ্ছে...' : 'Signing in...'}</span>
                </span>
              ) : (
                <>
                  <span>{lang === 'bn' ? 'লগইন করুন (Sign In)' : 'Sign In'}</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>

            {/* Secure Info Note */}
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center gap-2 text-xs text-slate-600">
              <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>
                {lang === 'bn' 
                  ? 'অফিসিয়াল WBSEDCL পোর্টাল • Google Sheets ক্লাউড ব্যাকএন্ড' 
                  : 'Official WBSEDCL Portal • Google Sheets Backend'}
              </span>
            </div>
          </form>
        </div>

        {/* Footer info */}
        <div className="bg-slate-50 px-6 py-3.5 border-t border-slate-100 flex items-center justify-center text-xs font-bold text-slate-700">
          <span className="tracking-wide text-slate-800 font-extrabold">App Developed By Nayem</span>
        </div>
      </div>
    </div>
  );
};
