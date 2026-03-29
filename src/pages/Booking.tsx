import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import AppLayout from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { CalendarIcon, Car, MapPin, Clock, CheckCircle, Gift, AlertTriangle, IndianRupee } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  calculateBookingPrice,
  checkFreeDayEligibility,
  markFreeDayUsed,
  formatCurrency,
  PRICING_INFO,
  PricingBreakdown,
} from '@/utils/pricingCalculator';

type VehicleType = 'car' | 'motorcycle' | 'scooter' | 'bicycle';

interface Vehicle {
  id: string;
  vehicle_type: VehicleType;
  registration_number: string;
  make: string | null;
  model: string | null;
}

interface ParkingZone {
  id: string;
  name: string;
  code: string;
  total_car_slots: number;
  total_bike_slots: number;
}

interface ParkingSlot {
  id: string;
  slot_number: string;
  slot_type: VehicleType;
  is_available: boolean | null;
  is_reserved: boolean | null;
}

const getRequiredSlotType = (vehicleType: VehicleType): 'car' | 'motorcycle' =>
  vehicleType === 'car' ? 'car' : 'motorcycle';

const buildBookingDateTime = (date: Date, time: string) => {
  const bookingDateTime = new Date(date);
  const [hours, minutes] = time.split(':');
  bookingDateTime.setHours(parseInt(hours), parseInt(minutes), 0, 0);
  return bookingDateTime;
};

const Booking = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const preselectedZone = searchParams.get('zone');
  const preselectedSlot = searchParams.get('slot');

  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [zones, setZones] = useState<ParkingZone[]>([]);
  const [availableSlots, setAvailableSlots] = useState<ParkingSlot[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSlotsLoading, setIsSlotsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [bookingSuccess, setBookingSuccess] = useState(false);
  const [bookingCode, setBookingCode] = useState('');

  const [selectedVehicle, setSelectedVehicle] = useState('');
  const [selectedZone, setSelectedZone] = useState(preselectedZone || '');
  const [selectedSlot, setSelectedSlot] = useState(preselectedSlot || '');
  const [selectedDate, setSelectedDate] = useState<Date>();
  const [selectedTime, setSelectedTime] = useState('');
  const [duration, setDuration] = useState('1');

  // Pricing state
  const [freeDayEligible, setFreeDayEligible] = useState(false);
  const [freeDayUsed, setFreeDayUsed] = useState(false);
  const [useFreeDayBenefit, setUseFreeDayBenefit] = useState(false);
  const [pricingBreakdown, setPricingBreakdown] = useState<PricingBreakdown | null>(null);
  const [finalAmount, setFinalAmount] = useState(0);

  useEffect(() => {
    const fetchData = async () => {
      if (!user) return;

      const [vehiclesRes, zonesRes] = await Promise.all([
        supabase.from('vehicles').select('*').eq('user_id', user.id),
        supabase.from('parking_zones').select('*').eq('is_active', true),
      ]);

      if (vehiclesRes.data) setVehicles(vehiclesRes.data);
      if (zonesRes.data) setZones(zonesRes.data);
      setIsLoading(false);
    };

    fetchData();
  }, [user]);

  useEffect(() => {
    const fetchAvailableSlots = async () => {
      if (!selectedZone || !selectedVehicle || !selectedDate || !selectedTime) {
        setAvailableSlots([]);
        return;
      }

      const zone = zones.find((item) => item.code === selectedZone);
      const vehicle = vehicles.find((item) => item.id === selectedVehicle);

      if (!zone || !vehicle) {
        setAvailableSlots([]);
        return;
      }

      setIsSlotsLoading(true);

      const startTime = buildBookingDateTime(selectedDate, selectedTime);
      const endTime = new Date(startTime);
      endTime.setHours(endTime.getHours() + parseInt(duration));

      const requiredSlotType = getRequiredSlotType(vehicle.vehicle_type);

      const [slotsResponse, bookingsResponse] = await Promise.all([
        supabase
          .from('parking_slots')
          .select('id, slot_number, slot_type, is_available, is_reserved')
          .eq('zone_id', zone.id)
          .eq('slot_type', requiredSlotType)
          .order('slot_number'),
        supabase
          .from('bookings')
          .select('slot_id, start_time, end_time, status')
          .eq('zone_id', zone.id)
          .in('status', ['pending', 'confirmed', 'active'])
          .gte('booking_date', format(selectedDate, 'yyyy-MM-dd'))
          .lte('booking_date', format(selectedDate, 'yyyy-MM-dd')),
      ]);

      if (slotsResponse.error) {
        toast.error('Failed to load slots');
        setAvailableSlots([]);
        setIsSlotsLoading(false);
        return;
      }

      const blockedSlotIds = new Set(
        (bookingsResponse.data || [])
          .filter((booking) => {
            const bookingStart = new Date(booking.start_time);
            const bookingEnd = booking.end_time ? new Date(booking.end_time) : bookingStart;
            return bookingStart < endTime && bookingEnd > startTime;
          })
          .map((booking) => booking.slot_id)
      );

      const nextSlots = (slotsResponse.data || []).filter(
        (slot) => !blockedSlotIds.has(slot.id)
      );

      setAvailableSlots(nextSlots);
      if (selectedSlot && !nextSlots.some((slot) => slot.id === selectedSlot)) {
        setSelectedSlot('');
      }
      setIsSlotsLoading(false);
    };

    fetchAvailableSlots();
  }, [duration, selectedDate, selectedSlot, selectedTime, selectedVehicle, selectedZone, vehicles, zones]);

  // Check free day eligibility when vehicle or date changes
  useEffect(() => {
    const checkEligibility = async () => {
      if (!selectedVehicle || !selectedDate || !user) {
        setFreeDayEligible(false);
        setFreeDayUsed(false);
        return;
      }

      const { eligible, used } = await checkFreeDayEligibility(
        selectedVehicle,
        user.id,
        selectedDate
      );

      setFreeDayEligible(eligible && !used);
      setFreeDayUsed(used);
      
      // Reset use free day if not eligible
      if (!eligible || used) {
        setUseFreeDayBenefit(false);
      }
    };

    checkEligibility();
  }, [selectedVehicle, selectedDate, user]);

  // Calculate pricing when duration or free day option changes
  useEffect(() => {
    const durationHours = parseInt(duration);
    const breakdown = calculateBookingPrice(durationHours, useFreeDayBenefit);
    setPricingBreakdown(breakdown);
    setFinalAmount(breakdown.totalAmount);
  }, [duration, useFreeDayBenefit]);

  const generateBookingCode = () => {
    const date = format(new Date(), 'yyyyMMdd');
    const random = Math.random().toString(36).substring(2, 8).toUpperCase();
    return `VIT${date}-${random}`;
  };

  const handleBooking = async () => {
    if (!user || !selectedVehicle || !selectedZone || !selectedSlot || !selectedDate || !selectedTime) {
      toast.error('Please fill in all required fields');
      return;
    }

    setIsSubmitting(true);

    const zone = zones.find(z => z.code === selectedZone);
    if (!zone) {
      toast.error('Invalid zone selected');
      setIsSubmitting(false);
      return;
    }

    const startTime = buildBookingDateTime(selectedDate, selectedTime);

    const endTime = new Date(startTime);
    endTime.setHours(endTime.getHours() + parseInt(duration));

    const code = generateBookingCode();

    const slotExists = availableSlots.some((slot) => slot.id === selectedSlot);
    if (!slotExists) {
      toast.error('No parking slots available');
      setIsSubmitting(false);
      return;
    }

    // Create booking
    const { data: bookingData, error } = await supabase
      .from('bookings')
      .insert({
        user_id: user.id,
        vehicle_id: selectedVehicle,
        zone_id: zone.id,
        slot_id: selectedSlot,
        booking_date: format(selectedDate, 'yyyy-MM-dd'),
        start_time: startTime.toISOString(),
        end_time: endTime.toISOString(),
        booking_code: code,
        status: 'confirmed',
      })
      .select('id')
      .single();

    if (error) {
      console.error('Booking error:', error);
      toast.error(error.message || 'Failed to create booking');
      setIsSubmitting(false);
      return;
    }

    // Mark free day as used if applicable
    if (useFreeDayBenefit && freeDayEligible && bookingData) {
      await markFreeDayUsed(selectedVehicle, user.id, selectedDate, bookingData.id);
    }

    // Create payment record if amount > 0 (auto-completed)
    if (finalAmount > 0 && bookingData) {
      await supabase.from('payments').insert({
        user_id: user.id,
        booking_id: bookingData.id,
        amount: finalAmount,
        total_amount: finalAmount,
        status: 'completed',
        payment_method: 'direct',
        paid_at: new Date().toISOString(),
      });
    }

    setBookingCode(code);
    setBookingSuccess(true);
    toast.success('Booking confirmed!');
    setIsSubmitting(false);
  };

  if (bookingSuccess) {
    return (
      <AppLayout title="Booking Confirmed">
        <div className="max-w-md mx-auto text-center py-12">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle className="w-10 h-10 text-green-600" />
          </div>
          <h2 className="text-2xl font-display font-bold text-foreground mb-2">
            Booking Confirmed!
          </h2>
          <p className="text-muted-foreground mb-6">
            Your parking slot has been reserved successfully.
          </p>
          <Card className="mb-6">
            <CardContent className="py-6 space-y-4">
              <div>
                <p className="text-sm text-muted-foreground mb-2">Booking Code</p>
                <p className="text-2xl font-mono font-bold text-primary">{bookingCode}</p>
              </div>
              <div className="border-t pt-4">
                <p className="text-sm text-muted-foreground mb-1">Amount Due</p>
                <p className="text-xl font-bold">
                  {finalAmount === 0 ? (
                    <span className="text-green-600">FREE</span>
                  ) : (
                    formatCurrency(finalAmount)
                  )}
                </p>
                {useFreeDayBenefit && (
                  <p className="text-xs text-green-600 mt-1">
                    Weekly free day benefit applied!
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
          <Button onClick={() => setBookingSuccess(false)} className="w-full">
            Book Another Slot
          </Button>
          {finalAmount > 0 && (
            <Button variant="outline" onClick={() => navigate('/payments')} className="w-full mt-3">
              Go to Payments
            </Button>
          )}
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout title="Book Parking">
      <div className="max-w-2xl mx-auto">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Car className="w-5 h-5" />
              New Parking Reservation
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {isLoading ? (
              <div className="flex items-center justify-center h-48">
                <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
              </div>
            ) : vehicles.length === 0 ? (
              <div className="text-center py-8">
                <Car className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground mb-4">
                  You need to add a vehicle first before booking.
                </p>
                <Button onClick={() => window.location.href = '/vehicles'}>
                  Add Vehicle
                </Button>
              </div>
            ) : (
              <>
                {/* Vehicle Selection */}
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Car className="w-4 h-4" />
                    Select Vehicle
                  </Label>
                  <Select value={selectedVehicle} onValueChange={(value) => {
                    setSelectedVehicle(value);
                    setSelectedSlot('');
                  }}>
                    <SelectTrigger>
                      <SelectValue placeholder="Choose your vehicle" />
                    </SelectTrigger>
                    <SelectContent>
                      {vehicles.map((vehicle) => (
                        <SelectItem key={vehicle.id} value={vehicle.id}>
                          {vehicle.registration_number} - {vehicle.make} {vehicle.model}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Zone Selection */}
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <MapPin className="w-4 h-4" />
                    Parking Zone
                  </Label>
                  <Select value={selectedZone} onValueChange={(value) => {
                    setSelectedZone(value);
                    setSelectedSlot('');
                  }}>
                    <SelectTrigger>
                      <SelectValue placeholder="Choose parking zone" />
                    </SelectTrigger>
                    <SelectContent>
                      {zones.map((zone) => (
                        <SelectItem key={zone.id} value={zone.code}>
                          {zone.name} ({zone.code})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Slot Selection */}
                <div className="space-y-2">
                  <Label>Select Slot</Label>
                  {!selectedVehicle || !selectedZone || !selectedDate || !selectedTime ? (
                    <div className="rounded-lg border border-border bg-muted/30 p-4 text-sm text-muted-foreground">
                      Choose vehicle, zone, date, and start time to load available slots.
                    </div>
                  ) : isSlotsLoading ? (
                    <div className="flex items-center justify-center h-24 rounded-lg border border-border bg-muted/30">
                      <div className="w-6 h-6 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
                    </div>
                  ) : availableSlots.length === 0 ? (
                    <div className="rounded-lg border border-border bg-muted/30 p-4 text-sm text-muted-foreground">
                      No slots are available for the selected time. Try another slot time or zone.
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                      {availableSlots.map((slot) => (
                        <button
                          key={slot.id}
                          type="button"
                          onClick={() => setSelectedSlot(slot.id)}
                          className={cn(
                            'rounded-lg border px-3 py-3 text-sm font-medium transition-all',
                            selectedSlot === slot.id
                              ? 'border-primary bg-primary text-primary-foreground'
                              : 'border-border bg-card text-card-foreground hover:border-primary/40 hover:bg-accent'
                          )}
                        >
                          {slot.slot_number}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Date Selection */}
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <CalendarIcon className="w-4 h-4" />
                    Date
                  </Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !selectedDate && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {selectedDate ? format(selectedDate, "PPP") : "Pick a date"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={selectedDate}
                        onSelect={setSelectedDate}
                        disabled={(date) => date < new Date()}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                {/* Time Selection */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="flex items-center gap-2">
                      <Clock className="w-4 h-4" />
                      Start Time
                    </Label>
                    <Select value={selectedTime} onValueChange={setSelectedTime}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select time" />
                      </SelectTrigger>
                      <SelectContent>
                        {Array.from({ length: 24 }, (_, i) => {
                          const hour = i.toString().padStart(2, '0');
                          return (
                            <SelectItem key={hour} value={`${hour}:00`}>
                              {hour}:00
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Duration</Label>
                    <Select value={duration} onValueChange={setDuration}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1">1 hour</SelectItem>
                        <SelectItem value="2">2 hours</SelectItem>
                        <SelectItem value="3">3 hours</SelectItem>
                        <SelectItem value="4">4 hours</SelectItem>
                        <SelectItem value="5">5 hours</SelectItem>
                        <SelectItem value="6">6 hours</SelectItem>
                        <SelectItem value="8">8 hours</SelectItem>
                        <SelectItem value="10">10 hours</SelectItem>
                        <SelectItem value="12">12 hours</SelectItem>
                        <SelectItem value="24">Full day</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Free Day Benefit */}
                {selectedVehicle && selectedDate && (
                  <div className="p-4 bg-muted/50 rounded-lg space-y-3">
                    {freeDayEligible && !freeDayUsed ? (
                      <div className="flex items-start gap-3">
                        <Checkbox
                          id="useFreeDayBenefit"
                          checked={useFreeDayBenefit}
                          onCheckedChange={(checked) => setUseFreeDayBenefit(checked === true)}
                        />
                        <div className="space-y-1">
                          <label
                            htmlFor="useFreeDayBenefit"
                            className="text-sm font-medium flex items-center gap-2 cursor-pointer"
                          >
                            <Gift className="w-4 h-4 text-green-600" />
                            Use Weekly Free Day Benefit
                          </label>
                          <p className="text-xs text-muted-foreground">
                            You have not used your free day this week. Check to apply.
                          </p>
                        </div>
                      </div>
                    ) : freeDayUsed ? (
                      <div className="flex items-center gap-2 text-yellow-600">
                        <AlertTriangle className="w-4 h-4" />
                        <p className="text-sm">
                          Weekly free day already used for this vehicle.
                        </p>
                      </div>
                    ) : null}
                  </div>
                )}

                {/* Pricing Breakdown */}
                {pricingBreakdown && (
                  <Card className="bg-muted/30">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base flex items-center gap-2">
                        <IndianRupee className="w-4 h-4" />
                        Pricing Breakdown
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span>Duration</span>
                        <span className="font-medium">{pricingBreakdown.totalHours} hour(s)</span>
                      </div>
                      <div className="flex justify-between text-green-600">
                        <span>Free Hours</span>
                        <span className="font-medium">
                          {useFreeDayBenefit ? 'Full Day Free' : `${PRICING_INFO.FREE_HOURS_PER_DAY} hours`}
                        </span>
                      </div>
                      {!useFreeDayBenefit && pricingBreakdown.chargeableHours > 0 && (
                        <div className="flex justify-between">
                          <span>Chargeable ({pricingBreakdown.chargeableHours} hrs × ₹{PRICING_INFO.HOURLY_RATE})</span>
                          <span className="font-medium">{formatCurrency(pricingBreakdown.baseCharge)}</span>
                        </div>
                      )}
                      <div className="border-t pt-2 flex justify-between font-semibold text-base">
                        <span>Total Amount</span>
                        <span className={finalAmount === 0 ? 'text-green-600' : ''}>
                          {finalAmount === 0 ? 'FREE' : formatCurrency(finalAmount)}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-2">
                        Note: Overstay penalty is ₹{PRICING_INFO.PENALTY_RATE}/hour if you exceed your booked time.
                      </p>
                    </CardContent>
                  </Card>
                )}

                <Button
                  onClick={handleBooking}
                  className="w-full h-12 gradient-vit"
                  disabled={isSubmitting || !selectedVehicle || !selectedZone || !selectedSlot || !selectedDate || !selectedTime}
                >
                  {isSubmitting ? 'Processing...' : `Confirm Booking${finalAmount > 0 ? ` - ${formatCurrency(finalAmount)}` : ' - FREE'}`}
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
};

export default Booking;
