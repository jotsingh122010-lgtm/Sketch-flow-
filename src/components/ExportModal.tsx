import React, { useState } from 'react';
import { X, Download, Share2, Check, BookmarkCheck } from 'lucide-react';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  imageDataUrl: string;
  onSaveToProject?: () => void;
}

export const ExportModal: React.FC<ExportModalProps> = ({
  isOpen,
  onClose,
  imageDataUrl,
  onSaveToProject,
}) => {
  const [downloaded, setDownloaded] = useState(false);
  const [savedProject, setSavedProject] = useState(false);
  const [shareStatus, setShareStatus] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleDownload = () => {
    try {
      const link = document.createElement('a');
      link.download = `sketchflow-${Date.now()}.png`;
      link.href = imageDataUrl;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setDownloaded(true);
      setTimeout(() => setDownloaded(false), 3000);
    } catch (err) {
      console.error('Download failed', err);
    }
  };

  const handleShare = async () => {
    try {
      if (navigator.share && navigator.canShare) {
        const res = await fetch(imageDataUrl);
        const blob = await res.blob();
        const file = new File([blob], `sketchflow-${Date.now()}.png`, { type: 'image/png' });

        if (navigator.canShare({ files: [file] })) {
          await navigator.share({
            title: 'My Artwork - SketchFlow',
            text: 'Created with SketchFlow AR Tracing',
            files: [file],
          });
          setShareStatus('Photo shared successfully!');
          return;
        }
      }
      
      if (navigator.share) {
        await navigator.share({
          title: 'SketchFlow Artwork',
          text: 'Check out my sketch!',
        });
        setShareStatus('Shared!');
      } else {
        setShareStatus('Sharing is not supported on this browser.');
      }
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        setShareStatus('Share was cancelled.');
      }
    }
  };

  const handleSaveInternal = () => {
    if (onSaveToProject) {
      onSaveToProject();
      setSavedProject(true);
      setTimeout(() => setSavedProject(false), 3000);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
      <div 
        className="w-full max-w-md bg-[#160e29] border border-purple-500/30 rounded-3xl p-5 shadow-2xl flex flex-col max-h-[92vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between pb-3 border-b border-purple-500/20">
          <div>
            <h3 className="text-base font-black text-white tracking-tight">Export Artwork</h3>
            <p className="text-xs text-purple-300">High-Resolution PNG format</p>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full flex items-center justify-center bg-purple-950/80 border border-purple-500/30 text-purple-300 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Artwork Preview Frame */}
        <div className="my-4 relative flex-1 min-h-[240px] max-h-[380px] bg-[#0c0617] rounded-2xl border border-purple-500/20 flex items-center justify-center p-3 overflow-hidden">
          <img
            src={imageDataUrl}
            alt="Export preview"
            className="max-h-full max-w-full object-contain filter drop-shadow-md select-none"
          />
        </div>

        {/* Actions */}
        <div className="space-y-2 pt-1">
          <button
            onClick={handleDownload}
            className="w-full h-12 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 text-white font-extrabold text-xs tracking-wider uppercase flex items-center justify-center gap-2 shadow-lg shadow-purple-600/30 active:scale-95 transition-all"
          >
            {downloaded ? (
              <>
                <Check className="w-4 h-4 text-white" />
                Saved to Device!
              </>
            ) : (
              <>
                <Download className="w-4 h-4" />
                Save / Download PNG
              </>
            )}
          </button>

          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={handleShare}
              className="h-11 rounded-xl bg-purple-950/80 hover:bg-purple-900 text-white text-xs font-bold flex items-center justify-center gap-2 border border-purple-500/30 active:scale-95 transition-transform"
            >
              <Share2 className="w-4 h-4 text-purple-400" />
              Share
            </button>
            <button
              onClick={handleSaveInternal}
              className="h-11 rounded-xl bg-purple-950/80 hover:bg-purple-900 text-white text-xs font-bold flex items-center justify-center gap-2 border border-purple-500/30 active:scale-95 transition-transform"
            >
              {savedProject ? (
                <>
                  <Check className="w-4 h-4 text-purple-400" />
                  Saved!
                </>
              ) : (
                <>
                  <BookmarkCheck className="w-4 h-4 text-purple-400" />
                  Save to App
                </>
              )}
            </button>
          </div>

          {shareStatus && (
            <p className="text-center text-[11px] text-purple-300 font-medium mt-1">{shareStatus}</p>
          )}
        </div>
      </div>
    </div>
  );
};
