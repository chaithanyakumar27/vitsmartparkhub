import { Link, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import {
  Car,
  LayoutDashboard,
  User,
  Bike,
  MapPin,
  Calendar,
  LogIn,
  CreditCard,
  Bell,
  History,
  Shield,
  Settings,
  Users,
  BarChart3,
  DollarSign,
  HelpCircle,
  ChevronLeft,
  ChevronRight,
  ScanEye,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useState } from 'react';

interface NavItem {
  label: string;
  href: string;
  icon: React.ElementType;
  adminOnly?: boolean;
  staffOnly?: boolean;
}

const navItems: NavItem[] = [
  { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { label: 'My Profile', href: '/profile', icon: User },
  { label: 'My Vehicles', href: '/vehicles', icon: Bike },
  { label: 'Parking Zones', href: '/zones', icon: MapPin },
  { label: 'Book Parking', href: '/booking', icon: Calendar },
  { label: 'Entry/Exit', href: '/entry-exit', icon: LogIn, staffOnly: true },
  { label: 'Vehicle Detection', href: '/vehicle-detection', icon: ScanEye },
  { label: 'Payments', href: '/payments', icon: CreditCard },
  { label: 'Notifications', href: '/notifications', icon: Bell },
  { label: 'History', href: '/history', icon: History },
];

const adminItems: NavItem[] = [
  { label: 'Admin Dashboard', href: '/admin', icon: Shield, adminOnly: true },
  { label: 'Manage Zones', href: '/admin/zones', icon: MapPin, staffOnly: true },
  { label: 'Pricing', href: '/admin/pricing', icon: DollarSign, adminOnly: true },
  { label: 'Users & Roles', href: '/admin/users', icon: Users, adminOnly: true },
  { label: 'Analytics', href: '/admin/analytics', icon: BarChart3, adminOnly: true },
  { label: 'Settings', href: '/admin/settings', icon: Settings, adminOnly: true },
];

const Sidebar = () => {
  const location = useLocation();
  const { isAdmin, isStaff } = useAuth();
  const [collapsed, setCollapsed] = useState(true);

  const filteredNavItems = navItems.filter(item => {
    if (item.adminOnly && !isAdmin) return false;
    if (item.staffOnly && !isStaff) return false;
    return true;
  });

  const filteredAdminItems = adminItems.filter(item => {
    if (item.adminOnly && !isAdmin) return false;
    if (item.staffOnly && !isStaff) return false;
    return true;
  });

  return (
    <aside className={cn(
      "h-screen bg-sidebar border-r border-sidebar-border flex flex-col transition-all duration-300",
      collapsed ? "w-16" : "w-64"
    )}>
      {/* Logo */}
      <div className="p-4 border-b border-sidebar-border flex items-center justify-between">
        {!collapsed && (
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-sidebar-primary rounded-xl flex items-center justify-center">
              <Car className="w-6 h-6 text-sidebar-primary-foreground" />
            </div>
            <div>
              <h1 className="font-display font-bold text-sidebar-foreground">VIT Parking</h1>
              <p className="text-xs text-sidebar-foreground/60">Vellore Campus</p>
            </div>
          </div>
        )}
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setCollapsed(!collapsed)}
          className="text-sidebar-foreground hover:bg-sidebar-accent"
        >
          {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </Button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto p-2">
        <div className="space-y-1">
          {!collapsed && (
            <p className="px-3 py-2 text-xs font-semibold text-sidebar-foreground/50 uppercase tracking-wider">
              Main Menu
            </p>
          )}
          {filteredNavItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.href;
            return (
              <Link
                key={item.href}
                to={item.href}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                  isActive
                    ? "bg-sidebar-primary text-sidebar-primary-foreground"
                    : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                )}
                title={collapsed ? item.label : undefined}
              >
                <Icon className="w-5 h-5 flex-shrink-0" />
                {!collapsed && <span>{item.label}</span>}
              </Link>
            );
          })}
        </div>

        {filteredAdminItems.length > 0 && (
          <div className="mt-6 space-y-1">
            {!collapsed && (
              <p className="px-3 py-2 text-xs font-semibold text-sidebar-foreground/50 uppercase tracking-wider">
                Administration
              </p>
            )}
            {filteredAdminItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.href;
              return (
                <Link
                  key={item.href}
                  to={item.href}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                    isActive
                      ? "bg-sidebar-primary text-sidebar-primary-foreground"
                      : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                  )}
                  title={collapsed ? item.label : undefined}
                >
                  <Icon className="w-5 h-5 flex-shrink-0" />
                  {!collapsed && <span>{item.label}</span>}
                </Link>
              );
            })}
          </div>
        )}
      </nav>

      {/* Help */}
      {!collapsed && (
        <div className="p-4 border-t border-sidebar-border">
          <Link
            to="/help"
            className="flex items-center gap-3 px-3 py-2 text-sm text-sidebar-foreground/70 hover:text-sidebar-foreground"
          >
            <HelpCircle className="w-5 h-5" />
            <span>Help & Support</span>
          </Link>
        </div>
      )}
    </aside>
  );
};

export default Sidebar;