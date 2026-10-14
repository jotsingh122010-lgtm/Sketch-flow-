import { ProductItem } from '../types';
import { SAMPLE_TEMPLATES } from '../data/sampleTemplates';

const PRODUCTS_STORAGE_KEY = 'sketchflow_products_v1';

// Initial seeds from sample templates
const INITIAL_PRODUCTS: ProductItem[] = SAMPLE_TEMPLATES.map((tpl, i) => ({
  id: tpl.id,
  title: tpl.title,
  category: tpl.category,
  imageUrl: tpl.svgDataUrl,
  difficulty: tpl.difficulty || 'Easy',
  price: i === 0 ? 'Free' : i % 2 === 0 ? 'Popular' : 'New',
  description: `${tpl.category} line art template ready for physical paper tracing`,
  createdAt: Date.now() - (i * 3600000),
}));

export function getProducts(): ProductItem[] {
  try {
    const raw = localStorage.getItem(PRODUCTS_STORAGE_KEY);
    if (raw !== null) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        // Ensure Gojo and samples have the updated full-screen SVG
        let hasFix = false;
        const synced = parsed.map((item: ProductItem) => {
          if (item.id === 'anime-gojo') {
            const freshGojo = SAMPLE_TEMPLATES.find((s) => s.id === 'anime-gojo');
            if (freshGojo && item.imageUrl !== freshGojo.svgDataUrl) {
              hasFix = true;
              return { ...item, imageUrl: freshGojo.svgDataUrl };
            }
          }
          return item;
        });
        if (hasFix) {
          localStorage.setItem(PRODUCTS_STORAGE_KEY, JSON.stringify(synced));
        }
        return synced;
      }
    }
    // Initialize if never stored before
    localStorage.setItem(PRODUCTS_STORAGE_KEY, JSON.stringify(INITIAL_PRODUCTS));
    return INITIAL_PRODUCTS;
  } catch {
    return INITIAL_PRODUCTS;
  }
}

export function saveProduct(product: Omit<ProductItem, 'id' | 'createdAt'>): ProductItem {
  const current = getProducts();
  const newProduct: ProductItem = {
    ...product,
    id: 'prod_' + Math.random().toString(36).substring(2, 9) + '_' + Date.now(),
    createdAt: Date.now(),
  };

  const updated = [newProduct, ...current];
  localStorage.setItem(PRODUCTS_STORAGE_KEY, JSON.stringify(updated));

  // Sync to backend if admin token available
  const token = typeof window !== 'undefined' ? sessionStorage.getItem('sketchflow_admin_token') : null;
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  fetch('/api/products', {
    method: 'POST',
    headers,
    body: JSON.stringify(newProduct),
  }).catch(() => {});

  return newProduct;
}

export function deleteProductById(id: string): void {
  const current = getProducts();
  const updated = current.filter((p) => p.id !== id);
  localStorage.setItem(PRODUCTS_STORAGE_KEY, JSON.stringify(updated));

  const token = typeof window !== 'undefined' ? sessionStorage.getItem('sketchflow_admin_token') : null;
  const headers: Record<string, string> = {};
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  fetch(`/api/products/${id}`, {
    method: 'DELETE',
    headers,
  }).catch(() => {});
}

export function updateProduct(id: string, updates: Partial<ProductItem>): ProductItem | null {
  const current = getProducts();
  const index = current.findIndex((p) => p.id === id);
  if (index === -1) return null;

  const updatedItem: ProductItem = {
    ...current[index],
    ...updates,
  };

  current[index] = updatedItem;
  localStorage.setItem(PRODUCTS_STORAGE_KEY, JSON.stringify(current));

  const token = typeof window !== 'undefined' ? sessionStorage.getItem('sketchflow_admin_token') : null;
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  fetch(`/api/products/${id}`, {
    method: 'PUT',
    headers,
    body: JSON.stringify(updates),
  }).catch(() => {});

  return updatedItem;
}

export function restoreDefaultTemplates(): ProductItem[] {
  localStorage.setItem(PRODUCTS_STORAGE_KEY, JSON.stringify(INITIAL_PRODUCTS));
  return INITIAL_PRODUCTS;
}

// =========================================================================
// 2. DYNAMIC CATEGORIES / SECTIONS MANAGEMENT
// =========================================================================
const CATEGORIES_STORAGE_KEY = 'sketchflow_categories_v1';
export const DEFAULT_CATEGORIES = ['All', 'Classic', 'Anime & Manga', 'Cartoon', 'Animals', 'Cute', 'Tattoo'];

export function getCategories(): string[] {
  try {
    const raw = localStorage.getItem(CATEGORIES_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        if (!parsed.includes('All')) {
          return ['All', ...parsed];
        }
        return parsed;
      }
    }
  } catch {}
  localStorage.setItem(CATEGORIES_STORAGE_KEY, JSON.stringify(DEFAULT_CATEGORIES));
  return DEFAULT_CATEGORIES;
}

export function saveCategories(categories: string[]): string[] {
  const clean = Array.from(new Set(categories.map((c) => c.trim()).filter(Boolean)));
  if (!clean.includes('All')) {
    clean.unshift('All');
  }
  localStorage.setItem(CATEGORIES_STORAGE_KEY, JSON.stringify(clean));
  return clean;
}

export function addCategory(name: string): string[] {
  const trimmed = name.trim();
  if (!trimmed) return getCategories();
  const current = getCategories();
  if (current.some((c) => c.toLowerCase() === trimmed.toLowerCase())) {
    return current;
  }
  const updated = [...current, trimmed];
  return saveCategories(updated);
}

export function updateCategory(oldName: string, newName: string): string[] {
  const trimmed = newName.trim();
  if (!trimmed || oldName === 'All') return getCategories();
  const current = getCategories();
  const updated = current.map((c) => (c === oldName ? trimmed : c));

  // Also update existing products that used this category
  const products = getProducts();
  let changed = false;
  const updatedProducts = products.map((p) => {
    if (p.category === oldName) {
      changed = true;
      return { ...p, category: trimmed };
    }
    return p;
  });
  if (changed) {
    localStorage.setItem(PRODUCTS_STORAGE_KEY, JSON.stringify(updatedProducts));
  }

  return saveCategories(updated);
}

export function deleteCategory(name: string): string[] {
  if (name === 'All') return getCategories();
  const current = getCategories();
  const updated = current.filter((c) => c !== name);
  return saveCategories(updated);
}

// =========================================================================
// 3. UI THEME & BRAND CUSTOMIZER
// =========================================================================
export type ThemeColorKey = 'purple' | 'indigo' | 'blue' | 'emerald' | 'rose' | 'amber' | 'slate';

export interface AppThemeConfig {
  themeColor: ThemeColorKey;
  primaryHex: string;
  primaryLightHex: string;
  appName: string;
  tagline: string;
  cardRadius: 'rounded-2xl' | 'rounded-3xl';
}

export const THEME_COLOR_PRESETS: Record<
  ThemeColorKey,
  { name: string; hex: string; hoverHex: string; lightHex: string; darkHex: string; darkBg: string; badge: string }
> = {
  purple: { name: 'Royal Purple (Default)', hex: '#9333ea', hoverHex: '#7e22ce', lightHex: '#f3e8ff', darkHex: '#3b0764', darkBg: '#0e071c', badge: 'bg-purple-600' },
  indigo: { name: 'Electric Indigo', hex: '#6366f1', hoverHex: '#4f46e5', lightHex: '#e0e7ff', darkHex: '#1e1b4b', darkBg: '#090821', badge: 'bg-indigo-600' },
  blue: { name: 'Ocean Blue', hex: '#2563eb', hoverHex: '#1d4ed8', lightHex: '#dbeafe', darkHex: '#172554', darkBg: '#060d1f', badge: 'bg-blue-600' },
  emerald: { name: 'Emerald Green', hex: '#059669', hoverHex: '#047857', lightHex: '#d1fae5', darkHex: '#064e3b', darkBg: '#03140e', badge: 'bg-emerald-600' },
  rose: { name: 'Rose Blossom', hex: '#e11d48', hoverHex: '#be123c', lightHex: '#ffe4e6', darkHex: '#881337', darkBg: '#1a050d', badge: 'bg-rose-600' },
  amber: { name: 'Sunset Amber', hex: '#d97706', hoverHex: '#b45309', lightHex: '#fef3c7', darkHex: '#78350f', darkBg: '#170c02', badge: 'bg-amber-600' },
  slate: { name: 'Monochrome Slate', hex: '#0f172a', hoverHex: '#020617', lightHex: '#f1f5f9', darkHex: '#0f172a', darkBg: '#090d16', badge: 'bg-slate-900' },
};

const THEME_STORAGE_KEY = 'sketchflow_theme_config_v1';

export const DEFAULT_THEME_CONFIG: AppThemeConfig = {
  themeColor: 'purple',
  primaryHex: '#9333ea',
  primaryLightHex: '#f3e8ff',
  appName: 'SketchFlow',
  tagline: 'AR Paper Tracing',
  cardRadius: 'rounded-3xl',
};

export function getAppThemeConfig(): AppThemeConfig {
  try {
    const raw = localStorage.getItem(THEME_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && parsed.themeColor) {
        return { ...DEFAULT_THEME_CONFIG, ...parsed };
      }
    }
  } catch {}
  return DEFAULT_THEME_CONFIG;
}

export function saveAppThemeConfig(config: Partial<AppThemeConfig>): AppThemeConfig {
  const current = getAppThemeConfig();
  const targetKey = config.themeColor || current.themeColor;
  const preset = THEME_COLOR_PRESETS[targetKey] || THEME_COLOR_PRESETS.purple;
  const updated: AppThemeConfig = {
    ...current,
    ...config,
    themeColor: targetKey,
    primaryHex: preset.hex,
    primaryLightHex: preset.lightHex,
  };
  localStorage.setItem(THEME_STORAGE_KEY, JSON.stringify(updated));

  // Sync to CSS variables
  applyThemeToCss(updated);

  return updated;
}

export function applyThemeToCss(config: AppThemeConfig) {
  if (typeof document !== 'undefined') {
    const preset = THEME_COLOR_PRESETS[config.themeColor] || THEME_COLOR_PRESETS.purple;
    document.documentElement.style.setProperty('--app-primary', preset.hex);
    document.documentElement.style.setProperty('--app-primary-hover', preset.hoverHex);
    document.documentElement.style.setProperty('--app-primary-light', preset.lightHex);
    document.documentElement.style.setProperty('--app-primary-dark', preset.darkHex);
    document.documentElement.style.setProperty('--app-bg-dark', preset.darkBg);

    // Notify all app components about theme update
    window.dispatchEvent(new CustomEvent('sketchflow_theme_changed', { detail: config }));
  }
}

// =========================================================================
// 4. CUSTOMIZABLE GUIDE SECTION
// =========================================================================
export interface GuideStep {
  id: string;
  stepNumber: number;
  title: string;
  desc: string;
}

export interface GuideConfig {
  title: string;
  subtitle: string;
  steps: GuideStep[];
  tips: string[];
}

const GUIDE_STORAGE_KEY = 'sketchflow_guide_config_v1';

export const DEFAULT_GUIDE_CONFIG: GuideConfig = {
  title: 'AR Paper Tracing Setup Guide',
  subtitle: 'Simple steps to easily sketch and trace onto physical paper',
  steps: [
    {
      id: 'step_1',
      stepNumber: 1,
      title: 'Mount Phone on a Stand or Cup',
      desc: 'Place your phone horizontally on a glass cup, book, or phone stand pointing downwards towards your paper.',
    },
    {
      id: 'step_2',
      stepNumber: 2,
      title: 'Set Opacity to 25% - 35%',
      desc: 'Use the slider to keep opacity around 25%-35%. This lets you clearly see both the reference outline and your pencil.',
    },
    {
      id: 'step_3',
      stepNumber: 3,
      title: 'Follow Lines with Pencil',
      desc: 'Look through the screen and trace onto your paper with a pencil. Lock the reference so it does not move while drawing.',
    },
    {
      id: 'step_4',
      stepNumber: 4,
      title: 'Practice on Digital Canvas',
      desc: 'Use the built-in Pen tool to draw directly on the screen. Easily undo and redo any mistakes.',
    },
  ],
  tips: [
    'Ensure good lighting on your paper so your pencil lines are clearly visible through the camera.',
    'Lock the reference image before starting to prevent accidental shifts while drawing.',
    'If the photo is too dark, apply the "Sketch Line" or "Invert" filter from the filters menu.',
  ],
};

export function getGuideConfig(): GuideConfig {
  try {
    const raw = localStorage.getItem(GUIDE_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && Array.isArray(parsed.steps)) {
        return parsed;
      }
    }
  } catch {}
  return DEFAULT_GUIDE_CONFIG;
}

export function saveGuideConfig(config: GuideConfig): GuideConfig {
  localStorage.setItem(GUIDE_STORAGE_KEY, JSON.stringify(config));
  return config;
}

export function restoreDefaultGuide(): GuideConfig {
  localStorage.setItem(GUIDE_STORAGE_KEY, JSON.stringify(DEFAULT_GUIDE_CONFIG));
  return DEFAULT_GUIDE_CONFIG;
}
