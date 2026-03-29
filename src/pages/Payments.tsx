import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import AppLayout from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { CreditCard, CheckCircle, Clock, AlertCircle } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';

interface Payment {
  id: string;
  amount: number;
  total_amount: number;
  status: string;
  payment_method: string | null;
  created_at: string;
  bookings: {
    booking_code: string;
    parking_zones: {
      name: string;
    };
  };
}

const Payments = () => {
  const { user } = useAuth();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [processingPaymentId, setProcessingPaymentId] = useState<string | null>(null);

  useEffect(() => {
    const fetchPayments = async () => {
      if (!user) return;

      const { data, error } = await supabase
        .from('payments')
        .select(`
          *,
          bookings (
            booking_code,
            parking_zones (name)
          )
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (!error && data) {
        setPayments(data as Payment[]);
      }
      setIsLoading(false);
    };

    fetchPayments();
  }, [user]);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="w-4 h-4 text-green-600" />;
      case 'pending':
        return <Clock className="w-4 h-4 text-yellow-600" />;
      case 'failed':
        return <AlertCircle className="w-4 h-4 text-red-600" />;
      default:
        return <Clock className="w-4 h-4" />;
    }
  };

  const handleCompletePayment = async (paymentId: string) => {
    if (!user) return;

    setProcessingPaymentId(paymentId);

    const { data, error } = await supabase.rpc('complete_payment', {
      _payment_id: paymentId,
      _payment_method: 'manual',
    });

    if (error) {
      console.error('Payment error:', error);
      toast.error('Payment could not be completed: ' + error.message);
      setProcessingPaymentId(null);
      return;
    }

    setPayments((current) =>
      current.map((payment) =>
        payment.id === paymentId
          ? {
              ...payment,
              status: 'completed',
              payment_method: 'manual',
            }
          : payment
      )
    );
    toast.success('Payment completed successfully!');
    setProcessingPaymentId(null);
  };

  return (
    <AppLayout title="Payments">
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <p className="text-muted-foreground">
            View and manage your parking payments
          </p>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center h-48">
            <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
          </div>
        ) : payments.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <CreditCard className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold text-foreground mb-2">No payments yet</h3>
              <p className="text-muted-foreground">
                Your payment history will appear here after your first booking.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {payments.map((payment) => (
              <Card key={payment.id}>
                <CardContent className="py-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                        <CreditCard className="w-5 h-5 text-primary" />
                      </div>
                      <div>
                        <p className="font-semibold">{payment.bookings?.booking_code}</p>
                        <p className="text-sm text-muted-foreground">
                          {payment.bookings?.parking_zones?.name}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold">₹{payment.total_amount}</p>
                      <div className="flex items-center gap-1 justify-end">
                        {getStatusIcon(payment.status)}
                        <span className="text-sm capitalize">{payment.status}</span>
                      </div>
                      {payment.status === 'pending' && (
                        <Button
                          size="sm"
                          className="mt-3"
                          onClick={() => handleCompletePayment(payment.id)}
                          disabled={processingPaymentId === payment.id}
                        >
                          {processingPaymentId === payment.id ? 'Processing...' : 'Pay Now'}
                        </Button>
                      )}
                    </div>
                  </div>
                  <div className="mt-3 pt-3 border-t flex items-center justify-between text-sm text-muted-foreground">
                    <span>{format(new Date(payment.created_at), 'PPp')}</span>
                    {payment.payment_method && (
                      <Badge variant="outline">{payment.payment_method}</Badge>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
};

export default Payments;