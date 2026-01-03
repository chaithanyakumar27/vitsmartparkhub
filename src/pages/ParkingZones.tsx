import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import AppLayout from '@/components/layout/AppLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { MapPin, Car, Bike, Search } from 'lucide-react';

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

const ParkingZones = () => {
  const navigate = useNavigate();
  const [zones, setZones] = useState<ParkingZone[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    const fetchZones = async () => {
      const { data, error } = await supabase
        .from('parking_zones')
        .select('*')
        .eq('is_active', true)
        .order('name');

      if (!error && data) {
        setZones(data);
      }
      setIsLoading(false);
    };

    fetchZones();
  }, []);

  const filteredZones = zones.filter(zone =>
    zone.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    zone.code.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <AppLayout title="Parking Zones">
      <div className="mb-6">
        <p className="text-muted-foreground mb-4">
          View all parking zones across VIT Vellore campus
        </p>
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search zones..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-48">
          <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredZones.map((zone) => (
            <Card
              key={zone.id}
              className="group overflow-hidden hover:shadow-xl transition-all duration-300 cursor-pointer"
              onClick={() => navigate(`/booking?zone=${zone.code}`)}
            >
              <div className="relative h-48 overflow-hidden">
                <img
                  src={zoneImages[zone.code] || '/placeholder.svg'}
                  alt={zone.name}
                  className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-foreground/70 via-foreground/20 to-transparent" />
                <div className="absolute bottom-4 left-4 right-4">
                  <h3 className="text-xl font-display font-bold text-card">
                    {zone.name}
                  </h3>
                  <div className="flex items-center gap-1 text-card/80 text-sm">
                    <MapPin className="w-4 h-4" />
                    <span>VIT Vellore Campus</span>
                  </div>
                </div>
                <div className="absolute top-3 right-3 bg-card/90 backdrop-blur-sm rounded-lg px-2 py-1 text-xs font-semibold text-foreground">
                  {zone.code}
                </div>
              </div>
              
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      <Car className="w-4 h-4 text-muted-foreground" />
                      <span className="text-sm font-medium">{zone.total_car_slots} cars</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Bike className="w-4 h-4 text-muted-foreground" />
                      <span className="text-sm font-medium">{zone.total_bike_slots} bikes</span>
                    </div>
                  </div>
                </div>
                
                <Button className="w-full" size="sm">
                  Book Now
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </AppLayout>
  );
};

export default ParkingZones;