import { useCallback, useEffect, useRef, useState } from 'react';
import { Upload, X, FileImage } from 'lucide-react';
import { ACCEPTED_MEDIA_TYPES, MAX_MEDIA_FILES, MAX_MEDIA_SIZE_MB } from './types';

interface Props {
  files: File[];
  onFilesChange: (files: File[]) => void;
  acceptedTypes?: string[];
  maxSizeMb?: number;
  formatsLabel?: string;
}

export function StepEvidence({
  files,
  onFilesChange,
  acceptedTypes = ACCEPTED_MEDIA_TYPES,
  maxSizeMb = MAX_MEDIA_SIZE_MB,
  formatsLabel = 'JPG, PNG, WEBP, GIF, MP4, MOV',
}: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [previews, setPreviews] = useState<string[]>([]);
  const [notice, setNotice] = useState('');

  // Regenerate object-URL previews whenever files change
  useEffect(() => {
    const urls = files.map(f => URL.createObjectURL(f));
    setPreviews(urls);
    return () => urls.forEach(URL.revokeObjectURL);
  }, [files]);

  const addFiles = (incoming: File[]) => {
    const problems: string[] = [];
    const valid = incoming.filter(f => {
      if (!acceptedTypes.includes(f.type)) { problems.push(`${f.name}: unsupported file type`); return false; }
      if (f.size > maxSizeMb * 1024 * 1024) { problems.push(`${f.name}: larger than ${maxSizeMb} MB`); return false; }
      return true;
    });
    if (files.length + valid.length > MAX_MEDIA_FILES) problems.push(`Only ${MAX_MEDIA_FILES} files can be attached.`);
    setNotice(problems.join(' · '));
    onFilesChange([...files, ...valid].slice(0, MAX_MEDIA_FILES));
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    addFiles(Array.from(e.dataTransfer.files));
  }, [files]); // eslint-disable-line

  const removeFile = (idx: number) =>
    onFilesChange(files.filter((_, i) => i !== idx));

  return (
    <div className="space-y-4 animate-fade_in">
      <div className="card p-5">
        <label className="label-micro block mb-3">
          Photo / Video Evidence{' '}
          <span className="text-content-muted normal-case tracking-normal font-normal">(required — up to {MAX_MEDIA_FILES} files)</span>
        </label>

        {/* Drop zone */}
        <div
          onDrop={handleDrop}
          onDragOver={e => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onClick={() => fileInputRef.current?.click()}
          className="border-2 border-dashed rounded-xl p-6 sm:p-10 text-center transition-all cursor-pointer"
          style={{
            borderColor: dragging ? 'rgb(var(--accent-primary))' : 'rgb(var(--border-subtle))',
            background:  dragging ? 'rgb(var(--accent-primary) / 0.04)' : 'transparent',
          }}
        >
          <Upload size={28} className="mx-auto mb-3" style={{ color: dragging ? 'rgb(var(--accent-primary))' : 'rgb(var(--content-muted))' }} />
          <p className="text-sm font-medium" style={{ color: dragging ? 'rgb(var(--accent-primary))' : 'rgb(var(--content-muted))' }}>
            Drag &amp; drop or click to upload
          </p>
          <p className="text-xs text-content-muted mt-1">{formatsLabel} · Max {maxSizeMb} MB each</p>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept={acceptedTypes.join(',')}
            className="hidden"
            onClick={e => e.stopPropagation()}
            onChange={e => {
              addFiles(Array.from(e.target.files || []));
              e.target.value = ''; // lets the same file be chosen again after removing it
            }}
          />
        </div>

        {notice && <p className="text-xs text-state-error mt-3">{notice}</p>}

        {/* File grid */}
        {files.length > 0 && (
          <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 gap-3">
            {files.map((f, i) => (
              <div
                key={i}
                className="relative rounded-xl overflow-hidden group"
                style={{ background: 'rgb(var(--base-900))', border: '1px solid rgb(var(--border-subtle))' }}
              >
                {f.type.startsWith('image/') && previews[i] ? (
                  <img src={previews[i]} alt="" className="w-full h-24 object-cover" />
                ) : (
                  <div className="w-full h-24 flex items-center justify-center">
                    <FileImage size={24} className="text-content-muted" />
                  </div>
                )}
                <div className="p-2">
                  <p className="text-content-primary text-xs truncate">{f.name}</p>
                  <p className="text-content-muted text-[10px]">{(f.size / 1024 / 1024).toFixed(1)} MB</p>
                </div>
                <button
                  onClick={e => { e.stopPropagation(); removeFile(i); }}
                  aria-label={`Remove ${f.name}`}
                  className="hover-reveal absolute top-2 right-2 w-7 h-7 rounded-full bg-black/60 flex items-center justify-center"
                >
                  <X size={13} className="text-white" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
