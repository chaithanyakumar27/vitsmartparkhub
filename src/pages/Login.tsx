import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Car, LogIn } from 'lucide-react';
import { toast } from 'sonner';

const Login = () => {
  const [collegeId, setCollegeId] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 500));

    const success = login(collegeId, password);
    
    if (success) {
      toast.success('Welcome to VIT Parking System!');
      navigate('/dashboard');
    } else {
      toast.error('Invalid credentials. College ID must be at least 5 characters and password at least 4 characters.');
    }
    
    setIsLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background gradient */}
      <div className="absolute inset-0 gradient-vit opacity-90" />
      
      {/* Decorative circles */}
      <div className="absolute top-20 left-20 w-64 h-64 bg-secondary/20 rounded-full blur-3xl" />
      <div className="absolute bottom-20 right-20 w-96 h-96 bg-primary/10 rounded-full blur-3xl" />

      <Card className="w-full max-w-md relative z-10 border-0 shadow-2xl animate-fade-in bg-card/95 backdrop-blur-sm">
        <CardHeader className="text-center space-y-4 pb-2">
          <div className="mx-auto w-20 h-20 bg-primary rounded-2xl flex items-center justify-center shadow-lg">
            <Car className="w-10 h-10 text-primary-foreground" />
          </div>
          <div>
            <CardTitle className="text-3xl font-display text-foreground">
              VIT Parking
            </CardTitle>
            <CardDescription className="text-muted-foreground mt-2">
              Vellore Institute of Technology
            </CardDescription>
          </div>
        </CardHeader>
        
        <CardContent className="pt-6">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="collegeId" className="text-foreground font-medium">
                College ID
              </Label>
              <Input
                id="collegeId"
                type="text"
                placeholder="Enter your College ID"
                value={collegeId}
                onChange={(e) => setCollegeId(e.target.value)}
                className="h-12 bg-background border-border focus:border-primary transition-colors"
                required
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="password" className="text-foreground font-medium">
                Password
              </Label>
              <Input
                id="password"
                type="password"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="h-12 bg-background border-border focus:border-primary transition-colors"
                required
              />
            </div>

            <Button 
              type="submit" 
              className="w-full h-12 text-base font-semibold gradient-vit hover:opacity-90 transition-opacity"
              disabled={isLoading}
            >
              {isLoading ? (
                <span className="flex items-center gap-2">
                  <div className="w-5 h-5 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                  Signing in...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <LogIn className="w-5 h-5" />
                  Sign In
                </span>
              )}
            </Button>
          </form>

          <p className="text-center text-sm text-muted-foreground mt-6">
            Demo: Enter any College ID (min 5 chars) and password (min 4 chars)
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default Login;