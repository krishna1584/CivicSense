// Shared types and constants for the report flow
export const SEVERITY_OPTIONS = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'critical', label: 'Critical' },
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
