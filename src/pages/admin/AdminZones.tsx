import { useState, useEffect } from 'react';
import AppLayout from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { MapPin, Plus, Edit, Car, Bike } from 'lucide-react';

interface ParkingZone {
  id: string;
  name: string;
  code: string;
  description: string | null;
  total_car_slots: number;
  total_bike_slots: number;
  is_active: boolean;
}

const AdminZones = () => {
  const [zones, setZones] = useState<ParkingZone[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingZone, setEditingZone] = useState<ParkingZone | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    code: '',
    description: '',
    total_car_slots: 0,
    total_bike_slots: 0,
    is_active: true,
  });

  const fetchZones = async () => {
    const { data, error } = await supabase
      .from('parking_zones')
      .select('*')
      .order('name');

    if (!error && data) {
      setZones(data);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    fetchZones();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (editingZone) {
      const { error } = await supabase
        .from('parking_zones')
        .update({
          name: formData.name,
          code: formData.code.toUpperCase(),
          description: formData.description || null,
          total_car_slots: formData.total_car_slots,
          total_bike_slots: formData.total_bike_slots,
          is_active: formData.is_active,
        })
        .eq('id', editingZone.id);

      if (error) {
        toast.error('Failed to update zone');
      } else {
        toast.success('Zone updated successfully');
        setIsDialogOpen(false);
        fetchZones();
      }
    } else {
      const { error } = await supabase
        .from('parking_zones')
        .insert({
          name: formData.name,
          code: formData.code.toUpperCase(),
          description: formData.description || null,
          total_car_slots: formData.total_car_slots,
          total_bike_slots: formData.total_bike_slots,
          is_active: formData.is_active,
        });

      if (error) {
        toast.error('Failed to create zone');
      } else {
        toast.success('Zone created successfully');
        setIsDialogOpen(false);
        fetchZones();
      }
    }
  };

  const openEditDialog = (zone: ParkingZone) => {
    setEditingZone(zone);
    setFormData({
      name: zone.name,
      code: zone.code,
      description: zone.description || '',
      total_car_slots: zone.total_car_slots,
      total_bike_slots: zone.total_bike_slots,
      is_active: zone.is_active,
    });
    setIsDialogOpen(true);
  };

  const openCreateDialog = () => {
    setEditingZone(null);
    setFormData({
      name: '',
      code: '',
      description: '',
      total_car_slots: 0,
      total_bike_slots: 0,
      is_active: true,
    });
    setIsDialogOpen(true);
  };

  return (
    <AppLayout title="Manage Parking Zones">
      <div className="flex items-center justify-between mb-6">
        <p className="text-muted-foreground">
          Add, edit, and manage parking zones across the campus
        </p>
        <Button onClick={openCreateDialog}>
          <Plus className="w-4 h-4 mr-2" />
          Add Zone
        </Button>
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingZone ? 'Edit Zone' : 'Add New Zone'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Zone Name</Label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., Technology Tower"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Zone Code</Label>
                <Input
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                  placeholder="e.g., TT"
                  required
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Input
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Optional description"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Car Slots</Label>
                <Input
                  type="number"
                  value={formData.total_car_slots}
                  onChange={(e) => setFormData({ ...formData, total_car_slots: parseInt(e.target.value) || 0 })}
                  min={0}
                />
              </div>
              <div className="space-y-2">
                <Label>Bike Slots</Label>
                <Input
                  type="number"
                  value={formData.total_bike_slots}
                  onChange={(e) => setFormData({ ...formData, total_bike_slots: parseInt(e.target.value) || 0 })}
                  min={0}
                />
              </div>
            </div>
            <div className="flex items-center justify-between">
              <Label>Active</Label>
              <Switch
                checked={formData.is_active}
                onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
              />
            </div>
            <Button type="submit" className="w-full">
              {editingZone ? 'Update Zone' : 'Create Zone'}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {isLoading ? (
        <div className="flex items-center justify-center h-48">
          <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {zones.map((zone) => (
            <Card key={zone.id} className={!zone.is_active ? 'opacity-60' : ''}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <MapPin className="w-4 h-4" />
                    {zone.name}
                  </CardTitle>
                  <Button variant="ghost" size="icon" onClick={() => openEditDialog(zone)}>
                    <Edit className="w-4 h-4" />
                  </Button>
                </div>
                <p className="text-sm text-muted-foreground">Code: {zone.code}</p>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-6 text-sm">
                  <div className="flex items-center gap-2">
                    <Car className="w-4 h-4 text-muted-foreground" />
                    <span>{zone.total_car_slots} cars</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Bike className="w-4 h-4 text-muted-foreground" />
                    <span>{zone.total_bike_slots} bikes</span>
                  </div>
                </div>
                {!zone.is_active && (
                  <p className="text-sm text-destructive mt-2">Inactive</p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </AppLayout>
  );
};

export default AdminZones;