import { useEffect, useState } from 'react';
import AppLayout from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { Users, Car, Calendar, CreditCard, TrendingUp, MapPin } from 'lucide-react';

const AdminDashboard = () => {
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalVehicles: 0,
    totalBookings: 0,
    activeBookings: 0,
    totalRevenue: 0,
    totalZones: 0,
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      const [usersRes, vehiclesRes, bookingsRes, zonesRes] = await Promise.all([
        supabase.from('profiles').select('id', { count: 'exact' }),
        supabase.from('vehicles').select('id', { count: 'exact' }),
        supabase.from('bookings').select('id, status', { count: 'exact' }),
        supabase.from('parking_zones').select('id', { count: 'exact' }),
      ]);

      const activeBookings = bookingsRes.data?.filter(b => b.status === 'active').length || 0;

      setStats({
        totalUsers: usersRes.count || 0,
        totalVehicles: vehiclesRes.count || 0,
        totalBookings: bookingsRes.count || 0,
        activeBookings,
        totalRevenue: 0,
        totalZones: zonesRes.count || 0,
      });
      setIsLoading(false);
    };

    fetchStats();
  }, []);

  const statCards = [
    { label: 'Total Users', value: stats.totalUsers, icon: Users, color: 'bg-blue-100 text-blue-600' },
    { label: 'Registered Vehicles', value: stats.totalVehicles, icon: Car, color: 'bg-green-100 text-green-600' },
    { label: 'Total Bookings', value: stats.totalBookings, icon: Calendar, color: 'bg-purple-100 text-purple-600' },
    { label: 'Active Now', value: stats.activeBookings, icon: TrendingUp, color: 'bg-orange-100 text-orange-600' },
    { label: 'Parking Zones', value: stats.totalZones, icon: MapPin, color: 'bg-teal-100 text-teal-600' },
    { label: 'Revenue (₹)', value: stats.totalRevenue, icon: CreditCard, color: 'bg-pink-100 text-pink-600' },
  ];

  return (
    <AppLayout title="Admin Dashboard">
      <div className="mb-6">
        <h2 className="text-2xl font-display font-bold text-foreground">System Overview</h2>
        <p className="text-muted-foreground">Monitor and manage the VIT Parking System</p>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-48">
          <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
            {statCards.map((stat) => {
              const Icon = stat.icon;
              return (
                <Card key={stat.label}>
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground">{stat.label}</p>
                        <p className="text-3xl font-display font-bold text-foreground">{stat.value}</p>
                      </div>
                      <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${stat.color}`}>
                        <Icon className="w-6 h-6" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          <div className="grid lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Recent Activity</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground text-center py-8">
                  Activity log will be displayed here
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Quick Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <p className="text-muted-foreground text-center py-8">
                  Admin quick actions will be available here
                </p>
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </AppLayout>
  );
};

export default AdminDashboard;