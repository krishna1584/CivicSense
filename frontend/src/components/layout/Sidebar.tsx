'use client';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { clsx } from 'clsx';
import { useAuthStore, useNotificationStore } from '@/lib/store';
import {
  LayoutDashboard, PlusCircle, Map, FileText, Bell,
  User, Shield, BarChart2, LogOut, Hexagon, ClipboardList, Settings
} from 'lucide-react';
import { authApi } from '@/lib/api';

const citizenNav = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/report', label: 'Report Issue', icon: PlusCircle },
  { href: '/explore', label: 'Explore', icon: Map },
  { href: '/my-reports', label: 'My Reports', icon: FileText },
  { href: '/notifications', label: 'Notifications', icon: Bell },
  { href: '/profile', label: 'Profile', icon: User },
];

export function Sidebar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { user, setUser } = useAuthStore();
  const { unreadCount } = useNotificationStore();

  const getAdminNav = (role?: string) => {
    const base = [
      { href: '/admin?view=dashboard', label: 'Command Center', icon: Shield },
      { href: '/admin?view=issues', label: 'All Issues', icon: FileText },
      { href: '/admin?view=analytics', label: 'Analytics', icon: BarChart2 },
    ];
    
    if (role === 'admin') {
      base.push({ href: '/admin?view=users', label: 'Users', icon: User });
      base.push({ href: '/admin?view=logs', label: 'Audit Logs', icon: ClipboardList });
      base.push({ href: '/admin?view=settings', label: 'Settings', icon: Settings });
    }
    
    base.push({ href: '/explore', label: 'Explore Map', icon: Map });
    base.push({ href: '/notifications', label: 'Notifications', icon: Bell });
    return base;
  };

  const nav = user?.role === 'admin' || user?.role === 'department_staff' ? getAdminNav(user.role) : citizenNav;

  const handleLogout = async () => {
    await authApi.logout().catch(() => { });
    setUser(null);
    window.location.href = '/';
  };

  return (
    <aside className="fixed left-0 top-0 h-screen w-64 bg-base-900 border-r border-border-subtle flex flex-col z-50">
      {/* Logo */}
      <div className="px-6 py-8 border-b border-border-subtle/50">
        <Link href="/" className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-accent-primary/10 flex items-center justify-center border border-accent-primary/20 shadow-glow-primary">
            <Hexagon size={18} className="text-accent-primary" strokeWidth={2.5} />
          </div>
          <span className="font-bold text-xl tracking-tight text-content-primary">
            Civic<span className="text-content-secondary font-medium">Sense</span>
          </span>
        </Link>
        <div className="flex items-center gap-2 mt-5 bg-base-800 border border-border-subtle px-3 py-1.5 rounded-md w-max">
          <span className="w-1.5 h-1.5 rounded-full bg-state-success relative">
            <span className="absolute inset-0 rounded-full bg-state-success animate-ping opacity-75"></span>
          </span>
          <span className="text-[11px] text-content-secondary font-medium tracking-wide">System Operational</span>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-4 py-6 space-y-1 overflow-y-auto">
        <div className="label-micro mb-4 px-3">Menu</div>
        {nav.map((item) => {
          const Icon = item.icon;
          
          const [itemPath, itemQuery] = item.href.split('?');
          const viewParam = itemQuery?.split('view=')[1];
          
          let isActive = false;
          if (itemPath === '/admin') {
            if (pathname === '/admin') {
              const currentView = searchParams.get('view') || 'dashboard';
              isActive = viewParam ? currentView === viewParam : currentView === 'dashboard';
            }
          } else {
            isActive = pathname === item.href || pathname.startsWith(item.href + '/');
          }
          return (
            <Link key={item.href} href={item.href}>
              <div className={clsx('sidebar-item', isActive && 'active')}>
                <Icon size={18} strokeWidth={isActive ? 2.5 : 2} />
                <span>{item.label}</span>
                {item.href === '/notifications' && unreadCount > 0 && (
                  <span className="ml-auto bg-accent-primary text-white text-[10px] font-bold min-w-[1.25rem] h-5 px-1 rounded-full flex items-center justify-center">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </div>
            </Link>
          );
        })}
      </nav>

      {/* User Footer */}
      {user && (
        <div className="p-4 border-t border-border-subtle/50">
          <Link href="/profile" className="flex items-center gap-3 px-3 py-2 mb-3 bg-base-850 rounded-xl border border-border-subtle/50 hover:border-accent-secondary/30 hover:bg-base-800/50 transition-all duration-200 cursor-pointer group">
            <div className="w-9 h-9 rounded-lg overflow-hidden flex items-center justify-center bg-accent-secondary/10 text-accent-secondary font-bold text-sm border border-accent-secondary/20 flex-shrink-0 group-hover:border-accent-secondary/40 transition-colors">
              {user.avatar_url ? (
                <img src={user.avatar_url} alt={user.name} className="w-full h-full object-cover" />
              ) : (
                user.name[0].toUpperCase()
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-content-primary group-hover:text-accent-secondary transition-colors truncate">{user.name}</p>
              <p className="text-[11px] text-content-muted capitalize">{user.role.replace('_', ' ')}</p>
            </div>
          </Link>
          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-state-error font-medium transition-all duration-200 hover:bg-state-error/10"
          >
            <LogOut size={16} strokeWidth={2} />
            <span className="text-sm">Sign Out</span>
          </button>
        </div>
      )}
    </aside>
  );
}
