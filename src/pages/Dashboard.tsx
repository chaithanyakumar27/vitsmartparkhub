import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import AppLayout from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import {
  Car,
  Bike,
  MapPin,
  Calendar,
  TrendingUp,
  Clock,
  CreditCard,
  Bell,
} from 'lucide-react';

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
  total_car_slots: number;
  total_bike_slots: number;
  is_active: boolean;
}

const Dashboard = () => {
  const { profile, isLoading } = useAuth();
  const navigate = useNavigate();
  const [zones, setZones] = useState<ParkingZone[]>([]);
  const [stats, setStats] = useState({
    totalBookings: 0,
    activeBookings: 0,
    totalVehicles: 0,
    pendingPayments: 0,
  });

  useEffect(() => {
    const fetchData = async () => {
      // Fetch parking zones
      const { data: zonesData } = await supabase
        .from('parking_zones')
        .select('*')
        .eq('is_active', true);
      
      if (zonesData) {
        setZones(zonesData);
      }
    };

    fetchData();
  }, []);

  if (isLoading) {
    return (
      <AppLayout title="Dashboard">
        <div className="flex items-center justify-center h-64">
          <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout title="Dashboard">
      {/* Welcome Section */}
      <div className="mb-8">
        <h2 className="text-2xl font-display font-bold text-foreground">
          Welcome back, {profile?.full_name || 'User'}!
        </h2>
        <p className="text-muted-foreground mt-1">
          Here's what's happening with your parking today.
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Active Bookings</p>
                <p className="text-2xl font-display font-bold text-foreground">{stats.activeBookings}</p>
              </div>
              <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center">
                <Calendar className="w-6 h-6 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">My Vehicles</p>
                <p className="text-2xl font-display font-bold text-foreground">{stats.totalVehicles}</p>
              </div>
              <div className="w-12 h-12 bg-secondary/20 rounded-xl flex items-center justify-center">
                <Car className="w-6 h-6 text-secondary-foreground" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Bookings</p>
                <p className="text-2xl font-display font-bold text-foreground">{stats.totalBookings}</p>
              </div>
              <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
                <TrendingUp className="w-6 h-6 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Pending Payments</p>
                <p className="text-2xl font-display font-bold text-foreground">₹{stats.pendingPayments}</p>
              </div>
              <div className="w-12 h-12 bg-orange-100 rounded-xl flex items-center justify-center">
                <CreditCard className="w-6 h-6 text-orange-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <Button
          variant="outline"
          className="h-auto py-4 flex flex-col items-center gap-2"
          onClick={() => navigate('/booking')}
        >
          <Calendar className="w-6 h-6 text-primary" />
          <span>Book Parking</span>
        </Button>
        <Button
          variant="outline"
          className="h-auto py-4 flex flex-col items-center gap-2"
          onClick={() => navigate('/vehicles')}
        >
          <Car className="w-6 h-6 text-primary" />
          <span>My Vehicles</span>
        </Button>
        <Button
          variant="outline"
          className="h-auto py-4 flex flex-col items-center gap-2"
          onClick={() => navigate('/history')}
        >
          <Clock className="w-6 h-6 text-primary" />
          <span>History</span>
        </Button>
        <Button
          variant="outline"
          className="h-auto py-4 flex flex-col items-center gap-2"
          onClick={() => navigate('/notifications')}
        >
          <Bell className="w-6 h-6 text-primary" />
          <span>Notifications</span>
        </Button>
      </div>

      {/* Parking Zones */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-display font-semibold text-foreground">Parking Zones</h3>
          <Button variant="link" onClick={() => navigate('/zones')}>
            View All
          </Button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {zones.slice(0, 8).map((zone) => (
            <Card
              key={zone.id}
              className="group overflow-hidden cursor-pointer hover:shadow-lg transition-shadow"
              onClick={() => navigate(`/booking?zone=${zone.code}`)}
            >
              <div className="relative h-32 overflow-hidden">
                <img
                  src={zoneImages[zone.code] || '/placeholder.svg'}
                  alt={zone.name}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-foreground/60 to-transparent" />
                <div className="absolute bottom-2 left-2 right-2">
                  <p className="text-sm font-semibold text-card truncate">{zone.name}</p>
                </div>
              </div>
              <CardContent className="p-3">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1 text-muted-foreground">
                    <Car className="w-3 h-3" />
                    <span>{zone.total_car_slots}</span>
                  </div>
                  <div className="flex items-center gap-1 text-muted-foreground">
                    <Bike className="w-3 h-3" />
                    <span>{zone.total_bike_slots}</span>
                  </div>
                  <span className="text-xs font-medium text-green-600">Available</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </AppLayout>
  );
};

export default Dashboard;