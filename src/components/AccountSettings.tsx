import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNotification } from '../contexts/NotificationContext';
import { User, Mail, Lock, Key, Trash2, Save, UserCheck, AlertTriangle, Eye, EyeOff } from 'lucide-react';

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
      password: password || undefined
    });
    setLoading(false);

    if (result.success) {
      notify('Hesap bilgileriniz başarıyla güncellendi.', 'success');
      setPassword('');
      setConfirmPassword('');
    } else {
      notify(result.error || 'Profil güncellenemedi.', 'error');
    }
  };

  const handleDelete = async () => {
    const ok = await askConfirm(
      'HESABI KALICI OLARAK SİL',
      'Hesabınızı silmek istediğinize emin misiniz? Gardırobunuzdaki tüm kıyafetler, resimleriniz, kombinleriniz ve verileriniz GERİ ALINAMAZ şekilde tamamen yok edilecektir.'
    );
    if (!ok) return;

    const secondOk = await askConfirm(
      'SON UYARI - Geri Dönüş Yok!',
      'Görselleriniz bulut depolama alanından (Cloudinary) ve tüm MongoDB kayıtlarından temizlenecektir. Hesabınızı silmek istediğinizi onaylıyor musunuz?'
    );
    if (!secondOk) return;

    setDeleting(true);
    notify('Verileriniz siliniyor ve temizlik yapılıyor, lütfen bekleyin...', 'info');
    const result = await deleteAccount();
    setDeleting(false);

    if (result.success) {
      notify('Hesabınız başarıyla silindi.', 'success');
    } else {
      notify(result.error || 'Hesap silinemedi.', 'error');
    }
  };

  const labelCls = "block text-xs font-bold uppercase tracking-wider text-secondary mb-2";
  const inputCls = "w-full bg-primary border border-border-color rounded-2xl py-3.5 pl-11 pr-4 text-primary placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-200";

  return (
    <div className="max-w-2xl mx-auto py-4 pb-20 space-y-8 animate-fade-in">
      
      {/* Profile Form */}
      <div className="bg-secondary border border-border-color rounded-3xl p-6 md:p-8 shadow-sm transition-colors">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 bg-indigo-500/10 text-indigo-400 rounded-xl">
            <UserCheck className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-xl font-bold text-primary">Profil Bilgileri</h3>
            <p className="text-xs text-text-secondary mt-0.5">Kişisel bilgilerinizi ve e-postanızı güncelleyin</p>
          </div>
        </div>

        <form onSubmit={handleUpdate} className="space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div>
              <label className={labelCls}>Ad Soyad</label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-secondary">
                  <User className="w-5 h-5" />
                </span>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className={inputCls}
                />
              </div>
            </div>

            <div>
              <label className={labelCls}>Kullanıcı Adı</label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-secondary">
                  <User className="w-5 h-5" />
                </span>
                <input
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className={inputCls}
                />
              </div>
            </div>
          </div>

          <div>
            <label className={labelCls}>E-posta Adresi</label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-secondary">
                <Mail className="w-5 h-5" />
              </span>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={inputCls}
              />
            </div>
          </div>

          {/* Privacy Toggle */}
          <div className="h-px bg-border-color my-4 opacity-50" />
          
          <div className="flex items-center justify-between p-4 bg-primary/45 border border-border-color/50 rounded-2xl transition-all">
            <div className="flex gap-3 items-start pr-4">
              <div className="p-2 bg-indigo-500/10 text-indigo-400 rounded-xl mt-0.5">
                {isPrivate ? <EyeOff className="w-5 h-5 text-indigo-400" /> : <Eye className="w-5 h-5 text-indigo-400" />}
              </div>
              <div className="text-left">
                <h4 className="text-sm font-bold text-primary">Profilimi Gizle</h4>
                <p className="text-[11px] text-text-secondary mt-0.5 leading-relaxed">
                  Aktif edildiğinde profiliniz ve kıyafetleriniz Keşfet sekmesinde diğer kullanıcılara gösterilmez.
                </p>
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer shrink-0">
              <input 
                type="checkbox" 
                checked={isPrivate} 
                onChange={(e) => setIsPrivate(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 dark:bg-gray-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 dark:after:border-gray-600 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
            </label>
          </div>

          <div className="h-px bg-border-color my-4 opacity-50" />

          <div className="flex items-center gap-3 mb-4">
            <div className="p-1.5 bg-indigo-500/10 text-indigo-400 rounded-lg">
              <Key className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-primary">Şifreyi Değiştir</h4>
              <p className="text-[10px] text-text-secondary">Şifrenizi değiştirmek istemiyorsanız boş bırakın</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div>
              <label className={labelCls}>Yeni Şifre</label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-secondary">
                  <Lock className="w-5 h-5" />
                </span>
                <input
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={inputCls}
                />
              </div>
            </div>

            <div>
              <label className={labelCls}>Yeni Şifre (Tekrar)</label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-secondary">
                  <Lock className="w-5 h-5" />
                </span>
                <input
                  type="password"
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className={inputCls}
                />
              </div>
            </div>
          </div>

          <div className="pt-4 flex justify-end">
            <button
              type="submit"
              disabled={loading}
              className="w-full sm:w-auto bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl py-3.5 px-8 font-semibold shadow-lg shadow-indigo-500/20 active:scale-[0.98] transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {loading ? (
                <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  <span>Bilgileri Güncelle</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* Danger Zone */}
      <div className="bg-red-500/5 border border-red-500/20 rounded-3xl p-6 md:p-8 shadow-sm">
        <div className="flex items-center gap-3 mb-4 text-red-500">
          <div className="p-2 bg-red-500/10 rounded-xl">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-xl font-bold">Tehlikeli Bölge</h3>
            <p className="text-xs text-red-400/70 mt-0.5">Bu işlemler geri alınamaz</p>
          </div>
        </div>

        <p className="text-sm text-text-secondary leading-relaxed mb-6">
          Hesabınızı sildiğinizde, gardırobunuza yüklediğiniz tüm kıyafetler, resim dosyalarınız (Cloudinary bulut depolama alanınızdan tamamen silinir) ve oluşturduğunuz tüm kombinler kalıcı olarak yok edilir.
        </p>

        <div className="flex justify-start">
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="w-full sm:w-auto bg-red-600 hover:bg-red-700 text-white rounded-2xl py-3.5 px-8 font-semibold shadow-lg shadow-red-500/20 active:scale-[0.98] transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {deleting ? (
              <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                <Trash2 className="w-4 h-4" />
                <span>Hesabı Kalıcı Olarak Sil</span>
              </>
            )}
          </button>
        </div>
      </div>

    </div>
  );
}
