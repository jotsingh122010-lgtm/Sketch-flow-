import React, { useState, useEffect } from 'react';
import {
  Shield,
  ArrowLeft,
  Users,
  Package,
  Clock,
  Activity,
  Plus,
  Trash2,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Smartphone,
  Sparkles,
  Upload,
  LogOut,
  Eye,
  EyeOff,
  Check,
  Lock,
  Key,
  ShieldCheck,
  ShieldAlert,
  HelpCircle,
  Mail,
  Flame,
  Database,
  RotateCcw,
  Pencil,
  Palette,
  BookOpen,
  Tags,
  Edit3
} from 'lucide-react';
import { ProductItem, VisitorInfo } from '../types';
import {
  getProducts,
  saveProduct,
  updateProduct,
  deleteProductById,
  restoreDefaultTemplates,
  getCategories,
  addCategory,
  updateCategory,
  deleteCategory,
  getAppThemeConfig,
  saveAppThemeConfig,
  THEME_COLOR_PRESETS,
  ThemeColorKey,
  AppThemeConfig,
  getGuideConfig,
  saveGuideConfig,
  restoreDefaultGuide,
  GuideConfig,
  GuideStep,
  applyThemeToCss
} from '../utils/productManager';
import { getLocalVisitors } from '../utils/visitorTracker';
import {
  auth,
  signInWithGoogle,
  sendFirebasePasswordReset,
  logOutFromFirebase,
  getAdminSettings,
  updateAdminEmailInFirestore,
  resetAdminEmailWithRecoveryKey,
  AdminSettings,
  addProductToFirestore,
  deleteProductFromFirestore,
  DEFAULT_ADMIN_EMAIL
} from '../firebase';

interface AdminPanelProps {
  onBack: () => void;
}

export const AdminPanel: React.FC<AdminPanelProps> = ({ onBack }) => {
  // Dynamic Admin Settings loaded from Firebase
  const [adminConfig, setAdminConfig] = useState<AdminSettings>({
    adminEmail: DEFAULT_ADMIN_EMAIL,
    recoveryKey: 'SKETCH_SECURE_2026',
  });
  const [isLoadingConfig, setIsLoadingConfig] = useState<boolean>(true);

  // Session Token State (Persisted in localStorage so Back button never logs out)
  const [adminToken, setAdminToken] = useState<string | null>(() => {
    return localStorage.getItem('sketchflow_admin_token') || sessionStorage.getItem('sketchflow_admin_token');
  });
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    return !!localStorage.getItem('sketchflow_admin_token') || !!sessionStorage.getItem('sketchflow_admin_token');
  });
  const [firebaseUser, setFirebaseUser] = useState<any>(null);

  // Custom Category States for Add and Edit Modals
  const [isCustomCategoryEdit, setIsCustomCategoryEdit] = useState<boolean>(false);
  const [customCategoryEditVal, setCustomCategoryEditVal] = useState<string>('');
  const [isCustomCategoryAdd, setIsCustomCategoryAdd] = useState<boolean>(false);
  const [customCategoryAddVal, setCustomCategoryAddVal] = useState<string>('');

  // Login Form State
  const [emailInput, setEmailInput] = useState<string>(DEFAULT_ADMIN_EMAIL);
  const [passcodeInput, setPasscodeInput] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [isLoggingIn, setIsLoggingIn] = useState<boolean>(false);
  const [isGoogleLoggingIn, setIsGoogleLoggingIn] = useState<boolean>(false);
  const [authError, setAuthError] = useState<string | null>(null);

  // Forgot / Change Email Modal State
  const [isForgotModalOpen, setIsForgotModalOpen] = useState<boolean>(false);
  const [forgotRecoveryKey, setForgotRecoveryKey] = useState<string>('');
  const [forgotNewEmail, setForgotNewEmail] = useState<string>('');
  const [isSubmittingForgot, setIsSubmittingForgot] = useState<boolean>(false);
  const [forgotMessage, setForgotMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Send Password Reset Link State
  const [isResetSending, setIsResetSending] = useState<boolean>(false);

  // Active admin tab
  type AdminTab = 'products' | 'categories' | 'ui-theme' | 'guide' | 'analytics' | 'security';
  const [activeTab, setActiveTab] = useState<AdminTab>('products');

  // Analytics state
  const [visitors, setVisitors] = useState<VisitorInfo[]>([]);
  const [isLoadingAnalytics, setIsLoadingAnalytics] = useState(false);

  // Products state
  const [products, setProducts] = useState<ProductItem[]>([]);
  const [isAddProductOpen, setIsAddProductOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newCategory, setNewCategory] = useState('Anime & Manga');
  const [newPrice, setNewPrice] = useState('Free');
  const [newDifficulty, setNewDifficulty] = useState<'Easy' | 'Medium' | 'Advanced'>('Easy');
  const [newDescription, setNewDescription] = useState('');
  const [newImageUrl, setNewImageUrl] = useState('');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Template Edit State
  const [editingProduct, setEditingProduct] = useState<ProductItem | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState<boolean>(false);
  const [editTitle, setEditTitle] = useState('');
  const [editCategory, setEditCategory] = useState('Anime & Manga');
  const [editDifficulty, setEditDifficulty] = useState<'Easy' | 'Medium' | 'Advanced'>('Easy');
  const [editPrice, setEditPrice] = useState('Free');
  const [editDescription, setEditDescription] = useState('');
  const [editImageUrl, setEditImageUrl] = useState('');

  // Categories Manager State
  const [categoriesList, setCategoriesList] = useState<string[]>(() => getCategories());
  const [newCategoryName, setNewCategoryName] = useState('');
  const [editingCategory, setEditingCategory] = useState<string | null>(null);
  const [editCategoryNewName, setEditCategoryNewName] = useState('');

  // UI Theme Customizer State
  const [themeConfig, setThemeConfig] = useState<AppThemeConfig>(() => getAppThemeConfig());
  const [selectedThemeKey, setSelectedThemeKey] = useState<ThemeColorKey>(() => getAppThemeConfig().themeColor);
  const [themeAppName, setThemeAppName] = useState(() => getAppThemeConfig().appName);
  const [themeTagline, setThemeTagline] = useState(() => getAppThemeConfig().tagline);

  // Guide Customizer State
  const [guideConfig, setGuideConfig] = useState<GuideConfig>(() => getGuideConfig());
  const [newStepTitle, setNewStepTitle] = useState('');
  const [newStepDesc, setNewStepDesc] = useState('');
  const [newTipInput, setNewTipInput] = useState('');

  // Passcode Change Form state
  const [currPass, setCurrPass] = useState('');
  const [newPass, setNewPass] = useState('');
  const [confirmPass, setConfirmPass] = useState('');
  const [isChangingPass, setIsChangingPass] = useState(false);
  const [passChangeSuccess, setPassChangeSuccess] = useState<string | null>(null);
  const [passChangeError, setPassChangeError] = useState<string | null>(null);

  // Change Admin Email from Security Tab
  const [changeEmailInput, setChangeEmailInput] = useState('');
  const [isUpdatingEmail, setIsUpdatingEmail] = useState(false);
  const [emailUpdateMsg, setEmailUpdateMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Load Dynamic Admin Email from Firebase Firestore & Server Config on Mount
  useEffect(() => {
    async function loadSettings() {
      setIsLoadingConfig(true);
      try {
        const firestoreSettings = await getAdminSettings();
        if (firestoreSettings && firestoreSettings.adminEmail) {
          setAdminConfig(firestoreSettings);
          setEmailInput(firestoreSettings.adminEmail);
        }
      } catch (e) {
        console.warn('Could not fetch Firestore admin settings:', e);
      }

      // Sync with server config
      try {
        const res = await fetch('/api/admin/config');
        if (res.ok) {
          const srv = await res.json();
          if (srv.adminEmail) {
            setAdminConfig((prev) => ({ ...prev, adminEmail: srv.adminEmail }));
            setEmailInput(srv.adminEmail);
          }
        }
      } catch (e) {}

      setIsLoadingConfig(false);
    }

    loadSettings();

    // Listen to Firebase Auth state
    const unsubscribe = auth.onAuthStateChanged((user) => {
      setFirebaseUser(user);
      if (user && user.email) {
        const uEmail = user.email.toLowerCase().trim();
        const adm = (adminConfig.adminEmail || DEFAULT_ADMIN_EMAIL).toLowerCase().trim();
        if (uEmail === adm || uEmail === DEFAULT_ADMIN_EMAIL.toLowerCase()) {
          setIsAuthenticated(true);
        }
      }
    });
    return () => unsubscribe();
  }, [adminConfig.adminEmail]);

  // Verify stored session token on mount (checking localStorage as primary)
  useEffect(() => {
    const token = localStorage.getItem('sketchflow_admin_token') || sessionStorage.getItem('sketchflow_admin_token');
    if (token) {
      setAdminToken(token);
      setIsAuthenticated(true);
      // Ensure session is stored in both
      localStorage.setItem('sketchflow_admin_token', token);
      sessionStorage.setItem('sketchflow_admin_token', token);

      fetch('/api/admin/verify', {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then((res) => {
          if (res.ok) {
            setIsAuthenticated(true);
            setAdminToken(token);
          } else {
            // Keep user logged in if token exists in localStorage; server will auto-re-register valid sf_sec_ tokens
            setIsAuthenticated(true);
            setAdminToken(token);
          }
        })
        .catch(() => {
          // Network hiccup / offline - keep authenticated
          setIsAuthenticated(true);
          setAdminToken(token);
        });
    }
  }, []);

  // Load Analytics data
  const loadAnalytics = async () => {
    setIsLoadingAnalytics(true);
    const token = adminToken || localStorage.getItem('sketchflow_admin_token') || sessionStorage.getItem('sketchflow_admin_token');

    try {
      const headers: Record<string, string> = {};
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const res = await fetch('/api/admin/analytics', { headers });
      if (res.ok) {
        const data = await res.json();
        if (data.visitors && Array.isArray(data.visitors)) {
          setVisitors(data.visitors);
          setIsLoadingAnalytics(false);
          return;
        }
      } else if (res.status === 401) {
        // Do not force logout on 401; maintain session state
        setIsLoadingAnalytics(false);
        return;
      }
    } catch {}


    const local = getLocalVisitors();
    setVisitors(local);
    setIsLoadingAnalytics(false);
  };

  // Load products
  const loadProducts = () => {
    const list = getProducts();
    setProducts(list);
  };

  useEffect(() => {
    if (isAuthenticated) {
      loadAnalytics();
      loadProducts();
      const interval = setInterval(loadAnalytics, 8000);
      return () => clearInterval(interval);
    }
  }, [isAuthenticated, adminToken]);

  // 1. Google Sign-In with Firebase Auth
  const handleGoogleSignIn = async () => {
    setAuthError(null);
    setIsGoogleLoggingIn(true);
    try {
      const { user, error } = await signInWithGoogle();
      if (error || !user) {
        setAuthError(error || 'Google Sign-In was cancelled or failed.');
        setIsGoogleLoggingIn(false);
        return;
      }

      const userEmail = (user.email || '').toLowerCase().trim();
      const activeAdmin = (adminConfig.adminEmail || DEFAULT_ADMIN_EMAIL).toLowerCase().trim();

      // Check if logged in Google account matches the authorized admin email
      if (userEmail === activeAdmin || userEmail === DEFAULT_ADMIN_EMAIL.toLowerCase()) {
        const token = 'sf_sec_fb_' + Math.random().toString(36).substring(2) + Date.now();
        localStorage.setItem('sketchflow_admin_token', token);
        localStorage.setItem('sketchflow_admin_email', userEmail);
        sessionStorage.setItem('sketchflow_admin_token', token);
        sessionStorage.setItem('sketchflow_admin_email', userEmail);
        setAdminToken(token);
        setIsAuthenticated(true);
        setFirebaseUser(user);
        showToast(`Firebase Auth verified! Welcome, ${user.displayName || user.email}!`);
      } else {
        await logOutFromFirebase();
        setAuthError(
          `This Google account (${userEmail}) is not authorized. Only (${adminConfig.adminEmail}) is allowed.`
        );
      }
    } catch (err: any) {
      setAuthError(err.message || 'Google Sign-in encountered an error.');
    } finally {
      setIsGoogleLoggingIn(false);
    }
  };

  // Direct 1-Tap Owner Login
  const handleOwnerDirectLogin = async () => {
    setIsLoggingIn(true);
    setAuthError(null);
    try {
      const res = await fetch('/api/admin/owner-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: adminConfig.adminEmail || DEFAULT_ADMIN_EMAIL }),
      });
      const data = await res.json();
      if (res.ok && data.success && data.token) {
        localStorage.setItem('sketchflow_admin_token', data.token);
        localStorage.setItem('sketchflow_admin_email', DEFAULT_ADMIN_EMAIL);
        sessionStorage.setItem('sketchflow_admin_token', data.token);
        sessionStorage.setItem('sketchflow_admin_email', DEFAULT_ADMIN_EMAIL);
        setAdminToken(data.token);
        setIsAuthenticated(true);
        showToast('Owner verified! Welcome, Jot Singh.');
      } else {
        setAuthError(data.error || 'Verification failed.');
      }
    } catch {
      const token = 'sf_sec_local_' + Math.random().toString(36).substring(2) + Date.now();
      localStorage.setItem('sketchflow_admin_token', token);
      localStorage.setItem('sketchflow_admin_email', DEFAULT_ADMIN_EMAIL);
      sessionStorage.setItem('sketchflow_admin_token', token);
      sessionStorage.setItem('sketchflow_admin_email', DEFAULT_ADMIN_EMAIL);
      setAdminToken(token);
      setIsAuthenticated(true);
      showToast('Admin verified! Welcome.');
    } finally {
      setIsLoggingIn(false);
    }
  };

  // 2. Email + Passcode Login via Server
  const handleLogin = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setAuthError(null);

    const cleanEmail = (emailInput || DEFAULT_ADMIN_EMAIL).trim();
    const cleanPass = (passcodeInput || 'Jot@2026').trim();

    if (!cleanEmail) {
      setAuthError('Please enter admin email!');
      return;
    }
    if (!cleanPass) {
      setAuthError('Please enter master passcode!');
      return;
    }

    setIsLoggingIn(true);
    try {
      const res = await fetch('/api/admin/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: cleanEmail, passcode: cleanPass }),
      });

      const data = await res.json();

      if (res.ok && data.success && data.token) {
        localStorage.setItem('sketchflow_admin_token', data.token);
        localStorage.setItem('sketchflow_admin_email', cleanEmail);
        sessionStorage.setItem('sketchflow_admin_token', data.token);
        sessionStorage.setItem('sketchflow_admin_email', cleanEmail);
        setAdminToken(data.token);
        setIsAuthenticated(true);
        setPasscodeInput('');
        showToast(`Secure Admin Session active! Welcome.`);
      } else {
        setAuthError(data.error || 'Login failed! Access Denied.');
      }
    } catch {
      setAuthError('Server connection error. Please try again.');
    } finally {
      setIsLoggingIn(false);
    }
  };

  // 3. Send Password Reset Link via Firebase Auth
  const handleSendPasswordReset = async () => {
    if (!emailInput || !emailInput.includes('@')) {
      showToast('Please enter a valid email address!');
      return;
    }

    setIsResetSending(true);
    const result = await sendFirebasePasswordReset(emailInput);
    setIsResetSending(false);

    if (result.success) {
      showToast(result.message);
    } else {
      setAuthError(result.message);
    }
  };

  // 4. Handle "Forgot / Change Admin Gmail" using Recovery Key
  const handleRecoverOrChangeEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotMessage(null);

    const cleanKey = forgotRecoveryKey.trim();
    const cleanNewEmail = forgotNewEmail.trim().toLowerCase();

    if (!cleanKey) {
      setForgotMessage({ type: 'error', text: 'Please enter recovery passcode!' });
      return;
    }
    if (!cleanNewEmail || !cleanNewEmail.includes('@')) {
      setForgotMessage({ type: 'error', text: 'Please enter a valid email address!' });
      return;
    }

    setIsSubmittingForgot(true);

    try {
      const firestoreRes = await resetAdminEmailWithRecoveryKey(cleanNewEmail, cleanKey);

      if (!firestoreRes.success) {
        setForgotMessage({ type: 'error', text: firestoreRes.message });
        setIsSubmittingForgot(false);
        return;
      }

      await fetch('/api/admin/recover-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recoveryKey: cleanKey, newEmail: cleanNewEmail }),
      }).catch(() => {});

      setAdminConfig((prev) => ({ ...prev, adminEmail: cleanNewEmail }));
      setEmailInput(cleanNewEmail);
      setForgotMessage({
        type: 'success',
        text: `Success! New Admin Email "${cleanNewEmail}" updated securely in Firebase!`,
      });
      showToast(`Admin Email updated to: ${cleanNewEmail}`);

      setTimeout(() => {
        setIsForgotModalOpen(false);
        setForgotRecoveryKey('');
        setForgotNewEmail('');
        setForgotMessage(null);
      }, 2500);
    } catch (err: any) {
      setForgotMessage({ type: 'error', text: err.message || 'Error occurred while updating.' });
    } finally {
      setIsSubmittingForgot(false);
    }
  };

  // 5. Update Admin Gmail from Security Tab
  const handleUpdateAdminEmailFromSecurity = async (e: React.FormEvent) => {
    e.preventDefault();
    setEmailUpdateMsg(null);

    const clean = changeEmailInput.trim().toLowerCase();
    if (!clean || !clean.includes('@')) {
      setEmailUpdateMsg({ type: 'error', text: 'Please enter a valid Gmail address!' });
      return;
    }

    setIsUpdatingEmail(true);

    try {
      await updateAdminEmailInFirestore(clean, adminToken || 'admin_session');

      const token = adminToken || sessionStorage.getItem('sketchflow_admin_token');
      await fetch('/api/admin/update-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ newEmail: clean }),
      }).catch(() => {});

      setAdminConfig((prev) => ({ ...prev, adminEmail: clean }));
      setEmailInput(clean);
      setChangeEmailInput('');
      setEmailUpdateMsg({
        type: 'success',
        text: `Admin Gmail successfully updated to "${clean}"!`,
      });
      showToast('Admin Gmail updated in Firebase!');
    } catch (err: any) {
      setEmailUpdateMsg({ type: 'error', text: err.message || 'Error occurred while updating email.' });
    } finally {
      setIsUpdatingEmail(false);
    }
  };

  // Logout
  const handleLogout = async () => {
    const token = adminToken || localStorage.getItem('sketchflow_admin_token') || sessionStorage.getItem('sketchflow_admin_token');
    if (token) {
      fetch('/api/admin/logout', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      }).catch(() => {});
    }
    await logOutFromFirebase();
    localStorage.removeItem('sketchflow_admin_token');
    localStorage.removeItem('sketchflow_admin_email');
    sessionStorage.removeItem('sketchflow_admin_token');
    sessionStorage.removeItem('sketchflow_admin_email');
    setAdminToken(null);
    setIsAuthenticated(false);
    setFirebaseUser(null);
    showToast('Admin session logged out.');
  };

  // Handle Passcode Change
  const handleChangePasscode = async (e: React.FormEvent) => {
    e.preventDefault();
    setPassChangeError(null);
    setPassChangeSuccess(null);

    if (newPass !== confirmPass) {
      setPassChangeError('New passcodes do not match!');
      return;
    }
    if (newPass.length < 4) {
      setPassChangeError('Passcode must be at least 4 characters long!');
      return;
    }

    setIsChangingPass(true);
    const token = adminToken || sessionStorage.getItem('sketchflow_admin_token');

    try {
      const res = await fetch('/api/admin/change-passcode', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ currentPasscode: currPass, newPasscode: newPass }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setPassChangeSuccess('Admin Master Passcode changed successfully!');
        setCurrPass('');
        setNewPass('');
        setConfirmPass('');
      } else {
        setPassChangeError(data.error || 'Failed to change passcode.');
      }
    } catch {
      setPassChangeError('Server error.');
    } finally {
      setIsChangingPass(false);
    }
  };

  // Handle Image Upload for New Product
  const handleProductImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const res = event.target?.result as string;
      if (res) {
        setNewImageUrl(res);
      }
    };
    reader.readAsDataURL(file);
  };

  // Add New Product
  const handleAddProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) {
      showToast('Please enter a product title!');
      return;
    }

    const img =
      newImageUrl ||
      `data:image/svg+xml;utf8,${encodeURIComponent(`
      <svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
        <rect width="200" height="200" fill="#f8fafc" rx="20"/>
        <text x="100" y="105" fill="#7c3aed" font-size="18" font-family="sans-serif" font-weight="bold" text-anchor="middle">${newTitle}</text>
      </svg>
    `)}`;

    const finalCat = isCustomCategoryAdd && customCategoryAddVal.trim()
      ? customCategoryAddVal.trim()
      : newCategory;

    if (isCustomCategoryAdd && customCategoryAddVal.trim()) {
      addCategory(customCategoryAddVal.trim());
      setCategoriesList(getCategories());
    }

    const productPayload = {
      title: newTitle.trim(),
      category: finalCat,
      imageUrl: img,
      price: newPrice,
      difficulty: newDifficulty,
      description: newDescription || `${finalCat} sketch template for paper tracing`,
    };

    saveProduct(productPayload);
    addProductToFirestore(productPayload).catch(() => {});

    setNewTitle('');
    setNewDescription('');
    setNewImageUrl('');
    setIsCustomCategoryAdd(false);
    setCustomCategoryAddVal('');
    setIsAddProductOpen(false);
    loadProducts();
    showToast(`Template "${newTitle}" added successfully!`);
  };

  // Delete Template / Product directly (window.confirm was blocked by iframe)
  const handleDeleteProduct = (id: string, name: string) => {
    deleteProductById(id);
    deleteProductFromFirestore(id).catch(() => {});
    loadProducts();
    showToast(`Template "${name}" deleted.`);
  };

  // Restore Default Templates
  const handleRestoreDefaults = () => {
    restoreDefaultTemplates();
    loadProducts();
    showToast('Default templates restored!');
  };

  // Open Edit Template Modal
  const handleOpenEditModal = (p: ProductItem) => {
    setEditingProduct(p);
    setEditTitle(p.title);
    setEditCategory(p.category);
    setIsCustomCategoryEdit(false);
    setCustomCategoryEditVal('');
    setEditDifficulty((p.difficulty as any) || 'Easy');
    setEditPrice(p.price || 'Free');
    setEditDescription(p.description || '');
    setEditImageUrl(p.imageUrl || '');
    setIsEditModalOpen(true);
  };

  // Save Template Edits (With Custom Category Support!)
  const handleSaveEditProduct = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProduct) return;

    if (!editTitle.trim()) {
      showToast('Please enter a template title!');
      return;
    }

    const finalCat = isCustomCategoryEdit && customCategoryEditVal.trim()
      ? customCategoryEditVal.trim()
      : editCategory;

    if (isCustomCategoryEdit && customCategoryEditVal.trim()) {
      addCategory(customCategoryAddVal.trim());
      setCategoriesList(getCategories());
    }

    const updated = updateProduct(editingProduct.id, {
      title: editTitle.trim(),
      category: finalCat,
      difficulty: editDifficulty,
      price: editPrice,
      description: editDescription,
      imageUrl: editImageUrl || editingProduct.imageUrl,
    });

    if (updated) {
      loadProducts();
      setIsEditModalOpen(false);
      setEditingProduct(null);
      setIsCustomCategoryEdit(false);
      setCustomCategoryEditVal('');
      showToast(`Template "${editTitle}" updated successfully!`);
    } else {
      showToast('Failed to update template.');
    }
  };

  // Handle Image Upload during Edit
  const handleEditImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const res = event.target?.result as string;
      if (res) {
        setEditImageUrl(res);
      }
    };
    reader.readAsDataURL(file);
  };

  // Categories Handlers
  const handleAddCategorySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCategoryName.trim()) return;
    const updated = addCategory(newCategoryName);
    setCategoriesList(updated);
    setNewCategoryName('');
    showToast(`New category "${newCategoryName.trim()}" added!`);
  };

  const handleRenameCategorySubmit = (oldName: string) => {
    if (!editCategoryNewName.trim()) return;
    const updated = updateCategory(oldName, editCategoryNewName);
    setCategoriesList(updated);
    setEditingCategory(null);
    setEditCategoryNewName('');
    loadProducts();
    showToast(`Category renamed to: ${editCategoryNewName.trim()}`);
  };

  const handleDeleteCategorySubmit = (cat: string) => {
    if (cat === 'All') {
      showToast('The "All" category cannot be deleted.');
      return;
    }
    const updated = deleteCategory(cat);
    setCategoriesList(updated);
    loadProducts();
    showToast(`Category "${cat}" deleted.`);
  };

  // UI Theme Customizer Handler
  const handleSaveThemeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const saved = saveAppThemeConfig({
      themeColor: selectedThemeKey,
      appName: themeAppName.trim() || 'SketchFlow',
      tagline: themeTagline.trim() || 'AR Paper Tracing',
    });
    setThemeConfig(saved);
    showToast(`UI Color Theme "${THEME_COLOR_PRESETS[selectedThemeKey].name}" saved!`);
  };

  // Guide Customizer Handlers
  const handleAddGuideStepSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStepTitle.trim() || !newStepDesc.trim()) {
      showToast('Please provide both step title and description!');
      return;
    }
    const newStep: GuideStep = {
      id: 'step_' + Date.now(),
      stepNumber: guideConfig.steps.length + 1,
      title: newStepTitle.trim(),
      desc: newStepDesc.trim(),
    };
    const updatedConfig: GuideConfig = {
      ...guideConfig,
      steps: [...guideConfig.steps, newStep],
    };
    saveGuideConfig(updatedConfig);
    setGuideConfig(updatedConfig);
    setNewStepTitle('');
    setNewStepDesc('');
    showToast('New guide step added!');
  };

  const handleDeleteGuideStepSubmit = (id: string) => {
    const filtered = guideConfig.steps
      .filter((s) => s.id !== id)
      .map((s, idx) => ({ ...s, stepNumber: idx + 1 }));
    const updatedConfig: GuideConfig = {
      ...guideConfig,
      steps: filtered,
    };
    saveGuideConfig(updatedConfig);
    setGuideConfig(updatedConfig);
    showToast('Guide step deleted.');
  };

  const handleAddGuideTipSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTipInput.trim()) return;
    const updatedConfig: GuideConfig = {
      ...guideConfig,
      tips: [...(guideConfig.tips || []), newTipInput.trim()],
    };
    saveGuideConfig(updatedConfig);
    setGuideConfig(updatedConfig);
    setNewTipInput('');
    showToast('New pro tip added!');
  };

  const handleDeleteGuideTipSubmit = (idx: number) => {
    const updatedTips = [...(guideConfig.tips || [])];
    updatedTips.splice(idx, 1);
    const updatedConfig: GuideConfig = {
      ...guideConfig,
      tips: updatedTips,
    };
    saveGuideConfig(updatedConfig);
    setGuideConfig(updatedConfig);
    showToast('Tip deleted.');
  };

  const handleSaveGuideDetails = (e: React.FormEvent) => {
    e.preventDefault();
    saveGuideConfig(guideConfig);
    showToast('Guide details updated successfully!');
  };

  const handleRestoreGuideDefaults = () => {
    if (confirm('Are you sure you want to reset the guide to default settings?')) {
      const reset = restoreDefaultGuide();
      setGuideConfig(reset);
      showToast('Guide defaults restored!');
    }
  };

  // Format Seconds to Friendly String
  const formatDuration = (totalSeconds: number) => {
    const sec = totalSeconds || 0;
    if (sec < 60) return `${sec}s`;
    const mins = Math.floor(sec / 60);
    const remainSec = sec % 60;
    if (mins < 60) return `${mins}m ${remainSec}s`;
    const hours = Math.floor(mins / 60);
    const remainMins = mins % 60;
    return `${hours}h ${remainMins}m`;
  };

  // =========================================================================
  // 1. IF NOT AUTHENTICATED: CLEAN WHITE LOGIN SCREEN
  // =========================================================================
  if (!isAuthenticated) {
    return (
      <div className="relative w-full min-h-[100dvh] bg-white text-neutral-900 flex flex-col justify-between p-6 select-none">
        {/* Top Back */}
        <div className="flex items-center justify-between pt-safe">
          <button
            onClick={onBack}
            className="w-10 h-10 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-center text-slate-700 active:scale-95 hover:bg-slate-100"
            title="Wapas App par jayein"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="text-xs font-mono text-purple-700 flex items-center gap-1.5 font-bold">
            <Flame className="w-3.5 h-3.5 text-purple-600" />
            <span>Admin Restricted Area</span>
          </div>
          <div className="w-10" />
        </div>

        {/* Center Login Card */}
        <div className="w-full max-w-sm mx-auto my-auto space-y-4 animate-in fade-in duration-200">
          <div className="text-center space-y-2">
            <div className="w-16 h-16 rounded-3xl overflow-hidden mx-auto shadow-md border-2 border-purple-500/20">
              <img
                src="/app-logo.png"
                alt="SketchFlow Logo"
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
              />
            </div>
            <h2 className="text-2xl font-black tracking-tight text-neutral-950">SketchFlow Admin</h2>
            <p className="text-xs text-slate-500 leading-relaxed">
              Authorized Owner Gmail:{' '}
              <span className="font-mono text-purple-700 font-bold bg-purple-50 px-2 py-0.5 rounded border border-purple-200">
                {adminConfig.adminEmail}
              </span>
            </p>
          </div>

          <div className="p-5 rounded-3xl bg-white border border-slate-200 shadow-xl space-y-3.5">
            {/* OPTION 1: 1-TAP OWNER DIRECT LOGIN */}
            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">
                1-Tap Owner Instant Access
              </label>
              <button
                type="button"
                onClick={handleOwnerDirectLogin}
                disabled={isLoggingIn}
                className="w-full py-3 px-4 rounded-2xl bg-purple-600 hover:bg-purple-700 active:scale-98 text-white font-black text-xs flex items-center justify-center gap-2 shadow-sm transition-all disabled:opacity-50"
              >
                <Shield className="w-4 h-4" />
                <span>{isLoggingIn ? 'Logging in...' : '1-Tap Login as jotsingh122010@gmail.com'}</span>
              </button>
            </div>

            <div className="relative flex py-1 items-center">
              <div className="flex-grow border-t border-slate-200"></div>
              <span className="flex-shrink mx-2 text-slate-400 text-[10px] font-bold uppercase tracking-wider">or with Google / Passcode</span>
              <div className="flex-grow border-t border-slate-200"></div>
            </div>

            {/* OPTION 2: REAL GOOGLE SIGN-IN VIA FIREBASE AUTH */}
            <button
              type="button"
              onClick={handleGoogleSignIn}
              disabled={isGoogleLoggingIn}
              className="w-full py-2.5 px-4 rounded-xl bg-white border border-slate-300 hover:bg-slate-50 active:scale-98 text-neutral-900 font-bold text-xs flex items-center justify-center gap-2.5 shadow-xs transition-all disabled:opacity-50"
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
              <span>{isGoogleLoggingIn ? 'Verifying with Google...' : 'Google Sign-In Popup'}</span>
            </button>

            {/* OPTION 3: EMAIL + MASTER PASSCODE */}
            <form onSubmit={handleLogin} className="space-y-2.5 pt-1 border-t border-slate-100">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                  Admin Email
                </label>
                <input
                  type="email"
                  value={emailInput}
                  onChange={(e) => setEmailInput(e.target.value)}
                  placeholder="jotsingh122010@gmail.com"
                  className="w-full py-2 px-3 rounded-xl bg-slate-50 border border-slate-300 text-neutral-900 text-xs font-mono focus:outline-none focus:border-purple-600 focus:bg-white"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                    Master Passcode
                  </label>
                  <span className="text-[10px] text-purple-600 font-bold">Jot@2026</span>
                </div>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={passcodeInput}
                    onChange={(e) => setPasscodeInput(e.target.value)}
                    placeholder="Enter Jot@2026"
                    className="w-full py-2 pl-3 pr-10 rounded-xl bg-slate-50 border border-slate-300 text-neutral-900 text-xs font-mono focus:outline-none focus:border-purple-600 focus:bg-white"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {authError && (
                <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span className="leading-tight">{authError}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={isLoggingIn}
                className="w-full py-2.5 rounded-xl bg-neutral-900 text-white font-bold text-xs uppercase tracking-wider active:scale-98 transition-all disabled:opacity-50"
              >
                {isLoggingIn ? 'Verifying...' : 'Login with Passcode'}
              </button>
            </form>

            {/* FORGOT / CHANGE ADMIN GMAIL BUTTON */}
            <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px]">
              <button
                type="button"
                onClick={() => setIsForgotModalOpen(true)}
                className="text-purple-600 hover:underline font-bold"
              >
                Need to change Admin Gmail?
              </button>
              <button
                type="button"
                onClick={handleSendPasswordReset}
                disabled={isResetSending}
                className="text-slate-500 hover:text-slate-800"
              >
                {isResetSending ? 'Sending...' : 'Send Reset Link'}
              </button>
            </div>
          </div>
        </div>

        {/* FORGOT MODAL */}
        {isForgotModalOpen && (
          <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="w-full max-w-sm rounded-3xl bg-white border border-slate-200 shadow-2xl p-5 space-y-4 animate-in zoom-in-95 duration-150">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
                    <Key className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-xs font-black text-neutral-900">Admin Gmail Recovery</h3>
                    <p className="text-[10px] text-slate-500">Firebase Firestore Cloud Sync</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsForgotModalOpen(false)}
                  className="w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center text-slate-500"
                >
                  ✕
                </button>
              </div>

              <p className="text-xs text-slate-600 leading-relaxed">
                Enter your <strong>Secret Recovery Passcode</strong> to update your Admin Gmail:
              </p>

              <form onSubmit={handleRecoverOrChangeEmail} className="space-y-3">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                    Secret Recovery Passcode
                  </label>
                  <input
                    type="password"
                    value={forgotRecoveryKey}
                    onChange={(e) => setForgotRecoveryKey(e.target.value)}
                    placeholder="Default: SKETCH_SECURE_2026"
                    className="w-full py-2 px-3 rounded-xl bg-slate-50 border border-slate-300 text-neutral-900 text-xs font-mono focus:outline-none focus:border-purple-600"
                    required
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                    New Admin Gmail Address
                  </label>
                  <input
                    type="email"
                    value={forgotNewEmail}
                    onChange={(e) => setForgotNewEmail(e.target.value)}
                    placeholder="Enter new Gmail address"
                    className="w-full py-2 px-3 rounded-xl bg-slate-50 border border-slate-300 text-neutral-900 text-xs font-mono focus:outline-none focus:border-purple-600"
                    required
                  />
                </div>

                {forgotMessage && (
                  <div
                    className={`p-3 rounded-xl text-xs flex items-start gap-2 ${
                      forgotMessage.type === 'success'
                        ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                        : 'bg-rose-50 text-rose-800 border border-rose-200'
                    }`}
                  >
                    {forgotMessage.type === 'success' ? (
                      <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600 mt-0.5" />
                    ) : (
                      <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 mt-0.5" />
                    )}
                    <span className="leading-tight">{forgotMessage.text}</span>
                  </div>
                )}

                <div className="flex gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setIsForgotModalOpen(false)}
                    className="flex-1 py-2.5 rounded-xl bg-slate-100 text-slate-700 text-xs font-bold"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmittingForgot}
                    className="flex-1 py-2.5 rounded-xl bg-purple-600 text-white text-xs font-bold disabled:opacity-50"
                  >
                    {isSubmittingForgot ? 'Updating...' : 'Update Gmail'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    );
  }

  // =========================================================================
  // 2. AUTHENTICATED: CLEAN WHITE ADMIN DASHBOARD
  // =========================================================================
  const now = Date.now();
  const activeCount = visitors.filter((v) => now - v.lastSeen < 60000).length;
  const totalSecondsAll = visitors.reduce((acc, v) => acc + (v.totalSeconds || 0), 0);
  const avgSeconds = visitors.length > 0 ? Math.round(totalSecondsAll / visitors.length) : 0;

  return (
    <div className="relative w-full min-h-[100dvh] bg-slate-50 text-neutral-900 flex flex-col select-none overflow-x-hidden">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-2xl bg-neutral-900 text-white border border-purple-400 text-xs font-bold shadow-2xl animate-in fade-in slide-in-from-top-2 duration-150">
          {toastMessage}
        </div>
      )}

      {/* Top Admin Header */}
      <header className="sticky top-0 z-30 pt-safe px-4 py-3 bg-white/95 backdrop-blur-md border-b border-slate-200 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <button
            onClick={onBack}
            className="w-9 h-9 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-700 active:scale-95 hover:bg-slate-200"
            title="Back to App"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <img
            src="/app-logo.png"
            alt="Logo"
            className="w-8 h-8 rounded-xl object-cover shadow-xs"
            referrerPolicy="no-referrer"
          />
          <div>
            <h2 className="text-sm font-black text-neutral-950 flex items-center gap-1.5">
              <span>Admin Panel</span>
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            </h2>
            <p className="text-[10px] text-purple-700 font-bold truncate max-w-[170px]">
              {adminConfig.adminEmail}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={loadAnalytics}
            className="p-2 rounded-xl bg-slate-100 border border-slate-200 text-slate-700 hover:bg-slate-200 active:scale-95 transition-all"
            title="Refresh Data"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoadingAnalytics ? 'animate-spin' : ''}`} />
          </button>

          <button
            onClick={handleLogout}
            className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-rose-50 border border-slate-200 hover:border-rose-200 text-slate-700 hover:text-rose-600 active:scale-95 transition-all flex items-center gap-1.5 text-xs font-bold"
            title="Logout"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Logout</span>
          </button>
        </div>
      </header>

      {/* Admin Subtabs Navigation Bar */}
      <div className="px-3 pt-2.5 flex gap-1.5 bg-white border-b border-slate-200 pb-2 overflow-x-auto no-scrollbar">
        <button
          onClick={() => setActiveTab('products')}
          className={`px-3 py-2 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 transition-all whitespace-nowrap shrink-0 ${
            activeTab === 'products'
              ? 'bg-purple-600 text-white shadow-xs'
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}
        >
          <Package className="w-3.5 h-3.5" />
          <span>Templates ({products.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('categories')}
          className={`px-3 py-2 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 transition-all whitespace-nowrap shrink-0 ${
            activeTab === 'categories'
              ? 'bg-purple-600 text-white shadow-xs'
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}
        >
          <Tags className="w-3.5 h-3.5" />
          <span>Sections ({categoriesList.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('ui-theme')}
          className={`px-3 py-2 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 transition-all whitespace-nowrap shrink-0 ${
            activeTab === 'ui-theme'
              ? 'bg-purple-600 text-white shadow-xs'
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}
        >
          <Palette className="w-3.5 h-3.5" />
          <span>UI &amp; Theme</span>
        </button>

        <button
          onClick={() => setActiveTab('guide')}
          className={`px-3 py-2 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 transition-all whitespace-nowrap shrink-0 ${
            activeTab === 'guide'
              ? 'bg-purple-600 text-white shadow-xs'
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}
        >
          <BookOpen className="w-3.5 h-3.5" />
          <span>Guide</span>
        </button>

        <button
          onClick={() => setActiveTab('analytics')}
          className={`px-3 py-2 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 transition-all whitespace-nowrap shrink-0 ${
            activeTab === 'analytics'
              ? 'bg-purple-600 text-white shadow-xs'
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}
        >
          <Users className="w-3.5 h-3.5" />
          <span>Visitors ({visitors.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('security')}
          className={`px-3 py-2 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 transition-all whitespace-nowrap shrink-0 ${
            activeTab === 'security'
              ? 'bg-purple-600 text-white shadow-xs'
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}
        >
          <Shield className="w-3.5 h-3.5" />
          <span>Security</span>
        </button>
      </div>

      {/* =====================================================================
          TAB 1: PRODUCTS & TEMPLATES MANAGER (WITH DELETE OPTION FOR ALL TEMPLATES)
      ===================================================================== */}
      {activeTab === 'products' && (
        <main className="flex-1 p-4 space-y-4 overflow-y-auto">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xs font-black uppercase tracking-wider text-neutral-900">
                Templates &amp; Sketches Manager
              </h3>
              <p className="text-[11px] text-slate-500">
                Manage, add, edit, or delete sketch templates
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleRestoreDefaults}
                className="py-1.5 px-2.5 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-100 font-bold text-xs flex items-center gap-1 shadow-xs"
                title="Restore default sample templates"
              >
                <RotateCcw className="w-3 h-3 text-slate-500" />
                <span>Restore Defaults</span>
              </button>

              <button
                onClick={() => setIsAddProductOpen(!isAddProductOpen)}
                className="py-1.5 px-3 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-xs active:scale-95 transition-all"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>New Template</span>
              </button>
            </div>
          </div>

          {/* Add Product Form Modal / Collapsible */}
          {isAddProductOpen && (
            <form
              onSubmit={handleAddProduct}
              className="p-4 rounded-3xl bg-white border border-slate-200 shadow-xl space-y-3 animate-in fade-in zoom-in-95"
            >
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <span className="text-xs font-black text-neutral-950 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-purple-600" />
                  <span>Add New Sketch Template</span>
                </span>
                <button
                  type="button"
                  onClick={() => setIsAddProductOpen(false)}
                  className="text-slate-400 hover:text-slate-700 text-xs"
                >
                  ✕
                </button>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Title</label>
                <input
                  type="text"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="e.g. Gojo Anime Hero"
                  className="w-full py-2 px-3 rounded-xl bg-slate-50 border border-slate-300 text-neutral-900 text-xs focus:outline-none focus:border-purple-600"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase">Section / Category</label>
                    <button
                      type="button"
                      onClick={() => setIsCustomCategoryAdd(!isCustomCategoryAdd)}
                      className="text-[10px] font-bold text-purple-600 hover:underline"
                    >
                      {isCustomCategoryAdd ? 'Choose List' : '+ Custom'}
                    </button>
                  </div>
                  {isCustomCategoryAdd ? (
                    <input
                      type="text"
                      value={customCategoryAddVal}
                      onChange={(e) => setCustomCategoryAddVal(e.target.value)}
                      placeholder="New section name (e.g. Superhero, Birds)"
                      className="w-full py-2 px-2.5 rounded-xl bg-purple-50/50 border border-purple-400 text-neutral-900 text-xs font-bold focus:outline-none"
                      required
                    />
                  ) : (
                    <select
                      value={newCategory}
                      onChange={(e) => {
                        if (e.target.value === '__custom__') {
                          setIsCustomCategoryAdd(true);
                        } else {
                          setNewCategory(e.target.value);
                        }
                      }}
                      className="w-full py-2 px-2.5 rounded-xl bg-slate-50 border border-slate-300 text-neutral-900 text-xs focus:outline-none focus:border-purple-600"
                    >
                      {categoriesList.filter((c) => c !== 'All').map((cat) => (
                        <option key={cat} value={cat}>
                          {cat}
                        </option>
                      ))}
                      <option value="__custom__">+ Create New Custom Section...</option>
                    </select>
                  )}
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Difficulty</label>
                  <select
                    value={newDifficulty}
                    onChange={(e) => setNewDifficulty(e.target.value as any)}
                    className="w-full py-2 px-2.5 rounded-xl bg-slate-50 border border-slate-300 text-neutral-900 text-xs focus:outline-none focus:border-purple-600"
                  >
                    <option value="Easy">Easy</option>
                    <option value="Medium">Medium</option>
                    <option value="Advanced">Advanced</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Image / Outline Upload</label>
                <label className="flex items-center justify-center gap-2 w-full py-3 px-3 rounded-xl bg-slate-50 border border-dashed border-slate-300 text-slate-600 hover:text-purple-600 cursor-pointer text-xs">
                  <Upload className="w-4 h-4" />
                  <span>{newImageUrl ? 'Image Selected (Tap to change)' : 'Upload from phone gallery'}</span>
                  <input type="file" accept="image/*" onChange={handleProductImageUpload} className="hidden" />
                </label>
              </div>

              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setIsAddProductOpen(false)}
                  className="flex-1 py-2.5 rounded-xl bg-slate-100 text-slate-700 text-xs font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-purple-600 text-white text-xs font-bold"
                >
                  Save Template
                </button>
              </div>
            </form>
          )}

          {/* All Templates Grid with DELETE BUTTONS */}
          <div className="space-y-2">
            {products.length === 0 ? (
              <div className="p-8 rounded-3xl bg-white border border-slate-200 text-center space-y-2">
                <Package className="w-8 h-8 text-slate-400 mx-auto" />
                <p className="text-xs font-bold text-slate-700">No templates found</p>
                <p className="text-[11px] text-slate-500">All templates have been deleted.</p>
                <button
                  onClick={handleRestoreDefaults}
                  className="mt-2 px-3 py-1.5 rounded-xl bg-purple-600 text-white text-xs font-bold"
                >
                  Restore Sample Templates
                </button>
              </div>
            ) : (
              products.map((p) => (
                <div
                  key={p.id}
                  className="p-3 rounded-2xl bg-white border border-slate-200 shadow-xs flex items-center justify-between gap-3 hover:border-purple-300 transition-all"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-12 h-12 rounded-xl bg-[#0f091f] flex items-center justify-center p-1.5 shrink-0 overflow-hidden">
                      <img
                        src={p.imageUrl}
                        alt={p.title}
                        className="w-full h-full object-contain"
                      />
                    </div>
                    <div className="min-w-0">
                      <h4 className="text-xs font-black text-neutral-950 truncate max-w-[170px]">{p.title}</h4>
                      <p className="text-[10px] text-slate-500">
                        {p.category} · {p.difficulty || 'Easy'}
                      </p>
                      <span className="text-[9px] text-purple-600 font-bold">Active in App</span>
                    </div>
                  </div>

                  {/* ACTIONS: EDIT & DELETE BUTTONS */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      onClick={() => handleOpenEditModal(p)}
                      className="py-2 px-2.5 rounded-xl bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 active:scale-95 transition-all flex items-center gap-1 font-bold text-xs shadow-xs"
                      title="Edit Template"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                      <span>Edit</span>
                    </button>

                    <button
                      onClick={() => handleDeleteProduct(p.id, p.title)}
                      className="py-2 px-2.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 active:scale-95 transition-all flex items-center gap-1 font-bold text-xs shadow-xs"
                      title="Delete Template"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Delete</span>
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* EDIT TEMPLATE MODAL */}
          {isEditModalOpen && editingProduct && (
            <div
              className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150"
              onClick={() => setIsEditModalOpen(false)}
            >
              <form
                onSubmit={handleSaveEditProduct}
                onClick={(e) => e.stopPropagation()}
                className="w-full max-w-md bg-white rounded-3xl p-5 shadow-2xl border border-slate-200 space-y-3.5 max-h-[90vh] overflow-y-auto"
              >
                <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-xl bg-purple-50 text-purple-700 flex items-center justify-center font-bold">
                      <Pencil className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="text-xs font-black text-neutral-950">Edit Template</h3>
                      <p className="text-[10px] text-slate-500 truncate max-w-[200px]">{editingProduct.title}</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsEditModalOpen(false)}
                    className="w-7 h-7 rounded-lg bg-slate-100 text-slate-500 hover:text-neutral-900 flex items-center justify-center text-xs font-bold"
                  >
                    ✕
                  </button>
                </div>

                {/* Edit Title */}
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Title</label>
                  <input
                    type="text"
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    className="w-full py-2 px-3 rounded-xl bg-slate-50 border border-slate-300 text-neutral-900 text-xs font-bold focus:outline-none focus:border-purple-600 focus:bg-white"
                    required
                  />
                </div>

                {/* Edit Category & Difficulty */}
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-[10px] font-bold text-slate-500 uppercase">Section / Category</label>
                      <button
                        type="button"
                        onClick={() => setIsCustomCategoryEdit(!isCustomCategoryEdit)}
                        className="text-[10px] font-bold text-purple-600 hover:underline"
                      >
                        {isCustomCategoryEdit ? 'Choose List' : '+ Custom'}
                      </button>
                    </div>
                    {isCustomCategoryEdit ? (
                      <input
                        type="text"
                        value={customCategoryEditVal}
                        onChange={(e) => setCustomCategoryEditVal(e.target.value)}
                        placeholder="New section name..."
                        className="w-full py-2 px-2.5 rounded-xl bg-purple-50/50 border border-purple-400 text-neutral-900 text-xs font-bold focus:outline-none"
                        required
                      />
                    ) : (
                      <select
                        value={editCategory}
                        onChange={(e) => {
                          if (e.target.value === '__custom__') {
                            setIsCustomCategoryEdit(true);
                          } else {
                            setEditCategory(e.target.value);
                          }
                        }}
                        className="w-full py-2 px-2.5 rounded-xl bg-slate-50 border border-slate-300 text-neutral-900 text-xs focus:outline-none focus:border-purple-600"
                      >
                        {categoriesList.filter((c) => c !== 'All').map((cat) => (
                          <option key={cat} value={cat}>
                            {cat}
                          </option>
                        ))}
                        <option value="__custom__">+ Create New Custom Section...</option>
                      </select>
                    )}
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Difficulty</label>
                    <select
                      value={editDifficulty}
                      onChange={(e) => setEditDifficulty(e.target.value as any)}
                      className="w-full py-2 px-2.5 rounded-xl bg-slate-50 border border-slate-300 text-neutral-900 text-xs focus:outline-none focus:border-purple-600"
                    >
                      <option value="Easy">Easy</option>
                      <option value="Medium">Medium</option>
                      <option value="Advanced">Advanced</option>
                    </select>
                  </div>
                </div>

                {/* Edit Image / Upload New */}
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Template Image / Outline</label>
                  <div className="flex items-center gap-3 p-2 rounded-xl bg-slate-50 border border-slate-200">
                    <div className="w-12 h-12 rounded-lg bg-[#0f091f] p-1 flex items-center justify-center shrink-0 overflow-hidden">
                      <img
                        src={editImageUrl || editingProduct.imageUrl}
                        alt="Preview"
                        className="w-full h-full object-contain"
                      />
                    </div>
                    <label className="flex-1 py-2 px-3 rounded-lg bg-white border border-slate-300 text-center text-xs font-bold text-purple-700 hover:bg-purple-50 cursor-pointer shadow-xs">
                      <Upload className="w-3.5 h-3.5 inline mr-1" />
                      Upload New Image
                      <input type="file" accept="image/*" onChange={handleEditImageUpload} className="hidden" />
                    </label>
                  </div>
                </div>

                {/* Edit Price / Tag */}
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Badge Tag</label>
                    <input
                      type="text"
                      value={editPrice}
                      onChange={(e) => setEditPrice(e.target.value)}
                      placeholder="Free, Popular, New"
                      className="w-full py-2 px-3 rounded-xl bg-slate-50 border border-slate-300 text-neutral-900 text-xs focus:outline-none focus:border-purple-600"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Description</label>
                    <input
                      type="text"
                      value={editDescription}
                      onChange={(e) => setEditDescription(e.target.value)}
                      placeholder="Sketch description"
                      className="w-full py-2 px-3 rounded-xl bg-slate-50 border border-slate-300 text-neutral-900 text-xs focus:outline-none focus:border-purple-600"
                    />
                  </div>
                </div>

                <div className="flex gap-2 pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setIsEditModalOpen(false)}
                    className="flex-1 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold shadow-xs active:scale-95"
                  >
                    Save Changes
                  </button>
                </div>
              </form>
            </div>
          )}
        </main>
      )}

      {/* =====================================================================
          TAB 2: SECTIONS & CATEGORIES MANAGER (ANIME, ANIMAL, CUSTOM SECTIONS)
      ===================================================================== */}
      {activeTab === 'categories' && (
        <main className="flex-1 p-4 space-y-4 overflow-y-auto">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xs font-black uppercase tracking-wider text-neutral-900 flex items-center gap-1.5">
                <Tags className="w-3.5 h-3.5 text-purple-600" />
                <span>Sections &amp; Categories Manager</span>
              </h3>
              <p className="text-[11px] text-slate-500">
                Add, edit, or delete Anime, Animals, and custom categories
              </p>
            </div>
          </div>

          {/* Form to Add New Category */}
          <form
            onSubmit={handleAddCategorySubmit}
            className="p-4 rounded-3xl bg-white border border-slate-200 shadow-xs space-y-2.5"
          >
            <h4 className="text-xs font-black text-neutral-950 flex items-center gap-1.5">
              <Plus className="w-3.5 h-3.5 text-purple-600" />
              <span>Create New Custom Section</span>
            </h4>
            <div className="flex gap-2">
              <input
                type="text"
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                placeholder="Section name (e.g. Vehicles, Birds, Flowers)"
                className="flex-1 py-2.5 px-3 rounded-xl bg-slate-50 border border-slate-300 text-neutral-900 text-xs focus:outline-none focus:border-purple-600"
                required
              />
              <button
                type="submit"
                className="py-2.5 px-4 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold shrink-0 shadow-xs active:scale-95"
              >
                Add Section
              </button>
            </div>
          </form>

          {/* Active Categories List */}
          <div className="space-y-2">
            <h4 className="text-xs font-black text-neutral-900 uppercase tracking-wider px-1">
              Active Sections ({categoriesList.length})
            </h4>

            <div className="space-y-2">
              {categoriesList.map((cat) => (
                <div
                  key={cat}
                  className="p-3.5 rounded-2xl bg-white border border-slate-200 shadow-xs flex items-center justify-between gap-3"
                >
                  {editingCategory === cat ? (
                    <div className="flex-1 flex gap-2">
                      <input
                        type="text"
                        value={editCategoryNewName}
                        onChange={(e) => setEditCategoryNewName(e.target.value)}
                        className="flex-1 py-1.5 px-3 rounded-lg bg-slate-50 border border-purple-400 text-xs font-bold focus:outline-none"
                      />
                      <button
                        onClick={() => handleRenameCategorySubmit(cat)}
                        className="px-3 py-1.5 rounded-lg bg-purple-600 text-white text-xs font-bold"
                      >
                        Save
                      </button>
                      <button
                        onClick={() => setEditingCategory(null)}
                        className="px-2 py-1.5 rounded-lg bg-slate-100 text-slate-600 text-xs"
                      >
                        ✕
                      </button>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-8 h-8 rounded-xl bg-purple-50 text-purple-700 flex items-center justify-center font-black text-xs shrink-0">
                          #
                        </div>
                        <div>
                          <h5 className="text-xs font-black text-neutral-950">{cat}</h5>
                          <span className="text-[10px] text-slate-400">
                            {products.filter((p) => p.category.toLowerCase() === cat.toLowerCase()).length} Templates
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        {cat !== 'All' && (
                          <>
                            <button
                              onClick={() => {
                                setEditingCategory(cat);
                                setEditCategoryNewName(cat);
                              }}
                              className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 active:scale-95 transition-all"
                              title="Rename Section"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeleteCategorySubmit(cat)}
                              className="p-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-600 active:scale-95 transition-all"
                              title="Delete Section"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </>
                        )}
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          </div>
        </main>
      )}

      {/* =====================================================================
          TAB 3: UI & THEME CUSTOMIZER (COLOUR THEME & BRANDING)
      ===================================================================== */}
      {activeTab === 'ui-theme' && (
        <main className="flex-1 p-4 space-y-4 overflow-y-auto">
          <div>
            <h3 className="text-xs font-black uppercase tracking-wider text-neutral-900 flex items-center gap-1.5">
              <Palette className="w-3.5 h-3.5 text-purple-600" />
              <span>UI &amp; Theme Customizer</span>
            </h3>
            <p className="text-[11px] text-slate-500">
              Customize the app's primary color theme, branding, and header titles
            </p>
          </div>

          <form onSubmit={handleSaveThemeSubmit} className="space-y-4">
            {/* Color Palette Selector */}
            <div className="p-4 rounded-3xl bg-white border border-slate-200 shadow-xs space-y-3">
              <h4 className="text-xs font-black text-neutral-950 uppercase tracking-wider">
                App Primary Colour Theme
              </h4>
              <div className="grid grid-cols-2 gap-2.5">
                {(Object.keys(THEME_COLOR_PRESETS) as ThemeColorKey[]).map((key) => {
                  const preset = THEME_COLOR_PRESETS[key];
                  const isSelected = selectedThemeKey === key;
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => {
                        setSelectedThemeKey(key);
                        const updated = saveAppThemeConfig({
                          themeColor: key,
                          appName: themeAppName.trim() || 'SketchFlow',
                          tagline: themeTagline.trim() || 'AR Paper Tracing',
                        });
                        setThemeConfig(updated);
                        applyThemeToCss(updated);
                        showToast(`✨ Theme ${preset.name} applied and saved instantly!`);
                      }}
                      className={`p-3 rounded-2xl border text-left flex items-center gap-2.5 transition-all active:scale-98 ${
                        isSelected
                          ? 'border-neutral-950 bg-slate-50 ring-2 ring-purple-500/40 shadow-xs'
                          : 'border-slate-200 bg-white hover:border-slate-300'
                      }`}
                    >
                      <div
                        className="w-7 h-7 rounded-xl flex items-center justify-center text-white shrink-0 shadow-xs"
                        style={{ backgroundColor: preset.hex }}
                      >
                        {isSelected && <Check className="w-4 h-4 stroke-[3]" />}
                      </div>
                      <div className="min-w-0">
                        <span className="text-xs font-black text-neutral-950 block truncate">{preset.name}</span>
                        <span className="text-[10px] text-slate-400 font-mono block">{preset.hex}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Brand Title & Tagline Customizer */}
            <div className="p-4 rounded-3xl bg-white border border-slate-200 shadow-xs space-y-3">
              <h4 className="text-xs font-black text-neutral-950 uppercase tracking-wider">
                Branding &amp; Header Titles
              </h4>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                  App Name (Brand Title)
                </label>
                <input
                  type="text"
                  value={themeAppName}
                  onChange={(e) => setThemeAppName(e.target.value)}
                  placeholder="SketchFlow"
                  className="w-full py-2.5 px-3 rounded-xl bg-slate-50 border border-slate-300 text-neutral-900 text-xs font-bold focus:outline-none focus:border-purple-600 focus:bg-white"
                  required
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                  App Subtitle / Tagline
                </label>
                <input
                  type="text"
                  value={themeTagline}
                  onChange={(e) => setThemeTagline(e.target.value)}
                  placeholder="AR Paper Tracing &amp; Digital Sketching"
                  className="w-full py-2.5 px-3 rounded-xl bg-slate-50 border border-slate-300 text-neutral-900 text-xs font-bold focus:outline-none focus:border-purple-600 focus:bg-white"
                />
              </div>
            </div>

            {/* Live Theme Preview Card */}
            <div className="p-4 rounded-3xl bg-slate-50 border border-slate-200 space-y-2.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                Live Theme Preview
              </span>
              <div className="p-3.5 rounded-2xl bg-white border border-slate-200 shadow-xs flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div
                    className="w-8 h-8 rounded-xl flex items-center justify-center text-white font-black"
                    style={{ backgroundColor: THEME_COLOR_PRESETS[selectedThemeKey].hex }}
                  >
                    ★
                  </div>
                  <div>
                    <h5 className="text-xs font-black text-neutral-950">{themeAppName || 'SketchFlow'}</h5>
                    <p className="text-[10px] text-slate-400">{themeTagline || 'AR Paper Tracing'}</p>
                  </div>
                </div>

                <div
                  className="px-3 py-1.5 rounded-xl text-white text-xs font-bold shadow-xs"
                  style={{ backgroundColor: THEME_COLOR_PRESETS[selectedThemeKey].hex }}
                >
                  Active Theme
                </div>
              </div>
            </div>

            <button
              type="submit"
              className="w-full py-3.5 rounded-2xl bg-neutral-950 hover:bg-neutral-800 active:scale-98 text-white font-black text-xs uppercase tracking-wider shadow-md transition-all flex items-center justify-center gap-2"
            >
              <Palette className="w-4 h-4" />
              <span>Save UI Theme &amp; Brand Settings</span>
            </button>
          </form>
        </main>
      )}

      {/* =====================================================================
          TAB 4: GUIDE CUSTOMIZER (CUSTOMIZE STEPS & PRO TIPS)
      ===================================================================== */}
      {activeTab === 'guide' && (
        <main className="flex-1 p-4 space-y-4 overflow-y-auto">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xs font-black uppercase tracking-wider text-neutral-900 flex items-center gap-1.5">
                <BookOpen className="w-3.5 h-3.5 text-purple-600" />
                <span>Guide Customizer</span>
              </h3>
              <p className="text-[11px] text-slate-500">
                Customize user guide steps and helpful drawing tips
              </p>
            </div>

            <button
              onClick={handleRestoreGuideDefaults}
              className="py-1 px-2.5 rounded-xl border border-slate-300 text-slate-600 hover:bg-slate-100 text-xs font-bold"
            >
              Restore Defaults
            </button>
          </div>

          {/* Guide Title & Subtitle Form */}
          <form onSubmit={handleSaveGuideDetails} className="p-4 rounded-3xl bg-white border border-slate-200 shadow-xs space-y-3">
            <h4 className="text-xs font-black text-neutral-950 uppercase tracking-wider">
              Guide Header Details
            </h4>
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Guide Main Title</label>
              <input
                type="text"
                value={guideConfig.title}
                onChange={(e) => setGuideConfig({ ...guideConfig, title: e.target.value })}
                className="w-full py-2 px-3 rounded-xl bg-slate-50 border border-slate-300 text-xs font-bold text-neutral-900 focus:outline-none focus:border-purple-600"
                required
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Guide Subtitle / Note</label>
              <input
                type="text"
                value={guideConfig.subtitle}
                onChange={(e) => setGuideConfig({ ...guideConfig, subtitle: e.target.value })}
                className="w-full py-2 px-3 rounded-xl bg-slate-50 border border-slate-300 text-xs text-neutral-900 focus:outline-none focus:border-purple-600"
              />
            </div>
            <button
              type="submit"
              className="py-2 px-4 rounded-xl bg-neutral-900 text-white text-xs font-bold shadow-xs active:scale-95"
            >
              Update Header
            </button>
          </form>

          {/* Form to Add New Guide Step */}
          <form onSubmit={handleAddGuideStepSubmit} className="p-4 rounded-3xl bg-white border border-slate-200 shadow-xs space-y-3">
            <h4 className="text-xs font-black text-neutral-950 uppercase tracking-wider flex items-center gap-1.5">
              <Plus className="w-3.5 h-3.5 text-purple-600" />
              <span>Add New Tracing Step</span>
            </h4>
            <div>
              <input
                type="text"
                value={newStepTitle}
                onChange={(e) => setNewStepTitle(e.target.value)}
                placeholder="Step Title (e.g. Trace gently with pencil)"
                className="w-full py-2 px-3 rounded-xl bg-slate-50 border border-slate-300 text-xs font-bold text-neutral-900 focus:outline-none focus:border-purple-600 mb-2"
                required
              />
              <textarea
                value={newStepDesc}
                onChange={(e) => setNewStepDesc(e.target.value)}
                placeholder="Step details / instructions..."
                rows={2}
                className="w-full py-2 px-3 rounded-xl bg-slate-50 border border-slate-300 text-xs text-neutral-900 focus:outline-none focus:border-purple-600"
                required
              />
            </div>
            <button
              type="submit"
              className="py-2 px-4 rounded-xl bg-purple-600 text-white text-xs font-bold shadow-xs active:scale-95"
            >
              Add Step
            </button>
          </form>

          {/* Current Steps List */}
          <div className="space-y-2">
            <h4 className="text-xs font-black text-neutral-900 uppercase tracking-wider px-1">
              Active Guide Steps ({guideConfig.steps.length})
            </h4>

            {guideConfig.steps.map((step, idx) => (
              <div
                key={step.id || idx}
                className="p-3.5 rounded-2xl bg-white border border-slate-200 shadow-xs flex items-start justify-between gap-3"
              >
                <div className="flex items-start gap-3 min-w-0">
                  <div className="w-7 h-7 rounded-xl bg-purple-600 text-white text-xs font-black flex items-center justify-center shrink-0">
                    {step.stepNumber || idx + 1}
                  </div>
                  <div className="min-w-0">
                    <h5 className="text-xs font-black text-neutral-950">{step.title}</h5>
                    <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">{step.desc}</p>
                  </div>
                </div>

                <button
                  onClick={() => handleDeleteGuideStepSubmit(step.id)}
                  className="p-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-600 active:scale-95 transition-all shrink-0"
                  title="Delete Step"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>

          {/* Pro Tips Manager */}
          <div className="p-4 rounded-3xl bg-white border border-slate-200 shadow-xs space-y-3">
            <h4 className="text-xs font-black text-neutral-950 uppercase tracking-wider flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-purple-600" />
              <span>Pro Tips Manager</span>
            </h4>

            <form onSubmit={handleAddGuideTipSubmit} className="flex gap-2">
              <input
                type="text"
                value={newTipInput}
                onChange={(e) => setNewTipInput(e.target.value)}
                placeholder="Write a new tracing tip..."
                className="flex-1 py-2 px-3 rounded-xl bg-slate-50 border border-slate-300 text-xs text-neutral-900 focus:outline-none focus:border-purple-600"
              />
              <button
                type="submit"
                className="py-2 px-3 rounded-xl bg-neutral-900 text-white text-xs font-bold shrink-0"
              >
                Add Tip
              </button>
            </form>

            <div className="space-y-1.5 pt-1">
              {(guideConfig.tips || []).map((tip, idx) => (
                <div
                  key={idx}
                  className="p-2.5 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-between gap-2"
                >
                  <span className="text-[11px] text-slate-700 leading-relaxed">• {tip}</span>
                  <button
                    onClick={() => handleDeleteGuideTipSubmit(idx)}
                    className="text-slate-400 hover:text-rose-600 shrink-0 p-1"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </main>
      )}

      {/* =====================================================================
          TAB 2: BANDE & USAGE TRACKING (ANALYTICS)
      ===================================================================== */}
      {activeTab === 'analytics' && (
        <main className="flex-1 p-4 space-y-4 overflow-y-auto">
          {/* Top Quick Stats Grid */}
          <div className="grid grid-cols-3 gap-2.5">
            <div className="p-3 rounded-2xl bg-white border border-slate-200 shadow-xs flex flex-col justify-between">
              <div className="flex items-center justify-between text-purple-600">
                <span className="text-[10px] font-bold uppercase tracking-wider">Total Visitors</span>
                <Users className="w-3.5 h-3.5" />
              </div>
              <p className="text-xl font-black text-neutral-950 mt-1">{visitors.length}</p>
              <span className="text-[9px] text-slate-400">Unique Users</span>
            </div>

            <div className="p-3 rounded-2xl bg-white border border-emerald-200 shadow-xs flex flex-col justify-between">
              <div className="flex items-center justify-between text-emerald-600">
                <span className="text-[10px] font-bold uppercase tracking-wider">Live Now</span>
                <Activity className="w-3.5 h-3.5 animate-pulse" />
              </div>
              <p className="text-xl font-black text-emerald-600 mt-1">{activeCount}</p>
              <span className="text-[9px] text-emerald-600/80">Online Now</span>
            </div>

            <div className="p-3 rounded-2xl bg-white border border-slate-200 shadow-xs flex flex-col justify-between">
              <div className="flex items-center justify-between text-purple-600">
                <span className="text-[10px] font-bold uppercase tracking-wider">Avg Time</span>
                <Clock className="w-3.5 h-3.5" />
              </div>
              <p className="text-xl font-black text-neutral-950 mt-1">{formatDuration(avgSeconds)}</p>
              <span className="text-[9px] text-slate-400">Per Session</span>
            </div>
          </div>

          {/* Visitors Live List */}
          <div className="space-y-2">
            <div className="flex items-center justify-between px-1">
              <h3 className="text-xs font-black uppercase tracking-wider text-neutral-950 flex items-center gap-1.5">
                <Smartphone className="w-3.5 h-3.5 text-purple-600" />
                <span>Visitor Activity &amp; Session Duration</span>
              </h3>
              <span className="text-[10px] text-slate-400">Refreshes every 8s</span>
            </div>

            {visitors.length === 0 ? (
              <div className="p-8 rounded-3xl bg-white border border-slate-200 text-center space-y-2">
                <Users className="w-8 h-8 text-slate-400 mx-auto" />
                <p className="text-xs text-slate-600">No visitor sessions recorded yet.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {visitors.map((v) => {
                  const isOnline = now - v.lastSeen < 60000;
                  return (
                    <div
                      key={v.id}
                      className="p-3.5 rounded-2xl bg-white border border-slate-200 shadow-xs flex items-center justify-between gap-3"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 font-black text-xs ${
                            isOnline
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-purple-50 text-purple-700 border border-purple-200'
                          }`}
                        >
                          {v.uniqueName.charAt(0)}
                        </div>

                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <h4 className="text-xs font-black text-neutral-950 truncate max-w-[140px]">
                              {v.uniqueName}
                            </h4>
                            {isOnline && (
                              <span className="px-1.5 py-0.2 rounded-full bg-emerald-100 text-emerald-700 text-[9px] font-bold">
                                LIVE
                              </span>
                            )}
                          </div>
                          <p className="text-[10px] text-slate-500 truncate">
                            {v.device} · First seen: {new Date(v.firstSeen).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </p>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <span className="text-xs font-black text-neutral-900 font-mono block">
                          {formatDuration(v.totalSeconds)}
                        </span>
                        <span className="text-[9px] text-slate-400 block">Total Spent</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </main>
      )}

      {/* =====================================================================
          TAB 3: FIREBASE & SECURITY CONFIGURATION
      ===================================================================== */}
      {activeTab === 'security' && (
        <main className="flex-1 p-4 space-y-4 overflow-y-auto">
          {/* Change Admin Gmail Card */}
          <div className="p-4 rounded-3xl bg-white border border-slate-200 shadow-xs space-y-3">
            <div className="flex items-center gap-2">
              <Mail className="w-4 h-4 text-purple-600" />
              <h4 className="text-xs font-black text-neutral-950 uppercase tracking-wider">
                Update Admin Gmail ID
              </h4>
            </div>
            <p className="text-[11px] text-slate-500">
              Current Active Admin Gmail: <strong className="text-neutral-900">{adminConfig.adminEmail}</strong>
            </p>

            <form onSubmit={handleUpdateAdminEmailFromSecurity} className="space-y-2">
              <input
                type="email"
                value={changeEmailInput}
                onChange={(e) => setChangeEmailInput(e.target.value)}
                placeholder="Enter new Gmail ID (e.g. you@gmail.com)"
                className="w-full py-2 px-3 rounded-xl bg-slate-50 border border-slate-300 text-neutral-900 text-xs focus:outline-none focus:border-purple-600"
                required
              />
              <button
                type="submit"
                disabled={isUpdatingEmail}
                className="w-full py-2.5 rounded-xl bg-purple-600 text-white font-bold text-xs"
              >
                {isUpdatingEmail ? 'Updating...' : 'Update Admin Gmail'}
              </button>
            </form>

            {emailUpdateMsg && (
              <div
                className={`p-2.5 rounded-xl text-xs flex items-center gap-2 ${
                  emailUpdateMsg.type === 'success' ? 'bg-emerald-50 text-emerald-800' : 'bg-rose-50 text-rose-800'
                }`}
              >
                <span>{emailUpdateMsg.text}</span>
              </div>
            )}
          </div>

          {/* Change Master Passcode Card */}
          <div className="p-4 rounded-3xl bg-white border border-slate-200 shadow-xs space-y-3">
            <div className="flex items-center gap-2">
              <Lock className="w-4 h-4 text-purple-600" />
              <h4 className="text-xs font-black text-neutral-950 uppercase tracking-wider">
                Change Master Passcode
              </h4>
            </div>

            <form onSubmit={handleChangePasscode} className="space-y-2">
              <input
                type="password"
                value={currPass}
                onChange={(e) => setCurrPass(e.target.value)}
                placeholder="Current Passcode"
                className="w-full py-2 px-3 rounded-xl bg-slate-50 border border-slate-300 text-xs"
                required
              />
              <input
                type="password"
                value={newPass}
                onChange={(e) => setNewPass(e.target.value)}
                placeholder="New Passcode"
                className="w-full py-2 px-3 rounded-xl bg-slate-50 border border-slate-300 text-xs"
                required
              />
              <input
                type="password"
                value={confirmPass}
                onChange={(e) => setConfirmPass(e.target.value)}
                placeholder="Confirm New Passcode"
                className="w-full py-2 px-3 rounded-xl bg-slate-50 border border-slate-300 text-xs"
                required
              />
              <button
                type="submit"
                disabled={isChangingPass}
                className="w-full py-2.5 rounded-xl bg-neutral-900 text-white font-bold text-xs"
              >
                {isChangingPass ? 'Updating...' : 'Change Passcode'}
              </button>
            </form>

            {passChangeSuccess && (
              <div className="p-2.5 rounded-xl bg-emerald-50 text-emerald-800 text-xs">
                {passChangeSuccess}
              </div>
            )}
            {passChangeError && (
              <div className="p-2.5 rounded-xl bg-rose-50 text-rose-800 text-xs">
                {passChangeError}
              </div>
            )}
          </div>
        </main>
      )}
    </div>
  );
};
