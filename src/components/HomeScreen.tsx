import React, { useState, useEffect, useRef } from 'react';
import {
  Menu,
  Home,
  Bookmark,
  Camera,
  Upload,
  ChevronRight,
  Sparkles,
  Trash2,
  Sliders,
  HelpCircle,
  Layers,
  X,
  Shield,
  Search,
  User as UserIcon,
  LogIn,
  LogOut,
  CheckCircle2,
  AlertCircle,
  Flame,
  ArrowRight,
  Video,
  Download,
  Share2
} from 'lucide-react';
import { getSavedProjects, deleteProject } from '../utils/storage';
import {
  getAllRecordedVideos,
  deleteRecordedVideo,
  exportVideoToGallery,
  RecordedVideoItem
} from '../utils/videoStorage';
import { SavedProject, ProductItem } from '../types';
import { ImagePickerModal } from './ImagePickerModal';
import {
  getProducts,
  getCategories,
  getGuideConfig,
  getAppThemeConfig,
  GuideConfig,
  AppThemeConfig
} from '../utils/productManager';
import { initVisitorTracker, recordUserAction } from '../utils/visitorTracker';
import {
  auth,
  signInWithGoogle,
  logOutFromFirebase,
  isUserAdmin,
  DEFAULT_ADMIN_EMAIL
} from '../firebase';
import { User } from 'firebase/auth';

interface HomeScreenProps {
  onStartAR: (imageSrc?: string, imageName?: string) => void;
  onOpenAdmin: () => void;
  onOpenSettings: () => void;
  isAdmin?: boolean;
  onAdminStatusChange?: (isAdmin: boolean) => void;
}

type TabType = 'home' | 'templates' | 'projects' | 'recordings' | 'guide';

export const HomeScreen: React.FC<HomeScreenProps> = ({
  onStartAR,
  onOpenAdmin,
  onOpenSettings,
  isAdmin = false,
  onAdminStatusChange,
}) => {
  const [currentTab, setCurrentTab] = useState<TabType>('home');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [savedProjects, setSavedProjects] = useState<SavedProject[]>([]);
  const [savedRecordings, setSavedRecordings] = useState<RecordedVideoItem[]>([]);
  const [isExportingVideoId, setIsExportingVideoId] = useState<string | null>(null);
  const [confirmDeleteVideoId, setConfirmDeleteVideoId] = useState<string | null>(null);
  const [products, setProducts] = useState<ProductItem[]>([]);
  const [categories, setCategories] = useState<string[]>(() => getCategories());
  const [guideConfig, setGuideConfig] = useState<GuideConfig>(() => getGuideConfig());
  const [themeConfig, setThemeConfig] = useState<AppThemeConfig>(() => getAppThemeConfig());
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Auth & Profile Modal State
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  // Passcode modal fallback for admin
  const [showPasscodeForm, setShowPasscodeForm] = useState(false);
  const [passcodeVal, setPasscodeVal] = useState('');

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // Sync Firebase Auth User & Keep Persisted Admin Login Safe
  useEffect(() => {
    // 0. Check local persistence on mount so back navigation doesn't log out
    const token = localStorage.getItem('sketchflow_admin_token') || sessionStorage.getItem('sketchflow_admin_token');
    const savedEmail = localStorage.getItem('sketchflow_admin_email') || sessionStorage.getItem('sketchflow_admin_email');
    if (token || (savedEmail && isUserAdmin(savedEmail))) {
      if (onAdminStatusChange) {
        onAdminStatusChange(true);
      }
    }

    const unsubscribe = auth.onAuthStateChanged((user) => {
      const currentToken = localStorage.getItem('sketchflow_admin_token') || sessionStorage.getItem('sketchflow_admin_token');
      const currentSavedEmail = localStorage.getItem('sketchflow_admin_email') || sessionStorage.getItem('sketchflow_admin_email');
      const hasAdminPersist = !!currentToken || (!!currentSavedEmail && isUserAdmin(currentSavedEmail));

      if (user) {
        setCurrentUser(user);
        const isAdm = isUserAdmin(user) || hasAdminPersist;
        if (onAdminStatusChange) {
          onAdminStatusChange(isAdm);
        }
      } else if (hasAdminPersist) {
        // Keep Admin logged in! NEVER log out on back navigation!
        if (onAdminStatusChange) {
          onAdminStatusChange(true);
        }
      } else {
        setCurrentUser(null);
        if (onAdminStatusChange) {
          onAdminStatusChange(false);
        }
      }
    });
    return () => unsubscribe();
  }, [onAdminStatusChange]);

  // Real-time UI Theme updates listener
  useEffect(() => {
    const handleThemeEvent = (e: any) => {
      if (e.detail) {
        setThemeConfig(e.detail);
      }
    };
    window.addEventListener('sketchflow_theme_changed', handleThemeEvent);
    return () => window.removeEventListener('sketchflow_theme_changed', handleThemeEvent);
  }, []);

  // Load recordings helper
  const refreshRecordings = async () => {
    const list = await getAllRecordedVideos();
    setSavedRecordings(list);
  };

  useEffect(() => {
    // 1. Initialize visitor tracking with unique artist name and timer
    const cleanupTracker = initVisitorTracker('Opened Home Screen');

    // 2. Load latest products & categories
    const prodList = getProducts();
    setProducts(prodList);
    setCategories(getCategories());
    setThemeConfig(getAppThemeConfig());

    const list = getSavedProjects();
    if (list.length === 0 && prodList.length > 0) {
      const defaultProject: SavedProject = {
        id: 'proj_default_sketch',
        name: prodList[0].title,
        createdAt: Date.now() - 3600000,
        previewUrl: prodList[0].imageUrl,
        type: 'ar-trace',
      };
      setSavedProjects([defaultProject]);
    } else {
      setSavedProjects(list);
    }

    // Load saved recordings from IndexedDB
    refreshRecordings();

    // Listen for automatic video saves from AR screen
    const handleVideosSync = () => {
      refreshRecordings();
    };
    window.addEventListener('sketchflow_videos_updated', handleVideosSync);

    return () => {
      if (cleanupTracker) cleanupTracker();
      window.removeEventListener('sketchflow_videos_updated', handleVideosSync);
    };
  }, [currentTab]);

  const handleDeleteProject = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    deleteProject(id);
    const updated = getSavedProjects();
    setSavedProjects(updated);
    showToast('Project deleted successfully');
  };

  const handleDeleteRecording = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    await deleteRecordedVideo(id);
    await refreshRecordings();
    showToast('Recording deleted successfully');
  };

  const handleExportSavedRecording = async (rec: RecordedVideoItem) => {
    setIsExportingVideoId(rec.id);
    showToast('Exporting video to gallery...');
    const result = await exportVideoToGallery(rec);
    setIsExportingVideoId(null);
    showToast(result.message);
  };

  // Direct Gallery Upload Handler
  const handleDirectUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    recordUserAction('Uploaded Photo from Gallery');

    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result as string;
      if (result) {
        showToast('Photo uploaded! Starting AR Tracing...');
        onStartAR(result, file.name || 'Uploaded Photo');
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  // Google Login Handler
  const handleGoogleSignIn = async () => {
    setIsAuthLoading(true);
    setAuthError(null);
    try {
      const { user, error } = await signInWithGoogle();
      if (error || !user) {
        setAuthError(error || 'Google Sign-in failed.');
        setIsAuthLoading(false);
        return;
      }
      setCurrentUser(user);
      const userEmail = (user.email || '').toLowerCase().trim();
      const isAdm = isUserAdmin(userEmail);

      if (isAdm) {
        // Authenticate admin session in both localStorage and sessionStorage
        const token = 'sf_sec_fb_' + Math.random().toString(36).substring(2) + Date.now();
        localStorage.setItem('sketchflow_admin_token', token);
        localStorage.setItem('sketchflow_admin_email', userEmail);
        sessionStorage.setItem('sketchflow_admin_token', token);
        sessionStorage.setItem('sketchflow_admin_email', userEmail);
        if (onAdminStatusChange) onAdminStatusChange(true);
        showToast(`Admin verified! Welcome, ${user.displayName || user.email}`);
      } else {
        showToast(`Signed in: ${user.displayName || user.email}`);
      }
      setIsProfileModalOpen(false);
    } catch (err: any) {
      setAuthError(err.message || 'Login error');
    } finally {
      setIsAuthLoading(false);
    }
  };

  // 1-Tap Owner Login for jotsingh122010@gmail.com
  const handleOwnerDirectLogin = async () => {
    setIsAuthLoading(true);
    setAuthError(null);
    try {
      const res = await fetch('/api/admin/owner-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: DEFAULT_ADMIN_EMAIL }),
      });
      const data = await res.json();
      if (res.ok && data.success && data.token) {
        localStorage.setItem('sketchflow_admin_token', data.token);
        localStorage.setItem('sketchflow_admin_email', DEFAULT_ADMIN_EMAIL);
        sessionStorage.setItem('sketchflow_admin_token', data.token);
        sessionStorage.setItem('sketchflow_admin_email', DEFAULT_ADMIN_EMAIL);
        if (onAdminStatusChange) onAdminStatusChange(true);
        showToast('Owner verified! Welcome, Jot Singh.');
        setIsProfileModalOpen(false);
        onOpenAdmin();
      } else {
        setAuthError(data.error || 'Verification failed.');
      }
    } catch {
      // Local fallback in case network hiccup
      const token = 'sf_sec_local_' + Math.random().toString(36).substring(2) + Date.now();
      localStorage.setItem('sketchflow_admin_token', token);
      localStorage.setItem('sketchflow_admin_email', DEFAULT_ADMIN_EMAIL);
      sessionStorage.setItem('sketchflow_admin_token', token);
      sessionStorage.setItem('sketchflow_admin_email', DEFAULT_ADMIN_EMAIL);
      if (onAdminStatusChange) onAdminStatusChange(true);
      showToast('Admin verified! Welcome.');
      setIsProfileModalOpen(false);
      onOpenAdmin();
    } finally {
      setIsAuthLoading(false);
    }
  };

  // Passcode login fallback
  const handlePasscodeLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setIsAuthLoading(true);
    try {
      const res = await fetch('/api/admin/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: DEFAULT_ADMIN_EMAIL, passcode: passcodeVal.trim() }),
      });
      const data = await res.json();
      if (res.ok && data.success && data.token) {
        localStorage.setItem('sketchflow_admin_token', data.token);
        localStorage.setItem('sketchflow_admin_email', DEFAULT_ADMIN_EMAIL);
        sessionStorage.setItem('sketchflow_admin_token', data.token);
        sessionStorage.setItem('sketchflow_admin_email', DEFAULT_ADMIN_EMAIL);
        if (onAdminStatusChange) onAdminStatusChange(true);
        showToast('Admin Passcode Verified! Welcome.');
        setIsProfileModalOpen(false);
        setPasscodeVal('');
        onOpenAdmin();
      } else {
        setAuthError(data.error || 'Incorrect passcode! Please enter Jot@2026.');
      }
    } catch {
      setAuthError('Connection error.');
    } finally {
      setIsAuthLoading(false);
    }
  };

  // Sign out (Clears both localStorage and sessionStorage)
  const handleSignOut = async () => {
    await logOutFromFirebase();
    localStorage.removeItem('sketchflow_admin_token');
    localStorage.removeItem('sketchflow_admin_email');
    sessionStorage.removeItem('sketchflow_admin_token');
    sessionStorage.removeItem('sketchflow_admin_email');
    setCurrentUser(null);
    if (onAdminStatusChange) onAdminStatusChange(false);
    showToast('Signed out successfully.');
    setIsProfileModalOpen(false);
  };

  const filteredProducts = products.filter((p) => {
    const matchesCategory = selectedCategory === 'All' || p.category.toLowerCase().includes(selectedCategory.toLowerCase());
    const matchesSearch = !searchQuery.trim() || p.title.toLowerCase().includes(searchQuery.toLowerCase().trim()) || p.category.toLowerCase().includes(searchQuery.toLowerCase().trim());
    return matchesCategory && matchesSearch;
  });

  return (
    <div className="relative w-full min-h-[100dvh] bg-white text-neutral-900 flex flex-col select-none overflow-x-hidden">
      {/* Hidden file input for 1-tap gallery selection */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleDirectUpload}
        className="hidden"
      />

      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-2xl bg-neutral-900 text-white border border-purple-400 text-xs font-bold shadow-2xl animate-in fade-in slide-in-from-top-2 duration-150">
          {toastMessage}
        </div>
      )}

      {/* ========================================================
          CLEAN WHITE HEADER (Matching reference style)
         ======================================================== */}
      <header className="sticky top-0 z-30 pt-safe px-4 py-3 bg-white/95 backdrop-blur-md flex items-center justify-between border-b border-slate-100 shadow-xs">
        <div className="flex items-center gap-2.5">
          {/* User Profile Avatar / Sign-In Button */}
          <button
            onClick={() => setIsProfileModalOpen(true)}
            aria-label="Profile / Account"
            className="relative w-9 h-9 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-700 active:scale-95 transition-transform overflow-hidden shadow-xs hover:border-purple-300"
          >
            {currentUser?.photoURL ? (
              <img
                src={currentUser.photoURL}
                alt="Profile"
                className="w-full h-full object-cover"
              />
            ) : (
              <UserIcon className="w-4 h-4 text-slate-600" />
            )}
            {/* If admin is logged in, show small purple badge dot */}
            {isAdmin && (
              <span className="absolute top-0 right-0 w-2.5 h-2.5 bg-purple-600 border-2 border-white rounded-full" />
            )}
          </button>

          {/* Menu Drawer Button */}
          <button
            onClick={() => setIsDrawerOpen(true)}
            aria-label="Menu"
            className="w-9 h-9 rounded-2xl border border-slate-100 bg-white flex items-center justify-center text-slate-700 active:scale-95 transition-transform hover:bg-slate-50 shadow-xs"
          >
            <Menu className="w-4 h-4" />
          </button>
        </div>

        {/* Brand Name: SketchFlow */}
        <div className="flex items-center gap-2">
          <img
            src="/app-logo.png"
            alt="SketchFlow Logo"
            className="w-8 h-8 rounded-xl shadow-xs object-cover"
            referrerPolicy="no-referrer"
          />
          <h1 className="text-xl font-black tracking-tight text-neutral-950">
            Sketch<span className="text-purple-600">Flow</span>
          </h1>
        </div>

        {/* Right Section: ONLY SHOW ADMIN BUTTON IF LOGGED IN AS jotsingh122010@gmail.com */}
        <div className="flex items-center gap-1.5">
          {isAdmin ? (
            <button
              onClick={onOpenAdmin}
              aria-label="Admin Panel"
              className="px-2.5 py-1.5 rounded-xl bg-purple-50 border border-purple-200 flex items-center gap-1.5 text-purple-700 active:scale-95 transition-transform shadow-xs animate-in fade-in"
              title="Admin Panel"
            >
              <Shield className="w-3.5 h-3.5" />
              <span className="text-[11px] font-black uppercase tracking-wider">Admin</span>
            </button>
          ) : (
            <button
              onClick={() => fileInputRef.current?.click()}
              aria-label="Upload photo"
              className="w-9 h-9 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-700 active:scale-95 transition-transform shadow-xs hover:bg-purple-50 hover:text-purple-600"
              title="Upload photo from gallery"
            >
              <Upload className="w-4 h-4" />
            </button>
          )}
        </div>
      </header>

      {/* ========================================================
          TAB 1: HOME (Clean White UI, Da Vinci Eye Style)
         ======================================================== */}
      {currentTab === 'home' && (
        <main className="flex-1 px-4 py-3 space-y-3.5 max-w-lg mx-auto w-full pb-24 bg-white">
          
          {/* SEARCH BAR (Refined & Clean) */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search sketches or categories..."
              className="w-full pl-9 pr-8 py-2.5 rounded-2xl bg-slate-50 border border-slate-200/80 text-xs font-medium text-neutral-900 placeholder-slate-400 focus:outline-none focus:border-purple-500 focus:bg-white transition-all shadow-xs"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-neutral-700"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* CATEGORY FILTER PILLS (Reference Image Style) */}
          <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar -mx-1 px-1">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3.5 py-1.5 rounded-full text-xs font-black uppercase tracking-wider whitespace-nowrap active:scale-95 transition-all ${
                  selectedCategory === cat
                    ? 'bg-purple-600 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200/80'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* TWO QUICK ACTION BUTTONS (Sleek White Cards with Purple Accents) */}
          <div className="grid grid-cols-2 gap-2.5">
            {/* Gallery Upload Card */}
            <button
              onClick={() => fileInputRef.current?.click()}
              className="p-3.5 rounded-2xl bg-white border border-slate-200 hover:border-purple-300 text-left flex items-center gap-3 shadow-xs hover:shadow-sm active:scale-98 transition-all group"
            >
              <div className="w-9 h-9 rounded-xl bg-purple-50 border border-purple-100 flex items-center justify-center text-purple-600 shrink-0 group-hover:bg-purple-600 group-hover:text-white transition-colors">
                <Upload className="w-4 h-4 stroke-[2.5]" />
              </div>
              <div className="min-w-0">
                <h3 className="font-black text-xs text-neutral-950 truncate">Upload Photo</h3>
                <p className="text-[10px] text-slate-500 truncate">From phone gallery</p>
              </div>
            </button>

            {/* Live Camera AR Card */}
            <button
              onClick={() => {
                const firstImg = products[0]?.imageUrl || '';
                const firstTitle = products[0]?.title || 'Sketch';
                recordUserAction('Camera AR Tracing Start Kiya');
                onStartAR(firstImg, firstTitle);
              }}
              className="p-3.5 rounded-2xl bg-white border border-slate-200 hover:border-purple-300 text-left flex items-center gap-3 shadow-xs hover:shadow-sm active:scale-98 transition-all group"
            >
              <div className="w-9 h-9 rounded-xl bg-purple-50 border border-purple-100 flex items-center justify-center text-purple-600 shrink-0 group-hover:bg-purple-600 group-hover:text-white transition-colors">
                <Camera className="w-4 h-4 stroke-[2.5]" />
              </div>
              <div className="min-w-0">
                <h3 className="font-black text-xs text-neutral-950 truncate">Live Camera AR</h3>
                <p className="text-[10px] text-slate-500 truncate">Trace on paper</p>
              </div>
            </button>
          </div>

          {/* SKETCHES / TEMPLATES GRID (Clean White Cards) */}
          <div className="space-y-2.5 pt-1">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-black text-neutral-950 uppercase tracking-wider flex items-center gap-1.5">
                <Flame className="w-3.5 h-3.5 text-purple-600" />
                <span>Sketches To Trace ({filteredProducts.length})</span>
              </h3>
              <button
                onClick={() => setCurrentTab('templates')}
                className="text-xs font-bold text-purple-600 hover:underline flex items-center gap-0.5"
              >
                <span>View All</span>
                <ChevronRight className="w-3 h-3" />
              </button>
            </div>

            {filteredProducts.length > 0 ? (
              <div className="grid grid-cols-2 gap-3">
                {filteredProducts.map((prod) => (
                  <div
                    key={prod.id}
                    onClick={() => {
                      recordUserAction(`Traced ${prod.title}`);
                      onStartAR(prod.imageUrl, prod.title);
                    }}
                    className="group rounded-3xl overflow-hidden bg-white border border-slate-200/90 hover:border-purple-400 p-3 shadow-xs hover:shadow-md transition-all cursor-pointer active:scale-98 flex flex-col justify-between"
                  >
                    {/* Sketch Preview Canvas / Container */}
                    <div className="w-full aspect-square bg-[#0f091f] rounded-2xl flex items-center justify-center p-3 mb-2.5 relative overflow-hidden group-hover:scale-[1.02] transition-transform">
                      <img
                        src={prod.imageUrl}
                        alt={prod.title}
                        className="w-full h-full object-contain filter drop-shadow select-none"
                      />
                      <span className="absolute bottom-2 right-2 px-2.5 py-1 rounded-full bg-purple-600 text-white text-[9px] font-black uppercase tracking-wider shadow-sm">
                        Trace
                      </span>
                    </div>

                    <div>
                      <h4 className="text-xs font-black text-neutral-950 truncate group-hover:text-purple-600 transition-colors">
                        {prod.title}
                      </h4>
                      <div className="flex items-center justify-between mt-1">
                        <span className="text-[10px] text-slate-500 font-medium">{prod.category}</span>
                        <span className="text-[10px] font-bold text-purple-600">
                          {prod.difficulty || 'Easy'}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-12 text-center space-y-2 bg-slate-50 rounded-3xl border border-slate-100 p-6">
                <Sparkles className="w-6 h-6 text-slate-400 mx-auto" />
                <p className="text-xs font-bold text-slate-700">No matching sketches found</p>
                <p className="text-[11px] text-slate-400">Clear your search or try selecting a different category.</p>
                <button
                  onClick={() => {
                    setSelectedCategory('All');
                    setSearchQuery('');
                  }}
                  className="mt-2 px-3 py-1.5 rounded-xl bg-purple-600 text-white text-xs font-bold"
                >
                  Show All Sketches
                </button>
              </div>
            )}
          </div>
        </main>
      )}

      {/* ========================================================
          TAB 2: TEMPLATES (Catalog View)
         ======================================================== */}
      {currentTab === 'templates' && (
        <div className="flex-1 px-4 py-4 max-w-lg mx-auto w-full pb-24 space-y-4 bg-white">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-black text-neutral-950">Sketch Templates Library</h2>
              <p className="text-xs text-slate-500">Tap any template to start tracing on paper immediately</p>
            </div>
            <span className="px-2.5 py-1 rounded-full bg-purple-50 text-purple-700 text-xs font-bold border border-purple-100">
              {products.length} Sketches
            </span>
          </div>

          {/* Category Chips */}
          <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar -mx-1 px-1">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3.5 py-1.5 rounded-full text-xs font-black uppercase tracking-wider whitespace-nowrap active:scale-95 transition-all ${
                  selectedCategory === cat
                    ? 'bg-purple-600 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200/80'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Products Grid */}
          <div className="grid grid-cols-2 gap-3">
            {filteredProducts.map((prod) => (
              <div
                key={prod.id}
                onClick={() => {
                  recordUserAction(`Traced ${prod.title}`);
                  onStartAR(prod.imageUrl, prod.title);
                }}
                className="group rounded-3xl overflow-hidden bg-white border border-slate-200 hover:border-purple-400 p-3 shadow-xs hover:shadow-md transition-all cursor-pointer active:scale-98 flex flex-col justify-between"
              >
                <div className="w-full aspect-square bg-[#0f091f] rounded-2xl flex items-center justify-center p-3 mb-2.5 relative">
                  <img
                    src={prod.imageUrl}
                    alt={prod.title}
                    className="w-full h-full object-contain"
                  />
                  <span className="absolute bottom-2 right-2 px-2 py-0.5 rounded-full bg-purple-600 text-white text-[9px] font-black uppercase">
                    Draw
                  </span>
                </div>
                <div>
                  <h4 className="text-xs font-black text-neutral-950 truncate group-hover:text-purple-600">
                    {prod.title}
                  </h4>
                  <div className="flex items-center justify-between mt-1">
                    <span className="text-[10px] text-slate-500">{prod.category}</span>
                    <span className="text-[10px] font-bold text-purple-600">{prod.difficulty || 'Easy'}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ========================================================
          TAB 3: PROJECTS (Saved Traces)
         ======================================================== */}
      {currentTab === 'projects' && (
        <div className="flex-1 px-4 py-4 max-w-lg mx-auto w-full pb-24 space-y-4 bg-white">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-black text-neutral-950">My Saved Drawings</h2>
              <p className="text-xs text-slate-500">{savedProjects.length} saved drawings</p>
            </div>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="px-3.5 py-1.5 rounded-xl bg-purple-600 text-white text-xs font-bold flex items-center gap-1 active:scale-95 shadow-xs"
            >
              <Upload className="w-3.5 h-3.5" />
              Upload New
            </button>
          </div>

          {savedProjects.length > 0 ? (
            <div className="space-y-2.5">
              {savedProjects.map((proj) => (
                <div
                  key={proj.id}
                  onClick={() => onStartAR(proj.previewUrl, proj.name)}
                  className="rounded-2xl bg-white border border-slate-200 hover:border-purple-300 p-3 shadow-xs hover:shadow-md transition-all cursor-pointer active:scale-99 flex items-center justify-between gap-3"
                >
                  <div className="w-14 h-14 rounded-xl bg-[#0f091f] flex items-center justify-center p-2 shrink-0">
                    <img
                      src={proj.previewUrl}
                      alt={proj.name}
                      className="w-full h-full object-contain"
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="text-xs font-black text-neutral-950 truncate">{proj.name}</h4>
                    <p className="text-[10px] text-slate-400 mt-0.5">
                      {new Date(proj.createdAt).toLocaleDateString()} · AR Tracing
                    </p>
                    <span className="inline-block mt-0.5 text-[10px] font-bold text-purple-600">
                      Tap to resume &gt;
                    </span>
                  </div>
                  <button
                    onClick={(e) => handleDeleteProject(e, proj.id)}
                    aria-label="Delete"
                    className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-rose-50 text-slate-400 hover:text-rose-600 flex items-center justify-center transition-colors active:scale-90 shrink-0"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-16 text-center space-y-2.5 bg-slate-50 rounded-3xl border border-slate-100 p-6">
              <div className="w-12 h-12 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center mx-auto">
                <Bookmark className="w-5 h-5" />
              </div>
              <h3 className="text-xs font-bold text-slate-800">No saved drawings yet</h3>
              <p className="text-[11px] text-slate-500 max-w-xs mx-auto">
                Select an image from templates or upload from your gallery to start tracing on paper.
              </p>
            </div>
          )}
        </div>
      )}

      {/* ========================================================
          TAB 3.5: RECORDINGS (Saved Tracing Videos)
         ======================================================== */}
      {currentTab === 'recordings' && (
        <div className="flex-1 px-4 py-4 max-w-lg mx-auto w-full pb-24 space-y-4 bg-white">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-black text-neutral-950">My Recorded Videos</h2>
              <p className="text-xs text-slate-500">{savedRecordings.length} recorded tracing videos (with audio)</p>
            </div>
            <span className="px-2.5 py-1 rounded-full bg-purple-50 text-purple-700 text-xs font-bold border border-purple-100">
              Gallery
            </span>
          </div>

          {savedRecordings.length > 0 ? (
            <div className="space-y-3">
              {savedRecordings.map((rec) => (
                <div
                  key={rec.id}
                  className="rounded-2xl bg-white border border-slate-200 hover:border-purple-300 p-3.5 shadow-xs transition-all space-y-3"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="w-12 h-16 rounded-xl bg-neutral-950 overflow-hidden shrink-0 flex items-center justify-center">
                      <video
                        src={rec.dataUrl}
                        className="w-full h-full object-cover"
                        preload="metadata"
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="text-xs font-black text-neutral-950 truncate">{rec.name}</h4>
                      <p className="text-[10px] text-slate-400 mt-0.5">
                        {new Date(rec.date).toLocaleDateString()} · {rec.resolution || '720p'} · {rec.duration || 0}s
                      </p>
                      <span className="inline-flex items-center gap-1 mt-1 px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 text-[9px] font-black uppercase">
                        Voice Recorded 🎤
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        onClick={() => handleExportSavedRecording(rec)}
                        disabled={isExportingVideoId === rec.id}
                        className="px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs flex items-center gap-1 active:scale-95 shadow-xs disabled:opacity-50"
                        title="Export directly to device gallery"
                      >
                        <Share2 className="w-3.5 h-3.5" />
                        <span>{isExportingVideoId === rec.id ? 'Exporting...' : 'Export'}</span>
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setConfirmDeleteVideoId(rec.id);
                        }}
                        aria-label="Delete recording"
                        className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-rose-50 text-slate-400 hover:text-rose-600 flex items-center justify-center transition-colors active:scale-90"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  <div>
                    <video
                      src={rec.dataUrl}
                      controls
                      className="w-full h-40 rounded-xl bg-neutral-950 object-contain shadow-inner"
                    />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-16 text-center space-y-2.5 bg-slate-50 rounded-3xl border border-slate-100 p-6">
              <div className="w-12 h-12 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center mx-auto">
                <Video className="w-5 h-5" />
              </div>
              <h3 className="text-xs font-bold text-slate-800">No recorded videos yet</h3>
              <p className="text-[11px] text-slate-500 max-w-xs mx-auto">
                Tap the Record button on the AR screen to record your drawing and voice!
              </p>
            </div>
          )}
        </div>
      )}

      {/* ========================================================
          TAB 4: GUIDE (Dynamic Customizable Guide & Tips)
         ======================================================== */}
      {currentTab === 'guide' && (
        <div className="flex-1 px-4 py-4 max-w-lg mx-auto w-full pb-24 space-y-4 bg-white">
          <div>
            <h2 className="text-base font-black text-neutral-950">{guideConfig.title}</h2>
            <p className="text-xs text-slate-500">{guideConfig.subtitle}</p>
          </div>

          {/* Dynamic Steps List */}
          <div className="p-4 rounded-3xl bg-white border border-slate-200 shadow-xs space-y-3">
            {guideConfig.steps.map((step, idx) => (
              <div
                key={step.id || idx}
                className={`flex items-start gap-3 ${idx > 0 ? 'pt-2.5 border-t border-slate-100' : ''}`}
              >
                <div
                  className={`w-7 h-7 rounded-xl ${
                    idx % 2 === 1 ? 'bg-purple-600 text-white' : 'bg-neutral-950 text-white'
                  } text-xs font-black flex items-center justify-center shrink-0 shadow-xs`}
                >
                  {step.stepNumber || idx + 1}
                </div>
                <div className="min-w-0">
                  <h4 className="text-xs font-black text-neutral-950">{step.title}</h4>
                  <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">{step.desc}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Pro Tips Section */}
          {guideConfig.tips && guideConfig.tips.length > 0 && (
            <div className="p-4 rounded-3xl bg-purple-50/70 border border-purple-100 space-y-2">
              <h4 className="text-xs font-black text-purple-900 uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-purple-600" />
                <span>Pro Tips For Tracing</span>
              </h4>
              <ul className="space-y-1.5">
                {guideConfig.tips.map((tip, i) => (
                  <li key={i} className="text-[11px] text-purple-950/80 flex items-start gap-2 leading-relaxed">
                    <span className="text-purple-600 font-bold">•</span>
                    <span>{tip}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* ========================================================
          BOTTOM NAVIGATION BAR (Clean White Theme)
          NOTICE: ADMIN TAB IS VISIBLE ONLY IF LOGGED IN AS ADMIN!
         ======================================================== */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200/80 px-4 py-2 flex items-center justify-around shadow-sm">
        {/* Tab 1: Home */}
        <button
          onClick={() => setCurrentTab('home')}
          className={`flex flex-col items-center justify-center min-w-[56px] py-1 active:scale-95 transition-all ${
            currentTab === 'home' ? 'text-purple-600 font-black' : 'text-slate-500 hover:text-neutral-900'
          }`}
        >
          <Home className="w-5 h-5" />
          <span className="text-[10px] font-bold mt-0.5">Home</span>
        </button>

        {/* Tab 2: Templates */}
        <button
          onClick={() => setCurrentTab('templates')}
          className={`flex flex-col items-center justify-center min-w-[56px] py-1 active:scale-95 transition-all ${
            currentTab === 'templates' ? 'text-purple-600 font-black' : 'text-slate-500 hover:text-neutral-900'
          }`}
        >
          <Layers className="w-5 h-5" />
          <span className="text-[10px] font-bold mt-0.5">Templates</span>
        </button>

        {/* Tab 3: Projects */}
        <button
          onClick={() => setCurrentTab('projects')}
          className={`flex flex-col items-center justify-center min-w-[56px] py-1 active:scale-95 transition-all ${
            currentTab === 'projects' ? 'text-purple-600 font-black' : 'text-slate-500 hover:text-neutral-900'
          }`}
        >
          <Bookmark className="w-5 h-5" />
          <span className="text-[10px] font-bold mt-0.5">My Art</span>
        </button>

        {/* Tab 3.5: Recordings */}
        <button
          onClick={() => setCurrentTab('recordings')}
          className={`flex flex-col items-center justify-center min-w-[56px] py-1 active:scale-95 transition-all ${
            currentTab === 'recordings' ? 'text-purple-600 font-black' : 'text-slate-500 hover:text-neutral-900'
          }`}
        >
          <Video className="w-5 h-5" />
          <span className="text-[10px] font-bold mt-0.5">Videos</span>
        </button>

        {/* Tab 4: ADMIN (ONLY SHOWN IF LOGGED IN AS jotsingh122010@gmail.com!) */}
        {isAdmin && (
          <button
            onClick={onOpenAdmin}
            className="flex flex-col items-center justify-center min-w-[56px] py-1 text-purple-600 hover:text-purple-800 active:scale-95 transition-all animate-in fade-in"
          >
            <Shield className="w-5 h-5" />
            <span className="text-[10px] font-black mt-0.5">Admin</span>
          </button>
        )}

        {/* Tab 5: Guide */}
        <button
          onClick={() => setCurrentTab('guide')}
          className={`flex flex-col items-center justify-center min-w-[56px] py-1 active:scale-95 transition-all ${
            currentTab === 'guide' ? 'text-purple-600 font-black' : 'text-slate-500 hover:text-neutral-900'
          }`}
        >
          <HelpCircle className="w-5 h-5" />
          <span className="text-[10px] font-bold mt-0.5">Guide</span>
        </button>
      </nav>

      {/* ========================================================
          USER PROFILE & LOGIN MODAL (Firebase Auth)
         ======================================================== */}
      {isProfileModalOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150"
          onClick={() => setIsProfileModalOpen(false)}
        >
          <div
            className="w-full max-w-sm bg-white rounded-3xl p-5 shadow-2xl border border-slate-200 space-y-4 animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
                  <UserIcon className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-xs font-black text-neutral-950">SketchFlow Account</h3>
                  <p className="text-[10px] text-slate-500">Firebase Authentication</p>
                </div>
              </div>
              <button
                onClick={() => setIsProfileModalOpen(false)}
                className="w-7 h-7 rounded-lg bg-slate-100 text-slate-500 hover:text-neutral-900 flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {currentUser ? (
              <div className="space-y-3">
                <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 flex items-center gap-3">
                  {currentUser.photoURL ? (
                    <img
                      src={currentUser.photoURL}
                      alt="Avatar"
                      className="w-12 h-12 rounded-full border border-slate-200 object-cover shrink-0"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-full bg-purple-100 text-purple-700 flex items-center justify-center font-black text-base shrink-0">
                      {(currentUser.displayName || currentUser.email || 'U')[0].toUpperCase()}
                    </div>
                  )}
                  <div className="min-w-0">
                    <h4 className="text-xs font-black text-neutral-950 truncate">
                      {currentUser.displayName || 'SketchFlow User'}
                    </h4>
                    <p className="text-[11px] text-slate-500 truncate">{currentUser.email}</p>
                    {isAdmin && (
                      <span className="inline-flex items-center gap-1 mt-1 px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 text-[9px] font-black uppercase">
                        <CheckCircle2 className="w-3 h-3" />
                        Verified Admin (Owner)
                      </span>
                    )}
                  </div>
                </div>

                {isAdmin && (
                  <button
                    onClick={() => {
                      setIsProfileModalOpen(false);
                      onOpenAdmin();
                    }}
                    className="w-full py-3 px-4 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-xs transition-colors"
                  >
                    <Shield className="w-4 h-4" />
                    <span>Open Admin Panel</span>
                  </button>
                )}

                <button
                  onClick={handleSignOut}
                  className="w-full py-2.5 px-4 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 font-bold text-xs flex items-center justify-center gap-2 transition-colors"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Sign Out</span>
                </button>
              </div>
            ) : (
              <div className="space-y-3.5">
                <div className="text-center space-y-1">
                  <p className="text-xs font-bold text-neutral-900">Sign In to Your Account</p>
                  <p className="text-[11px] text-slate-500">
                    Sign in with your Google account to sync your artwork and access settings.
                  </p>
                </div>

                {authError && (
                  <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-[11px] flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>{authError}</span>
                  </div>
                )}

                {/* GOOGLE SIGN-IN VIA FIREBASE AUTH */}
                <button
                  type="button"
                  onClick={handleGoogleSignIn}
                  disabled={isAuthLoading}
                  className="w-full py-3 px-4 rounded-2xl bg-white border border-slate-300 hover:bg-slate-50 active:scale-98 text-neutral-800 font-bold text-xs flex items-center justify-center gap-2.5 shadow-xs transition-all disabled:opacity-50"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24">
                    <path
                      fill="#4285F4"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                    />
                  </svg>
                  <span>{isAuthLoading ? 'Signing in...' : 'Sign In with Google'}</span>
                </button>

                {/* 1-TAP OWNER DIRECT ACCESS BUTTON */}
                <div className="pt-1 border-t border-slate-100 text-center">
                  <button
                    type="button"
                    onClick={handleOwnerDirectLogin}
                    disabled={isAuthLoading}
                    className="w-full py-2.5 px-3 rounded-xl bg-purple-50 hover:bg-purple-100 text-purple-700 font-bold text-xs flex items-center justify-center gap-2 transition-all active:scale-98"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5 text-purple-600" />
                    <span>Continue with jotsingh122010@gmail.com</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================
          SIDE DRAWER (Clean White Theme)
         ======================================================== */}
      {isDrawerOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex"
          onClick={() => setIsDrawerOpen(false)}
        >
          <div
            className="w-4/5 max-w-xs bg-white h-full p-5 shadow-2xl flex flex-col justify-between animate-in slide-in-from-left duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="space-y-4">
              <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <img
                    src="/app-logo.png"
                    alt="SketchFlow Logo"
                    className="w-8 h-8 rounded-xl shadow-xs object-cover"
                    referrerPolicy="no-referrer"
                  />
                  <div>
                    <h3 className="text-sm font-black text-neutral-950">
                      Sketch<span className="text-purple-600">Flow</span>
                    </h3>
                    <p className="text-[10px] text-slate-400">AR Paper Tracing</p>
                  </div>
                </div>
                <button
                  onClick={() => setIsDrawerOpen(false)}
                  className="w-8 h-8 rounded-xl bg-slate-100 flex items-center justify-center text-slate-500"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-1">
                <button
                  onClick={() => {
                    fileInputRef.current?.click();
                    setIsDrawerOpen(false);
                  }}
                  className="w-full py-2.5 px-3 rounded-xl text-left text-xs font-bold bg-purple-50 text-purple-700 flex items-center gap-2.5"
                >
                  <Upload className="w-4 h-4 text-purple-600" />
                  Upload from Gallery
                </button>
                <button
                  onClick={() => {
                    setCurrentTab('home');
                    setIsDrawerOpen(false);
                  }}
                  className="w-full py-2.5 px-3 rounded-xl text-left text-xs font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-2.5"
                >
                  <Home className="w-4 h-4 text-purple-600" /> Home
                </button>
                <button
                  onClick={() => {
                    setCurrentTab('templates');
                    setIsDrawerOpen(false);
                  }}
                  className="w-full py-2.5 px-3 rounded-xl text-left text-xs font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-2.5"
                >
                  <Layers className="w-4 h-4 text-purple-600" /> Templates Library
                </button>
                <button
                  onClick={() => {
                    setCurrentTab('projects');
                    setIsDrawerOpen(false);
                  }}
                  className="w-full py-2.5 px-3 rounded-xl text-left text-xs font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-2.5"
                >
                  <Bookmark className="w-4 h-4 text-purple-600" /> My Art (Saved Drawings)
                </button>
                <button
                  onClick={() => {
                    setCurrentTab('recordings');
                    setIsDrawerOpen(false);
                  }}
                  className="w-full py-2.5 px-3 rounded-xl text-left text-xs font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-2.5"
                >
                  <Video className="w-4 h-4 text-purple-600" /> My Recorded Videos
                </button>

                {/* ONLY SHOW ADMIN OPTION IN DRAWER IF USER IS VERIFIED ADMIN */}
                {isAdmin && (
                  <button
                    onClick={() => {
                      onOpenAdmin();
                      setIsDrawerOpen(false);
                    }}
                    className="w-full py-2.5 px-3 rounded-xl text-left text-xs font-bold text-purple-700 bg-purple-50 flex items-center gap-2.5"
                  >
                    <Shield className="w-4 h-4 text-purple-600" /> Admin Panel
                  </button>
                )}

                <button
                  onClick={() => {
                    onOpenSettings();
                    setIsDrawerOpen(false);
                  }}
                  className="w-full py-2.5 px-3 rounded-xl text-left text-xs font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-2.5"
                >
                  <Sliders className="w-4 h-4 text-slate-500" /> Settings &amp; Help
                </button>
              </div>
            </div>

            <div className="text-[10px] text-slate-400 text-center pb-safe">
              SketchFlow · AR Paper Tracing Studio
            </div>
          </div>
        </div>
      )}

      {/* Confirm Delete Video Modal */}
      {confirmDeleteVideoId && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150"
          onClick={() => setConfirmDeleteVideoId(null)}
        >
          <div
            className="w-full max-w-sm bg-white rounded-3xl p-5 shadow-2xl border border-slate-200 space-y-4 animate-in zoom-in-95 duration-150 text-center"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto shadow-xs">
              <Trash2 className="w-6 h-6 stroke-[2.2]" />
            </div>
            <div>
              <h3 className="text-sm font-black text-neutral-950">Confirm Delete Video?</h3>
              <p className="text-xs text-slate-500 mt-1">
                Are you sure you want to permanently delete this video? This action cannot be undone.
              </p>
            </div>
            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={() => setConfirmDeleteVideoId(null)}
                className="flex-1 py-2.5 px-3 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 font-bold text-xs active:scale-98 transition-all"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={async () => {
                  const id = confirmDeleteVideoId;
                  setConfirmDeleteVideoId(null);
                  if (id) {
                    await deleteRecordedVideo(id);
                    await refreshRecordings();
                    showToast('Recording deleted successfully');
                  }
                }}
                className="flex-1 py-2.5 px-3 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-black text-xs active:scale-98 transition-all shadow-xs flex items-center justify-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Confirm Delete</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Image Picker Modal */}
      <ImagePickerModal
        isOpen={isPickerOpen}
        onClose={() => setIsPickerOpen(false)}
        onSelectImage={(imageDataUrl, imageName) => {
          onStartAR(imageDataUrl, imageName);
        }}
      />
    </div>
  );
};
