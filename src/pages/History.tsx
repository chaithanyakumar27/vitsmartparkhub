import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import AppLayout from '@/components/layout/AppLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { supabase } from '@/integrations/supabase/client';
import { Calendar, MapPin, Car, Clock, XCircle } from 'lucide-react';
import { format, isPast } from 'date-fns';
import { toast } from 'sonner';

interface Booking {
  id: string;
  booking_code: string;
  status: string;
  booking_date: string;
  start_time: string;
  end_time: string | null;
  actual_entry_time: string | null;
  actual_exit_time: string | null;
  created_at: string;
  vehicles: {
    registration_number: string;
    make: string | null;
    model: string | null;
  };
  parking_zones: {
    name: string;
    code: string;
  };
}

const statusColors: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-700',
  confirmed: 'bg-blue-100 text-blue-700',
  active: 'bg-green-100 text-green-700',
  completed: 'bg-gray-100 text-gray-700',
  cancelled: 'bg-red-100 text-red-700',
};

const History = () => {
  const { user } = useAuth();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  const fetchBookings = async () => {
    if (!user) return;

    const { data, error } = await supabase
      .from('bookings')
      .select(`
        *,
        vehicles (registration_number, make, model),
        parking_zones (name, code)
      `)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (!error && data) {
      // Auto-complete expired bookings
      const now = new Date();
      const updated: Booking[] = [];

      for (const booking of data as Booking[]) {
        if (
          (booking.status === 'confirmed' || booking.status === 'active') &&
          booking.end_time &&
          isPast(new Date(booking.end_time))
        ) {
          // Mark as completed in DB
          await supabase
            .from('bookings')
            .update({ status: 'completed' })
            .eq('id', booking.id);
          updated.push({ ...booking, status: 'completed' });
        } else {
          updated.push(booking);
        }
      }

      setBookings(updated);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    fetchBookings();
  }, [user]);

  const handleCancelBooking = async (bookingId: string) => {
    setCancellingId(bookingId);
    const { error } = await supabase
      .from('bookings')
      .update({ status: 'cancelled' })
      .eq('id', bookingId);

    if (error) {
      toast.error('Failed to cancel booking: ' + error.message);
    } else {
      setBookings((prev) =>
        prev.map((b) => (b.id === bookingId ? { ...b, status: 'cancelled' } : b))
      );
      toast.success('Booking cancelled successfully');
    }
    setCancellingId(null);
  };

  const filteredBookings = bookings.filter((booking) => {
    if (filter === 'all') return true;
    if (filter === 'active') return booking.status === 'active' || booking.status === 'confirmed' || booking.status === 'pending';
    return booking.status === filter;
  });

  const canCancel = (status: string) =>
    status === 'pending' || status === 'confirmed' || status === 'active';

  return (
    <AppLayout title="Parking History">
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <p className="text-muted-foreground mb-4">
            View your parking reservations and activities
          </p>
          <Tabs defaultValue="all" onValueChange={setFilter}>
            <TabsList>
              <TabsTrigger value="all">All</TabsTrigger>
              <TabsTrigger value="active">Active</TabsTrigger>
              <TabsTrigger value="completed">Completed</TabsTrigger>
              <TabsTrigger value="cancelled">Cancelled</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center h-48">
            <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
          </div>
        ) : filteredBookings.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Calendar className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold text-foreground mb-2">No bookings found</h3>
              <p className="text-muted-foreground">
                {filter === 'all'
                  ? "You haven't made any parking reservations yet."
                  : `No ${filter} bookings found.`}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {filteredBookings.map((booking) => (
              <Card key={booking.id} className="hover:shadow-md transition-shadow">
                <CardContent className="py-4">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-mono font-semibold">{booking.booking_code}</h3>
                        <Badge className={statusColors[booking.status]}>
                          {booking.status}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">
                        {format(new Date(booking.created_at), 'PPp')}
                      </p>
                    </div>

                    {canCancel(booking.status) && (
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-destructive border-destructive/30 hover:bg-destructive/10"
                            disabled={cancellingId === booking.id}
                          >
                            <XCircle className="w-4 h-4 mr-1" />
                            {cancellingId === booking.id ? 'Cancelling...' : 'Cancel'}
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Cancel Booking?</AlertDialogTitle>
                            <AlertDialogDescription>
                              Are you sure you want to cancel booking <strong>{booking.booking_code}</strong>?
                              This action cannot be undone.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Keep Booking</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => handleCancelBooking(booking.id)}
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                              Yes, Cancel
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    )}
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div className="flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-muted-foreground" />
                      <span>{booking.parking_zones?.name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Car className="w-4 h-4 text-muted-foreground" />
                      <span>{booking.vehicles?.registration_number}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-muted-foreground" />
                      <span>{format(new Date(booking.booking_date), 'PP')}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-muted-foreground" />
                      <span>
                        {format(new Date(booking.start_time), 'p')}
                        {booking.end_time && ` - ${format(new Date(booking.end_time), 'p')}`}
                      </span>
                    </div>
                  </div>

                  {(booking.actual_entry_time || booking.actual_exit_time) && (
                    <div className="mt-3 pt-3 border-t text-sm text-muted-foreground">
                      {booking.actual_entry_time && (
                        <span>Entry: {format(new Date(booking.actual_entry_time), 'p')}</span>
                      )}
                      {booking.actual_entry_time && booking.actual_exit_time && ' • '}
                      {booking.actual_exit_time && (
                        <span>Exit: {format(new Date(booking.actual_exit_time), 'p')}</span>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
};

export default History;
