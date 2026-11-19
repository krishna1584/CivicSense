// Shared types and constants for the report flow
export const SEVERITY_OPTIONS = [
  { value: 'low',      label: 'Low',      color: '#10B981', bg: 'rgba(16,185,129,0.1)',  border: 'rgba(16,185,129,0.3)'  },
  { value: 'medium',   label: 'Medium',   color: '#F59E0B', bg: 'rgba(245,158,11,0.1)',  border: 'rgba(245,158,11,0.3)'  },
  { value: 'high',     label: 'High',     color: '#F97316', bg: 'rgba(249,115,22,0.1)',  border: 'rgba(249,115,22,0.3)'  },
  { value: 'critical', label: 'Critical', color: '#EF4444', bg: 'rgba(239,68,68,0.1)',   border: 'rgba(239,68,68,0.3)'   },
] as const;

// Must match the types the backend accepts in middleware/upload.js
export const ACCEPTED_MEDIA_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'video/mp4', 'video/quicktime'];
export const MAX_MEDIA_SIZE_MB = 50;
export const MAX_MEDIA_FILES = 5;
export const ANONYMOUS_MEDIA_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
export const ANONYMOUS_MAX_SIZE_MB = 15;

export type SeverityValue = typeof SEVERITY_OPTIONS[number]['value'];

export const STEPS = ['Details', 'Location', 'Evidence', 'Review'] as const;

export interface ReportForm {
  title: string;
  description: string;
  category_id: string;
  severity: SeverityValue;
  latitude: string;
  longitude: string;
  address: string;
  is_anonymous: boolean;
}

export const DEFAULT_FORM: ReportForm = {
  title: '',
  description: '',
  category_id: '',
  severity: 'medium',
  latitude: '',
  longitude: '',
  address: '',
  is_anonymous: false,
};
