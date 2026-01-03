import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import AppLayout from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { CalendarIcon, Car, MapPin, Clock, CheckCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

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

const Booking = () => {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const preselectedZone = searchParams.get('zone');

  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [zones, setZones] = useState<ParkingZone[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [bookingSuccess, setBookingSuccess] = useState(false);
  const [bookingCode, setBookingCode] = useState('');

  const [selectedVehicle, setSelectedVehicle] = useState('');
  const [selectedZone, setSelectedZone] = useState(preselectedZone || '');
  const [selectedDate, setSelectedDate] = useState<Date>();
  const [selectedTime, setSelectedTime] = useState('');
  const [duration, setDuration] = useState('1');

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

  const generateBookingCode = () => {
    const date = format(new Date(), 'yyyyMMdd');
    const random = Math.random().toString(36).substring(2, 8).toUpperCase();
    return `VIT${date}-${random}`;
  };

  const handleBooking = async () => {
    if (!user || !selectedVehicle || !selectedZone || !selectedDate || !selectedTime) {
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

    const startTime = new Date(selectedDate);
    const [hours, minutes] = selectedTime.split(':');
    startTime.setHours(parseInt(hours), parseInt(minutes), 0, 0);

    const endTime = new Date(startTime);
    endTime.setHours(endTime.getHours() + parseInt(duration));

    const code = generateBookingCode();

    // For now, we'll create a simple slot reference (in production, you'd select an actual available slot)
    const { data: slotData } = await supabase
      .from('parking_slots')
      .select('id')
      .eq('zone_id', zone.id)
      .eq('is_available', true)
      .limit(1)
      .maybeSingle();

    // If no slots exist, create one temporarily
    let slotId = slotData?.id;
    if (!slotId) {
      const { data: newSlot } = await supabase
        .from('parking_slots')
        .insert({
          zone_id: zone.id,
          slot_number: `${zone.code}-001`,
          slot_type: vehicles.find(v => v.id === selectedVehicle)?.vehicle_type || 'car',
        })
        .select('id')
        .single();
      slotId = newSlot?.id;
    }

    if (!slotId) {
      toast.error('No parking slots available');
      setIsSubmitting(false);
      return;
    }

    const { error } = await supabase
      .from('bookings')
      .insert({
        user_id: user.id,
        vehicle_id: selectedVehicle,
        zone_id: zone.id,
        slot_id: slotId,
        booking_date: format(selectedDate, 'yyyy-MM-dd'),
        start_time: startTime.toISOString(),
        end_time: endTime.toISOString(),
        booking_code: code,
        status: 'confirmed',
      });

    if (error) {
      console.error('Booking error:', error);
      toast.error('Failed to create booking');
    } else {
      setBookingCode(code);
      setBookingSuccess(true);
      toast.success('Booking confirmed!');
    }

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
            <CardContent className="py-6">
              <p className="text-sm text-muted-foreground mb-2">Booking Code</p>
              <p className="text-2xl font-mono font-bold text-primary">{bookingCode}</p>
            </CardContent>
          </Card>
          <Button onClick={() => setBookingSuccess(false)} className="w-full">
            Book Another Slot
          </Button>
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
                  <Select value={selectedVehicle} onValueChange={setSelectedVehicle}>
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
                  <Select value={selectedZone} onValueChange={setSelectedZone}>
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
                        <SelectItem value="4">4 hours</SelectItem>
                        <SelectItem value="8">8 hours</SelectItem>
                        <SelectItem value="12">12 hours</SelectItem>
                        <SelectItem value="24">Full day</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <Button
                  onClick={handleBooking}
                  className="w-full h-12 gradient-vit"
                  disabled={isSubmitting || !selectedVehicle || !selectedZone || !selectedDate || !selectedTime}
                >
                  {isSubmitting ? 'Processing...' : 'Confirm Booking'}
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