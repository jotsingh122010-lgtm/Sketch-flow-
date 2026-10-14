import { VisitorInfo } from '../types';

const ADJECTIVES = [
  'Creative', 'Quick', 'Shadow', 'Neon', 'Cosmic', 'Golden', 'Swift', 'Silent',
  'Master', 'Mystic', 'Spark', 'Lunar', 'Turbo', 'Blaze', 'Frost', 'Echo'
];

const NOUNS = [
  'Artist', 'Sketcher', 'Pencil', 'Drawer', 'Creator', 'Falcon', 'Tiger', 'Wolf',
  'Phoenix', 'Fox', 'Hawk', 'Lotus', 'Wizard', 'Vision', 'Crafter', 'Brush'
];

function generateUniqueArtistName(): string {
  const adj = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
  const noun = NOUNS[Math.floor(Math.random() * NOUNS.length)];
  const num = Math.floor(100 + Math.random() * 900);
  return `${adj}${noun}_#${num}`;
}

const STORAGE_USER_ID = 'sketchflow_visitor_id';
const STORAGE_USER_NAME = 'sketchflow_visitor_name';
const LOCAL_VISITORS_KEY = 'sketchflow_all_visitors_v1';

export function getOrCreateVisitor(): { id: string; uniqueName: string } {
  let id = localStorage.getItem(STORAGE_USER_ID);
  let uniqueName = localStorage.getItem(STORAGE_USER_NAME);

  if (!id) {
    id = 'vis_' + Math.random().toString(36).substring(2, 10) + '_' + Date.now();
    localStorage.setItem(STORAGE_USER_ID, id);
  }

  if (!uniqueName) {
    uniqueName = generateUniqueArtistName();
    localStorage.setItem(STORAGE_USER_NAME, uniqueName);
  }

  return { id, uniqueName };
}

export function detectDevice(): string {
  const ua = navigator.userAgent;
  if (/Android/i.test(ua)) {
    return 'Android Phone (Chrome)';
  } else if (/iPhone|iPad|iPod/i.test(ua)) {
    return 'iOS Device (Safari)';
  } else if (/Windows/i.test(ua)) {
    return 'Windows PC (Browser)';
  } else if (/Mac/i.test(ua)) {
    return 'Mac OS (Browser)';
  }
  return 'Mobile Browser';
}

// Local storage backup for visitors
export function getLocalVisitors(): VisitorInfo[] {
  try {
    const raw = localStorage.getItem(LOCAL_VISITORS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveLocalVisitors(visitors: VisitorInfo[]): void {
  try {
    localStorage.setItem(LOCAL_VISITORS_KEY, JSON.stringify(visitors));
  } catch (e) {
    console.error(e);
  }
}

// Active session tracking state
let sessionSeconds = 0;
let isTrackerActive = false;

export function initVisitorTracker(onAction?: string) {
  if (isTrackerActive && !onAction) return;
  isTrackerActive = true;

  const { id, uniqueName } = getOrCreateVisitor();
  const device = detectDevice();

  const pingServer = async (actionToAdd?: string) => {
    try {
      await fetch('/api/track/ping', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id,
          uniqueName,
          device,
          elapsedSeconds: sessionSeconds,
          action: actionToAdd,
        }),
      });
    } catch {
      // Local sync fallback
    }

    // Mirror in local storage
    const list = getLocalVisitors();
    const existingIndex = list.findIndex(v => v.id === id);
    const now = Date.now();

    if (existingIndex >= 0) {
      const prev = list[existingIndex];
      const updatedActions = actionToAdd
        ? [actionToAdd, ...prev.actions.filter(a => a !== actionToAdd)].slice(0, 5)
        : prev.actions;

      list[existingIndex] = {
        ...prev,
        lastSeen: now,
        totalSeconds: (prev.totalSeconds || 0) + 10,
        isOnline: true,
        actions: updatedActions,
      };
    } else {
      list.unshift({
        id,
        uniqueName,
        device,
        firstSeen: now,
        lastSeen: now,
        totalSeconds: 10,
        isOnline: true,
        actions: actionToAdd ? [actionToAdd] : ['Opened App'],
      });
    }
    saveLocalVisitors(list);
  };

  // Immediate first ping
  pingServer(onAction || 'Opened App');

  // Periodic heartbeat every 10 seconds
  const interval = setInterval(() => {
    sessionSeconds += 10;
    pingServer();
  }, 10000);

  return () => clearInterval(interval);
}

export function recordUserAction(actionName: string) {
  const { id, uniqueName } = getOrCreateVisitor();
  const device = detectDevice();

  fetch('/api/track/ping', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      id,
      uniqueName,
      device,
      elapsedSeconds: sessionSeconds,
      action: actionName,
    }),
  }).catch(() => {});

  const list = getLocalVisitors();
  const existing = list.find(v => v.id === id);
  if (existing) {
    existing.lastSeen = Date.now();
    existing.actions = [actionName, ...existing.actions.filter(a => a !== actionName)].slice(0, 5);
    saveLocalVisitors(list);
  }
}
