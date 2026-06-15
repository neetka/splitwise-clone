import React from 'react';
import { useAuth } from '../context/AuthContext';
import { LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function DashboardLayout({ children }) {
  const { user, logout } = useAuth();

  return (
    <div className="min-h-screen bg-background">
      {/* Top Navigation */}
      <nav className="sticky top-0 z-40 w-full bg-surface border-b border-border shadow-sm">
        <div className="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded bg-primary flex items-center justify-center text-white font-bold text-lg">
                S
              </div>
              <span className="font-semibold text-xl text-textPrimary tracking-tight">Splitwise MVP<span className="text-primary text-xs ml-1 align-top font-bold">INR</span></span>
            </div>
            
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-textSecondary font-medium border border-border">
                  {user?.name?.charAt(0)?.toUpperCase() || 'U'}
                </div>
                <span className="text-sm font-medium text-textPrimary hidden sm:block">
                  {user?.name || 'User'}
                </span>
              </div>
              <div className="h-6 w-px bg-border hidden sm:block"></div>
              <Button variant="ghost" size="sm" onClick={logout} className="text-textSecondary hover:text-danger hover:bg-danger/10">
                <LogOut className="h-4 w-4 mr-2" />
                Logout
              </Button>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content Area */}
      <main className="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>
    </div>
  );
}
