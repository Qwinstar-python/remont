'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';
import { LogOut, Package, User, RefreshCcw } from 'lucide-react';

type Order = {
  id: number;
  created_at: string;
  status: string | null;
  total_amount: number;
};

export default function AccountPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const checkUserAndLoadOrders = async () => {
      const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      
      if (!url || !key) {
        setLoading(false);
        return;
      }

      const supabase = createClient(url, key);
      
      // 1. Проверяем сессию
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        router.push('/login');
      } else {
        setUser(session.user);
        
        // 2. Загружаем заказы этого пользователя
        try {
          const { data, error } = await supabase
            .from('orders')
            .select('*')
            .eq('user_id', session.user.id)
            .order('created_at', { ascending: false });

          if (error) throw error;
          setOrders(data || []);
        } catch (err: any) {
          setError(err.message);
        }
      }
      setLoading(false);
    };

    checkUserAndLoadOrders();
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

  const refreshOrders = async () => {
    setLoading(true);
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (url && key && user) {
      const supabase = createClient(url, key);
      const { data } = await supabase
        .from('orders')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      if (data) setOrders(data);
    }
    setLoading(false);
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center bg-paper">Загрузка данных...</div>;
  }

  if (!user) {
    return null; 
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
          <div className="mt-6 space-y-4">
             <p className="text-xs text-mute">Редактирование профиля будет доступно после подключения полноценного бэкенда.</p>
          </div>
        </section>

        {/* Заказы */}
        <section>
          <div className="mb-5 flex items-center justify-between">
            <h2 className="text-sm font-medium uppercase tracking-[0.18em]">История заказов</h2>
            <button onClick={refreshOrders} disabled={loading} className="inline-flex items-center gap-1 text-xs text-mute hover:text-ink">
              <RefreshCcw className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} /> Обновить
            </button>
          </div>

          {error && (
            <div className="mb-4 border border-danger/30 bg-danger/5 p-3 text-sm text-danger">
              Не удалось загрузить заказы: {error}
            </div>
          )}

          <div className="space-y-3">
            {orders.length === 0 ? (
              <div className="border border-line bg-surface p-10 text-center">
                <Package className="mx-auto h-10 w-10 text-mute" />
                <p className="mt-3 text-sm text-mute">У вас пока нет оформленных заказов.</p>
                <Link href="/catalog" className="mt-4 inline-block text-xs font-medium text-accent underline">Перейти в каталог</Link>
              </div>
            ) : (
              orders.map((o) => (
                <article key={o.id} className="border border-line bg-surface p-5 transition hover:border-ink/20">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="font-medium">Заказ №{o.id}</p>
                      <p className="text-xs text-mute">{new Date(o.created_at).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-medium">{new Intl.NumberFormat('ru-RU').format(o.total_amount)} ₽</p>
                      <p className={`text-xs ${o.status === 'delivered' ? 'text-success' : 'text-accent'}`}>
                        {o.status === 'pending' ? 'В обработке' : o.status === 'shipped' ? 'Отправлен' : o.status === 'delivered' ? 'Доставлен' : o.status}
                      </p>
                    </div>
                  </div>
                </article>
              ))
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
