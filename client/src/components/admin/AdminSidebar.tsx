'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, Users, Shield } from 'lucide-react';

export default function AdminSidebar() {
  const pathname = usePathname();

  const links = [
    { href: '/admin', label: 'Dashboard', icon: LayoutDashboard },
    { href: '/admin/users', label: 'Quản lý người dùng', icon: Users },
  ];

  return (
    <aside className="w-64 bg-slate-900 text-white flex flex-col hidden md:flex">
      <div className="h-16 flex items-center px-6 border-b border-slate-800">
        <Shield className="text-indigo-400 mr-2" />
        <span className="font-bold text-lg tracking-wide">Admin Panel</span>
      </div>
      
      <div className="flex-1 py-6 px-3 space-y-1">
        {links.map((link) => {
          const active = pathname === link.href || (link.href !== '/admin' && pathname.startsWith(link.href));
          const Icon = link.icon;
          return (
            <Link 
              key={link.href} 
              href={link.href}
              className={`flex items-center px-3 py-2.5 rounded-lg transition-colors ${
                active 
                  ? 'bg-indigo-600 text-white' 
                  : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <Icon size={18} className="mr-3" />
              <span className="font-medium text-sm">{link.label}</span>
            </Link>
          );
        })}
      </div>
      
      <div className="p-4 text-xs text-slate-500 border-t border-slate-800">
        Learn-Hub v2.0
      </div>
    </aside>
  );
}
