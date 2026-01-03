import { useState, useEffect } from 'react';
import AppLayout from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { DollarSign, Plus, Edit, Car, Bike } from 'lucide-react';

type VehicleType = 'car' | 'motorcycle' | 'scooter' | 'bicycle';

interface PricingPlan {
  id: string;
  name: string;
  vehicle_type: VehicleType;
  hourly_rate: number;
  daily_rate: number | null;
  monthly_rate: number | null;
  is_active: boolean;
}

const AdminPricing = () => {
  const [plans, setPlans] = useState<PricingPlan[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<PricingPlan | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    vehicle_type: 'car' as VehicleType,
    hourly_rate: 0,
    daily_rate: 0,
    monthly_rate: 0,
    is_active: true,
  });

  const fetchPlans = async () => {
    const { data, error } = await supabase
      .from('pricing_plans')
      .select('*')
      .order('vehicle_type');

    if (!error && data) {
      setPlans(data);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    fetchPlans();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const planData = {
      name: formData.name,
      vehicle_type: formData.vehicle_type,
      hourly_rate: formData.hourly_rate,
      daily_rate: formData.daily_rate || null,
      monthly_rate: formData.monthly_rate || null,
      is_active: formData.is_active,
    };

    if (editingPlan) {
      const { error } = await supabase
        .from('pricing_plans')
        .update(planData)
        .eq('id', editingPlan.id);

      if (error) {
        toast.error('Failed to update pricing plan');
      } else {
        toast.success('Pricing plan updated');
        setIsDialogOpen(false);
        fetchPlans();
      }
    } else {
      const { error } = await supabase
        .from('pricing_plans')
        .insert(planData);

      if (error) {
        toast.error('Failed to create pricing plan');
      } else {
        toast.success('Pricing plan created');
        setIsDialogOpen(false);
        fetchPlans();
      }
    }
  };

  const openEditDialog = (plan: PricingPlan) => {
    setEditingPlan(plan);
    setFormData({
      name: plan.name,
      vehicle_type: plan.vehicle_type,
      hourly_rate: plan.hourly_rate,
      daily_rate: plan.daily_rate || 0,
      monthly_rate: plan.monthly_rate || 0,
      is_active: plan.is_active,
    });
    setIsDialogOpen(true);
  };

  const openCreateDialog = () => {
    setEditingPlan(null);
    setFormData({
      name: '',
      vehicle_type: 'car',
      hourly_rate: 0,
      daily_rate: 0,
      monthly_rate: 0,
      is_active: true,
    });
    setIsDialogOpen(true);
  };

  return (
    <AppLayout title="Pricing Management">
      <div className="flex items-center justify-between mb-6">
        <p className="text-muted-foreground">
          Manage parking rates for different vehicle types
        </p>
        <Button onClick={openCreateDialog}>
          <Plus className="w-4 h-4 mr-2" />
          Add Plan
        </Button>
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingPlan ? 'Edit Pricing Plan' : 'Add Pricing Plan'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>Plan Name</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., Car Standard"
                required
              />
            </div>
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
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Hourly Rate (₹)</Label>
                <Input
                  type="number"
                  value={formData.hourly_rate}
                  onChange={(e) => setFormData({ ...formData, hourly_rate: parseFloat(e.target.value) || 0 })}
                  min={0}
                  step={0.01}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Daily Rate (₹)</Label>
                <Input
                  type="number"
                  value={formData.daily_rate}
                  onChange={(e) => setFormData({ ...formData, daily_rate: parseFloat(e.target.value) || 0 })}
                  min={0}
                  step={0.01}
                />
              </div>
              <div className="space-y-2">
                <Label>Monthly Rate (₹)</Label>
                <Input
                  type="number"
                  value={formData.monthly_rate}
                  onChange={(e) => setFormData({ ...formData, monthly_rate: parseFloat(e.target.value) || 0 })}
                  min={0}
                  step={0.01}
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
              {editingPlan ? 'Update Plan' : 'Create Plan'}
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
          {plans.map((plan) => (
            <Card key={plan.id} className={!plan.is_active ? 'opacity-60' : ''}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg flex items-center gap-2">
                    {plan.vehicle_type === 'car' ? <Car className="w-4 h-4" /> : <Bike className="w-4 h-4" />}
                    {plan.name}
                  </CardTitle>
                  <Button variant="ghost" size="icon" onClick={() => openEditDialog(plan)}>
                    <Edit className="w-4 h-4" />
                  </Button>
                </div>
                <p className="text-sm text-muted-foreground capitalize">{plan.vehicle_type}</p>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Hourly</span>
                    <span className="font-semibold">₹{plan.hourly_rate}</span>
                  </div>
                  {plan.daily_rate && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Daily</span>
                      <span className="font-semibold">₹{plan.daily_rate}</span>
                    </div>
                  )}
                  {plan.monthly_rate && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Monthly</span>
                      <span className="font-semibold">₹{plan.monthly_rate}</span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </AppLayout>
  );
};

export default AdminPricing;