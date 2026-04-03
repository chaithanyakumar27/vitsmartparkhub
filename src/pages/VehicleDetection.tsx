import { useState, useRef, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import AppLayout from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  Video, Upload, Square, CheckCircle, XCircle, AlertTriangle,
  Cpu, Ruler, MapPin, Send, RotateCcw, Eye, EyeOff, RefreshCw,
  Layers, Activity, Crosshair, Sparkles,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface CarDimension {
  id: string; category: string; make: string | null; model: string | null;
  length_cm: number; width_cm: number; height_cm: number | null;
}

interface BoundaryRect { x: number; y: number; width: number; height: number; label?: string; }

interface DetectedVehicle {
  type: string; model_guess: string; confidence: number;
  bounding_box: { x: number; y: number; width: number; height: number };
  status: 'inside' | 'outside' | 'crossing' | 'unknown';
  status_description: string;
}

interface AnalysisResult {
  vehicles: DetectedVehicle[];
  total_vehicles: number;
  scene_description: string;
  frameIndex?: number;
}

interface FitResult {
  fits: boolean; vehicleLength: number; vehicleWidth: number;
  slotLength: number; slotWidth: number;
}

const VehicleDetection = () => {
  const { user } = useAuth();

  // Video
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoUrl, setVideoUrl] = useState('');
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  // Canvas
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const [drawMode, setDrawMode] = useState(false);
  const [isDrawing, setIsDrawing] = useState(false);
  const [drawStart, setDrawStart] = useState<{ x: number; y: number } | null>(null);

  // Boundaries
  const [boundaries, setBoundaries] = useState<BoundaryRect[]>([]);
  const [showBoundaryOverlay, setShowBoundaryOverlay] = useState(true);

  // Detection
  const [isDetecting, setIsDetecting] = useState(false);
  const [analysisResults, setAnalysisResults] = useState<AnalysisResult[]>([]);
  const [currentResultIndex, setCurrentResultIndex] = useState(0);
  const [frameByFrame, setFrameByFrame] = useState(false);
  const [frameCount, setFrameCount] = useState(3);

  // Car dimensions
  const [carDimensions, setCarDimensions] = useState<CarDimension[]>([]);
  const [selectedCarId, setSelectedCarId] = useState('');
  const [fitResult, setFitResult] = useState<FitResult | null>(null);
  const [slotLength, setSlotLength] = useState('500');
  const [slotWidth, setSlotWidth] = useState('250');
  const [altSlots, setAltSlots] = useState<string[]>([]);


  useEffect(() => {
    supabase.from('car_dimensions').select('*').order('category, make, model')
      .then(({ data }) => { if (data) setCarDimensions(data as unknown as CarDimension[]); });
  }, []);

  // Upload with progress simulation
  const handleVideoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const validTypes = ['video/mp4', 'video/avi', 'video/quicktime', 'video/webm', 'video/x-msvideo'];
    if (!file.type.startsWith('video/') && !validTypes.includes(file.type)) {
      toast.error('Please upload a video file (MP4, AVI, MOV)');
      return;
    }
    setIsUploading(true);
    setUploadProgress(0);

    // Simulate upload progress
    let progress = 0;
    const interval = setInterval(() => {
      progress += Math.random() * 25 + 10;
      if (progress >= 100) {
        progress = 100;
        clearInterval(interval);
        setVideoFile(file);
        setVideoUrl(URL.createObjectURL(file));
        setBoundaries([]);
        setAnalysisResults([]);
        setFitResult(null);
        setIsUploading(false);
        toast.success('Video uploaded successfully!');
      }
      setUploadProgress(Math.min(progress, 100));
    }, 200);
  };

  // Capture frame from video as base64
  const captureFrame = useCallback((timeSeconds?: number): Promise<string> => {
    return new Promise((resolve, reject) => {
      if (!videoRef.current) return reject('No video');
      const video = videoRef.current;
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 480;

      const doCapture = () => {
        const ctx = canvas.getContext('2d')!;
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
        resolve(dataUrl.split(',')[1]);
      };

      if (timeSeconds !== undefined) {
        video.currentTime = timeSeconds;
        video.onseeked = () => { doCapture(); video.onseeked = null; };
      } else {
        doCapture();
      }
    });
  }, []);

  // AI Detection
  const runAIDetection = async () => {
    if (!videoFile) { toast.error('Upload a video first'); return; }
    setIsDetecting(true);
    setAnalysisResults([]);

    try {
      const results: AnalysisResult[] = [];
      const video = videoRef.current!;
      const duration = video.duration || 10;

      if (frameByFrame && frameCount > 1) {
        // Multi-frame analysis
        const times = Array.from({ length: frameCount }, (_, i) => (duration / (frameCount + 1)) * (i + 1));

        for (let i = 0; i < times.length; i++) {
          toast.info(`Analyzing frame ${i + 1}/${times.length}...`);
          const imageBase64 = await captureFrame(times[i]);
          const boundaryForAI = boundaries.length > 0 ? {
            x: (boundaries[0].x / (overlayRef.current?.width || 640)) * 100,
            y: (boundaries[0].y / (overlayRef.current?.height || 480)) * 100,
            width: (boundaries[0].width / (overlayRef.current?.width || 640)) * 100,
            height: (boundaries[0].height / (overlayRef.current?.height || 480)) * 100,
          } : null;

          const { data, error } = await supabase.functions.invoke('analyze-vehicle-frame', {
            body: { imageBase64, boundary: boundaryForAI, mode: 'detect' },
          });

          if (error) throw error;
          results.push({ ...data, frameIndex: i });
          // Small delay to avoid rate limiting
          if (i < times.length - 1) await new Promise(r => setTimeout(r, 1500));
        }
      } else {
        // Single frame
        const imageBase64 = await captureFrame();
        const boundaryForAI = boundaries.length > 0 ? {
          x: (boundaries[0].x / (overlayRef.current?.width || 640)) * 100,
          y: (boundaries[0].y / (overlayRef.current?.height || 480)) * 100,
          width: (boundaries[0].width / (overlayRef.current?.width || 640)) * 100,
          height: (boundaries[0].height / (overlayRef.current?.height || 480)) * 100,
        } : null;

        const { data, error } = await supabase.functions.invoke('analyze-vehicle-frame', {
          body: { imageBase64, boundary: boundaryForAI, mode: 'detect' },
        });

        if (error) throw error;
        results.push({ ...data, frameIndex: 0 });
      }

      setAnalysisResults(results);
      setCurrentResultIndex(0);
      drawDetectionOverlay(results[0]);

      // Check for violations and create notifications
      const hasViolation = results.some(r =>
        r.vehicles?.some(v => v.status === 'outside' || v.status === 'crossing')
      );

      if (hasViolation && user) {
        await supabase.from('notifications').insert({
          user_id: user.id,
          type: 'alert' as const,
          title: 'Parking Violation Detected',
          message: 'Alert: Vehicle is not properly parked within boundary.',
        });
        toast.error('⚠️ Parking violation detected! Vehicle outside boundary.');
      } else if (results.some(r => r.total_vehicles > 0)) {
        toast.success('✅ All vehicles are correctly parked within boundaries.');
      }
    } catch (err: any) {
      console.error('Detection error:', err);
      toast.error('AI detection failed: ' + (err.message || 'Unknown error'));
    } finally {
      setIsDetecting(false);
    }
  };

  // Auto-detect boundaries using AI
  const autoDetectBoundary = async () => {
    if (!videoFile) { toast.error('Upload a video first'); return; }
    setIsDetecting(true);
    try {
      const imageBase64 = await captureFrame();
      const { data, error } = await supabase.functions.invoke('analyze-vehicle-frame', {
        body: { imageBase64, mode: 'detect_boundary' },
      });

      if (error) throw error;

      if (data.boundaries && data.boundaries.length > 0) {
        const canvasW = overlayRef.current?.width || 640;
        const canvasH = overlayRef.current?.height || 480;
        const newBoundaries: BoundaryRect[] = data.boundaries.map((b: any) => ({
          x: (b.x / 100) * canvasW,
          y: (b.y / 100) * canvasH,
          width: (b.width / 100) * canvasW,
          height: (b.height / 100) * canvasH,
          label: b.label || 'AI Detected Zone',
        }));
        setBoundaries(newBoundaries);
        drawBoundaries(newBoundaries);
        toast.success(`AI detected ${newBoundaries.length} parking zone(s)!`);
      } else {
        toast.info('No clear parking boundaries detected. Draw one manually.');
      }
    } catch (err: any) {
      console.error('Boundary detection error:', err);
      toast.error('Boundary detection failed: ' + (err.message || 'Unknown error'));
    } finally {
      setIsDetecting(false);
    }
  };

  // Drawing
  const drawBoundaries = useCallback((bounds: BoundaryRect[]) => {
    if (!overlayRef.current) return;
    const ctx = overlayRef.current.getContext('2d')!;
    ctx.clearRect(0, 0, overlayRef.current.width, overlayRef.current.height);
    if (!showBoundaryOverlay) return;

    bounds.forEach((b, i) => {
      const colors = ['#22c55e', '#3b82f6', '#f59e0b', '#8b5cf6'];
      const color = colors[i % colors.length];
      ctx.strokeStyle = color;
      ctx.lineWidth = 3;
      ctx.setLineDash([]);
      ctx.strokeRect(b.x, b.y, b.width, b.height);
      ctx.fillStyle = color + '15';
      ctx.fillRect(b.x, b.y, b.width, b.height);
      ctx.font = 'bold 12px sans-serif';
      ctx.fillStyle = color;
      ctx.fillText(b.label || `Zone ${i + 1}`, b.x + 6, b.y - 6);
    });
  }, [showBoundaryOverlay]);

  const drawDetectionOverlay = useCallback((result: AnalysisResult) => {
    if (!overlayRef.current || !result) return;
    const ctx = overlayRef.current.getContext('2d')!;
    ctx.clearRect(0, 0, overlayRef.current.width, overlayRef.current.height);

    // Draw boundaries first
    if (showBoundaryOverlay) {
      boundaries.forEach((b, i) => {
        const colors = ['#22c55e', '#3b82f6', '#f59e0b', '#8b5cf6'];
        const color = colors[i % colors.length];
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.setLineDash([6, 3]);
        ctx.strokeRect(b.x, b.y, b.width, b.height);
        ctx.fillStyle = color + '10';
        ctx.fillRect(b.x, b.y, b.width, b.height);
      });
    }

    // Draw vehicles
    const canvasW = overlayRef.current.width;
    const canvasH = overlayRef.current.height;

    result.vehicles?.forEach((v) => {
      const bb = v.bounding_box;
      const x = (bb.x / 100) * canvasW;
      const y = (bb.y / 100) * canvasH;
      const w = (bb.width / 100) * canvasW;
      const h = (bb.height / 100) * canvasH;

      const statusColor = v.status === 'inside' ? '#22c55e' : v.status === 'crossing' ? '#f59e0b' : '#ef4444';

      ctx.strokeStyle = statusColor;
      ctx.lineWidth = 3;
      ctx.setLineDash([]);
      ctx.strokeRect(x, y, w, h);

      // Label bg
      const labelText = v.status === 'inside' ? 'Inside Boundary ✅' : v.status === 'crossing' ? 'Crossing ⚠️' : 'Outside Boundary ❌';
      ctx.font = 'bold 13px sans-serif';
      const textW = ctx.measureText(labelText).width;
      ctx.fillStyle = statusColor + 'dd';
      ctx.fillRect(x, y - 22, textW + 12, 20);
      ctx.fillStyle = '#fff';
      ctx.fillText(labelText, x + 6, y - 7);

      // Confidence
      const confText = `${v.type} ${(v.confidence * 100).toFixed(0)}%`;
      ctx.font = '11px sans-serif';
      ctx.fillStyle = statusColor;
      ctx.fillText(confText, x + 4, y + h + 14);
    });
  }, [boundaries, showBoundaryOverlay]);

  // Canvas draw handlers
  const startDraw = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!drawMode) return;
    const rect = overlayRef.current!.getBoundingClientRect();
    setDrawStart({ x: e.clientX - rect.left, y: e.clientY - rect.top });
    setIsDrawing(true);
  }, [drawMode]);

  const moveDraw = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing || !drawStart || !overlayRef.current) return;
    const rect = overlayRef.current.getBoundingClientRect();
    const ctx = overlayRef.current.getContext('2d')!;
    ctx.clearRect(0, 0, overlayRef.current.width, overlayRef.current.height);
    drawBoundaries(boundaries);
    ctx.strokeStyle = '#22c55e';
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 3]);
    ctx.strokeRect(drawStart.x, drawStart.y, e.clientX - rect.left - drawStart.x, e.clientY - rect.top - drawStart.y);
  }, [isDrawing, drawStart, boundaries, drawBoundaries]);

  const endDraw = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing || !drawStart || !overlayRef.current) return;
    const rect = overlayRef.current.getBoundingClientRect();
    const endX = e.clientX - rect.left;
    const endY = e.clientY - rect.top;
    const newB: BoundaryRect = {
      x: Math.min(drawStart.x, endX), y: Math.min(drawStart.y, endY),
      width: Math.abs(endX - drawStart.x), height: Math.abs(endY - drawStart.y),
      label: `Manual Zone ${boundaries.length + 1}`,
    };
    if (newB.width > 10 && newB.height > 10) {
      const updated = [...boundaries, newB];
      setBoundaries(updated);
      drawBoundaries(updated);
      toast.success('Boundary defined!');
    }
    setIsDrawing(false);
    setDrawStart(null);
    setDrawMode(false);
  }, [isDrawing, drawStart, boundaries, drawBoundaries]);

  // Sync overlay canvas
  useEffect(() => {
    if (!videoRef.current || !overlayRef.current) return;
    const sync = () => {
      if (videoRef.current && overlayRef.current) {
        overlayRef.current.width = videoRef.current.clientWidth;
        overlayRef.current.height = videoRef.current.clientHeight;
        drawBoundaries(boundaries);
      }
    };
    videoRef.current.addEventListener('loadedmetadata', sync);
    window.addEventListener('resize', sync);
    sync();
    return () => { window.removeEventListener('resize', sync); };
  }, [videoUrl, boundaries, drawBoundaries]);

  // Redraw when toggling overlay
  useEffect(() => {
    if (analysisResults.length > 0) {
      drawDetectionOverlay(analysisResults[currentResultIndex]);
    } else {
      drawBoundaries(boundaries);
    }
  }, [showBoundaryOverlay]);

  // Navigate frames
  const showFrame = (index: number) => {
    setCurrentResultIndex(index);
    drawDetectionOverlay(analysisResults[index]);
  };

  // Fit check
  const checkFit = () => {
    const car = carDimensions.find(c => c.id === selectedCarId);
    if (!car) { toast.error('Select a car model first'); return; }
    const sLen = parseFloat(slotLength), sWid = parseFloat(slotWidth);
    if (!sLen || !sWid) { toast.error('Enter valid slot dimensions'); return; }
    const fits = car.length_cm <= sLen && car.width_cm <= sWid;
    setFitResult({ fits, vehicleLength: car.length_cm, vehicleWidth: car.width_cm, slotLength: sLen, slotWidth: sWid });
    if (!fits) {
      supabase.from('parking_slots').select('slot_number, slot_length_cm, slot_width_cm')
        .gte('slot_length_cm', car.length_cm).gte('slot_width_cm', car.width_cm)
        .eq('is_available', true).limit(5)
        .then(({ data }) => setAltSlots(data?.map((s: any) => s.slot_number) || []));
    } else { setAltSlots([]); }
  };


  const clearAll = () => {
    setBoundaries([]);
    setAnalysisResults([]);
    if (overlayRef.current) {
      overlayRef.current.getContext('2d')!.clearRect(0, 0, overlayRef.current.width, overlayRef.current.height);
    }
  };

  const currentResult = analysisResults[currentResultIndex];
  const hasViolations = currentResult?.vehicles?.some(v => v.status === 'outside' || v.status === 'crossing');

  const groupedDimensions = carDimensions.reduce((acc, car) => {
    if (!acc[car.category]) acc[car.category] = [];
    acc[car.category].push(car);
    return acc;
  }, {} as Record<string, CarDimension[]>);

  return (
    <AppLayout title="Vehicle Detection">
      <div className="max-w-7xl mx-auto space-y-6">
        <div>
          <p className="text-muted-foreground">
            AI-powered vehicle detection with boundary analysis and parking validation
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left: Video + Detection */}
          <div className="lg:col-span-2 space-y-4">

            {/* Video Upload */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Video className="w-4 h-4" /> Video Upload
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {!videoUrl ? (
                  <div className="space-y-3">
                    <label className="flex flex-col items-center justify-center h-56 border-2 border-dashed border-border rounded-xl cursor-pointer hover:border-primary/50 hover:bg-accent/30 transition-colors">
                      <Upload className="w-10 h-10 text-muted-foreground mb-3" />
                      <p className="text-sm font-medium">Upload parking video</p>
                      <p className="text-xs text-muted-foreground mt-1">MP4, AVI, MOV accepted</p>
                      <input type="file" accept="video/mp4,video/avi,video/quicktime,video/webm,.mp4,.avi,.mov" className="hidden" onChange={handleVideoUpload} />
                    </label>
                    {isUploading && (
                      <div className="space-y-2">
                        <div className="flex justify-between text-xs text-muted-foreground">
                          <span>Uploading...</span>
                          <span>{Math.round(uploadProgress)}%</span>
                        </div>
                        <Progress value={uploadProgress} className="h-2" />
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="relative rounded-lg overflow-hidden bg-black">
                      <video ref={videoRef} src={videoUrl} controls className="w-full max-h-[420px] object-contain" />
                      <canvas
                        ref={overlayRef}
                        className={cn('absolute top-0 left-0 w-full h-full', drawMode ? 'cursor-crosshair' : 'pointer-events-none')}
                        onMouseDown={startDraw} onMouseMove={moveDraw} onMouseUp={endDraw}
                      />
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button variant={drawMode ? 'default' : 'outline'} size="sm" onClick={() => setDrawMode(!drawMode)}>
                        <Square className="w-4 h-4 mr-1" />
                        {drawMode ? 'Drawing...' : 'Draw Boundary'}
                      </Button>
                      <Button variant="outline" size="sm" onClick={autoDetectBoundary} disabled={isDetecting}>
                        <Sparkles className="w-4 h-4 mr-1" />
                        AI Auto-Detect Boundary
                      </Button>
                      <Button variant="outline" size="sm" onClick={clearAll}>
                        <RotateCcw className="w-4 h-4 mr-1" /> Clear
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => { setVideoFile(null); setVideoUrl(''); clearAll(); }}>
                        Change Video
                      </Button>
                      {boundaries.length > 0 && (
                        <Badge variant="secondary" className="flex items-center gap-1">
                          <CheckCircle className="w-3 h-3" />
                          {boundaries.length} Boundary(s) Set
                        </Badge>
                      )}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* AI Detection */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Cpu className="w-4 h-4" /> AI Vehicle Detection
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-wrap items-center gap-4">
                  <div className="flex items-center gap-2">
                    <Switch checked={frameByFrame} onCheckedChange={setFrameByFrame} id="fbf" />
                    <Label htmlFor="fbf" className="text-sm">Frame-by-frame</Label>
                  </div>
                  {frameByFrame && (
                    <div className="flex items-center gap-2">
                      <Label className="text-xs">Frames:</Label>
                      <Input type="number" min={2} max={10} value={frameCount} onChange={e => setFrameCount(parseInt(e.target.value) || 3)} className="w-16 h-8 text-sm" />
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <Switch checked={showBoundaryOverlay} onCheckedChange={setShowBoundaryOverlay} id="sbo" />
                    <Label htmlFor="sbo" className="text-sm flex items-center gap-1">
                      {showBoundaryOverlay ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                      Show Overlay
                    </Label>
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button onClick={runAIDetection} disabled={!videoFile || isDetecting} className="flex-1">
                    {isDetecting ? (
                      <><div className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin mr-2" /> Analyzing...</>
                    ) : (
                      <><Crosshair className="w-4 h-4 mr-2" /> Analyze Video</>
                    )}
                  </Button>
                  {analysisResults.length > 0 && (
                    <Button variant="outline" onClick={runAIDetection} disabled={isDetecting}>
                      <RefreshCw className="w-4 h-4" />
                    </Button>
                  )}
                </div>

                {/* Frame navigation */}
                {analysisResults.length > 1 && (
                  <div className="flex items-center gap-2">
                    <Layers className="w-4 h-4 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">Frames:</span>
                    {analysisResults.map((_, i) => (
                      <Button key={i} size="sm" variant={i === currentResultIndex ? 'default' : 'outline'}
                        className="h-7 w-7 p-0 text-xs" onClick={() => showFrame(i)}>
                        {i + 1}
                      </Button>
                    ))}
                  </div>
                )}

                {/* Results */}
                {currentResult && (
                  <div className="space-y-3">
                    {/* Scene description */}
                    <div className="rounded-lg border bg-muted/30 p-3">
                      <p className="text-sm text-muted-foreground">{currentResult.scene_description}</p>
                      <p className="text-xs text-muted-foreground mt-1">Vehicles detected: {currentResult.total_vehicles}</p>
                    </div>

                    {/* Vehicle cards */}
                    {currentResult.vehicles?.map((v, i) => (
                      <div key={i} className={cn('rounded-lg border p-3 space-y-1',
                        v.status === 'inside' ? 'border-green-500/30 bg-green-500/5' :
                        v.status === 'crossing' ? 'border-yellow-500/30 bg-yellow-500/5' :
                        'border-destructive/30 bg-destructive/5'
                      )}>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            {v.status === 'inside' ? <CheckCircle className="w-4 h-4 text-green-600" /> :
                             v.status === 'crossing' ? <AlertTriangle className="w-4 h-4 text-yellow-600" /> :
                             <XCircle className="w-4 h-4 text-destructive" />}
                            <span className="font-medium text-sm capitalize">{v.type}</span>
                            {v.model_guess !== 'unknown' && (
                              <Badge variant="outline" className="text-xs">{v.model_guess}</Badge>
                            )}
                          </div>
                          <Badge variant={v.status === 'inside' ? 'default' : 'destructive'} className="text-xs">
                            {v.status === 'inside' ? 'Inside Boundary ✅' :
                             v.status === 'crossing' ? 'Crossing ⚠️' : 'Outside Boundary ❌'}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-4 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Activity className="w-3 h-3" />
                            Confidence: {(v.confidence * 100).toFixed(0)}%
                          </span>
                          <span>{v.status_description}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Right sidebar */}
          <div className="space-y-4">
            {/* Status Panel */}
            {currentResult && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Activity className="w-4 h-4" /> Detection Status
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="text-center p-3 rounded-lg bg-muted/50">
                      <p className="text-2xl font-bold">{currentResult.total_vehicles}</p>
                      <p className="text-xs text-muted-foreground">Vehicles</p>
                    </div>
                    <div className={cn('text-center p-3 rounded-lg', hasViolations ? 'bg-destructive/10' : 'bg-green-500/10')}>
                      <p className="text-2xl font-bold">{hasViolations ? '⚠️' : '✅'}</p>
                      <p className="text-xs text-muted-foreground">{hasViolations ? 'Violations' : 'All Clear'}</p>
                    </div>
                  </div>
                  {currentResult.vehicles?.map((v, i) => (
                    <div key={i} className="flex justify-between text-sm">
                      <span className="capitalize">{v.type}</span>
                      <span className="text-muted-foreground">{(v.confidence * 100).toFixed(0)}%</span>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {/* Space Validation */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Ruler className="w-4 h-4" /> Space Validation
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Car Model</Label>
                  <Select value={selectedCarId} onValueChange={setSelectedCarId}>
                    <SelectTrigger><SelectValue placeholder="Select car model" /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(groupedDimensions).map(([cat, cars]) => (
                        <div key={cat}>
                          <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground uppercase">{cat}</div>
                          {cars.map(car => (
                            <SelectItem key={car.id} value={car.id}>
                              {car.make} {car.model} ({car.length_cm}×{car.width_cm}cm)
                            </SelectItem>
                          ))}
                        </div>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Slot Length (cm)</Label>
                    <Input type="number" value={slotLength} onChange={e => setSlotLength(e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Slot Width (cm)</Label>
                    <Input type="number" value={slotWidth} onChange={e => setSlotWidth(e.target.value)} />
                  </div>
                </div>
                <Button onClick={checkFit} className="w-full" variant="outline">
                  <Ruler className="w-4 h-4 mr-2" /> Check Fit
                </Button>
                {fitResult && (
                  <div className={cn('rounded-lg border p-3 space-y-1', fitResult.fits ? 'border-green-500/30 bg-green-500/5' : 'border-destructive/30 bg-destructive/5')}>
                    <div className="flex items-center gap-2">
                      {fitResult.fits ? <CheckCircle className="w-4 h-4 text-green-600" /> : <XCircle className="w-4 h-4 text-destructive" />}
                      <span className="text-sm font-semibold">{fitResult.fits ? 'Vehicle Fits!' : 'Does NOT Fit'}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Vehicle: {fitResult.vehicleLength}×{fitResult.vehicleWidth}cm<br />
                      Slot: {fitResult.slotLength}×{fitResult.slotWidth}cm
                    </p>
                  </div>
                )}
                {altSlots.length > 0 && (
                  <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 space-y-2">
                    <div className="flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-primary" />
                      <span className="text-sm font-semibold">Alternative Slots</span>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {altSlots.map(slot => <Badge key={slot} variant="secondary" className="text-xs">{slot}</Badge>)}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

          </div>
        </div>
      </div>
    </AppLayout>
  );
};

export default VehicleDetection;
