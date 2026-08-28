import React, { useState } from 'react';
import { Globe, Check, X, CheckCircle2 } from 'lucide-react';
import { Language, translations } from '../utils/translations';

interface LanguageModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentLanguage: Language;
  onSelectLanguage: (lang: Language) => void;
}

const languages: { code: Language; name: string; nativeName: string; flag: string; region: string; scriptExample: string }[] = [
  { 
    code: 'bn', 
    name: 'Bengali', 
    nativeName: 'বাংলা (পশ্চিমবঙ্গ)', 
    flag: '🇮🇳', 
    region: 'WBSEDCL West Bengal Official',
    scriptExample: 'নতুন বিদ্যুৎ সংযোগ ও ফিল্ড সার্ভিস'
  },
  { 
    code: 'en', 
    name: 'English', 
    nativeName: 'English (India/WBSEDCL)', 
    flag: '🌐', 
    region: 'Official Field Standard',
    scriptExample: 'New Service Connection & Utility Ops'
  },
  { 
    code: 'hi', 
    name: 'Hindi', 
    nativeName: 'हिन्दी (भारत)', 
    flag: '🇮🇳', 
    region: 'National / Pan-India Utility',
    scriptExample: 'नया विद्युत कनेक्शन और फील्ड सेवा'
  },
  { 
    code: 'ur', 
    name: 'Urdu', 
    nativeName: 'اردو', 
    flag: '🇮🇳', 
    region: 'Recognized Official Utility',
    scriptExample: 'نیا بجلی کا کنکشن اور فیلڈ سروس'
  },
];

export const LanguageModal: React.FC<LanguageModalProps> = ({
  isOpen,
  onClose,
  currentLanguage,
  onSelectLanguage,
}) => {
  const [selected, setSelected] = useState<Language>(currentLanguage);
  
  if (!isOpen) return null;

  const t = translations[selected] || translations.bn;

  const handleDone = () => {
    onSelectLanguage(selected);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-md overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/20 border border-blue-400/30 flex items-center justify-center text-blue-400">
              <Globe className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">
                {t.languageSelectTitle}
              </h3>
              <p className="text-xs text-slate-400">
                {t.languageSelectSubtitle}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Language Options List */}
        <div className="p-4 space-y-2.5 max-h-[60vh] overflow-y-auto">
          {languages.map((lang) => {
            const isSelected = selected === lang.code;
            return (
              <button
                key={lang.code}
                type="button"
                onClick={() => setSelected(lang.code)}
                className={`w-full p-3.5 rounded-xl border text-left transition-all flex items-center justify-between cursor-pointer ${
                  isSelected
                    ? 'border-blue-600 bg-blue-50/90 ring-2 ring-blue-500/30 shadow-xs'
                    : 'border-slate-200 hover:border-blue-300 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center gap-3.5">
                  <span className="text-2xl shrink-0">{lang.flag}</span>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-900 text-sm">{lang.nativeName}</span>
                      <span className="text-xs text-slate-500 font-medium">({lang.name})</span>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-0.5">{lang.region}</p>
                    <p className="text-[10px] text-blue-600 font-medium mt-0.5 italic">{lang.scriptExample}</p>
                  </div>
                </div>

                {isSelected ? (
                  <div className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center shadow-xs shrink-0">
                    <Check className="w-3.5 h-3.5 stroke-[3]" />
                  </div>
                ) : (
                  <div className="w-5 h-5 rounded-full border-2 border-slate-300 shrink-0"></div>
                )}
              </button>
            );
          })}
        </div>

        {/* Footer with Big Done Button */}
        <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition-colors cursor-pointer"
          >
            {t.cancel}
          </button>

          <button
            type="button"
            id="lang-modal-done-btn"
            onClick={handleDone}
            className="flex-1 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs transition-all shadow-sm flex items-center justify-center gap-2 cursor-pointer active:scale-98"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>{t.done} • Apply Language</span>
          </button>
        </div>
      </div>
    </div>
  );
};
