export type AppScreen = 'home' | 'ar' | 'settings' | 'admin';

export type FilterMode = 'normal' | 'outline' | 'sketch' | 'contrast' | 'invert' | 'grayscale';

export type BlendMode = 'normal' | 'multiply' | 'screen';

export interface OverlayImageState {
  src: string;
  name: string;
  opacity: number;       // 0 to 100
  scale: number;         // 0.2 to 3.5
  x: number;             // pixel translation
  y: number;
  rotation: number;      // degrees
  isLocked: boolean;     // lock position to avoid accidental moves
  isMirrored: boolean;   // horizontal flip
  filterMode: FilterMode;
  blendMode?: BlendMode;
}

export interface SavedProject {
  id: string;
  name: string;
  createdAt: number;
  previewUrl: string;
  type: 'ar-trace';
}

export interface SketchTemplate {
  id: string;
  title: string;
  category: string;
  svgDataUrl: string;
  difficulty?: 'Easy' | 'Medium' | 'Advanced';
  price?: string;
  description?: string;
}

export interface VisitorInfo {
  id: string;
  uniqueName: string;
  device: string;
  firstSeen: number;
  lastSeen: number;
  totalSeconds: number;
  isOnline: boolean;
  actions: string[];
}

export interface ProductItem {
  id: string;
  title: string;
  category: string;
  imageUrl: string;
  price?: string;
  difficulty?: string;
  description?: string;
  createdAt: number;
}
