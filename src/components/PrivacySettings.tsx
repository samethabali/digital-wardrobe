import React from 'react';
import { ShieldCheck, ChevronDown, ChevronUp, Bell } from 'lucide-react';
import type { Consents } from '../../shared/api';
import { CONSENT_DESCRIPTIONS, ConsentKey, NOTICE_VERSION, PRIVACY_NOTICE_SECTIONS } from '../../shared/privacy';
import { apiFetch } from '../services/api';
import { pushSupported, subscribeToPush, unsubscribeFromPush } from '../services/push';
import { useNotification } from '../contexts/NotificationContext';
import { Card, Spinner, Toggle } from './ui/primitives';

interface Props {
  onConsentsChange?: (consents: Consents) => void;
}

export default function PrivacySettings({ onConsentsChange }: Props) {
  const { notify, askConfirm } = useNotification();
  const [consents, setConsents] = React.useState<Consents | null>(null);
  const [showNotice, setShowNotice] = React.useState(false);
  const [noticeAccepted, setNoticeAccepted] = React.useState(false);
  const [busy, setBusy] = React.useState<ConsentKey | null>(null);

  React.useEffect(() => {
    apiFetch<{ consents: Consents }>('/api/auth/consents')
      .then(data => {
        setConsents(data.consents);
        setNoticeAccepted(data.consents.noticeVersion === NOTICE_VERSION);
        onConsentsChange?.(data.consents);
      })
      .catch(err => notify(err.message || 'Rıza ayarları alınamadı.', 'error'));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const toggle = async (key: ConsentKey, granted: boolean) => {
    const description = CONSENT_DESCRIPTIONS.find(c => c.key === key)!;
    if (granted && !noticeAccepted) {
      setShowNotice(true);
      notify('Önce aydınlatma metnini okuyup onaylaman gerekiyor.', 'info');
      return;
    }
    if (!granted) {
      const ok = await askConfirm(
        'İzni geri çek',
        `Bu izni geri çekersen şu veriler hemen silinir: ${description.deletedOnWithdraw}. Devam edilsin mi?`,
        'İzni Geri Çek',
      );
      if (!ok) return;
    }
    setBusy(key);
    try {
      if (key === 'push' && !granted) await unsubscribeFromPush();
      const data = await apiFetch<{ consents: Consents }>('/api/auth/consents', {
        method: 'PUT',
        body: { [key]: granted, ...(granted ? { noticeVersion: NOTICE_VERSION } : {}) },
      });
      setConsents(data.consents);
      onConsentsChange?.(data.consents);
      if (key === 'push' && granted) {
        try {
          await subscribeToPush();
          notify('Her sabah günün kombini bildirim olarak gelecek.', 'success');
        } catch (err: any) {
          notify(err.message || 'Bildirim aboneliği oluşturulamadı.', 'error');
        }
      } else {
        notify(granted ? 'İzin kaydedildi.' : 'İzin geri çekildi ve ilgili veriler silindi.', 'success');
      }
    } catch (err: any) {
      notify(err.message || 'Kaydedilemedi.', 'error');
    } finally {
      setBusy(null);
    }
  };

  return (
    <Card className="p-5 md:p-6 space-y-4">
      <div className="flex items-center gap-3">
        <div className="p-2.5 bg-accent-soft text-accent rounded-2xl">
          <ShieldCheck className="w-5 h-5" />
        </div>
        <div>
          <h3 className="text-base font-bold text-ink">Gizlilik ve İzinler (KVKK)</h3>
          <p className="text-xs text-ink-3 mt-0.5">Hangi verilerinin, hangi amaçla kullanılacağını sen belirlersin</p>
        </div>
      </div>

      <button
        type="button"
        onClick={() => setShowNotice(v => !v)}
        className="w-full flex items-center justify-between p-3.5 rounded-2xl bg-surface-2 hover:bg-surface-3 border border-line text-sm font-semibold text-ink transition-colors"
      >
        <span>Aydınlatma Metni <span className="text-xs text-ink-3 font-normal">(sürüm {NOTICE_VERSION})</span></span>
        {showNotice ? <ChevronUp className="w-4 h-4 text-ink-3" /> : <ChevronDown className="w-4 h-4 text-ink-3" />}
      </button>

      {showNotice && (
        <div className="p-4 rounded-2xl bg-surface-2 border border-line max-h-72 overflow-y-auto space-y-3">
          {PRIVACY_NOTICE_SECTIONS.map(section => (
            <div key={section.title}>
              <p className="text-xs font-bold text-ink">{section.title}</p>
              <p className="text-xs text-ink-2 leading-relaxed mt-1">{section.body}</p>
            </div>
          ))}
          <label className="flex items-center gap-2 pt-2 text-xs font-semibold text-ink cursor-pointer border-t border-line">
            <input
              type="checkbox"
              checked={noticeAccepted}
              onChange={e => setNoticeAccepted(e.target.checked)}
              className="w-4 h-4 rounded accent-accent"
            />
            Aydınlatma metnini okudum ve anladım.
          </label>
        </div>
      )}

      <div className="space-y-3 pt-1">
        {!consents ? (
          <div className="py-6 flex justify-center"><Spinner /></div>
        ) : (
          CONSENT_DESCRIPTIONS.map(item => {
            const granted = consents[item.key];
            const unavailable = item.key === 'push' && !pushSupported();
            return (
              <div
                key={item.key}
                className="flex items-start justify-between gap-4 p-4 bg-surface-2 border border-line rounded-2xl"
              >
                <div className="min-w-0">
                  <h4 className="text-sm font-bold text-ink flex items-center gap-1.5">
                    {item.key === 'push' && <Bell className="w-3.5 h-3.5 text-accent" />}
                    {item.title}
                  </h4>
                  <p className="text-xs text-ink-3 mt-1 leading-relaxed">{item.description}</p>
                  {unavailable && <p className="text-xs text-warning mt-1">Bu tarayıcı bildirimleri desteklemiyor.</p>}
                </div>

                <div className="shrink-0 mt-0.5">
                  {busy === item.key ? (
                    <Spinner className="w-5 h-5" />
                  ) : (
                    <Toggle
                      label={item.title}
                      checked={Boolean(granted)}
                      disabled={Boolean(unavailable && !granted)}
                      onChange={val => toggle(item.key, val)}
                    />
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      <p className="text-[11px] text-ink-3 pt-1">
        İzin vermesen de gardırobunu ve temel kombin önerilerini kullanabilirsin. Giyim günlüğüne eklediğin kayıtlar senin açık işlemindir ve bu izinlerden bağımsız olarak saklanır.
      </p>
    </Card>
  );
}
