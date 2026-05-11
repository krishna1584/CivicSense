import { Sidebar } from './Sidebar';

export function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-base-950">
      <Sidebar />
      <main className="flex-1 ml-64 min-h-screen relative overflow-hidden">
        {/* Subtle background glow effect */}
        <div className="absolute top-0 inset-x-0 h-[500px] bg-hero-gradient pointer-events-none opacity-50" />
        
        {/* Content area */}
        <div className="page-container relative z-10 animate-fade_in">
          {children}
        </div>
      </main>
    </div>
  );
}
