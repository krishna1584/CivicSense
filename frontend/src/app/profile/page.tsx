'use client';
import { useEffect, useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { SeverityBadge } from '@/components/ui/SeverityBadge';
import { usersApi } from '@/lib/api';
import { useAuthStore } from '@/lib/store';
import { Issue } from '@/types';
import { 
  User, Shield, Star, FileText, ThumbsUp, MessageSquare, Loader2, 
  MapPin, Edit, X, Upload, AlertCircle, CheckCircle2 
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import Link from 'next/link';

export default function ProfilePage() {
  const { user, setUser } = useAuthStore();
  const [issues, setIssues] = useState<Issue[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ totalVotes: 0, totalComments: 0 });

  // Edit profile states
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string>('');
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    if (!user) return;
    Promise.all([
      usersApi.myIssues({ limit: 20 }),
      usersApi.dashboard(),
    ]).then(([issuesRes, dashRes]) => {
      setIssues(issuesRes.data.issues);
      setStats({
        totalVotes: dashRes.data.stats.totalVotes,
        totalComments: dashRes.data.stats.totalComments,
      });
    }).catch(console.error)
    .finally(() => setLoading(false));
  }, [user]);

  if (!user) return (
    <AppLayout>
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <p className="text-[#9CA3AF]">Please <Link href="/login" className="text-[#00aaef] hover:underline">sign in</Link> to view your profile.</p>
      </div>
    </AppLayout>
  );

  const handleOpenEdit = () => {
    setName(user.name || '');
    setAddress(user.address || '');
    setAvatarFile(null);
    setAvatarPreview(user.avatar_url || '');
    setError('');
    setSuccess('');
    setIsEditOpen(true);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        setError('Image file is too large (max 5MB)');
        return;
      }
      setAvatarFile(file);
      setAvatarPreview(URL.createObjectURL(file));
      setError('');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Username cannot be empty');
      return;
    }
    setUpdating(true);
    setError('');
    setSuccess('');

    try {
      const formData = new FormData();
      formData.append('name', name.trim());
      formData.append('address', address.trim());
      if (avatarFile) {
        formData.append('avatar', avatarFile);
      }

      const res = await usersApi.updateProfile(formData);
      setUser(res.data.user);
      setSuccess('Profile updated successfully!');
      
      // Close modal after a brief delay
      setTimeout(() => {
        setIsEditOpen(false);
      }, 1000);
    } catch (err: any) {
      console.error(err);
      setError(err.response?.data?.error || 'Failed to update profile. Please try again.');
    } finally {
      setUpdating(false);
    }
  };

  const ROLE_LABEL: Record<string, string> = { 
    citizen: 'Citizen', 
    admin: 'Administrator', 
    department_staff: 'Department Staff' 
  };

  return (
    <AppLayout>
      {/* Profile Header */}
      <div className="card p-8 mb-6 flex flex-col md:flex-row items-center md:items-start gap-6 relative overflow-hidden">
        {/* Ambient background glow */}
        <div className="absolute -top-10 -right-10 w-48 h-48 bg-accent-primary/10 rounded-full blur-3xl -z-10" />
        
        {/* Profile photo container */}
        <div className="relative w-24 h-24 rounded-2xl overflow-hidden bg-base-950 flex items-center justify-center border border-border-subtle shadow-lg flex-shrink-0">
          {user.avatar_url ? (
            <img src={user.avatar_url} alt={user.name} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full bg-accent-primary/10 flex items-center justify-center text-accent-primary text-4xl font-extrabold">
              {user.name[0].toUpperCase()}
            </div>
          )}
        </div>

        {/* User profile details */}
        <div className="flex-1 text-center md:text-left">
          <div className="flex flex-col md:flex-row md:items-center gap-3 mb-2">
            <h1 className="text-2xl font-bold text-content-primary">{user.name}</h1>
            <div className="flex items-center justify-center gap-2">
              <span className="label-micro text-content-secondary bg-base-850 border border-border-subtle px-3 py-1 rounded-lg">
                {ROLE_LABEL[user.role] || user.role}
              </span>
            </div>
          </div>
          
          <p className="text-content-muted text-sm mb-2">{user.email}</p>
          
          {/* Address displaying under username */}
          <div className="flex items-center justify-center md:justify-start gap-2 mb-5 text-content-secondary">
            <MapPin size={16} className="text-accent-primary flex-shrink-0" />
            <span className="text-sm">
              {user.address || <span className="text-content-muted italic">No address provided</span>}
            </span>
          </div>

          {/* Trust Score & engagement stats */}
          <div className="flex flex-wrap items-center justify-center md:justify-start gap-6 border-t border-border-subtle/40 pt-4 mt-2">
            <div className="flex items-center gap-2">
              <Star size={16} className="text-[#F59E0B]" />
              <span className="text-content-primary font-semibold">{user.trust_score}</span>
              <span className="text-content-muted text-sm">Trust Score</span>
            </div>
            <div className="flex items-center gap-2">
              <FileText size={16} className="text-[#3B82F6]" />
              <span className="text-content-primary font-semibold">{issues.length}</span>
              <span className="text-content-muted text-sm">Issues Reported</span>
            </div>
            <div className="flex items-center gap-2">
              <ThumbsUp size={16} className="text-[#00aaef]" />
              <span className="text-content-primary font-semibold">{stats.totalVotes}</span>
              <span className="text-content-muted text-sm">Votes Cast</span>
            </div>
            <div className="flex items-center gap-2">
              <MessageSquare size={16} className="text-content-muted" />
              <span className="text-content-primary font-semibold">{stats.totalComments}</span>
              <span className="text-content-muted text-sm">Comments</span>
            </div>
          </div>
        </div>

        {/* Profile page action buttons */}
        <div className="flex flex-col gap-2 mt-4 md:mt-0 w-full md:w-auto">
          <button onClick={handleOpenEdit} className="btn-secondary flex items-center justify-center gap-2 text-sm">
            <Edit size={14} /> Edit Profile
          </button>
          
          {user.role === 'admin' && (
            <Link href="/admin" className="btn-secondary flex items-center justify-center gap-2 text-sm border-accent-primary/20 hover:border-accent-primary/50 text-accent-primary">
              <Shield size={14} /> Admin Panel
            </Link>
          )}
        </div>
      </div>

      {/* Edit Profile Modal */}
      {isEditOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-base-950/80 backdrop-blur-sm transition-opacity duration-300">
          <div className="glass-panel w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden border border-border-subtle relative flex flex-col max-h-[90vh] animate-[fadeIn_0.2s_ease-out]">
            
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-border-subtle/50">
              <h3 className="text-lg font-bold text-content-primary flex items-center gap-2">
                <Edit size={18} className="text-accent-primary" /> Edit Profile Details
              </h3>
              <button 
                onClick={() => setIsEditOpen(false)}
                className="text-content-muted hover:text-content-primary transition-colors duration-200 p-1.5 hover:bg-base-800 rounded-lg"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
              
              {/* Visual Alerts */}
              {error && (
                <div className="flex items-start gap-3 p-4 rounded-xl bg-state-error/10 border border-state-error/20 text-state-error text-sm">
                  <AlertCircle size={18} className="flex-shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}
              {success && (
                <div className="flex items-start gap-3 p-4 rounded-xl bg-state-success/10 border border-state-success/20 text-state-success text-sm">
                  <CheckCircle2 size={18} className="flex-shrink-0 mt-0.5" />
                  <span>{success}</span>
                </div>
              )}

              {/* Avatar Uploader and preview */}
              <div className="flex flex-col items-center justify-center space-y-3">
                <label className="label-micro text-center">Profile Photo</label>
                <div className="relative group w-24 h-24 rounded-full overflow-hidden bg-base-950 border-2 border-border-subtle cursor-pointer hover:border-accent-primary transition-all duration-300 shadow-inner">
                  {avatarPreview ? (
                    <img src={avatarPreview} alt="Avatar Preview" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full bg-accent-primary/10 flex items-center justify-center text-accent-primary text-4xl font-extrabold select-none">
                      {user.name ? user.name[0].toUpperCase() : 'U'}
                    </div>
                  )}
                  {/* Photo Hover Overlay */}
                  <div className="absolute inset-0 bg-base-950/70 flex flex-col items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                    <Upload size={20} className="mb-1 text-accent-primary" />
                    <span className="text-[10px] font-bold tracking-wider uppercase">Change Photo</span>
                  </div>
                  {/* Real file input */}
                  <input 
                    type="file" 
                    accept="image/*" 
                    onChange={handleFileChange}
                    className="absolute inset-0 opacity-0 cursor-pointer w-full h-full z-10" 
                  />
                </div>
                <p className="text-xs text-content-muted text-center max-w-xs">
                  JPG, PNG or WEBP. Max size 5MB.
                </p>
              </div>

              {/* Name Field */}
              <div className="space-y-2">
                <label className="label-micro block text-content-secondary">Username</label>
                <input 
                  type="text" 
                  value={name} 
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your username" 
                  className="input-dark" 
                  disabled={updating}
                  required
                />
              </div>

              {/* Address Field */}
              <div className="space-y-2">
                <label className="label-micro block text-content-secondary">Address</label>
                <textarea 
                  value={address} 
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Enter your street address, city, state" 
                  rows={3}
                  className="input-dark resize-none" 
                  disabled={updating}
                />
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-border-subtle/30">
                <button 
                  type="button" 
                  onClick={() => setIsEditOpen(false)}
                  disabled={updating}
                  className="btn-secondary flex-1 sm:flex-initial"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  disabled={updating}
                  className="btn-accent flex-1 sm:flex-initial flex items-center justify-center gap-2"
                >
                  {updating ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      Saving...
                    </>
                  ) : (
                    'Save Changes'
                  )}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* Recent Issues List */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-white flex items-center gap-2">
            <FileText size={16} className="text-[#00aaef]" /> Recent Reports
          </h2>
          <Link href="/my-reports" className="text-[#00aaef] text-sm hover:underline">View all →</Link>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-32">
            <Loader2 size={20} className="text-[#00aaef] animate-spin" />
          </div>
        ) : issues.length === 0 ? (
          <div className="card p-8 text-center text-[#9CA3AF]">
            No issues reported yet.{' '}
            <Link href="/report" className="text-[#00aaef] hover:underline">Report one now</Link>.
          </div>
        ) : (
          <div className="card overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/5 bg-[#11161D]">
                  <th className="py-3 px-4 text-left label-micro">Issue</th>
                  <th className="py-3 px-4 text-left label-micro">Status</th>
                  <th className="py-3 px-4 text-left label-micro">Severity</th>
                  <th className="py-3 px-4 text-left label-micro">Upvotes</th>
                  <th className="py-3 px-4 text-left label-micro">Reported</th>
                </tr>
              </thead>
              <tbody>
                {issues.map((issue) => (
                  <tr key={issue.id} className="border-b border-white/3 hover:bg-white/2 transition-colors">
                    <td className="py-3 px-4">
                      <Link href={`/issues/${issue.id}`} className="text-white hover:text-[#00aaef] transition-colors truncate max-w-xs block">
                        {issue.category_icon && <span className="mr-1">{issue.category_icon}</span>}
                        {issue.title}
                      </Link>
                    </td>
                    <td className="py-3 px-4"><StatusBadge status={issue.status} size="sm" /></td>
                    <td className="py-3 px-4"><SeverityBadge severity={issue.severity} /></td>
                    <td className="py-3 px-4 text-[#00aaef] font-semibold">{issue.upvote_count}</td>
                    <td className="py-3 px-4 text-[#9CA3AF] text-xs">
                      {formatDistanceToNow(new Date(issue.created_at), { addSuffix: true })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
