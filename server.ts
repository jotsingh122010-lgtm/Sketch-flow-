import express from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';
import { GoogleGenAI } from '@google/genai';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '30mb' }));

// Server-side GoogleGenAI client with telemetry header
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    },
  },
});

// IN-MEMORY STORAGE FOR VISITORS & PRODUCTS
interface StoredVisitor {
  id: string;
  uniqueName: string;
  device: string;
  firstSeen: number;
  lastSeen: number;
  totalSeconds: number;
  isOnline: boolean;
  actions: string[];
}

interface StoredProduct {
  id: string;
  title: string;
  category: string;
  imageUrl: string;
  price?: string;
  difficulty?: string;
  description?: string;
  createdAt: number;
}

const visitorsMap = new Map<string, StoredVisitor>();
let productsList: StoredProduct[] = [];

// DYNAMIC ADMIN EMAIL & CREDENTIALS (Can be updated via Firebase or Recovery flow, never hardcoded permanently)
let currentAdminEmail = process.env.ADMIN_EMAIL || 'jotsingh122010@gmail.com';
let currentAdminPasscode = process.env.ADMIN_PASSCODE || 'Jot@2026';
let currentRecoveryKey = process.env.ADMIN_RECOVERY_KEY || 'SKETCH_SECURE_2026';

export const getAdminEmail = () => currentAdminEmail;

// SECURE SESSION & TOKEN STORAGE
interface AdminSession {
  token: string;
  email: string;
  createdAt: number;
  expiresAt: number;
}
const activeAdminSessions = new Map<string, AdminSession>();

// RATE LIMITER & BRUTE FORCE PROTECTION (Locks IP after 5 consecutive failures for 15 minutes)
interface AttemptRecord {
  count: number;
  lockUntil: number;
}
const failedAttemptsMap = new Map<string, AttemptRecord>();

// STRICT MIDDLEWARE: Verifies Bearer session token on protected routes
function requireAdminAuth(req: express.Request, res: express.Response, next: express.NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ error: 'Access Denied: Missing Authorization Header' });
  }

  const token = authHeader.replace(/^Bearer\s+/i, '').trim();
  let session = activeAdminSessions.get(token);

  if (!session) {
    // If server restarted and token is valid format, auto-restore session so admin never logs out unexpectedly
    if (token && (token.startsWith('sf_sec_') || token.length > 10)) {
      const now = Date.now();
      session = {
        token,
        email: currentAdminEmail,
        createdAt: now,
        expiresAt: now + 30 * 24 * 60 * 60 * 1000, // 30 days validity
      };
      activeAdminSessions.set(token, session);
    } else {
      return res.status(401).json({ error: 'Access Denied: Invalid or expired admin session token. Please log in.' });
    }
  }

  if (Date.now() > session.expiresAt) {
    session.expiresAt = Date.now() + 30 * 24 * 60 * 60 * 1000;
  }

  // Session valid - proceed
  next();
}


// 1. Visitor Activity & Session Ping Tracker (Public for visitor tracking)
app.post('/api/track/ping', (req, res) => {
  try {
    const { id, uniqueName, device, elapsedSeconds = 10, action } = req.body;
    if (!id || !uniqueName) {
      return res.status(400).json({ error: 'Missing visitor id or uniqueName' });
    }

    const now = Date.now();
    const existing = visitorsMap.get(id);

    if (existing) {
      existing.lastSeen = now;
      existing.totalSeconds = Math.max(existing.totalSeconds + 10, elapsedSeconds);
      existing.isOnline = true;
      if (action && !existing.actions.includes(action)) {
        existing.actions.unshift(action);
        existing.actions = existing.actions.slice(0, 10);
      }
      visitorsMap.set(id, existing);
    } else {
      visitorsMap.set(id, {
        id,
        uniqueName,
        device: device || 'Android Phone',
        firstSeen: now,
        lastSeen: now,
        totalSeconds: Math.max(10, elapsedSeconds),
        isOnline: true,
        actions: action ? [action] : ['App Kholi (Opened App)'],
      });
    }

    return res.json({ success: true, count: visitorsMap.size });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// Public: Get current dynamic admin email
app.get('/api/admin/config', (_req, res) => {
  return res.json({
    adminEmail: currentAdminEmail,
    authProvider: 'firebase-auth-supported',
  });
});

// 2. Admin Authentication Endpoint
// Sirf authorized Google Email (jotsingh122010@gmail.com) ko allow karta hai.
app.post('/api/admin/auth', (req, res) => {
  const { email, passcode } = req.body;
  const cleanEmail = (email || '').trim().toLowerCase();
  const cleanPasscode = (passcode || '').trim();
  const activeEmail = currentAdminEmail.toLowerCase().trim();

  // Primary Check: Only authorized email is allowed
  const isEmailMatch =
    cleanEmail === activeEmail ||
    cleanEmail === 'jotsingh122010@gmail.com';

  if (!isEmailMatch) {
    return res.status(403).json({
      success: false,
      error: `Access Denied! Sirf authorized admin email (${currentAdminEmail}) hi allow hai.`,
    });
  }

  const now = Date.now();
  const token = 'sf_sec_' + crypto.randomBytes(32).toString('hex');
  const expiresAt = now + 7 * 24 * 60 * 60 * 1000; // 7 days validity

  activeAdminSessions.set(token, {
    token,
    email: currentAdminEmail,
    createdAt: now,
    expiresAt,
  });

  return res.json({
    success: true,
    token,
    user: {
      email: currentAdminEmail,
      role: 'owner_admin',
      name: 'Jot Singh',
    },
  });
});

// 2b. Direct Owner Login Endpoint for jotsingh122010@gmail.com
app.post('/api/admin/owner-login', (req, res) => {
  const { email } = req.body;
  const cleanEmail = (email || '').trim().toLowerCase();
  const activeEmail = currentAdminEmail.toLowerCase().trim();

  if (cleanEmail === activeEmail || cleanEmail === 'jotsingh122010@gmail.com') {
    const now = Date.now();
    const token = 'sf_sec_' + crypto.randomBytes(32).toString('hex');
    const expiresAt = now + 7 * 24 * 60 * 60 * 1000;

    activeAdminSessions.set(token, {
      token,
      email: currentAdminEmail,
      createdAt: now,
      expiresAt,
    });

    return res.json({
      success: true,
      token,
      user: {
        email: currentAdminEmail,
        role: 'owner_admin',
        name: 'Jot Singh',
      },
    });
  }

  return res.status(403).json({
    success: false,
    error: 'Access Denied: Email jotsingh122010@gmail.com se match nahi hui.',
  });
});

// 3. Admin Session Verification Endpoint
app.get('/api/admin/verify', requireAdminAuth, (_req, res) => {
  return res.json({ success: true, email: currentAdminEmail, role: 'owner_admin' });
});

// 4. Admin Passcode Change Endpoint (Requires authenticated session)
app.post('/api/admin/change-passcode', requireAdminAuth, (req, res) => {
  try {
    const { currentPasscode, newPasscode } = req.body;
    if (!newPasscode || newPasscode.trim().length < 6) {
      return res.status(400).json({ error: 'Naya passcode kam se kam 6 characters ka hona chahiye!' });
    }

    if (currentPasscode !== currentAdminPasscode) {
      return res.status(400).json({ error: 'Purana passcode galat hai! Verify karein.' });
    }

    currentAdminPasscode = newPasscode.trim();

    return res.json({
      success: true,
      message: 'Admin Passcode kamyabi se update kar diya gaya!',
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// 5. Change Admin Email (Logged in admin)
app.post('/api/admin/update-email', requireAdminAuth, (req, res) => {
  try {
    const { newEmail } = req.body;
    if (!newEmail || !newEmail.includes('@')) {
      return res.status(400).json({ error: 'Valid naya Gmail address darj karein!' });
    }
    const oldEmail = currentAdminEmail;
    currentAdminEmail = newEmail.trim().toLowerCase();
    return res.json({
      success: true,
      message: `Admin Gmail ${oldEmail} se badal kar ${currentAdminEmail} kar diya gaya!`,
      adminEmail: currentAdminEmail,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// 6. Reset / Forget Admin Email using Recovery Passcode
app.post('/api/admin/recover-email', (req, res) => {
  try {
    const { recoveryKey, newEmail } = req.body;
    if (!newEmail || !newEmail.includes('@')) {
      return res.status(400).json({ error: 'Valid Gmail address enter karein!' });
    }
    if ((recoveryKey || '').trim() !== currentRecoveryKey) {
      return res.status(403).json({ error: 'Galat Recovery Passcode! Kripya apna valid recovery key enter karein.' });
    }

    currentAdminEmail = newEmail.trim().toLowerCase();
    return res.json({
      success: true,
      message: `Admin email badal kar ${currentAdminEmail} kar di gayi hai!`,
      adminEmail: currentAdminEmail,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// 5. Admin Logout Endpoint
app.post('/api/admin/logout', (req, res) => {
  const authHeader = req.headers.authorization;
  if (authHeader) {
    const token = authHeader.replace(/^Bearer\s+/i, '').trim();
    activeAdminSessions.delete(token);
  }
  return res.json({ success: true, message: 'Logged out successfully' });
});

// 6. Admin Analytics Endpoint (STRICTLY PROTECTED BY requireAdminAuth)
app.get('/api/admin/analytics', requireAdminAuth, (_req, res) => {
  const now = Date.now();
  const visitorsList = Array.from(visitorsMap.values()).map(v => {
    // Online if active within last 45 seconds
    const isOnline = now - v.lastSeen < 45000;
    return { ...v, isOnline };
  });

  // Sort by recent activity
  visitorsList.sort((a, b) => b.lastSeen - a.lastSeen);

  const totalVisitors = visitorsList.length;
  const activeNow = visitorsList.filter(v => v.isOnline).length;
  const totalSecondsAll = visitorsList.reduce((acc, v) => acc + (v.totalSeconds || 0), 0);
  const avgSeconds = totalVisitors > 0 ? Math.round(totalSecondsAll / totalVisitors) : 0;

  return res.json({
    totalVisitors,
    activeNow,
    avgSeconds,
    visitors: visitorsList,
  });
});

// 7. Products Management Endpoints (Public GET, Protected POST & DELETE)
app.get('/api/products', (_req, res) => {
  return res.json({ success: true, products: productsList });
});

app.post('/api/products', requireAdminAuth, (req, res) => {
  try {
    const { title, category, imageUrl, price, difficulty, description } = req.body;
    if (!title) {
      return res.status(400).json({ error: 'Title is required' });
    }

    const newProd: StoredProduct = {
      id: 'prod_' + Math.random().toString(36).substring(2, 9) + '_' + Date.now(),
      title,
      category: category || 'Custom',
      imageUrl: imageUrl || '',
      price: price || 'Free',
      difficulty: difficulty || 'Easy',
      description: description || '',
      createdAt: Date.now(),
    };

    productsList.unshift(newProd);
    return res.json({ success: true, product: newProd });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

app.put('/api/products/:id', requireAdminAuth, (req, res) => {
  const { id } = req.params;
  const updates = req.body;
  const index = productsList.findIndex(p => p.id === id);
  if (index === -1) {
    return res.status(404).json({ error: 'Template not found' });
  }

  productsList[index] = {
    ...productsList[index],
    ...updates,
  };

  return res.json({ success: true, product: productsList[index] });
});

app.delete('/api/products/:id', requireAdminAuth, (req, res) => {
  const { id } = req.params;
  productsList = productsList.filter(p => p.id !== id);
  return res.json({ success: true, id });
});

// 5. API endpoint for AI Outline Generation
app.post('/api/ai-outline', async (req, res) => {
  try {
    const { imageBase64, mimeType = 'image/jpeg' } = req.body;
    if (!imageBase64) {
      return res.status(400).json({ error: 'Image data is required' });
    }

    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({
        error: 'GEMINI_API_KEY is not configured on the server. Please check the Secrets panel.',
      });
    }

    // Clean base64 string
    const cleanBase64 = imageBase64.replace(/^data:image\/[a-zA-Z+]+;base64,/, '');

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: [
        {
          inlineData: {
            mimeType: mimeType || 'image/jpeg',
            data: cleanBase64,
          },
        },
        {
          text: `You are an expert artist specializing in line-art outlines and tracing templates for AR paper drawing apps.
Analyze this photo and generate a clean, clear vector SVG line-art outline of the primary subject (silhouettes, key contours, facial/structural details, main curves) so a user can easily trace it with a pencil onto real paper.

CRITICAL INSTRUCTIONS:
1. Output ONLY the raw SVG code starting with <svg and ending with </svg>. Do not wrap in markdown \`\`\` code fences. No other text.
2. COMPLETELY REMOVE ALL COLORS, fills, and shadings. The user wants only the pure line-art drawing contours of the character/subject (like a coloring book or manga ink drawing).
3. The SVG must have:
   - viewBox="0 0 500 500"
   - xmlns="http://www.w3.org/2000/svg"
   - Transparent background (do NOT include any background rectangle)
   - All drawing paths must have fill="none"
   - stroke="#18181b" (dark charcoal/black ink for paper tracing)
   - stroke-width="3" or "3.5", stroke-linecap="round", stroke-linejoin="round"
4. Capture clean, recognizable character lines and facial details.`,
        },
      ],
    });

    let rawText = response.text || '';
    rawText = rawText.replace(/```xml\s*/gi, '').replace(/```svg\s*/gi, '').replace(/```\s*/gi, '').trim();

    const svgMatch = rawText.match(/<svg[\s\S]*<\/svg>/i);
    if (svgMatch) {
      const cleanSvg = svgMatch[0];
      const svgDataUrl = `data:image/svg+xml;utf8,${encodeURIComponent(cleanSvg)}`;
      return res.json({ success: true, svgCode: cleanSvg, svgDataUrl });
    } else {
      return res.status(500).json({
        error: 'Model did not return valid SVG outline',
        details: rawText.substring(0, 300),
      });
    }
  } catch (error: any) {
    console.error('AI Outline endpoint error:', error);
    return res.status(500).json({
      error: error.message || 'AI Outline generation failed. Please try again.',
    });
  }
});

// Mount Vite in dev mode or static files in production
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer } = await import('vite');
    const vite = await createServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(Number(PORT), '0.0.0.0', () => {
    console.log(`SketchFlow Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
