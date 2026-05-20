import { useState } from 'react';
import { MapPin, Loader2, CheckCircle2 } from 'lucide-react';
import { ReportForm } from './types';

interface Props {
  form: ReportForm;
  onChange: (field: keyof ReportForm, value: string) => void;
  onError: (msg: string) => void;
}

export function StepLocation({ form, onChange, onError }: Props) {
  const [locating, setLocating] = useState(false);

  const handleGPS = () => {
    if (!navigator.geolocation) {
      onError('Geolocation is not supported by your browser.');
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      pos => {
        onChange('latitude',  pos.coords.latitude.toString());
        onChange('longitude', pos.coords.longitude.toString());
        // Pre-fill address with coords if empty
        if (!form.address) {
          onChange('address', `${pos.coords.latitude.toFixed(5)}, ${pos.coords.longitude.toFixed(5)}`);
        }
        setLocating(false);
      },
      err => {
        onError('Could not get location: ' + err.message);
        setLocating(false);
      }
    );
  };

  const coordsSet = form.latitude && form.longitude;

  return (
    <div className="space-y-4 animate-fadeIn">
      {/* Address */}
      <div className="card p-5">
        <label className="label-micro block mb-2">Address / Location Description *</label>
        <input
          className="input-dark mb-4"
          placeholder="e.g. Main Street &amp; 5th Ave, near the bus stop"
          value={form.address}
          onChange={e => onChange('address', e.target.value)}
        />

        {/* GPS button */}
        <button
          type="button"
          onClick={handleGPS}
          disabled={locating}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all w-full justify-center"
          style={{
            background: 'rgba(97,192,255,0.08)',
            border:     '1px solid rgba(97,192,255,0.2)',
            color:      '#61C0FF',
          }}
        >
          {locating
            ? <><Loader2 size={14} className="animate-spin" /> Getting location…</>
            : <><MapPin size={14} /> Use My Current GPS Location</>
          }
        </button>

        {coordsSet && (
          <p className="text-emerald-400 text-xs mt-3 flex items-center gap-1.5">
            <CheckCircle2 size={13} />
            GPS set: {parseFloat(form.latitude).toFixed(5)}, {parseFloat(form.longitude).toFixed(5)}
          </p>
        )}
      </div>

      {/* Manual coords */}
      <div className="card p-5">
        <label className="label-micro block mb-3">
          Or enter coordinates manually
        </label>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-[#6B7280] mb-1 block">Latitude</label>
            <input
              className="input-dark"
              placeholder="e.g. 28.6139"
              value={form.latitude}
              onChange={e => onChange('latitude', e.target.value)}
            />
          </div>
          <div>
            <label className="text-xs text-[#6B7280] mb-1 block">Longitude</label>
            <input
              className="input-dark"
              placeholder="e.g. 77.2090"
              value={form.longitude}
              onChange={e => onChange('longitude', e.target.value)}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
