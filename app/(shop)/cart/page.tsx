'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import {
  ArrowRight, Check, Minus, Plus, RotateCcw, ShieldCheck,
  ShoppingBag, Trash2, Truck, X
} from 'lucide-react';

type CartItem = {
  key: string; product_id: number; slug: string; title: string; brand: string;
  price: number; image: string | null; size: string | null; color: string | null;
  quantity: number; stock: number;
};
type DeliveryMethod = 'courier' | 'cdek' | 'pickup';
type Toast = { id: number; title: string; desc?: string; undo?: () => void };

const STORAGE_KEY = 'reform-cart-v1';
const CHECKOUT_KEY = 'reform-checkout-v1';
const FREE_FROM = 10000;

const DELIVERY: { id: DeliveryMethod; label: string; note: string; cost: number }[] = [
  { id: 'courier', label: 'Курьер по Москве', note: '1–2 дня', cost: 500 },
  { id: 'cdek', label: 'СДЭК по России', note: '2–5 дней', cost: 350 },
  { id: 'pickup', label: 'Самовывоз · Москва', note: 'сегодня', cost: 0 }
];

const money = (n: number) => new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 }).format(n) + ' ₽';
const plural = (n: number, a: string, b: string, c: string) => {
  const m = Math.abs(n) % 100, k = m % 10;
  if (m > 10 && m < 20) return c;
  if (k > 1 && k < 5) return b;
  if (k === 1) return a;
  return c;
};
const clampQty = (q: number, stock: number) => Math.max(1, Math.min(Math.trunc(q) || 1, Math.max(1, stock)));
const deliveryCost = (m: DeliveryMethod, subtotal: number) =>
  m === 'courier' ? (subtotal >= FREE_FROM ? 0 : 500) : m === 'cdek' ? 350 : 0;

function readCart(): CartItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    const items = parsed?.state?.items;
    if (!Array.isArray(items)) return [];
    return items
      .filter((x: any) => x && typeof x.key === 'string' && Number.isFinite(Number(x.price)))
      .map((x: any) => ({
        key: String(x.key),
        product_id: Number(x.product_id) || 0,
        slug: String(x.slug ?? ''),
        title: String(x.title ?? 'Товар'),
        brand: String(x.brand ?? ''),
        price: Number(x.price) || 0,
        image: x.image ?? null,
        size: x.size ?? null,
        color: x.color ?? null,
        quantity: clampQty(Number(x.quantity) || 1, Number(x.stock) || 1),
        stock: Math.max(0, Number(x.stock) || 0)
      }));
  } catch {
    return [];
  }
}

function writeCart(items: CartItem[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ state: { items }, version: 0 }));
  } catch { /* storage full or blocked */ }
  window.dispatchEvent(new Event('reform-cart-updated'));
}

export default function CartPage() {
  const [items, setItems] = useState<CartItem[]>([]);
  const [ready, setReady] = useState(false);
  const [delivery, setDelivery] = useState<DeliveryMethod>('courier');
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [confirmClear, setConfirmClear] = useState(false);
  const timers = useRef<number[]>([]);

  useEffect(() => {
    setItems(readCart());
    try {
      const saved = localStorage.getItem(CHECKOUT_KEY);
      if (saved) {
        const p = JSON.parse(saved);
        if (p?.delivery_method && DELIVERY.some((d) => d.id === p.delivery_method)) {
          setDelivery(p.delivery_method);
        }
      }
    } catch { /* ignore */ }
    setReady(true);
  }, []);

  useEffect(() => {
    const sync = () => setItems(readCart());
    window.addEventListener('storage', sync);
    return () => window.removeEventListener('storage', sync);
  }, []);

  useEffect(() => () => { timers.current.forEach((t) => window.clearTimeout(t)); }, []);

  useEffect(() => {
    document.body.style.overflow = confirmClear ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [confirmClear]);

  const pushToast = useCallback((title: string, desc?: string, undo?: () => void) => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t.slice(-2), { id, title, desc, undo }]);
    const timer = window.setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), undo ? 6000 : 3200);
    timers.current.push(timer);
  }, []);

  const commit = useCallback((next: CartItem[]) => {
    setItems(next);
    writeCart(next);
  }, []);

  const setQty = (key: string, qty: number) => {
    commit(items.map((i) => (i.key === key ? { ...i, quantity: clampQty(qty, i.stock) } : i)));
  };

  const removeItem = (key: string) => {
    const snapshot = items;
    const gone = items.find((i) => i.key === key);
    commit(items.filter((i) => i.key !== key));
    pushToast('Товар удалён', gone?.title, () => {
      commit(snapshot);
      pushToast('Восстановлено', gone?.title);
    });
  };

  const clearCart = () => {
    const snapshot = items;
    commit([]);
    setConfirmClear(false);
    pushToast('Корзина очищена', `${snapshot.length} ${plural(snapshot.length, 'позиция', 'позиции', 'позиций')}`, () => {
      commit(snapshot);
      pushToast('Корзина восстановлена');
    });
  };

  const subtotal = useMemo(() => items.reduce((s, i) => s + i.price * i.quantity, 0), [items]);
  const count = useMemo(() => items.reduce((s, i) => s + i.quantity, 0), [items]);
  const shipping = deliveryCost(delivery, subtotal);
  const total = subtotal + shipping;
  const freeLeft = Math.max(0, FREE_FROM - subtotal);
  const progress = Math.min(100, Math.round((subtotal / FREE_FROM) * 100));

  const chooseDelivery = (m: DeliveryMethod) => {
    setDelivery(m);
    try {
      localStorage.setItem(CHECKOUT_KEY, JSON.stringify({
        delivery_method: m,
        items: items.map((i) => ({ product_id: i.product_id, quantity: i.quantity, size: i.size, color: i.color }))
      }));
    } catch { /* ignore */ }
  };

  const goCheckout = () => {
    try {
      localStorage.setItem(CHECKOUT_KEY, JSON.stringify({
        delivery_method: delivery,
        items: items.map((i) => ({ product_id: i.product_id, quantity: i.quantity, size: i.size, color: i.color }))
      }));
    } catch { /* ignore */ }
  };

  if (!ready) return <CartSkeleton />;

  if (items.length === 0) {
    return (
      <div className="mx-auto max-w-[1440px] px-4 sm:px-6 lg:px-10">
        <PageHead count={0} />
        <div className="mt-8 grid min-h-[440px] place-items-center border border-line bg-surface px-6 text-center">
          <div>
            <div className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-paper">
              <ShoppingBag className="h-8 w-8 text-mute" />
            </div>
            <h2 className="mt-6 text-2xl font-medium tracking-tight">Корзина пуста</h2>
            <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-mute">
              Загляните в каталог — новинки приезжают каждую неделю, а редкие размеры уходят быстро.
            </p>
            <div className="mt-7 flex flex-wrap justify-center gap-3">
              <Link href="/catalog" className="inline-flex h-12 items-center gap-2 bg-ink px-7 text-[11px] font-semibold uppercase tracking-[0.18em] text-paper transition hover:bg-accent">
                В каталог <ArrowRight className="h-4 w-4" />
              </Link>
              <Link href="/catalog?new=1" className="inline-flex h-12 items-center border border-ink px-7 text-[11px] font-semibold uppercase tracking-[0.18em] transition hover:bg-ink hover:text-paper">
                Новинки
              </Link>
            </div>
          </div>
        </div>
        <ToastStack toasts={toasts} onClose={(id) => setToasts((t) => t.filter((x) => x.id !== id))} />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1440px] px-4 sm:px-6 lg:px-10">
      <PageHead count={count} onClear={() => setConfirmClear(true)} />

      {/* Free delivery progress */}
      <div className="mt-8 border border-line bg-surface p-5">
        <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
          <span className="flex items-center gap-2">
            <Truck className="h-4 w-4 text-accent" />
            {freeLeft > 0 ? (
              <>До бесплатной доставки курьером ещё <strong className="font-semibold">{money(freeLeft)}</strong></>
            ) : (
              <span className="font-medium text-success">Бесплатная доставка курьером применена</span>
            )}
          </span>
          <span className="text-xs uppercase tracking-[0.16em] text-mute">{progress}%</span>
        </div>
        <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-line">
          <div className={`h-full rounded-full transition-all duration-700 ease-out ${freeLeft > 0 ? 'bg-accent' : 'bg-success'}`} style={{ width: `${progress}%` }} />
        </div>
      </div>

      <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_380px]">
        {/* Items */}
        <section aria-label="Товары в корзине">
          <div className="divide-y divide-line border-y border-line">
            {items.map((item) => (
              <article key={item.key} className="flex animate-fade-up gap-4 py-6 sm:gap-5">
                <Link href={`/product/${item.slug}`} className="relative h-32 w-24 shrink-0 overflow-hidden bg-line/40 sm:h-36 sm:w-28">
                  {item.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={item.image} alt={item.title} loading="lazy" className="h-full w-full object-cover transition-transform duration-500 hover:scale-105" />
                  ) : (
                    <span className="grid h-full place-items-center text-[10px] uppercase tracking-[0.16em] text-mute">Нет фото</span>
                  )}
                </Link>

                <div className="flex min-w-0 flex-1 flex-col">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-mute">{item.brand || 'Без бренда'}</p>
                      <Link href={`/product/${item.slug}`} className="mt-1 block truncate text-base font-medium tracking-tight transition hover:text-accent">
                        {item.title}
                      </Link>
                      <p className="mt-1 text-sm text-mute">
                        {[item.size && `Размер ${item.size}`, item.color].filter(Boolean).join(' · ') || 'Без варианта'}
                      </p>
                      {item.stock <= 1 && (
                        <p className="mt-1.5 inline-flex items-center gap-1.5 text-xs text-warning">
                          <span className="h-1.5 w-1.5 rounded-full bg-warning" /> Последний экземпляр
                        </p>
                      )}
                    </div>
                    <button onClick={() => removeItem(item.key)} aria-label={`Удалить ${item.title}`}
                      className="grid h-9 w-9 shrink-0 place-items-center text-mute transition hover:bg-danger/10 hover:text-danger">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>

                  <div className="mt-auto flex flex-wrap items-end justify-between gap-3 pt-4">
                    <Stepper value={item.quantity} max={Math.max(1, item.stock)} onChange={(v) => setQty(item.key, v)} />
                    <div className="text-right">
                      <p className="text-base font-semibold">{money(item.price * item.quantity)}</p>
                      {item.quantity > 1 && <p className="text-xs text-mute">{money(item.price)} / шт.</p>}
                    </div>
                  </div>
                </div>
              </article>
            ))}
          </div>

          <Link href="/catalog" className="mt-6 inline-flex items-center gap-2 text-xs font-medium uppercase tracking-[0.16em] text-ink-soft transition hover:text-accent">
            <ArrowRight className="h-4 w-4 rotate-180" /> Продолжить покупки
          </Link>
        </section>

        {/* Summary */}
        <aside className="h-fit lg:sticky lg:top-28">
          <div className="border border-line bg-surface p-6">
            <h2 className="text-sm font-medium uppercase tracking-[0.18em]">Итого</h2>

            <div className="mt-5 space-y-2">
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-mute">Доставка</p>
              {DELIVERY.map((d) => {
                const cost = deliveryCost(d.id, subtotal);
                const active = delivery === d.id;
                return (
                  <button key={d.id} onClick={() => chooseDelivery(d.id)}
                    className={`flex w-full items-center justify-between gap-3 border p-3 text-left transition ${active ? 'border-ink bg-ink text-paper' : 'border-line bg-paper hover:border-ink'}`}>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium">{d.label}</span>
                      <span className={`block text-xs ${active ? 'text-paper/60' : 'text-mute'}`}>{d.note}</span>
                    </span>
                    <span className={`shrink-0 text-sm font-medium ${active ? 'text-paper' : cost === 0 ? 'text-success' : 'text-accent'}`}>
                      {cost === 0 ? 'Бесплатно' : money(cost)}
                    </span>
                  </button>
                );
              })}
            </div>

            <dl className="mt-6 space-y-3 border-t border-line pt-5 text-sm">
              <div className="flex justify-between">
                <dt className="text-mute">{count} {plural(count, 'товар', 'товара', 'товаров')}</dt>
                <dd>{money(subtotal)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-mute">Доставка</dt>
                <dd className={shipping === 0 ? 'text-success' : ''}>{shipping === 0 ? 'Бесплатно' : money(shipping)}</dd>
              </div>
              <div className="flex items-baseline justify-between border-t border-line pt-3">
                <dt className="text-base font-medium">К оплате</dt>
                <dd className="text-xl font-semibold tracking-tight">{money(total)}</dd>
              </div>
            </dl>

            <Link href="/checkout" onClick={goCheckout}
              className="mt-6 flex h-12 w-full items-center justify-center gap-2 bg-ink text-[11px] font-semibold uppercase tracking-[0.18em] text-paper transition hover:bg-accent">
              Оформить заказ <ArrowRight className="h-4 w-4" />
            </Link>

            <ul className="mt-5 space-y-2.5 text-xs text-mute">
              <li className="flex items-center gap-2"><ShieldCheck className="h-3.5 w-3.5 shrink-0 text-accent" /> Проверка подлинности каждой вещи</li>
              <li className="flex items-center gap-2"><Truck className="h-3.5 w-3.5 shrink-0 text-accent" /> Отправка в течение 48 часов</li>
              <li className="flex items-center gap-2"><RotateCcw className="h-3.5 w-3.5 shrink-0 text-accent" /> Возврат 14 дней</li>
            </ul>
          </div>
        </aside>
      </div>

      {/* Clear confirm */}
      {confirmClear && (
        <div className="fixed inset-0 z-[85] flex items-end justify-center sm:items-center sm:p-6">
          <div className="absolute inset-0 animate-fade-in bg-ink/45 backdrop-blur-sm" onClick={() => setConfirmClear(false)} />
          <div className="relative w-full max-w-md animate-fade-up border border-line bg-surface p-6 sm:p-8">
            <h3 className="text-lg font-medium tracking-tight">Очистить корзину?</h3>
            <p className="mt-2 text-sm text-mute">
              Будет удалено {items.length} {plural(items.length, 'позиция', 'позиции', 'позиций')}. Действие можно отменить сразу после.
            </p>
            <div className="mt-6 flex gap-3">
              <button onClick={() => setConfirmClear(false)}
                className="h-11 flex-1 border border-ink text-[11px] font-semibold uppercase tracking-[0.16em] transition hover:bg-ink hover:text-paper">
                Отмена
              </button>
              <button onClick={clearCart}
                className="h-11 flex-1 bg-danger text-[11px] font-semibold uppercase tracking-[0.16em] text-white transition hover:bg-danger/90">
                Очистить
              </button>
            </div>
          </div>
        </div>
      )}

      <ToastStack toasts={toasts} onClose={(id) => setToasts((t) => t.filter((x) => x.id !== id))} />
    </div>
  );
}

function PageHead({ count, onClear }: { count: number; onClear?: () => void }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4 pt-2">
      <div>
        <p className="text-[11px] font-medium uppercase tracking-[0.28em] text-accent">Корзина</p>
        <h1 className="mt-2 text-3xl font-medium tracking-tight sm:text-4xl">Ваши покупки</h1>
        <p className="mt-2 text-sm text-mute">
          {count > 0 ? `${count} ${plural(count, 'товар', 'товара', 'товаров')} готово к оформлению` : 'Пока ничего не выбрано'}
        </p>
      </div>
      {onClear && (
        <button onClick={onClear}
          className="inline-flex h-10 items-center gap-2 border border-line bg-surface px-4 text-[11px] font-semibold uppercase tracking-[0.16em] text-mute transition hover:border-danger hover:text-danger">
          <Trash2 className="h-4 w-4" /> Очистить
        </button>
      )}
    </div>
  );
}

function Stepper({ value, max, onChange }: { value: number; max: number; onChange: (v: number) => void }) {
  return (
    <div className="inline-flex h-11 items-center border border-line bg-surface">
      <button onClick={() => onChange(value - 1)} disabled={value <= 1} aria-label="Уменьшить количество"
        className="grid h-full w-10 place-items-center transition hover:bg-ink/5 disabled:cursor-not-allowed disabled:opacity-30">
        <Minus className="h-3.5 w-3.5" />
      </button>
      <span className="w-10 text-center text-sm font-medium tabular-nums">{value}</span>
      <button onClick={() => onChange(value + 1)} disabled={value >= max} aria-label="Увеличить количество"
        className="grid h-full w-10 place-items-center transition hover:bg-ink/5 disabled:cursor-not-allowed disabled:opacity-30">
        <Plus className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

function ToastStack({ toasts, onClose }: { toasts: Toast[]; onClose: (id: number) => void }) {
  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-[95] flex w-[calc(100vw-2rem)] max-w-sm flex-col gap-2">
      {toasts.map((t) => (
        <div key={t.id} className="pointer-events-auto flex animate-toast-in items-start gap-3 bg-ink p-4 text-paper shadow-2xl">
          <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-success"><Check className="h-3 w-3" /></span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium">{t.title}</p>
            {t.desc && <p className="mt-0.5 truncate text-xs text-paper/60">{t.desc}</p>}
            {t.undo && (
              <button onClick={() => { t.undo?.(); onClose(t.id); }}
                className="mt-2 inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-paper underline underline-offset-4 transition hover:text-accent">
                <RotateCcw className="h-3 w-3" /> Отменить
              </button>
            )}
          </div>
          <button onClick={() => onClose(t.id)} aria-label="Закрыть уведомление" className="shrink-0 text-paper/50 transition hover:text-paper">
            <X className="h-4 w-4" />
          </button>
        </div>
      ))}
    </div>
  );
}

function CartSkeleton() {
  return (
    <div className="mx-auto max-w-[1440px] px-4 sm:px-6 lg:px-10">
      <div className="pt-2">
        <div className="h-3 w-24 animate-pulse bg-line" />
        <div className="mt-3 h-10 w-64 animate-pulse bg-line" />
      </div>
      <div className="mt-8 h-20 w-full animate-pulse bg-line" />
      <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="space-y-6">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex gap-5">
              <div className="h-36 w-28 shrink-0 animate-pulse bg-line" />
              <div className="flex-1 space-y-3 py-2">
                <div className="h-3 w-24 animate-pulse bg-line" />
                <div className="h-4 w-2/3 animate-pulse bg-line" />
                <div className="h-3 w-32 animate-pulse bg-line" />
                <div className="h-11 w-32 animate-pulse bg-line" />
              </div>
            </div>
          ))}
        </div>
        <div className="h-96 w-full animate-pulse bg-line" />
      </div>
    </div>
  );
}
