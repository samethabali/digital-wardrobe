import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useNotification } from '../contexts/NotificationContext';
import { Mail, Lock, LogIn, ArrowRight, Sparkles } from 'lucide-react';
import { Button, Card } from './ui/primitives';
import { Field, Input } from './ui/fields';

export default function Login() {
  const { login } = useAuth();
  const { notify } = useNotification();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      notify('Lütfen tüm alanları doldurun.', 'error');
      return;
    }

    setLoading(true);
    const result = await login(email, password);
    setLoading(false);

    if (result.success) {
      notify('Başarıyla giriş yapıldı.', 'success');
      navigate('/');
    } else {
      notify(result.error || 'Giriş yapılamadı.', 'error');
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
          <h1 className="font-display text-3xl text-ink">Aura</h1>
          <p className="text-sm text-ink-3 mt-1">Akıllı stil asistanına giriş yap</p>
        </div>

        {/* Kart */}
        <Card className="p-6 sm:p-8 shadow-card">
          <form onSubmit={handleSubmit} className="space-y-4">
            <Field label="E-posta Adresi">
              <Input
                type="email"
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="ornek@aura.com"
                leading={<Mail className="w-4 h-4" />}
                autoFocus
              />
            </Field>

            <Field label="Şifre">
              <Input
                type="password"
                required
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
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
                icon={<LogIn className="w-4 h-4" />}
              >
                Giriş Yap
              </Button>
            </div>
          </form>

          <div className="mt-6 pt-5 border-t border-line text-center text-sm text-ink-3">
            Hesabın yok mu?{' '}
            <Link to="/register" className="text-accent font-semibold hover:underline inline-flex items-center gap-1">
              Kayıt Ol
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </Card>
      </div>
    </div>
  );
}
