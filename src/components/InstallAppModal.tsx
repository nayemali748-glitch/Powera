import React, { useState, useEffect } from 'react';
import appLogo from '../assets/images/power_round_logo_1787860440979.jpg';
import { 
  Download, 
  X, 
  Smartphone, 
  CheckCircle2, 
  ArrowRight, 
  Share2, 
  PlusSquare, 
  Sparkles, 
  ShieldCheck,
  Zap,
  Info
} from 'lucide-react';

interface InstallAppModalProps {
  isOpen: boolean;
  onClose: () => void;
  deferredPrompt: any;
  onPromptInstall: () => void;
}

export const InstallAppModal: React.FC<InstallAppModalProps> = ({
  isOpen,
  onClose,
  deferredPrompt,
  onPromptInstall,
}) => {
  const [activeTab, setActiveTab] = useState<'android' | 'ios' | 'desktop'>('android');
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    // Check if running in standalone mode (already installed)
    if (window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone === true) {
      setInstalled(true);
    }
  }, []);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-5 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800 relative">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-xl bg-amber-500/20 border border-amber-500/40 p-1 flex items-center justify-center shrink-0">
              <img 
                src={appLogo} 
                alt="POWER Logo" 
                className="w-full h-full rounded-lg object-cover"
                referrerPolicy="no-referrer"
              />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-black text-white tracking-tight">
                  মোবাইলে অ্যাপ ইনস্টল করুন
                </h2>
                <span className="text-[10px] bg-amber-500 text-slate-950 font-bold px-1.5 py-0.5 rounded">
                  PWA App
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                POWER - WBSEDCL Field Working Android App
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Quick 1-Click Install Button if browser supports it */}
        {deferredPrompt && !installed && (
          <div className="bg-amber-50 border-b border-amber-200 p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-amber-500 text-slate-950 flex items-center justify-center font-bold">
                  <Download className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-xs font-bold text-amber-950">সরাসরি ইনস্টল করুন (Direct Install)</h3>
                  <p className="text-[11px] text-amber-800">আপনার ব্রাউজার ১-ক্লিক ইনস্টলেশন সমর্থন করে</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  onPromptInstall();
                  onClose();
                }}
                className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer shrink-0"
              >
                <Download className="w-3.5 h-3.5" />
                <span>ইনস্টল করুন</span>
              </button>
            </div>
          </div>
        )}

        {/* Tab Selection */}
        <div className="flex border-b border-slate-200 bg-slate-50 px-4 pt-2 gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('android')}
            className={`px-3.5 py-2 text-xs font-bold border-b-2 transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'android'
                ? 'border-blue-600 text-blue-600 bg-white rounded-t-lg shadow-xs'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Smartphone className="w-3.5 h-3.5 text-emerald-600" />
            <span>Android ফোন (Chrome)</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('ios')}
            className={`px-3.5 py-2 text-xs font-bold border-b-2 transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'ios'
                ? 'border-blue-600 text-blue-600 bg-white rounded-t-lg shadow-xs'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <span>iPhone / Safari</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('desktop')}
            className={`px-3.5 py-2 text-xs font-bold border-b-2 transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'desktop'
                ? 'border-blue-600 text-blue-600 bg-white rounded-t-lg shadow-xs'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <span>কম্পিউটার (PC/Laptop)</span>
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 overflow-y-auto space-y-4 text-slate-700 text-xs sm:text-sm">
          {/* ANDROID TAB */}
          {activeTab === 'android' && (
            <div className="space-y-3.5">
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-3.5 flex items-start gap-3">
                <Smartphone className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
                <div className="text-xs text-blue-950 space-y-1">
                  <p className="font-bold">Android ফোনে ইনস্টল করার সহজ নিয়ম (Chrome Browser):</p>
                  <p className="text-blue-800">প্লে-স্টোর বা কোনো APK ছাড়াই অ্যাপটি সরাসরি আপনার মোবাইলের হোম স্ক্রিনে সেভ হয়ে যাবে।</p>
                </div>
              </div>

              <div className="space-y-2.5">
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-start gap-3">
                  <span className="w-6 h-6 rounded-full bg-slate-900 text-white flex items-center justify-center font-bold text-xs shrink-0">
                    ১
                  </span>
                  <div>
                    <strong className="text-slate-900 block font-bold text-xs">Chrome ব্রাউজারের উপরে ডানদিকের ৩টি ডট (⋮) মেনুতে চাপ দিন।</strong>
                    <span className="text-slate-500 text-[11px]">আপনার মোবাইলের স্ক্রিনের একেবারে উপরে ডানদিকে (Menu) থাকে।</span>
                  </div>
                </div>

                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-start gap-3">
                  <span className="w-6 h-6 rounded-full bg-slate-900 text-white flex items-center justify-center font-bold text-xs shrink-0">
                    ২
                  </span>
                  <div>
                    <strong className="text-slate-900 block font-bold text-xs">"Install app" অথবা "Add to Home screen" (হোম স্ক্রিনে যোগ করুন) অপশনে চাপ দিন।</strong>
                    <span className="text-slate-500 text-[11px]">মেনুর নিচের দিকে এই অপশনটি দেখতে পাবেন।</span>
                  </div>
                </div>

                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-start gap-3">
                  <span className="w-6 h-6 rounded-full bg-slate-900 text-white flex items-center justify-center font-bold text-xs shrink-0">
                    ৩
                  </span>
                  <div>
                    <strong className="text-slate-900 block font-bold text-xs">"Install" বা "Add" বাটনে কনফার্ম করুন।</strong>
                    <span className="text-slate-500 text-[11px]">কয়েক সেকেন্ডের মধ্যে অ্যাপ আইকনটি আপনার মোবাইল স্ক্রিনে চলে আসবে এবং অন্যান্য সাধারণ অ্যাপের মতো ফুল স্ক্রিনে খুলবে।</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* IPHONE / IOS TAB */}
          {activeTab === 'ios' && (
            <div className="space-y-3.5">
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 flex items-start gap-3">
                <Share2 className="w-5 h-5 text-slate-700 shrink-0 mt-0.5" />
                <div className="text-xs text-slate-900 space-y-1">
                  <p className="font-bold">iPhone / iPad এ ইনস্টল করার নিয়ম (Safari Browser):</p>
                  <p className="text-slate-600">Safari ব্রাউজার দিয়ে এই লিঙ্কটি ওপেন করুন।</p>
                </div>
              </div>

              <div className="space-y-2.5">
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-start gap-3">
                  <span className="w-6 h-6 rounded-full bg-slate-900 text-white flex items-center justify-center font-bold text-xs shrink-0">১</span>
                  <div>
                    <strong className="text-slate-900 block font-bold text-xs">Safari এর নিচে থাকা Share আইকনটিতে (<Share2 className="w-3.5 h-3.5 inline text-blue-600" />) চাপ দিন।</strong>
                  </div>
                </div>

                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-start gap-3">
                  <span className="w-6 h-6 rounded-full bg-slate-900 text-white flex items-center justify-center font-bold text-xs shrink-0">২</span>
                  <div>
                    <strong className="text-slate-900 block font-bold text-xs">নিচে স্ক্রোল করে "Add to Home Screen" অপশনটি সিলেক্ট করুন।</strong>
                  </div>
                </div>

                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-start gap-3">
                  <span className="w-6 h-6 rounded-full bg-slate-900 text-white flex items-center justify-center font-bold text-xs shrink-0">৩</span>
                  <div>
                    <strong className="text-slate-900 block font-bold text-xs">উপরে "Add" বাটনে চাপ দিন।</strong>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* PC / LAPTOP TAB */}
          {activeTab === 'desktop' && (
            <div className="space-y-3.5">
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 text-xs text-slate-800 space-y-2">
                <p className="font-bold">কম্পিউটারে Google Chrome বা Edge ব্রাউজারে ইনস্টল:</p>
                <p className="text-slate-600">
                  ব্রাউজারের এড্রেস বারের (URL bar) একেবারে ডানপাশে ছোট একটি <strong>Install Icon</strong> (<Download className="w-3.5 h-3.5 inline text-blue-600" />) দেখতে পাবেন। সেখানে ক্লিক করে "Install" চাপলেই এটি একটি স্বতন্ত্র উইন্ডো অ্যাপ হিসেবে ইনস্টল হবে।
                </p>
              </div>
            </div>
          )}

          {/* Features Highlights */}
          <div className="mt-4 pt-4 border-t border-slate-100 grid grid-cols-2 gap-2 text-[11px]">
            <div className="flex items-center gap-2 text-slate-600">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              <span>ফুল স্ক্রিন অ্যাপ ভিউ</span>
            </div>
            <div className="flex items-center gap-2 text-slate-600">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              <span>তাৎক্ষণিক সার্ভার ডাটা সিঙ্ক</span>
            </div>
            <div className="flex items-center gap-2 text-slate-600">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              <span>ক্যামেরা ও ছবি আপলোড সমর্থন</span>
            </div>
            <div className="flex items-center gap-2 text-slate-600">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              <span>লগইন সেশন স্থায়ী থাকবে</span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between px-5 text-xs">
          <span className="text-slate-500">Power Utility Field Operations</span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl transition-colors cursor-pointer"
          >
            বুঝেছি (Close)
          </button>
        </div>
      </div>
    </div>
  );
};
