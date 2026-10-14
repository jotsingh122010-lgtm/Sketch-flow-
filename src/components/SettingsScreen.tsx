import React, { useState, useEffect } from 'react';
import {
  ArrowLeft,
  Shield,
  Smartphone,
  HelpCircle,
  Camera,
  CheckCircle2,
  AlertTriangle,
  Palette,
  Check
} from 'lucide-react';
import { THEME_COLOR_PRESETS, ThemeColorKey, saveAppThemeConfig, applyThemeToCss } from '../utils/productManager';

interface SettingsScreenProps {
  onBack: () => void;
  currentTheme: string;
  onThemeChange: (theme: string) => void;
  onOpenAdmin?: () => void;
  isAdmin?: boolean;
}

export const SettingsScreen: React.FC<SettingsScreenProps> = ({
  onBack,
  currentTheme,
  onThemeChange,
  onOpenAdmin,
  isAdmin = false,
}) => {
  const [deviceDiagnostics, setDeviceDiagnostics] = useState<{
    isSecureContext: boolean;
    hasCameraApi: boolean;
    maxTouchPoints: number;
    userAgent: string;
  }>({
    isSecureContext: false,
    hasCameraApi: false,
    maxTouchPoints: 0,
    userAgent: '',
  });

  useEffect(() => {
    setDeviceDiagnostics({
      isSecureContext: window.isSecureContext,
      hasCameraApi: !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia),
      maxTouchPoints: navigator.maxTouchPoints || 0,
      userAgent: navigator.userAgent,
    });
  }, []);

  return (
    <div className="relative w-full min-h-[100dvh] bg-white text-neutral-900 flex flex-col select-none">
      {/* Top Bar */}
      <div className="sticky top-0 z-30 pt-safe px-4 py-3 border-b border-slate-100 bg-white/95 backdrop-blur-md flex items-center justify-between">
        <button
          onClick={onBack}
          aria-label="Back"
          className="w-9 h-9 rounded-2xl bg-slate-100 border border-slate-200 text-slate-700 flex items-center justify-center active:scale-95 transition-transform hover:bg-slate-200"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <h2 className="text-sm font-black text-neutral-950 tracking-tight">Settings &amp; Help</h2>
        <div className="w-9" />
      </div>

      <div className="flex-1 p-4 max-w-xl mx-auto w-full space-y-4 pb-12">
        {/* App Branding & Logo */}
        <div className="p-4 rounded-3xl bg-slate-50 border border-slate-200/80 shadow-xs flex items-center gap-3.5">
          <img
            src="/app-logo.png"
            alt="SketchFlow Logo"
            className="w-12 h-12 rounded-2xl shadow-xs object-cover border border-slate-200/60"
            referrerPolicy="no-referrer"
          />
          <div>
            <h3 className="text-sm font-black text-neutral-950">
              Sketch<span className="text-purple-600">Flow</span> AR
            </h3>
            <p className="text-[11px] text-slate-500 font-medium">
              AR Drawing &amp; Paper Tracing Studio · v2.4
            </p>
          </div>
        </div>

        {/* Section: Admin Panel Access (ONLY VISIBLE IF ADMIN!) */}
        {isAdmin && onOpenAdmin && (
          <div className="p-4 rounded-3xl bg-purple-50 border border-purple-200 shadow-xs flex items-center justify-between gap-3 animate-in fade-in">
            <div>
              <div className="flex items-center gap-1.5 text-xs font-black text-purple-700 uppercase tracking-wider">
                <Shield className="w-4 h-4 text-purple-600" />
                Admin Panel (Verified Owner)
              </div>
              <p className="text-[11px] text-purple-600/80 mt-0.5">
                Manage templates, tracking &amp; security
              </p>
            </div>
            <button
              onClick={onOpenAdmin}
              className="px-3.5 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-black uppercase tracking-wider active:scale-95 transition-all shadow-xs"
            >
              Open &gt;
            </button>
          </div>
        )}

        {/* Section: UI Color Theme Selector */}
        <div className="p-5 rounded-3xl bg-white border border-slate-200 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5 text-purple-600">
              <Palette className="w-5 h-5" />
              <h3 className="text-sm font-black text-neutral-950 uppercase tracking-wider">
                App Colour Theme
              </h3>
            </div>
            <span className="text-[11px] font-bold text-slate-500 font-mono">
              {THEME_COLOR_PRESETS[currentTheme as ThemeColorKey]?.name || 'Current'}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {(Object.keys(THEME_COLOR_PRESETS) as ThemeColorKey[]).map((key) => {
              const preset = THEME_COLOR_PRESETS[key];
              const isSelected = currentTheme === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => {
                    onThemeChange(key);
                    const updated = saveAppThemeConfig({ themeColor: key });
                    applyThemeToCss(updated);
                  }}
                  className={`p-2.5 rounded-2xl border text-left flex items-center gap-2.5 transition-all active:scale-95 ${
                    isSelected
                      ? 'border-neutral-900 bg-slate-50 ring-2 ring-purple-400 shadow-xs'
                      : 'border-slate-200 bg-white hover:border-slate-300'
                  }`}
                >
                  <div
                    className="w-6 h-6 rounded-lg flex items-center justify-center text-white shrink-0 shadow-xs"
                    style={{ backgroundColor: preset.hex }}
                  >
                    {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                  </div>
                  <div className="min-w-0">
                    <span className="text-xs font-black text-neutral-950 block truncate">{preset.name}</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
        <div className="p-5 rounded-3xl bg-white border border-slate-200 shadow-xs space-y-3">
          <div className="flex items-center gap-2.5 text-purple-600">
            <Camera className="w-5 h-5" />
            <h3 className="text-sm font-black text-neutral-950 uppercase tracking-wider">
              Camera &amp; Audio Troubleshooting
            </h3>
          </div>

          <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 space-y-2 text-xs text-slate-700">
            <p className="font-bold text-neutral-900">If camera or audio does not start:</p>
            <ol className="list-decimal list-inside space-y-1.5 text-[11px] text-slate-600">
              <li>Tap the lock icon in your browser URL bar and set Camera &amp; Microphone permissions to <strong>Allow</strong>.</li>
              <li>If the camera preview is blank, refresh the webpage.</li>
              <li>For the best recording performance, use Chrome or Safari.</li>
            </ol>
          </div>
        </div>

        {/* Section 2: How to trace on paper */}
        <div className="p-5 rounded-3xl bg-white border border-slate-200 shadow-xs space-y-3">
          <div className="flex items-center gap-2.5 text-purple-600">
            <HelpCircle className="w-5 h-5" />
            <h3 className="text-sm font-black text-neutral-950 uppercase tracking-wider">
              How to Trace on Paper
            </h3>
          </div>

          <div className="space-y-2 text-xs text-slate-600 leading-relaxed">
            <p>
              1. <strong>Glass Cup or Stand:</strong> Place your phone horizontally on a transparent glass cup or stand pointing downwards towards your paper.
            </p>
            <p>
              2. <strong>Adjust Opacity (28%):</strong> Lower the reference photo opacity so both your sketch outline and real pencil are clearly visible.
            </p>
            <p>
              3. <strong>Lock Icon:</strong> Lock the reference image so it stays fixed while you draw and trace.
            </p>
          </div>
        </div>

        {/* Section 3: Device Diagnostics */}
        <div className="p-5 rounded-3xl bg-white border border-slate-200 shadow-xs space-y-3">
          <div className="flex items-center gap-2 text-slate-500">
            <Smartphone className="w-4 h-4" />
            <h4 className="text-xs font-black uppercase tracking-wider text-slate-700">Device Diagnostics</h4>
          </div>

          <div className="grid grid-cols-2 gap-2 text-[11px]">
            <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200">
              <span className="text-slate-400 block">HTTPS / SSL</span>
              <span className="font-bold text-emerald-600 flex items-center gap-1 mt-0.5">
                <CheckCircle2 className="w-3 h-3" />
                {deviceDiagnostics.isSecureContext ? 'Secure' : 'Insecure'}
              </span>
            </div>

            <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200">
              <span className="text-slate-400 block">Camera Hardware</span>
              <span className="font-bold text-emerald-600 flex items-center gap-1 mt-0.5">
                <CheckCircle2 className="w-3 h-3" />
                {deviceDiagnostics.hasCameraApi ? 'Supported' : 'Not Found'}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
