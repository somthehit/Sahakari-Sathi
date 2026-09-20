import React, { useRef, useState, useEffect } from 'react';
import { RotateCcw, Eraser, PenTool, CheckCircle2, Upload, Camera, X } from 'lucide-react';

/**
 * SignaturePad — canvas-based signature capture with touch/pen support,
 * file upload, and camera scan. Produces a PNG data URL suitable for the
 * signature-verification pipeline.
 */
export const SignaturePad: React.FC<{
  value?: string | null;
  onChange: (dataUrl: string | null) => void;
  height?: number;
  className?: string;
}> = ({ value, onChange, height = 140, className }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const drawingRef = useRef(false);
  const [hasInk, setHasInk] = useState(false);
  const [busy, setBusy] = useState(false);
  const [inputMode, setInputMode] = useState<'draw' | 'upload' | 'camera'>('draw');
  const [cameraActive, setCameraActive] = useState(false);

  const hasValue = Boolean(value && value.startsWith('data:'));

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 2.5;

    const dpr = window.devicePixelRatio || 1;
    const { width, height: h } = canvas.getBoundingClientRect();
    if (canvas.width !== Math.round(width * dpr) || canvas.height !== Math.round(h * dpr)) {
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.scale(dpr, dpr);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, width, h);
      if (hasValue && value) {
        const img = new Image();
        img.onload = () => ctx.drawImage(img, 0, 0, width, h);
        img.src = value;
      }
    }
  }, [value, hasValue]);

  const pos = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const start = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    drawingRef.current = true;
    ctx.beginPath();
    const p = pos(e);
    ctx.moveTo(p.x, p.y);
    (e.currentTarget as HTMLCanvasElement).setPointerCapture(e.pointerId);
  };

  const move = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current) return;
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    const p = pos(e);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    setHasInk(true);
  };

  const end = () => {
    if (!drawingRef.current) return;
    drawingRef.current = false;
    emit();
  };

  const emit = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    setBusy(true);
    const out = document.createElement('canvas');
    const scale = Math.min(1, 320 / canvas.width);
    out.width = Math.max(1, Math.round(canvas.width * scale));
    out.height = Math.max(1, Math.round(canvas.height * scale));
    out.getContext('2d')!.drawImage(canvas, 0, 0, out.width, out.height);
    onChange(out.toDataURL('image/png'));
    setBusy(false);
  };

  const drawImageOnCanvas = (img: HTMLImageElement) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    const { width, height: h } = canvas.getBoundingClientRect();
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(h * dpr);
    ctx.scale(dpr, dpr);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, h);
    const ratio = Math.min(width / img.width, h / img.height);
    const w = img.width * ratio;
    const h2 = img.height * ratio;
    ctx.drawImage(img, (width - w) / 2, (h - h2) / 2, w, h2);
    setHasInk(true);
    emit();
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => drawImageOnCanvas(img);
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const startCamera = async () => {
    setCameraActive(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 640 }, height: { ideal: 480 } }
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
    } catch {
      setCameraActive(false);
    }
  };

  const captureFromCamera = () => {
    const video = videoRef.current;
    if (!video) return;
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = video.videoWidth;
    tempCanvas.height = video.videoHeight;
    tempCanvas.getContext('2d')!.drawImage(video, 0, 0);
    const img = new Image();
    img.onload = () => drawImageOnCanvas(img);
    img.src = tempCanvas.toDataURL('image/png');
    stopCamera();
  };

  const stopCamera = () => {
    const video = videoRef.current;
    if (video?.srcObject) {
      (video.srcObject as MediaStream).getTracks().forEach(t => t.stop());
      video.srcObject = null;
    }
    setCameraActive(false);
  };

  const clear = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.restore();
    setHasInk(false);
    onChange(null);
  };

  return (
    <div className={`space-y-1.5 ${className ?? ''}`}>
      {/* Input mode tabs */}
      <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-0.5">
        <button type="button" onClick={() => { setInputMode('draw'); stopCamera(); }}
          className={`flex-1 flex items-center justify-center gap-1.5 px-2 py-1 text-[11px] font-semibold rounded-md transition ${inputMode === 'draw' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
          <PenTool className="w-3.5 h-3.5" /> Draw
        </button>
        <button type="button" onClick={() => { setInputMode('upload'); stopCamera(); fileInputRef.current?.click(); }}
          className={`flex-1 flex items-center justify-center gap-1.5 px-2 py-1 text-[11px] font-semibold rounded-md transition ${inputMode === 'upload' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
          <Upload className="w-3.5 h-3.5" /> Upload
        </button>
        <button type="button" onClick={() => { setInputMode('camera'); startCamera(); }}
          className={`flex-1 flex items-center justify-center gap-1.5 px-2 py-1 text-[11px] font-semibold rounded-md transition ${inputMode === 'camera' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
          <Camera className="w-3.5 h-3.5" /> Scan
        </button>
      </div>
      <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileUpload} />

      {/* Camera view */}
      {cameraActive && (
        <div className="relative rounded-lg border border-slate-300 overflow-hidden bg-black">
          <video ref={videoRef} className="w-full" style={{ height }} autoPlay playsInline muted />
          <div className="absolute bottom-2 left-0 right-0 flex justify-center gap-2">
            <button type="button" onClick={captureFromCamera}
              className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-4 py-1.5 rounded-lg shadow-lg">
              Capture
            </button>
            <button type="button" onClick={stopCamera}
              className="bg-slate-700 hover:bg-slate-800 text-white text-xs font-bold px-3 py-1.5 rounded-lg shadow-lg">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Canvas (draw mode or preview) */}
      {!cameraActive && (
        <div className={`relative rounded-lg border ${hasValue ? 'border-emerald-300 bg-emerald-50/40' : 'border-slate-300 bg-white'} overflow-hidden`}>
          <canvas
            ref={canvasRef}
            className="w-full touch-none cursor-crosshair"
            style={{ height }}
            onPointerDown={start}
            onPointerMove={move}
            onPointerUp={end}
            onPointerLeave={end}
          />
          {!hasInk && !hasValue && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none text-slate-300">
              <PenTool className="w-5 h-5 mr-2" /> {inputMode === 'upload' ? 'Upload an image above' : inputMode === 'camera' ? 'Start camera above' : 'Sign here with mouse / stylus / finger'}
            </div>
          )}
          {hasValue && (
            <div className="absolute top-2 right-2 bg-emerald-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" /> Captured
            </div>
          )}
        </div>
      )}

      <div className="flex justify-between items-center">
        <p className="text-[11px] text-slate-400">Draw, upload, or scan a signature image.</p>
        <button
          type="button"
          onClick={() => { clear(); stopCamera(); }}
          className="text-[11px] font-semibold text-slate-500 hover:text-rose-600 inline-flex items-center gap-1"
        >
          <Eraser className="w-3.5 h-3.5" /> Clear {busy && <RotateCcw className="w-3 h-3 animate-spin" />}
        </button>
      </div>
    </div>
  );
};
