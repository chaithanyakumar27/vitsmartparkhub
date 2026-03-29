import { useState, useRef, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import AppLayout from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  Video,
  Upload,
  Square,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Cpu,
  Ruler,
  MapPin,
  Send,
  RotateCcw,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface CarDimension {
  id: string;
  category: string;
  make: string | null;
  model: string | null;
  length_cm: number;
  width_cm: number;
  height_cm: number | null;
}

interface BoundaryRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface DetectionResult {
  vehicleDetected: boolean;
  insideBoundary: boolean;
  confidence: number;
  boundingBox?: { x: number; y: number; w: number; h: number };
}

interface FitResult {
  fits: boolean;
  vehicleLength: number;
  vehicleWidth: number;
  slotLength: number;
  slotWidth: number;
}

const VehicleDetection = () => {
  const { user } = useAuth();

  // Video upload
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoUrl, setVideoUrl] = useState<string>('');
  const videoRef = useRef<HTMLVideoElement>(null);

  // Boundary drawing
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [drawStart, setDrawStart] = useState<{ x: number; y: number } | null>(null);
  const [boundary, setBoundary] = useState<BoundaryRect | null>(null);
  const [drawMode, setDrawMode] = useState(false);

  // Car dimensions
  const [carDimensions, setCarDimensions] = useState<CarDimension[]>([]);
  const [selectedCarId, setSelectedCarId] = useState('');
  const [fitResult, setFitResult] = useState<FitResult | null>(null);

  // Slot dimensions (in cm)
  const [slotLength, setSlotLength] = useState('500');
  const [slotWidth, setSlotWidth] = useState('250');

  // Detection
  const [mlApiUrl, setMlApiUrl] = useState('');
  const [isDetecting, setIsDetecting] = useState(false);
  const [detectionResult, setDetectionResult] = useState<DetectionResult | null>(null);

  // SMS
  const [ownerPhone, setOwnerPhone] = useState('');
  const [isSendingSms, setIsSendingSms] = useState(false);

  // Alternative slots
  const [altSlots, setAltSlots] = useState<string[]>([]);

  // Fetch car dimensions
  useEffect(() => {
    const fetchDimensions = async () => {
      const { data } = await supabase
        .from('car_dimensions')
        .select('*')
        .order('category, make, model');
      if (data) setCarDimensions(data as unknown as CarDimension[]);
    };
    fetchDimensions();
  }, []);

  // Handle video upload
  const handleVideoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('video/')) {
      toast.error('Please upload a video file');
      return;
    }
    setVideoFile(file);
    setVideoUrl(URL.createObjectURL(file));
    setBoundary(null);
    setDetectionResult(null);
    setFitResult(null);
  };

  // Draw boundary on canvas overlay
  const startDraw = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (!drawMode) return;
      const rect = overlayRef.current!.getBoundingClientRect();
      setDrawStart({ x: e.clientX - rect.left, y: e.clientY - rect.top });
      setIsDrawing(true);
    },
    [drawMode]
  );

  const moveDraw = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (!isDrawing || !drawStart || !overlayRef.current) return;
      const rect = overlayRef.current.getBoundingClientRect();
      const ctx = overlayRef.current.getContext('2d')!;
      const currentX = e.clientX - rect.left;
      const currentY = e.clientY - rect.top;

      ctx.clearRect(0, 0, overlayRef.current.width, overlayRef.current.height);
      ctx.strokeStyle = '#22c55e';
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 3]);
      ctx.strokeRect(
        drawStart.x,
        drawStart.y,
        currentX - drawStart.x,
        currentY - drawStart.y
      );
    },
    [isDrawing, drawStart]
  );

  const endDraw = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (!isDrawing || !drawStart || !overlayRef.current) return;
      const rect = overlayRef.current.getBoundingClientRect();
      const endX = e.clientX - rect.left;
      const endY = e.clientY - rect.top;

      const newBoundary: BoundaryRect = {
        x: Math.min(drawStart.x, endX),
        y: Math.min(drawStart.y, endY),
        width: Math.abs(endX - drawStart.x),
        height: Math.abs(endY - drawStart.y),
      };

      if (newBoundary.width > 10 && newBoundary.height > 10) {
        setBoundary(newBoundary);
        // Draw permanent boundary
        const ctx = overlayRef.current.getContext('2d')!;
        ctx.clearRect(0, 0, overlayRef.current.width, overlayRef.current.height);
        ctx.strokeStyle = '#22c55e';
        ctx.lineWidth = 3;
        ctx.setLineDash([]);
        ctx.strokeRect(newBoundary.x, newBoundary.y, newBoundary.width, newBoundary.height);
        ctx.fillStyle = 'rgba(34, 197, 94, 0.1)';
        ctx.fillRect(newBoundary.x, newBoundary.y, newBoundary.width, newBoundary.height);
        ctx.font = '12px sans-serif';
        ctx.fillStyle = '#22c55e';
        ctx.fillText('Parking Boundary', newBoundary.x + 4, newBoundary.y - 4);
        toast.success('Boundary defined!');
      }

      setIsDrawing(false);
      setDrawStart(null);
      setDrawMode(false);
    },
    [isDrawing, drawStart]
  );

  // Sync overlay canvas size to video
  useEffect(() => {
    if (!videoRef.current || !overlayRef.current) return;
    const sync = () => {
      if (videoRef.current && overlayRef.current) {
        overlayRef.current.width = videoRef.current.clientWidth;
        overlayRef.current.height = videoRef.current.clientHeight;
      }
    };
    videoRef.current.addEventListener('loadedmetadata', sync);
    window.addEventListener('resize', sync);
    sync();
    return () => {
      window.removeEventListener('resize', sync);
    };
  }, [videoUrl]);

  // Check if car fits in slot
  const checkFit = () => {
    const car = carDimensions.find((c) => c.id === selectedCarId);
    if (!car) {
      toast.error('Select a car model first');
      return;
    }
    const sLen = parseFloat(slotLength);
    const sWid = parseFloat(slotWidth);
    if (!sLen || !sWid) {
      toast.error('Enter valid slot dimensions');
      return;
    }
    const fits = car.length_cm <= sLen && car.width_cm <= sWid;
    const result: FitResult = {
      fits,
      vehicleLength: car.length_cm,
      vehicleWidth: car.width_cm,
      slotLength: sLen,
      slotWidth: sWid,
    };
    setFitResult(result);

    if (!fits) {
      // Find alternative slots that fit
      findAlternativeSlots(car.length_cm, car.width_cm);
    } else {
      setAltSlots([]);
    }
  };

  const findAlternativeSlots = async (carLength: number, carWidth: number) => {
    const { data } = await supabase
      .from('parking_slots')
      .select('slot_number, slot_length_cm, slot_width_cm')
      .gte('slot_length_cm', carLength)
      .gte('slot_width_cm', carWidth)
      .eq('is_available', true)
      .limit(5);

    if (data && data.length > 0) {
      setAltSlots(data.map((s: any) => s.slot_number));
    } else {
      setAltSlots([]);
    }
  };

  // Run detection via external ML API
  const runDetection = async () => {
    if (!mlApiUrl) {
      toast.error('Enter your ML API endpoint URL');
      return;
    }
    if (!videoFile) {
      toast.error('Upload a video first');
      return;
    }

    setIsDetecting(true);
    try {
      const formData = new FormData();
      formData.append('video', videoFile);
      if (boundary) {
        formData.append('boundary', JSON.stringify(boundary));
      }

      const response = await fetch(mlApiUrl, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) throw new Error(`API returned ${response.status}`);

      const result = await response.json();
      const detection: DetectionResult = {
        vehicleDetected: result.vehicle_detected ?? true,
        insideBoundary: result.inside_boundary ?? false,
        confidence: result.confidence ?? 0.85,
        boundingBox: result.bounding_box,
      };

      setDetectionResult(detection);

      // Draw detection bounding box
      if (detection.boundingBox && overlayRef.current) {
        const ctx = overlayRef.current.getContext('2d')!;
        const bb = detection.boundingBox;
        ctx.strokeStyle = detection.insideBoundary ? '#22c55e' : '#ef4444';
        ctx.lineWidth = 2;
        ctx.setLineDash([]);
        ctx.strokeRect(bb.x, bb.y, bb.w, bb.h);
        ctx.font = 'bold 14px sans-serif';
        ctx.fillStyle = detection.insideBoundary ? '#22c55e' : '#ef4444';
        ctx.fillText(
          detection.insideBoundary ? '✓ Inside' : '✗ Outside',
          bb.x + 4,
          bb.y - 6
        );
      }

      if (!detection.insideBoundary && detection.vehicleDetected) {
        toast.error('Vehicle is OUTSIDE the parking boundary!');
      } else if (detection.insideBoundary) {
        toast.success('Vehicle is correctly placed within boundary');
      }
    } catch (err: any) {
      console.error('Detection error:', err);
      toast.error('ML API call failed: ' + err.message);
      // Demo fallback - simulate detection
      const demoResult: DetectionResult = {
        vehicleDetected: true,
        insideBoundary: boundary ? Math.random() > 0.3 : false,
        confidence: 0.87,
        boundingBox: boundary
          ? { x: boundary.x + 10, y: boundary.y + 10, w: boundary.width - 20, h: boundary.height - 20 }
          : undefined,
      };
      setDetectionResult(demoResult);

      if (demoResult.boundingBox && overlayRef.current) {
        const ctx = overlayRef.current.getContext('2d')!;
        const bb = demoResult.boundingBox;
        ctx.strokeStyle = demoResult.insideBoundary ? '#22c55e' : '#ef4444';
        ctx.lineWidth = 2;
        ctx.strokeRect(bb.x, bb.y, bb.w, bb.h);
        ctx.font = 'bold 14px sans-serif';
        ctx.fillStyle = demoResult.insideBoundary ? '#22c55e' : '#ef4444';
        ctx.fillText(
          `Vehicle (${(demoResult.confidence * 100).toFixed(0)}%)`,
          bb.x + 4,
          bb.y - 6
        );
      }

      toast.info('Using demo detection (ML API unreachable)');
    } finally {
      setIsDetecting(false);
    }
  };

  // Send SMS alert
  const sendSmsAlert = async () => {
    if (!ownerPhone) {
      toast.error('Enter owner phone number');
      return;
    }
    setIsSendingSms(true);
    try {
      const message = detectionResult && !detectionResult.insideBoundary
        ? 'Alert: Your vehicle is outside the parking boundary. Please reposition immediately.'
        : fitResult && !fitResult.fits
        ? `Alert: Your vehicle (${fitResult.vehicleLength}x${fitResult.vehicleWidth}cm) does not fit in the assigned slot (${fitResult.slotLength}x${fitResult.slotWidth}cm). Please contact parking management.`
        : 'Parking alert: Please check your vehicle positioning.';

      const { data, error } = await supabase.functions.invoke('send-parking-sms', {
        body: { phone: ownerPhone, message },
      });

      if (error) throw error;
      toast.success('SMS alert sent to ' + ownerPhone);
    } catch (err: any) {
      console.error('SMS error:', err);
      toast.error('Failed to send SMS. Twilio may not be connected.');
    } finally {
      setIsSendingSms(false);
    }
  };

  const clearBoundary = () => {
    setBoundary(null);
    setDetectionResult(null);
    if (overlayRef.current) {
      const ctx = overlayRef.current.getContext('2d')!;
      ctx.clearRect(0, 0, overlayRef.current.width, overlayRef.current.height);
    }
  };

  const groupedDimensions = carDimensions.reduce(
    (acc, car) => {
      if (!acc[car.category]) acc[car.category] = [];
      acc[car.category].push(car);
      return acc;
    },
    {} as Record<string, CarDimension[]>
  );

  return (
    <AppLayout title="Vehicle Detection">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <p className="text-muted-foreground">
            Upload video, define parking boundaries, and validate vehicle positioning
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left: Video + Boundary */}
          <div className="lg:col-span-2 space-y-4">
            {/* Video Upload */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Video className="w-4 h-4" />
                  Video Upload & Boundary
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {!videoUrl ? (
                  <label className="flex flex-col items-center justify-center h-64 border-2 border-dashed border-border rounded-xl cursor-pointer hover:border-primary/50 hover:bg-accent/30 transition-colors">
                    <Upload className="w-10 h-10 text-muted-foreground mb-3" />
                    <p className="text-sm font-medium text-foreground">Upload parking video</p>
                    <p className="text-xs text-muted-foreground mt-1">MP4, WebM, AVI supported</p>
                    <input
                      type="file"
                      accept="video/*"
                      className="hidden"
                      onChange={handleVideoUpload}
                    />
                  </label>
                ) : (
                  <div className="space-y-3">
                    <div className="relative rounded-lg overflow-hidden bg-black">
                      <video
                        ref={videoRef}
                        src={videoUrl}
                        controls
                        className="w-full max-h-[400px] object-contain"
                      />
                      <canvas
                        ref={overlayRef}
                        className={cn(
                          'absolute top-0 left-0 w-full h-full',
                          drawMode ? 'cursor-crosshair' : 'pointer-events-none'
                        )}
                        onMouseDown={startDraw}
                        onMouseMove={moveDraw}
                        onMouseUp={endDraw}
                      />
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        variant={drawMode ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setDrawMode(!drawMode)}
                      >
                        <Square className="w-4 h-4 mr-1" />
                        {drawMode ? 'Drawing...' : 'Draw Boundary'}
                      </Button>
                      <Button variant="outline" size="sm" onClick={clearBoundary}>
                        <RotateCcw className="w-4 h-4 mr-1" />
                        Clear
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setVideoFile(null);
                          setVideoUrl('');
                          clearBoundary();
                        }}
                      >
                        Change Video
                      </Button>
                      {boundary && (
                        <Badge variant="secondary" className="flex items-center gap-1">
                          <CheckCircle className="w-3 h-3" />
                          Boundary Set ({Math.round(boundary.width)}×{Math.round(boundary.height)}px)
                        </Badge>
                      )}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* ML API & Detection */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Cpu className="w-4 h-4" />
                  Vehicle Detection (External ML API)
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>ML API Endpoint URL</Label>
                  <Input
                    placeholder="https://your-yolo-api.com/detect"
                    value={mlApiUrl}
                    onChange={(e) => setMlApiUrl(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Your YOLO/OpenCV API should accept POST with video file & boundary JSON, return detection results
                  </p>
                </div>
                <Button
                  onClick={runDetection}
                  disabled={!videoFile || isDetecting}
                  className="w-full"
                >
                  {isDetecting ? (
                    <>
                      <div className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin mr-2" />
                      Detecting...
                    </>
                  ) : (
                    <>
                      <Cpu className="w-4 h-4 mr-2" />
                      Run Detection
                    </>
                  )}
                </Button>

                {/* Detection Result */}
                {detectionResult && (
                  <div
                    className={cn(
                      'rounded-lg border p-4 space-y-2',
                      detectionResult.insideBoundary
                        ? 'border-green-500/30 bg-green-500/5'
                        : 'border-destructive/30 bg-destructive/5'
                    )}
                  >
                    <div className="flex items-center gap-2">
                      {detectionResult.insideBoundary ? (
                        <CheckCircle className="w-5 h-5 text-green-600" />
                      ) : (
                        <XCircle className="w-5 h-5 text-destructive" />
                      )}
                      <span className="font-semibold">
                        {detectionResult.vehicleDetected
                          ? detectionResult.insideBoundary
                            ? 'Vehicle Correctly Positioned'
                            : 'Vehicle OUTSIDE Boundary!'
                          : 'No Vehicle Detected'}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Confidence: {(detectionResult.confidence * 100).toFixed(1)}%
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Right: Controls */}
          <div className="space-y-4">
            {/* Car Model & Fit Check */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Ruler className="w-4 h-4" />
                  Space Validation
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Car Model</Label>
                  <Select value={selectedCarId} onValueChange={setSelectedCarId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select car model" />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(groupedDimensions).map(([category, cars]) => (
                        <div key={category}>
                          <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground uppercase">
                            {category}
                          </div>
                          {cars.map((car) => (
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
                    <Input
                      type="number"
                      value={slotLength}
                      onChange={(e) => setSlotLength(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Slot Width (cm)</Label>
                    <Input
                      type="number"
                      value={slotWidth}
                      onChange={(e) => setSlotWidth(e.target.value)}
                    />
                  </div>
                </div>

                <Button onClick={checkFit} className="w-full" variant="outline">
                  <Ruler className="w-4 h-4 mr-2" />
                  Check Fit
                </Button>

                {fitResult && (
                  <div
                    className={cn(
                      'rounded-lg border p-3 space-y-1',
                      fitResult.fits
                        ? 'border-green-500/30 bg-green-500/5'
                        : 'border-destructive/30 bg-destructive/5'
                    )}
                  >
                    <div className="flex items-center gap-2">
                      {fitResult.fits ? (
                        <CheckCircle className="w-4 h-4 text-green-600" />
                      ) : (
                        <XCircle className="w-4 h-4 text-destructive" />
                      )}
                      <span className="text-sm font-semibold">
                        {fitResult.fits ? 'Vehicle Fits!' : 'Does NOT Fit'}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Vehicle: {fitResult.vehicleLength}×{fitResult.vehicleWidth}cm
                      <br />
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
                      {altSlots.map((slot) => (
                        <Badge key={slot} variant="secondary" className="text-xs">
                          {slot}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* SMS Alert */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Send className="w-4 h-4" />
                  SMS Alert
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-1">
                  <Label className="text-xs">Owner Phone (E.164)</Label>
                  <Input
                    placeholder="+919876543210"
                    value={ownerPhone}
                    onChange={(e) => setOwnerPhone(e.target.value)}
                  />
                </div>
                <Button
                  onClick={sendSmsAlert}
                  disabled={isSendingSms || (!detectionResult && !fitResult)}
                  variant="destructive"
                  className="w-full"
                  size="sm"
                >
                  {isSendingSms ? 'Sending...' : 'Send Alert SMS'}
                </Button>
                <p className="text-xs text-muted-foreground">
                  Requires Twilio connection. Alert sent when vehicle is outside boundary or doesn't fit.
                </p>
              </CardContent>
            </Card>

            {/* Info */}
            <Card>
              <CardContent className="py-4">
                <div className="space-y-2 text-xs text-muted-foreground">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="w-3 h-3 mt-0.5 text-yellow-500 flex-shrink-0" />
                    <span>
                      For YOLO detection, host your Python API separately and enter the endpoint URL above.
                    </span>
                  </div>
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="w-3 h-3 mt-0.5 text-yellow-500 flex-shrink-0" />
                    <span>
                      Expected API: POST with FormData (video + boundary), returns JSON with vehicle_detected, inside_boundary, confidence, bounding_box.
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </AppLayout>
  );
};

export default VehicleDetection;
