"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Library, History, Settings, Menu, X, LogOut } from "lucide-react";
import { useState } from "react";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/dashboard/library", label: "Resume", icon: Library },
  { href: "/dashboard/history", label: "Session History", icon: History },
];

export function NavRail() {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      {/* Mobile Menu Toggle */}
      <div className="md:hidden flex items-center justify-between p-4 bg-surface border-b border-surface-hover w-full shrink-0">
        <span className="font-heading font-bold text-lg text-text-primary">MTI Dashboard</span>
        <button onClick={() => setIsOpen(!isOpen)} className="text-text-muted hover:text-text-primary">
          {isOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {/* Nav Rail */}
      <nav className={`
        ${isOpen ? "block" : "hidden"} 
        md:block w-full md:w-64 bg-surface border-r border-surface-hover shrink-0 flex flex-col h-full absolute md:relative z-50
      `}>
        <div className="hidden md:flex p-6 border-b border-surface-hover">
          <span className="font-heading font-bold text-xl text-text-primary">MTI Dashboard</span>
        </div>
        
        <div className="flex-1 py-4 flex flex-col gap-2">
          {NAV_ITEMS.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setIsOpen(false)}
                className={`flex items-center gap-3 px-6 py-3 font-medium transition-colors ${
                  isActive
                    ? "text-text-primary bg-surface-hover border-l-4"
                    : "text-text-muted hover:text-text-primary hover:bg-surface-hover border-l-4 border-transparent"
                }`}
                style={{ borderColor: isActive ? "var(--accent-readiness)" : undefined }}
              >
                <item.icon size={20} className={isActive ? "text-accent-readiness" : ""} />
                {item.label}
              </Link>
            );
          })}
        </div>
        <div className="p-4 border-t border-surface-hover mt-auto">
          <button
            onClick={() => {
              import('@/app/login/actions').then(({ signOut }) => signOut());
            }}
            className="flex items-center gap-3 px-6 py-3 font-medium transition-colors text-text-muted hover:text-accent-alert hover:bg-surface-hover w-full text-left rounded-md"
          >
            <LogOut size={20} />
            Sign Out
          </button>
        </div>
      </nav>
      
      {/* Mobile Overlay */}
      {isOpen && (
        <div 
          className="md:hidden fixed inset-0 bg-black/50 z-40"
          onClick={() => setIsOpen(false)}
        />
      )}
    </>
  );
}
