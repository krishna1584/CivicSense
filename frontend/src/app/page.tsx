'use client';
import Link from 'next/link';
import { ArrowRight, MapPin, TrendingUp, Shield, Zap, BarChart3, Globe } from 'lucide-react';

const features = [
  { icon: MapPin, title: 'Location-Based Reporting', desc: 'GPS-powered issue pinning with reverse geocoding and proximity search.' },
  { icon: TrendingUp, title: 'Real-Time Tracking', desc: 'Live status updates via WebSocket. Watch your issue move from Reported to Resolved.' },
  { icon: Shield, title: 'Transparent Audit Trail', desc: 'Every status change, admin action, and resolution is publicly logged forever.' },
  { icon: BarChart3, title: 'Analytics Dashboard', desc: 'City-level KPIs: resolution rates, SLA adherence, department performance.' },
  { icon: Globe, title: 'Community Engagement', desc: 'Upvote, follow, and comment. Civic impact measured by real community data.' },
  { icon: Zap, title: 'Admin Command Center', desc: 'Bulk actions, heatmaps, SLA timers, and department assignment workflows.' },
];

const stats = [
  { label: 'Issues Tracked', value: '24,891' },
  { label: 'Resolution Rate', value: '78%' },
  { label: 'Avg Response Time', value: '36h' },
  { label: 'Cities Active', value: '12' },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[#05070A] text-white">
      {/* Navbar */}
      <nav className="fixed top-0 left-0 right-0 z-50 glass-panel border-b border-white/5">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#00FF94]/20 flex items-center justify-center">
              <Zap size={16} className="text-[#00FF94]" />
            </div>
            <span className="font-bold text-lg">Civic<span className="text-[#00FF94]">Sense</span></span>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/explore" className="text-[#9CA3AF] hover:text-white text-sm transition-colors">Explore</Link>
            <Link href="/login" className="btn-outline text-sm py-2 px-4">Sign In</Link>
            <Link href="/register" className="btn-primary text-sm py-2 px-4">Get Started</Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative pt-32 pb-24 px-6 overflow-hidden">
        {/* Background grid + glow */}
        <div className="absolute inset-0 bg-grid opacity-100" />
        <div className="absolute inset-0 bg-hero-glow" />

        <div className="relative max-w-5xl mx-auto text-center">
          {/* System status badge */}
          <div className="inline-flex items-center gap-2 bg-[#00FF94]/10 border border-[#00FF94]/20 rounded-full px-4 py-1.5 mb-8">
            <span className="w-1.5 h-1.5 rounded-full bg-[#00FF94] animate-pulse" />
            <span className="text-[#00FF94] text-xs font-medium uppercase tracking-widest">System Operational</span>
          </div>

          <h1 className="text-6xl md:text-7xl font-black mb-6 leading-[1.05] tracking-tight">
            <span className="text-gradient">Empower Your City.</span>
            <br />
            <span className="text-[#00FF94]">In Real Time.</span>
          </h1>

          <p className="text-xl text-[#9CA3AF] max-w-2xl mx-auto mb-10 leading-relaxed">
            Report public infrastructure issues, track government response, and demand transparency—all in one civic intelligence platform.
          </p>

          <div className="flex items-center justify-center gap-4 flex-wrap">
            <Link href="/report" className="btn-primary flex items-center gap-2 text-base py-3 px-8">
              Report an Issue
              <ArrowRight size={18} />
            </Link>
            <Link href="/explore" className="btn-outline flex items-center gap-2 text-base py-3 px-8">
              Explore Issues
            </Link>
          </div>
        </div>
      </section>

      {/* Stats bar */}
      <section className="py-10 border-y border-white/5 bg-[#0B0F14]">
        <div className="max-w-5xl mx-auto px-6 grid grid-cols-2 md:grid-cols-4 gap-8">
          {stats.map((s) => (
            <div key={s.label} className="text-center">
              <div className="text-3xl font-black text-[#00FF94] mb-1">{s.value}</div>
              <div className="label-micro">{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section className="py-24 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <p className="label-micro mb-3 text-[#00FF94]">Platform Features</p>
            <h2 className="text-4xl font-bold text-gradient">Built for Civic Accountability</h2>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
            {features.map((f) => {
              const Icon = f.icon;
              return (
                <div key={f.title} className="card card-hover p-6">
                  <div className="w-10 h-10 rounded-xl bg-[#00FF94]/10 flex items-center justify-center mb-4">
                    <Icon size={20} className="text-[#00FF94]" />
                  </div>
                  <h3 className="font-semibold text-white mb-2">{f.title}</h3>
                  <p className="text-[#9CA3AF] text-sm leading-relaxed">{f.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 px-6">
        <div className="max-w-3xl mx-auto text-center card p-12 relative overflow-hidden">
          <div className="absolute inset-0 bg-[#00FF94]/3 rounded-2xl" />
          <div className="relative">
            <h2 className="text-4xl font-bold mb-4 text-gradient">Ready to Make Your Voice Count?</h2>
            <p className="text-[#9CA3AF] mb-8">Join thousands of citizens driving civic change through data and transparency.</p>
            <Link href="/register" className="btn-primary inline-flex items-center gap-2 text-base py-3 px-10">
              Start Reporting Free
              <ArrowRight size={18} />
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/5 py-8 px-6">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <span className="font-bold">Civic<span className="text-[#00FF94]">Sense</span></span>
          <p className="text-[#9CA3AF] text-sm">© 2026 CivicSense. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
