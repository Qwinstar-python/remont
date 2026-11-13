'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase/client';

export default function RegisterPage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!name.trim() || !email.trim() || !password || !confirm) {
      setError('Заполните все поля');
      return;
    }
    if (password.length < 6) {
      setError('Пароль должен быть не короче 6 символов');
      return;
    }
    if (password !== confirm) {
      setError('Пароли не совпадают');
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: { full_name: name.trim() }
        }
      });
      if (error) throw error;
      
      // Сразу пробуем войти, чтобы не ждать письма (если отключено подтверждение)
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password
      });
      
      if (signInError) {
        // Если вход не удался (например, нужно подтверждение), просто редиректим на логин
        router.push('/login?registered=1');
      } else {
        router.push('/account');
        router.refresh();
      }
    } catch (err: any) {
      setError(err.message || 'Не удалось создать аккаунт');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-paper">
      <div className="mx-auto max-w-md px-4 py-20 sm:px-6">
        <Link href="/" className="mb-8 inline-flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-mute transition hover:text-ink">
          <ArrowLeft className="h-4 w-4" /> На главную
        </Link>

        <p className="mb-2 text-2xl font-bold tracking-tight">RE<span className="text-accent">:</span>FORM</p>
        <h1 className="text-3xl font-medium tracking-tight">Регистрация</h1>
        <p className="mt-2 text-sm text-mute">Создайте аккаунт, чтобы отслеживать заказы.</p>

        <form onSubmit={submit} className="mt-8 space-y-5 border border-line bg-surface p-8">
          <div>
            <label className="mb-2 block text-[11px] font-medium uppercase tracking-[0.18em] text-ink-soft">Имя и фамилия</label>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Анна Смирнова" autoComplete="name"
              className="h-11 w-full border border-line bg-paper px-4 text-sm outline-none transition focus:border-ink" />
          </div>
          <div>
            <label className="mb-2 block text-[11px] font-medium uppercase tracking-[0.18em] text-ink-soft">Email</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" autoComplete="email"
              className="h-11 w-full border border-line bg-paper px-4 text-sm outline-none transition focus:border-ink" />
          </div>
          <div>
            <label className="mb-2 block text-[11px] font-medium uppercase tracking-[0.18em] text-ink-soft">Пароль</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Минимум 6 символов" autoComplete="new-password"
              className="h-11 w-full border border-line bg-paper px-4 text-sm outline-none transition focus:border-ink" />
          </div>
          <div>
            <label className="mb-2 block text-[11px] font-medium uppercase tracking-[0.18em] text-ink-soft">Повторите пароль</label>
            <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="Ещё раз" autoComplete="new-password"
              className="h-11 w-full border border-line bg-paper px-4 text-sm outline-none transition focus:border-ink" />
          </div>

          {error && <p className="border border-danger/30 bg-danger/5 px-4 py-3 text-sm text-danger">{error}</p>}

          <button type="submit" disabled={loading}
            className="flex h-12 w-full items-center justify-center gap-2 bg-ink text-xs font-semibold uppercase tracking-[0.18em] text-paper transition hover:bg-accent disabled:opacity-60">
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            Создать аккаунт
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-mute">
          Уже есть аккаунт? <Link href="/login" className="font-medium text-accent underline underline-offset-4">Войдите</Link>
        </p>
      </div>
    </div>
  );
}
