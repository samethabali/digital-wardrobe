import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useNotification } from '../contexts/NotificationContext';
import { Sparkles, Mail, Lock, User, ArrowRight, UserPlus } from 'lucide-react';
import { Button, Card } from './ui/primitives';
import { Field, Input } from './ui/fields';

export default function Register() {
  const { register } = useAuth();
  const { notify } = useNotification();
  const navigate = useNavigate();

  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !username || !email || !password) {
      notify('Lütfen tüm alanları doldurun.', 'error');
      return;
    }

    if (username.length < 3) {
      notify('Kullanıcı adı en az 3 karakter olmalıdır.', 'error');
      return;
    }

    if (password.length < 6) {
      notify('Şifreniz en az 6 karakter olmalıdır.', 'error');
      return;
    }

    setLoading(true);
    const result = await register(email, password, name, username);
    setLoading(false);

    if (result.success) {
      notify('Kayıt başarıyla tamamlandı. Hoş geldiniz!', 'success');
      navigate('/');
    } else {
      notify(result.error || 'Kayıt olunamadı.', 'error');
    }
  };

  return (
    <div className="min-h-dvh flex items-center justify-center bg-canvas px-4 py-8">
      <div className="w-full max-w-md">
        {/* Başlık */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-accent-soft text-accent mb-3">
            <Sparkles className="w-6 h-6" />
          </div>
          <h1 className="font-display text-3xl text-ink">Aura'ya Katıl</h1>
          <p className="text-sm text-ink-3 mt-1">Kendi dijital gardırobunu oluştur</p>
        </div>

        {/* Kart */}
        <Card className="p-6 sm:p-8 shadow-card">
          <form onSubmit={handleSubmit} className="space-y-4">
            <Field label="Ad Soyad">
              <Input
                type="text"
                required
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Adınız Soyadınız"
                leading={<User className="w-4 h-4" />}
                autoFocus
              />
            </Field>

            <Field label="Kullanıcı Adı">
              <Input
                type="text"
                required
                value={username}
                onChange={e => setUsername(e.target.value.toLowerCase().replace(/\s+/g, ''))}
                placeholder="kullaniciadi"
                leading={<span className="text-sm font-semibold">@</span>}
              />
            </Field>

            <Field label="E-posta Adresi">
              <Input
                type="email"
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="ornek@aura.com"
                leading={<Mail className="w-4 h-4" />}
              />
            </Field>

            <Field label="Şifre">
              <Input
                type="password"
                required
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="En az 6 karakter"
                leading={<Lock className="w-4 h-4" />}
              />
            </Field>

            <div className="pt-2">
              <Button
                type="submit"
                variant="primary"
                size="lg"
                block
                loading={loading}
                icon={<UserPlus className="w-4 h-4" />}
              >
                Kayıt Ol
              </Button>
            </div>
          </form>

          <div className="mt-6 pt-5 border-t border-line text-center text-sm text-ink-3">
            Zaten hesabın var mı?{' '}
            <Link to="/login" className="text-accent font-semibold hover:underline inline-flex items-center gap-1">
              Giriş Yap
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </Card>
      </div>
    </div>
  );
}
