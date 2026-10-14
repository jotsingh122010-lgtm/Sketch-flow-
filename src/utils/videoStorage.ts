// IndexedDB based robust Video Storage for SketchFlow
// Allows storing large video blobs without localStorage 5MB quota errors.

export interface RecordedVideoItem {
  id: string;
  name: string;
  date: number;
  dataUrl: string; // Object URL or Base64 for rendering in video tags
  blob?: Blob;
  resolution?: string;
  fps?: number;
  duration?: number;
}

const DB_NAME = 'SketchFlowVideosDB';
const DB_VERSION = 1;
const STORE_NAME = 'videos';

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      reject(new Error('IndexedDB not supported'));
      return;
    }

    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onerror = () => {
      reject(request.error);
    };
  });
}

// Convert blob to base64 if needed
export function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error('Failed to convert blob to base64'));
      }
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

// Automatically save a recorded video
export async function autoSaveRecordedVideo(item: {
  name?: string;
  blob: Blob;
  duration?: number;
  resolution?: string;
  fps?: number;
}): Promise<RecordedVideoItem> {
  const id = 'rec_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
  const now = Date.now();
  const name = item.name || `Tracing Video ${new Date().toLocaleTimeString()}`;

  // Create an object URL for instant UI preview
  const objectUrl = URL.createObjectURL(item.blob);

  const videoRecord: RecordedVideoItem = {
    id,
    name,
    date: now,
    dataUrl: objectUrl,
    blob: item.blob,
    resolution: item.resolution || '720p',
    fps: item.fps || 30,
    duration: item.duration || 0,
  };

  try {
    const db = await openDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.put({
        id: videoRecord.id,
        name: videoRecord.name,
        date: videoRecord.date,
        blob: item.blob,
        resolution: videoRecord.resolution,
        fps: videoRecord.fps,
        duration: videoRecord.duration,
      });
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn('IndexedDB write failed, trying fallback to localStorage metadata', err);
    // As a fallback, store metadata only in localStorage (avoiding large binary)
    try {
      const existing = JSON.parse(localStorage.getItem('sketchflow_recordings_meta') || '[]');
      existing.unshift({
        id: videoRecord.id,
        name: videoRecord.name,
        date: videoRecord.date,
        resolution: videoRecord.resolution,
        fps: videoRecord.fps,
        duration: videoRecord.duration,
      });
      localStorage.setItem('sketchflow_recordings_meta', JSON.stringify(existing.slice(0, 30)));
    } catch {}
  }

  // Dispatch custom event to notify all listening components (HomeScreen, ARDrawingScreen)
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('sketchflow_videos_updated', { detail: { newId: id } }));
  }

  return videoRecord;
}

// Get all recorded videos from IndexedDB
export async function getAllRecordedVideos(): Promise<RecordedVideoItem[]> {
  try {
    const db = await openDB();
    const storedItems = await new Promise<any[]>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });

    // Sort descending by date
    storedItems.sort((a, b) => (b.date || 0) - (a.date || 0));

    return storedItems.map((item) => {
      let dataUrl = '';
      if (item.blob instanceof Blob) {
        dataUrl = URL.createObjectURL(item.blob);
      } else if (typeof item.dataUrl === 'string') {
        dataUrl = item.dataUrl;
      }
      return {
        id: item.id,
        name: item.name || 'Tracing Video',
        date: item.date || Date.now(),
        dataUrl,
        blob: item.blob instanceof Blob ? item.blob : undefined,
        resolution: item.resolution || '720p',
        fps: item.fps || 30,
        duration: item.duration || 0,
      };
    });
  } catch (err) {
    console.warn('IndexedDB read failed, checking localStorage legacy recordings', err);
    // Legacy localStorage check
    try {
      const legacy = JSON.parse(localStorage.getItem('sketchflow_recordings') || '[]');
      if (Array.isArray(legacy) && legacy.length > 0) {
        return legacy;
      }
    } catch {}
    return [];
  }
}

// Delete a recorded video
export async function deleteRecordedVideo(id: string): Promise<void> {
  try {
    const db = await openDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.delete(id);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn('IndexedDB delete failed', err);
  }

  // Also clean up legacy localStorage if present
  try {
    const legacy = JSON.parse(localStorage.getItem('sketchflow_recordings') || '[]');
    const updated = legacy.filter((item: any) => item.id !== id);
    localStorage.setItem('sketchflow_recordings', JSON.stringify(updated));
  } catch {}

  // Dispatch update event
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('sketchflow_videos_updated', { detail: { deletedId: id } }));
  }
}

// Export recorded video: tries Web Share API (native mobile save to gallery/camera roll),
// then File System Access API, then download fallback.
export async function exportVideoToGallery(video: RecordedVideoItem): Promise<{ success: boolean; method: string; message: string }> {
  try {
    let blob = video.blob;
    if (!blob && video.dataUrl) {
      const res = await fetch(video.dataUrl);
      blob = await res.blob();
    }

    if (!blob) {
      throw new Error('Video data not available');
    }

    const cleanName = `${(video.name || 'tracing_video').toLowerCase().replace(/[^a-z0-9_-]/g, '_')}_${video.resolution || '720p'}.mp4`;
    const videoFile = new File([blob], cleanName, { type: 'video/mp4' });

    // Method 1: Web Share API with files (triggers native iOS/Android "Save Video" / "Save to Gallery")
    if (typeof navigator !== 'undefined' && navigator.canShare && navigator.canShare({ files: [videoFile] })) {
      try {
        await navigator.share({
          files: [videoFile],
          title: video.name || 'AR Tracing Video',
          text: 'Save this AR Tracing video directly to your photos gallery.',
        });
        return {
          success: true,
          method: 'share',
          message: 'Video exported! Choose "Save Video" or "Photos" to save to your device gallery.',
        };
      } catch (shareErr: any) {
        if (shareErr.name === 'AbortError') {
          return {
            success: false,
            method: 'cancelled',
            message: 'Export was cancelled.',
          };
        }
        // Fall through to other methods
      }
    }

    // Method 2: Modern File System Access API (Desktop Chrome / Android Chrome with experimental flag)
    if (typeof (window as any).showSaveFilePicker === 'function') {
      try {
        const handle = await (window as any).showSaveFilePicker({
          suggestedName: cleanName,
          types: [
            {
              description: 'MP4 Video',
              accept: { 'video/mp4': ['.mp4'] },
            },
          ],
        });
        const writable = await handle.createWritable();
        await writable.write(blob);
        await writable.close();
        return {
          success: true,
          method: 'filesystem',
          message: 'Video successfully saved to your chosen folder!',
        };
      } catch (fsErr: any) {
        if (fsErr.name === 'AbortError') {
          return {
            success: false,
            method: 'cancelled',
            message: 'Save cancelled.',
          };
        }
        // Fall through to download
      }
    }

    // Method 3: Direct Download trigger
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = cleanName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 10000);

    return {
      success: true,
      method: 'download',
      message: 'Video downloaded! You can move it to your gallery or photos.',
    };
  } catch (err: any) {
    console.error('Export error:', err);
    return {
      success: false,
      method: 'error',
      message: err?.message || 'Failed to export video.',
    };
  }
}
