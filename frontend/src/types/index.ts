export type UserRole = 'citizen' | 'admin' | 'department_staff';
export type IssueStatus = 'reported' | 'acknowledged' | 'in_progress' | 'resolved' | 'rejected';
export type Severity = 'low' | 'medium' | 'high' | 'critical';
export type VoteType = 'upvote' | 'downvote';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  trust_score: number;
  avatar_url?: string;
  created_at: string;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  icon: string;
  description?: string;
}

export interface IssueMedia {
  id: string;
  url: string;
  type: 'image' | 'video';
}

export interface Issue {
  id: string;
  user_id: string;
  title: string;
  description: string;
  category_id: string;
  category_name?: string;
  category_slug?: string;
  category_icon?: string;
  subcategory_name?: string;
  severity: Severity;
  status: IssueStatus;
  latitude?: number;
  longitude?: number;
  address?: string;
  is_anonymous: boolean;
  upvote_count: number;
  downvote_count: number;
  follow_count: number;
  comment_count: number;
  reporter_name?: string;
  reporter_avatar?: string;
  assigned_to?: string;
  assigned_to_name?: string;
  department?: string;
  sla_hours?: number;
  sla_deadline?: string;
  sla_breached?: boolean;
  rejection_reason?: string;
  media?: IssueMedia[];
  distance?: number;
  created_at: string;
  updated_at: string;
  resolved_at?: string;
}

export interface Comment {
  id: string;
  issue_id: string;
  user_id: string;
  content: string;
  is_admin_comment: boolean;
  is_internal: boolean;
  parent_id?: string;
  author_name?: string;
  author_avatar?: string;
  author_role?: UserRole;
  created_at: string;
}

export interface StatusHistoryEntry {
  id: string;
  issue_id: string;
  old_status?: IssueStatus;
  new_status: IssueStatus;
  updated_by?: string;
  updated_by_name?: string;
  updated_by_role?: UserRole;
  comment?: string;
  updated_at: string;
}

export interface Notification {
  id: string;
  user_id: string;
  issue_id?: string;
  type: string;
  message: string;
  is_read: boolean;
  created_at: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface AdminStats {
  total: string;
  active: string;
  resolved: string;
  critical_active: string;
  resolution_rate: string;
  avg_resolution_hours: string;
  avg_acknowledge_hours: string;
}
