'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { clsx } from 'clsx';
import { useAuthStore, useNotificationStore } from '@/lib/store';
import {
  LayoutDashboard, PlusCircle, Map, FileText, Bell,
  User, Shield, BarChart2, LogOut, Zap
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

const adminNav = [
  { href: '/admin', label: 'Command Center', icon: Shield },
  { href: '/admin/issues', label: 'All Issues', icon: FileText },
  { href: '/admin/analytics', label: 'Analytics', icon: BarChart2 },
  { href: '/admin/users', label: 'Users', icon: User },
  { href: '/explore', label: 'Explore Map', icon: Map },
];

export function Sidebar() {
  const pathname = usePathname();
  const { user, setUser } = useAuthStore();
  const { unreadCount } = useNotificationStore();

  const nav = user?.role === 'admin' || user?.role === 'department_staff' ? adminNav : citizenNav;

  const handleLogout = async () => {
    await authApi.logout().catch(() => {});
    setUser(null);
    window.location.href = '/';
  };

  return (
    <aside className="fixed left-0 top-0 h-screen w-64 bg-[#0E131A] border-r border-white/5 flex flex-col z-50">
      {/* Logo */}
      <div className="px-6 py-5 border-b border-white/5">
        <Link href="/" className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-[#00FF94]/20 flex items-center justify-center">
            <Zap size={16} className="text-[#00FF94]" />
          </div>
          <span className="font-bold text-lg tracking-tight">
            Civic<span className="text-[#00FF94]">Sense</span>
          </span>
        </Link>
        <div className="flex items-center gap-1.5 mt-3">
          <span className="w-1.5 h-1.5 rounded-full bg-[#00FF94] animate-pulse" />
          <span className="text-[10px] text-[#9CA3AF] uppercase tracking-widest">System Operational</span>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {nav.map((item) => {
          const Icon = item.icon;
          const isActive =
            item.href === '/admin'
              ? pathname === '/admin'
              : pathname === item.href || pathname.startsWith(item.href + '/');
          return (
            <Link key={item.href} href={item.href}>
              <div className={clsx('sidebar-item', isActive && 'active')}>
                <Icon size={18} />
                <span className="text-sm font-medium">{item.label}</span>
                {item.href === '/notifications' && unreadCount > 0 && (
                  <span className="ml-auto bg-[#00FF94] text-[#05070A] text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
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
        <div className="px-3 py-4 border-t border-white/5">
          <div className="flex items-center gap-3 px-3 py-2 mb-2">
            <div className="w-8 h-8 rounded-full bg-[#00FF94]/20 flex items-center justify-center text-[#00FF94] font-bold text-sm">
              {user.name[0].toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate">{user.name}</p>
              <p className="text-[10px] text-[#9CA3AF] capitalize">{user.role.replace('_', ' ')}</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="sidebar-item w-full text-[#EF4444] hover:text-[#EF4444] hover:bg-[#EF4444]/10"
          >
            <LogOut size={16} />
            <span className="text-sm">Sign Out</span>
          </button>
        </div>
      )}
    </aside>
  );
}
