import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import AppLayout from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { LogIn, LogOut, Search, CheckCircle, XCircle } from 'lucide-react';

const EntryExit = () => {
  const { isStaff } = useAuth();
  const [bookingCode, setBookingCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [bookingDetails, setBookingDetails] = useState<any>(null);

  const handleSearch = async () => {
    if (!bookingCode.trim()) {
      toast.error('Please enter a booking code');
      return;
    }

    setIsLoading(true);
    const { data, error } = await supabase
      .from('bookings')
      .select(`
        *,
        vehicles (registration_number, make, model, color),
        parking_zones (name, code),
        profiles:user_id (full_name, college_id)
      `)
      .eq('booking_code', bookingCode.toUpperCase())
      .maybeSingle();

    if (error || !data) {
      toast.error('Booking not found');
      setBookingDetails(null);
    } else {
      setBookingDetails(data);
    }
    setIsLoading(false);
  };

  const handleEntry = async () => {
    if (!bookingDetails) return;

    const { error } = await supabase
      .from('bookings')
      .update({
        status: 'active',
        actual_entry_time: new Date().toISOString(),
      })
      .eq('id', bookingDetails.id);

    if (error) {
      toast.error('Failed to record entry');
    } else {
      toast.success('Entry recorded successfully');
      handleSearch();
    }
  };

  const handleExit = async () => {
    if (!bookingDetails) return;

    const { error } = await supabase
      .from('bookings')
      .update({
        status: 'completed',
        actual_exit_time: new Date().toISOString(),
      })
      .eq('id', bookingDetails.id);

    if (error) {
      toast.error('Failed to record exit');
    } else {
      toast.success('Exit recorded successfully');
      handleSearch();
    }
  };

  return (
    <AppLayout title="Entry / Exit Management">
      <div className="max-w-2xl mx-auto">
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Scan or Enter Booking Code</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-4">
              <div className="flex-1">
                <Input
                  placeholder="Enter booking code (e.g., VIT20260103-ABC123)"
                  value={bookingCode}
                  onChange={(e) => setBookingCode(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                />
              </div>
              <Button onClick={handleSearch} disabled={isLoading}>
                <Search className="w-4 h-4 mr-2" />
                Search
              </Button>
            </div>
          </CardContent>
        </Card>

        {bookingDetails && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Booking Details</span>
                <span className={`text-sm px-3 py-1 rounded-full ${
                  bookingDetails.status === 'confirmed' ? 'bg-blue-100 text-blue-700' :
                  bookingDetails.status === 'active' ? 'bg-green-100 text-green-700' :
                  bookingDetails.status === 'completed' ? 'bg-gray-100 text-gray-700' :
                  'bg-yellow-100 text-yellow-700'
                }`}>
                  {bookingDetails.status}
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground">Booking Code</Label>
                  <p className="font-mono font-semibold">{bookingDetails.booking_code}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">User</Label>
                  <p className="font-semibold">{bookingDetails.profiles?.full_name}</p>
                  <p className="text-sm text-muted-foreground">{bookingDetails.profiles?.college_id}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Vehicle</Label>
                  <p className="font-semibold">{bookingDetails.vehicles?.registration_number}</p>
                  <p className="text-sm text-muted-foreground">
                    {bookingDetails.vehicles?.make} {bookingDetails.vehicles?.model}
                  </p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Zone</Label>
                  <p className="font-semibold">{bookingDetails.parking_zones?.name}</p>
                </div>
              </div>

              <div className="flex gap-4 pt-4">
                {bookingDetails.status === 'confirmed' && (
                  <Button onClick={handleEntry} className="flex-1 bg-green-600 hover:bg-green-700">
                    <LogIn className="w-4 h-4 mr-2" />
                    Record Entry
                  </Button>
                )}
                {bookingDetails.status === 'active' && (
                  <Button onClick={handleExit} className="flex-1 bg-orange-600 hover:bg-orange-700">
                    <LogOut className="w-4 h-4 mr-2" />
                    Record Exit
                  </Button>
                )}
                {bookingDetails.status === 'completed' && (
                  <div className="flex-1 text-center py-4 bg-muted rounded-lg">
                    <CheckCircle className="w-6 h-6 mx-auto text-green-600 mb-2" />
                    <p className="text-muted-foreground">Booking completed</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </AppLayout>
  );
};

export default EntryExit;