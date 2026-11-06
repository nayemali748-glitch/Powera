import React, { useState } from 'react';
import { Download, Smartphone, Share2, PlusSquare, CheckCircle, X, ShieldCheck } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { Language } from '../utils/translations';

interface PWAInstallButtonProps {
  lang?: Language;
  variant?: 'login-pill' | 'header' | 'banner' | 'menu-item';
  className?: string;
  onInstalledClick?: () => void;
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({
  lang = 'en',
  variant = 'login-pill',
  className = '',
  onInstalledClick,
}) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showGuideModal, setShowGuideModal] = useState(false);
  const [justInstalled, setJustInstalled] = useState(false);

  // If already running in standalone mode inside the installed PWA
  if (isInstalled && !justInstalled) {
    if (variant === 'header') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
          <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
          <span>App Installed</span>
        </span>
      );
    }
    if (variant === 'menu-item') {
      return (
        <div className="w-full px-4 py-2.5 text-left flex items-center gap-3 bg-emerald-50/40 border-b border-slate-100">
          <div className="p-2 rounded-lg bg-emerald-100 text-emerald-700">
            <CheckCircle className="w-4 h-4" />
          </div>
          <div>
            <div className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
              <span>{lang === 'bn' ? 'অ্যাপ ইনস্টল করা আছে' : 'App Installed'}</span>
              <span className="text-[9px] bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded font-semibold uppercase">Active</span>
            </div>
            <p className="text-[11px] text-slate-500">
              {lang === 'bn' ? 'স্ট্যান্ডঅ্যালোন মোডে চলছে' : 'Running in standalone mode'}
            </p>
          </div>
        </div>
      );
    }
    return null;
  }

  const handleInstallClick = async () => {
    if (isInstallable) {
      const res = await install();
      if (res === 'accepted') {
        setJustInstalled(true);
      }
    } else {
      // Show instructional modal (for iOS Safari or Chrome when beforeinstallprompt has not fired)
      setShowGuideModal(true);
    }
  };

  const isBn = lang === 'bn';

  return (
    <>
      {variant === 'login-pill' && (
        <button
          type="button"
          onClick={handleInstallClick}
          className={`group px-3.5 py-1.5 rounded-full bg-gradient-to-r from-emerald-600/90 via-teal-600/90 to-cyan-600/90 hover:from-emerald-500 hover:to-cyan-500 text-white border border-emerald-400/50 shadow-[0_0_16px_rgba(16,185,129,0.4)] flex items-center gap-2 text-[13px] font-bold tracking-wide transition-all duration-200 cursor-pointer backdrop-blur-md active:scale-95 ${className}`}
          title={isBn ? 'প্লে স্টোরের মতো ফোনে ইনস্টল করুন' : 'Install app on Mobile, Tablet or Desktop'}
        >
          <div className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center">
            <Download className="w-3 h-3 text-white group-hover:translate-y-0.5 transition-transform" />
          </div>
          <span>{isBn ? 'অ্যাপ ইনস্টল করুন' : 'Install App'}</span>
        </button>
      )}

      {variant === 'header' && (
        <button
          type="button"
          onClick={handleInstallClick}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-md shadow-emerald-950/40 transition-all cursor-pointer active:scale-95 ${className}`}
        >
          <Smartphone className="w-4 h-4" />
          <span>{isBn ? 'ইনস্টল অ্যাপ' : 'Install App'}</span>
        </button>
      )}

      {variant === 'banner' && (
        <div className="w-full p-3 rounded-xl bg-gradient-to-r from-slate-900 via-emerald-950 to-slate-900 border border-emerald-500/40 shadow-lg flex items-center justify-between gap-3 text-white">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center shrink-0">
              <Download className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <p className="text-sm font-bold text-white">
                {isBn ? 'প্লে স্টোরের মতো ইনস্টল করুন' : 'Install Like a Play Store App'}
              </p>
              <p className="text-xs text-slate-300">
                {isBn ? 'মোবাইল, ল্যাপটপ ও কম্পিউটারে সুপার ফাস্ট চালান' : 'Works offline, full screen & ultra fast'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleInstallClick}
            className="px-3.5 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold shrink-0 transition"
          >
            {isBn ? 'ইনস্টল' : 'Install'}
          </button>
        </div>
      )}

      {variant === 'menu-item' && (
        <button
          type="button"
          onClick={() => {
            if (onInstalledClick) onInstalledClick();
            handleInstallClick();
          }}
          className={`w-full px-4 py-2.5 text-left flex items-center gap-3 hover:bg-emerald-50/70 transition-colors group cursor-pointer border-b border-slate-100 ${className}`}
        >
          <div className="p-2 rounded-lg bg-emerald-100 text-emerald-700 group-hover:bg-emerald-200 transition-colors shrink-0">
            <Download className="w-4 h-4" />
          </div>
          <div>
            <div className="text-xs font-bold text-slate-900 group-hover:text-emerald-700 flex items-center gap-1.5">
              <span>{isBn ? 'অ্যাপ ইনস্টল করুন' : 'Install App'}</span>
              <span className="text-[9px] bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded font-semibold uppercase">PWA</span>
            </div>
            <p className="text-[11px] text-slate-500">
              {isBn ? 'মোবাইল বা পিসিতে প্লে স্টোরের মতো ব্যবহার করুন' : 'Add to Home Screen / Desktop App'}
            </p>
          </div>
        </button>
      )}

      {/* Instructional Guide Modal for iOS or manual install */}
      {showGuideModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className="relative w-full max-w-sm rounded-2xl bg-[#09152b] border border-cyan-500/40 p-5 shadow-2xl text-white">
            <button
              type="button"
              onClick={() => setShowGuideModal(false)}
              className="absolute top-4 right-4 p-1.5 rounded-full bg-slate-800 text-slate-300 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shadow-lg">
                <Smartphone className="w-6 h-6 text-white" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">
                  {isBn ? 'পাওয়ার অ্যাপ ইনস্টল করুন' : 'Install POWER App'}
                </h3>
                <p className="text-xs text-cyan-300 flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  {isBn ? 'অফিসিয়াল WBSEDCL পোর্টাল' : 'Official PWA Application'}
                </p>
              </div>
            </div>

            {isIOS ? (
              <div className="space-y-3 text-xs text-slate-200 bg-slate-900/80 p-3.5 rounded-xl border border-white/10">
                <p className="font-semibold text-cyan-300">
                  {isBn ? 'আইফোন / আইপ্যাডে ইনস্টল করার নিয়ম:' : 'How to install on iPhone / iPad:'}
                </p>
                <div className="flex items-start gap-2.5">
                  <div className="w-6 h-6 rounded-full bg-blue-500/20 text-blue-300 flex items-center justify-center shrink-0 font-bold">1</div>
                  <p className="leading-tight">
                    {isBn ? 'Safari ব্রাউজারের নিচে ' : 'Tap the '}
                    <span className="inline-flex items-center gap-1 font-bold text-white bg-slate-800 px-1.5 py-0.5 rounded">
                      <Share2 className="w-3 h-3 text-cyan-400" /> Share
                    </span>
                    {isBn ? ' বাটনে ক্লিক করুন।' : ' button at the bottom.'}
                  </p>
                </div>
                <div className="flex items-start gap-2.5">
                  <div className="w-6 h-6 rounded-full bg-blue-500/20 text-blue-300 flex items-center justify-center shrink-0 font-bold">2</div>
                  <p className="leading-tight">
                    {isBn ? 'নিচে স্ক্রল করে ' : 'Scroll down and tap '}
                    <span className="inline-flex items-center gap-1 font-bold text-white bg-slate-800 px-1.5 py-0.5 rounded">
                      <PlusSquare className="w-3 h-3 text-emerald-400" /> Add to Home Screen
                    </span>
                    {isBn ? ' সিলেক্ট করুন।' : '.'}
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-3 text-xs text-slate-200 bg-slate-900/80 p-3.5 rounded-xl border border-white/10">
                <p className="font-semibold text-cyan-300">
                  {isBn ? 'অ্যান্ড্রয়েড / কম্পিউটার / ট্যাবে ইনস্টল:' : 'Install on Android / PC / Laptop / Tablet:'}
                </p>
                <div className="flex items-start gap-2.5">
                  <div className="w-6 h-6 rounded-full bg-cyan-500/20 text-cyan-300 flex items-center justify-center shrink-0 font-bold">1</div>
                  <p className="leading-tight">
                    {isBn
                      ? 'ব্রাউজারের উপরে ডানদিকের তিনটি ডট (⋮) মেনুতে চাপ দিন।'
                      : 'Tap the three dots (⋮) menu in Chrome / Edge.'}
                  </p>
                </div>
                <div className="flex items-start gap-2.5">
                  <div className="w-6 h-6 rounded-full bg-cyan-500/20 text-cyan-300 flex items-center justify-center shrink-0 font-bold">2</div>
                  <p className="leading-tight">
                    {isBn
                      ? '"Install App" অথবা "Add to Home screen" চাপুন।'
                      : 'Select "Install app" or "Add to Home screen".'}
                  </p>
                </div>
              </div>
            )}

            <button
              type="button"
              onClick={() => setShowGuideModal(false)}
              className="mt-4 w-full py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-bold text-xs tracking-wider transition cursor-pointer"
            >
              {isBn ? 'ঠিক আছে (Close)' : 'Got It'}
            </button>
          </div>
        </div>
      )}
    </>
  );
};
