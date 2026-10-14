import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  ArrowLeft,
  Camera,
  Flashlight,
  FlashlightOff,
  RotateCcw,
  Sliders,
  ZoomIn,
  ZoomOut,
  Lock,
  Unlock,
  FlipHorizontal,
  RotateCw,
  Image as ImageIcon,
  Grid3X3,
  Pause,
  Play,
  Upload,
  RefreshCw,
  ChevronDown,
  Eye,
  EyeOff,
  Sparkles,
  Undo2,
  Redo2,
  PenTool,
  Maximize2,
  Minimize2,
  Trash2,
  Video,
  VideoOff,
  Download,
  Share2,
  CheckCircle2,
  X
} from 'lucide-react';
import { OverlayImageState, FilterMode, BlendMode } from '../types';
import { ImagePickerModal } from './ImagePickerModal';
import { SAMPLE_TEMPLATES } from '../data/sampleTemplates';
import { recordUserAction } from '../utils/visitorTracker';
import { getAppThemeConfig, THEME_COLOR_PRESETS } from '../utils/productManager';
import { extractColorlessOutline, extractSketchOutline } from '../utils/outlineExtractor';
import {
  autoSaveRecordedVideo,
  getAllRecordedVideos,
  deleteRecordedVideo,
  exportVideoToGallery,
  RecordedVideoItem
} from '../utils/videoStorage';

interface ARDrawingScreenProps {
  onBack: () => void;
  initialImageSrc?: string;
  initialImageName?: string;
}

export const ARDrawingScreen: React.FC<ARDrawingScreenProps> = ({
  onBack,
  initialImageSrc,
  initialImageName,
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const sliderTrackRef = useRef<HTMLDivElement | null>(null);

  // Dynamic Theme state
  const [themeConfig, setThemeConfig] = useState(() => getAppThemeConfig());
  const themePreset = THEME_COLOR_PRESETS[themeConfig.themeColor] || THEME_COLOR_PRESETS.purple;

  // Camera states
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [cameraLoading, setCameraLoading] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [hasTorchSupport, setHasTorchSupport] = useState(false);
  const [isTorchOn, setIsTorchOn] = useState(false);
  const [isFrozen, setIsFrozen] = useState(false);
  const [frozenFrameUrl, setFrozenFrameUrl] = useState<string | null>(null);
  const [showGrid, setShowGrid] = useState(false);

  // Default opacity: 28% (Faint / halki photo for paper tracing!)
  const [overlay, setOverlay] = useState<OverlayImageState>(() => {
    const isGojo = (initialImageName || '').toLowerCase().includes('gojo') || (!initialImageSrc);
    return {
      src: initialImageSrc || SAMPLE_TEMPLATES[0].svgDataUrl,
      name: initialImageName || SAMPLE_TEMPLATES[0].title,
      opacity: 28,
      scale: isGojo ? 1.35 : 1.15,
      x: 0,
      y: 0,
      rotation: 0,
      isLocked: false,
      isMirrored: false,
      filterMode: 'normal',
      blendMode: 'normal',
    };
  });

  const lastNonZeroOpacityRef = useRef<number>(28);

  // AI Outline states
  const [isGeneratingAIOutline, setIsGeneratingAIOutline] = useState(false);
  const [originalImageSrc, setOriginalImageSrc] = useState<string | null>(null);
  const [aiOutlineSvgUrl, setAiOutlineSvgUrl] = useState<string | null>(null);

  // UI Panels
  const [activePanel, setActivePanel] = useState<'none' | 'transform' | 'brush'>('none');
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isDraggingSlider, setIsDraggingSlider] = useState(false);

  // Digital Sketching Canvas & Undo/Redo States
  const sketchCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDrawingMode, setIsDrawingMode] = useState<boolean>(false);
  const [penTool, setPenTool] = useState<'pen' | 'pencil' | 'highlighter' | 'eraser'>('pen');
  const [penColor, setPenColor] = useState<string>(() => themePreset.hex);
  const [penWidth, setPenWidth] = useState<number>(4);
  const [canUndo, setCanUndo] = useState<boolean>(false);
  const [canRedo, setCanRedo] = useState<boolean>(false);
  const [isFullScreenTemplate, setIsFullScreenTemplate] = useState<boolean>(true);
  const [templateFitMode, setTemplateFitMode] = useState<'cover' | 'contain'>('cover');

  const isDrawingRef = useRef<boolean>(false);
  const lastPointRef = useRef<{ x: number; y: number } | null>(null);
  const undoStackRef = useRef<string[]>(['']);
  const redoStackRef = useRef<string[]>([]);

  // Video Recording States & Quality Selection
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [recordedVideoUrl, setRecordedVideoUrl] = useState<string | null>(null);
  const [isVideoModalOpen, setIsVideoModalOpen] = useState(false);
  const [selectedResolution, setSelectedResolution] = useState<'480p' | '720p' | '1080p' | '2k'>('1080p');
  const [selectedFps, setSelectedFps] = useState<30 | 60>(30);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [isExportingProgress, setIsExportingProgress] = useState(false);
  const [exportProgressValue, setExportProgressValue] = useState(0);
  const [isRecordingsGalleryOpen, setIsRecordingsGalleryOpen] = useState(false);
  const [confirmDeleteVideoId, setConfirmDeleteVideoId] = useState<string | null>(null);
  const [savedRecordings, setSavedRecordings] = useState<RecordedVideoItem[]>([]);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<any>(null);
  const recordingCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const recordingAnimFrameRef = useRef<number | null>(null);
  const isRecordingRef = useRef(false);
  const micStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);

  const formatDuration = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // Sync recordings from IndexedDB
  const syncRecordings = useCallback(async () => {
    const items = await getAllRecordedVideos();
    setSavedRecordings(items);
  }, []);

  useEffect(() => {
    syncRecordings();
    const handleSync = () => {
      syncRecordings();
    };
    window.addEventListener('sketchflow_videos_updated', handleSync);
    return () => window.removeEventListener('sketchflow_videos_updated', handleSync);
  }, [syncRecordings]);

  // Sync theme changes live
  useEffect(() => {
    const handleThemeEvent = (e: any) => {
      if (e.detail) {
        setThemeConfig(e.detail);
        const nextPreset = THEME_COLOR_PRESETS[e.detail.themeColor as keyof typeof THEME_COLOR_PRESETS] || THEME_COLOR_PRESETS.purple;
        setPenColor(nextPreset.hex);
      }
    };
    window.addEventListener('sketchflow_theme_changed', handleThemeEvent);
    return () => window.removeEventListener('sketchflow_theme_changed', handleThemeEvent);
  }, []);

  // Cleanup recording on unmount
  useEffect(() => {
    return () => {
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
      }
      if (recordingAnimFrameRef.current) {
        cancelAnimationFrame(recordingAnimFrameRef.current);
      }
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        try {
          mediaRecorderRef.current.stop();
        } catch {}
      }
    };
  }, []);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // Resize sketch canvas
  useEffect(() => {
    const canvas = sketchCanvasRef.current;
    if (!canvas) return;

    const resizeCanvas = () => {
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      const currentData = canvas.toDataURL();

      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;

      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.scale(dpr, dpr);
        if (currentData && currentData.length > 50) {
          const img = new Image();
          img.onload = () => {
            ctx.drawImage(img, 0, 0, rect.width, rect.height);
          };
          img.src = currentData;
        }
      }
    };

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    return () => window.removeEventListener('resize', resizeCanvas);
  }, []);

  const saveCanvasSnapshot = useCallback(() => {
    const canvas = sketchCanvasRef.current;
    if (!canvas) return;
    try {
      const dataUrl = canvas.toDataURL();
      undoStackRef.current.push(dataUrl);
      if (undoStackRef.current.length > 30) {
        undoStackRef.current.shift();
      }
      redoStackRef.current = [];
      setCanUndo(undoStackRef.current.length > 1);
      setCanRedo(false);
    } catch (e) {
      console.warn('Canvas snapshot error:', e);
    }
  }, []);

  const handleUndo = useCallback(() => {
    const canvas = sketchCanvasRef.current;
    if (!canvas || undoStackRef.current.length <= 1) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const currentState = undoStackRef.current.pop();
    if (currentState) {
      redoStackRef.current.push(currentState);
    }

    const previousState = undoStackRef.current[undoStackRef.current.length - 1];
    const rect = canvas.getBoundingClientRect();

    if (!previousState || previousState === '') {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    } else {
      const img = new Image();
      img.onload = () => {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, rect.width, rect.height);
      };
      img.src = previousState;
    }

    setCanUndo(undoStackRef.current.length > 1);
    setCanRedo(redoStackRef.current.length > 0);
    showToast('Undo ↺');
  }, []);

  const handleRedo = useCallback(() => {
    const canvas = sketchCanvasRef.current;
    if (!canvas || redoStackRef.current.length === 0) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const nextState = redoStackRef.current.pop();
    if (!nextState) return;

    undoStackRef.current.push(nextState);
    const rect = canvas.getBoundingClientRect();

    const img = new Image();
    img.onload = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, rect.width, rect.height);
    };
    img.src = nextState;

    setCanUndo(true);
    setCanRedo(redoStackRef.current.length > 0);
    showToast('Redo ↺');
  }, []);

  const handleClearSketch = useCallback(() => {
    const canvas = sketchCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    undoStackRef.current.push('');
    redoStackRef.current = [];
    setCanUndo(undoStackRef.current.length > 1);
    setCanRedo(false);
    showToast('Canvas cleared');
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && (e.key === 'z' || e.key === 'Z')) {
        e.preventDefault();
        if (e.shiftKey) {
          handleRedo();
        } else {
          handleUndo();
        }
      } else if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || e.key === 'Y')) {
        e.preventDefault();
        handleRedo();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleUndo, handleRedo]);

  const startDrawing = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawingMode) return;
    const canvas = sketchCanvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    isDrawingRef.current = true;
    lastPointRef.current = { x, y };

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    if (penTool === 'eraser') {
      ctx.globalCompositeOperation = 'destination-out';
      ctx.lineWidth = penWidth * 3;
    } else if (penTool === 'highlighter') {
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 0.35;
      ctx.strokeStyle = penColor;
      ctx.lineWidth = penWidth * 2.5;
    } else if (penTool === 'pencil') {
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 0.7;
      ctx.strokeStyle = penColor;
      ctx.lineWidth = Math.max(1.5, penWidth * 0.75);
    } else {
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 1.0;
      ctx.strokeStyle = penColor;
      ctx.lineWidth = penWidth;
    }

    ctx.arc(x, y, (ctx.lineWidth || penWidth) / 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const drawMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawingMode || !isDrawingRef.current) return;
    const canvas = sketchCanvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    if (penTool === 'eraser') {
      ctx.globalCompositeOperation = 'destination-out';
      ctx.lineWidth = penWidth * 3;
    } else if (penTool === 'highlighter') {
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 0.35;
      ctx.strokeStyle = penColor;
      ctx.lineWidth = penWidth * 2.5;
    } else if (penTool === 'pencil') {
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 0.7;
      ctx.strokeStyle = penColor;
      ctx.lineWidth = Math.max(1.5, penWidth * 0.75);
    } else {
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 1.0;
      ctx.strokeStyle = penColor;
      ctx.lineWidth = penWidth;
    }

    ctx.lineTo(x, y);
    ctx.stroke();
    lastPointRef.current = { x, y };
  };

  const stopDrawing = () => {
    if (!isDrawingMode || !isDrawingRef.current) return;
    isDrawingRef.current = false;
    lastPointRef.current = null;
    saveCanvasSnapshot();
  };

  // AI Outline Generation
  const generateAIOutline = async () => {
    if (!overlay.src) return;
    setIsGeneratingAIOutline(true);
    recordUserAction('AI Outline Generated');
    showToast('✨ Generating clean outline...');

    try {
      if (!originalImageSrc) {
        setOriginalImageSrc(overlay.src);
      }
      const colorlessOutline = await extractColorlessOutline(originalImageSrc || overlay.src);
      if (colorlessOutline) {
        setAiOutlineSvgUrl(colorlessOutline);
        setOverlay((prev) => ({
          ...prev,
          src: colorlessOutline,
          filterMode: 'outline',
          opacity: Math.max(prev.opacity, 34),
        }));
        showToast('✨ Clean outline ready!');
      }
    } catch (err: any) {
      console.warn('AI Outline error:', err);
    } finally {
      setIsGeneratingAIOutline(false);
    }
  };

  const handleSelectFilter = async (filterId: FilterMode) => {
    if (filterId === 'normal') {
      if (originalImageSrc) {
        setOverlay((prev) => ({
          ...prev,
          src: originalImageSrc,
          filterMode: 'normal',
        }));
      } else {
        setOverlay((prev) => ({ ...prev, filterMode: 'normal' }));
      }
      showToast('Original photo active');
    } else if (filterId === 'outline') {
      if (!originalImageSrc) {
        setOriginalImageSrc(overlay.src);
      }
      setIsGeneratingAIOutline(true);
      showToast('✨ Clean outline...');
      try {
        const outline = await extractColorlessOutline(originalImageSrc || overlay.src);
        setAiOutlineSvgUrl(outline);
        setOverlay((prev) => ({
          ...prev,
          src: outline,
          filterMode: 'outline',
          opacity: Math.max(prev.opacity, 34),
        }));
        showToast('✨ Outline active!');
      } catch (e) {
        console.warn('Outline error:', e);
      } finally {
        setIsGeneratingAIOutline(false);
      }
    } else if (filterId === 'sketch') {
      if (!originalImageSrc) {
        setOriginalImageSrc(overlay.src);
      }
      setIsGeneratingAIOutline(true);
      showToast('✏️ Pencil Sketch...');
      try {
        const sketch = await extractSketchOutline(originalImageSrc || overlay.src);
        setOverlay((prev) => ({
          ...prev,
          src: sketch,
          filterMode: 'sketch',
          opacity: Math.max(prev.opacity, 34),
        }));
        showToast('✏️ Sketch Outline active!');
      } catch (e) {
        console.warn('Sketch error:', e);
      } finally {
        setIsGeneratingAIOutline(false);
      }
    }
  };

  // Video Recording Handlers (Capturing live camera, overlay, and sketch canvas!)
  const handleToggleRecording = () => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  const startRecording = async () => {
    try {
      // Request microphone audio for voice recording (ambient surrounding sound)
      let micStream: MediaStream | null = null;
      try {
        micStream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
          video: false,
        });
        micStreamRef.current = micStream;
      } catch (err) {
        console.warn('Microphone permission denied or unavailable:', err);
      }

      // Enforce 9:16 aspect ratio for vertical recording
      const width = 720;
      const height = 1280;

      const recCanvas = document.createElement('canvas');
      recCanvas.width = width;
      recCanvas.height = height;
      const recCtx = recCanvas.getContext('2d');
      recordingCanvasRef.current = recCanvas;

      if (!recCtx) {
        showToast('Recording could not start.');
        if (micStream) micStream.getTracks().forEach((t) => t.stop());
        return;
      }

      const renderFrame = () => {
        if (!isRecordingRef.current) return;

        // 1. Draw live camera video or frozen frame in 9:16 fit
        if (isFrozen && frozenFrameUrl) {
          const fImg = new Image();
          fImg.src = frozenFrameUrl;
          if (fImg.complete) {
            recCtx.drawImage(fImg, 0, 0, width, height);
          }
        } else if (videoRef.current && cameraActive && videoRef.current.readyState >= 2) {
          recCtx.drawImage(videoRef.current, 0, 0, width, height);
        } else {
          recCtx.fillStyle = '#0c0718';
          recCtx.fillRect(0, 0, width, height);
        }

        // 2. Draw overlay reference image with transform
        if (overlay.src) {
          recCtx.save();
          recCtx.translate(width / 2 + overlay.x, height / 2 + overlay.y);
          recCtx.rotate((overlay.rotation * Math.PI) / 180);
          recCtx.scale(overlay.scale * (overlay.isMirrored ? -1 : 1), overlay.scale);
          recCtx.globalAlpha = overlay.opacity / 100;

          const img = new Image();
          img.src = overlay.src;
          if (img.complete) {
            const imgW = img.width || 400;
            const imgH = img.height || 400;
            recCtx.drawImage(img, -imgW / 2, -imgH / 2, imgW, imgH);
          }
          recCtx.restore();
        }

        // 3. Draw sketch canvas
        if (sketchCanvasRef.current) {
          recCtx.drawImage(sketchCanvasRef.current, 0, 0, width, height);
        }

        recordingAnimFrameRef.current = requestAnimationFrame(renderFrame);
      };

      const canvasStream = recCanvas.captureStream(30);
      const combinedStream = new MediaStream();
      canvasStream.getVideoTracks().forEach((track) => combinedStream.addTrack(track));

      if (micStream) {
        try {
          const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
          audioContextRef.current = audioCtx;
          const source = audioCtx.createMediaStreamSource(micStream);
          const destination = audioCtx.createMediaStreamDestination();
          source.connect(destination);
          destination.stream.getAudioTracks().forEach((track) => combinedStream.addTrack(track));
        } catch (audioErr) {
          console.warn('Audio combining error:', audioErr);
        }
      }

      const mimeType = MediaRecorder.isTypeSupported('video/mp4')
        ? 'video/mp4'
        : MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
        ? 'video/webm;codecs=vp9'
        : 'video/webm';

      const mediaRecorder = new MediaRecorder(combinedStream, { mimeType });
      recordedChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          recordedChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const blob = new Blob(recordedChunksRef.current, { type: mimeType });
        const url = URL.createObjectURL(blob);
        setRecordedVideoUrl(url);

        // AUTOMATICALLY SAVE TO VIDEOS SECTION IMMEDIATELY
        try {
          await autoSaveRecordedVideo({
            blob,
            name: overlay.name ? `Tracing - ${overlay.name}` : `Tracing Video ${new Date().toLocaleTimeString()}`,
            duration: recordingDuration,
            resolution: selectedResolution,
            fps: selectedFps,
          });
          const all = await getAllRecordedVideos();
          setSavedRecordings(all);
          showToast('🎬 Video automatically saved to your Videos section!');
        } catch (err) {
          console.error('Failed to auto-save video:', err);
        }

        setIsExportModalOpen(true);
      };

      mediaRecorder.start(500);
      mediaRecorderRef.current = mediaRecorder;
      isRecordingRef.current = true;
      setIsRecording(true);
      setRecordingDuration(0);

      renderFrame();

      recordingTimerRef.current = setInterval(() => {
        setRecordingDuration((prev) => prev + 1);
      }, 1000);

      if (micStream) {
        showToast('🔴 Video & Audio Recording Started (9:16)!');
      } else {
        showToast('🔴 Video Recording Started (9:16)!');
      }
    } catch (e) {
      console.error(e);
      showToast('Video recording not supported.');
    }
  };

  const stopRecording = () => {
    isRecordingRef.current = false;
    if (recordingAnimFrameRef.current) {
      cancelAnimationFrame(recordingAnimFrameRef.current);
      recordingAnimFrameRef.current = null;
    }
    if (mediaRecorderRef.current && isRecording) {
      try {
        mediaRecorderRef.current.stop();
      } catch {}
      mediaRecorderRef.current = null;
    }
    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach((t) => t.stop());
      micStreamRef.current = null;
    }
    if (audioContextRef.current) {
      try {
        audioContextRef.current.close();
      } catch {}
      audioContextRef.current = null;
    }
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
    setIsRecording(false);
  };

  const handleExportAndSave = async () => {
    if (!recordedVideoUrl) return;
    setIsExportModalOpen(false);
    setIsExportingProgress(true);
    setExportProgressValue(0);

    let currentProg = 0;
    const progressInterval = setInterval(async () => {
      currentProg += 20;
      if (currentProg >= 100) {
        currentProg = 100;
        clearInterval(progressInterval);
        setIsExportingProgress(false);

        try {
          const res = await fetch(recordedVideoUrl);
          const blob = await res.blob();
          const item: RecordedVideoItem = {
            id: 'export_' + Date.now(),
            name: overlay.name ? `Tracing - ${overlay.name}` : 'Tracing Video',
            date: Date.now(),
            dataUrl: recordedVideoUrl,
            blob,
            resolution: selectedResolution,
            fps: selectedFps,
            duration: recordingDuration,
          };
          const exportRes = await exportVideoToGallery(item);
          showToast(exportRes.message);
        } catch (e) {
          console.error(e);
          showToast('Video is saved in your Videos section.');
        }
      }
      setExportProgressValue(currentProg);
    }, 120);
  };

  const handleDeleteRecording = async (id: string) => {
    await deleteRecordedVideo(id);
    const updated = await getAllRecordedVideos();
    setSavedRecordings(updated);
    showToast('Recording deleted successfully');
  };

  const handleDownloadVideo = async () => {
    if (!recordedVideoUrl) return;
    try {
      const response = await fetch(recordedVideoUrl);
      const blob = await response.blob();
      const item: RecordedVideoItem = {
        id: 'export_' + Date.now(),
        name: overlay.name ? `Tracing - ${overlay.name}` : 'Tracing Video',
        date: Date.now(),
        dataUrl: recordedVideoUrl,
        blob,
        resolution: selectedResolution,
        fps: selectedFps,
        duration: recordingDuration,
      };
      const res = await exportVideoToGallery(item);
      showToast(res.message);
      setIsVideoModalOpen(false);
    } catch {
      showToast('Export error. Video is saved in your Videos section.');
    }
  };

  const toggleAIOutline = async () => {
    if (overlay.filterMode === 'outline' || (aiOutlineSvgUrl && overlay.src === aiOutlineSvgUrl)) {
      if (originalImageSrc) {
        setOverlay((prev) => ({
          ...prev,
          src: originalImageSrc,
          name: prev.name.replace(' (Outline)', ''),
          filterMode: 'normal',
          opacity: 28,
        }));
        showToast('Original photo restored');
      }
    } else {
      if (aiOutlineSvgUrl) {
        setOverlay((prev) => ({
          ...prev,
          src: aiOutlineSvgUrl,
          filterMode: 'outline',
          opacity: Math.max(prev.opacity, 34),
        }));
        showToast('✨ Clean outline active');
      } else {
        await handleSelectFilter('outline');
      }
    }
  };

  // Robust Live Camera Start
  const startCamera = useCallback(async (mode: 'environment' | 'user') => {
    setCameraLoading(true);
    setCameraError(null);

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setIsTorchOn(false);
    setHasTorchSupport(false);

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setCameraError('Camera is not supported on this browser.');
      setCameraLoading(false);
      return;
    }

    let stream: MediaStream | null = null;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: mode } },
        audio: true,
      });
    } catch {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: mode },
          audio: true,
        });
      } catch {
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: true,
          });
        } catch {
          // Final fallback: try without audio
          try {
            stream = await navigator.mediaDevices.getUserMedia({
              video: { facingMode: { ideal: mode } },
              audio: false,
            });
          } catch (err: any) {
            console.error('Camera failed:', err);
            setCameraError('Please allow Camera and Microphone permissions.');
            setCameraLoading(false);
            setCameraActive(false);
            return;
          }
        }
      }
    }

    if (stream) {
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        try {
          await videoRef.current.play();
        } catch {}
      }

      const videoTrack = stream.getVideoTracks()[0];
      if (videoTrack) {
        const capabilities: any = videoTrack.getCapabilities ? videoTrack.getCapabilities() : {};
        if (capabilities && capabilities.torch) {
          setHasTorchSupport(true);
        }
      }

      setCameraActive(true);
      setCameraLoading(false);
      setCameraError(null);
    }
  }, []);

  useEffect(() => {
    startCamera(facingMode);
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, [facingMode, startCamera]);

  const toggleFacingMode = () => {
    setFacingMode((prev) => (prev === 'environment' ? 'user' : 'environment'));
  };

  const toggleTorch = async () => {
    if (!streamRef.current) return;
    const track = streamRef.current.getVideoTracks()[0];
    if (!track || !hasTorchSupport) return;
    try {
      const nextState = !isTorchOn;
      await (track as any).applyConstraints({ advanced: [{ torch: nextState }] });
      setIsTorchOn(nextState);
      showToast(nextState ? 'Flashlight ON' : 'Flashlight OFF');
    } catch {
      showToast('Could not toggle flashlight.');
    }
  };

  const toggleFreezeFrame = () => {
    if (isFrozen) {
      setIsFrozen(false);
      setFrozenFrameUrl(null);
      showToast('Live Camera resumed');
    } else {
      if (videoRef.current && videoRef.current.videoWidth) {
        const canvas = document.createElement('canvas');
        canvas.width = videoRef.current.videoWidth;
        canvas.height = videoRef.current.videoHeight;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
          const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
          setFrozenFrameUrl(dataUrl);
          setIsFrozen(true);
          showToast('Frame frozen!');
        }
      } else {
        showToast('Camera frame not ready');
      }
    }
  };

  const handleDirectGalleryUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    recordUserAction('AR Screen Se Photo Upload Ki');

    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result as string;
      if (result) {
        setOverlay((prev) => ({
          ...prev,
          src: result,
          name: file.name,
          opacity: 28,
          x: 0,
          y: 0,
          scale: 1,
          rotation: 0,
          filterMode: 'normal',
        }));
        lastNonZeroOpacityRef.current = 28;
        showToast('Photo uploaded!');
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const toggleVisibilityHide = () => {
    if (overlay.opacity > 0) {
      lastNonZeroOpacityRef.current = overlay.opacity;
      setOverlay((prev) => ({ ...prev, opacity: 0 }));
      showToast('Photo hidden');
    } else {
      const restore = lastNonZeroOpacityRef.current || 28;
      setOverlay((prev) => ({ ...prev, opacity: restore }));
      showToast(`Visibility ${restore}% restored`);
    }
  };

  const updateOpacityFromPointer = (clientX: number) => {
    if (!sliderTrackRef.current) return;
    const rect = sliderTrackRef.current.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    const newOpacity = Math.round(ratio * 100);
    setOverlay((prev) => ({ ...prev, opacity: newOpacity }));
    if (newOpacity > 0) {
      lastNonZeroOpacityRef.current = newOpacity;
    }
  };

  const handleSliderTouchStart = (e: React.TouchEvent) => {
    setIsDraggingSlider(true);
    updateOpacityFromPointer(e.touches[0].clientX);
  };

  const handleSliderTouchMove = (e: React.TouchEvent) => {
    updateOpacityFromPointer(e.touches[0].clientX);
  };

  const handleSliderTouchEnd = () => {
    setIsDraggingSlider(false);
  };

  // Touch & Mouse Drag for Reference Image
  const touchStateRef = useRef<{
    startX: number;
    startY: number;
    originX: number;
    originY: number;
    initialDistance: number;
    initialScale: number;
    isPinching: boolean;
  }>({
    startX: 0,
    startY: 0,
    originX: 0,
    originY: 0,
    initialDistance: 0,
    initialScale: 1,
    isPinching: false,
  });

  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    if (overlay.isLocked) return;

    if (e.touches.length === 1) {
      const touch = e.touches[0];
      touchStateRef.current.startX = touch.clientX;
      touchStateRef.current.startY = touch.clientY;
      touchStateRef.current.originX = overlay.x;
      touchStateRef.current.originY = overlay.y;
      touchStateRef.current.isPinching = false;
    } else if (e.touches.length === 2) {
      const t1 = e.touches[0];
      const t2 = e.touches[1];
      const dist = Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
      touchStateRef.current.initialDistance = dist;
      touchStateRef.current.initialScale = overlay.scale;
      touchStateRef.current.isPinching = true;
    }
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    if (overlay.isLocked) return;

    if (e.touches.length === 1 && !touchStateRef.current.isPinching) {
      const touch = e.touches[0];
      const deltaX = touch.clientX - touchStateRef.current.startX;
      const deltaY = touch.clientY - touchStateRef.current.startY;
      setOverlay((prev) => ({
        ...prev,
        x: touchStateRef.current.originX + deltaX,
        y: touchStateRef.current.originY + deltaY,
      }));
    } else if (e.touches.length === 2 && touchStateRef.current.isPinching) {
      const t1 = e.touches[0];
      const t2 = e.touches[1];
      const currentDist = Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
      if (touchStateRef.current.initialDistance > 0) {
        const factor = currentDist / touchStateRef.current.initialDistance;
        const newScale = Math.min(3.5, Math.max(0.2, touchStateRef.current.initialScale * factor));
        setOverlay((prev) => ({ ...prev, scale: newScale }));
      }
    }
  };

  const handleTouchEnd = () => {
    touchStateRef.current.isPinching = false;
  };

  const mouseStateRef = useRef({
    isMouseDown: false,
    startX: 0,
    startY: 0,
    originX: 0,
    originY: 0,
  });

  const handleMouseDown = (e: React.MouseEvent) => {
    if (overlay.isLocked) return;
    mouseStateRef.current.isMouseDown = true;
    mouseStateRef.current.startX = e.clientX;
    mouseStateRef.current.startY = e.clientY;
    mouseStateRef.current.originX = overlay.x;
    mouseStateRef.current.originY = overlay.y;
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!mouseStateRef.current.isMouseDown || overlay.isLocked) return;
    const deltaX = e.clientX - mouseStateRef.current.startX;
    const deltaY = e.clientY - mouseStateRef.current.startY;
    setOverlay((prev) => ({
      ...prev,
      x: mouseStateRef.current.originX + deltaX,
      y: mouseStateRef.current.originY + deltaY,
    }));
  };

  const handleMouseUp = () => {
    mouseStateRef.current.isMouseDown = false;
  };

  const handleResetPosition = () => {
    setOverlay((prev) => ({
      ...prev,
      x: 0,
      y: 0,
      scale: 1,
      rotation: 0,
      isMirrored: false,
    }));
    showToast('Position Reset');
  };

  const handleZoom = (direction: 'in' | 'out') => {
    setOverlay((prev) => {
      const step = 0.15;
      const newScale = direction === 'in' ? prev.scale + step : prev.scale - step;
      return {
        ...prev,
        scale: Math.min(3.5, Math.max(0.2, Number(newScale.toFixed(2)))),
      };
    });
  };

  const handleRotate = () => {
    setOverlay((prev) => ({
      ...prev,
      rotation: (prev.rotation + 90) % 360,
    }));
  };

  const handleMirror = () => {
    setOverlay((prev) => ({
      ...prev,
      isMirrored: !prev.isMirrored,
    }));
    showToast(overlay.isMirrored ? 'Mirror Off' : 'Mirror Flip ON');
  };

  const getFilterStyle = (_mode: FilterMode): React.CSSProperties => {
    return {
      mixBlendMode: overlay.blendMode || 'normal',
    };
  };

  const getOpacityStatusText = (op: number) => {
    if (op === 0) return 'Hidden';
    if (op <= 20) return 'Ultra Faint';
    if (op <= 35) return 'Tracing Best ★';
    if (op <= 60) return 'Medium';
    return 'Full';
  };

  return (
    <div className="relative w-full h-[100dvh] bg-[#0c0718] overflow-hidden flex flex-col select-none text-white">
      {/* Hidden file input for gallery upload */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleDirectGalleryUpload}
        className="hidden"
      />

      {/* 1. LIVE CAMERA / FROZEN LAYER */}
      <div className="absolute inset-0 z-0 bg-[#090514] flex items-center justify-center overflow-hidden">
        {isFrozen && frozenFrameUrl ? (
          <img
            src={frozenFrameUrl}
            alt="Frozen Camera"
            className="w-full h-full object-cover"
          />
        ) : (
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className={`w-full h-full object-cover transition-opacity duration-300 ${
              cameraActive ? 'opacity-100' : 'opacity-0'
            }`}
          />
        )}

        {/* Camera fallback if not active */}
        {!cameraActive && (
          <div className="absolute inset-0 bg-[#140b28] flex flex-col items-center justify-center p-6 text-center z-5">
            <div className="w-14 h-14 rounded-2xl bg-white text-purple-900 flex items-center justify-center mb-3 shadow-lg">
              <Camera className="w-7 h-7 text-purple-600" />
            </div>
            <h3 className="text-base font-black text-white">Live Camera AR Mode</h3>
            <p className="text-xs text-purple-200/80 max-w-xs mt-1 mb-4 leading-relaxed">
              {cameraError || 'Camera overlay allows you to trace on paper with a pencil.'}
            </p>
            <div className="flex gap-2 max-w-xs w-full">
              <button
                onClick={() => startCamera(facingMode)}
                className="flex-1 py-3 px-3 rounded-xl bg-white text-purple-950 font-black text-xs uppercase flex items-center justify-center gap-1.5 active:scale-95 shadow-md"
              >
                <RefreshCw className={`w-3.5 h-3.5 text-purple-600 ${cameraLoading ? 'animate-spin' : ''}`} />
                {cameraLoading ? 'Starting...' : 'Camera On'}
              </button>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="flex-1 py-3 px-3 rounded-xl bg-purple-600 text-white font-black text-xs uppercase flex items-center justify-center gap-1.5 active:scale-95 shadow-md"
              >
                <Upload className="w-3.5 h-3.5" />
                Upload Photo
              </button>
            </div>
          </div>
        )}

        {/* 3x3 Grid Overlay */}
        {showGrid && (
          <div className="absolute inset-0 pointer-events-none z-10 grid grid-cols-3 grid-rows-3 border border-white/20">
            <div className="border-r border-b border-white/15" />
            <div className="border-r border-b border-white/15" />
            <div className="border-b border-white/15" />
            <div className="border-r border-b border-white/15" />
            <div className="border-r border-b border-white/15" />
            <div className="border-b border-white/15" />
            <div className="border-r border-white/15" />
            <div className="border-r border-white/15" />
            <div />
          </div>
        )}
      </div>

      {/* 2. OVERLAY REFERENCE IMAGE LAYER */}
      <div
        className={`absolute inset-0 z-20 flex items-center justify-center overflow-hidden ${
          isDrawingMode ? 'pointer-events-none' : 'touch-none'
        }`}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
      >
        <div
          style={{
            transform: `translate(${overlay.x}px, ${overlay.y}px) scale(${overlay.scale}) rotate(${overlay.rotation}deg) scaleX(${
              overlay.isMirrored ? -1 : 1
            })`,
            opacity: overlay.opacity / 100,
            transition: isDraggingSlider || mouseStateRef.current.isMouseDown ? 'none' : 'opacity 0.1s ease-out, transform 0.05s ease-out',
            ...getFilterStyle(overlay.filterMode),
          }}
          className={`relative ${
            isFullScreenTemplate ? 'w-full h-full max-w-none max-h-none' : 'max-w-[85vw] max-h-[75vh]'
          } flex items-center justify-center pointer-events-none ${
            overlay.isLocked ? '' : 'cursor-grab active:cursor-grabbing'
          }`}
        >
          <img
            src={overlay.src}
            alt={overlay.name}
            className={`${
              isFullScreenTemplate
                ? templateFitMode === 'cover'
                  ? 'w-full h-full object-cover min-h-[85vh]'
                  : 'w-full h-full object-contain'
                : 'w-auto h-auto max-w-full max-h-[70vh] object-contain'
            } select-none pointer-events-none`}
            draggable={false}
          />
        </div>
      </div>

      {/* 2b. DIGITAL SKETCHING CANVAS LAYER */}
      <canvas
        ref={sketchCanvasRef}
        onPointerDown={startDrawing}
        onPointerMove={drawMove}
        onPointerUp={stopDrawing}
        onPointerLeave={stopDrawing}
        onPointerCancel={stopDrawing}
        style={{ touchAction: 'none' }}
        className={`absolute inset-0 z-25 w-full h-full ${
          isDrawingMode ? 'pointer-events-auto cursor-crosshair' : 'pointer-events-none'
        }`}
      />

      {/* 3. TOP BAR HUD */}
      <div className="relative z-30 pt-safe px-4 py-2.5 flex items-center justify-between bg-gradient-to-b from-[#0e071c]/95 via-[#0e071c]/60 to-transparent">
        <button
          onClick={onBack}
          aria-label="Back"
          className="w-10 h-10 rounded-2xl bg-purple-950/80 border border-purple-500/30 text-white flex items-center justify-center active:scale-95 transition-transform shadow-sm"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>

        {/* Center Title, Recording Timer & Visibility Badge */}
        <div className="flex items-center gap-1.5 flex-wrap justify-center">
          {isRecording && (
            <div className="px-3 py-1.5 rounded-full bg-rose-600/90 border border-rose-400 text-white flex items-center gap-2 animate-pulse shadow-lg">
              <div className="w-2.5 h-2.5 rounded-full bg-white animate-ping" />
              <span className="text-xs font-black font-mono">
                REC {formatDuration(recordingDuration)}
              </span>
              <button
                onClick={stopRecording}
                className="ml-1 text-[10px] bg-white text-rose-950 px-1.5 py-0.5 rounded font-black uppercase"
              >
                Stop
              </button>
            </div>
          )}

          <div className="px-3 py-1.5 rounded-full bg-purple-950/90 border border-purple-500/30 flex items-center gap-1.5 shadow-sm">
            <div className="w-2 h-2 rounded-full bg-purple-400 animate-pulse" />
            <span className="text-xs font-black text-white tracking-wide truncate max-w-[100px]">
              {overlay.name}
            </span>
            <span className="text-[10px] font-mono font-bold text-white bg-purple-600/50 px-1.5 py-0.5 rounded border border-purple-400/40">
              {overlay.opacity}%
            </span>
          </div>

          <button
            onClick={toggleAIOutline}
            disabled={isGeneratingAIOutline}
            className={`h-8.5 px-3 rounded-full border flex items-center gap-1.5 text-[11px] font-black active:scale-95 transition-all ${
              overlay.src === aiOutlineSvgUrl
                ? 'bg-purple-600 text-white border-purple-400 shadow-md'
                : 'bg-white text-purple-950 border-white shadow-md'
            }`}
          >
            {isGeneratingAIOutline ? (
              <RefreshCw className="w-3 h-3 animate-spin text-purple-600" />
            ) : (
              <Sparkles className="w-3 h-3 text-purple-600" />
            )}
            <span>{overlay.src === aiOutlineSvgUrl ? 'Original' : 'AI Outline'}</span>
          </button>
        </div>

        {/* Right HUD Controls */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => {
              if (!isFullScreenTemplate) {
                setIsFullScreenTemplate(true);
                setTemplateFitMode('cover');
                setOverlay((prev) => ({ ...prev, scale: Math.max(prev.scale, 1.35) }));
                showToast('🚀 Full Screen Mode ON');
              } else if (templateFitMode === 'cover') {
                setTemplateFitMode('contain');
                setOverlay((prev) => ({ ...prev, scale: 1 }));
                showToast('Fit Screen');
              } else {
                setIsFullScreenTemplate(false);
                showToast('Standard View');
              }
            }}
            aria-label="Toggle Full Screen"
            className={`w-9 h-9 rounded-2xl border flex items-center justify-center active:scale-95 transition-transform ${
              isFullScreenTemplate
                ? 'bg-purple-600 border-purple-400 text-white shadow-sm'
                : 'bg-purple-950/80 border-purple-500/30 text-purple-200'
            }`}
          >
            {isFullScreenTemplate ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>

          <button
            onClick={() => {
              const next = !isDrawingMode;
              setIsDrawingMode(next);
              showToast(next ? '✏️ Digital Pen Mode ON' : '👁️ Tracing Mode ON');
            }}
            aria-label="Toggle Drawing Mode"
            className={`px-2.5 h-9 rounded-2xl border flex items-center gap-1.5 active:scale-95 transition-all text-xs font-bold ${
              isDrawingMode
                ? 'bg-white text-purple-950 border-white shadow-md'
                : 'bg-purple-950/80 border-purple-500/30 text-purple-200'
            }`}
          >
            <PenTool className="w-4 h-4 text-purple-600" />
            <span className="hidden sm:inline">Draw</span>
          </button>

          {hasTorchSupport && (
            <button
              onClick={toggleTorch}
              aria-label="Toggle Flashlight"
              className={`w-9 h-9 rounded-2xl border flex items-center justify-center active:scale-95 transition-transform ${
                isTorchOn ? 'bg-amber-400 border-amber-300 text-black' : 'bg-purple-950/80 border-purple-500/30 text-white'
              }`}
            >
              {isTorchOn ? <Flashlight className="w-4 h-4" /> : <FlashlightOff className="w-4 h-4 text-purple-300" />}
            </button>
          )}

          <button
            onClick={toggleFacingMode}
            aria-label="Flip Camera"
            className="w-9 h-9 rounded-2xl bg-purple-950/80 border border-purple-500/30 text-white flex items-center justify-center active:scale-95 transition-transform"
          >
            <Camera className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* 3b. DIGITAL SKETCHING & UNDO/REDO SMART TOOLBAR */}
      {isDrawingMode && (
        <div className="relative z-30 mx-3 mt-1 p-2 bg-[#160d2b]/95 backdrop-blur-md border border-purple-500/30 rounded-2xl shadow-2xl flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-1 bg-purple-950/90 p-1 rounded-xl border border-purple-500/20">
            <button
              onClick={handleUndo}
              disabled={!canUndo}
              aria-label="Undo"
              className={`px-2.5 py-1.5 rounded-lg flex items-center gap-1.5 text-xs font-black transition-all ${
                canUndo ? 'bg-purple-600 text-white active:scale-95 cursor-pointer' : 'bg-transparent text-slate-500 opacity-40'
              }`}
            >
              <Undo2 className="w-4 h-4" />
              <span>Undo</span>
            </button>

            <button
              onClick={handleRedo}
              disabled={!canRedo}
              aria-label="Redo"
              className={`px-2.5 py-1.5 rounded-lg flex items-center gap-1.5 text-xs font-black transition-all ${
                canRedo ? 'bg-purple-600 text-white active:scale-95 cursor-pointer' : 'bg-transparent text-slate-500 opacity-40'
              }`}
            >
              <Redo2 className="w-4 h-4" />
              <span>Redo</span>
            </button>

            <button
              onClick={handleClearSketch}
              aria-label="Clear sketch"
              className="p-1.5 rounded-lg text-purple-300 hover:text-rose-400 hover:bg-rose-950/40 transition-colors"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>

          <div className="flex items-center gap-1 bg-purple-950/90 p-1 rounded-xl border border-purple-500/20">
            {[
              { id: 'pen', label: 'Pen' },
              { id: 'pencil', label: 'Pencil' },
              { id: 'highlighter', label: 'Marker' },
              { id: 'eraser', label: 'Eraser' },
            ].map((t) => (
              <button
                key={t.id}
                onClick={() => setPenTool(t.id as any)}
                className={`px-2 py-1 rounded-lg text-[11px] font-bold transition-all ${
                  penTool === t.id ? 'bg-white text-purple-950 shadow-sm' : 'text-purple-300 hover:text-white'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1.5">
            {penTool !== 'eraser' && (
              <div className="flex items-center gap-1 bg-purple-950/90 p-1 rounded-xl border border-purple-500/20">
                {['#000000', '#ffffff', '#9333ea', '#3b82f6', '#10b981', '#ef4444', '#f59e0b'].map((col) => (
                  <button
                    key={col}
                    onClick={() => setPenColor(col)}
                    className={`w-5 h-5 rounded-full border transition-transform ${
                      penColor === col ? 'scale-125 border-white ring-2 ring-purple-400' : 'border-white/30'
                    }`}
                    style={{ backgroundColor: col }}
                  />
                ))}
              </div>
            )}

            <div className="flex items-center gap-1 bg-purple-950/90 px-1.5 py-1 rounded-xl border border-purple-500/20 text-[10px] text-purple-200 font-bold">
              {[2, 4, 8, 14].map((w) => (
                <button
                  key={w}
                  onClick={() => setPenWidth(w)}
                  className={`w-6 h-6 rounded-md flex items-center justify-center transition-all ${
                    penWidth === w ? 'bg-purple-600 text-white' : 'text-purple-300 hover:text-white'
                  }`}
                >
                  {w}p
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {toastMessage && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 z-40 px-4 py-2 rounded-2xl bg-purple-950 text-white border border-purple-400 text-xs font-black shadow-2xl backdrop-blur-md animate-in fade-in duration-150">
          {toastMessage}
        </div>
      )}

      {/* 4. FLOATING VERTICAL QUICK ACTIONS (Right edge) */}
      <div className="absolute right-3 top-1/2 -translate-y-1/2 z-30 flex flex-col gap-2">
        {/* Gallery Upload Button */}
        <button
          onClick={() => fileInputRef.current?.click()}
          aria-label="Upload from gallery"
          className="w-10 h-10 rounded-2xl bg-white text-purple-950 border border-white flex items-center justify-center active:scale-95 transition-transform shadow-lg"
          title="Upload Photo"
        >
          <Upload className="w-4 h-4 text-purple-600 font-black" />
        </button>

        {/* Lock Reference Toggle */}
        <button
          onClick={() => {
            const nextLocked = !overlay.isLocked;
            setOverlay((prev) => ({ ...prev, isLocked: nextLocked }));
            showToast(nextLocked ? 'Reference Lock' : 'Reference Unlock');
          }}
          aria-label="Lock image"
          className={`w-10 h-10 rounded-2xl border flex items-center justify-center active:scale-95 transition-transform ${
            overlay.isLocked
              ? 'bg-purple-600 border-purple-400 text-white shadow-md'
              : 'bg-purple-950/80 border-purple-500/30 text-neutral-200'
          }`}
          title="Lock / Unlock Reference"
        >
          {overlay.isLocked ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
        </button>

        {/* Video Recording Button (Placed RIGHT BELOW the Lock option as requested!) */}
        <button
          onClick={handleToggleRecording}
          aria-label={isRecording ? 'Stop Recording' : 'Start Recording'}
          className={`w-10 h-10 rounded-2xl border flex items-center justify-center active:scale-95 transition-transform ${
            isRecording
              ? 'bg-rose-600 border-rose-400 text-white shadow-lg animate-pulse'
              : 'bg-purple-950/80 border-purple-500/30 text-neutral-200'
          }`}
          title={isRecording ? 'Stop Video Recording' : 'Start Video Recording (Save to Gallery)'}
        >
          {isRecording ? <VideoOff className="w-4 h-4" /> : <Video className="w-4 h-4 text-rose-400" />}
        </button>

        {/* Saved Recordings Gallery Button */}
        <button
          onClick={() => setIsRecordingsGalleryOpen(true)}
          aria-label="Saved Recordings Gallery"
          className="w-10 h-10 rounded-2xl bg-purple-600 text-white border border-purple-400 flex items-center justify-center active:scale-95 transition-transform shadow-lg relative"
          title="Saved Recordings (Gallery)"
        >
          <Video className="w-4 h-4" />
          {savedRecordings.length > 0 && (
            <span className="absolute -top-1 -right-1 w-4 h-4 bg-rose-500 text-white rounded-full text-[9px] font-black flex items-center justify-center border border-white">
              {savedRecordings.length}
            </span>
          )}
        </button>

        {/* Freeze camera */}
        <button
          onClick={toggleFreezeFrame}
          aria-label="Freeze frame"
          className={`w-10 h-10 rounded-2xl border flex items-center justify-center active:scale-95 transition-transform ${
            isFrozen ? 'bg-white border-white text-purple-950 shadow-lg' : 'bg-purple-950/80 border-purple-500/30 text-neutral-200'
          }`}
          title="Freeze Camera Frame"
        >
          {isFrozen ? <Play className="w-4 h-4 fill-current text-purple-600" /> : <Pause className="w-4 h-4" />}
        </button>

        {/* Grid toggle */}
        <button
          onClick={() => setShowGrid((prev) => !prev)}
          aria-label="Toggle grid"
          className={`w-10 h-10 rounded-2xl border flex items-center justify-center active:scale-95 transition-transform ${
            showGrid ? 'bg-white border-white text-purple-950' : 'bg-purple-950/80 border-purple-500/30 text-neutral-200'
          }`}
          title="Toggle Grid"
        >
          <Grid3X3 className="w-4 h-4" />
        </button>

        {/* Reset position */}
        <button
          onClick={handleResetPosition}
          aria-label="Reset position"
          className="w-10 h-10 rounded-2xl bg-purple-950/80 border border-purple-500/30 text-neutral-200 flex items-center justify-center active:scale-95 transition-transform"
          title="Reset Position"
        >
          <RotateCcw className="w-4 h-4" />
        </button>
      </div>

      {/* 5. OPACITY CONTROL DOCK */}
      <div className="relative z-30 mx-3 mb-2 p-3 bg-[#160d2b]/95 backdrop-blur-md border border-purple-500/30 rounded-2xl shadow-2xl">
        <div className="flex items-center justify-between pb-1.5 mb-1.5 border-b border-purple-500/20">
          <div className="flex items-center gap-1.5">
            <button
              onClick={toggleVisibilityHide}
              className="p-1 rounded-lg bg-purple-950 text-purple-300 hover:text-white flex items-center gap-1 text-[11px] font-bold"
            >
              {overlay.opacity === 0 ? <EyeOff className="w-3.5 h-3.5 text-purple-400" /> : <Eye className="w-3.5 h-3.5 text-purple-300" />}
            </button>
            <span className="text-xs font-black text-white flex items-center gap-1">
              Visibility:
              <span className="text-purple-300 font-mono">{overlay.opacity}%</span>
            </span>
            <span className="text-[10px] text-purple-300/80 font-medium">({getOpacityStatusText(overlay.opacity)})</span>
          </div>

          <div className="flex gap-1">
            {[
              { val: 0, label: '0%' },
              { val: 15, label: '15%' },
              { val: 28, label: '28%★' },
              { val: 50, label: '50%' },
              { val: 100, label: '100%' },
            ].map((p) => (
              <button
                key={p.val}
                onClick={() => {
                  setOverlay((prev) => ({ ...prev, opacity: p.val }));
                  if (p.val > 0) lastNonZeroOpacityRef.current = p.val;
                  showToast(`Visibility ${p.val}%`);
                }}
                className={`px-2 py-0.5 rounded-lg text-[10px] font-black transition-all ${
                  overlay.opacity === p.val ? 'bg-purple-600 text-white' : 'bg-purple-950/80 text-purple-300 hover:text-white'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        <div className="relative flex items-center py-1">
          <div
            ref={sliderTrackRef}
            onTouchStart={handleSliderTouchStart}
            onTouchMove={handleSliderTouchMove}
            onTouchEnd={handleSliderTouchEnd}
            className="w-full h-8 flex items-center cursor-pointer relative"
          >
            <div className="w-full h-2.5 bg-purple-950 rounded-full overflow-hidden border border-purple-500/20 relative">
              <div
                className="h-full bg-gradient-to-r from-purple-600 to-indigo-500 rounded-full transition-all duration-75"
                style={{ width: `${overlay.opacity}%` }}
              />
            </div>

            <input
              type="range"
              min={0}
              max={100}
              step={1}
              value={overlay.opacity}
              onChange={(e) => {
                const val = Number(e.target.value);
                setOverlay((prev) => ({ ...prev, opacity: val }));
                if (val > 0) lastNonZeroOpacityRef.current = val;
              }}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            />

            <div
              className="absolute top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-white border-2 border-purple-600 shadow-md flex items-center justify-center pointer-events-none"
              style={{ left: `calc(${overlay.opacity}% - 12px)` }}
            >
              <div className="w-2 h-2 rounded-full bg-purple-600" />
            </div>
          </div>
        </div>

        <div className="flex justify-between text-[10px] text-purple-300/80 px-1 font-mono">
          <span>0% (Hide)</span>
          <span className="text-purple-300 font-bold">28% Best for Paper Tracing</span>
          <span>100% (Solid)</span>
        </div>
      </div>

      {/* 6. EXPANDABLE BOTTOM PANELS */}
      {activePanel === 'transform' && (
        <div className="relative z-30 mx-3 mb-2 p-3 bg-[#180f2d] border border-purple-500/30 rounded-2xl shadow-2xl">
          <div className="flex items-center justify-between pb-2 mb-2 border-b border-purple-500/20">
            <span className="text-xs font-black text-white flex items-center gap-1.5">
              <Sliders className="w-3.5 h-3.5 text-purple-400" />
              Size, Zoom &amp; Rotation
            </span>
            <button onClick={() => setActivePanel('none')} className="text-purple-300 hover:text-white">
              <ChevronDown className="w-4 h-4" />
            </button>
          </div>

          <div className="space-y-3">
            <div>
              <div className="flex justify-between text-xs text-purple-200 font-bold mb-1">
                <span>Image Scale</span>
                <span className="font-mono text-purple-400">{Math.round(overlay.scale * 100)}%</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleZoom('out')}
                  className="w-8 h-8 rounded-lg bg-purple-950 text-white flex items-center justify-center active:scale-95"
                >
                  <ZoomOut className="w-4 h-4" />
                </button>
                <input
                  type="range"
                  min={20}
                  max={300}
                  value={Math.round(overlay.scale * 100)}
                  onChange={(e) => setOverlay((prev) => ({ ...prev, scale: Number(e.target.value) / 100 }))}
                  className="flex-1 h-2 appearance-none bg-purple-950 rounded-lg accent-purple-500"
                />
                <button
                  onClick={() => handleZoom('in')}
                  className="w-8 h-8 rounded-lg bg-purple-950 text-white flex items-center justify-center active:scale-95"
                >
                  <ZoomIn className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={handleRotate}
                className="py-2.5 px-3 rounded-xl bg-purple-950 text-white text-xs font-bold flex items-center justify-center gap-2 active:scale-95 border border-purple-500/20"
              >
                <RotateCw className="w-3.5 h-3.5 text-purple-400" />
                Rotate 90° ({overlay.rotation}°)
              </button>
              <button
                onClick={handleMirror}
                className={`py-2.5 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-2 active:scale-95 ${
                  overlay.isMirrored ? 'bg-purple-600 text-white' : 'bg-purple-950 text-white border border-purple-500/20'
                }`}
              >
                <FlipHorizontal className="w-3.5 h-3.5" />
                {overlay.isMirrored ? 'Mirrored ON' : 'Mirror Flip'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 7. BOTTOM PRIMARY ACTION DOCK */}
      <div className="relative z-30 pb-safe px-3 pt-1 bg-gradient-to-t from-[#0e071c] via-[#0e071c]/95 to-transparent">
        <div className="h-16 rounded-2xl bg-[#160d2b] border border-purple-500/30 px-3 flex items-center justify-around shadow-2xl">
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex flex-col items-center justify-center gap-1 min-w-[50px] text-white active:scale-95 transition-transform"
          >
            <div className="w-8 h-8 rounded-xl bg-white text-purple-950 flex items-center justify-center shadow-md">
              <Upload className="w-4 h-4 text-purple-600 font-black" />
            </div>
            <span className="text-[10px] font-black tracking-tight">Gallery</span>
          </button>

          <button
            onClick={toggleAIOutline}
            disabled={isGeneratingAIOutline}
            className={`flex flex-col items-center justify-center gap-1 min-w-[54px] active:scale-95 transition-transform ${
              overlay.src === aiOutlineSvgUrl ? 'text-purple-300' : 'text-white'
            }`}
          >
            <div
              className={`w-8 h-8 rounded-xl flex items-center justify-center ${
                overlay.src === aiOutlineSvgUrl ? 'bg-purple-600 text-white shadow-md' : 'bg-white text-purple-950 shadow-md'
              }`}
            >
              {isGeneratingAIOutline ? (
                <RefreshCw className="w-4 h-4 text-purple-600 animate-spin" />
              ) : (
                <Sparkles className="w-4 h-4 text-purple-600 font-black" />
              )}
            </div>
            <span className="text-[10px] font-black tracking-tight">
              {overlay.src === aiOutlineSvgUrl ? 'Original' : 'AI Outline'}
            </span>
          </button>

          <button
            onClick={() => setIsPickerOpen(true)}
            className="flex flex-col items-center justify-center gap-1 min-w-[50px] text-purple-300 hover:text-white active:scale-95 transition-transform"
          >
            <div className="w-8 h-8 rounded-xl bg-purple-950 border border-purple-500/20 text-white flex items-center justify-center">
              <ImageIcon className="w-4 h-4" />
            </div>
            <span className="text-[10px] font-bold tracking-tight">Templates</span>
          </button>

          <button
            onClick={() => setActivePanel((prev) => (prev === 'transform' ? 'none' : 'transform'))}
            className={`flex flex-col items-center justify-center gap-1 min-w-[50px] active:scale-95 transition-transform ${
              activePanel === 'transform' ? 'text-white' : 'text-purple-300 hover:text-white'
            }`}
          >
            <div
              className={`w-8 h-8 rounded-xl flex items-center justify-center ${
                activePanel === 'transform' ? 'bg-white text-purple-950 shadow-md' : 'bg-purple-950 border border-purple-500/20 text-white'
              }`}
            >
              <Sliders className="w-4 h-4" />
            </div>
            <span className="text-[10px] font-bold tracking-tight">Size/Rotate</span>
          </button>
        </div>
      </div>

      {/* AI Outline Generating Modal */}
      {isGeneratingAIOutline && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-150">
          <div className="p-6 rounded-3xl bg-[#160d2b] border border-purple-500/40 text-center max-w-xs w-full shadow-2xl space-y-3.5">
            <div className="w-14 h-14 rounded-2xl bg-white text-purple-900 flex items-center justify-center mx-auto shadow-lg">
              <Sparkles className="w-7 h-7 text-purple-600 animate-bounce" />
            </div>
            <div>
              <h4 className="text-sm font-black text-white">Generating Clean Outline...</h4>
              <p className="text-xs text-purple-200 mt-1 leading-relaxed">
                Extracting high-contrast pencil contours for tracing...
              </p>
            </div>
            <div className="w-full bg-purple-950 h-1.5 rounded-full overflow-hidden">
              <div className="bg-purple-500 h-full w-2/3 animate-pulse" />
            </div>
          </div>
        </div>
      )}

      {/* Video Export Quality & Resolution Modal */}
      {isExportModalOpen && recordedVideoUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-in fade-in duration-150">
          <div className="p-6 rounded-3xl bg-[#160d2b] border border-purple-500/40 text-center max-w-sm w-full shadow-2xl space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-purple-600 text-white flex items-center justify-center mx-auto shadow-lg">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div>
              <h4 className="text-base font-black text-white">Select Video Quality &amp; Resolution</h4>
              <p className="text-xs text-purple-200 mt-1">
                Save your recording in 480p, 720p, 1080p, or 2K resolution.
              </p>
            </div>

            <div className="rounded-2xl overflow-hidden border border-purple-500/30 bg-black aspect-[9/16] max-h-44 flex items-center justify-center">
              <video src={recordedVideoUrl} controls autoPlay loop className="w-full h-full object-contain" />
            </div>

            {/* Resolution Selector */}
            <div className="space-y-1.5 text-left">
              <label className="text-[11px] font-bold text-purple-300">Resolution:</label>
              <div className="grid grid-cols-4 gap-1.5">
                {(['480p', '720p', '1080p', '2k'] as const).map((res) => (
                  <button
                    key={res}
                    onClick={() => setSelectedResolution(res)}
                    className={`py-2 rounded-xl text-xs font-black uppercase transition-all ${
                      selectedResolution === res
                        ? 'bg-purple-600 text-white shadow-md'
                        : 'bg-purple-950 text-purple-300 border border-purple-500/20'
                    }`}
                  >
                    {res}
                  </button>
                ))}
              </div>
            </div>

            {/* FPS Selector */}
            <div className="space-y-1.5 text-left">
              <label className="text-[11px] font-bold text-purple-300">Frame Rate (FPS):</label>
              <div className="grid grid-cols-2 gap-2">
                {([30, 60] as const).map((f) => (
                  <button
                    key={f}
                    onClick={() => setSelectedFps(f)}
                    className={`py-2 rounded-xl text-xs font-black transition-all ${
                      selectedFps === f
                        ? 'bg-purple-600 text-white shadow-md'
                        : 'bg-purple-950 text-purple-300 border border-purple-500/20'
                    }`}
                  >
                    {f} FPS
                  </button>
                ))}
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setIsExportModalOpen(false)}
                className="flex-1 py-3 px-3 rounded-xl bg-purple-950 text-purple-300 font-bold text-xs active:scale-95"
              >
                Cancel
              </button>
              <button
                onClick={handleExportAndSave}
                className="flex-1 py-3 px-3 rounded-xl bg-purple-600 text-white font-black text-xs flex items-center justify-center gap-1.5 active:scale-95 shadow-lg"
              >
                <Download className="w-4 h-4" />
                Export &amp; Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CapCut / KineMaster Style Exporting Progress Modal */}
      {isExportingProgress && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-in fade-in duration-150">
          <div className="p-6 rounded-3xl bg-[#160d2b] border border-purple-500/40 text-center max-w-sm w-full shadow-2xl space-y-4">
            <div className="w-14 h-14 rounded-2xl bg-purple-600 text-white flex items-center justify-center mx-auto shadow-lg animate-pulse">
              <Download className="w-7 h-7 animate-bounce" />
            </div>
            <div>
              <h4 className="text-base font-black text-white">Video Exporting...</h4>
              <p className="text-xs text-purple-200 mt-1">
                Preparing {selectedResolution} @ {selectedFps}FPS video for direct gallery save...
              </p>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between text-xs font-black text-purple-300 font-mono">
                <span>Progress</span>
                <span>{exportProgressValue}%</span>
              </div>
              <div className="w-full bg-purple-950 h-3 rounded-full overflow-hidden border border-purple-500/30 p-0.5">
                <div
                  className="bg-gradient-to-r from-purple-600 to-indigo-500 h-full rounded-full transition-all duration-200"
                  style={{ width: `${exportProgressValue}%` }}
                />
              </div>
            </div>

            <p className="text-[11px] text-purple-300 italic">
              Please wait while your masterpiece video is being rendered and saved to your device gallery.
            </p>
          </div>
        </div>
      )}

      {/* Saved Recordings Gallery Modal */}
      {isRecordingsGalleryOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-in fade-in duration-150">
          <div className="p-6 rounded-3xl bg-[#160d2b] border border-purple-500/40 max-w-md w-full shadow-2xl space-y-4 max-h-[85dvh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-purple-500/20">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl bg-purple-600 text-white flex items-center justify-center shadow-md">
                  <Video className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-base font-black text-white">My Recordings Gallery</h4>
                  <p className="text-[11px] text-purple-300">All recorded tracing clips are stored here</p>
                </div>
              </div>
              <button
                onClick={() => setIsRecordingsGalleryOpen(false)}
                className="w-8 h-8 rounded-xl bg-purple-950 text-purple-300 flex items-center justify-center hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-3 pr-1">
              {savedRecordings.length === 0 ? (
                <div className="py-12 text-center text-purple-300 text-xs">
                  <Video className="w-10 h-10 mx-auto mb-2 opacity-40 text-purple-400" />
                  No recordings saved yet. Tap Record while tracing to capture your process!
                </div>
              ) : (
                savedRecordings.map((rec) => (
                  <div key={rec.id} className="p-3 rounded-2xl bg-purple-950/80 border border-purple-500/30 flex flex-col gap-2.5">
                    <div className="flex items-center justify-between">
                      <div>
                        <h5 className="text-xs font-black text-white truncate max-w-[200px]">{rec.name}</h5>
                        <p className="text-[10px] text-purple-300 font-mono">
                          {new Date(rec.date).toLocaleDateString()} · {rec.resolution} @ {rec.fps}fps · {formatDuration(rec.duration || 0)}
                        </p>
                      </div>
                      <button
                        onClick={() => setConfirmDeleteVideoId(rec.id)}
                        className="p-2 rounded-xl bg-rose-950/60 text-rose-300 hover:text-white"
                        title="Delete Recording"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div className="rounded-xl overflow-hidden bg-black aspect-[9/16] max-h-48 flex items-center justify-center border border-purple-500/20">
                      <video src={rec.dataUrl} controls className="w-full h-full object-contain" />
                    </div>

                    <div className="flex gap-2">
                      <button
                        onClick={async () => {
                          showToast('Exporting to device gallery...');
                          const result = await exportVideoToGallery(rec);
                          showToast(result.message);
                        }}
                        className="flex-1 py-2.5 px-3 rounded-xl bg-purple-600 text-white font-black text-xs flex items-center justify-center gap-1.5 active:scale-95 shadow-md"
                      >
                        <Share2 className="w-3.5 h-3.5" />
                        Export to Gallery
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            <button
              onClick={() => setIsRecordingsGalleryOpen(false)}
              className="w-full py-3 rounded-xl bg-purple-950 text-purple-300 font-bold text-xs active:scale-95"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Confirm Delete Video Modal in AR Screen */}
      {confirmDeleteVideoId && (
        <div
          className="fixed inset-0 z-60 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-150"
          onClick={() => setConfirmDeleteVideoId(null)}
        >
          <div
            className="w-full max-w-sm bg-[#160d2b] rounded-3xl p-5 shadow-2xl border border-purple-500/40 space-y-4 animate-in zoom-in-95 duration-150 text-center"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-12 h-12 rounded-2xl bg-rose-950/80 border border-rose-500/40 text-rose-400 flex items-center justify-center mx-auto shadow-sm">
              <Trash2 className="w-6 h-6 stroke-[2.2]" />
            </div>
            <div>
              <h3 className="text-sm font-black text-white">Confirm Delete Video?</h3>
              <p className="text-xs text-purple-200 mt-1">
                Are you sure you want to permanently delete this video? This action cannot be undone.
              </p>
            </div>
            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={() => setConfirmDeleteVideoId(null)}
                className="flex-1 py-2.5 px-3 rounded-xl bg-purple-950 border border-purple-500/30 text-purple-300 hover:text-white font-bold text-xs active:scale-98 transition-all"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={async () => {
                  const id = confirmDeleteVideoId;
                  setConfirmDeleteVideoId(null);
                  if (id) {
                    await handleDeleteRecording(id);
                  }
                }}
                className="flex-1 py-2.5 px-3 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-black text-xs active:scale-98 transition-all shadow-md flex items-center justify-center gap-1.5"
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
        onSelectImage={(newSrc, newName) => {
          setOverlay((prev) => ({
            ...prev,
            src: newSrc,
            name: newName,
            opacity: 28,
            x: 0,
            y: 0,
            scale: 1,
            rotation: 0,
          }));
          lastNonZeroOpacityRef.current = 28;
          showToast(`Photo "${newName}" loaded!`);
        }}
      />
    </div>
  );
};
