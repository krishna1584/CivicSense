'use client';
import { useEffect, useState } from 'react';
import { MailWarning } from 'lucide-react';
import { adminApi } from '@/lib/api';

type EmailStatus = 'available' | 'checking' | 'unavailable' | 'not_configured';

/**
 * Explains, on pages that rely on emailed codes, when this deployment can't send email.
 * Hidden whenever email works.
 */
export function EmailDeliveryNotice({ purpose }: { purpose: 'verify' | 'reset' }) {
  const [status, setStatus] = useState<EmailStatus | null>(null);
  const [onRender, setOnRender] = useState(false);

  useEffect(() => {
    adminApi.getPublicSettings()
      .then(res => {
        setStatus(res.data.emailDelivery ?? null);
        setOnRender(!!res.data.hostedOnRender);
      })
      .catch(() => {});
  }, []);

  if (status !== 'unavailable' && status !== 'not_configured') return null;

  const what = purpose === 'verify' ? 'Verification codes' : 'Password-reset codes';
  const reason = status === 'not_configured'
    ? 'No email server is configured on this deployment.'
    : onRender
      ? "This demo is hosted on Render's free plan, which blocks outgoing email (SMTP)."
      : 'This server cannot reach its email provider. Some hosts, such as Render on its free plan, block outgoing email (SMTP).';

  return (
    <div role="note" className="flex items-start gap-3 rounded-xl p-3.5 mb-6 text-sm text-left bg-state-warning/10 border border-state-warning/25">
      <MailWarning size={18} className="text-state-warning shrink-0 mt-0.5" />
      <div className="space-y-1">
        <p className="font-semibold text-content-primary">Email delivery is unavailable here</p>
        <p className="text-content-secondary leading-relaxed">
          {what} are sent by email over SMTP (Nodemailer). {reason} Email is delivered when the backend runs
          locally or on a host that allows SMTP.
        </p>
      </div>
    </div>
  );
}
