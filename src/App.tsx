import React, { useState, useEffect } from 'react';
import { AppScreen } from './types';
import { HomeScreen } from './components/HomeScreen';
import { ARDrawingScreen } from './components/ARDrawingScreen';
import { AdminPanel } from './components/AdminPanel';
import { SettingsScreen } from './components/SettingsScreen';
import { SplashScreen } from './components/SplashScreen';
import { auth, isUserAdmin } from './firebase';
import { User } from 'firebase/auth';

import { getAppThemeConfig, applyThemeToCss } from './utils/productManager';

export default function App() {
  const [showSplash, setShowSplash] = useState(true);
  const [currentScreen, setCurrentScreen] = useState<AppScreen>('home');
  const [activeImageSrc, setActiveImageSrc] = useState<string | undefined>(undefined);
  const [activeImageName, setActiveImageName] = useState<string | undefined>(undefined);
  const [currentTheme, setCurrentTheme] = useState<string>(() => getAppThemeConfig().themeColor);

  // Initialize theme on mount & listen for real-time changes
  useEffect(() => {
    const config = getAppThemeConfig();
    applyThemeToCss(config);
    setCurrentTheme(config.themeColor);

    const handleThemeEvent = (e: any) => {
      if (e.detail) {
        setCurrentTheme(e.detail.themeColor);
      }
    };
    window.addEventListener('sketchflow_theme_changed', handleThemeEvent);
    return () => window.removeEventListener('sketchflow_theme_changed', handleThemeEvent);
  }, []);

  // Admin state - Preserved across Back navigation via localStorage
  const [isAdmin, setIsAdmin] = useState<boolean>(() => {
    const token = localStorage.getItem('sketchflow_admin_token') || sessionStorage.getItem('sketchflow_admin_token');
    const email = localStorage.getItem('sketchflow_admin_email') || sessionStorage.getItem('sketchflow_admin_email');
    return !!token || (!!email && isUserAdmin(email));
  });

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user: User | null) => {
      const token = localStorage.getItem('sketchflow_admin_token') || sessionStorage.getItem('sketchflow_admin_token');
      const email = localStorage.getItem('sketchflow_admin_email') || sessionStorage.getItem('sketchflow_admin_email');
      const hasPersist = !!token || (!!email && isUserAdmin(email));
      const isAdm = isUserAdmin(user) || hasPersist;
      setIsAdmin(isAdm);
    });
    return () => unsubscribe();
  }, []);

  const handleStartAR = (imageSrc?: string, imageName?: string) => {
    setActiveImageSrc(imageSrc);
    setActiveImageName(imageName);
    setCurrentScreen('ar');
  };

  const handleBackToHome = () => {
    setCurrentScreen('home');
  };

  return (
    <div className="min-h-[100dvh] w-full flex justify-center bg-white text-neutral-900">
      {showSplash && (
        <SplashScreen
          onFinish={() => setShowSplash(false)}
          themeKey={currentTheme}
        />
      )}

      <div
        className={`w-full min-h-[100dvh] flex flex-col relative bg-white ${
          currentScreen === 'ar' ? 'max-w-none shadow-none' : 'max-w-2xl shadow-2xl'
        }`}
      >
        {currentScreen === 'home' && (
          <HomeScreen
            onStartAR={handleStartAR}
            onOpenAdmin={() => setCurrentScreen('admin')}
            onOpenSettings={() => setCurrentScreen('settings')}
            isAdmin={isAdmin}
            onAdminStatusChange={setIsAdmin}
          />
        )}

        {currentScreen === 'ar' && (
          <ARDrawingScreen
            onBack={handleBackToHome}
            initialImageSrc={activeImageSrc}
            initialImageName={activeImageName}
          />
        )}

        {currentScreen === 'admin' && (
          <AdminPanel
            onBack={handleBackToHome}
          />
        )}

        {currentScreen === 'settings' && (
          <SettingsScreen
            onBack={handleBackToHome}
            currentTheme={currentTheme}
            onThemeChange={setCurrentTheme}
            onOpenAdmin={() => setCurrentScreen('admin')}
            isAdmin={isAdmin}
          />
        )}
      </div>
    </div>
  );
}
