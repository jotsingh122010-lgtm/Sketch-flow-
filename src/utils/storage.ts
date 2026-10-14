import { SavedProject } from '../types';

const STORAGE_KEY = 'sketch_ar_projects_v1';

export function getSavedProjects(): SavedProject[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch (err) {
    console.error('Failed to read saved projects from localStorage', err);
    return [];
  }
}

export function saveProject(project: Omit<SavedProject, 'id' | 'createdAt'>): SavedProject {
  const existing = getSavedProjects();
  const newProject: SavedProject = {
    ...project,
    id: `proj_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    createdAt: Date.now(),
  };

  const updated = [newProject, ...existing].slice(0, 20); // Keep latest 20
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch (err) {
    console.warn('LocalStorage limit reached, trimming older items', err);
    // Trim to 5 latest items if storage quota exceeded
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify([newProject, ...existing.slice(0, 4)]));
    } catch {
      // Ignore
    }
  }
  return newProject;
}

export function deleteProject(id: string): void {
  const existing = getSavedProjects();
  const filtered = existing.filter((p) => p.id !== id);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
  } catch (err) {
    console.error('Failed to update localStorage after delete', err);
  }
}
