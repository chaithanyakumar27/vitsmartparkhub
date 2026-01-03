import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import AppLayout from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Car, Bike, Plus, Trash2, Star, Edit } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

type VehicleType = 'car' | 'motorcycle' | 'scooter' | 'bicycle';

interface Vehicle {
  id: string;
  vehicle_type: VehicleType;
  registration_number: string;
  make: string | null;
  model: string | null;
  color: string | null;
  is_primary: boolean;
}

const vehicleIcons: Record<VehicleType, React.ElementType> = {
  car: Car,
  motorcycle: Bike,
  scooter: Bike,
  bicycle: Bike,
};

const Vehicles = () => {
  const { user } = useAuth();
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    vehicle_type: 'car' as VehicleType,
    registration_number: '',
    make: '',
    model: '',
    color: '',
  });

  const fetchVehicles = async () => {
    if (!user) return;
    
    const { data, error } = await supabase
      .from('vehicles')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      toast.error('Failed to fetch vehicles');
    } else {
      setVehicles(data || []);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    fetchVehicles();
  }, [user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setIsSubmitting(true);
    const { error } = await supabase
      .from('vehicles')
      .insert({
        user_id: user.id,
        vehicle_type: formData.vehicle_type,
        registration_number: formData.registration_number.toUpperCase(),
        make: formData.make || null,
        model: formData.model || null,
        color: formData.color || null,
        is_primary: vehicles.length === 0,
      });

    if (error) {
      if (error.code === '23505') {
        toast.error('This vehicle is already registered');
      } else {
        toast.error('Failed to add vehicle');
      }
    } else {
      toast.success('Vehicle added successfully');
      setFormData({
        vehicle_type: 'car',
        registration_number: '',
        make: '',
        model: '',
        color: '',
      });
      setIsDialogOpen(false);
      fetchVehicles();
    }
    setIsSubmitting(false);
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase
      .from('vehicles')
      .delete()
      .eq('id', id);

    if (error) {
      toast.error('Failed to delete vehicle');
    } else {
      toast.success('Vehicle removed');
      fetchVehicles();
    }
  };

  const handleSetPrimary = async (id: string) => {
    if (!user) return;

    // First, unset all as primary
    await supabase
      .from('vehicles')
      .update({ is_primary: false })
      .eq('user_id', user.id);

    // Then set the selected one as primary
    const { error } = await supabase
      .from('vehicles')
      .update({ is_primary: true })
      .eq('id', id);

    if (error) {
      toast.error('Failed to set primary vehicle');
    } else {
      toast.success('Primary vehicle updated');
      fetchVehicles();
    }
  };

  return (
    <AppLayout title="My Vehicles">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <p className="text-muted-foreground">
              Manage your registered vehicles for parking
            </p>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                Add Vehicle
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add New Vehicle</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label>Vehicle Type</Label>
                  <Select
                    value={formData.vehicle_type}
                    onValueChange={(value: VehicleType) => setFormData({ ...formData, vehicle_type: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="car">Car</SelectItem>
                      <SelectItem value="motorcycle">Motorcycle</SelectItem>
                      <SelectItem value="scooter">Scooter</SelectItem>
                      <SelectItem value="bicycle">Bicycle</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Registration Number *</Label>
                  <Input
                    value={formData.registration_number}
                    onChange={(e) => setFormData({ ...formData, registration_number: e.target.value })}
                    placeholder="e.g., TN01AB1234"
                    required
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Make</Label>
                    <Input
                      value={formData.make}
                      onChange={(e) => setFormData({ ...formData, make: e.target.value })}
                      placeholder="e.g., Honda"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Model</Label>
                    <Input
                      value={formData.model}
                      onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                      placeholder="e.g., City"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Color</Label>
                  <Input
                    value={formData.color}
                    onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                    placeholder="e.g., White"
                  />
                </div>
                <Button type="submit" className="w-full" disabled={isSubmitting}>
                  {isSubmitting ? 'Adding...' : 'Add Vehicle'}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center h-48">
            <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
          </div>
        ) : vehicles.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Car className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold text-foreground mb-2">No vehicles registered</h3>
              <p className="text-muted-foreground mb-4">Add your first vehicle to start booking parking slots</p>
              <Button onClick={() => setIsDialogOpen(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Add Vehicle
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {vehicles.map((vehicle) => {
              const Icon = vehicleIcons[vehicle.vehicle_type];
              return (
                <Card key={vehicle.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="py-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center">
                          <Icon className="w-6 h-6 text-primary" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="font-semibold text-foreground">
                              {vehicle.registration_number}
                            </h3>
                            {vehicle.is_primary && (
                              <Badge variant="secondary" className="text-xs">
                                <Star className="w-3 h-3 mr-1 fill-current" />
                                Primary
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground capitalize">
                            {vehicle.vehicle_type}
                            {vehicle.make && ` • ${vehicle.make}`}
                            {vehicle.model && ` ${vehicle.model}`}
                            {vehicle.color && ` • ${vehicle.color}`}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {!vehicle.is_primary && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleSetPrimary(vehicle.id)}
                          >
                            <Star className="w-4 h-4" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive hover:text-destructive"
                          onClick={() => handleDelete(vehicle.id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </AppLayout>
  );
};

export default Vehicles;