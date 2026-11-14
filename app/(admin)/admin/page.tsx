'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import {
  AlertTriangle, ArrowDownRight, ArrowUpRight, BarChart3, Boxes, Check, ChevronRight,
  Copy, Database, Download, Eye, EyeOff, GripVertical, Image as ImageIcon, LayoutGrid,
  Loader2, LogOut, Package, Pencil, Plus, RefreshCcw, Search, Save, Settings, ShieldAlert, ShoppingBag,
  Sparkles, Tag, Trash2, Truck, Upload, X, Zap
} from 'lucide-react';
import AdminSettingsPage from './settings/page';

type Condition = 'new' | 'excellent' | 'good' | 'fair';
type OrderStatus = 'pending' | 'confirmed' | 'shipped' | 'delivered' | 'cancelled';
type DeliveryMethod = 'courier' | 'cdek' | 'pickup';
type Product = {
  id: number; title: string; slug: string; description: string | null;
  price: number; old_price: number | null; brand_id: number | null; category_id: number | null;
  condition: Condition; sizes: string[]; colors: string[]; images: string[];
  stock: number; is_new: boolean; is_popular: boolean; is_published: boolean; created_at: string;
};
type Brand = { id: number; name: string; slug: string };
type Category = { id: number; name: string; slug: string; sort_order: number };
type OrderItem = {
  id: number; product_id: number; title_snapshot: string; price_snapshot: number;
  image_snapshot: string | null; size: string | null; color: string | null; quantity: number;
};
type Order = {
  id: number; user_id: string | null; customer_name: string; customer_phone: string;
  customer_email: string; shipping_address: string; notes: string | null;
  delivery_method: DeliveryMethod; delivery_cost: number; total_amount: number;
  status: OrderStatus; created_at: string; order_items: OrderItem[];
};
type Toast = { id: number; title: string; desc?: string; tone: 'ok' | 'warn' | 'bad'; undo?: () => void };
type Tab = 'overview' | 'products' | 'orders' | 'taxonomy' | 'settings';
type GateState = 'checking' | 'login' | 'setup' | 'denied' | 'ok' | 'demo';
type ToastFn = (title: string, desc?: string, tone?: Toast['tone'], undo?: () => void) => void;

const C = {
  void: '#0B0D10', panel: '#14181D', raised: '#1C222A', line: '#2A323C',
  mist: '#8A97A6', chalk: '#E8EDF3', signal: '#FF5A1F', volt: '#C6FF3D',
  azure: '#3B82F6', amber: '#FFB020', rose: '#FF3B5C', mint: '#22C55E', violet: '#A855F7'
};
const STATUS_META: Record<OrderStatus, { label: string; color: string; next: OrderStatus[] }> = {
  pending:   { label: 'Новый',       color: C.amber,  next: ['confirmed', 'cancelled'] },
  confirmed: { label: 'Подтверждён', color: C.azure,  next: ['shipped', 'cancelled'] },
  shipped:   { label: 'Отправлен',   color: C.violet, next: ['delivered', 'cancelled'] },
  delivered: { label: 'Доставлен',   color: C.mint,   next: [] },
  cancelled: { label: 'Отменён',     color: C.rose,   next: ['pending'] }
};
const CONDITION_META: Record<Condition, { label: string; color: string }> = {
  new: { label: 'Новый с биркой', color: C.mint }, excellent: { label: 'Отличное', color: C.azure },
  good: { label: 'Хорошее', color: C.amber }, fair: { label: 'С ноской', color: C.rose }
};
const DELIVERY_LABEL: Record<DeliveryMethod, string> = {
  courier: 'Курьер по Москве', cdek: 'СДЭК по России', pickup: 'Самовывоз'
};
const SIZE_PRESETS = ['XS','S','M','L','XL','XXL','ONE SIZE'];
const SHOE_PRESETS = ['39','40','41','42','43','44','45'];
const PANT_PRESETS = ['30','31','32','33','34','36'];
const COLOR_PRESETS = ['Чёрный','Белый','Серый','Синий','Голубой','Бежевый','Зелёный','Красный'];

const money = (n: number) => new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 }).format(Math.round(n)) + ' ₽';
const num = (n: number) => new Intl.NumberFormat('ru-RU').format(n);
const dateShort = (iso: string) => new Date(iso).toLocaleDateString('ru-RU', { day: '2-digit', month: 'short' });
const dateFull = (iso: string) => new Date(iso).toLocaleString('ru-RU', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });
const plural = (n: number, a: string, b: string, c: string) => {
  const m = Math.abs(n) % 100, k = m % 10;
  if (m > 10 && m < 20) return c;
  if (k > 1 && k < 5) return b;
  if (k === 1) return a;
  return c;
};
const TRANSLIT: Record<string, string> = {
  а:'a',б:'b',в:'v',г:'g',д:'d',е:'e',ё:'e',ж:'zh',з:'z',и:'i',й:'y',к:'k',л:'l',м:'m',
  н:'n',о:'o',п:'p',р:'r',с:'s',т:'t',у:'u',ф:'f',х:'h',ц:'ts',ч:'ch',ш:'sh',щ:'sch',
  ъ:'',ы:'y',ь:'',э:'e',ю:'yu',я:'ya',ä:'a',ö:'o',ü:'u',ß:'ss',é:'e',è:'e',ê:'e',à:'a',â:'a',ç:'c',ñ:'n',ø:'o',å:'a'
};
function slugify(text: string): string {
  const mapped = Array.from(text.toLowerCase().trim()).map((ch) => TRANSLIT[ch] ?? ch).join('');
  return mapped.replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80);
}
function uniqueSlug(base: string, taken: Set<string>): string {
  const root = base || 'tovar';
  if (!taken.has(root)) return root;
  let i = 2;
  while (taken.has(`${root}-${i}`)) i++;
  return `${root}-${i}`;
}
function niceTicks(maxv: number, count = 4): number[] {
  if (maxv <= 0) return [0];
  const raw = maxv / count;
  let mag = 1;
  while (raw / mag >= 10) mag *= 10;
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? mag * 10;
  const ticks: number[] = [];
  let v = 0;
  while (v < maxv) { ticks.push(Math.round(v)); v += step; }
  ticks.push(Math.round(v));
  return ticks;
}
function makeClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}
const PRODUCT_COLS = 'id,title,slug,description,price,old_price,brand_id,category_id,condition,sizes,colors,images,stock,is_new,is_popular,is_published,created_at';
const ORDER_COLS = 'id,user_id,customer_name,customer_phone,customer_email,shipping_address,notes,delivery_method,delivery_cost,total_amount,status,created_at,order_items(id,product_id,title_snapshot,price_snapshot,image_snapshot,size,color,quantity)';
function normProduct(x: any): Product {
  return { ...x, price: Number(x.price) || 0, old_price: x.old_price == null ? null : Number(x.old_price),
    stock: Number(x.stock) || 0, sizes: Array.isArray(x.sizes) ? x.sizes : [],
    colors: Array.isArray(x.colors) ? x.colors : [], images: Array.isArray(x.images) ? x.images : [] };
}
function normOrder(x: any): Order {
  return { ...x, total_amount: Number(x.total_amount) || 0, delivery_cost: Number(x.delivery_cost) || 0,
    order_items: Array.isArray(x.order_items)
      ? x.order_items.map((i: any) => ({ ...i, price_snapshot: Number(i.price_snapshot) || 0, quantity: Number(i.quantity) || 1 })) : [] };
}

const IMG = (id: string, w = 600) => `https://images.unsplash.com/${id}?q=80&w=${w}&auto=format&fit=crop`;
const ago = (d: number, h = 0) => new Date(Date.now() - d * 864e5 - h * 36e5).toISOString();
const SEED_BRANDS: Brand[] = [
  { id: 1, name: 'Stone Island', slug: 'stone-island' }, { id: 2, name: 'Carhartt WIP', slug: 'carhartt-wip' },
  { id: 3, name: 'The North Face', slug: 'the-north-face' }, { id: 4, name: 'Nike', slug: 'nike' },
  { id: 5, name: 'Adidas', slug: 'adidas' }, { id: 6, name: 'Stüssy', slug: 'stussy' },
  { id: 7, name: 'Ralph Lauren', slug: 'ralph-lauren' }, { id: 8, name: 'Acne Studios', slug: 'acne-studios' }
];
const SEED_CATEGORIES: Category[] = [
  { id: 1, name: 'Верхняя одежда', slug: 'outerwear', sort_order: 1 },
  { id: 2, name: 'Футболки', slug: 't-shirts', sort_order: 2 },
  { id: 3, name: 'Худи и свитшоты', slug: 'hoodies', sort_order: 3 },
  { id: 4, name: 'Рубашки', slug: 'shirts', sort_order: 4 },
  { id: 5, name: 'Джинсы и брюки', slug: 'pants', sort_order: 5 },
  { id: 6, name: 'Обувь', slug: 'shoes', sort_order: 6 },
  { id: 7, name: 'Аксессуары', slug: 'accessories', sort_order: 7 }
];
const sp = (id: number, title: string, slug: string, brand_id: number, category_id: number, price: number,
  old_price: number | null, condition: Condition, sizes: string[], colors: string[], imgs: string[],
  stock: number, is_new: boolean, is_popular: boolean, published: boolean, age: number): Product => ({
  id, title, slug, brand_id, category_id, price, old_price, condition, sizes, colors,
  images: imgs.map((x) => IMG(x)), stock, is_new, is_popular, is_published: published, created_at: ago(age),
  description: 'Оригинальная вещь, проверена на подлинность. Все дефекты показаны на фото.'
});
const SEED_PRODUCTS: Product[] = [
  sp(1,'Куртка Stone Island Ghost Piece','stone-island-ghost-piece',1,1,42900,51900,'excellent',['S','M','L'],['Чёрный'],['photo-1591047139829-d91aecb6caea','photo-1551028719-00167b16eac5'],1,true,true,true,1),
  sp(2,'Худи Carhartt WIP Hooded Chase','carhartt-hooded-chase',2,3,8900,null,'new',['S','M','L','XL'],['Серый'],['photo-1556821840-3a63f95609a7','photo-1578932750294-f5075e85f44a'],3,true,false,true,2),
  sp(3,'Пуховик The North Face Nuptse 1996','tnf-nuptse-1996',3,1,24500,29900,'excellent',['M','L'],['Чёрный'],['photo-1544022613-e87ca75a784a','photo-1539533018447-63fcce2678e3'],1,false,true,true,4),
  sp(4,'Кроссовки Nike Air Max 90','nike-air-max-90',4,6,11900,null,'good',['40','41','42','43'],['Белый'],['photo-1600185365483-26d7a4cc7519'],2,false,true,true,6),
  sp(5,'Футболка Stüssy Basic Logo','stussy-basic-logo',6,2,4500,null,'new',['S','M','L'],['Белый'],['photo-1521572163474-6864f9cf17ab','photo-1576566588028-4147f3842f27'],4,true,false,true,1),
  sp(6,'Рубашка Ralph Lauren Oxford','ralph-lauren-oxford',7,4,7900,9900,'excellent',['M','L','XL'],['Голубой'],['photo-1596755094514-f87e34085b2c','photo-1602810318383-e386cc2a3ccf'],2,false,false,true,8),
  sp(7,'Джинсы Acne Studios 1996','acne-studios-1996',8,5,15900,null,'good',['30','31','32'],['Синий'],['photo-1542272604-787c3835535d','photo-1541099649105-f69ad21f3246'],1,false,false,true,10),
  sp(8,'Свитшот Adidas Originals Trefoil','adidas-trefoil-sweatshirt',5,3,6500,null,'excellent',['S','M','L'],['Чёрный'],['photo-1556306535-0f09a537f0a3','photo-1578681994506-b8f463449011'],2,false,true,true,3),
  sp(9,'Кроссовки Adidas Samba OG','adidas-samba-og',5,6,10900,12900,'new',['39','40','41','42'],['Белый'],['photo-1600269452121-4f2416e55c28','photo-1560769629-975ec94e6a86'],3,true,true,true,2),
  sp(10,'Куртка Carhartt WIP Detroit Jacket','carhartt-detroit-jacket',2,1,13500,null,'good',['M','L'],['Бежевый'],['photo-1520975954732-35dd22299614','photo-1525507119028-ed4c629a60a3'],1,false,false,true,12),
  sp(11,'Футболка The North Face Simple Dome','tnf-simple-dome',3,2,3200,null,'new',['S','M','L','XL'],['Чёрный'],['photo-1583743814966-8936f5b7be1a','photo-1581655353564-df123a1eb820'],5,true,false,true,1),
  sp(12,'Сумка Carhartt WIP Essentials','carhartt-essentials-bag',2,7,5500,null,'excellent',['ONE SIZE'],['Чёрный'],['photo-1553062407-98eeb64c6a62','photo-1548036328-c9fa89d128fa'],0,false,false,false,5)
];
const oi = (id: number, product_id: number, title: string, price: number, img: string, size: string, color: string, qty: number): OrderItem =>
  ({ id, product_id, title_snapshot: title, price_snapshot: price, image_snapshot: IMG(img), size, color, quantity: qty });
const SEED_ORDERS: Order[] = [
  { id: 1042, user_id: null, customer_name: 'Мария Ким', customer_phone: '+7 (916) 555-34-21', customer_email: 'maria@mail.ru', shipping_address: 'Курьер: Москва, Тверская 15, кв. 42', notes: 'Оплата: При получении · позвонить за час', delivery_method: 'courier', delivery_cost: 0, total_amount: 42900, status: 'pending', created_at: ago(0, 3), order_items: [oi(1,1,'Куртка Stone Island Ghost Piece',42900,'photo-1591047139829-d91aecb6caea','M','Чёрный',1)] },
  { id: 1041, user_id: null, customer_name: 'Анна Смирнова', customer_phone: '+7 (903) 118-22-07', customer_email: 'anna@mail.ru', shipping_address: 'СДЭК: Санкт-Петербург, Невский 88', notes: 'Оплата: Перевод по СБП', delivery_method: 'cdek', delivery_cost: 350, total_amount: 18950, status: 'confirmed', created_at: ago(1, 5), order_items: [oi(2,9,'Кроссовки Adidas Samba OG',10900,'photo-1600269452121-4f2416e55c28','41','Белый',1), oi(3,11,'Футболка The North Face Simple Dome',3200,'photo-1583743814966-8936f5b7be1a','M','Чёрный',1), oi(4,5,'Футболка Stüssy Basic Logo',4500,'photo-1521572163474-6864f9cf17ab','S','Белый',1)] },
  { id: 1040, user_id: null, customer_name: 'Игорь Петров', customer_phone: '+7 (925) 774-19-63', customer_email: 'igor@mail.ru', shipping_address: 'СДЭК: Казань, Баумана 44', notes: 'Оплата: При получении', delivery_method: 'cdek', delivery_cost: 350, total_amount: 9250, status: 'shipped', created_at: ago(2, 2), order_items: [oi(5,2,'Худи Carhartt WIP Hooded Chase',8900,'photo-1556821840-3a63f95609a7','L','Серый',1)] },
  { id: 1039, user_id: null, customer_name: 'Анна Смирнова', customer_phone: '+7 (903) 118-22-07', customer_email: 'anna@mail.ru', shipping_address: 'Самовывоз: Москва, Большая Никитская, 12', notes: 'Оплата: При получении', delivery_method: 'pickup', delivery_cost: 0, total_amount: 14400, status: 'delivered', created_at: ago(4, 1), order_items: [oi(6,6,'Рубашка Ralph Lauren Oxford',7900,'photo-1596755094514-f87e34085b2c','L','Голубой',1), oi(7,8,'Свитшот Adidas Originals Trefoil',6500,'photo-1556306535-0f09a537f0a3','M','Чёрный',1)] },
  { id: 1038, user_id: null, customer_name: 'Олег Дубов', customer_phone: '+7 (911) 200-45-18', customer_email: 'oleg@mail.ru', shipping_address: 'Курьер: Москва, Ленинский 30', notes: 'Оплата: Перевод по СБП', delivery_method: 'courier', delivery_cost: 0, total_amount: 24500, status: 'delivered', created_at: ago(9, 6), order_items: [oi(8,3,'Пуховик The North Face Nuptse 1996',24500,'photo-1544022613-e87ca75a784a','L','Чёрный',1)] },
  { id: 1037, user_id: null, customer_name: 'Гость', customer_phone: '+7 (999) 000-11-22', customer_email: 'guest@mail.ru', shipping_address: 'СДЭК: Сочи, Курортный 5', notes: 'Клиент передумал', delivery_method: 'cdek', delivery_cost: 350, total_amount: 4850, status: 'cancelled', created_at: ago(12, 4), order_items: [oi(9,5,'Футболка Stüssy Basic Logo',4500,'photo-1521572163474-6864f9cf17ab','M','Белый',1)] },
  { id: 1036, user_id: null, customer_name: 'Игорь Петров', customer_phone: '+7 (925) 774-19-63', customer_email: 'igor@mail.ru', shipping_address: 'Самовывоз: Москва, Большая Никитская, 12', notes: 'Оплата: При получении', delivery_method: 'pickup', delivery_cost: 0, total_amount: 11900, status: 'delivered', created_at: ago(20, 2), order_items: [oi(10,4,'Кроссовки Nike Air Max 90',11900,'photo-1600185365483-26d7a4cc7519','42','Белый',1)] }
];

export default function AdminPage() {
  const router = useRouter();
  const sbRef = useRef<SupabaseClient | null>(null);
  const [gate, setGate] = useState<GateState>('checking');
  const [gateMsg, setGateMsg] = useState('');
  const [me, setMe] = useState<{ email: string; name: string } | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [tab, setTab] = useState<Tab>('overview');
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [busy, setBusy] = useState(false);
  const [drawerOrder, setDrawerOrder] = useState<Order | null>(null);
  const [editor, setEditor] = useState<{ mode: 'create' | 'edit'; product: Product | null } | null>(null);
  const [confirmState, setConfirmState] = useState<{ title: string; body: string; run: () => void } | null>(null);
  const timers = useRef<number[]>([]);
  const demo = gate === 'demo';

  const toast = useCallback<ToastFn>((title, desc, tone = 'ok', undo) => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t.slice(-3), { id, title, desc, tone, undo }]);
    timers.current.push(window.setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), undo ? 7000 : 3600));
  }, []);
  useEffect(() => () => { timers.current.forEach((t) => window.clearTimeout(t)); }, []);

  const loadAll = useCallback(async (client: SupabaseClient | null) => {
    setLoading(true); setLoadError('');
    if (!client) {
      setProducts(SEED_PRODUCTS); setBrands(SEED_BRANDS); setCategories(SEED_CATEGORIES); setOrders(SEED_ORDERS);
      setLoading(false); return;
    }
    try {
      const [p, b, c, o] = await Promise.all([
        client.from('products').select(PRODUCT_COLS).order('created_at', { ascending: false }),
        client.from('brands').select('id,name,slug').order('name'),
        client.from('categories').select('id,name,slug,sort_order').order('sort_order'),
        client.from('orders').select(ORDER_COLS).order('created_at', { ascending: false })
      ]);
      const err = p.error || b.error || c.error || o.error;
      if (err) throw new Error(err.message);
      setProducts((p.data ?? []).map(normProduct));
      setBrands((b.data ?? []) as Brand[]);
      setCategories((c.data ?? []) as Category[]);
      setOrders((o.data ?? []).map(normOrder));
    } catch (e) { setLoadError(e instanceof Error ? e.message : 'Не удалось загрузить данные'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    let alive = true;
    (async () => {
      const client = makeClient();
      if (!client) {
        if (!alive) return;
        sbRef.current = null; setGate('demo');
        setMe({ email: 'demo@reform.store', name: 'Демо-режим' });
        await loadAll(null); return;
      }
      sbRef.current = client;
      const { data } = await client.auth.getSession();
      const session = data.session;
      if (!session) { if (!alive) return; setGate('login'); setLoading(false); return; }
      const { data: prof, error } = await client.from('profiles')
        .select('id,email,full_name,role').eq('id', session.user.id).maybeSingle();
      if (!alive) return;
      if (error) { setGateMsg(error.message); setGate('setup'); setLoading(false); return; }
      if (!prof) { setGateMsg('Профиль не найден — выполните SQL-скрипт настройки.'); setGate('setup'); setLoading(false); return; }
      if (prof.role !== 'admin') { setGateMsg(`Аккаунт ${session.user.email} имеет роль «customer».`); setGate('denied'); setLoading(false); return; }
      setMe({ email: session.user.email ?? '', name: prof.full_name || session.user.email?.split('@')[0] || 'Администратор' });
      setGate('ok');
      await loadAll(client);
    })();
    return () => { alive = false; };
  }, [loadAll]);

  useEffect(() => {
    const lock = !!drawerOrder || !!editor || !!confirmState;
    document.body.style.overflow = lock ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [drawerOrder, editor, confirmState]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (confirmState) setConfirmState(null);
      else if (editor) setEditor(null);
      else if (drawerOrder) setDrawerOrder(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [confirmState, editor, drawerOrder]);

  const logout = async () => { await sbRef.current?.auth.signOut(); router.push('/'); };
  const brandName = useCallback((id: number | null) => brands.find((b) => b.id === id)?.name ?? '—', [brands]);
  const categoryName = useCallback((id: number | null) => categories.find((c) => c.id === id)?.name ?? '—', [categories]);

  const metrics = useMemo(() => {
    const active = orders.filter((o) => o.status !== 'cancelled');
    const revenue = active.reduce((s, o) => s + o.total_amount, 0);
    const avg = active.length ? Math.round(revenue / active.length) : 0;
    const pending = orders.filter((o) => o.status === 'pending').length;
    const transit = orders.filter((o) => o.status === 'confirmed' || o.status === 'shipped').length;
    const cut7 = Date.now() - 7 * 864e5, cut14 = Date.now() - 14 * 864e5;
    const r7 = active.filter((o) => new Date(o.created_at).getTime() >= cut7).reduce((s, o) => s + o.total_amount, 0);
    const rp = active.filter((o) => { const t = new Date(o.created_at).getTime(); return t >= cut14 && t < cut7; }).reduce((s, o) => s + o.total_amount, 0);
    const delta = rp > 0 ? Math.round(((r7 - rp) / rp) * 100) : null;
    const days = Array.from({ length: 14 }, (_, i) => {
      const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - (13 - i));
      const next = d.getTime() + 864e5;
      const value = active.filter((o) => { const t = new Date(o.created_at).getTime(); return t >= d.getTime() && t < next; })
        .reduce((s, o) => s + o.total_amount, 0);
      return { label: dateShort(d.toISOString()), value };
    });
    const dist = (Object.keys(STATUS_META) as OrderStatus[]).map((s) => ({ status: s, count: orders.filter((o) => o.status === s).length }));
    const lowStock = products.filter((p) => p.stock > 0 && p.stock <= 1);
    const soldOut = products.filter((p) => p.stock === 0);
    const unpublished = products.filter((p) => !p.is_published);
    const stockValue = products.reduce((s, p) => s + p.price * p.stock, 0);
    const byBrand = brands.map((b) => ({ name: b.name, value: products.filter((p) => p.brand_id === b.id).reduce((s, p) => s + p.price * p.stock, 0) }))
      .filter((x) => x.value > 0).sort((a, b) => b.value - a.value).slice(0, 6);
    return { revenue, avg, pending, transit, r7, delta, days, dist, lowStock, soldOut, unpublished, stockValue, byBrand, activeCount: active.length };
  }, [orders, products, brands]);

  const saveProduct = async (draft: Product, mode: 'create' | 'edit') => {
    setBusy(true);
    const payload = {
      title: draft.title.trim(), slug: draft.slug.trim(), description: draft.description,
      price: draft.price, old_price: draft.old_price, brand_id: draft.brand_id, category_id: draft.category_id,
      condition: draft.condition, sizes: draft.sizes, colors: draft.colors, images: draft.images,
      stock: draft.stock, is_new: draft.is_new, is_popular: draft.is_popular, is_published: draft.is_published
    };
    try {
      if (demo || !sbRef.current) {
        if (mode === 'create') {
          const id = Math.max(0, ...products.map((p) => p.id)) + 1;
          setProducts((ps) => [{ ...draft, id, created_at: new Date().toISOString() }, ...ps]);
        } else setProducts((ps) => ps.map((p) => (p.id === draft.id ? draft : p)));
      } else if (mode === 'create') {
        const { data, error } = await sbRef.current.from('products').insert(payload).select(PRODUCT_COLS).single();
        if (error) throw new Error(error.message);
        setProducts((ps) => [normProduct(data), ...ps]);
      } else {
        const { data, error } = await sbRef.current.from('products').update(payload).eq('id', draft.id).select(PRODUCT_COLS).single();
        if (error) throw new Error(error.message);
        const u = normProduct(data);
        setProducts((ps) => ps.map((p) => (p.id === u.id ? u : p)));
      }
      toast(mode === 'create' ? 'Товар создан' : 'Изменения сохранены', draft.title);
      setEditor(null);
    } catch (e) { toast('Не удалось сохранить', e instanceof Error ? e.message : '', 'bad'); }
    finally { setBusy(false); }
  };

  const deleteProduct = (p: Product) => setConfirmState({
    title: 'Удалить товар?', body: `«${p.title}» исчезнет из каталога. Сразу после можно отменить.`,
    run: async () => {
      const snapshot = products;
      setProducts((ps) => ps.filter((x) => x.id !== p.id));
      setConfirmState(null);
      try {
        if (!demo && sbRef.current) {
          const { error } = await sbRef.current.from('products').delete().eq('id', p.id);
          if (error) throw new Error(error.message);
        }
        toast('Товар удалён', p.title, 'warn', () => {
          setProducts(snapshot);
          if (!demo && sbRef.current) {
            const rest = { title: p.title, slug: p.slug, description: p.description, price: p.price,
              old_price: p.old_price, brand_id: p.brand_id, category_id: p.category_id, condition: p.condition,
              sizes: p.sizes, colors: p.colors, images: p.images, stock: p.stock, is_new: p.is_new,
              is_popular: p.is_popular, is_published: p.is_published };
            void sbRef.current.from('products').insert(rest);
          }
          toast('Восстановлено', p.title);
        });
      } catch (e) { setProducts(snapshot); toast('Удаление не прошло', e instanceof Error ? e.message : '', 'bad'); }
    }
  });

  const bulkPublish = async (ids: Set<number>, value: boolean) => {
    const snapshot = products;
    setProducts((ps) => ps.map((p) => (ids.has(p.id) ? { ...p, is_published: value } : p)));
    try {
      if (!demo && sbRef.current) {
        const { error } = await sbRef.current.from('products').update({ is_published: value }).in('id', Array.from(ids));
        if (error) throw new Error(error.message);
      }
      toast(value ? 'Опубликовано' : 'Снято с публикации', `${ids.size} ${plural(ids.size, 'товар', 'товара', 'товаров')}`, 'ok', () => {
        setProducts(snapshot);
        if (!demo && sbRef.current) {
          const on = snapshot.filter((p) => ids.has(p.id) && p.is_published).map((p) => p.id);
          const off = snapshot.filter((p) => ids.has(p.id) && !p.is_published).map((p) => p.id);
          if (on.length) void sbRef.current.from('products').update({ is_published: true }).in('id', on);
          if (off.length) void sbRef.current.from('products').update({ is_published: false }).in('id', off);
        }
        toast('Действие отменено');
      });
    } catch (e) { setProducts(snapshot); toast('Не удалось изменить', e instanceof Error ? e.message : '', 'bad'); }
  };

  const changeStatus = async (order: Order, next: OrderStatus) => {
    if (!STATUS_META[order.status].next.includes(next)) {
      toast('Переход запрещён', `${STATUS_META[order.status].label} → ${STATUS_META[next].label}`, 'warn'); return;
    }
    const prevStatus = order.status;
    const delta = new Map<number, number>();
    if (next === 'cancelled') order.order_items.forEach((i) => delta.set(i.product_id, i.quantity));
    if (prevStatus === 'cancelled') order.order_items.forEach((i) => delta.set(i.product_id, -i.quantity));
    const applyStock = (d: Map<number, number>) =>
      setProducts((ps) => ps.map((p) => d.has(p.id) ? { ...p, stock: Math.max(0, p.stock + (d.get(p.id) ?? 0)) } : p));
    setOrders((os) => os.map((o) => (o.id === order.id ? { ...o, status: next } : o)));
    setDrawerOrder((d) => (d && d.id === order.id ? { ...d, status: next } : d));
    applyStock(delta);
    try {
      if (!demo && sbRef.current) {
        const { error } = await sbRef.current.from('orders').update({ status: next }).eq('id', order.id);
        if (error) throw new Error(error.message);
        for (const [pid, dv] of delta) {
          const cur = products.find((p) => p.id === pid)?.stock ?? 0;
          await sbRef.current.from('products').update({ stock: Math.max(0, cur + dv) }).eq('id', pid);
        }
      }
      toast(`Заказ №${order.id}: ${STATUS_META[next].label}`, delta.size ? 'Остатки пересчитаны' : undefined, 'ok', () => {
        setOrders((os) => os.map((o) => (o.id === order.id ? { ...o, status: prevStatus } : o)));
        setDrawerOrder((d) => (d && d.id === order.id ? { ...d, status: prevStatus } : d));
        const rev = new Map<number, number>(); delta.forEach((v, k) => rev.set(k, -v)); applyStock(rev);
        if (!demo && sbRef.current) void sbRef.current.from('orders').update({ status: prevStatus }).eq('id', order.id);
        toast('Статус возвращён', `Заказ №${order.id}`);
      });
    } catch (e) {
      setOrders((os) => os.map((o) => (o.id === order.id ? { ...o, status: prevStatus } : o)));
      const rev = new Map<number, number>(); delta.forEach((v, k) => rev.set(k, -v)); applyStock(rev);
      toast('Статус не изменён', e instanceof Error ? e.message : '', 'bad');
    }
  };

  const addTaxonomy = async (kind: 'brand' | 'category', name: string) => {
    const clean = name.trim();
    if (clean.length < 2) { toast('Слишком короткое название', undefined, 'warn'); return; }
    const slug = uniqueSlug(slugify(clean), new Set((kind === 'brand' ? brands : categories).map((x) => x.slug)));
    try {
      if (demo || !sbRef.current) {
        if (kind === 'brand') {
          const id = Math.max(0, ...brands.map((b) => b.id)) + 1;
          setBrands((bs) => [...bs, { id, name: clean, slug }].sort((a, b) => a.name.localeCompare(b.name, 'ru')));
        } else {
          const id = Math.max(0, ...categories.map((c) => c.id)) + 1;
          setCategories((cs) => [...cs, { id, name: clean, slug, sort_order: cs.length + 1 }]);
        }
      } else if (kind === 'brand') {
        const { data, error } = await sbRef.current.from('brands').insert({ name: clean, slug }).select('id,name,slug').single();
        if (error) throw new Error(error.message);
        setBrands((bs) => [...bs, data as Brand].sort((a, b) => a.name.localeCompare(b.name, 'ru')));
      } else {
        const { data, error } = await sbRef.current.from('categories')
          .insert({ name: clean, slug, sort_order: categories.length + 1 }).select('id,name,slug,sort_order').single();
        if (error) throw new Error(error.message);
        setCategories((cs) => [...cs, data as Category]);
      }
      toast(kind === 'brand' ? 'Бренд добавлен' : 'Категория добавлена', clean);
    } catch (e) { toast('Не удалось добавить', e instanceof Error ? e.message : '', 'bad'); }
  };

  const removeTaxonomy = (kind: 'brand' | 'category', id: number, name: string) => {
    const used = products.filter((p) => (kind === 'brand' ? p.brand_id : p.category_id) === id).length;
    if (used > 0) { toast('Нельзя удалить', `${name}: используется в ${used} ${plural(used, 'товаре', 'товарах', 'товарах')}`, 'warn'); return; }
    setConfirmState({
      title: kind === 'brand' ? 'Удалить бренд?' : 'Удалить категорию?', body: `«${name}» будет удалена из справочника.`,
      run: async () => {
        const snapB = brands, snapC = categories;
        if (kind === 'brand') setBrands((bs) => bs.filter((b) => b.id !== id));
        else setCategories((cs) => cs.filter((c) => c.id !== id));
        setConfirmState(null);
        try {
          if (!demo && sbRef.current) {
            const { error } = await sbRef.current.from(kind === 'brand' ? 'brands' : 'categories').delete().eq('id', id);
            if (error) throw new Error(error.message);
          }
          toast('Удалено', name, 'warn', () => { setBrands(snapB); setCategories(snapC); toast('Восстановлено', name); });
        } catch (e) { setBrands(snapB); setCategories(snapC); toast('Удаление не прошло', e instanceof Error ? e.message : '', 'bad'); }
      }
    });
  };

  const reorderCategories = async (from: number, to: number) => {
    if (from === to || from < 0 || to < 0 || from >= categories.length || to >= categories.length) return;
    const next = [...categories];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    const renumbered = next.map((c, i) => ({ ...c, sort_order: i + 1 }));
    const snapshot = categories;
    setCategories(renumbered);
    try {
      if (!demo && sbRef.current) for (const c of renumbered) await sbRef.current.from('categories').update({ sort_order: c.sort_order }).eq('id', c.id);
      toast('Порядок сохранён', moved.name, 'ok', () => { setCategories(snapshot); toast('Порядок возвращён'); });
    } catch (e) { setCategories(snapshot); toast('Порядок не сохранён', e instanceof Error ? e.message : '', 'bad'); }
  };

  const exportCsv = () => {
    const rows = tab === 'orders'
      ? [['№','Дата','Клиент','Телефон','Email','Доставка','Сумма','Статус'],
         ...orders.map((o) => [o.id, dateFull(o.created_at), o.customer_name, o.customer_phone, o.customer_email, DELIVERY_LABEL[o.delivery_method], o.total_amount, STATUS_META[o.status].label])]
      : [['ID','Название','Адрес','Бренд','Категория','Цена','Остаток','Состояние','Опубликован'],
         ...products.map((p) => [p.id, p.title, p.slug, brandName(p.brand_id), categoryName(p.category_id), p.price, p.stock, CONDITION_META[p.condition].label, p.is_published ? 'да' : 'нет'])];
    const csv = '\uFEFF' + rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(';')).join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url; a.download = `reform-${tab}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click(); URL.revokeObjectURL(url);
    toast('Файл выгружен', `${rows.length - 1} ${plural(rows.length - 1, 'строка', 'строки', 'строк')}`);
  };

  if (gate === 'checking') return (
    <Shell><div className="grid min-h-[70vh] place-items-center"><div className="text-center">
      <Loader2 className="mx-auto h-8 w-8 animate-spin" style={{ color: C.signal }} />
      <p className="mt-4 text-sm" style={{ color: C.mist }}>Проверяем права доступа…</p>
    </div></div></Shell>
  );

  if (gate !== 'ok' && gate !== 'demo') {
    const map = {
      login: { icon: ShieldAlert, color: C.amber, title: 'Нужен вход', text: 'Войдите под аккаунтом владельца магазина.' },
      setup: { icon: Database, color: C.azure, title: 'Требуется настройка базы', text: gateMsg || 'Таблица профилей ещё не создана.' },
      denied: { icon: ShieldAlert, color: C.rose, title: 'Нет прав администратора', text: gateMsg || 'Этот аккаунт не может управлять магазином.' }
    } as const;
    const info = map[gate]; const Icon = info.icon;
    return (
      <Shell><div className="mx-auto grid min-h-[75vh] max-w-2xl place-items-center px-4">
        <div className="adm-up w-full rounded-xl border p-8" style={{ borderColor: C.line, background: C.panel }}>
          <span className="grid h-14 w-14 place-items-center rounded-lg" style={{ background: `${info.color}1A` }}>
            <Icon className="h-6 w-6" style={{ color: info.color }} />
          </span>
          <h1 className="mt-5 text-2xl font-semibold tracking-tight" style={{ color: C.chalk }}>{info.title}</h1>
          <p className="mt-2 break-words text-sm leading-relaxed" style={{ color: C.mist }}>{info.text}</p>
          {gate === 'login' ? (
            <div className="mt-6 flex flex-wrap gap-3">
              <Link href="/login?next=/admin" className="adm-btn inline-flex h-11 items-center gap-2 rounded-md px-6 text-xs font-bold uppercase tracking-[0.16em]" style={{ background: C.signal, color: C.void }}>
                Войти <ChevronRight className="h-4 w-4" />
              </Link>
              <Link href="/" className="adm-btn inline-flex h-11 items-center rounded-md border px-6 text-xs font-bold uppercase tracking-[0.16em]" style={{ borderColor: C.line, color: C.chalk }}>На сайт</Link>
            </div>
          ) : (
            <ol className="mt-6 space-y-2.5 text-sm" style={{ color: C.mist }}>
              {['Откройте Supabase → SQL Editor.',
                'Убедитесь, что таблица public.profiles существует.',
                'Выдайте себе роль: update public.profiles set role = \'admin\' where email = \'ваша почта\';',
                'Вернитесь сюда и обновите страницу.'].map((s, i) => (
                <li key={i} className="flex gap-3">
                  <span className="grid h-5 w-5 shrink-0 place-items-center rounded text-[10px] font-bold" style={{ background: C.raised, color: C.volt }}>{i + 1}</span>
                  <span>{s}</span>
                </li>
              ))}
            </ol>
          )}
        </div>
      </div></Shell>
    );
  }

  const TABS: { id: Tab; label: string; icon: any; badge?: number }[] = [
    { id: 'overview', label: 'Обзор', icon: BarChart3 },
    { id: 'products', label: 'Товары', icon: Boxes, badge: products.length },
    { id: 'orders', label: 'Заказы', icon: ShoppingBag, badge: metrics.pending || undefined },
    { id: 'taxonomy', label: 'Справочники', icon: Tag },
    { id: 'settings', label: 'Настройки', icon: Settings }
  ];

  return (
    <Shell>
      <header className="sticky top-0 z-40 border-b backdrop-blur-xl" style={{ borderColor: C.line, background: `${C.void}E6` }}>
        <div className="mx-auto flex h-16 max-w-[1600px] items-center gap-3 px-4 sm:px-6">
          <Link href="/" className="flex shrink-0 items-center gap-2.5">
            <span className="grid h-9 w-9 place-items-center rounded-md" style={{ background: C.signal }}>
              <Zap className="h-5 w-5" style={{ color: C.void }} />
            </span>
            <span className="hidden text-base font-bold tracking-tight lg:block" style={{ color: C.chalk }}>RE<span style={{ color: C.signal }}>:</span>FORM</span>
          </Link>
          <span className="hidden rounded px-2 py-1 text-[10px] font-bold uppercase tracking-[0.18em] xl:block" style={{ background: C.raised, color: C.volt }}>Control</span>
          <nav className="adm-scroll flex min-w-0 flex-1 gap-1 overflow-x-auto">
            {TABS.map((t) => {
              const active = tab === t.id;
              return (
                <button key={t.id} onClick={() => setTab(t.id)}
                  className="relative flex h-10 shrink-0 items-center gap-2 rounded-md px-3 text-xs font-semibold uppercase tracking-[0.1em] transition-colors"
                  style={{ background: active ? C.raised : 'transparent', color: active ? C.chalk : C.mist }}>
                  <t.icon className="h-4 w-4" style={{ color: active ? C.signal : C.mist }} />
                  <span className="hidden sm:inline">{t.label}</span>
                  {t.badge ? <span className="grid h-4 min-w-4 place-items-center rounded-full px-1 text-[10px] font-bold"
                    style={{ background: t.id === 'orders' ? C.amber : C.line, color: t.id === 'orders' ? C.void : C.chalk }}>{t.badge}</span> : null}
                  {active && <span className="absolute inset-x-2 -bottom-[9px] h-0.5 rounded-full" style={{ background: C.signal }} />}
                </button>
              );
            })}
          </nav>
          <div className="flex shrink-0 items-center gap-2">
            {demo && <span className="hidden rounded px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.14em] xl:block" style={{ background: `${C.amber}1F`, color: C.amber }}>Демо · без базы</span>}
            <button onClick={() => void loadAll(sbRef.current)} disabled={loading} aria-label="Обновить данные"
              className="adm-btn grid h-9 w-9 place-items-center rounded-md border" style={{ borderColor: C.line, color: C.mist }}>
              <RefreshCcw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <div className="hidden items-center gap-2.5 rounded-md border px-3 py-1.5 lg:flex" style={{ borderColor: C.line }}>
              <span className="grid h-6 w-6 place-items-center rounded text-[10px] font-bold" style={{ background: C.volt, color: C.void }}>{(me?.name ?? 'A').slice(0, 1).toUpperCase()}</span>
              <span className="max-w-[130px] truncate text-xs" style={{ color: C.chalk }}>{me?.name}</span>
            </div>
            <button onClick={() => void logout()} aria-label="Выйти" className="adm-btn grid h-9 w-9 place-items-center rounded-md border" style={{ borderColor: C.line, color: C.mist }}>
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1600px] px-4 py-6 sm:px-6">
        {loadError && (
          <div className="mb-5 flex flex-wrap items-start gap-3 rounded-lg border p-4" style={{ borderColor: `${C.rose}55`, background: `${C.rose}12` }}>
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" style={{ color: C.rose }} />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold" style={{ color: C.rose }}>База ответила ошибкой</p>
              <p className="mt-0.5 break-words text-xs" style={{ color: C.mist }}>{loadError}</p>
            </div>
            <Btn onClick={() => void loadAll(sbRef.current)}>Повторить</Btn>
          </div>
        )}
        {loading ? (
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-28 animate-pulse rounded-xl" style={{ background: C.panel }} />)}
            </div>
            <div className="h-72 animate-pulse rounded-xl" style={{ background: C.panel }} />
          </div>
        ) : (
          <>
            {tab === 'overview' && <Overview metrics={metrics} products={products} orders={orders} brandName={brandName} onTab={setTab} onOrder={setDrawerOrder} onEdit={(p) => setEditor({ mode: 'edit', product: p })} />}
            {tab === 'products' && <ProductsTab products={products} brands={brands} categories={categories} onCreate={() => setEditor({ mode: 'create', product: null })} onEdit={(p) => setEditor({ mode: 'edit', product: p })} onDelete={deleteProduct} onBulk={bulkPublish} onExport={exportCsv} onToggle={(p) => void bulkPublish(new Set([p.id]), !p.is_published)} brandName={brandName} categoryName={categoryName} />}
            {tab === 'orders' && <OrdersTab orders={orders} onOpen={setDrawerOrder} onStatus={changeStatus} onExport={exportCsv} />}
            {tab === 'taxonomy' && <TaxonomyTab brands={brands} categories={categories} products={products} onAdd={addTaxonomy} onRemove={removeTaxonomy} onReorder={reorderCategories} />}
            {tab === 'settings' && <AdminSettingsPage />}
          </>
        )}
      </main>

      {drawerOrder && <OrderDrawer order={drawerOrder} onClose={() => setDrawerOrder(null)} onStatus={changeStatus} toast={toast} />}
      {editor && <ProductEditor mode={editor.mode} product={editor.product} products={products} brands={brands} categories={categories} demo={demo} sb={sbRef.current} busy={busy} onClose={() => setEditor(null)} onSave={saveProduct} toast={toast} />}
      {confirmState && <ConfirmModal title={confirmState.title} body={confirmState.body} onCancel={() => setConfirmState(null)} onConfirm={confirmState.run} />}

      <div className="pointer-events-none fixed bottom-4 right-4 z-[120] flex w-[calc(100vw-2rem)] max-w-sm flex-col gap-2">
        {toasts.map((t) => {
          const tone = t.tone === 'ok' ? C.mint : t.tone === 'warn' ? C.amber : C.rose;
          return (
            <div key={t.id} className="adm-toast pointer-events-auto flex items-start gap-3 rounded-lg border p-3.5 shadow-2xl" style={{ borderColor: C.line, background: C.panel }}>
              <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full" style={{ background: tone }}>
                {t.tone === 'ok' ? <Check className="h-3 w-3" style={{ color: C.void }} /> : <X className="h-3 w-3" style={{ color: C.void }} />}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium" style={{ color: C.chalk }}>{t.title}</p>
                {t.desc && <p className="mt-0.5 break-words text-xs" style={{ color: C.mist }}>{t.desc}</p>}
                {t.undo && <button onClick={() => { t.undo?.(); setToasts((x) => x.filter((i) => i.id !== t.id)); }}
                  className="mt-2 text-[10px] font-bold uppercase tracking-[0.16em] underline underline-offset-4" style={{ color: C.volt }}>Отменить</button>}
              </div>
              <button onClick={() => setToasts((x) => x.filter((i) => i.id !== t.id))} aria-label="Закрыть" className="shrink-0" style={{ color: C.mist }}><X className="h-4 w-4" /></button>
            </div>
          );
        })}
      </div>
    </Shell>
  );
}

function Shell({ children }: { children: ReactNode }) {
  return (
    <div className="relative min-h-screen" style={{ background: C.void, color: C.chalk }}>
      <style>{`
        .adm-scroll::-webkit-scrollbar{height:6px;width:8px}
        .adm-scroll::-webkit-scrollbar-track{background:${C.void}}
        .adm-scroll::-webkit-scrollbar-thumb{background:${C.line};border-radius:99px}
        .adm-scroll::-webkit-scrollbar-thumb:hover{background:${C.signal}}
        .adm-scroll{scrollbar-width:thin;scrollbar-color:${C.line} ${C.void}}
        @keyframes admUp{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}
        @keyframes admIn{from{opacity:0}to{opacity:1}}
        @keyframes admSlide{from{transform:translateX(100%)}to{transform:none}}
        @keyframes admToast{from{opacity:0;transform:translateY(12px) scale(.97)}to{opacity:1;transform:none}}
        .adm-up{animation:admUp .45s cubic-bezier(.2,.7,.3,1) both}
        .adm-in{animation:admIn .25s ease both}
        .adm-slide{animation:admSlide .32s cubic-bezier(.2,.8,.25,1) both}
        .adm-toast{animation:admToast .3s cubic-bezier(.2,.8,.25,1) both}
        .adm-row:hover{background:${C.raised}}
        .adm-input{background:${C.raised};border:1px solid ${C.line};color:${C.chalk};outline:none;transition:border-color .18s,box-shadow .18s}
        .adm-input::placeholder{color:${C.mist}99}
        .adm-input:focus{border-color:${C.signal};box-shadow:0 0 0 3px ${C.signal}26}
        .adm-btn{transition:transform .16s,filter .16s,background .16s,border-color .16s}
        .adm-btn:hover:not(:disabled){filter:brightness(1.14)}
        .adm-btn:active:not(:disabled){transform:scale(.97)}
        .adm-btn:disabled{opacity:.45;cursor:not-allowed}
        .adm-grid-bg{background-image:linear-gradient(${C.line}55 1px,transparent 1px),linear-gradient(90deg,${C.line}55 1px,transparent 1px);background-size:44px 44px}
        select.adm-input option{background:${C.panel};color:${C.chalk}}
      `}</style>
      <div aria-hidden className="adm-grid-bg pointer-events-none fixed inset-0 opacity-[0.35]" />
      <div aria-hidden className="pointer-events-none fixed -left-40 -top-40 h-[520px] w-[520px] rounded-full blur-[130px]" style={{ background: `${C.signal}1F` }} />
      <div aria-hidden className="pointer-events-none fixed -right-40 top-1/3 h-[460px] w-[460px] rounded-full blur-[130px]" style={{ background: `${C.azure}1A` }} />
      <div aria-hidden className="pointer-events-none fixed bottom-0 left-1/3 h-[400px] w-[400px] rounded-full blur-[130px]" style={{ background: `${C.violet}14` }} />
      <div className="relative">{children}</div>
    </div>
  );
}
function Card({ children, className = '', delay = 0 }: { children: ReactNode; className?: string; delay?: number }) {
  return <div className={`adm-up rounded-xl border ${className}`} style={{ borderColor: C.line, background: C.panel, animationDelay: `${delay}ms` }}>{children}</div>;
}
function Pill({ color, children }: { color: string; children: ReactNode }) {
  return <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded px-2 py-1 text-[10px] font-bold uppercase tracking-[0.1em]" style={{ background: `${color}1F`, color }}>
    <span className="h-1.5 w-1.5 rounded-full" style={{ background: color }} />{children}</span>;
}
function Btn({ children, onClick, tone = 'ghost', disabled, className = '', type = 'button' }: {
  children: ReactNode; onClick?: () => void; tone?: 'primary' | 'volt' | 'ghost' | 'danger'; disabled?: boolean; className?: string; type?: 'button' | 'submit';
}) {
  const s = tone === 'primary' ? { background: C.signal, color: C.void, border: `1px solid ${C.signal}` }
    : tone === 'volt' ? { background: C.volt, color: C.void, border: `1px solid ${C.volt}` }
    : tone === 'danger' ? { background: `${C.rose}1A`, color: C.rose, border: `1px solid ${C.rose}55` }
    : { background: C.raised, color: C.chalk, border: `1px solid ${C.line}` };
  return <button type={type} onClick={onClick} disabled={disabled}
    className={`adm-btn inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-md px-4 text-[11px] font-bold uppercase tracking-[0.14em] ${className}`} style={s}>{children}</button>;
}
function Field({ label, error, hint, children }: { label: string; error?: string; hint?: string; children: ReactNode }) {
  return <label className="block">
    <span className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.16em]" style={{ color: C.mist }}>{label}</span>
    {children}
    {error ? <span className="mt-1 block text-xs" style={{ color: C.rose }}>{error}</span>
      : hint ? <span className="mt-1 block text-xs" style={{ color: C.mist }}>{hint}</span> : null}
  </label>;
}
function Toggle({ on, onChange, label, color = C.volt }: { on: boolean; onChange: (v: boolean) => void; label: string; color?: string }) {
  return <button type="button" onClick={() => onChange(!on)} className="adm-btn flex w-full items-center justify-between gap-3 rounded-md border px-3 py-2.5"
    style={{ borderColor: on ? `${color}66` : C.line, background: on ? `${color}12` : C.raised }}>
    <span className="text-xs font-semibold" style={{ color: on ? color : C.mist }}>{label}</span>
    <span className="relative h-5 w-9 shrink-0 rounded-full transition-colors" style={{ background: on ? color : C.line }}>
      <span className="absolute top-0.5 h-4 w-4 rounded-full transition-all" style={{ left: on ? 18 : 2, background: on ? C.void : C.mist }} />
    </span>
  </button>;
}
function CheckBox({ checked, onChange, label }: { checked: boolean; onChange: () => void; label: string }) {
  return <button type="button" onClick={onChange} aria-label={label} aria-pressed={checked} className="adm-btn grid h-5 w-5 place-items-center rounded border"
    style={{ borderColor: checked ? C.signal : C.line, background: checked ? C.signal : C.raised }}>
    {checked && <Check className="h-3 w-3" style={{ color: C.void }} />}</button>;
}
function IconBtn({ children, onClick, title, danger }: { children: ReactNode; onClick: () => void; title: string; danger?: boolean }) {
  return <button type="button" onClick={onClick} title={title} aria-label={title} className="adm-btn grid h-8 w-8 shrink-0 place-items-center rounded border"
    style={{ borderColor: danger ? `${C.rose}44` : C.line, background: danger ? `${C.rose}12` : C.raised, color: danger ? C.rose : C.mist }}>{children}</button>;
}
function Thumb({ src, alt, size = 'md' }: { src?: string | null; alt: string; size?: 'sm' | 'md' | 'lg' }) {
  const dim = size === 'sm' ? 'h-10 w-8' : size === 'lg' ? 'h-20 w-16' : 'h-14 w-11';
  return <span className={`relative ${dim} shrink-0 overflow-hidden rounded`} style={{ background: C.raised }}>
    {src ? (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={src} alt={alt} loading="lazy" className="h-full w-full object-cover" />
    ) : <span className="grid h-full place-items-center"><ImageIcon className="h-3.5 w-3.5" style={{ color: C.mist }} /></span>}
  </span>;
}
function ConfirmModal({ title, body, onCancel, onConfirm }: { title: string; body: string; onCancel: () => void; onConfirm: () => void }) {
  return <div className="fixed inset-0 z-[110] grid place-items-center p-4">
    <div className="adm-in absolute inset-0 backdrop-blur-sm" style={{ background: `${C.void}CC` }} onClick={onCancel} />
    <div className="adm-up relative w-full max-w-md rounded-xl border p-6" style={{ borderColor: C.line, background: C.panel }}>
      <span className="grid h-11 w-11 place-items-center rounded-lg" style={{ background: `${C.rose}1A` }}><AlertTriangle className="h-5 w-5" style={{ color: C.rose }} /></span>
      <h3 className="mt-4 text-lg font-semibold tracking-tight" style={{ color: C.chalk }}>{title}</h3>
      <p className="mt-2 text-sm leading-relaxed" style={{ color: C.mist }}>{body}</p>
      <div className="mt-6 flex gap-3">
        <Btn className="flex-1" onClick={onCancel}>Отмена</Btn>
        <Btn className="flex-1" tone="danger" onClick={onConfirm}><Trash2 className="h-3.5 w-3.5" /> Удалить</Btn>
      </div>
    </div>
  </div>;
}

type Metrics = {
  revenue: number; avg: number; pending: number; transit: number; r7: number; delta: number | null;
  days: { label: string; value: number }[]; dist: { status: OrderStatus; count: number }[];
  lowStock: Product[]; soldOut: Product[]; unpublished: Product[]; stockValue: number;
  byBrand: { name: string; value: number }[]; activeCount: number;
};
function Overview({ metrics, products, orders, brandName, onTab, onOrder, onEdit }: {
  metrics: Metrics; products: Product[]; orders: Order[]; brandName: (id: number | null) => string;
  onTab: (t: Tab) => void; onOrder: (o: Order) => void; onEdit: (p: Product) => void;
}) {
  const kpis = [
    { label: 'Выручка', value: money(metrics.revenue), sub: `${metrics.activeCount} ${plural(metrics.activeCount, 'заказ', 'заказа', 'заказов')} без отмен`, icon: Zap, color: C.volt },
    { label: 'Средний чек', value: money(metrics.avg), sub: 'по активным заказам', icon: BarChart3, color: C.azure },
    { label: 'Ждут ответа', value: num(metrics.pending), sub: `${metrics.transit} в пути`, icon: ShoppingBag, color: C.amber },
    { label: 'Склад', value: money(metrics.stockValue), sub: `${products.length} позиций · ${metrics.soldOut.length} продано`, icon: Boxes, color: C.signal }
  ];
  const ticks = niceTicks(Math.max(...metrics.days.map((d) => d.value), 1));
  const top = ticks[ticks.length - 1] || 1;
  const W = 720, H = 210, PL = 56, PR = 14, PT = 16, PB = 30;
  const pw = W - PL - PR, ph = H - PT - PB;
  const px = (i: number) => PL + (pw * i) / (metrics.days.length - 1);
  const py = (v: number) => PT + ph - (ph * v) / top;
  const line = metrics.days.map((d, i) => `${i === 0 ? 'M' : 'L'}${px(i).toFixed(1)},${py(d.value).toFixed(1)}`).join(' ');
  const area = `${line} L${px(metrics.days.length - 1).toFixed(1)},${(PT + ph).toFixed(1)} L${PL},${(PT + ph).toFixed(1)} Z`;
  const totalOrders = metrics.dist.reduce((s, d) => s + d.count, 0) || 1;
  const attention = [...metrics.soldOut, ...metrics.lowStock, ...metrics.unpublished]
    .filter((p, i, arr) => arr.findIndex((x) => x.id === p.id) === i).slice(0, 5);
  const hues = [C.signal, C.volt, C.azure, C.violet, C.amber, C.mint];
  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {kpis.map((k, i) => (
          <Card key={k.label} delay={i * 60} className="relative overflow-hidden p-5">
            <div aria-hidden className="absolute -right-8 -top-8 h-24 w-24 rounded-full blur-2xl" style={{ background: `${k.color}22` }} />
            <div className="relative flex items-start justify-between gap-3">
              <span className="text-[10px] font-bold uppercase tracking-[0.18em]" style={{ color: C.mist }}>{k.label}</span>
              <k.icon className="h-4 w-4 shrink-0" style={{ color: k.color }} />
            </div>
            <p className="relative mt-3 truncate text-2xl font-bold tracking-tight" style={{ color: C.chalk }}>{k.value}</p>
            <p className="relative mt-1 text-xs" style={{ color: C.mist }}>{k.sub}</p>
          </Card>
        ))}
      </div>
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
        <Card delay={240} className="p-5">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-sm font-bold uppercase tracking-[0.16em]" style={{ color: C.chalk }}>Выручка за 14 дней</h2>
              <p className="mt-1 text-xs" style={{ color: C.mist }}>Отменённые заказы не учитываются</p>
            </div>
            <div className="text-right">
              <p className="text-xl font-bold" style={{ color: C.volt }}>{money(metrics.r7)}</p>
              <p className="flex items-center justify-end gap-1 text-xs" style={{ color: metrics.delta == null ? C.mist : metrics.delta >= 0 ? C.mint : C.rose }}>
                {metrics.delta == null ? 'нет данных за прошлую неделю' : <>
                  {metrics.delta >= 0 ? <ArrowUpRight className="h-3.5 w-3.5" /> : <ArrowDownRight className="h-3.5 w-3.5" />}
                  {metrics.delta >= 0 ? '+' : ''}{metrics.delta}% к прошлой неделе</>}
              </p>
            </div>
          </div>
          <div className="adm-scroll mt-4 overflow-x-auto">
            <svg viewBox={`0 0 ${W} ${H}`} className="h-[210px] w-full min-w-[560px]" role="img" aria-label="График выручки за 14 дней">
              <defs>
                <linearGradient id="admArea" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={C.signal} stopOpacity="0.38" /><stop offset="100%" stopColor={C.signal} stopOpacity="0" />
                </linearGradient>
                <linearGradient id="admLine" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor={C.amber} /><stop offset="55%" stopColor={C.signal} /><stop offset="100%" stopColor={C.volt} />
                </linearGradient>
              </defs>
              {ticks.map((t) => <g key={t}>
                <line x1={PL} y1={py(t)} x2={W - PR} y2={py(t)} stroke={C.line} strokeWidth="1" strokeDasharray={t === 0 ? '0' : '3 4'} />
                <text x={PL - 8} y={py(t) + 4} textAnchor="end" fontSize="10" fill={C.mist}>{t >= 1000 ? `${Math.round(t / 1000)}к` : t}</text>
              </g>)}
              <path d={area} fill="url(#admArea)" />
              <path d={line} fill="none" stroke="url(#admLine)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
              {metrics.days.map((d, i) => <g key={i}>
                <circle cx={px(i)} cy={py(d.value)} r={d.value > 0 ? 3.5 : 2} fill={d.value > 0 ? C.volt : C.line} stroke={C.panel} strokeWidth="1.5" />
                <title>{`${d.label}: ${money(d.value)}`}</title>
                {i % 2 === 0 && <text x={px(i)} y={H - 10} textAnchor="middle" fontSize="9" fill={C.mist}>{d.label}</text>}
              </g>)}
            </svg>
          </div>
          <div className="mt-5 border-t pt-4" style={{ borderColor: C.line }}>
            <div className="mb-2.5 flex items-center justify-between gap-3">
              <span className="text-[10px] font-bold uppercase tracking-[0.16em]" style={{ color: C.mist }}>Заказы по статусам</span>
              <span className="text-xs" style={{ color: C.mist }}>{totalOrders} всего</span>
            </div>
            <div className="flex h-3 w-full overflow-hidden rounded-full" style={{ background: C.raised }}>
              {metrics.dist.filter((d) => d.count > 0).map((d) => <div key={d.status} title={`${STATUS_META[d.status].label}: ${d.count}`}
                style={{ width: `${(d.count / totalOrders) * 100}%`, background: STATUS_META[d.status].color }} />)}
            </div>
            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2">
              {metrics.dist.map((d) => <span key={d.status} className="flex items-center gap-1.5 text-xs" style={{ color: C.mist }}>
                <span className="h-2 w-2 rounded-sm" style={{ background: STATUS_META[d.status].color }} />
                {STATUS_META[d.status].label}<b style={{ color: C.chalk }}>{d.count}</b></span>)}
            </div>
          </div>
        </Card>
        <div className="space-y-5">
          <Card delay={300} className="p-5">
            <h2 className="text-sm font-bold uppercase tracking-[0.16em]" style={{ color: C.chalk }}>Требует внимания</h2>
            {attention.length === 0 ? <p className="mt-4 flex items-center gap-2 text-sm" style={{ color: C.mint }}><Check className="h-4 w-4" /> Всё в порядке — склад заполнен</p> : (
              <ul className="mt-4 space-y-2">
                {attention.map((p) => {
                  const r = p.stock === 0 ? { t: 'Продано', c: C.rose } : !p.is_published ? { t: 'Скрыт', c: C.mist } : { t: 'Последний', c: C.amber };
                  return <li key={p.id}><button onClick={() => onEdit(p)} className="adm-row flex w-full items-center gap-3 rounded-md p-2 text-left transition-colors">
                    <Thumb src={p.images[0]} alt="" size="sm" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-xs font-medium" style={{ color: C.chalk }}>{p.title}</span>
                      <span className="block truncate text-[10px] uppercase tracking-[0.12em]" style={{ color: C.mist }}>{brandName(p.brand_id)}</span>
                    </span><Pill color={r.c}>{r.t}</Pill></button></li>;
                })}
              </ul>
            )}
            <Btn className="mt-4 w-full" onClick={() => onTab('products')}>Все товары <ChevronRight className="h-3.5 w-3.5" /></Btn>
          </Card>
          <Card delay={360} className="p-5">
            <h2 className="text-sm font-bold uppercase tracking-[0.16em]" style={{ color: C.chalk }}>Склад по брендам</h2>
            {metrics.byBrand.length === 0 ? <p className="mt-4 text-sm" style={{ color: C.mist }}>Нет товаров с остатком</p> : (
              <ul className="mt-4 space-y-3">
                {metrics.byBrand.map((b, i) => <li key={b.name}>
                  <div className="mb-1 flex items-baseline justify-between gap-3">
                    <span className="truncate text-xs" style={{ color: C.chalk }}>{b.name}</span>
                    <span className="shrink-0 text-xs font-semibold tabular-nums" style={{ color: C.mist }}>{money(b.value)}</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full" style={{ background: C.raised }}>
                    <div className="h-full rounded-full transition-all duration-700" style={{ width: `${Math.round((b.value / metrics.byBrand[0].value) * 100)}%`, background: hues[i % hues.length] }} />
                  </div>
                </li>)}
              </ul>
            )}
          </Card>
        </div>
      </div>
      <Card delay={420} className="overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b p-5" style={{ borderColor: C.line }}>
          <h2 className="text-sm font-bold uppercase tracking-[0.16em]" style={{ color: C.chalk }}>Последние заказы</h2>
          <Btn onClick={() => onTab('orders')}>Все заказы <ChevronRight className="h-3.5 w-3.5" /></Btn>
        </div>
        {orders.length === 0 ? <p className="p-8 text-center text-sm" style={{ color: C.mist }}>Заказов пока нет</p> : (
          <div className="adm-scroll overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead><tr style={{ background: C.raised }}>
                {['№','Клиент','Дата','Доставка','Сумма','Статус'].map((h) => <th key={h} className="px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-[0.14em]" style={{ color: C.mist }}>{h}</th>)}
              </tr></thead>
              <tbody>{orders.slice(0, 5).map((o) => (
                <tr key={o.id} onClick={() => onOrder(o)} className="adm-row cursor-pointer border-t transition-colors" style={{ borderColor: C.line }}>
                  <td className="px-4 py-3 font-semibold tabular-nums" style={{ color: C.signal }}>#{o.id}</td>
                  <td className="px-4 py-3" style={{ color: C.chalk }}>{o.customer_name}</td>
                  <td className="px-4 py-3 text-xs" style={{ color: C.mist }}>{dateShort(o.created_at)}</td>
                  <td className="px-4 py-3 text-xs" style={{ color: C.mist }}>{DELIVERY_LABEL[o.delivery_method]}</td>
                  <td className="px-4 py-3 font-semibold tabular-nums" style={{ color: C.chalk }}>{money(o.total_amount)}</td>
                  <td className="px-4 py-3"><Pill color={STATUS_META[o.status].color}>{STATUS_META[o.status].label}</Pill></td>
                </tr>))}</tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

function ProductsTab({ products, brands, categories, onCreate, onEdit, onDelete, onBulk, onExport, onToggle, brandName, categoryName }: {
  products: Product[]; brands: Brand[]; categories: Category[]; onCreate: () => void; onEdit: (p: Product) => void;
  onDelete: (p: Product) => void; onBulk: (ids: Set<number>, v: boolean) => Promise<void>; onExport: () => void;
  onToggle: (p: Product) => void; brandName: (id: number | null) => string; categoryName: (id: number | null) => string;
}) {
  const [q, setQ] = useState('');
  const [brand, setBrand] = useState('all');
  const [cat, setCat] = useState('all');
  const [state, setState] = useState<'all' | 'live' | 'hidden' | 'low' | 'out'>('all');
  const [sort, setSort] = useState<'created' | 'price' | 'stock' | 'title'>('created');
  const [asc, setAsc] = useState(false);
  const [sel, setSel] = useState<Set<number>>(new Set());
  const [view, setView] = useState<'table' | 'grid'>('table');

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const list = products.filter((p) => {
      if (needle && !`${p.title} ${p.slug} ${brandName(p.brand_id)}`.toLowerCase().includes(needle)) return false;
      if (brand !== 'all' && String(p.brand_id) !== brand) return false;
      if (cat !== 'all' && String(p.category_id) !== cat) return false;
      if (state === 'live' && !p.is_published) return false;
      if (state === 'hidden' && p.is_published) return false;
      if (state === 'low' && !(p.stock > 0 && p.stock <= 1)) return false;
      if (state === 'out' && p.stock !== 0) return false;
      return true;
    });
    return [...list].sort((a, b) => {
      let d = 0;
      if (sort === 'price') d = a.price - b.price;
      else if (sort === 'stock') d = a.stock - b.stock;
      else if (sort === 'title') d = a.title.localeCompare(b.title, 'ru');
      else d = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      return asc ? d : -d;
    });
  }, [products, q, brand, cat, state, sort, asc, brandName]);

  useEffect(() => {
    setSel((s) => {
      const n = new Set(Array.from(s).filter((id) => rows.some((r) => r.id === id)));
      return n.size === s.size ? s : n;
    });
  }, [rows]);

  const allSelected = rows.length > 0 && rows.every((r) => sel.has(r.id));
  const toggleOne = (id: number) => setSel((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const filtersActive = !!q || brand !== 'all' || cat !== 'all' || state !== 'all';
  const reset = () => { setQ(''); setBrand('all'); setCat('all'); setState('all'); };
  const selCls = 'adm-input h-10 shrink-0 rounded-md px-3 text-xs';

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="relative min-w-[200px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" style={{ color: C.mist }} />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Поиск по названию, адресу, бренду…" aria-label="Поиск товаров" className="adm-input h-10 w-full rounded-md pl-9 pr-3 text-sm" />
          </div>
          <select value={brand} onChange={(e) => setBrand(e.target.value)} className={selCls} aria-label="Бренд">
            <option value="all">Все бренды</option>{brands.map((b) => <option key={b.id} value={String(b.id)}>{b.name}</option>)}
          </select>
          <select value={cat} onChange={(e) => setCat(e.target.value)} className={selCls} aria-label="Категория">
            <option value="all">Все категории</option>{categories.map((c) => <option key={c.id} value={String(c.id)}>{c.name}</option>)}
          </select>
          <select value={state} onChange={(e) => setState(e.target.value as typeof state)} className={selCls} aria-label="Состояние">
            <option value="all">Любое состояние</option><option value="live">На сайте</option><option value="hidden">Скрытые</option>
            <option value="low">Последний экземпляр</option><option value="out">Продано</option>
          </select>
          <select value={sort} onChange={(e) => setSort(e.target.value as typeof sort)} className={selCls} aria-label="Сортировка">
            <option value="created">По дате</option><option value="price">По цене</option><option value="stock">По остатку</option><option value="title">По названию</option>
          </select>
          <button onClick={() => setAsc((v) => !v)} aria-label="Направление сортировки" className="adm-btn grid h-10 w-10 shrink-0 place-items-center rounded-md border" style={{ borderColor: C.line, background: C.raised, color: C.chalk }}>
            {asc ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownRight className="h-4 w-4" />}
          </button>
          <div className="flex shrink-0 overflow-hidden rounded-md border" style={{ borderColor: C.line }}>
            {(['table','grid'] as const).map((v) => <button key={v} onClick={() => setView(v)} aria-label={v === 'table' ? 'Таблицей' : 'Плиткой'}
              className="grid h-10 w-10 place-items-center transition-colors" style={{ background: view === v ? C.signal : C.raised, color: view === v ? C.void : C.mist }}>
              <LayoutGrid className={`h-4 w-4 ${v === 'table' ? 'rotate-90' : ''}`} /></button>)}
          </div>
          <Btn onClick={onExport}><Download className="h-4 w-4" /> CSV</Btn>
          <Btn tone="primary" onClick={onCreate}><Plus className="h-4 w-4" /> Товар</Btn>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-3 border-t pt-3" style={{ borderColor: C.line }}>
          <span className="text-xs" style={{ color: C.mist }}>Показано <b style={{ color: C.chalk }}>{rows.length}</b> из {products.length}</span>
          {filtersActive && <button onClick={reset} className="text-[10px] font-bold uppercase tracking-[0.14em] underline underline-offset-4" style={{ color: C.signal }}>Сбросить фильтры</button>}
          {sel.size > 0 && <div className="ml-auto flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold" style={{ color: C.volt }}>Выбрано: {sel.size}</span>
            <Btn tone="volt" onClick={() => { void onBulk(new Set(sel), true); setSel(new Set()); }}><Eye className="h-3.5 w-3.5" /> Показать</Btn>
            <Btn onClick={() => { void onBulk(new Set(sel), false); setSel(new Set()); }}><EyeOff className="h-3.5 w-3.5" /> Скрыть</Btn>
            <Btn onClick={() => setSel(new Set())}><X className="h-3.5 w-3.5" /> Снять</Btn>
          </div>}
        </div>
      </Card>

      {rows.length === 0 ? (
        <Card className="grid min-h-[320px] place-items-center p-8 text-center"><div>
          <Boxes className="mx-auto h-10 w-10" style={{ color: C.mist }} />
          <p className="mt-4 text-base font-medium" style={{ color: C.chalk }}>Ничего не найдено</p>
          <p className="mt-1 text-sm" style={{ color: C.mist }}>Измените фильтры или добавьте первый товар.</p>
          <div className="mt-5 flex flex-wrap justify-center gap-3">
            {filtersActive && <Btn onClick={reset}>Сбросить</Btn>}
            <Btn tone="primary" onClick={onCreate}><Plus className="h-4 w-4" /> Добавить товар</Btn>
          </div>
        </div></Card>
      ) : view === 'table' ? (
        <Card className="overflow-hidden"><div className="adm-scroll overflow-x-auto">
          <table className="w-full min-w-[920px] text-sm">
            <thead><tr style={{ background: C.raised }}>
              <th className="w-10 px-3 py-2.5"><CheckBox checked={allSelected} onChange={() => setSel(allSelected ? new Set() : new Set(rows.map((r) => r.id)))} label="Выбрать все" /></th>
              {['Товар','Бренд / категория','Цена','Остаток','Состояние','На сайте',''].map((h, i) => <th key={i} className="px-3 py-2.5 text-left text-[10px] font-bold uppercase tracking-[0.14em]" style={{ color: C.mist }}>{h}</th>)}
            </tr></thead>
            <tbody>{rows.map((p) => (
              <tr key={p.id} className="adm-row border-t transition-colors" style={{ borderColor: C.line, background: sel.has(p.id) ? `${C.signal}0F` : undefined }}>
                <td className="px-3 py-2.5"><CheckBox checked={sel.has(p.id)} onChange={() => toggleOne(p.id)} label={`Выбрать ${p.title}`} /></td>
                <td className="px-3 py-2.5"><button onClick={() => onEdit(p)} className="flex items-center gap-3 text-left">
                  <Thumb src={p.images[0]} alt={p.title} />
                  <span className="min-w-0">
                    <span className="block max-w-[260px] truncate font-medium" style={{ color: C.chalk }}>{p.title}</span>
                    <span className="block max-w-[260px] truncate text-[11px]" style={{ color: C.mist }}>/{p.slug}</span>
                  </span></button></td>
                <td className="px-3 py-2.5">
                  <span className="block text-xs" style={{ color: C.chalk }}>{brandName(p.brand_id)}</span>
                  <span className="block text-[11px]" style={{ color: C.mist }}>{categoryName(p.category_id)}</span></td>
                <td className="px-3 py-2.5">
                  <span className="block font-semibold tabular-nums" style={{ color: C.chalk }}>{money(p.price)}</span>
                  {p.old_price && <span className="block text-[11px] line-through tabular-nums" style={{ color: C.mist }}>{money(p.old_price)}</span>}</td>
                <td className="px-3 py-2.5"><span className="font-bold tabular-nums" style={{ color: p.stock === 0 ? C.rose : p.stock <= 1 ? C.amber : C.mint }}>{p.stock}</span></td>
                <td className="px-3 py-2.5"><Pill color={CONDITION_META[p.condition].color}>{CONDITION_META[p.condition].label}</Pill></td>
                <td className="px-3 py-2.5"><button onClick={() => onToggle(p)} className="adm-btn inline-flex items-center gap-1.5 rounded px-2 py-1 text-[10px] font-bold uppercase tracking-[0.1em]"
                  style={{ background: p.is_published ? `${C.volt}1F` : C.raised, color: p.is_published ? C.volt : C.mist }}>
                  {p.is_published ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}{p.is_published ? 'Да' : 'Нет'}</button></td>
                <td className="px-3 py-2.5"><div className="flex justify-end gap-1.5">
                  <IconBtn title="Редактировать" onClick={() => onEdit(p)}><Pencil className="h-3.5 w-3.5" /></IconBtn>
                  <IconBtn title="Удалить" danger onClick={() => onDelete(p)}><Trash2 className="h-3.5 w-3.5" /></IconBtn>
                </div></td>
              </tr>))}</tbody>
          </table>
        </div></Card>
      ) : (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4">
          {rows.map((p, i) => (
            <Card key={p.id} delay={Math.min(i, 8) * 35} className="group overflow-hidden">
              <div className="relative aspect-[4/3] overflow-hidden" style={{ background: C.raised }}>
                {p.images[0] ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.images[0]} alt={p.title} loading="lazy" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
                ) : <span className="grid h-full place-items-center"><ImageIcon className="h-6 w-6" style={{ color: C.mist }} /></span>}
                <div className="absolute left-2 top-2 flex flex-col items-start gap-1.5">
                  {!p.is_published && <Pill color={C.mist}>Скрыт</Pill>}
                  {p.stock === 0 && <Pill color={C.rose}>Продано</Pill>}
                  {p.is_new && <Pill color={C.volt}>Новинка</Pill>}
                </div>
                <div className="absolute right-2 top-2"><CheckBox checked={sel.has(p.id)} onChange={() => toggleOne(p.id)} label={`Выбрать ${p.title}`} /></div>
              </div>
              <div className="p-3.5">
                <p className="truncate text-[10px] font-bold uppercase tracking-[0.14em]" style={{ color: C.mist }}>{brandName(p.brand_id)}</p>
                <p className="mt-1 line-clamp-2 min-h-[2.4rem] text-sm font-medium leading-snug" style={{ color: C.chalk }}>{p.title}</p>
                <div className="mt-2 flex items-baseline justify-between gap-2">
                  <span className="font-bold tabular-nums" style={{ color: C.chalk }}>{money(p.price)}</span>
                  <span className="shrink-0 text-xs font-bold tabular-nums" style={{ color: p.stock === 0 ? C.rose : p.stock <= 1 ? C.amber : C.mint }}>{p.stock} шт</span>
                </div>
                <div className="mt-3 flex gap-1.5">
                  <Btn className="min-w-0 flex-1" onClick={() => onEdit(p)}><Pencil className="h-3.5 w-3.5" /> Править</Btn>
                  <IconBtn title="Удалить" danger onClick={() => onDelete(p)}><Trash2 className="h-3.5 w-3.5" /></IconBtn>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function OrdersTab({ orders, onOpen, onStatus, onExport }: {
  orders: Order[]; onOpen: (o: Order) => void; onStatus: (o: Order, s: OrderStatus) => Promise<void>; onExport: () => void;
}) {
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<OrderStatus | 'all'>('all');
  const [delivery, setDelivery] = useState<'all' | DeliveryMethod>('all');
  const counts = useMemo(() => {
    const c: Record<string, number> = { all: orders.length };
    (Object.keys(STATUS_META) as OrderStatus[]).forEach((s) => { c[s] = orders.filter((o) => o.status === s).length; });
    return c;
  }, [orders]);
  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return orders.filter((o) => {
      if (filter !== 'all' && o.status !== filter) return false;
      if (delivery !== 'all' && o.delivery_method !== delivery) return false;
      if (needle && !`${o.id} ${o.customer_name} ${o.customer_phone} ${o.customer_email} ${o.shipping_address}`.toLowerCase().includes(needle)) return false;
      return true;
    });
  }, [orders, q, filter, delivery]);
  const sum = rows.filter((o) => o.status !== 'cancelled').reduce((s, o) => s + o.total_amount, 0);

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="relative min-w-[200px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" style={{ color: C.mist }} />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Номер, имя, телефон, почта, адрес…" aria-label="Поиск заказов" className="adm-input h-10 w-full rounded-md pl-9 pr-3 text-sm" />
          </div>
          <select value={delivery} onChange={(e) => setDelivery(e.target.value as typeof delivery)} className="adm-input h-10 shrink-0 rounded-md px-3 text-xs" aria-label="Доставка">
            <option value="all">Любая доставка</option>
            {(Object.keys(DELIVERY_LABEL) as DeliveryMethod[]).map((d) => <option key={d} value={d}>{DELIVERY_LABEL[d]}</option>)}
          </select>
          <Btn onClick={onExport}><Download className="h-4 w-4" /> CSV</Btn>
        </div>
        <div className="adm-scroll mt-3 flex gap-2 overflow-x-auto border-t pt-3" style={{ borderColor: C.line }}>
          <FilterChip active={filter === 'all'} color={C.chalk} onClick={() => setFilter('all')}>Все · {counts.all}</FilterChip>
          {(Object.keys(STATUS_META) as OrderStatus[]).map((s) => <FilterChip key={s} active={filter === s} color={STATUS_META[s].color} onClick={() => setFilter(filter === s ? 'all' : s)}>
            {STATUS_META[s].label} · {counts[s]}</FilterChip>)}
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-3 text-xs" style={{ color: C.mist }}>
          <span>Найдено <b style={{ color: C.chalk }}>{rows.length}</b></span>
          <span>Сумма без отмен <b style={{ color: C.volt }}>{money(sum)}</b></span>
        </div>
      </Card>
      {rows.length === 0 ? (
        <Card className="grid min-h-[300px] place-items-center p-8 text-center"><div>
          <ShoppingBag className="mx-auto h-10 w-10" style={{ color: C.mist }} />
          <p className="mt-4 text-base font-medium" style={{ color: C.chalk }}>Заказов не найдено</p>
          <p className="mt-1 text-sm" style={{ color: C.mist }}>Смените фильтр или очистите поиск.</p>
          {(filter !== 'all' || q || delivery !== 'all') && <Btn className="mt-5" onClick={() => { setFilter('all'); setQ(''); setDelivery('all'); }}>Сбросить</Btn>}
        </div></Card>
      ) : (
        <div className="space-y-3">{rows.map((o, i) => {
          const meta = STATUS_META[o.status];
          const cnt = o.order_items.reduce((s, x) => s + x.quantity, 0);
          return (
            <Card key={o.id} delay={Math.min(i, 8) * 40} className="overflow-hidden">
              <div className="flex flex-wrap items-center gap-4 p-4">
                <button onClick={() => onOpen(o)} className="flex min-w-[220px] flex-1 items-center gap-3 text-left">
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-md text-xs font-bold tabular-nums" style={{ background: `${meta.color}1A`, color: meta.color }}>#{o.id}</span>
                  <span className="min-w-0">
                    <span className="block truncate font-medium" style={{ color: C.chalk }}>{o.customer_name}</span>
                    <span className="block truncate text-xs" style={{ color: C.mist }}>{dateFull(o.created_at)} · {cnt} {plural(cnt, 'товар', 'товара', 'товаров')}</span>
                  </span>
                </button>
                <div className="hidden min-w-0 max-w-[240px] flex-1 md:block">
                  <p className="flex items-center gap-1.5 truncate text-xs" style={{ color: C.mist }}><Truck className="h-3.5 w-3.5 shrink-0" /> {DELIVERY_LABEL[o.delivery_method]}</p>
                  <p className="mt-0.5 truncate text-xs" style={{ color: C.mist }}>{o.customer_phone}</p>
                </div>
                <span className="shrink-0 text-lg font-bold tabular-nums" style={{ color: C.chalk }}>{money(o.total_amount)}</span>
                <Pill color={meta.color}>{meta.label}</Pill>
                <div className="flex shrink-0 flex-wrap gap-1.5">
                  {meta.next.map((n) => <button key={n} onClick={() => void onStatus(o, n)}
                    className="adm-btn inline-flex h-9 items-center gap-1.5 rounded-md border px-3 text-[10px] font-bold uppercase tracking-[0.12em]"
                    style={{ borderColor: `${STATUS_META[n].color}55`, background: `${STATUS_META[n].color}14`, color: STATUS_META[n].color }}>
                    {n === 'cancelled' ? <X className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}{STATUS_META[n].label}</button>)}
                  <IconBtn title="Открыть заказ" onClick={() => onOpen(o)}><Package className="h-3.5 w-3.5" /></IconBtn>
                </div>
              </div>
            </Card>
          );
        })}</div>
      )}
    </div>
  );
}
function FilterChip({ active, color, onClick, children }: { active: boolean; color: string; onClick: () => void; children: ReactNode }) {
  return <button onClick={onClick} className="adm-btn inline-flex h-9 shrink-0 items-center gap-1.5 rounded-md border px-3 text-[10px] font-bold uppercase tracking-[0.12em]"
    style={{ borderColor: active ? color : C.line, background: active ? `${color}1F` : C.raised, color: active ? color : C.mist }}>{children}</button>;
}

function OrderDrawer({ order, onClose, onStatus, toast }: { order: Order; onClose: () => void; onStatus: (o: Order, s: OrderStatus) => Promise<void>; toast: ToastFn }) {
  const meta = STATUS_META[order.status];
  const steps: OrderStatus[] = ['pending','confirmed','shipped','delivered'];
  const idx = steps.indexOf(order.status);
  const itemsSum = order.order_items.reduce((s, i) => s + i.price_snapshot * i.quantity, 0);
  const copyAll = async () => {
    const text = [`Заказ №${order.id} · ${dateFull(order.created_at)}`, `Клиент: ${order.customer_name}`,
      `Телефон: ${order.customer_phone}`, `Email: ${order.customer_email}`,
      `Доставка: ${DELIVERY_LABEL[order.delivery_method]} — ${order.shipping_address}`, 'Состав:',
      ...order.order_items.map((i) => `  • ${i.title_snapshot} (${[i.size, i.color].filter(Boolean).join(', ')}) × ${i.quantity} — ${money(i.price_snapshot * i.quantity)}`),
      `Доставка: ${money(order.delivery_cost)}`, `Итого: ${money(order.total_amount)}`,
      order.notes ? `Комментарий: ${order.notes}` : ''].filter(Boolean).join('\n');
    try { await navigator.clipboard.writeText(text); toast('Заказ скопирован', `№${order.id} — вставьте в мессенджер`); }
    catch { toast('Буфер обмена недоступен', undefined, 'warn'); }
  };
  return (
    <div className="fixed inset-0 z-[105] flex justify-end">
      <div className="adm-in absolute inset-0 backdrop-blur-sm" style={{ background: `${C.void}B3` }} onClick={onClose} />
      <aside className="adm-slide relative flex h-full w-full max-w-xl flex-col border-l" style={{ borderColor: C.line, background: C.panel }}>
        <div className="flex items-start justify-between gap-4 border-b p-5" style={{ borderColor: C.line }}>
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em]" style={{ color: C.mist }}>Заказ</p>
            <h2 className="mt-1 flex flex-wrap items-center gap-3 text-2xl font-bold tracking-tight" style={{ color: C.chalk }}>№{order.id} <Pill color={meta.color}>{meta.label}</Pill></h2>
            <p className="mt-1 text-xs" style={{ color: C.mist }}>{dateFull(order.created_at)}</p>
          </div>
          <IconBtn title="Закрыть" onClick={onClose}><X className="h-4 w-4" /></IconBtn>
        </div>
        <div className="adm-scroll min-h-0 flex-1 space-y-5 overflow-y-auto p-5">
          {order.status !== 'cancelled' && <div className="flex items-center">
            {steps.map((s, i) => <div key={s} className="flex flex-1 items-center last:flex-none">
              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-[10px] font-bold"
                style={{ background: i <= idx ? STATUS_META[s].color : C.raised, color: i <= idx ? C.void : C.mist }}>
                {i <= idx ? <Check className="h-3.5 w-3.5" /> : i + 1}</span>
              {i < steps.length - 1 && <span className="mx-2 h-0.5 flex-1 rounded" style={{ background: i < idx ? C.mint : C.line }} />}
            </div>)}
          </div>}
          <section className="rounded-lg border p-4" style={{ borderColor: C.line, background: C.raised }}>
            <h3 className="text-[10px] font-bold uppercase tracking-[0.18em]" style={{ color: C.mist }}>Клиент</h3>
            <p className="mt-2 font-medium" style={{ color: C.chalk }}>{order.customer_name}</p>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <a href={`tel:${order.customer_phone.replace(/[^\d+]/g, '')}`} className="adm-btn flex items-center gap-2 rounded-md border px-3 py-2 text-xs" style={{ borderColor: C.line, color: C.volt }}>{order.customer_phone}</a>
              <a href={`mailto:${order.customer_email}`} className="adm-btn flex items-center gap-2 truncate rounded-md border px-3 py-2 text-xs" style={{ borderColor: C.line, color: C.azure }}><span className="truncate">{order.customer_email}</span></a>
            </div>
          </section>
          <section className="rounded-lg border p-4" style={{ borderColor: C.line, background: C.raised }}>
            <h3 className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.18em]" style={{ color: C.mist }}><Truck className="h-3.5 w-3.5" /> Доставка</h3>
            <p className="mt-2 text-sm font-medium" style={{ color: C.chalk }}>{DELIVERY_LABEL[order.delivery_method]}</p>
            <p className="mt-1 text-sm leading-relaxed" style={{ color: C.mist }}>{order.shipping_address}</p>
            {order.notes && <p className="mt-3 border-l-2 pl-3 text-xs leading-relaxed" style={{ borderColor: C.amber, color: C.amber }}>{order.notes}</p>}
          </section>
          <section>
            <h3 className="mb-3 text-[10px] font-bold uppercase tracking-[0.18em]" style={{ color: C.mist }}>Состав заказа</h3>
            <div className="space-y-2">{order.order_items.map((i) => (
              <div key={i.id} className="flex items-center gap-3 rounded-lg border p-3" style={{ borderColor: C.line }}>
                <Thumb src={i.image_snapshot} alt={i.title_snapshot} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium" style={{ color: C.chalk }}>{i.title_snapshot}</p>
                  <p className="text-xs" style={{ color: C.mist }}>{[i.size, i.color].filter(Boolean).join(' · ')} × {i.quantity}</p>
                </div>
                <span className="shrink-0 text-sm font-semibold tabular-nums" style={{ color: C.chalk }}>{money(i.price_snapshot * i.quantity)}</span>
              </div>))}</div>
            <dl className="mt-4 space-y-2 border-t pt-4 text-sm" style={{ borderColor: C.line }}>
              <div className="flex justify-between"><dt style={{ color: C.mist }}>Товары</dt><dd className="tabular-nums" style={{ color: C.chalk }}>{money(itemsSum)}</dd></div>
              <div className="flex justify-between"><dt style={{ color: C.mist }}>Доставка</dt><dd className="tabular-nums" style={{ color: order.delivery_cost === 0 ? C.mint : C.chalk }}>{order.delivery_cost === 0 ? 'Бесплатно' : money(order.delivery_cost)}</dd></div>
              <div className="flex items-baseline justify-between border-t pt-2" style={{ borderColor: C.line }}>
                <dt className="font-medium" style={{ color: C.chalk }}>Итого</dt>
                <dd className="text-xl font-bold tabular-nums" style={{ color: C.volt }}>{money(order.total_amount)}</dd>
              </div>
            </dl>
          </section>
        </div>
        <div className="border-t p-4" style={{ borderColor: C.line }}>
          <p className="mb-2.5 text-[10px] font-bold uppercase tracking-[0.18em]" style={{ color: C.mist }}>Сменить статус</p>
          <div className="flex flex-wrap gap-2">
            {meta.next.length === 0 ? <span className="text-xs" style={{ color: C.mist }}>Заказ завершён — переходов больше нет</span>
              : meta.next.map((n) => <Btn key={n} tone={n === 'cancelled' ? 'danger' : 'primary'} onClick={() => void onStatus(order, n)}>
                {n === 'cancelled' ? <X className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}{STATUS_META[n].label}</Btn>)}
            <Btn className="ml-auto" onClick={() => void copyAll()}><Copy className="h-3.5 w-3.5" /> Копировать</Btn>
          </div>
        </div>
      </aside>
    </div>
  );
}

function TaxonomyTab({ brands, categories, products, onAdd, onRemove, onReorder }: {
  brands: Brand[]; categories: Category[]; products: Product[];
  onAdd: (k: 'brand' | 'category', name: string) => Promise<void>;
  onRemove: (k: 'brand' | 'category', id: number, name: string) => void;
  onReorder: (from: number, to: number) => Promise<void>;
}) {
  const [newBrand, setNewBrand] = useState('');
  const [newCat, setNewCat] = useState('');
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [overIdx, setOverIdx] = useState<number | null>(null);
  const usage = (k: 'brand' | 'category', id: number) => products.filter((p) => (k === 'brand' ? p.brand_id : p.category_id) === id).length;

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <Card className="p-5">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4" style={{ color: C.signal }} />
          <h2 className="text-sm font-bold uppercase tracking-[0.16em]" style={{ color: C.chalk }}>Бренды · {brands.length}</h2>
        </div>
        <form onSubmit={(e) => { e.preventDefault(); void onAdd('brand', newBrand); setNewBrand(''); }} className="mt-4 flex gap-2">
          <input value={newBrand} onChange={(e) => setNewBrand(e.target.value)} placeholder="Новый бренд, например C.P. Company" aria-label="Название бренда" className="adm-input h-10 min-w-0 flex-1 rounded-md px-3 text-sm" />
          <Btn type="submit" tone="primary" disabled={newBrand.trim().length < 2}><Plus className="h-4 w-4" /> Добавить</Btn>
        </form>
        <ul className="adm-scroll mt-4 max-h-[460px] space-y-1.5 overflow-y-auto pr-1">
          {brands.map((b) => {
            const used = usage('brand', b.id);
            return <li key={b.id} className="adm-row flex items-center gap-3 rounded-md border p-3 transition-colors" style={{ borderColor: C.line }}>
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded text-[11px] font-bold" style={{ background: C.raised, color: C.volt }}>{b.name.slice(0, 2).toUpperCase()}</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium" style={{ color: C.chalk }}>{b.name}</span>
                <span className="block truncate text-[11px]" style={{ color: C.mist }}>/{b.slug} · {used} {plural(used, 'товар', 'товара', 'товаров')}</span>
              </span>
              <IconBtn title={used ? 'Используется — удалить нельзя' : 'Удалить бренд'} danger onClick={() => onRemove('brand', b.id, b.name)}><Trash2 className="h-3.5 w-3.5" /></IconBtn>
            </li>;
          })}
        </ul>
      </Card>

      <Card delay={80} className="p-5">
        <div className="flex items-center gap-2">
          <Tag className="h-4 w-4" style={{ color: C.azure }} />
          <h2 className="text-sm font-bold uppercase tracking-[0.16em]" style={{ color: C.chalk }}>Категории · {categories.length}</h2>
        </div>
        <p className="mt-1.5 text-xs" style={{ color: C.mist }}>Перетащите за ручку — порядок сразу применится на сайте.</p>
        <form onSubmit={(e) => { e.preventDefault(); void onAdd('category', newCat); setNewCat(''); }} className="mt-4 flex gap-2">
          <input value={newCat} onChange={(e) => setNewCat(e.target.value)} placeholder="Новая категория, например Головные уборы" aria-label="Название категории" className="adm-input h-10 min-w-0 flex-1 rounded-md px-3 text-sm" />
          <Btn type="submit" tone="primary" disabled={newCat.trim().length < 2}><Plus className="h-4 w-4" /> Добавить</Btn>
        </form>
        <ul className="adm-scroll mt-4 max-h-[460px] space-y-1.5 overflow-y-auto pr-1">
          {categories.map((c, i) => {
            const used = usage('category', c.id);
            const isOver = overIdx === i && dragIdx !== null && dragIdx !== i;
            return <li key={c.id} draggable onDragStart={() => setDragIdx(i)} onDragOver={(e) => { e.preventDefault(); setOverIdx(i); }}
              onDrop={(e) => { e.preventDefault(); if (dragIdx !== null) void onReorder(dragIdx, i); setDragIdx(null); setOverIdx(null); }}
              onDragEnd={() => { setDragIdx(null); setOverIdx(null); }}
              className="flex items-center gap-3 rounded-md border p-3 transition-all"
              style={{ borderColor: isOver ? C.signal : C.line, background: isOver ? `${C.signal}12` : C.raised, opacity: dragIdx === i ? 0.45 : 1 }}>
              <span className="cursor-grab active:cursor-grabbing" style={{ color: C.mist }}><GripVertical className="h-4 w-4" /></span>
              <span className="grid h-6 w-6 shrink-0 place-items-center rounded text-[10px] font-bold tabular-nums" style={{ background: C.panel, color: C.mist }}>{i + 1}</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium" style={{ color: C.chalk }}>{c.name}</span>
                <span className="block truncate text-[11px]" style={{ color: C.mist }}>/{c.slug} · {used} {plural(used, 'товар', 'товара', 'товаров')}</span>
              </span>
              <div className="flex shrink-0 gap-1">
                <IconBtn title="Выше" onClick={() => void onReorder(i, i - 1)}><ArrowUpRight className="h-3.5 w-3.5 -rotate-45" /></IconBtn>
                <IconBtn title="Ниже" onClick={() => void onReorder(i, i + 1)}><ArrowDownRight className="h-3.5 w-3.5 rotate-45" /></IconBtn>
                <IconBtn title={used ? 'Используется — удалить нельзя' : 'Удалить категорию'} danger onClick={() => onRemove('category', c.id, c.name)}><Trash2 className="h-3.5 w-3.5" /></IconBtn>
              </div>
            </li>;
          })}
        </ul>
      </Card>
    </div>
  );
}

function ProductEditor({ mode, product, products, brands, categories, demo, sb, busy, onClose, onSave, toast }: {
  mode: 'create' | 'edit'; product: Product | null; products: Product[]; brands: Brand[]; categories: Category[];
  demo: boolean; sb: SupabaseClient | null; busy: boolean; onClose: () => void;
  onSave: (p: Product, mode: 'create' | 'edit') => Promise<void>; toast: ToastFn;
}) {
  const blank: Product = {
    id: 0, title: '', slug: '', description: '', price: 0, old_price: null,
    brand_id: brands[0]?.id ?? null, category_id: categories[0]?.id ?? null, condition: 'excellent',
    sizes: [], colors: [], images: [], stock: 1, is_new: true, is_popular: false, is_published: true,
    created_at: new Date().toISOString()
  };
  const [d, setD] = useState<Product>(product ?? blank);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [slugTouched, setSlugTouched] = useState(mode === 'edit');
  const [uploading, setUploading] = useState(false);
  const [urlInput, setUrlInput] = useState('');
  const [sizeInput, setSizeInput] = useState('');
  const [colorInput, setColorInput] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const set = <K extends keyof Product>(k: K, v: Product[K]) => setD((p) => ({ ...p, [k]: v }));

  const takenSlugs = useMemo(() => new Set(products.filter((p) => p.id !== d.id).map((p) => p.slug)), [products, d.id]);
  const catSlug = categories.find((c) => c.id === d.category_id)?.slug ?? '';
  const presets = catSlug === 'shoes' ? SHOE_PRESETS : catSlug === 'pants' ? PANT_PRESETS : SIZE_PRESETS;

  const validate = () => {
    const e: Record<string, string> = {};
    if (d.title.trim().length < 3) e.title = 'Название от 3 символов';
    if (!d.slug.trim()) e.slug = 'Укажите адрес страницы';
    else if (!/^[a-z0-9-]+$/.test(d.slug.trim())) e.slug = 'Только латиница, цифры и дефис';
    else if (takenSlugs.has(d.slug.trim())) e.slug = 'Такой адрес уже занят';
    if (!(d.price > 0)) e.price = 'Цена должна быть больше нуля';
    if (d.old_price != null && d.old_price <= d.price) e.old_price = 'Старая цена должна быть выше текущей';
    if (d.stock < 0) e.stock = 'Остаток не может быть отрицательным';
    if (!d.brand_id) e.brand_id = 'Выберите бренд';
    if (!d.category_id) e.category_id = 'Выберите категорию';
    if (d.images.length === 0) e.images = 'Добавьте хотя бы одно фото';
    return e;
  };

  const submit = () => {
    const e = validate();
    setErrors(e);
    if (Object.keys(e).length) { toast('Проверьте поля формы', Object.values(e)[0], 'warn'); return; }
    void onSave({ ...d, title: d.title.trim(), slug: d.slug.trim() }, mode);
  };

  const uploadFiles = async (files: FileList) => {
    const allowed = ['image/jpeg','image/png','image/webp','image/avif'];
    const max = 8 * 1024 * 1024;
    setUploading(true);
    const added: string[] = [];
    for (const f of Array.from(files)) {
      if (!allowed.includes(f.type)) { toast('Неподдерживаемый формат', `${f.name}: только JPG, PNG, WebP, AVIF`, 'warn'); continue; }
      if (f.size > max) { toast('Файл слишком большой', `${f.name}: максимум 8 МБ`, 'warn'); continue; }
      if (f.size === 0) { toast('Пустой файл', f.name, 'warn'); continue; }
      if (demo || !sb) { added.push(URL.createObjectURL(f)); continue; }
      const ext = (f.name.split('.').pop() ?? 'jpg').toLowerCase();
      const safe = ['jpg','jpeg','png','webp','avif'].includes(ext) ? ext : 'jpg';
      const path = `products/${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${safe}`;
      const { error } = await sb.storage.from('product-images').upload(path, f, { cacheControl: '3600', upsert: false });
      if (error) { toast('Загрузка не удалась', error.message, 'bad'); continue; }
      added.push(sb.storage.from('product-images').getPublicUrl(path).data.publicUrl);
    }
    if (added.length) {
      setD((p) => ({ ...p, images: [...p.images, ...added] }));
      setErrors((e) => ({ ...e, images: '' }));
      toast('Фото добавлено', `${added.length} ${plural(added.length, 'файл', 'файла', 'файлов')}`);
    }
    setUploading(false);
    if (fileRef.current) fileRef.current.value = '';
  };

  const addUrl = () => {
    const u = urlInput.trim();
    if (!/^https?:\/\//i.test(u)) { toast('Нужна ссылка', 'Адрес должен начинаться с http:// или https://', 'warn'); return; }
    setD((p) => ({ ...p, images: [...p.images, u] }));
    setUrlInput('');
    setErrors((e) => ({ ...e, images: '' }));
  };
  const moveImage = (from: number, to: number) => {
    if (to < 0 || to >= d.images.length) return;
    const next = [...d.images];
    const [m] = next.splice(from, 1);
    next.splice(to, 0, m);
    set('images', next);
  };
  const toggleIn = (k: 'sizes' | 'colors', v: string) =>
    setD((p) => ({ ...p, [k]: p[k].includes(v) ? p[k].filter((x) => x !== v) : [...p[k], v] }));
  const discount = d.old_price && d.old_price > d.price ? Math.round((1 - d.price / d.old_price) * 100) : 0;

  return (
    <div className="fixed inset-0 z-[108] flex justify-end">
      <div className="adm-in absolute inset-0 backdrop-blur-sm" style={{ background: `${C.void}BF` }} onClick={onClose} />
      <aside className="adm-slide relative flex h-full w-full max-w-3xl flex-col border-l" style={{ borderColor: C.line, background: C.panel }}>
        <div className="flex items-start justify-between gap-4 border-b p-5" style={{ borderColor: C.line }}>
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em]" style={{ color: C.signal }}>{mode === 'create' ? 'Новый товар' : `Товар #${d.id}`}</p>
            <h2 className="mt-1 truncate text-xl font-bold tracking-tight" style={{ color: C.chalk }}>{d.title || 'Без названия'}</h2>
          </div>
          <IconBtn title="Закрыть" onClick={onClose}><X className="h-4 w-4" /></IconBtn>
        </div>

        <div className="adm-scroll min-h-0 flex-1 space-y-6 overflow-y-auto p-5">
          <section className="space-y-4">
            <Field label="Название" error={errors.title}>
              <input value={d.title} onChange={(e) => {
                const v = e.target.value;
                setD((p) => ({ ...p, title: v, slug: slugTouched ? p.slug : uniqueSlug(slugify(v), takenSlugs) }));
              }} placeholder="Куртка Stone Island Ghost Piece" className="adm-input h-11 w-full rounded-md px-3 text-sm" />
            </Field>
            <Field label="Адрес страницы" error={errors.slug} hint={`/product/${d.slug || '…'}`}>
              <div className="flex gap-2">
                <input value={d.slug} onChange={(e) => { setSlugTouched(true); set('slug', e.target.value.toLowerCase()); }}
                  placeholder="stone-island-ghost-piece" className="adm-input h-11 min-w-0 flex-1 rounded-md px-3 text-sm" />
                <Btn onClick={() => { setSlugTouched(false); set('slug', uniqueSlug(slugify(d.title), takenSlugs)); }}>Из названия</Btn>
              </div>
            </Field>
            <Field label="Описание">
              <textarea value={d.description ?? ''} onChange={(e) => set('description', e.target.value)} rows={4}
                placeholder="Материал, крой, состояние, особенности. Всё, что важно покупателю."
                className="adm-input w-full rounded-md px-3 py-2.5 text-sm" />
            </Field>
          </section>

          <section className="grid gap-4 sm:grid-cols-2">
            <Field label="Бренд" error={errors.brand_id}>
              <select value={d.brand_id ?? ''} onChange={(e) => set('brand_id', e.target.value ? Number(e.target.value) : null)} className="adm-input h-11 w-full rounded-md px-3 text-sm">
                <option value="">— выберите —</option>{brands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </Field>
            <Field label="Категория" error={errors.category_id}>
              <select value={d.category_id ?? ''} onChange={(e) => set('category_id', e.target.value ? Number(e.target.value) : null)} className="adm-input h-11 w-full rounded-md px-3 text-sm">
                <option value="">— выберите —</option>{categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </Field>
            <Field label="Цена, ₽" error={errors.price}>
              <input type="number" min={0} value={d.price || ''} onChange={(e) => set('price', Number(e.target.value) || 0)} className="adm-input h-11 w-full rounded-md px-3 text-sm tabular-nums" />
            </Field>
            <Field label="Старая цена, ₽" error={errors.old_price} hint={discount ? `Скидка −${discount}%` : 'Необязательно — для зачёркнутой цены'}>
              <input type="number" min={0} value={d.old_price ?? ''} onChange={(e) => set('old_price', e.target.value ? Number(e.target.value) : null)} className="adm-input h-11 w-full rounded-md px-3 text-sm tabular-nums" />
            </Field>
            <Field label="Остаток, шт" error={errors.stock}>
              <div className="flex gap-2">
                <button onClick={() => set('stock', Math.max(0, d.stock - 1))} className="adm-btn grid h-11 w-11 shrink-0 place-items-center rounded-md border" style={{ borderColor: C.line, background: C.raised, color: C.chalk }}>−</button>
                <input type="number" min={0} value={d.stock} onChange={(e) => set('stock', Math.max(0, Number(e.target.value) || 0))} className="adm-input h-11 min-w-0 flex-1 rounded-md px-3 text-center text-sm tabular-nums" />
                <button onClick={() => set('stock', d.stock + 1)} className="adm-btn grid h-11 w-11 shrink-0 place-items-center rounded-md border" style={{ borderColor: C.line, background: C.raised, color: C.chalk }}>+</button>
              </div>
            </Field>
            <Field label="Состояние">
              <select value={d.condition} onChange={(e) => set('condition', e.target.value as Condition)} className="adm-input h-11 w-full rounded-md px-3 text-sm">
                {(Object.keys(CONDITION_META) as Condition[]).map((c) => <option key={c} value={c}>{CONDITION_META[c].label}</option>)}
              </select>
            </Field>
          </section>

          <section>
            <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.16em]" style={{ color: C.mist }}>Размеры</p>
            <div className="flex flex-wrap gap-1.5">
              {presets.map((s) => <button key={s} onClick={() => toggleIn('sizes', s)}
                className="adm-btn h-9 rounded-md border px-3 text-xs font-bold"
                style={{ borderColor: d.sizes.includes(s) ? C.signal : C.line, background: d.sizes.includes(s) ? C.signal : C.raised, color: d.sizes.includes(s) ? C.void : C.mist }}>{s}</button>)}
            </div>
            <div className="mt-2 flex gap-2">
              <input value={sizeInput} onChange={(e) => setSizeInput(e.target.value)} placeholder="Свой размер"
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); if (sizeInput.trim()) { toggleIn('sizes', sizeInput.trim()); setSizeInput(''); } } }}
                className="adm-input h-9 min-w-0 flex-1 rounded-md px-3 text-xs" />
              <Btn onClick={() => { if (sizeInput.trim()) { toggleIn('sizes', sizeInput.trim()); setSizeInput(''); } }}><Plus className="h-3.5 w-3.5" /></Btn>
            </div>
            {d.sizes.length > 0 && <p className="mt-2 text-xs" style={{ color: C.volt }}>Выбрано: {d.sizes.join(', ')}</p>}
          </section>

          <section>
            <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.16em]" style={{ color: C.mist }}>Цвета</p>
            <div className="flex flex-wrap gap-1.5">
              {COLOR_PRESETS.map((c) => <button key={c} onClick={() => toggleIn('colors', c)}
                className="adm-btn h-9 rounded-md border px-3 text-xs font-semibold"
                style={{ borderColor: d.colors.includes(c) ? C.azure : C.line, background: d.colors.includes(c) ? `${C.azure}1F` : C.raised, color: d.colors.includes(c) ? C.azure : C.mist }}>{c}</button>)}
            </div>
            <div className="mt-2 flex gap-2">
              <input value={colorInput} onChange={(e) => setColorInput(e.target.value)} placeholder="Свой цвет"
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); if (colorInput.trim()) { toggleIn('colors', colorInput.trim()); setColorInput(''); } } }}
                className="adm-input h-9 min-w-0 flex-1 rounded-md px-3 text-xs" />
              <Btn onClick={() => { if (colorInput.trim()) { toggleIn('colors', colorInput.trim()); setColorInput(''); } }}><Plus className="h-3.5 w-3.5" /></Btn>
            </div>
          </section>

          <section>
            <div className="mb-2 flex items-center justify-between gap-3">
              <p className="text-[10px] font-bold uppercase tracking-[0.16em]" style={{ color: C.mist }}>Фотографии · {d.images.length}</p>
              {errors.images && <span className="text-xs" style={{ color: C.rose }}>{errors.images}</span>}
            </div>
            <button onClick={() => fileRef.current?.click()} disabled={uploading}
              className="adm-btn flex w-full flex-col items-center gap-2 rounded-lg border border-dashed p-6"
              style={{ borderColor: C.line, background: C.raised }}>
              {uploading ? <Loader2 className="h-6 w-6 animate-spin" style={{ color: C.signal }} /> : <Upload className="h-6 w-6" style={{ color: C.signal }} />}
              <span className="text-sm font-medium" style={{ color: C.chalk }}>{uploading ? 'Загружаем…' : 'Загрузить с компьютера'}</span>
              <span className="text-xs" style={{ color: C.mist }}>JPG, PNG, WebP, AVIF · до 8 МБ{demo ? ' · демо: локальный предпросмотр' : ''}</span>
            </button>
            <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp,image/avif" multiple className="hidden"
              onChange={(e) => { if (e.target.files?.length) void uploadFiles(e.target.files); }} />
            <div className="mt-2 flex gap-2">
              <input value={urlInput} onChange={(e) => setUrlInput(e.target.value)} placeholder="…или вставьте ссылку на фото"
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addUrl(); } }} className="adm-input h-10 min-w-0 flex-1 rounded-md px-3 text-xs" />
              <Btn onClick={addUrl}><Plus className="h-3.5 w-3.5" /> По ссылке</Btn>
            </div>
            {d.images.length > 0 && <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4">
              {d.images.map((src, i) => <div key={`${src}-${i}`} className="group relative aspect-[3/4] overflow-hidden rounded-md border" style={{ borderColor: i === 0 ? C.volt : C.line }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={src} alt="" className="h-full w-full object-cover" />
                {i === 0 && <span className="absolute left-1 top-1 rounded px-1.5 py-0.5 text-[9px] font-bold uppercase" style={{ background: C.volt, color: C.void }}>Главное</span>}
                <div className="absolute inset-x-1 bottom-1 flex justify-between gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                  <button onClick={() => moveImage(i, i - 1)} aria-label="Левее" className="grid h-6 w-6 place-items-center rounded text-[10px]" style={{ background: `${C.void}CC`, color: C.chalk }}>←</button>
                  <button onClick={() => set('images', d.images.filter((_, x) => x !== i))} aria-label="Удалить фото" className="grid h-6 w-6 place-items-center rounded" style={{ background: `${C.rose}E6`, color: C.void }}><Trash2 className="h-3 w-3" /></button>
                  <button onClick={() => moveImage(i, i + 1)} aria-label="Правее" className="grid h-6 w-6 place-items-center rounded text-[10px]" style={{ background: `${C.void}CC`, color: C.chalk }}>→</button>
                </div>
              </div>)}
            </div>}
          </section>

          <section className="grid gap-2 sm:grid-cols-3">
            <Toggle on={d.is_published} onChange={(v) => set('is_published', v)} label="Показывать на сайте" />
            <Toggle on={d.is_new} onChange={(v) => set('is_new', v)} label="Метка «Новинка»" color={C.azure} />
            <Toggle on={d.is_popular} onChange={(v) => set('is_popular', v)} label="Популярное" color={C.amber} />
          </section>

          <section className="rounded-lg border p-4" style={{ borderColor: C.line, background: C.raised }}>
            <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.16em]" style={{ color: C.mist }}>Предпросмотр карточки</p>
            <div className="flex gap-3">
              <Thumb src={d.images[0]} alt="" size="lg" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[10px] font-bold uppercase tracking-[0.14em]" style={{ color: C.mist }}>{brands.find((b) => b.id === d.brand_id)?.name ?? 'Бренд'}</p>
                <p className="mt-1 line-clamp-2 text-sm font-medium" style={{ color: C.chalk }}>{d.title || 'Название товара'}</p>
                <div className="mt-1.5 flex flex-wrap items-baseline gap-2">
                  <span className="font-bold tabular-nums" style={{ color: C.chalk }}>{money(d.price)}</span>
                  {discount > 0 && <><span className="text-xs line-through tabular-nums" style={{ color: C.mist }}>{money(d.old_price ?? 0)}</span><Pill color={C.signal}>−{discount}%</Pill></>}
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <Pill color={CONDITION_META[d.condition].color}>{CONDITION_META[d.condition].label}</Pill>
                  {d.is_new && <Pill color={C.volt}>Новинка</Pill>}
                  {!d.is_published && <Pill color={C.mist}>Скрыт</Pill>}
                </div>
              </div>
            </div>
          </section>
        </div>

        <div className="flex flex-wrap items-center gap-3 border-t p-4" style={{ borderColor: C.line }}>
          <span className="min-w-0 flex-1 truncate text-xs" style={{ color: C.mist }}>
            {Object.keys(errors).length ? `${Object.keys(errors).length} ${plural(Object.keys(errors).length, 'поле требует', 'поля требуют', 'полей требуют')} внимания` : 'Всё готово к сохранению'}
          </span>
          <Btn onClick={onClose}>Отмена</Btn>
          <Btn tone="primary" disabled={busy || uploading} onClick={submit}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            {mode === 'create' ? 'Создать товар' : 'Сохранить'}
          </Btn>
        </div>
      </aside>
    </div>
  );
}
