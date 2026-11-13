'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { createClient } from '@supabase/supabase-js';

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get('next') || '/account';
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!email.trim() || !password) {
      setError('Заполните все поля');
      return;
    }
    setLoading(true);
    try {
      const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      if (!url || !key) throw new Error('Настройки базы не найдены');
      
      const supabase = createClient(url, key);
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password
      });
      if (error) throw error;
      router.push(next);
      router.refresh();
    } catch (err: any) {
      setError(err.message || 'Не удалось войти');
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
        <h1 className="text-3xl font-medium tracking-tight">Вход</h1>
        <p className="mt-2 text-sm text-mute">Рады видеть вас снова.</p>
        <form onSubmit={submit} className="mt-8 space-y-5 border border-line bg-surface p-8">
          <div>
            <label className="mb-2 block text-[11px] font-medium uppercase tracking-[0.18em] text-ink-soft">Email</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" autoComplete="email"
              className="h-11 w-full border border-line bg-paper px-4 text-sm outline-none transition focus:border-ink" />
          </div>
          <div>
            <label className="mb-2 block text-[11px] font-medium uppercase tracking-[0.18em] text-ink-soft">Пароль</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Минимум 6 символов" autoComplete="current-password"
              className="h-11 w-full border border-line bg-paper px-4 text-sm outline-none transition focus:border-ink" />
          </div>
          {error && <p className="border border-danger/30 bg-danger/5 px-4 py-3 text-sm text-danger">{error}</p>}
          <button type="submit" disabled={loading}
            className="flex h-12 w-full items-center justify-center gap-2 bg-ink text-xs font-semibold uppercase tracking-[0.18em] text-paper transition hover:bg-accent disabled:opacity-60">
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            Войти
          </button>
        </form>
        <p className="mt-6 text-center text-sm text-mute">
          Нет аккаунта? <Link href="/register" className="font-medium text-accent underline underline-offset-4">Зарегистрируйтесь</Link>
        </p>
      </div>
    </div>
  );
}
