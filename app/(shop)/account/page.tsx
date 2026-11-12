'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { LogOut, Package, User } from 'lucide-react';

type Order = {
  id: number;
  date: string;
  status: string;
  total: number;
  items: number;
};

const DEMO_ORDERS: Order[] = [
  { id: 1024, date: '2026-11-10', status: 'Доставлен', total: 15750, items: 2 },
  { id: 1018, date: '2026-11-03', status: 'В пути', total: 8900, items: 1 },
  { id: 1005, date: '2026-10-22', status: 'Доставлен', total: 24500, items: 1 }
];

export default function AccountPage() {
  const router = useRouter();
  const [user, setUser] = useState<{ email: string; name: string } | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem('reform-user');
      if (raw) setUser(JSON.parse(raw));
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    const sync = () => {
      try {
        const raw = localStorage.getItem('reform-user');
        setUser(raw ? JSON.parse(raw) : null);
      } catch { setUser(null); }
    };
    window.addEventListener('reform-auth-changed', sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener('reform-auth-changed', sync);
      window.removeEventListener('storage', sync);
    };
  }, []);

  const logout = () => {
    localStorage.removeItem('reform-user');
    window.dispatchEvent(new Event('reform-auth-changed'));
    router.push('/');
  };

  if (!user) {
    return (
      <div className="mx-auto max-w-[1440px] px-4 py-20 sm:px-6 lg:px-10">
        <div className="mx-auto max-w-md border border-line bg-surface p-10 text-center">
          <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-paper">
            <User className="h-7 w-7 text-mute" />
          </div>
          <h1 className="mt-5 text-xl font-medium tracking-tight">Вы не вошли</h1>
          <p className="mt-2 text-sm text-mute">Войдите или создайте аккаунт, чтобы видеть профиль и историю заказов.</p>
          <div className="mt-6 flex justify-center gap-3">
            <Link href="/login" className="inline-flex h-11 items-center bg-ink px-6 text-xs font-semibold uppercase tracking-[0.18em] text-paper transition hover:bg-accent">
              Войти
            </Link>
            <Link href="/register" className="inline-flex h-11 items-center border border-ink px-6 text-xs font-semibold uppercase tracking-[0.18em] transition hover:bg-ink hover:text-paper">
              Регистрация
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const initials = user.name.split(' ').map((s) => s[0]).join('').slice(0, 2).toUpperCase();

  return (
    <div className="mx-auto max-w-[1440px] px-4 py-10 sm:px-6 lg:px-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.28em] text-accent">Личный кабинет</p>
          <h1 className="mt-2 text-3xl font-medium tracking-tight sm:text-4xl">Здравствуйте, {user.name.split(' ')[0]}</h1>
        </div>
        <button onClick={logout} className="inline-flex h-10 items-center gap-2 border border-line bg-surface px-4 text-xs font-semibold uppercase tracking-[0.16em] transition hover:border-danger hover:text-danger">
          <LogOut className="h-4 w-4" /> Выйти
        </button>
      </div>

      <div className="mt-10 grid gap-8 lg:grid-cols-[340px_1fr]">
        {/* Профиль */}
        <section className="h-fit border border-line bg-surface p-6">
          <div className="flex items-center gap-4">
            <div className="grid h-14 w-14 place-items-center rounded-full bg-ink text-lg font-medium text-paper">{initials}</div>
            <div className="min-w-0">
              <p className="truncate font-medium">{user.name}</p>
              <p className="truncate text-sm text-mute">{user.email}</p>
            </div>
          </div>
          <div className="mt-6 space-y-4">
            <div>
              <label className="mb-2 block text-[11px] font-medium uppercase tracking-[0.18em] text-ink-soft">Имя</label>
              <input defaultValue={user.name} disabled className="h-11 w-full cursor-not-allowed border border-line bg-paper/50 px-4 text-sm opacity-60" />
            </div>
            <div>
              <label className="mb-2 block text-[11px] font-medium uppercase tracking-[0.18em] text-ink-soft">Email</label>
              <input defaultValue={user.email} disabled className="h-11 w-full cursor-not-allowed border border-line bg-paper/50 px-4 text-sm opacity-60" />
            </div>
            <p className="text-xs text-mute">Редактирование профиля будет доступно после подключения Supabase Auth.</p>
          </div>
        </section>

        {/* Заказы */}
        <section>
          <h2 className="mb-5 text-sm font-medium uppercase tracking-[0.18em]">История заказов</h2>
          <div className="space-y-3">
            {DEMO_ORDERS.map((o) => (
              <article key={o.id} className="border border-line bg-surface p-5 transition hover:border-ink/20">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="font-medium">Заказ №{o.id}</p>
                    <p className="text-xs text-mute">{new Date(o.date).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })} · {o.items} товар(а)</p>
                  </div>
                  <div className="text-right">
                    <p className="font-medium">{new Intl.NumberFormat('ru-RU').format(o.total)} ₽</p>
                    <p className={`text-xs ${o.status === 'Доставлен' ? 'text-success' : 'text-accent'}`}>{o.status}</p>
                  </div>
                </div>
              </article>
            ))}
          </div>
          <p className="mt-4 text-xs text-mute">Это демо-данные. Реальные заказы появятся после подключения оформления.</p>
        </section>
      </div>
    </div>
  );
}
