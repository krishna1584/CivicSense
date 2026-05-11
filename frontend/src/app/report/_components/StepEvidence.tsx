import { useCallback, useEffect, useRef, useState } from 'react';
import { Upload, X, FileImage } from 'lucide-react';

interface Props {
  files: File[];
  onFilesChange: (files: File[]) => void;
}

export function StepEvidence({ files, onFilesChange }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [previews, setPreviews] = useState<string[]>([]);

  // Regenerate object-URL previews whenever files change
  useEffect(() => {
    const urls = files.map(f => URL.createObjectURL(f));
    setPreviews(urls);
    return () => urls.forEach(URL.revokeObjectURL);
  }, [files]);

  const addFiles = (incoming: File[]) => {
    const valid = incoming.filter(f => f.type.startsWith('image/') || f.type.startsWith('video/'));
    onFilesChange([...files, ...valid].slice(0, 5));
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    addFiles(Array.from(e.dataTransfer.files));
  }, [files]); // eslint-disable-line

  const removeFile = (idx: number) =>
    onFilesChange(files.filter((_, i) => i !== idx));

  return (
    <div className="space-y-4 animate-fadeIn">
      <div className="card p-5">
        <label className="label-micro block mb-3">
          Photo / Video Evidence{' '}
          <span className="text-[#6B7280] normal-case tracking-normal font-normal">(optional — up to 5 files)</span>
        </label>

        {/* Drop zone */}
        <div
          onDrop={handleDrop}
          onDragOver={e => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onClick={() => fileInputRef.current?.click()}
          className="border-2 border-dashed rounded-xl p-10 text-center transition-all cursor-pointer"
          style={{
            borderColor: dragging ? '#61C0FF' : 'rgba(255,255,255,0.08)',
            background:  dragging ? 'rgba(97,192,255,0.04)' : 'transparent',
          }}
        >
          <Upload size={28} className="mx-auto mb-3" style={{ color: dragging ? '#61C0FF' : '#6B7280' }} />
          <p className="text-sm font-medium" style={{ color: dragging ? '#61C0FF' : '#9CA3AF' }}>
            Drag &amp; drop or click to upload
          </p>
          <p className="text-xs text-[#6B7280] mt-1">JPG, PNG, MP4 · Max 50 MB each</p>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/*,video/*"
            className="hidden"
            onChange={e => addFiles(Array.from(e.target.files || []))}
          />
        </div>

        {/* File grid */}
        {files.length > 0 && (
          <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 gap-3">
            {files.map((f, i) => (
              <div
                key={i}
                className="relative rounded-xl overflow-hidden group"
                style={{ background: '#0E131A', border: '1px solid rgba(255,255,255,0.06)' }}
              >
                {f.type.startsWith('image/') && previews[i] ? (
                  <img src={previews[i]} alt="" className="w-full h-24 object-cover" />
                ) : (
                  <div className="w-full h-24 flex items-center justify-center">
                    <FileImage size={24} className="text-[#6B7280]" />
                  </div>
                )}
                <div className="p-2">
                  <p className="text-white text-xs truncate">{f.name}</p>
                  <p className="text-[#6B7280] text-[10px]">{(f.size / 1024 / 1024).toFixed(1)} MB</p>
                </div>
                <button
                  onClick={e => { e.stopPropagation(); removeFile(i); }}
                  className="absolute top-2 right-2 w-6 h-6 rounded-full bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X size={12} className="text-white" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
