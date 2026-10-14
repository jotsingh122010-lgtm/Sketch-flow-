import React, { useState, useRef } from 'react';
import { X, Upload, Sparkles, Image as ImageIcon } from 'lucide-react';
import { SAMPLE_TEMPLATES } from '../data/sampleTemplates';

interface ImagePickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectImage: (imageDataUrl: string, imageName: string) => void;
}

export const ImagePickerModal: React.FC<ImagePickerModalProps> = ({
  isOpen,
  onClose,
  onSelectImage,
}) => {
  const [activeTab, setActiveTab] = useState<'upload' | 'templates'>('upload');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  if (!isOpen) return null;

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setErrorMsg(null);

    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result as string;
      if (result) {
        onSelectImage(result, file.name);
        onClose();
      }
    };
    reader.onerror = () => {
      setErrorMsg('Unable to load photo. Please choose another image.');
    };
    reader.readAsDataURL(file);
  };

  const categories = ['All', 'Animals', 'Anime & Manga', 'Nature'];
  const filteredTemplates =
    selectedCategory === 'All'
      ? SAMPLE_TEMPLATES
      : SAMPLE_TEMPLATES.filter((t) => t.category === selectedCategory);

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div 
        className="w-full max-w-lg bg-[#160e29] border border-purple-500/30 rounded-t-3xl sm:rounded-3xl max-h-[88vh] flex flex-col shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header (Purple & White) */}
        <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-purple-500/20">
          <div>
            <h3 className="text-lg font-black text-white tracking-tight flex items-center gap-2">
              <ImageIcon className="w-5 h-5 text-purple-400" />
              Select Reference Photo
            </h3>
            <p className="text-xs text-purple-200/80 mt-0.5">
              Upload any image from your device or pick a template to trace on paper.
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="w-10 h-10 rounded-full flex items-center justify-center bg-purple-950/80 border border-purple-500/30 text-purple-300 hover:text-white active:scale-95 transition-transform"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab switchers */}
        <div className="flex items-center gap-2 px-5 pt-3">
          <button
            onClick={() => setActiveTab('upload')}
            className={`flex-1 py-3 px-3 rounded-xl text-xs font-black flex items-center justify-center gap-2 transition-all ${
              activeTab === 'upload'
                ? 'bg-purple-600 text-white shadow-md shadow-purple-600/30'
                : 'bg-purple-950/60 text-purple-300 hover:text-white border border-purple-500/20'
            }`}
          >
            <Upload className="w-4 h-4" />
            Device Gallery
          </button>
          <button
            onClick={() => setActiveTab('templates')}
            className={`flex-1 py-3 px-3 rounded-xl text-xs font-black flex items-center justify-center gap-2 transition-all ${
              activeTab === 'templates'
                ? 'bg-purple-600 text-white shadow-md shadow-purple-600/30'
                : 'bg-purple-950/60 text-purple-300 hover:text-white border border-purple-500/20'
            }`}
          >
            <Sparkles className="w-4 h-4" />
            Sketches ({SAMPLE_TEMPLATES.length})
          </button>
        </div>

        {/* Tab Content */}
        <div className="p-5 flex-1 overflow-y-auto">
          {errorMsg && (
            <div className="mb-4 p-3 rounded-xl bg-red-950/80 border border-red-500/50 text-red-200 text-xs font-bold">
              {errorMsg}
            </div>
          )}

          {activeTab === 'upload' ? (
            <div className="flex flex-col items-center justify-center py-8 border-2 border-dashed border-purple-400/40 rounded-2xl bg-[#120a22] text-center hover:border-purple-400 transition-colors">
              <div className="w-16 h-16 rounded-2xl bg-white text-purple-950 flex items-center justify-center mb-3 shadow-lg">
                <Upload className="w-8 h-8 text-purple-600" />
              </div>
              <h4 className="text-base font-bold text-white">Select Photo from Device Gallery</h4>
              <p className="text-xs text-purple-200/80 max-w-xs mt-1 mb-5 leading-relaxed">
                Choose any photo. It will appear semi-transparent over the camera view so you can easily trace it onto paper.
              </p>

              <label className="cursor-pointer px-6 py-3.5 rounded-xl bg-white hover:bg-neutral-100 text-purple-950 text-xs font-black tracking-wide uppercase shadow-lg active:scale-95 transition-all flex items-center gap-2">
                <Upload className="w-4 h-4 text-purple-600" />
                Upload Photo from Gallery
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="mt-3 text-xs text-purple-300 hover:text-white underline underline-offset-4"
              >
                Tap here to browse photos
              </button>
            </div>
          ) : (
            <div>
              {/* Category Filter */}
              <div className="flex gap-1.5 overflow-x-auto pb-3 mb-2 no-scrollbar">
                {categories.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategory(cat)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                      selectedCategory === cat
                        ? 'bg-purple-600 text-white shadow-xs'
                        : 'bg-purple-950/80 text-purple-300 hover:text-white border border-purple-500/20'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>

              {/* Template Grid */}
              <div className="grid grid-cols-2 gap-3">
                {filteredTemplates.map((template) => (
                  <div
                    key={template.id}
                    onClick={() => {
                      onSelectImage(template.svgDataUrl, template.title);
                      onClose();
                    }}
                    className="p-3 rounded-2xl bg-[#120a22] border border-purple-500/30 hover:border-purple-400 cursor-pointer active:scale-95 transition-all flex flex-col justify-between"
                  >
                    <div className="w-full aspect-square bg-[#0a0514] rounded-xl flex items-center justify-center p-2 mb-2">
                      <img
                        src={template.svgDataUrl}
                        alt={template.title}
                        className="w-full h-full object-contain"
                      />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-white truncate">{template.title}</h4>
                      <p className="text-[10px] text-purple-300/70">{template.category}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
