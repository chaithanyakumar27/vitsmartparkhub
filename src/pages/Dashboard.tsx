import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Car, LogOut, MapPin } from 'lucide-react';

import technologyTower from '@/assets/technology-tower.png';
import silverJubileeTower from '@/assets/silver-jubilee-tower.png';
import pearlResearchPark from '@/assets/pearl-research-park.png';
import boysHostel from '@/assets/boys-hostel.png';
import mainBuilding from '@/assets/main-building.png';
import smvBlock from '@/assets/smv-block.png';
import gandhiBlock from '@/assets/gandhi-block.png';
import sjtGround from '@/assets/sjt-ground.png';

const parkingLocations = [
  {
    id: 1,
    name: 'Technology Tower (TT)',
    image: technologyTower,
    capacity: 150,
    available: 42,
  },
  {
    id: 2,
    name: 'Silver Jubilee Tower (SJT)',
    image: silverJubileeTower,
    capacity: 200,
    available: 85,
  },
  {
    id: 3,
    name: 'Pearl Research Park (PRP)',
    image: pearlResearchPark,
    capacity: 120,
    available: 33,
  },
  {
    id: 4,
    name: 'Boys Hostel',
    image: boysHostel,
    capacity: 180,
    available: 67,
  },
  {
    id: 5,
    name: 'Main Building',
    image: mainBuilding,
    capacity: 250,
    available: 112,
  },
  {
    id: 6,
    name: 'SMV Block',
    image: smvBlock,
    capacity: 100,
    available: 28,
  },
  {
    id: 7,
    name: 'Gandhi Block',
    image: gandhiBlock,
    capacity: 130,
    available: 54,
  },
  {
    id: 8,
    name: 'SJT Ground',
    image: sjtGround,
    capacity: 300,
    available: 198,
  },
];

const Dashboard = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="gradient-vit sticky top-0 z-50 shadow-lg">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary-foreground/20 rounded-xl flex items-center justify-center">
              <Car className="w-6 h-6 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-xl font-display font-bold text-primary-foreground">
                VIT Parking System
              </h1>
              <p className="text-sm text-primary-foreground/70">
                Welcome, {user?.collegeId}
              </p>
            </div>
          </div>
          
          <Button 
            variant="outline" 
            onClick={handleLogout}
            className="bg-primary-foreground/10 border-primary-foreground/30 text-primary-foreground hover:bg-primary-foreground/20 hover:text-primary-foreground"
          >
            <LogOut className="w-4 h-4 mr-2" />
            Logout
          </Button>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h2 className="text-2xl font-display font-bold text-foreground mb-2">
            Select a Parking Location
          </h2>
          <p className="text-muted-foreground">
            Choose from 8 parking zones across VIT Vellore campus
          </p>
        </div>

        {/* Parking Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {parkingLocations.map((location, index) => (
            <Card 
              key={location.id}
              className="group overflow-hidden border-border hover:border-primary/50 transition-all duration-300 hover:shadow-xl cursor-pointer bg-card"
              style={{ animationDelay: `${index * 100}ms` }}
            >
              <div className="relative h-48 overflow-hidden">
                <img
                  src={location.image}
                  alt={location.name}
                  className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-foreground/60 to-transparent" />
                <div className="absolute bottom-3 left-3 right-3">
                  <h3 className="text-lg font-display font-bold text-card truncate">
                    {location.name}
                  </h3>
                </div>
              </div>
              
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <MapPin className="w-4 h-4" />
                    <span className="text-sm">VIT Vellore</span>
                  </div>
                </div>
                
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Available Spots</p>
                    <p className="text-2xl font-display font-bold text-primary">
                      {location.available}
                      <span className="text-sm font-normal text-muted-foreground">
                        /{location.capacity}
                      </span>
                    </p>
                  </div>
                  
                  <div 
                    className={`px-3 py-1 rounded-full text-xs font-semibold ${
                      location.available > location.capacity * 0.5
                        ? 'bg-green-100 text-green-700'
                        : location.available > location.capacity * 0.2
                        ? 'bg-yellow-100 text-yellow-700'
                        : 'bg-red-100 text-red-700'
                    }`}
                  >
                    {location.available > location.capacity * 0.5
                      ? 'Available'
                      : location.available > location.capacity * 0.2
                      ? 'Limited'
                      : 'Filling Up'}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-border mt-12 py-6">
        <div className="container mx-auto px-4 text-center text-muted-foreground text-sm">
          © 2026 VIT Vellore Parking System. All rights reserved.
        </div>
      </footer>
    </div>
  );
};

export default Dashboard;