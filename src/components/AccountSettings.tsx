import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNotification } from '../contexts/NotificationContext';
import { User, Mail, Lock, Trash2, Save, UserCheck, AlertTriangle } from 'lucide-react';
import { Button, Card, Notice, Toggle } from './ui/primitives';
import { Field, Input } from './ui/fields';

interface Props {
  onPersonalColorConsentChange?: (consent: boolean) => void;
}

export default function AccountSettings() {
  const { user, updateProfile, deleteAccount } = useAuth();
  const { notify, askConfirm } = useNotification();

  const [name, setName] = useState(user?.name || '');
  const [username, setUsername] = useState(user?.username || '');
  const [email, setEmail] = useState(user?.email || '');
  const [isPrivate, setIsPrivate] = useState(user?.isPrivate || false);

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);

  if (!user) return null;

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !username || !email) {
      notify('Lütfen ad, kullanıcı adı ve e-posta alanlarını doldurun.', 'error');
      return;
    }

    if (password && password.length < 6) {
      notify('Şifreniz en az 6 karakter olmalıdır.', 'error');
      return;
    }

    if (password && password !== confirmPassword) {
      notify('Şifreler eşleşmiyor.', 'error');
      return;
    }

    setLoading(true);
    const result = await updateProfile({
      name,
      username: username.toLowerCase().replace(/\s+/g, ''),
      email: email.toLowerCase(),
      isPrivate,
      password: password || undefined,
    });
    setLoading(false);

    if (result.success) {
      notify('Hesap bilgileriniz güncellendi.', 'success');
      setPassword('');
      setConfirmPassword('');
    } else {
      notify(result.error || 'Profil güncellenemedi.', 'error');
    }
  };

  const handleDelete = async () => {
    const ok = await askConfirm(
      'Hesabı Kalıcı Olarak Sil',
      'Hesabınızı silmek istediğinize emin misiniz? Gardırobunuzdaki tüm kıyafetler, resimleriniz, kombinleriniz ve tüm verileriniz kalıcı olarak silinecektir.',
      'Evet, Hesabımı Sil',
    );
    if (!ok) return;

    setDeleting(true);
    notify('Hesabınız siliniyor, lütfen bekleyin…', 'info');
    const result = await deleteAccount();
    setDeleting(false);

    if (result.success) {
      notify('Hesabınız başarıyla silindi.', 'success');
    } else {
      notify(result.error || 'Hesap silinemedi.', 'error');
    }
  };

  return (
    <div className="space-y-6">
      {/* Profil Formu */}
      <Card className="p-5 md:p-6 space-y-5">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-accent-soft text-accent rounded-2xl">
            <UserCheck className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-ink">Profil Bilgileri</h3>
            <p className="text-xs text-ink-3">Kişisel bilgilerinizi ve e-postanızı yönetin</p>
          </div>
        </div>

        <form onSubmit={handleUpdate} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Ad Soyad">
              <Input
                required
                value={name}
                onChange={e => setName(e.target.value)}
                leading={<User className="w-4 h-4" />}
              />
            </Field>

            <Field label="Kullanıcı Adı">
              <Input
                required
                value={username}
                onChange={e => setUsername(e.target.value)}
                leading={<span className="text-sm font-semibold">@</span>}
              />
            </Field>
          </div>

          <Field label="E-posta Adresi">
            <Input
              type="email"
              required
              value={email}
              onChange={e => setEmail(e.target.value)}
              leading={<Mail className="w-4 h-4" />}
            />
          </Field>

          {/* Gizli Hesap Geçişi */}
          <div className="flex items-center justify-between p-3.5 rounded-2xl bg-surface-2 border border-line">
            <div>
              <p className="text-sm font-semibold text-ink">Gizli Profil</p>
              <p className="text-xs text-ink-3">Gardırobun Keşfet sekmesinde diğer kullanıcılara görünmez</p>
            </div>
            <Toggle
              label="Gizli Profil"
              checked={isPrivate}
              onChange={val => setIsPrivate(val)}
            />
          </div>

          {/* Şifre Değiştirme */}
          <div className="pt-2 border-t border-line space-y-3">
            <p className="text-xs font-bold uppercase tracking-wider text-ink-3">Şifre Değiştir (İsteğe Bağlı)</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Input
                type="password"
                placeholder="Yeni şifre (en az 6 karakter)"
                value={password}
                onChange={e => setPassword(e.target.value)}
                leading={<Lock className="w-4 h-4" />}
              />
              <Input
                type="password"
                placeholder="Yeni şifre tekrar"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                leading={<Lock className="w-4 h-4" />}
              />
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <Button
              type="submit"
              variant="primary"
              loading={loading}
              icon={<Save className="w-4 h-4" />}
            >
              Bilgileri Güncelle
            </Button>
          </div>
        </form>
      </Card>

      {/* Tehlikeli Bölge: Hesabı Sil */}
      <Card className="p-5 md:p-6 border-danger/30 bg-danger-soft/20 space-y-4">
        <div className="flex items-center gap-3 text-danger">
          <div className="p-2.5 bg-danger-soft rounded-2xl">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-ink">Tehlikeli Bölge</h3>
            <p className="text-xs text-ink-3">Bu işlem geri alınamaz</p>
          </div>
        </div>

        <p className="text-xs text-ink-2 leading-relaxed">
          Hesabınızı sildiğinizde gardırobunuzdaki tüm parçalar, görseller (bulut depolama dahil), kombinleriniz, giyim günlüğünüz ve kişisel verileriniz kalıcı olarak silinir.
        </p>

        <Button
          variant="danger"
          loading={deleting}
          onClick={handleDelete}
          icon={<Trash2 className="w-4 h-4" />}
        >
          Hesabı Kalıcı Olarak Sil
        </Button>
      </Card>
    </div>
  );
}
