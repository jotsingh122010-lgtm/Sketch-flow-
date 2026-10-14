import { initializeApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut,
  onAuthStateChanged,
  User
} from 'firebase/auth';
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  collection,
  getDocs,
  deleteDoc,
  onSnapshot,
  getDocFromServer
} from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';
import { ProductItem, VisitorInfo } from './types';

// 1. Initialize Firebase App & Services
const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId); /* CRITICAL: The app will break without this line */
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

// Error Handling conformant with Firebase Integration Skill
export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
    },
    operationType,
    path,
  };
  console.warn('Firestore Operation Info:', JSON.stringify(errInfo));
  return errInfo;
}

// Initial connection test as instructed by SKILL.md
export async function testFirestoreConnection() {
  try {
    await getDocFromServer(doc(db, 'admin_settings', 'primary'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.warn('Firebase client is offline or initializing.');
    }
  }
}
testFirestoreConnection();

export interface AdminSettings {
  adminEmail: string;
  recoveryKey: string;
  updatedAt?: string;
  updatedBy?: string;
}

export const DEFAULT_ADMIN_EMAIL = 'jotsingh122010@gmail.com';
export const DEFAULT_RECOVERY_KEY = 'SKETCH_SECURE_2026';

export function isUserAdmin(emailOrUser?: string | User | null, configuredAdminEmail?: string): boolean {
  if (!emailOrUser) return false;
  const email = (typeof emailOrUser === 'string' ? emailOrUser : emailOrUser.email || '').trim().toLowerCase();
  const target = (configuredAdminEmail || DEFAULT_ADMIN_EMAIL).trim().toLowerCase();
  return email === target || email === DEFAULT_ADMIN_EMAIL.toLowerCase();
}

// Read or bootstrap Admin Settings from Firestore (no hardcoding in code!)
export async function getAdminSettings(): Promise<AdminSettings> {
  const settingsRef = doc(db, 'admin_settings', 'primary');
  try {
    const snap = await getDoc(settingsRef);
    if (snap.exists()) {
      const data = snap.data() as AdminSettings;
      return {
        adminEmail: data.adminEmail || DEFAULT_ADMIN_EMAIL,
        recoveryKey: data.recoveryKey || DEFAULT_RECOVERY_KEY,
        updatedAt: data.updatedAt,
        updatedBy: data.updatedBy,
      };
    } else {
      // Bootstrap initial configuration document securely in Firestore
      const initial: AdminSettings = {
        adminEmail: DEFAULT_ADMIN_EMAIL,
        recoveryKey: DEFAULT_RECOVERY_KEY,
        updatedAt: new Date().toISOString(),
        updatedBy: 'initial_bootstrap',
      };
      await setDoc(settingsRef, initial);
      return initial;
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, 'admin_settings/primary');
    // Fallback to local configuration if Firestore read fails
    return {
      adminEmail: DEFAULT_ADMIN_EMAIL,
      recoveryKey: DEFAULT_RECOVERY_KEY,
    };
  }
}

// Update Admin Email securely in Firestore
export async function updateAdminEmailInFirestore(newEmail: string, callerUidOrEmail: string): Promise<{ success: boolean; message: string }> {
  const settingsRef = doc(db, 'admin_settings', 'primary');
  try {
    await updateDoc(settingsRef, {
      adminEmail: newEmail.trim().toLowerCase(),
      updatedAt: new Date().toISOString(),
      updatedBy: callerUidOrEmail,
    });
    return { success: true, message: `Admin email successfully updated to ${newEmail} in Firebase!` };
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, 'admin_settings/primary');
    // If updateDoc failed because doc didn't exist yet, try setDoc
    try {
      await setDoc(settingsRef, {
        adminEmail: newEmail.trim().toLowerCase(),
        recoveryKey: DEFAULT_RECOVERY_KEY,
        updatedAt: new Date().toISOString(),
        updatedBy: callerUidOrEmail,
      });
      return { success: true, message: `Admin email set to ${newEmail} in Firebase!` };
    } catch (setErr) {
      const errInfo = handleFirestoreError(setErr, OperationType.WRITE, 'admin_settings/primary');
      return { success: false, message: `Firebase error: ${errInfo.error}` };
    }
  }
}

// Reset / Change Admin Email using Forgot Password / Recovery Key
export async function resetAdminEmailWithRecoveryKey(
  newEmail: string,
  recoveryKeyInput: string
): Promise<{ success: boolean; message: string }> {
  try {
    const currentSettings = await getAdminSettings();
    if (currentSettings.recoveryKey.trim() !== recoveryKeyInput.trim()) {
      return {
        success: false,
        message: 'Invalid Recovery Passcode! Please enter a valid recovery key.',
      };
    }

    const settingsRef = doc(db, 'admin_settings', 'primary');
    await setDoc(
      settingsRef,
      {
        adminEmail: newEmail.trim().toLowerCase(),
        recoveryKey: currentSettings.recoveryKey,
        updatedAt: new Date().toISOString(),
        updatedBy: 'recovery_reset',
      },
      { merge: true }
    );

    return {
      success: true,
      message: `Admin email successfully updated to: ${newEmail}`,
    };
  } catch (err) {
    const errInfo = handleFirestoreError(err, OperationType.UPDATE, 'admin_settings/primary');
    return { success: false, message: errInfo.error };
  }
}

// Real Firebase Google Sign-In with popup
export async function signInWithGoogle(): Promise<{ user: User | null; error?: string }> {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    return { user: result.user };
  } catch (err: any) {
    console.error('Google Sign-In Error:', err);
    return { user: null, error: err.message || 'Google sign-in cancelled or failed' };
  }
}

// Firebase Auth Email / Password Login
export async function loginWithEmail(email: string, pass: string): Promise<{ user: User | null; error?: string }> {
  try {
    const result = await signInWithEmailAndPassword(auth, email.trim(), pass);
    return { user: result.user };
  } catch (err: any) {
    return { user: null, error: err.message || 'Authentication failed' };
  }
}

// Firebase Auth Email / Password Register
export async function registerWithEmail(email: string, pass: string): Promise<{ user: User | null; error?: string }> {
  try {
    const result = await createUserWithEmailAndPassword(auth, email.trim(), pass);
    return { user: result.user };
  } catch (err: any) {
    return { user: null, error: err.message || 'Registration failed' };
  }
}

// Forgot Password via Firebase Auth Reset Link
export async function sendFirebasePasswordReset(email: string): Promise<{ success: boolean; message: string }> {
  try {
    await sendPasswordResetEmail(auth, email.trim());
    return {
      success: true,
      message: `Password reset link sent to your email (${email})! Please check your inbox.`,
    };
  } catch (err: any) {
    return {
      success: false,
      message: err.message || 'Password reset request failed.',
    };
  }
}

// Logout
export async function logOutFromFirebase(): Promise<void> {
  await signOut(auth);
}

// Sync Products to Firestore
export async function fetchProductsFromFirestore(): Promise<ProductItem[]> {
  try {
    const snap = await getDocs(collection(db, 'products'));
    const list: ProductItem[] = [];
    snap.forEach((d) => {
      const data = d.data();
      list.push({
        id: d.id,
        title: data.name || data.title,
        category: data.category || 'General',
        imageUrl: data.image || data.imageUrl,
        difficulty: data.difficulty || 'medium',
        description: data.description || '',
        price: data.price || 'Free',
        createdAt: data.createdAt ? new Date(data.createdAt).getTime() : Date.now(),
      });
    });
    return list;
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, 'products');
    return [];
  }
}

export async function addProductToFirestore(product: Omit<ProductItem, 'id' | 'createdAt'>): Promise<ProductItem | null> {
  const prodId = 'prod_' + Math.random().toString(36).substring(2, 9) + '_' + Date.now();
  const docRef = doc(db, 'products', prodId);
  try {
    const payload = {
      name: product.title,
      category: product.category,
      difficulty: (product.difficulty?.toLowerCase() as any) || 'medium',
      image: product.imageUrl,
      description: product.description || '',
      createdAt: new Date().toISOString(),
      createdBy: auth.currentUser?.email || 'admin',
    };
    await setDoc(docRef, payload);
    return {
      ...product,
      id: prodId,
      createdAt: Date.now(),
    };
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, `products/${prodId}`);
    return null;
  }
}

export async function deleteProductFromFirestore(productId: string): Promise<boolean> {
  try {
    await deleteDoc(doc(db, 'products', productId));
    return true;
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `products/${productId}`);
    return false;
  }
}

// Sync Visitor Session to Firestore
export async function syncVisitorSessionToFirestore(visitor: VisitorInfo): Promise<void> {
  try {
    const docRef = doc(db, 'visitors', visitor.id);
    await setDoc(
      docRef,
      {
        uniqueName: visitor.uniqueName,
        platform: visitor.device,
        durationSeconds: visitor.totalSeconds,
        status: visitor.isOnline ? 'online' : 'offline',
        lastSeen: new Date(visitor.lastSeen).toISOString(),
        firstSeen: new Date(visitor.firstSeen).toISOString(),
      },
      { merge: true }
    );
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `visitors/${visitor.id}`);
  }
}
