import React, { useEffect, useState } from 'react';
import { Camera, Sparkles, Pencil, ArrowRight } from 'lucide-react';
import { getAppThemeConfig, THEME_COLOR_PRESETS } from '../utils/productManager';

interface SplashScreenProps {
  onFinish: () => void;
  themeKey?: string;
}

export const SplashScreen: React.FC<SplashScreenProps> = ({ onFinish, themeKey }) => {
  const [progress, setProgress] = useState(12);
  const [statusText, setStatusText] = useState('Initializing AR camera engine...');
  const [isFading, setIsFading] = useState(false);
  const [themeConfig, setThemeConfig] = useState(() => getAppThemeConfig());

  // Listen to live theme changes
  useEffect(() => {
    const handleThemeEvent = (e: any) => {
      if (e.detail) {
        setThemeConfig(e.detail);
      }
    };
    window.addEventListener('sketchflow_theme_changed', handleThemeEvent);
    return () => window.removeEventListener('sketchflow_theme_changed', handleThemeEvent);
  }, []);

  // Sync if themeKey prop passed
  useEffect(() => {
    if (themeKey && themeKey !== themeConfig.themeColor) {
      setThemeConfig(getAppThemeConfig());
    }
  }, [themeKey, themeConfig.themeColor]);

  const activeColorKey = (themeKey || themeConfig.themeColor) as keyof typeof THEME_COLOR_PRESETS;
  const preset = THEME_COLOR_PRESETS[activeColorKey] || THEME_COLOR_PRESETS.purple;

  useEffect(() => {
    const t1 = setTimeout(() => {
      setProgress(45);
      setStatusText('Loading tracing sketches & AI outlines...');
    }, 350);

    const t2 = setTimeout(() => {
      setProgress(82);
      setStatusText('Preparing paper tracing canvas...');
    }, 750);

    const t3 = setTimeout(() => {
      setProgress(100);
      setStatusText(`Ready! Starting ${themeConfig.appName}...`);
    }, 1150);

    const t4 = setTimeout(() => {
      setIsFading(true);
    }, 1450);

    const t5 = setTimeout(() => {
      onFinish();
    }, 1800);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      clearTimeout(t4);
      clearTimeout(t5);
    };
  }, [onFinish, themeConfig.appName]);

  return (
    <div
      style={{
        backgroundColor: preset.darkBg,
        backgroundImage: `radial-gradient(ellipse at 50% 20%, ${preset.hex}25 0%, transparent 70%), linear-gradient(to bottom, ${preset.darkBg}, #050308)`,
      }}
      className={`fixed inset-0 z-50 flex flex-col items-center justify-between p-6 text-white transition-opacity duration-400 select-none ${
        isFading ? 'opacity-0 pointer-events-none' : 'opacity-100'
      }`}
    >
      {/* Top Bar with Skip Button */}
      <div className="w-full flex justify-end pt-safe">
        <button
          onClick={onFinish}
          style={{ borderColor: `${preset.hex}40` }}
          className="text-xs font-bold text-white/80 hover:text-white px-3.5 py-1.5 rounded-full bg-white/5 border flex items-center gap-1 active:scale-95 transition-all shadow-xs"
        >
          Skip <ArrowRight className="w-3 h-3" />
        </button>
      </div>

      {/* Center Branding - Fully Theme-Aware */}
      <div className="flex flex-col items-center text-center space-y-5 my-auto">
        {/* Animated App Icon with Theme Colors */}
        <div className="relative">
          <div
            style={{
              background: `linear-gradient(135deg, ${preset.hex}, #ffffff50)`,
              boxShadow: `0 20px 40px -10px ${preset.hex}60`,
            }}
            className="w-24 h-24 rounded-3xl p-0.5"
          >
            <div className="w-full h-full rounded-[22px] overflow-hidden relative shadow-inner">
              <img
                src="/app-logo.png"
                alt="SketchFlow Logo"
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
              />
            </div>
          </div>
          {/* Sparkle badge */}
          <div
            style={{ backgroundColor: preset.hex }}
            className="absolute -top-1.5 -right-1.5 w-7 h-7 rounded-full text-white flex items-center justify-center shadow-lg border-2 border-white/20"
          >
            <Sparkles className="w-3.5 h-3.5 fill-white" />
          </div>
        </div>

        <div className="space-y-1.5">
          <h1 className="text-3xl font-black tracking-tight text-white flex items-center justify-center gap-1.5">
            <span>{themeConfig.appName}</span>
          </h1>
          <p className="text-[11px] font-bold text-white/80 tracking-wider uppercase">
            {themeConfig.tagline || 'AR Drawing & Paper Tracing Studio'}
          </p>
          <div
            style={{
              backgroundColor: `${preset.hex}25`,
              borderColor: `${preset.hex}45`,
              color: preset.lightHex,
            }}
            className="inline-block mt-1 px-3 py-0.5 rounded-full border text-[10px] font-mono font-bold"
          >
            {preset.name} Edition
          </div>
        </div>
      </div>

      {/* Bottom Progress Bar */}
      <div className="w-full max-w-xs flex flex-col items-center gap-2.5 pb-safe">
        <div
          style={{ borderColor: `${preset.hex}40` }}
          className="w-full h-2.5 bg-black/40 border rounded-full overflow-hidden shadow-inner p-0.5"
        >
          <div
            style={{
              width: `${progress}%`,
              backgroundColor: preset.hex,
              boxShadow: `0 0 12px ${preset.hex}`,
            }}
            className="h-full rounded-full transition-all duration-300 ease-out"
          />
        </div>
        <div className="flex justify-between items-center w-full text-[11px] text-white/70 font-medium px-0.5">
          <span className="truncate max-w-[200px] text-[10px]">
            {statusText}
          </span>
          <span className="font-mono font-bold text-white">{progress}%</span>
        </div>
      </div>
    </div>
  );
};
