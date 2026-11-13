'use client';

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';
import {
  ArrowRight, ChevronDown, Clock, LogOut, MapPin, Package,
  RefreshCcw, ShieldCheck, Truck, User
} from 'lucide-react';

type OrderItem = {
  title: string; size: string | null; color: string | null;
  qty: number; price: number; image: string | null;
};
type Status = 'pending' | 'confirmed' | 'shipped' | 'delivered' | 'cancelled';
type Order = {
  id: number; source: 'db' | 'local'; created_at: string; status: Status;
  total: number; delivery_method: string; delivery_cost: number;
  address: string; notes: string | null; items: OrderItem[];
};

const ORDERS_KEY = 'reform-orders-v1';

const STATUS_META: Record<Status, { label: string; cls: string; dot: string }> = {
  pending:   { label: 'Ожидает подтверждения', cls: 'bg-warning/10 text-warning', dot: 'bg-warning' },
  confirmed: { label: 'Подтверждён',            cls: 'bg-info/10 text-info',       dot: 'bg-info' },
  shipped:   { label: 'Отправлен',              cls: 'bg-accent/10 text-accent',   dot: 'bg-accent' },
  delivered: { label: 'Доставлен',              cls: 'bg-success/10 text-success', dot: 'bg-success' },
  cancelled: { label: 'Отменён',                cls: 'bg-danger/10 text-danger',   dot: 'bg-danger' }
};
const STEPS: Status[] = ['pending', 'confirmed', 'shipped', 'delivered'];

const money = (n: number) => new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 }).format(n) + ' ₽';
const plural = (n: number, a: string, b: string, c: string) => {
  const m = Math.abs(n) % 100, k = m % 10;
  if (m > 10 && m < 20) return c;
  if (k > 1 && k < 5) return b;
  if (k === 1) return a;
  return c;
};
const dateLong = (iso: string) =>
  new Date(iso).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
const dateTime = (iso: string) =>
  new Date(iso).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
const deliveryLabel = (m: string) =>
  m === 'courier' ? 'Курьер по Москве' : m === 'cdek' ? 'СДЭК по России' : m === 'pickup' ? 'Самовывоз' : m;

function readLocalOrders(): Order[] {
  try {
    const raw = localStorage.getItem(ORDERS_KEY);
    if (!raw) return [];
    const list = JSON.parse(raw);
    if (!Array.isArray(list)) return [];
    return list
      .filter((r: any) => r && Number.isFinite(Number(r.id)))
      .map((r: any) => ({
        id: Number(r.id),
        source: 'local' as const,
        created_at: String(r.created_at ?? new Date().toISOString()),
        status: 'pending' as Status,
        total: Number(r.total_amount) || 0,
        delivery_method: String(r.delivery_method ?? 'courier'),
        delivery_cost: Number(r.delivery_cost) || 0,
        address: String(r.shipping_address ?? ''),
        notes: r.notes ?? null,
        items: Array.isArray(r.items) ? r.items.map((i: any) => ({
          title: String(i.title ?? 'Товар'),
          size: i.size ?? null,
          color: i.color ?? null,
          qty: Math.max(1, Number(i.quantity) || 1),
          price: Number(i.price) || 0,
          image: i.image ?? null
        })) : []
      }));
  } catch {
    return [];
  }
}

export default function AccountPage() {
  const router = useRouter();
  const [user, setUser] = useState<{ email: string; name: string } | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expanded, setExpanded] = useState<number | null>(null);
  const [filter, setFilter] = useState<Status | 'all'>('all');
  const [syncedFromDb, setSyncedFromDb] = useState(false);

  useEffect(() => {
    const sync = () => {
      try {
        const raw = localStorage.getItem('reform-user');
        setUser(raw ? JSON.parse(raw) : null);
      } catch { setUser(null); }
    };
    sync();
    window.addEventListener('reform-auth-changed', sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener('reform-auth-changed', sync);
      window.removeEventListener('storage', sync);
    };
  }, []);

  const loadOrders = useCallback(async () => {
    setLoading(true);
    setError('');
    const local = readLocalOrders();
    const merged = new Map<number, Order>();
    local.forEach((o) => merged.set(o.id, o));

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (url && key) {
      try {
        const supabase = createClient(url, key);
        const { data: sessionData } = await supabase.auth.getSession();
        if (sessionData?.session) {
          const { data, error: dbError } = await supabase
            .from('orders')
            .select('id,created_at,status,total_amount,delivery_method,delivery_cost,shipping_address,notes,order_items(title_snapshot,size,color,quantity,price_snapshot,image_snapshot)')
            .order('created_at', { ascending: false });
          if (dbError) throw new Error(dbError.message);
          (data ?? []).forEach((r: any) => {
            merged.set(Number(r.id), {
              id: Number(r.id),
              source: 'db',
              created_at: String(r.created_at),
              status: (r.status ?? 'pending') as Status,
              total: Number(r.total_amount) || 0,
              delivery_method: String(r.delivery_method ?? 'courier'),
              delivery_cost: Number(r.delivery_cost) || 0,
              address: String(r.shipping_address ?? ''),
              notes: r.notes ?? null,
              items: Array.isArray(r.order_items) ? r.order_items.map((i: any) => ({
                title: String(i.title_snapshot ?? 'Товар'),
                size: i.size ?? null,
                color: i.color ?? null,
                qty: Math.max(1, Number(i.quantity) || 1),
                price: Number(i.price_snapshot) || 0,
                image: i.image_snapshot ?? null
              })) : []
            });
          });
          setSyncedFromDb(true);
        } else {
          setSyncedFromDb(false);
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Не удалось загрузить заказы из базы');
        setSyncedFromDb(false);
      }
    }

    const list = Array.from(merged.values()).sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
    setOrders(list);
    setLoading(false);
  }, []);

  useEffect(() => { void loadOrders(); }, [loadOrders]);

  useEffect(() => {
    const sync = () => { void loadOrders(); };
    window.addEventListener('reform-orders-updated', sync);
    return () => window.removeEventListener('reform-orders-updated', sync);
  }, [loadOrders]);

  const logout = () => {
    localStorage.removeItem('reform-user');
    window.dispatchEvent(new Event('reform-auth-changed'));
    router.push('/');
  };

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: orders.length };
    STEPS.concat('cancelled').forEach((s) => { c[s] = orders.filter((o) => o.status === s).length; });
    return c;
  }, [orders]);

  const visible = useMemo(
    () => (filter === 'all' ? orders : orders.filter((o) => o.status === filter)),
    [orders, filter]
  );

  const spent = useMemo(
    () => orders.filter((o) => o.status !== 'cancelled').reduce((s, o) => s + o.total, 0),
    [orders]
  );

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
            <Link href="/login" className="inline-flex h-11 items-center bg-ink px-6 text-xs font-semibold uppercase tracking-[0.18em] text-paper transition hover:bg-accent">Войти</Link>
            <Link href="/register" className="inline-flex h-11 items-center border border-ink px-6 text-xs font-semibold uppercase tracking-[0.18em] transition hover:bg-ink hover:text-paper">Регистрация</Link>
          </div>
          {orders.length > 0 && (
            <p className="mt-6 border-t border-line pt-5 text-xs text-mute">
              На этом устройстве есть {orders.length} {plural(orders.length, 'заказ', 'заказа', 'заказов')}, оформленных без входа. Войдите, чтобы привязать их к аккаунту.
            </p>
          )}
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

      <div className="mt-10 grid gap-8 lg:grid-cols-[340px_minmax(0,1fr)]">
        {/* Profile */}
        <section className="h-fit space-y-6">
          <div className="border border-line bg-surface p-6">
            <div className="flex items-center gap-4">
              <div className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-ink text-lg font-medium text-paper">{initials}</div>
              <div className="min-w-0">
                <p className="truncate font-medium">{user.name}</p>
                <p className="truncate text-sm text-mute">{user.email}</p>
              </div>
            </div>
            <dl className="mt-6 space-y-3 border-t border-line pt-5 text-sm">
              <div className="flex justify-between">
                <dt className="text-mute">Заказов</dt>
                <dd className="font-medium tabular-nums">{orders.length}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-mute">На сумму</dt>
                <dd className="font-medium tabular-nums">{money(spent)}</dd>
              </div>
            </dl>
          </div>

          <div className="border border-line bg-surface p-6">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-mute">Гарантии</p>
            <ul className="mt-4 space-y-2.5 text-xs text-mute">
              <li className="flex items-center gap-2"><ShieldCheck className="h-3.5 w-3.5 shrink-0 text-accent" /> Подлинность каждой вещи</li>
              <li className="flex items-center gap-2"><Truck className="h-3.5 w-3.5 shrink-0 text-accent" /> Отправка за 48 часов</li>
              <li className="flex items-center gap-2"><RefreshCcw className="h-3.5 w-3.5 shrink-0 text-accent" /> Возврат 14 дней</li>
            </ul>
          </div>
        </section>

        {/* Orders */}
        <section>
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-sm font-medium uppercase tracking-[0.18em]">История заказов</h2>
            <button onClick={() => void loadOrders()} disabled={loading}
              className="inline-flex h-9 items-center gap-2 border border-line bg-surface px-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-mute transition hover:border-ink hover:text-ink disabled:opacity-50">
              <RefreshCcw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} /> Обновить
            </button>
          </div>

          {!syncedFromDb && !loading && orders.length > 0 && (
            <p className="mb-4 border border-info/30 bg-info/5 p-3 text-xs text-info">
              Показаны заказы, оформленные на этом устройстве. Статусы обновятся после входа через Supabase Auth.
            </p>
          )}

          {error && (
            <div className="mb-4 border border-danger/30 bg-danger/5 p-4 text-sm text-danger">
              <p className="font-medium">База недоступна</p>
              <p className="mt-0.5 text-danger/80">{error}</p>
            </div>
          )}

          {orders.length > 0 && (
            <div className="no-scrollbar mb-5 flex gap-2 overflow-x-auto pb-1">
              <FilterChip active={filter === 'all'} onClick={() => setFilter('all')}>Все · {counts.all}</FilterChip>
              {STEPS.concat('cancelled').map((s) => (
                counts[s] > 0 ? (
                  <FilterChip key={s} active={filter === s} onClick={() => setFilter(filter === s ? 'all' : s)}>
                    {STATUS_META[s].label} · {counts[s]}
                  </FilterChip>
                ) : null
              ))}
            </div>
          )}

          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-28 w-full animate-pulse bg-line" />)}
            </div>
          ) : visible.length === 0 ? (
            <div className="grid min-h-[320px] place-items-center border border-line bg-surface px-6 text-center">
              <div>
                <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-paper">
                  <Package className="h-7 w-7 text-mute" />
                </div>
                <h3 className="mt-5 text-lg font-medium tracking-tight">
                  {orders.length === 0 ? 'Заказов пока нет' : 'В этом статусе пусто'}
                </h3>
                <p className="mx-auto mt-2 max-w-xs text-sm text-mute">
                  {orders.length === 0
                    ? 'Оформите первый заказ — он появится здесь сразу после подтверждения.'
                    : 'Выберите другой статус или посмотрите все заказы.'}
                </p>
                {orders.length === 0 ? (
                  <Link href="/catalog" className="mt-6 inline-flex h-11 items-center gap-2 bg-ink px-6 text-[11px] font-semibold uppercase tracking-[0.18em] text-paper transition hover:bg-accent">
                    В каталог <ArrowRight className="h-4 w-4" />
                  </Link>
                ) : (
                  <button onClick={() => setFilter('all')} className="mt-6 inline-flex h-11 items-center border border-ink px-6 text-[11px] font-semibold uppercase tracking-[0.18em] transition hover:bg-ink hover:text-paper">
                    Показать все
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {visible.map((o) => {
                const meta = STATUS_META[o.status];
                const open = expanded === o.id;
                const stepIndex = STEPS.indexOf(o.status);
                const itemCount = o.items.reduce((s, i) => s + i.qty, 0);
                return (
                  <article key={`${o.source}-${o.id}`} className="animate-fade-up border border-line bg-surface transition hover:border-ink/20">
                    <button onClick={() => setExpanded(open ? null : o.id)}
                      className="flex w-full flex-wrap items-center gap-3 p-5 text-left">
                      <span className={`grid h-9 w-9 shrink-0 place-items-center border transition ${open ? 'border-ink bg-ink text-paper' : 'border-line'}`}>
                        <ChevronDown className={`h-4 w-4 transition-transform ${open ? 'rotate-180' : ''}`} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block font-medium">Заказ №{o.id}</span>
                        <span className="block text-xs text-mute">
                          {dateLong(o.created_at)} · {itemCount} {plural(itemCount, 'товар', 'товара', 'товаров')}
                        </span>
                      </span>
                      <span className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.12em] ${meta.cls}`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} />{meta.label}
                      </span>
                      <span className="w-24 shrink-0 text-right font-semibold tabular-nums">{money(o.total)}</span>
                    </button>

                    {open && (
                      <div className="animate-fade-in border-t border-line p-5">
                        {o.status !== 'cancelled' && (
                          <ol className="mb-6 flex items-center">
                            {STEPS.map((s, i) => (
                              <li key={s} className="flex flex-1 items-center last:flex-none">
                                <span className={`grid h-6 w-6 shrink-0 place-items-center rounded-full text-[10px] font-semibold ${i <= stepIndex ? 'bg-ink text-paper' : 'border border-line bg-paper text-mute'}`}>
                                  {i + 1}
                                </span>
                                {i < STEPS.length - 1 && (
                                  <span className={`mx-2 h-px flex-1 ${i < stepIndex ? 'bg-ink' : 'bg-line'}`} />
                                )}
                              </li>
                            ))}
                          </ol>
                        )}

                        <div className="divide-y divide-line">
                          {o.items.map((i, idx) => (
                            <div key={idx} className="flex items-center gap-4 py-3">
                              <div className="relative h-16 w-12 shrink-0 overflow-hidden bg-line/40">
                                {i.image ? (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img src={i.image} alt="" loading="lazy" className="h-full w-full object-cover" />
                                ) : null}
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-sm font-medium">{i.title}</p>
                                <p className="text-xs text-mute">
                                  {[i.size, i.color].filter(Boolean).join(' · ')} × {i.qty}
                                </p>
                              </div>
                              <p className="shrink-0 text-sm font-medium tabular-nums">{money(i.price * i.qty)}</p>
                            </div>
                          ))}
                        </div>

                        <dl className="mt-5 space-y-2.5 border-t border-line pt-4 text-sm">
                          <div className="flex justify-between gap-4">
                            <dt className="flex shrink-0 items-center gap-2 text-mute"><Truck className="h-3.5 w-3.5" /> Доставка</dt>
                            <dd className="text-right">{deliveryLabel(o.delivery_method)} · {o.delivery_cost === 0 ? 'бесплатно' : money(o.delivery_cost)}</dd>
                          </div>
                          <div className="flex justify-between gap-4">
                            <dt className="flex shrink-0 items-center gap-2 text-mute"><MapPin className="h-3.5 w-3.5" /> Адрес</dt>
                            <dd className="text-right">{o.address}</dd>
                          </div>
                          <div className="flex justify-between gap-4">
                            <dt className="flex shrink-0 items-center gap-2 text-mute"><Clock className="h-3.5 w-3.5" /> Оформлен</dt>
                            <dd className="text-right">{dateTime(o.created_at)}</dd>
                          </div>
                          {o.notes && (
                            <div className="flex justify-between gap-4">
                              <dt className="shrink-0 text-mute">Комментарий</dt>
                              <dd className="text-right">{o.notes}</dd>
                            </div>
                          )}
                          <div className="flex items-baseline justify-between border-t border-line pt-3">
                            <dt className="text-base font-medium">Итого</dt>
                            <dd className="text-lg font-semibold tabular-nums">{money(o.total)}</dd>
                          </div>
                        </dl>
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function FilterChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button onClick={onClick}
      className={`h-9 shrink-0 border px-4 text-[10px] font-semibold uppercase tracking-[0.16em] transition ${active ? 'border-ink bg-ink text-paper' : 'border-line bg-surface hover:border-ink'}`}>
      {children}
    </button>
  );
}
