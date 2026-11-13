'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { createClient } from '@supabase/supabase-js';
import {
  ArrowLeft, ArrowRight, BadgeCheck, Banknote, Check, CheckCircle2, Clock,
  CreditCard, Info, Loader2, MapPin, Package, ShieldCheck, ShoppingBag,
  Smartphone, Truck, User, X
} from 'lucide-react';

type CartItem = {
  key: string; product_id: number; slug: string; title: string; brand: string;
  price: number; image: string | null; size: string | null; color: string | null;
  quantity: number; stock: number;
};
type DeliveryMethod = 'courier' | 'cdek' | 'pickup';
type Payment = 'cash' | 'sbp';
type Receipt = {
  id: number; created_at: string; customer_name: string; customer_phone: string;
  customer_email: string; delivery_method: DeliveryMethod; delivery_cost: number;
  total_amount: number; shipping_address: string; notes: string | null;
  items: { title: string; size: string | null; color: string | null; quantity: number; price: number; image: string | null }[];
};

const CART_KEY = 'reform-cart-v1';
const CHECKOUT_KEY = 'reform-checkout-v1';
const DRAFT_KEY = 'reform-checkout-draft-v1';
const RECEIPT_KEY = 'reform-last-order-v1';
const ORDERS_KEY = 'reform-orders-v1';
const FREE_FROM = 10000;
const PICKUP_ADDRESS = 'Москва, ул. Большая Никитская, 12';

const DELIVERY: { id: DeliveryMethod; label: string; note: string; icon: typeof Truck }[] = [
  { id: 'courier', label: 'Курьер по Москве', note: '1–2 дня · примерка при получении', icon: Truck },
  { id: 'cdek', label: 'СДЭК по России', note: '2–5 дней · до пункта выдачи', icon: Package },
  { id: 'pickup', label: 'Самовывоз · Москва', note: 'сегодня · Большая Никитская, 12', icon: MapPin }
];

const PAYMENTS: { id: Payment; label: string; note: string; icon: typeof Banknote }[] = [
  { id: 'cash', label: 'При получении', note: 'Наличными или картой курьеру', icon: Banknote },
  { id: 'sbp', label: 'Перевод по СБП', note: 'Реквизиты пришлём в Telegram', icon: Smartphone }
];

const money = (n: number) => new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 }).format(n) + ' ₽';
const plural = (n: number, a: string, b: string, c: string) => {
  const m = Math.abs(n) % 100, k = m % 10;
  if (m > 10 && m < 20) return c;
  if (k > 1 && k < 5) return b;
  if (k === 1) return a;
  return c;
};
const deliveryCost = (m: DeliveryMethod, subtotal: number) =>
  m === 'courier' ? (subtotal >= FREE_FROM ? 0 : 500) : m === 'cdek' ? 350 : 0;
const deliveryLabel = (m: DeliveryMethod) => DELIVERY.find((d) => d.id === m)?.label ?? m;

function maskPhone(raw: string): string {
  let d = raw.replace(/\D/g, '');
  if (!d) return '';
  if (d.startsWith('8')) d = '7' + d.slice(1);
  if (!d.startsWith('7')) d = '7' + d;
  d = d.slice(0, 11);
  let out = '+7';
  if (d.length > 1) out += ' (' + d.slice(1, 4);
  if (d.length >= 4) out += ')';
  if (d.length > 4) out += ' ' + d.slice(4, 7);
  if (d.length > 7) out += '-' + d.slice(7, 9);
  if (d.length > 9) out += '-' + d.slice(9, 11);
  return out;
}

function readCart(): CartItem[] {
  try {
    const raw = localStorage.getItem(CART_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    const items = parsed?.state?.items;
    if (!Array.isArray(items)) return [];
    return items
      .filter((x: any) => x && Number.isFinite(Number(x.price)))
      .map((x: any) => ({
        key: String(x.key ?? `${x.product_id}`),
        product_id: Number(x.product_id) || 0,
        slug: String(x.slug ?? ''),
        title: String(x.title ?? 'Товар'),
        brand: String(x.brand ?? ''),
        price: Number(x.price) || 0,
        image: x.image ?? null,
        size: x.size ?? null,
        color: x.color ?? null,
        quantity: Math.max(1, Number(x.quantity) || 1),
        stock: Math.max(0, Number(x.stock) || 0)
      }));
  } catch {
    return [];
  }
}

function clearCartStorage() {
  try {
    localStorage.setItem(CART_KEY, JSON.stringify({ state: { items: [] }, version: 0 }));
  } catch { /* ignore */ }
  window.dispatchEvent(new Event('reform-cart-updated'));
}

function saveOrderLocally(r: Receipt) {
  try {
    localStorage.setItem(RECEIPT_KEY, JSON.stringify(r));
    const raw = localStorage.getItem(ORDERS_KEY);
    const list = raw ? JSON.parse(raw) : [];
    const next = Array.isArray(list) ? [r, ...list].slice(0, 50) : [r];
    localStorage.setItem(ORDERS_KEY, JSON.stringify(next));
    window.dispatchEvent(new Event('reform-orders-updated'));
  } catch { /* ignore */ }
}

export default function CheckoutPage() {
  const [items, setItems] = useState<CartItem[]>([]);
  const [ready, setReady] = useState(false);
  const [delivery, setDelivery] = useState<DeliveryMethod>('courier');
  const [payment, setPayment] = useState<Payment>('cash');

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [city, setCity] = useState('');
  const [street, setStreet] = useState('');
  const [comment, setComment] = useState('');
  const [agree, setAgree] = useState(true);

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState('');
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<number | null>(null);

  useEffect(() => {
    setItems(readCart());
    try {
      const saved = localStorage.getItem(CHECKOUT_KEY);
      if (saved) {
        const p = JSON.parse(saved);
        if (p?.delivery_method && DELIVERY.some((d) => d.id === p.delivery_method)) setDelivery(p.delivery_method);
      }
      const draft = localStorage.getItem(DRAFT_KEY);
      if (draft) {
        const d = JSON.parse(draft);
        setName(d.name ?? ''); setPhone(d.phone ?? ''); setEmail(d.email ?? '');
        setCity(d.city ?? ''); setStreet(d.street ?? ''); setComment(d.comment ?? '');
        if (d.payment && PAYMENTS.some((x) => x.id === d.payment)) setPayment(d.payment);
      } else {
        const u = localStorage.getItem('reform-user');
        if (u) {
          const parsed = JSON.parse(u);
          setName(parsed?.name ?? '');
          setEmail(parsed?.email ?? '');
        }
      }
    } catch { /* ignore */ }
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready || receipt) return;
    const t = window.setTimeout(() => {
      try {
        localStorage.setItem(DRAFT_KEY, JSON.stringify({ name, phone, email, city, street, comment, payment }));
        localStorage.setItem(CHECKOUT_KEY, JSON.stringify({
          delivery_method: delivery,
          items: items.map((i) => ({ product_id: i.product_id, quantity: i.quantity, size: i.size, color: i.color }))
        }));
      } catch { /* ignore */ }
    }, 400);
    return () => window.clearTimeout(t);
  }, [ready, receipt, name, phone, email, city, street, comment, payment, delivery, items]);

  useEffect(() => () => { if (toastTimer.current) window.clearTimeout(toastTimer.current); }, []);

  const flash = useCallback((text: string) => {
    setToast(text);
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 3000);
  }, []);

  const subtotal = useMemo(() => items.reduce((s, i) => s + i.price * i.quantity, 0), [items]);
  const count = useMemo(() => items.reduce((s, i) => s + i.quantity, 0), [items]);
  const shipping = deliveryCost(delivery, subtotal);
  const total = subtotal + shipping;
  const freeLeft = Math.max(0, FREE_FROM - subtotal);

  const validate = useCallback(() => {
    const e: Record<string, string> = {};
    if (name.trim().length < 2) e.name = 'Укажите имя и фамилию';
    if (phone.replace(/\D/g, '').length !== 11) e.phone = 'Введите номер полностью';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim())) e.email = 'Проверьте адрес почты';
    if (delivery !== 'pickup') {
      if (city.trim().length < 2) e.city = 'Укажите город';
      if (street.trim().length < 5) e.street = 'Укажите улицу, дом и квартиру';
    }
    if (!agree) e.agree = 'Нужно согласие на обработку данных';
    return e;
  }, [name, phone, email, city, street, delivery, agree]);

  useEffect(() => {
    if (Object.keys(touched).length === 0) return;
    const e = validate();
    setErrors(Object.fromEntries(Object.entries(e).filter(([k]) => touched[k])));
  }, [touched, validate]);

  const blur = (field: string) => setTouched((t) => ({ ...t, [field]: true }));

  const submit = async () => {
    setServerError('');
    const e = validate();
    setTouched({ name: true, phone: true, email: true, city: true, street: true, agree: true });
    setErrors(e);
    if (Object.keys(e).length > 0) {
      const key = Object.keys(e)[0];
      const el = document.querySelector<HTMLElement>(`[data-field="${key}"]`);
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      window.setTimeout(() => el?.querySelector<HTMLElement>('input, textarea')?.focus(), 350);
      flash('Проверьте отмеченные поля');
      return;
    }
    if (items.length === 0) { flash('Корзина пуста'); return; }

    setSubmitting(true);
    const address = delivery === 'pickup'
      ? `Самовывоз: ${PICKUP_ADDRESS}`
      : `${deliveryLabel(delivery)}: ${city.trim()}, ${street.trim()}`;
    const paymentLabel = PAYMENTS.find((p) => p.id === payment)?.label ?? '';
    const notes = `Оплата: ${paymentLabel}${comment.trim() ? ` · ${comment.trim()}` : ''}`;
    const payloadItems = items.map((i) => ({
      product_id: i.product_id, quantity: i.quantity, size: i.size, color: i.color
    }));

    const snapshot: Receipt = {
      id: 0, created_at: new Date().toISOString(),
      customer_name: name.trim(), customer_phone: phone.trim(), customer_email: email.trim(),
      delivery_method: delivery, delivery_cost: shipping, total_amount: total,
      shipping_address: address, notes,
      items: items.map((i) => ({ title: i.title, size: i.size, color: i.color, quantity: i.quantity, price: i.price, image: i.image }))
    };

    try {
      const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      let orderId: number;

      if (url && key) {
        const supabase = createClient(url, key);
        const { data, error } = await supabase.rpc('place_order', {
          p_customer_name: name.trim(),
          p_customer_phone: phone.trim(),
          p_customer_email: email.trim(),
          p_shipping_address: address,
          p_notes: notes,
          p_delivery_method: delivery,
          p_items: payloadItems
        });
        if (error) throw new Error(error.message);
        orderId = Number(data);
      } else {
        await new Promise((r) => setTimeout(r, 700));
        orderId = 1000 + (Math.floor(Date.now() / 1000) % 9000);
      }

      const finalReceipt: Receipt = { ...snapshot, id: orderId };
      saveOrderLocally(finalReceipt);
      clearCartStorage();
      try { localStorage.removeItem(DRAFT_KEY); } catch { /* ignore */ }
      setReceipt(finalReceipt);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Не удалось оформить заказ';
      setServerError(msg);
      flash(msg);
    } finally {
      setSubmitting(false);
    }
  };

  if (!ready) return <CheckoutSkeleton />;
  if (receipt) return <SuccessView receipt={receipt} />;

  if (items.length === 0) {
    return (
      <div className="mx-auto max-w-[1440px] px-4 sm:px-6 lg:px-10">
        <BackLink />
        <div className="mt-6 grid min-h-[440px] place-items-center border border-line bg-surface px-6 text-center">
          <div>
            <div className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-paper">
              <ShoppingBag className="h-8 w-8 text-mute" />
            </div>
            <h1 className="mt-6 text-2xl font-medium tracking-tight">Нечего оформлять</h1>
            <p className="mx-auto mt-2 max-w-sm text-sm text-mute">Сначала добавьте вещи в корзину — потом вернёмся к доставке и оплате.</p>
            <Link href="/catalog" className="mt-7 inline-flex h-12 items-center gap-2 bg-ink px-7 text-[11px] font-semibold uppercase tracking-[0.18em] text-paper transition hover:bg-accent">
              В каталог <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1440px] px-4 pb-4 sm:px-6 lg:px-10">
      <BackLink />

      <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.28em] text-accent">Оформление</p>
          <h1 className="mt-2 text-3xl font-medium tracking-tight sm:text-4xl">Заказ</h1>
        </div>
        <ol className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.16em]">
          {['Контакты', 'Доставка', 'Оплата'].map((s, i) => (
            <li key={s} className="flex items-center gap-2">
              <span className="grid h-6 w-6 place-items-center rounded-full bg-ink text-paper">{i + 1}</span>
              <span className="text-ink-soft">{s}</span>
              {i < 2 && <span className="mx-1 h-px w-5 bg-line" />}
            </li>
          ))}
        </ol>
      </div>

      {serverError && (
        <div className="mt-6 flex items-start gap-3 border border-danger/30 bg-danger/5 p-4 text-sm text-danger">
          <Info className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <p className="font-medium">Заказ не принят</p>
            <p className="mt-0.5 text-danger/80">{serverError}</p>
          </div>
        </div>
      )}

      <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="space-y-8">
          <section className="border border-line bg-surface p-6">
            <SectionTitle n={1} title="Контактные данные" icon={User} />
            <div className="mt-5 grid gap-5 sm:grid-cols-2">
              <Field label="Имя и фамилия" error={errors.name} field="name" required>
                <input value={name} onChange={(e) => setName(e.target.value)} onBlur={() => blur('name')}
                  placeholder="Анна Смирнова" autoComplete="name" className={inputCls(!!errors.name)} />
              </Field>
              <Field label="Телефон" error={errors.phone} field="phone" required>
                <input value={phone} onChange={(e) => setPhone(maskPhone(e.target.value))} onBlur={() => blur('phone')}
                  placeholder="+7 (___) ___-__-__" inputMode="tel" autoComplete="tel" className={inputCls(!!errors.phone)} />
              </Field>
              <Field label="Email" error={errors.email} field="email" required className="sm:col-span-2">
                <input value={email} onChange={(e) => setEmail(e.target.value)} onBlur={() => blur('email')}
                  placeholder="you@example.com" type="email" autoComplete="email" className={inputCls(!!errors.email)} />
              </Field>
            </div>
            <p className="mt-3 text-xs text-mute">Позвоним или напишем в течение часа, чтобы подтвердить наличие и размер.</p>
          </section>

          <section className="border border-line bg-surface p-6">
            <SectionTitle n={2} title="Доставка" icon={Truck} />
            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              {DELIVERY.map((d) => {
                const cost = deliveryCost(d.id, subtotal);
                const active = delivery === d.id;
                return (
                  <button key={d.id} onClick={() => setDelivery(d.id)}
                    className={`border p-4 text-left transition-all duration-300 ${active ? 'border-ink bg-ink text-paper shadow-lg' : 'border-line bg-paper hover:border-ink'}`}>
                    <d.icon className={`h-5 w-5 ${active ? 'text-paper' : 'text-accent'}`} />
                    <p className="mt-3 text-sm font-medium">{d.label}</p>
                    <p className={`mt-1 text-xs leading-snug ${active ? 'text-paper/60' : 'text-mute'}`}>{d.note}</p>
                    <p className={`mt-2.5 text-sm font-semibold ${active ? 'text-paper' : cost === 0 ? 'text-success' : 'text-accent'}`}>
                      {cost === 0 ? 'Бесплатно' : money(cost)}
                    </p>
                  </button>
                );
              })}
            </div>

            {delivery === 'pickup' ? (
              <div className="mt-5 flex items-start gap-3 border border-line bg-paper p-4 text-sm">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
                <div>
                  <p className="font-medium">{PICKUP_ADDRESS}</p>
                  <p className="mt-0.5 text-mute">Ежедневно 12:00–21:00 · примерка по записи</p>
                </div>
              </div>
            ) : (
              <div className="mt-5 grid gap-5 sm:grid-cols-[200px_minmax(0,1fr)]">
                <Field label="Город" error={errors.city} field="city" required>
                  <input value={city} onChange={(e) => setCity(e.target.value)} onBlur={() => blur('city')}
                    placeholder="Москва" autoComplete="address-level2" className={inputCls(!!errors.city)} />
                </Field>
                <Field label="Улица, дом, квартира" error={errors.street} field="street" required>
                  <input value={street} onChange={(e) => setStreet(e.target.value)} onBlur={() => blur('street')}
                    placeholder="ул. Пушкина, 10, кв. 5" autoComplete="street-address" className={inputCls(!!errors.street)} />
                </Field>
              </div>
            )}

            {freeLeft > 0 && delivery === 'courier' && (
              <p className="mt-4 flex items-center gap-2 text-xs text-accent">
                <Truck className="h-3.5 w-3.5" /> Добавьте ещё на {money(freeLeft)} — курьер станет бесплатным
              </p>
            )}
          </section>

          <section className="border border-line bg-surface p-6">
            <SectionTitle n={3} title="Оплата" icon={CreditCard} />
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {PAYMENTS.map((p) => {
                const active = payment === p.id;
                return (
                  <button key={p.id} onClick={() => setPayment(p.id)}
                    className={`flex items-start gap-3 border p-4 text-left transition-all duration-300 ${active ? 'border-ink bg-ink text-paper shadow-lg' : 'border-line bg-paper hover:border-ink'}`}>
                    <p.icon className={`mt-0.5 h-5 w-5 shrink-0 ${active ? 'text-paper' : 'text-accent'}`} />
                    <span className="min-w-0">
                      <span className="block text-sm font-medium">{p.label}</span>
                      <span className={`mt-0.5 block text-xs ${active ? 'text-paper/60' : 'text-mute'}`}>{p.note}</span>
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="mt-5" data-field="comment">
              <label className="mb-2 block text-[11px] font-medium uppercase tracking-[0.18em] text-ink-soft">Комментарий к заказу</label>
              <textarea value={comment} onChange={(e) => setComment(e.target.value)} rows={3}
                placeholder="Пожелания по доставке, вопросы по замерам…"
                className="w-full border border-line bg-paper px-4 py-3 text-sm outline-none transition placeholder:text-mute/60 focus:border-ink" />
            </div>

            <label data-field="agree" className="mt-5 flex cursor-pointer items-start gap-3 text-sm">
              <span className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center border transition ${agree ? 'border-ink bg-ink text-paper' : errors.agree ? 'border-danger bg-paper' : 'border-line bg-paper'}`}>
                {agree && <Check className="h-3 w-3" />}
              </span>
              <input type="checkbox" checked={agree} onChange={(e) => { setAgree(e.target.checked); blur('agree'); }} className="sr-only" />
              <span className={errors.agree ? 'text-danger' : 'text-ink-soft'}>
                Согласен на обработку персональных данных для оформления и доставки заказа
              </span>
            </label>
          </section>
        </div>

        <aside className="h-fit lg:sticky lg:top-28">
          <div className="border border-line bg-surface p-6">
            <h2 className="text-sm font-medium uppercase tracking-[0.18em]">Ваш заказ</h2>

            <div className="catalog-scroll mt-5 max-h-72 space-y-4 overflow-y-auto pr-1">
              {items.map((i) => (
                <div key={i.key} className="flex items-center gap-3">
                  <div className="relative h-16 w-12 shrink-0 overflow-hidden bg-line/40">
                    {i.image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={i.image} alt="" loading="lazy" className="h-full w-full object-cover" />
                    ) : null}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{i.title}</p>
                    <p className="text-xs text-mute">{[i.size, i.color].filter(Boolean).join(' · ')} × {i.quantity}</p>
                  </div>
                  <p className="shrink-0 text-sm font-medium tabular-nums">{money(i.price * i.quantity)}</p>
                </div>
              ))}
            </div>

            <dl className="mt-5 space-y-2.5 border-t border-line pt-4 text-sm">
              <div className="flex justify-between">
                <dt className="text-mute">{count} {plural(count, 'товар', 'товара', 'товаров')}</dt>
                <dd className="tabular-nums">{money(subtotal)}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="min-w-0 truncate text-mute">{deliveryLabel(delivery)}</dt>
                <dd className={`shrink-0 tabular-nums ${shipping === 0 ? 'text-success' : ''}`}>{shipping === 0 ? 'Бесплатно' : money(shipping)}</dd>
              </div>
              <div className="flex items-baseline justify-between border-t border-line pt-3">
                <dt className="text-base font-medium">Итого</dt>
                <dd className="text-xl font-semibold tracking-tight tabular-nums">{money(total)}</dd>
              </div>
            </dl>

            <button onClick={submit} disabled={submitting}
              className="mt-6 flex h-12 w-full items-center justify-center gap-2 bg-ink text-[11px] font-semibold uppercase tracking-[0.18em] text-paper transition hover:bg-accent disabled:cursor-not-allowed disabled:opacity-70">
              {submitting ? (<><Loader2 className="h-4 w-4 animate-spin" /> Оформляем…</>) : (<>Подтвердить · {money(total)}</>)}
            </button>

            <Link href="/cart" className="mt-3 flex h-10 w-full items-center justify-center gap-2 text-[11px] font-medium uppercase tracking-[0.16em] text-mute transition hover:text-ink">
              <ArrowLeft className="h-3.5 w-3.5" /> Вернуться в корзину
            </Link>

            <ul className="mt-5 space-y-2.5 border-t border-line pt-5 text-xs text-mute">
              <li className="flex items-center gap-2"><ShieldCheck className="h-3.5 w-3.5 shrink-0 text-accent" /> Подлинность гарантируем</li>
              <li className="flex items-center gap-2"><Clock className="h-3.5 w-3.5 shrink-0 text-accent" /> Отправка в течение 48 часов</li>
              <li className="flex items-center gap-2"><BadgeCheck className="h-3.5 w-3.5 shrink-0 text-accent" /> Возврат 14 дней</li>
            </ul>
          </div>
        </aside>
      </div>

      {toast && (
        <div className="pointer-events-none fixed bottom-4 left-1/2 z-[95] w-[calc(100vw-2rem)] max-w-sm -translate-x-1/2">
          <div className="pointer-events-auto flex animate-toast-in items-center gap-3 bg-ink p-4 text-paper shadow-2xl">
            <Info className="h-4 w-4 shrink-0 text-warning" />
            <p className="min-w-0 flex-1 truncate text-sm">{toast}</p>
            <button onClick={() => setToast(null)} aria-label="Закрыть" className="shrink-0 text-paper/50 transition hover:text-paper">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function SuccessView({ receipt }: { receipt: Receipt }) {
  const [copied, setCopied] = useState(false);
  const firstName = receipt.customer_name.split(' ')[0];

  const copyNumber = async () => {
    try {
      await navigator.clipboard.writeText(String(receipt.id));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch { /* clipboard blocked */ }
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6">
      <div className="relative overflow-hidden border border-line bg-surface">
        <div className="pointer-events-none absolute inset-0" style={{
          background: 'radial-gradient(60% 70% at 15% 0%, rgba(31,122,77,.12), transparent 60%), radial-gradient(50% 60% at 90% 10%, rgba(154,59,38,.10), transparent 60%)'
        }} />
        <div className="relative p-8 text-center sm:p-12">
          <div className="mx-auto grid h-20 w-20 animate-fade-up place-items-center rounded-full bg-success/10">
            <CheckCircle2 className="h-10 w-10 text-success" />
          </div>
          <p className="mt-6 animate-fade-up text-[11px] font-medium uppercase tracking-[0.28em] text-accent" style={{ animationDelay: '60ms' }}>Заказ принят</p>
          <h1 className="mt-3 animate-fade-up text-3xl font-medium tracking-tight sm:text-4xl" style={{ animationDelay: '120ms' }}>
            Спасибо, {firstName}!
          </h1>
          <button onClick={copyNumber} title="Скопировать номер"
            className="mt-5 inline-flex animate-fade-up items-center gap-2 border border-line bg-paper px-5 py-2.5 transition hover:border-ink"
            style={{ animationDelay: '180ms' }}>
            <span className="text-xs uppercase tracking-[0.18em] text-mute">Заказ</span>
            <span className="text-lg font-semibold tabular-nums">№{receipt.id}</span>
            {copied ? <Check className="h-4 w-4 text-success" /> : <span className="text-[10px] uppercase tracking-[0.14em] text-mute">копировать</span>}
          </button>
          <p className="mx-auto mt-5 max-w-md animate-fade-up text-sm leading-relaxed text-ink-soft" style={{ animationDelay: '240ms' }}>
            Свяжемся по номеру <strong className="font-medium text-ink">{receipt.customer_phone}</strong> в течение часа, подтвердим наличие и договоримся о доставке.
          </p>
        </div>
      </div>

      <div className="mt-6 border border-line bg-surface p-6">
        <h2 className="text-sm font-medium uppercase tracking-[0.18em]">Состав заказа</h2>
        <div className="mt-5 divide-y divide-line">
          {receipt.items.map((i, idx) => (
            <div key={idx} className="flex items-center gap-4 py-3">
              <div className="relative h-16 w-12 shrink-0 overflow-hidden bg-line/40">
                {i.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={i.image} alt="" className="h-full w-full object-cover" />
                ) : null}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{i.title}</p>
                <p className="text-xs text-mute">{[i.size, i.color].filter(Boolean).join(' · ')} × {i.quantity}</p>
              </div>
              <p className="shrink-0 text-sm font-medium tabular-nums">{money(i.price * i.quantity)}</p>
            </div>
          ))}
        </div>

        <dl className="mt-5 space-y-2.5 border-t border-line pt-4 text-sm">
          <div className="flex justify-between gap-4">
            <dt className="shrink-0 text-mute">Доставка</dt>
            <dd className="text-right">{deliveryLabel(receipt.delivery_method)} · {receipt.delivery_cost === 0 ? 'бесплатно' : money(receipt.delivery_cost)}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="shrink-0 text-mute">Адрес</dt>
            <dd className="text-right">{receipt.shipping_address}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="shrink-0 text-mute">Email</dt>
            <dd className="text-right">{receipt.customer_email}</dd>
          </div>
          {receipt.notes && (
            <div className="flex justify-between gap-4">
              <dt className="shrink-0 text-mute">Оплата</dt>
              <dd className="text-right">{receipt.notes}</dd>
            </div>
          )}
          <div className="flex items-baseline justify-between border-t border-line pt-3">
            <dt className="text-base font-medium">Итого</dt>
            <dd className="text-xl font-semibold tabular-nums">{money(receipt.total_amount)}</dd>
          </div>
        </dl>
      </div>

      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <Link href="/catalog" className="inline-flex h-12 items-center gap-2 bg-ink px-7 text-[11px] font-semibold uppercase tracking-[0.18em] text-paper transition hover:bg-accent">
          Продолжить покупки <ArrowRight className="h-4 w-4" />
        </Link>
        <Link href="/account" className="inline-flex h-12 items-center border border-ink px-7 text-[11px] font-semibold uppercase tracking-[0.18em] transition hover:bg-ink hover:text-paper">
          Мои заказы
        </Link>
      </div>
    </div>
  );
}

const inputCls = (invalid: boolean) =>
  `h-11 w-full border bg-paper px-4 text-sm outline-none transition placeholder:text-mute/60 focus:border-ink ${invalid ? 'border-danger' : 'border-line'}`;

function Field({ label, error, field, required, className = '', children }: {
  label: string; error?: string; field: string; required?: boolean; className?: string; children: ReactNode;
}) {
  return (
    <div data-field={field} className={className}>
      <label className="mb-2 block text-[11px] font-medium uppercase tracking-[0.18em] text-ink-soft">
        {label}{required && <span className="text-accent"> *</span>}
      </label>
      {children}
      {error && <p className="mt-1.5 text-xs text-danger">{error}</p>}
    </div>
  );
}

function SectionTitle({ n, title, icon: Icon }: { n: number; title: string; icon: typeof User }) {
  return (
    <div className="flex items-center gap-3">
      <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-ink text-[11px] font-semibold text-paper">{n}</span>
      <h2 className="text-sm font-medium uppercase tracking-[0.18em]">{title}</h2>
      <Icon className="ml-auto h-4 w-4 text-mute" />
    </div>
  );
}

function BackLink() {
  return (
    <Link href="/cart" className="inline-flex items-center gap-2 pt-2 text-xs uppercase tracking-[0.18em] text-mute transition hover:text-ink">
      <ArrowLeft className="h-4 w-4" /> В корзину
    </Link>
  );
}

function CheckoutSkeleton() {
  return (
    <div className="mx-auto max-w-[1440px] px-4 sm:px-6 lg:px-10">
      <div className="pt-2">
        <div className="h-3 w-24 animate-pulse bg-line" />
        <div className="mt-3 h-10 w-40 animate-pulse bg-line" />
      </div>
      <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="space-y-6">
          {Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-56 w-full animate-pulse bg-line" />)}
        </div>
        <div className="h-[420px] w-full animate-pulse bg-line" />
      </div>
    </div>
  );
}
