import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import AppLayout from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { 
  MapPin, Car, Bike, Grid3X3, BarChart3, Calendar as CalendarIcon,
  TrendingUp, Users, DollarSign, Clock
} from 'lucide-react';
import { format, subDays, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from 'date-fns';

import technologyTower from '@/assets/technology-tower.png';
import silverJubileeTower from '@/assets/silver-jubilee-tower.png';
import pearlResearchPark from '@/assets/pearl-research-park.png';
import boysHostel from '@/assets/boys-hostel.png';
import mainBuilding from '@/assets/main-building.png';
import smvBlock from '@/assets/smv-block.png';
import gandhiBlock from '@/assets/gandhi-block.png';
import sjtGround from '@/assets/sjt-ground.png';

const zoneImages: Record<string, string> = {
  'TT': technologyTower,
  'SJT': silverJubileeTower,
  'PRP': pearlResearchPark,
  'BH': boysHostel,
  'MB': mainBuilding,
  'SMV': smvBlock,
  'GB': gandhiBlock,
  'SJTG': sjtGround,
};

interface ParkingZone {
  id: string;
  name: string;
  code: string;
  description: string | null;
  total_car_slots: number;
  total_bike_slots: number;
  is_active: boolean;
}

interface ParkingSlot {
  id: string;
  slot_number: string;
  slot_type: string;
  is_available: boolean;
  is_reserved: boolean;
  floor_level: number | null;
}

interface ReportData {
  totalBookings: number;
  activeBookings: number;
  completedBookings: number;
  revenue: number;
  averageOccupancy: number;
}

const ZoneDetails = () => {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const [zone, setZone] = useState<ParkingZone | null>(null);
  const [slots, setSlots] = useState<ParkingSlot[]>([]);
  const [selectedSlotId, setSelectedSlotId] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [bookedSlotIds, setBookedSlotIds] = useState<Set<string>>(new Set());
  const [reportPeriod, setReportPeriod] = useState<'daily' | 'weekly' | 'monthly'>('daily');
  const [reportData, setReportData] = useState<ReportData>({
    totalBookings: 0,
    activeBookings: 0,
    completedBookings: 0,
    revenue: 0,
    averageOccupancy: 0,
  });

  useEffect(() => {
    const fetchZoneData = async () => {
      if (!code) return;

      // Fetch zone details
      const { data: zoneData, error: zoneError } = await supabase
        .from('parking_zones')
        .select('*')
        .eq('code', code)
        .maybeSingle();

      if (zoneError || !zoneData) {
        navigate('/zones');
        return;
      }

      setZone(zoneData);

      // Fetch slots for this zone
      const { data: slotsData } = await supabase
        .from('parking_slots')
        .select('*')
        .eq('zone_id', zoneData.id)
        .order('slot_number');

      if (slotsData) {
        setSlots(slotsData);
      }

      setIsLoading(false);
    };

    fetchZoneData();
  }, [code, navigate]);

  // Fetch bookings for selected date to determine slot availability
  useEffect(() => {
    const fetchBookingsForDate = async () => {
      if (!zone) return;

      const dateStr = format(selectedDate, 'yyyy-MM-dd');
      const { data: bookings } = await supabase
        .from('bookings')
        .select('slot_id')
        .eq('zone_id', zone.id)
        .eq('booking_date', dateStr)
        .in('status', ['pending', 'confirmed', 'active']);

      const ids = new Set((bookings || []).map(b => b.slot_id));
      setBookedSlotIds(ids);
    };

    fetchBookingsForDate();
  }, [zone, selectedDate]);

  useEffect(() => {
    const fetchReportData = async () => {
      if (!zone) return;

      let startDate: Date;
      let endDate = new Date();

      switch (reportPeriod) {
        case 'daily':
          startDate = subDays(endDate, 1);
          break;
        case 'weekly':
          startDate = startOfWeek(endDate, { weekStartsOn: 1 });
          endDate = endOfWeek(endDate, { weekStartsOn: 1 });
          break;
        case 'monthly':
          startDate = startOfMonth(endDate);
          endDate = endOfMonth(endDate);
          break;
      }

      // Fetch bookings for the period
      const { data: bookings } = await supabase
        .from('bookings')
        .select('*, payments(*)')
        .eq('zone_id', zone.id)
        .gte('booking_date', format(startDate, 'yyyy-MM-dd'))
        .lte('booking_date', format(endDate, 'yyyy-MM-dd'));

      if (bookings) {
        const activeBookings = bookings.filter(b => b.status === 'active' || b.status === 'confirmed').length;
        const completedBookings = bookings.filter(b => b.status === 'completed').length;
        const totalRevenue = bookings.reduce((sum, b) => {
          const payments = b.payments as any[];
          return sum + (payments?.reduce((pSum: number, p: any) => pSum + (p.total_amount || 0), 0) || 0);
        }, 0);

        const totalSlots = zone.total_car_slots + zone.total_bike_slots;
        const avgOccupancy = totalSlots > 0 ? (activeBookings / totalSlots) * 100 : 0;

        setReportData({
          totalBookings: bookings.length,
          activeBookings,
          completedBookings,
          revenue: totalRevenue,
          averageOccupancy: Math.round(avgOccupancy),
        });
      }
    };

    fetchReportData();
  }, [zone, reportPeriod]);

  const getSlotColor = (slot: ParkingSlot) => {
    if (bookedSlotIds.has(slot.id)) return 'bg-destructive';
    if (slot.is_reserved) return 'bg-yellow-500';
    if (!slot.is_available) return 'bg-destructive';
    return 'bg-green-500';
  };

  const getSlotStatus = (slot: ParkingSlot) => {
    if (bookedSlotIds.has(slot.id)) return 'Booked';
    if (slot.is_reserved) return 'Reserved';
    if (!slot.is_available) return 'Occupied';
    return 'Free';
  };

  const isSlotSelectable = (slot: ParkingSlot) => slot.is_available && !slot.is_reserved && !bookedSlotIds.has(slot.id);

  // Generate placeholder slots if none exist
  const displaySlots = slots.length > 0 ? slots : Array.from(
    { length: (zone?.total_car_slots || 0) + (zone?.total_bike_slots || 0) || 20 },
    (_, i) => ({
      id: `placeholder-${i}`,
      slot_number: `${zone?.code || 'Z'}-${String(i + 1).padStart(3, '0')}`,
      slot_type: i < (zone?.total_car_slots || 10) ? 'car' : 'motorcycle',
      is_available: true,
      is_reserved: false,
      floor_level: 0,
    })
  );

  const freeSlots = displaySlots.filter(s => s.is_available && !s.is_reserved && !bookedSlotIds.has(s.id)).length;
  const occupiedSlots = displaySlots.filter(s => !s.is_available || bookedSlotIds.has(s.id)).length;
  const reservedSlots = displaySlots.filter(s => s.is_reserved && !bookedSlotIds.has(s.id)).length;

  if (isLoading) {
    return (
      <AppLayout title="Loading...">
        <div className="flex items-center justify-center h-48">
          <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
        </div>
      </AppLayout>
    );
  }

  if (!zone) {
    return (
      <AppLayout title="Zone Not Found">
        <div className="text-center py-12">
          <p className="text-muted-foreground">Zone not found</p>
          <Button onClick={() => navigate('/zones')} className="mt-4">
            Back to Zones
          </Button>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout title={zone.name}>
      {/* Zone Header */}
      <div className="relative h-48 rounded-xl overflow-hidden mb-6">
        <img
          src={zoneImages[zone.code] || '/placeholder.svg'}
          alt={zone.name}
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-foreground/80 via-foreground/40 to-transparent" />
        <div className="absolute bottom-4 left-4 right-4 flex items-end justify-between">
          <div>
            <h1 className="text-2xl font-display font-bold text-card">{zone.name}</h1>
            <div className="flex items-center gap-1 text-card/80 text-sm">
              <MapPin className="w-4 h-4" />
              <span>VIT Vellore Campus</span>
            </div>
          </div>
          <Badge variant="secondary" className="text-lg px-3 py-1">{zone.code}</Badge>
        </div>
      </div>

      {/* Slot Summary Cards */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <Card className="bg-green-500/10 border-green-500/20">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-green-600">{freeSlots}</p>
            <p className="text-sm text-muted-foreground">Free</p>
          </CardContent>
        </Card>
        <Card className="bg-destructive/10 border-destructive/20">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-destructive">{occupiedSlots}</p>
            <p className="text-sm text-muted-foreground">Occupied</p>
          </CardContent>
        </Card>
        <Card className="bg-yellow-500/10 border-yellow-500/20">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-yellow-600">{reservedSlots}</p>
            <p className="text-sm text-muted-foreground">Reserved</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="slots" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="slots" className="flex items-center gap-2">
            <Grid3X3 className="w-4 h-4" />
            Slots Layout
          </TabsTrigger>
          <TabsTrigger value="reports" className="flex items-center gap-2">
            <BarChart3 className="w-4 h-4" />
            Reports
          </TabsTrigger>
          <TabsTrigger value="booking" className="flex items-center gap-2">
            <Calendar className="w-4 h-4" />
            Book Now
          </TabsTrigger>
        </TabsList>

        {/* Slots Layout Tab */}
        <TabsContent value="slots">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between flex-wrap gap-4">
                <CardTitle className="flex items-center gap-2">
                  <Grid3X3 className="w-5 h-5" />
                  Parking Slots Layout
                </CardTitle>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className="gap-2">
                      <CalendarIcon className="w-4 h-4" />
                      {format(selectedDate, 'PPP')}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="end">
                    <Calendar
                      mode="single"
                      selected={selectedDate}
                      onSelect={(date) => date && setSelectedDate(date)}
                      initialFocus
                      className={cn("p-3 pointer-events-auto")}
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </CardHeader>
            <CardContent>
              {/* Legend */}
              <div className="flex items-center gap-6 mb-6 pb-4 border-b flex-wrap">
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded bg-green-500" />
                  <span className="text-sm">Free</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded bg-destructive" />
                  <span className="text-sm">Booked / Occupied</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded bg-yellow-500" />
                  <span className="text-sm">Reserved</span>
                </div>
              </div>

              {/* Car Slots */}
              <div className="mb-6">
                <h3 className="font-semibold mb-3 flex items-center gap-2">
                  <Car className="w-4 h-4" />
                  Car Parking ({zone.total_car_slots} slots)
                </h3>
                <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2">
                  {displaySlots
                    .filter(s => s.slot_type === 'car')
                    .map((slot) => (
                      <div
                        key={slot.id}
                        className={`rounded-lg ${getSlotColor(slot)} flex flex-col items-center justify-center text-white text-xs font-medium p-2 transition-all ${isSlotSelectable(slot) ? 'cursor-pointer hover:opacity-80' : 'cursor-not-allowed opacity-80'} ${selectedSlotId === slot.id ? 'ring-2 ring-primary ring-offset-2 ring-offset-background' : ''}`}
                        title={`${slot.slot_number} - ${getSlotStatus(slot)}`}
                        onClick={() => {
                          if (isSlotSelectable(slot)) {
                            setSelectedSlotId(slot.id);
                          }
                        }}
                      >
                        <span className="font-bold">{slot.slot_number}</span>
                        <span className="text-[10px] opacity-80">{getSlotStatus(slot)}</span>
                      </div>
                    ))}
                </div>
              </div>

              {/* Bike Slots */}
              <div>
                <h3 className="font-semibold mb-3 flex items-center gap-2">
                  <Bike className="w-4 h-4" />
                  Two-Wheeler Parking ({zone.total_bike_slots} slots)
                </h3>
                <div className="grid grid-cols-5 sm:grid-cols-8 md:grid-cols-10 gap-1.5">
                  {displaySlots
                    .filter(s => s.slot_type !== 'car')
                    .map((slot) => (
                      <div
                        key={slot.id}
                        className={`rounded ${getSlotColor(slot)} flex flex-col items-center justify-center text-white text-[10px] font-medium p-1.5 transition-all ${isSlotSelectable(slot) ? 'cursor-pointer hover:opacity-80' : 'cursor-not-allowed opacity-80'} ${selectedSlotId === slot.id ? 'ring-2 ring-primary ring-offset-2 ring-offset-background' : ''}`}
                        title={`${slot.slot_number} - ${getSlotStatus(slot)}`}
                        onClick={() => {
                          if (isSlotSelectable(slot)) {
                            setSelectedSlotId(slot.id);
                          }
                        }}
                      >
                        <span className="font-bold">{slot.slot_number}</span>
                        <span className="text-[9px] opacity-80">{getSlotStatus(slot)}</span>
                      </div>
                    ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Reports Tab */}
        <TabsContent value="reports">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="w-5 h-5" />
                  Zone Reports
                </CardTitle>
                <div className="flex gap-2">
                  <Button
                    variant={reportPeriod === 'daily' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setReportPeriod('daily')}
                  >
                    Daily
                  </Button>
                  <Button
                    variant={reportPeriod === 'weekly' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setReportPeriod('weekly')}
                  >
                    Weekly
                  </Button>
                  <Button
                    variant={reportPeriod === 'monthly' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setReportPeriod('monthly')}
                  >
                    Monthly
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-primary/10">
                        <Calendar className="w-5 h-5 text-primary" />
                      </div>
                      <div>
                        <p className="text-2xl font-bold">{reportData.totalBookings}</p>
                        <p className="text-xs text-muted-foreground">Total Bookings</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-green-500/10">
                        <TrendingUp className="w-5 h-5 text-green-500" />
                      </div>
                      <div>
                        <p className="text-2xl font-bold">{reportData.activeBookings}</p>
                        <p className="text-xs text-muted-foreground">Active Now</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-blue-500/10">
                        <Users className="w-5 h-5 text-blue-500" />
                      </div>
                      <div>
                        <p className="text-2xl font-bold">{reportData.averageOccupancy}%</p>
                        <p className="text-xs text-muted-foreground">Occupancy</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-yellow-500/10">
                        <DollarSign className="w-5 h-5 text-yellow-500" />
                      </div>
                      <div>
                        <p className="text-2xl font-bold">₹{reportData.revenue}</p>
                        <p className="text-xs text-muted-foreground">Revenue</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Pricing Info */}
              <div className="mt-6 p-4 bg-muted/50 rounded-lg">
                <h4 className="font-semibold mb-3 flex items-center gap-2">
                  <Clock className="w-4 h-4" />
                  Pricing Information
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                  <div className="p-3 bg-card rounded-lg">
                    <p className="text-muted-foreground">Free Hours</p>
                    <p className="font-semibold text-green-600">First 4 hours FREE</p>
                  </div>
                  <div className="p-3 bg-card rounded-lg">
                    <p className="text-muted-foreground">Hourly Rate</p>
                    <p className="font-semibold">₹10/hour (after free hours)</p>
                  </div>
                  <div className="p-3 bg-card rounded-lg">
                    <p className="text-muted-foreground">Overstay Penalty</p>
                    <p className="font-semibold text-destructive">₹30/hour</p>
                  </div>
                </div>
                <p className="mt-3 text-sm text-muted-foreground">
                  Note: Each registered vehicle gets one free day per week.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Booking Tab */}
        <TabsContent value="booking">
          <Card>
            <CardContent className="p-6 text-center">
              <Calendar className="w-12 h-12 mx-auto text-primary mb-4" />
              <h3 className="text-lg font-semibold mb-2">Book a Slot at {zone.name}</h3>
              <p className="text-muted-foreground mb-4">
                  {selectedSlotId
                    ? `Selected slot: ${displaySlots.find((slot) => slot.id === selectedSlotId)?.slot_number}`
                    : 'Select a free slot from the layout first, then continue to booking.'}
              </p>
              <Button 
                  onClick={() => navigate(`/booking?zone=${zone.code}&slot=${selectedSlotId}`)}
                  disabled={!selectedSlotId}
                className="gradient-vit"
              >
                  {selectedSlotId ? 'Book Selected Slot' : 'Select a Free Slot First'}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </AppLayout>
  );
};

export default ZoneDetails;
