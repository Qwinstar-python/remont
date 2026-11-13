'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';
import { LogOut, Package, User } from 'lucide-react';

type Order = {
  id: number;
  date: string;
  status: string;
  total: number;
  items: number;
};

// Временные демо-заказы, пока не подключили базу заказов
const DEMO_ORDERS: Order[] = [
  { id: 1024, date: '2026-11-10', status: 'Доставлен', total: 15750, items: 2 },
  { id: 1018, date: '2026-11-03', status: 'В пути', total: 8900, items: 1 },
];

export default function AccountPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkUser = async () => {
      const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      
      if (!url || !key) {
        setLoading(false);
        return;
      }

      const supabase = createClient(url, key);
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        // Если сессии нет — сразу кидаем на логин
        router.push('/login');
      } else {
        setUser(session.user);
      }
      setLoading(false);
    };

    checkUser();
  }, [router]);

  const logout = async () => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (url && key) {
      const supabase = createClient(url, key);
      await supabase.auth.signOut();
    }
    router.push('/');
    router.refresh();
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">Проверка авторизации...</div>;
  }

  if (!user) {
    return null; // Пока идет редирект, ничего не показываем
  }

  const name = user.user_metadata?.full_name || user.email?.split('@')[0] || 'Пользователь';
  const initials = name.split(' ').map((s: string) => s[0]).join('').slice(0, 2).toUpperCase();

  return (
    <div className="mx-auto max-w-[1440px] px-4 py-10 sm:px-6 lg:px-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.28em] text-accent">Личный кабинет</p>
          <h1 className="mt-2 text-3xl font-medium tracking-tight sm:text-4xl">Здравствуйте, {name}</h1>
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
              <p className="truncate font-medium">{name}</p>
              <p className="truncate text-sm text-mute">{user.email}</p>
            </div>
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
                    <p className="text-xs text-mute">{new Date(o.date).toLocaleDateString('ru-RU')} · {o.items} товар(а)</p>
                  </div>
                  <div className="text-right">
                    <p className="font-medium">{new Intl.NumberFormat('ru-RU').format(o.total)} ₽</p>
                    <p className={`text-xs ${o.status === 'Доставлен' ? 'text-success' : 'text-accent'}`}>{o.status}</p>
                  </div>
                </div>
              </article>
            ))}
          </div>
          <p className="mt-4 text-xs text-mute">Это демо-данные. Реальные заказы появятся после подключения базы заказов.</p>
        </section>
      </div>
    </div>
  );
}
