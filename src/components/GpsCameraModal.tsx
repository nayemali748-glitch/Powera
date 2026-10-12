import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Camera,
  X,
  RefreshCw,
  MapPin,
  Check,
  RotateCcw,
  Navigation,
  ShieldCheck,
  Loader2,
  SwitchCamera
} from 'lucide-react';
import { compressImageFile, drawGpsWatermarkOnCanvas } from '../utils/imageCompressor';
import { getNowDateDDMMYYYY, getNowTime12Hour } from '../utils/dateTimeFormat';

export interface GpsCameraModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCapture: (hdDataUrl: string, gpsCoordinates: string) => void;
  watermarkTitle?: string;
  workerName?: string;
  addressHint?: string;
  lang?: 'en' | 'bn';
}

export const GpsCameraModal: React.FC<GpsCameraModalProps> = ({
  isOpen,
  onClose,
  onCapture,
  watermarkTitle = 'WBSEDCL FIELD EVIDENCE',
  workerName = 'Field Staff',
  addressHint = '',
  lang = 'en'
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fallbackInputRef = useRef<HTMLInputElement | null>(null);

  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [capturedPreview, setCapturedPreview] = useState<string | null>(null);

  // Live GPS states
  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);
  const [accuracy, setAccuracy] = useState<number | null>(null);
  const [resolvedAddress, setResolvedAddress] = useState<string>(addressHint || '');
  const [isFetchingGps, setIsFetchingGps] = useState<boolean>(false);
  const [liveTimeStr, setLiveTimeStr] = useState<string>(`${getNowDateDDMMYYYY()} ${getNowTime12Hour()}`);

  // Update live clock every second
  useEffect(() => {
    if (!isOpen) return;
    const timer = setInterval(() => {
      setLiveTimeStr(`${getNowDateDDMMYYYY()} ${getNowTime12Hour()}`);
    }, 1000);
    return () => clearInterval(timer);
  }, [isOpen]);

  // Reverse geocode helper (non-blocking)
  const reverseGeocode = useCallback(async (latitude: number, longitude: number) => {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3500);
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${latitude}&lon=${longitude}`,
        {
          headers: { 'Accept-Language': 'en' },
          signal: controller.signal
        }
      );
      clearTimeout(timeoutId);
      if (res.ok) {
        const data = await res.json();
        if (data && data.display_name) {
          const shortAddr = String(data.display_name)
            .split(',')
            .slice(0, 4)
            .map((s: string) => s.trim())
            .join(', ');
          if (shortAddr) {
            setResolvedAddress(shortAddr);
          }
        }
      }
    } catch {
      // Keep addressHint if reverse geocode is unavailable
    }
  }, []);

  // Fetch & watch GPS coordinates
  const refreshGpsLocation = useCallback(() => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setLat(22.572646);
      setLng(88.363895);
      return;
    }
    setIsFetchingGps(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const newLat = pos.coords.latitude;
        const newLng = pos.coords.longitude;
        const newAcc = pos.coords.accuracy ? Math.round(pos.coords.accuracy) : null;
        setLat(newLat);
        setLng(newLng);
        setAccuracy(newAcc);
        setIsFetchingGps(false);
        if (!addressHint) {
          reverseGeocode(newLat, newLng);
        }
      },
      () => {
        setLat(prev => prev ?? 22.572646);
        setLng(prev => prev ?? 88.363895);
        setIsFetchingGps(false);
      },
      { enableHighAccuracy: true, timeout: 7000, maximumAge: 10000 }
    );
  }, [addressHint, reverseGeocode]);

  useEffect(() => {
    if (!isOpen) return;
    setResolvedAddress(addressHint || '');
    refreshGpsLocation();

    let watchId: number | null = null;
    if (typeof navigator !== 'undefined' && navigator.geolocation) {
      watchId = navigator.geolocation.watchPosition(
        (pos) => {
          setLat(pos.coords.latitude);
          setLng(pos.coords.longitude);
          if (pos.coords.accuracy) {
            setAccuracy(Math.round(pos.coords.accuracy));
          }
        },
        () => {},
        { enableHighAccuracy: true, maximumAge: 5000 }
      );
    }

    return () => {
      if (watchId !== null && typeof navigator !== 'undefined' && navigator.geolocation) {
        navigator.geolocation.clearWatch(watchId);
      }
    };
  }, [isOpen, addressHint, refreshGpsLocation]);

  // Stop active video stream
  const stopCameraStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => {
        try {
          track.stop();
        } catch {}
      });
      streamRef.current = null;
    }
    setCameraReady(false);
  }, []);

  // Start Full HD Camera Stream
  const startCameraStream = useCallback(async (mode: 'environment' | 'user') => {
    stopCameraStream();
    setCameraError(null);

    if (typeof navigator === 'undefined' || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setCameraError(
        lang === 'bn'
          ? 'লাইভ ক্যামেরা উপলব্ধ নয় — নিচের বাটনে ট্যাপ করে GPS ক্যামেরা ওপেন করুন'
          : 'Live camera stream unavailable in this view — tap below to capture with GPS stamp'
      );
      return;
    }

    try {
      const constraints: MediaStreamConstraints = {
        video: {
          facingMode: { ideal: mode },
          width: { ideal: 1920, min: 1280 },
          height: { ideal: 1080, min: 720 }
        },
        audio: false
      };

      let mediaStream: MediaStream;
      try {
        mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
      } catch {
        // Fallback to standard constraints if Full HD constraint is rejected by device
        mediaStream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: mode },
          audio: false
        });
      }

      streamRef.current = mediaStream;
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        await videoRef.current.play().catch(() => {});
        setCameraReady(true);
      }
    } catch (err: any) {
      setCameraError(
        lang === 'bn'
          ? 'ক্যামেরা পারমিশন পাওয়া যায়নি — নিচের GPS Camera বাটনে ক্লিক করে ছবি তুলুন'
          : 'Camera permission needed — tap the button below to take GPS stamped HD photo'
      );
    }
  }, [lang, stopCameraStream]);

  useEffect(() => {
    if (isOpen && !capturedPreview) {
      startCameraStream(facingMode);
    } else {
      stopCameraStream();
    }
    return () => {
      stopCameraStream();
    };
  }, [isOpen, facingMode, capturedPreview, startCameraStream, stopCameraStream]);

  if (!isOpen) return null;

  const formattedGpsLine = (() => {
    const effLat = lat ?? 22.572646;
    const effLng = lng ?? 88.363895;
    const latDir = effLat >= 0 ? 'N' : 'S';
    const lngDir = effLng >= 0 ? 'E' : 'W';
    return `LAT: ${Math.abs(effLat).toFixed(6)}° ${latDir}, LON: ${Math.abs(effLng).toFixed(6)}° ${lngDir}${accuracy ? ` (±${accuracy}m)` : ''}`;
  })();

  const rawCoordsPair = `${(lat ?? 22.572646).toFixed(6)}, ${(lng ?? 88.363895).toFixed(6)}`;

  // Capture Full HD frame from live video + burn GPS Camera Stamp
  const handleShutterCapture = () => {
    if (!videoRef.current || isCapturing) return;
    setIsCapturing(true);

    try {
      const video = videoRef.current;
      let width = video.videoWidth || 1920;
      let height = video.videoHeight || 1080;

      // Cap max dimension at 1920px while preserving aspect ratio
      const maxDim = 1920;
      if (width > height && width > maxDim) {
        height = Math.round((height * maxDim) / width);
        width = maxDim;
      } else if (height >= width && height > maxDim) {
        width = Math.round((width * maxDim) / height);
        height = maxDim;
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d', { alpha: false });
      if (!ctx) {
        setIsCapturing(false);
        return;
      }

      ctx.fillStyle = '#000000';
      ctx.fillRect(0, 0, width, height);
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(video, 0, 0, width, height);

      const dateStr = getNowDateDDMMYYYY();
      const timeStr = getNowTime12Hour();

      drawGpsWatermarkOnCanvas(ctx, width, height, {
        watermarkText: watermarkTitle,
        gpsText: formattedGpsLine,
        addressText: resolvedAddress || addressHint || undefined,
        subText: `WORKER: ${workerName} | ${dateStr} ${timeStr}`
      });

      const hdDataUrl = canvas.toDataURL('image/jpeg', 0.92);
      setCapturedPreview(hdDataUrl);
      stopCameraStream();
    } catch (err) {
      console.error('GPS Camera capture error:', err);
    } finally {
      setIsCapturing(false);
    }
  };

  // Fallback native file input capture with Full HD GPS watermark
  const handleFallbackFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsCapturing(true);
    try {
      const dateStr = getNowDateDDMMYYYY();
      const timeStr = getNowTime12Hour();
      const hdCompressed = await compressImageFile(file, {
        maxDimension: 1920,
        quality: 0.92,
        watermarkText: watermarkTitle,
        gpsText: formattedGpsLine,
        addressText: resolvedAddress || addressHint || undefined,
        subText: `WORKER: ${workerName} | ${dateStr} ${timeStr}`
      });
      if (hdCompressed) {
        onCapture(hdCompressed, rawCoordsPair);
        onClose();
      }
    } finally {
      setIsCapturing(false);
      e.target.value = '';
    }
  };

  const handleConfirmCapturedPhoto = () => {
    if (!capturedPreview) return;
    onCapture(capturedPreview, rawCoordsPair);
    setCapturedPreview(null);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-80 bg-slate-950/95 backdrop-blur-xs flex flex-col items-center justify-between p-2 sm:p-4 select-none"
      onClick={e => e.stopPropagation()}
    >
      {/* Hidden Fallback Input for Native Device Camera */}
      <input
        ref={fallbackInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleFallbackFileChange}
      />

      {/* TOP HUD BAR */}
      <div className="w-full max-w-2xl flex items-center justify-between gap-2 px-3 py-2.5 bg-slate-900/90 border border-slate-800 rounded-2xl text-white shrink-0">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
          <div className="flex items-center gap-1.5">
            <Navigation className="w-4 h-4 text-emerald-400" />
            <span className="text-xs sm:text-sm font-black tracking-wide uppercase text-emerald-300">
              GPS MAP CAMERA • FULL HD
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={refreshGpsLocation}
            className="px-2.5 py-1 rounded-xl bg-slate-800 hover:bg-slate-700 text-emerald-300 text-[11px] font-bold flex items-center gap-1 cursor-pointer border border-slate-700"
            title="Refresh GPS Coordinates"
          >
            <RefreshCw className={`w-3 h-3 ${isFetchingGps ? 'animate-spin' : ''}`} />
            <span>GPS</span>
          </button>

          {!capturedPreview && (
            <button
              type="button"
              onClick={() => setFacingMode(prev => (prev === 'environment' ? 'user' : 'environment'))}
              className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 cursor-pointer border border-slate-700"
              title="Switch Camera"
            >
              <SwitchCamera className="w-4 h-4" />
            </button>
          )}

          <button
            type="button"
            onClick={() => {
              setCapturedPreview(null);
              stopCameraStream();
              onClose();
            }}
            className="p-1.5 rounded-xl bg-rose-600/20 hover:bg-rose-600 text-rose-300 hover:text-white cursor-pointer border border-rose-500/30 transition-colors"
            title="Close GPS Camera"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* VIEWPORT / LIVE CAMERA WITH GPS STAMP OVERLAY */}
      <div className="relative w-full max-w-2xl flex-1 my-2 rounded-3xl overflow-hidden bg-black border-2 border-slate-800 flex items-center justify-center shadow-2xl">
        {capturedPreview ? (
          <img
            src={capturedPreview}
            alt="Captured HD GPS Evidence"
            className="w-full h-full object-contain bg-black"
          />
        ) : (
          <>
            <video
              ref={videoRef}
              playsInline
              muted
              autoPlay
              className="w-full h-full object-cover"
            />

            {!cameraReady && !cameraError && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-slate-950/80 text-white p-6 text-center">
                <Loader2 className="w-8 h-8 animate-spin text-emerald-400" />
                <p className="text-xs sm:text-sm font-bold text-slate-200">
                  {lang === 'bn' ? 'HD GPS ক্যামেরা চালু হচ্ছে...' : 'Starting Full HD GPS Camera...'}
                </p>
              </div>
            )}

            {cameraError && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-slate-950/95 text-white p-6 text-center z-20">
                <div className="w-14 h-14 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
                  <Camera className="w-7 h-7" />
                </div>
                <p className="text-xs sm:text-sm font-bold text-slate-200 max-w-sm">
                  {cameraError}
                </p>
                <button
                  type="button"
                  onClick={() => fallbackInputRef.current?.click()}
                  className="px-5 py-3 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs sm:text-sm flex items-center gap-2 shadow-lg cursor-pointer"
                >
                  <Camera className="w-4 h-4" />
                  <span>
                    {lang === 'bn' ? 'GPS ক্যামেরা দিয়ে HD ছবি তুলুন' : 'Open Device Camera (With GPS Stamp)'}
                  </span>
                </button>
              </div>
            )}

            {/* LIVE GPS CAMERA OVERLAY STAMP ON VIEWPORT */}
            <div className="absolute bottom-3 left-3 right-3 bg-slate-950/85 backdrop-blur-md border border-emerald-500/50 rounded-2xl p-3 text-white shadow-xl pointer-events-none">
              <div className="flex items-start gap-3">
                {/* Mini GPS Pin & Compass Box */}
                <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl bg-emerald-950/90 border border-emerald-500/40 flex flex-col items-center justify-center shrink-0 text-emerald-400">
                  <MapPin className="w-5 h-5 text-emerald-400 animate-bounce" />
                  <span className="text-[9px] font-black tracking-tighter uppercase mt-0.5 text-emerald-300">
                    GPS LIVE
                  </span>
                </div>

                {/* Live Stamp Metadata */}
                <div className="flex-1 min-w-0 space-y-0.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs sm:text-sm font-black text-amber-400 truncate">
                      {watermarkTitle}
                    </span>
                    <span className="px-2 py-0.5 rounded bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-[9px] font-black shrink-0">
                      1080p HD
                    </span>
                  </div>

                  <div className="text-[11px] sm:text-xs font-mono font-bold text-emerald-300 truncate">
                    📍 {formattedGpsLine}
                  </div>

                  {(resolvedAddress || addressHint) && (
                    <div className="text-[10px] sm:text-[11px] text-slate-200 font-medium truncate">
                      {resolvedAddress || addressHint}
                    </div>
                  )}

                  <div className="text-[10px] sm:text-[11px] font-mono text-slate-300 flex items-center justify-between gap-2 pt-0.5">
                    <span className="truncate">WORKER: {workerName}</span>
                    <span className="shrink-0 text-amber-300 font-bold">{liveTimeStr}</span>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* BOTTOM ACTION / SHUTTER BAR */}
      <div className="w-full max-w-2xl px-4 py-3 bg-slate-900/90 border border-slate-800 rounded-2xl flex items-center justify-between gap-3 shrink-0">
        {capturedPreview ? (
          <>
            <button
              type="button"
              onClick={() => setCapturedPreview(null)}
              className="flex-1 py-3 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-2 cursor-pointer border border-slate-700"
            >
              <RotateCcw className="w-4 h-4" />
              <span>{lang === 'bn' ? 'আবার তুলুন (Retake)' : 'Retake Photo'}</span>
            </button>

            <button
              type="button"
              onClick={handleConfirmCapturedPhoto}
              className="flex-1 py-3 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs sm:text-sm flex items-center justify-center gap-2 cursor-pointer shadow-lg"
            >
              <Check className="w-4 h-4 stroke-[3]" />
              <span>{lang === 'bn' ? 'HD ছবি ব্যবহার করুন' : 'Use HD GPS Photo'}</span>
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              onClick={() => fallbackInputRef.current?.click()}
              className="py-2.5 px-3.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold flex items-center gap-1.5 cursor-pointer border border-slate-700"
            >
              <Camera className="w-3.5 h-3.5 text-emerald-400" />
              <span>{lang === 'bn' ? 'সিস্টেম ক্যামেরা' : 'System Camera'}</span>
            </button>

            <button
              type="button"
              onClick={handleShutterCapture}
              disabled={!cameraReady || isCapturing}
              className="w-16 h-16 rounded-full bg-white border-4 border-emerald-500 flex items-center justify-center shadow-xl active:scale-90 transition-all cursor-pointer disabled:opacity-40"
              title="Capture HD GPS Photo"
            >
              <div className="w-12 h-12 rounded-full bg-emerald-500 flex items-center justify-center text-slate-950">
                <Camera className="w-6 h-6 stroke-[2.5]" />
              </div>
            </button>

            <div className="flex items-center gap-1.5 text-[11px] font-bold text-emerald-400">
              <ShieldCheck className="w-4 h-4 shrink-0" />
              <span>GPS Auto-Stamp</span>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
export default GpsCameraModal;
