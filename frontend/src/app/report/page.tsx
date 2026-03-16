'use client';
import { useEffect, useState, useCallback } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { issuesApi } from '@/lib/api';
import { Category } from '@/types';
import { Upload, MapPin, AlertTriangle, Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';

const SEVERITY_OPTIONS = [
  { value: 'low', label: 'Low', color: 'text-emerald-400 border-emerald-400/30 bg-emerald-400/10' },
  { value: 'medium', label: 'Medium', color: 'text-[#F59E0B] border-[#F59E0B]/30 bg-[#F59E0B]/10' },
  { value: 'high', label: 'High', color: 'text-orange-400 border-orange-400/30 bg-orange-400/10' },
  { value: 'critical', label: 'Critical', color: 'text-[#EF4444] border-[#EF4444]/30 bg-[#EF4444]/10 shadow-glow-red' },
];

export default function ReportIssuePage() {
  const router = useRouter();
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [dragging, setDragging] = useState(false);
  const [preview, setPreview] = useState({
    title: '', description: '', severity: 'medium', category: '', address: ''
  });

  const [form, setForm] = useState({
    title: '', description: '', category_id: '', severity: 'medium',
    latitude: '', longitude: '', address: '', is_anonymous: false,
  });

  useEffect(() => {
    issuesApi.categories().then((r) => setCategories(r.data.categories)).catch(console.error);
  }, []);

  const handleGetLocation = () => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setForm((f) => ({ ...f, latitude: pos.coords.latitude.toString(), longitude: pos.coords.longitude.toString() }));
      },
      (err) => setError('Could not get location: ' + err.message)
    );
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const dropped = Array.from(e.dataTransfer.files).slice(0, 5);
    setFiles((prev) => [...prev, ...dropped].slice(0, 5));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.latitude || !form.longitude) return setError('Please set a location');
    setLoading(true);
    setError('');
    try {
      const fd = new FormData();
      Object.entries(form).forEach(([k, v]) => fd.append(k, String(v)));
      files.forEach((f) => fd.append('media', f));
      const res = await issuesApi.create(fd);
      router.push(`/issues/${res.data.issue.id}`);
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } } };
      setError(e?.response?.data?.error || 'Failed to submit issue');
    } finally {
      setLoading(false);
    }
  };

  const selCategory = categories.find((c) => c.id === form.category_id);

  return (
    <AppLayout>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gradient">Report an Issue</h1>
        <p className="text-[#9CA3AF] mt-1">Document a civic problem and track its resolution.</p>
      </div>

      <div className="grid lg:grid-cols-5 gap-6">
        {/* Form */}
        <form onSubmit={handleSubmit} className="lg:col-span-3 space-y-5">
          {error && (
            <div className="bg-[#EF4444]/10 border border-[#EF4444]/30 rounded-xl p-4 flex items-center gap-2 text-[#EF4444]">
              <AlertTriangle size={16} /> {error}
            </div>
          )}

          {/* Title */}
          <div className="card p-5">
            <label className="label-micro block mb-2">Issue Title *</label>
            <input
              className="input-dark"
              placeholder="Brief description of the problem..."
              value={form.title}
              onChange={(e) => { setForm(f => ({ ...f, title: e.target.value })); setPreview(p => ({ ...p, title: e.target.value })); }}
              required
            />
          </div>

          {/* Description */}
          <div className="card p-5">
            <label className="label-micro block mb-2">Detailed Description *</label>
            <textarea
              className="input-dark resize-none"
              rows={5}
              placeholder="Describe the issue in detail. Include any relevant observations..."
              value={form.description}
              onChange={(e) => { setForm(f => ({ ...f, description: e.target.value })); setPreview(p => ({ ...p, description: e.target.value })); }}
              required
            />
          </div>

          {/* Category + Severity */}
          <div className="grid grid-cols-2 gap-4">
            <div className="card p-5">
              <label className="label-micro block mb-2">Category *</label>
              <select
                className="input-dark"
                value={form.category_id}
                onChange={(e) => { setForm(f => ({ ...f, category_id: e.target.value })); setPreview(p => ({ ...p, category: categories.find(c=>c.id===e.target.value)?.name || '' })); }}
                required
              >
                <option value="">Select category...</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.icon} {c.name}</option>
                ))}
              </select>
            </div>
            <div className="card p-5">
              <label className="label-micro block mb-2">Severity *</label>
              <div className="grid grid-cols-2 gap-2">
                {SEVERITY_OPTIONS.map((s) => (
                  <button
                    key={s.value}
                    type="button"
                    onClick={() => { setForm(f => ({ ...f, severity: s.value })); setPreview(p => ({ ...p, severity: s.value })); }}
                    className={`px-3 py-1.5 rounded-lg border text-xs font-semibold transition-all ${s.color} ${form.severity === s.value ? 'ring-1 ring-current' : 'opacity-50'}`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Location */}
          <div className="card p-5">
            <label className="label-micro block mb-3">Location *</label>
            <div className="grid grid-cols-2 gap-3 mb-3">
              <input className="input-dark" placeholder="Latitude" value={form.latitude} onChange={(e) => setForm(f => ({ ...f, latitude: e.target.value }))} required />
              <input className="input-dark" placeholder="Longitude" value={form.longitude} onChange={(e) => setForm(f => ({ ...f, longitude: e.target.value }))} required />
            </div>
            <input
              className="input-dark mb-3"
              placeholder="Address (optional)"
              value={form.address}
              onChange={(e) => { setForm(f => ({ ...f, address: e.target.value })); setPreview(p => ({ ...p, address: e.target.value })); }}
            />
            <button type="button" onClick={handleGetLocation} className="flex items-center gap-2 text-[#00aaef] text-sm hover:underline">
              <MapPin size={14} /> Use My Current Location
            </button>
            {form.latitude && form.longitude && (
              <p className="text-emerald-400 text-xs mt-2">✓ Location set: {parseFloat(form.latitude).toFixed(5)}, {parseFloat(form.longitude).toFixed(5)}</p>
            )}
          </div>

          {/* Media Upload */}
          <div className="card p-5">
            <label className="label-micro block mb-3">Media Evidence (optional)</label>
            <div
              onDrop={handleDrop}
              onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              className={`border-2 border-dashed rounded-xl p-8 text-center transition-all cursor-pointer ${dragging ? 'border-[#00aaef] bg-[#00aaef]/5' : 'border-white/10 hover:border-[#00aaef]/30'}`}
              onClick={() => document.getElementById('fileInput')?.click()}
            >
              <Upload size={24} className={`mx-auto mb-2 ${dragging ? 'text-[#00aaef]' : 'text-[#9CA3AF]'}`} />
              <p className="text-[#9CA3AF] text-sm">Drag & drop or click to upload</p>
              <p className="text-[#9CA3AF] text-xs mt-1">Up to 5 files · JPG, PNG, MP4 · Max 50MB each</p>
              <input id="fileInput" type="file" multiple accept="image/*,video/*" className="hidden"
                onChange={(e) => setFiles(Array.from(e.target.files || []).slice(0, 5))} />
            </div>
            {files.length > 0 && (
              <div className="mt-3 space-y-1">
                {files.map((f, i) => (
                  <div key={i} className="flex items-center justify-between text-sm bg-[#11161D] rounded-lg px-3 py-2">
                    <span className="text-white truncate">{f.name}</span>
                    <button type="button" onClick={() => setFiles(files.filter((_, j) => j !== i))} className="text-[#EF4444] text-xs ml-2">✕</button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Anonymous */}
          <div className="card p-4 flex items-center gap-3">
            <input type="checkbox" id="anon" checked={form.is_anonymous} onChange={(e) => setForm(f => ({ ...f, is_anonymous: e.target.checked }))} className="w-4 h-4 accent-[#00aaef]" />
            <label htmlFor="anon" className="text-sm text-[#9CA3AF] cursor-pointer">Submit anonymously (your name won't be shown publicly)</label>
          </div>

          <button type="submit" disabled={loading} className="btn-primary w-full py-3.5 flex items-center justify-center gap-2 text-base">
            {loading ? <><Loader2 size={18} className="animate-spin" /> Submitting...</> : 'Submit Issue Report'}
          </button>
        </form>

        {/* Live Preview */}
        <div className="lg:col-span-2">
          <div className="sticky top-6">
            <p className="label-micro mb-3 text-[#00aaef]">Live Preview</p>
            <div className="card p-5">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-2xl">{selCategory?.icon || '📋'}</span>
                <span className="label-micro">{preview.category || 'Category'}</span>
              </div>
              <h3 className="font-semibold text-white mb-2">{preview.title || 'Issue title will appear here...'}</h3>
              <p className="text-[#9CA3AF] text-sm mb-4 line-clamp-3">{preview.description || 'Description preview...'}</p>
              {preview.address && (
                <p className="text-[#9CA3AF] text-xs flex items-center gap-1 mb-3"><MapPin size={11} />{preview.address}</p>
              )}
              <div className="flex items-center gap-2">
                <span className={`px-2 py-0.5 rounded-lg border text-xs font-semibold ${SEVERITY_OPTIONS.find(s=>s.value===preview.severity)?.color}`}>
                  {preview.severity.toUpperCase()}
                </span>
                <span className="px-2 py-0.5 rounded-lg border border-[#9CA3AF]/20 bg-[#9CA3AF]/10 text-[#9CA3AF] text-xs">Reported</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
