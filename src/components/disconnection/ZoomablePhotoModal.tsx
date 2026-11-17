import React, { useState, useEffect, useRef } from 'react';
import { X, ZoomIn, ZoomOut, RotateCcw, Download } from 'lucide-react';

interface ZoomablePhotoModalProps {
  isOpen: boolean;
  imageUrl: string;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  enableZoom?: boolean;
  downloadFileName?: string;
}

const resolveHdPhotoSrc = (url: string): string => {
  const s = String(url || '').trim();
  if (!s) return '';
  if (s.startsWith('data:') || s.includes('/api/drive-proxy/') || s.includes('/api/stored-images/')) {
    return s;
  }
  const driveMatch = s.match(/drive\.google\.com\/(?:file\/d\/|open\?id=|uc\?[^#]*id=)([a-zA-Z0-9_-]{25,})/i);
  if (driveMatch && driveMatch[1]) {
    return `https://drive.google.com/thumbnail?id=${driveMatch[1]}&sz=w2400`;
  }
  return s;
};

export const ZoomablePhotoModal: React.FC<ZoomablePhotoModalProps> = ({
  isOpen,
  imageUrl,
  onClose,
  title = 'HD Field Evidence Photo',
  subtitle,
  enableZoom = false,
  downloadFileName = 'field_evidence_hd.jpg'
}) => {
  const [zoom, setZoom] = useState<number>(1);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [imgSrc, setImgSrc] = useState<string>(() => resolveHdPhotoSrc(imageUrl));
  const dragStartRef = useRef<{ x: number; y: number; panX: number; panY: number } | null>(null);

  useEffect(() => {
    setImgSrc(resolveHdPhotoSrc(imageUrl));
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }, [imageUrl, isOpen]);

  if (!isOpen || !imageUrl) return null;

  const clampZoom = (z: number) => Math.min(5, Math.max(1, Number(z.toFixed(2))));

  const handleZoomIn = () => {
    setZoom(prev => clampZoom(prev + 0.5));
  };

  const handleZoomOut = () => {
    setZoom(prev => {
      const next = clampZoom(prev - 0.5);
      if (next <= 1) setPan({ x: 0, y: 0 });
      return next;
    });
  };

  const handleResetZoom = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    if (!enableZoom) return;
    e.preventDefault();
    const delta = e.deltaY < 0 ? 0.25 : -0.25;
    setZoom(prev => {
      const next = clampZoom(prev + delta);
      if (next <= 1) setPan({ x: 0, y: 0 });
      return next;
    });
  };

  const handleDoubleClick = () => {
    if (!enableZoom) return;
    if (zoom > 1) {
      handleResetZoom();
    } else {
      setZoom(2.5);
    }
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!enableZoom || zoom <= 1) return;
    setIsDragging(true);
    dragStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      panX: pan.x,
      panY: pan.y
    };
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {}
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging || !dragStartRef.current) return;
    const dx = e.clientX - dragStartRef.current.x;
    const dy = e.clientY - dragStartRef.current.y;
    setPan({
      x: dragStartRef.current.panX + dx,
      y: dragStartRef.current.panY + dy
    });
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging) return;
    setIsDragging(false);
    dragStartRef.current = null;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {}
  };

  return (
    <div
      className="fixed inset-0 z-80 bg-slate-950/92 backdrop-blur-xs flex flex-col items-center justify-center p-2 sm:p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-4xl bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[94vh]"
        onClick={e => e.stopPropagation()}
      >
        {/* Top Toolbar */}
        <div className="px-3 sm:px-4 py-2.5 bg-slate-950 border-b border-slate-800 flex items-center justify-between gap-2 flex-wrap">
          <div className="min-w-0">
            <h4 className="text-xs sm:text-sm font-black text-white truncate">{title}</h4>
            {subtitle && (
              <p className="text-[10px] sm:text-[11px] text-slate-400 truncate">{subtitle}</p>
            )}
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0 flex-wrap">
            {enableZoom && (
              <div className="flex items-center gap-1 bg-slate-900 border border-slate-700 rounded-xl p-1">
                <button
                  type="button"
                  onClick={handleZoomOut}
                  disabled={zoom <= 1}
                  title="Zoom Out"
                  className="p-1.5 rounded-lg text-slate-200 hover:bg-slate-800 disabled:opacity-40 cursor-pointer transition-colors"
                >
                  <ZoomOut className="w-4 h-4" />
                </button>
                <span className="px-1.5 text-[11px] font-mono font-bold text-amber-400 min-w-[44px] text-center">
                  {Math.round(zoom * 100)}%
                </span>
                <button
                  type="button"
                  onClick={handleZoomIn}
                  disabled={zoom >= 5}
                  title="Zoom In"
                  className="p-1.5 rounded-lg text-slate-200 hover:bg-slate-800 disabled:opacity-40 cursor-pointer transition-colors"
                >
                  <ZoomIn className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={handleResetZoom}
                  disabled={zoom === 1 && pan.x === 0 && pan.y === 0}
                  title="Reset Zoom"
                  className="px-2 py-1 rounded-lg text-[11px] font-bold text-slate-300 hover:bg-slate-800 disabled:opacity-40 cursor-pointer flex items-center gap-1"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Reset</span>
                </button>
              </div>
            )}

            <a
              href={imgSrc}
              target="_blank"
              rel="noreferrer"
              download={downloadFileName}
              className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors"
              title="Download HD Photo"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">HD</span>
            </a>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white cursor-pointer transition-colors"
              title="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Image Viewport */}
        <div
          onWheel={handleWheel}
          onDoubleClick={handleDoubleClick}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          className={`relative flex-1 bg-black flex items-center justify-center overflow-hidden min-h-[320px] max-h-[78vh] select-none ${
            enableZoom ? (zoom > 1 ? (isDragging ? 'cursor-grabbing' : 'cursor-grab') : 'cursor-zoom-in') : ''
          }`}
          style={{ touchAction: enableZoom && zoom > 1 ? 'none' : 'auto' }}
        >
          <img
            src={imgSrc}
            alt={title}
            referrerPolicy="no-referrer"
            draggable={false}
            onError={(e) => {
              const url = e.currentTarget.src;
              const idMatch = url.match(/[\/=]([a-zA-Z0-9_-]{25,})/);
              if (idMatch && idMatch[1] && !url.includes('/api/drive-proxy/')) {
                setImgSrc(`/api/drive-proxy/${idMatch[1]}`);
              }
            }}
            className="max-h-[76vh] max-w-full object-contain transition-transform duration-100 ease-out"
            style={{
              transform: `translate3d(${pan.x}px, ${pan.y}px, 0) scale(${zoom})`,
              transformOrigin: 'center center',
              imageRendering: 'auto'
            }}
          />
        </div>

        {enableZoom && (
          <div className="px-4 py-2 bg-slate-950 border-t border-slate-800 text-[11px] text-slate-400 flex items-center justify-between gap-2">
            <span>Admin HD Zoom: Use + / - buttons, mouse wheel, or double-tap to zoom and drag to pan.</span>
            <span className="font-mono text-emerald-400 font-bold shrink-0">FULL HD</span>
          </div>
        )}
      </div>
    </div>
  );
};
