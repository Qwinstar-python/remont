'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';
import {
  ArrowRight, BadgeCheck, Check, ChevronLeft, ChevronRight, Heart, Info,
  Loader2, Maximize2, Minus, Plus, RefreshCcw, Ruler, Share2, ShieldCheck,
  ShoppingBag, Truck, X, ZoomIn, ZoomOut
} from 'lucide-react';

type Condition = 'new' | 'excellent' | 'good' | 'fair';
type Product = {
  id: number; title: string; slug: string; description: string | null;
  price: number; old_price: number | null; brand_id: number | null; category_id: number | null;
  condition: Condition; sizes: string[]; colors: string[]; images: string[];
  stock: number; is_new: boolean; is_popular: boolean; is_published: boolean; created_at: string;
};
type Brand = { id: number; name: string; slug: string };
type Category = { id: number; name: string; slug: string; image_url: string | null; sort_order: number };
type Bundle = { product: Product | null; brands: Brand[]; categories: Category[]; related: Product[] };
type Toast = { id: number; title: string; desc?: string; tone: 'ok' | 'warn' };

const CART_KEY = 'reform-cart-v1';
const WISH_KEY = 'reform-wishlist-v1';
const FREE_FROM = 10000;

const SIZE_ORDER = ['ONE SIZE','XS','S','M','L','XL','XXL','30','31','32','33','34','36','38','39','40','41','42','43','44','45','46'];

const CONDITIONS: Record<Condition, { label: string; short: string; note: string; cls: string }> = {
  new:       { label: 'Новый с биркой',     short: 'Новый',    note: 'Не носился, бирки и упаковка на месте.', cls: 'bg-success/10 text-success border-success/30' },
  excellent: { label: 'Отличное состояние', short: 'Отличное', note: 'Минимальные следы носки, дефектов нет.', cls: 'bg-info/10 text-info border-info/30' },
  good:      { label: 'Хорошее состояние',  short: 'Хорошее',  note: 'Заметная носка, все дефекты показаны на фото.', cls: 'bg-warning/10 text-warning border-warning/30' },
  fair:      { label: 'Удовлетворительное', short: 'С ноской', note: 'Выраженные следы носки, отражено в цене.', cls: 'bg-danger/10 text-danger border-danger/30' }
};

const GUIDES: Record<string, { cols: string[]; rows: string[][] }> = {
  outerwear: { cols: ['Размер','Грудь, см','Длина, см','Плечи, см'], rows: [['S','104','68','45'],['M','110','70','47'],['L','116','72','49'],['XL','122','74','51']] },
  hoodies:   { cols: ['Размер','Грудь, см','Длина, см','Рукав, см'], rows: [['S','108','67','62'],['M','114','69','64'],['L','120','71','66'],['XL','126','73','68']] },
  't-shirts':{ cols: ['Размер','Грудь, см','Длина, см'], rows: [['S','100','68'],['M','106','70'],['L','112','72'],['XL','118','74']] },
  shirts:    { cols: ['Размер','Грудь, см','Длина, см','Воротник, см'], rows: [['M','108','74','39'],['L','114','76','41'],['XL','120','78','43']] },
  pants:     { cols: ['Размер','Талия, см','Бёдра, см','Длина, см'], rows: [['30','78','98','104'],['31','80','100','105'],['32','83','103','106'],['34','88','108','107']] },
  shoes:     { cols: ['Размер RU','Стопа, см','EU','US'], rows: [['39','25.0','40','7'],['40','25.5','41','8'],['41','26.5','42','9'],['42','27.0','43','9.5'],['43','28.0','44','10']] }
};

const I = (id: string, w = 1200) => `https://images.unsplash.com/${id}?q=80&w=${w}&auto=format&fit=crop`;
const D = (n: number) => new Date(Date.now() - n * 864e5).toISOString();

const BRANDS: Brand[] = [
  { id: 1, name: 'Stone Island', slug: 'stone-island' },
  { id: 2, name: 'Carhartt WIP', slug: 'carhartt-wip' },
  { id: 3, name: 'The North Face', slug: 'the-north-face' },
  { id: 4, name: 'Nike', slug: 'nike' },
  { id: 5, name: 'Adidas', slug: 'adidas' },
  { id: 6, name: 'Stüssy', slug: 'stussy' },
  { id: 7, name: 'Ralph Lauren', slug: 'ralph-lauren' },
  { id: 8, name: 'Acne Studios', slug: 'acne-studios' }
];

const CATEGORIES: Category[] = [
  { id: 1, name: 'Верхняя одежда', slug: 'outerwear', image_url: I('photo-1445205170230-053b83016050'), sort_order: 1 },
  { id: 2, name: 'Футболки', slug: 't-shirts', image_url: I('photo-1523381210434-271e8be1f52b'), sort_order: 2 },
  { id: 3, name: 'Худи и свитшоты', slug: 'hoodies', image_url: I('photo-1556821840-3a63f95609a7'), sort_order: 3 },
  { id: 4, name: 'Рубашки', slug: 'shirts', image_url: I('photo-1596755094514-f87e34085b2c'), sort_order: 4 },
  { id: 5, name: 'Джинсы и брюки', slug: 'pants', image_url: I('photo-1542272604-787c3835535d'), sort_order: 5 },
  { id: 6, name: 'Обувь', slug: 'shoes', image_url: I('photo-1549298916-b41d501d3772'), sort_order: 6 },
  { id: 7, name: 'Аксессуары', slug: 'accessories', image_url: I('photo-1553062407-98eeb64c6a62'), sort_order: 7 }
];

const mk = (
  id: number, title: string, slug: string, brand_id: number, category_id: number,
  price: number, old_price: number | null, condition: Condition, sizes: string[],
  colors: string[], imgs: string[], stock: number, is_new: boolean, is_popular: boolean,
  age: number, description: string
): Product => ({
  id, title, slug, description, price, old_price, brand_id, category_id, condition,
  sizes, colors, images: imgs.map((x) => I(x)), stock, is_new, is_popular,
  is_published: true, created_at: D(age)
});

const PRODUCTS: Product[] = [
  mk(1,'Куртка Stone Island Ghost Piece','stone-island-ghost-piece',1,1,42900,51900,'excellent',['S','M','L'],['Чёрный'],['photo-1591047139829-d91aecb6caea','photo-1551028719-00167b16eac5'],1,true,true,1,'Куртка из коллекции Ghost Piece в монохромном чёрном исполнении. Плотный хлопковый габардин, съёмный капюшон, фирменный патч-компас на рукаве. Состояние отличное: без пятен, потёртостей и следов ремонта, вся фурнитура оригинальная.'),
  mk(2,'Худи Carhartt WIP Hooded Chase','carhartt-hooded-chase',2,3,8900,null,'new',['S','M','L','XL'],['Серый'],['photo-1556821840-3a63f95609a7','photo-1578932750294-f5075e85f44a'],3,true,false,2,'Худи из плотного футера с начёсом (310 г/м²). Вышитый логотип на груди, карман-кенгуру, рифлёные манжеты. Новое с биркой, ни разу не надевалось.'),
  mk(3,'Пуховик The North Face Nuptse 1996','tnf-nuptse-1996',3,1,24500,29900,'excellent',['M','L'],['Чёрный'],['photo-1544022613-e87ca75a784a','photo-1539533018447-63fcce2678e3'],1,false,true,4,'Легендарный пуховик Nuptse в винтажном крое 1996 года. Натуральный пух 700 fill, водонепроницаемая ткань ripstop. Отличное состояние: пух распределён равномерно, молнии работают идеально.'),
  mk(4,'Кроссовки Nike Air Max 90','nike-air-max-90',4,6,11900,null,'good',['40','41','42','43'],['Белый'],['photo-1600185365483-26d7a4cc7519','photo-1595950653106-6c9ebd614d3a'],2,false,true,6,'Классические Air Max 90 в белой расцветке. Видимая воздушная подушка, кожаный верх. Хорошее состояние: небольшие следы носки на подошве, верх чистый, без заломов.'),
  mk(5,'Футболка Stüssy Basic Logo','stussy-basic-logo',6,2,4500,null,'new',['S','M','L'],['Белый'],['photo-1521572163474-6864f9cf17ab','photo-1576566588028-4147f3842f27'],4,true,false,1,'Базовая футболка Stüssy с фирменным логотипом на груди. Плотный хлопок 240 г/м², свободный крой. Новая с биркой.'),
  mk(6,'Рубашка Ralph Lauren Oxford','ralph-lauren-oxford',7,4,7900,9900,'excellent',['M','L','XL'],['Голубой'],['photo-1596755094514-f87e34085b2c','photo-1602810318383-e386cc2a3ccf'],2,false,false,8,'Рубашка из хлопка oxford с классической вышивкой Polo на груди. Перламутровые пуговицы, крой regular fit. Отличное состояние после профессиональной чистки.'),
  mk(7,'Джинсы Acne Studios 1996','acne-studios-1996',8,5,15900,null,'good',['30','31','32'],['Синий'],['photo-1542272604-787c3835535d','photo-1541099649105-f69ad21f3246'],1,false,false,10,'Джинсы прямого кроя из японского денима 12.5 oz. Винтажная стирка, средняя посадка. Хорошее состояние: естественные потёртости, без дыр и пятен.'),
  mk(8,'Свитшот Adidas Originals Trefoil','adidas-trefoil-sweatshirt',5,3,6500,null,'excellent',['S','M','L'],['Чёрный'],['photo-1556306535-0f09a537f0a3','photo-1578681994506-b8f463449011'],2,false,true,3,'Свитшот из мягкого футера с вышитым логотипом Trefoil. Рифлёные манжеты и подол, круглый вырез. Отличное состояние, без катышков.'),
  mk(9,'Кроссовки Adidas Samba OG','adidas-samba-og',5,6,10900,12900,'new',['39','40','41','42'],['Белый'],['photo-1600269452121-4f2416e55c28','photo-1560769629-975ec94e6a86'],3,true,true,2,'Samba OG — силуэт, который не выходит из моды. Кожаный верх, замшевые три полоски, культовая резиновая подошва. Новые, с оригинальной коробкой.'),
  mk(10,'Куртка Carhartt WIP Detroit Jacket','carhartt-detroit-jacket',2,1,13500,null,'good',['M','L'],['Бежевый'],['photo-1520975954732-35dd22299614','photo-1525507119028-ed4c629a60a3'],1,false,false,12,'Куртка Detroit из канваса duck cotton с подкладкой из одеяла. Вельветовый воротник, карманы с клапанами. Хорошее состояние: красивая патина, швы целые.'),
  mk(11,'Футболка The North Face Simple Dome','tnf-simple-dome',3,2,3200,null,'new',['S','M','L','XL'],['Чёрный'],['photo-1583743814966-8936f5b7be1a','photo-1581655353564-df123a1eb820'],5,true,false,1,'Футболка из мягкого хлопка с логотипом Simple Dome на груди. Классический крой, плотность 180 г/м². Новая с биркой.'),
  mk(12,'Сумка Carhartt WIP Essentials','carhartt-essentials-bag',2,7,5500,null,'excellent',['ONE SIZE'],['Чёрный'],['photo-1553062407-98eeb64c6a62','photo-1548036328-c9fa89d128fa'],2,false,false,5,'Сумка Essentials через плечо: два отделения, регулируемый ремень, водоотталкивающая ткань. Отличное состояние, фурнитура работает идеально.')
];

const money = (n: number) => new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 }).format(n) + ' ₽';
const salePct = (p: Product) => p.old_price && p.old_price > p.price ? Math.round((1 - p.price / p.old_price) * 100) : 0;
const clampQty = (q: number, stock: number) => Math.max(1, Math.min(Math.trunc(q) || 1, Math.max(1, stock)));

function sortSizes(sizes: string[]): string[] {
  return Array.from(new Set(sizes)).sort((a, b) => {
    const ai = SIZE_ORDER.indexOf(a), bi = SIZE_ORDER.indexOf(b);
    if (ai === -1 && bi === -1) return a.localeCompare(b, 'ru');
    if (ai === -1) return 1;
    if (bi === -1) return -1;
    return ai - bi;
  });
}

function pickRelated(all: Product[], current: Product, limit = 4): Product[] {
  const pool = all.filter((p) => p.is_published && p.id !== current.id);
  const sameCat = pool.filter((p) => p.category_id === current.category_id);
  const rest = pool.filter((p) => !sameCat.includes(p));
  const sameBrand = rest.filter((p) => p.brand_id === current.brand_id);
  const other = rest.filter((p) => !sameBrand.includes(p));
  return [...sameCat, ...sameBrand, ...other].slice(0, limit);
}

async function loadBundle(slug: string): Promise<Bundle> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    const product = PRODUCTS.find((p) => p.slug === slug) ?? null;
    return { product, brands: BRANDS, categories: CATEGORIES, related: product ? pickRelated(PRODUCTS, product) : [] };
  }

  const supabase = createClient(url, key);
  const cols = 'id,title,slug,description,price,old_price,brand_id,category_id,condition,sizes,colors,images,stock,is_new,is_popular,is_published,created_at';

  const [one, b, c] = await Promise.all([
    supabase.from('products').select(cols).eq('is_published', true).eq('slug', slug).maybeSingle(),
    supabase.from('brands').select('id,name,slug').order('name'),
    supabase.from('categories').select('id,name,slug,image_url,sort_order').order('sort_order')
  ]);
  if (one.error) throw new Error(one.error.message);
  if (b.error) throw new Error(b.error.message);
  if (c.error) throw new Error(c.error.message);

  const norm = (x: any): Product => ({
    ...x,
    price: Number(x.price),
    old_price: x.old_price == null ? null : Number(x.old_price),
    sizes: Array.isArray(x.sizes) ? x.sizes : [],
    colors: Array.isArray(x.colors) ? x.colors : [],
    images: Array.isArray(x.images) ? x.images : []
  });

  const product = one.data ? norm(one.data) : null;
  let related: Product[] = [];
  if (product) {
    const { data: rel, error: relErr } = await supabase
      .from('products').select(cols)
      .eq('is_published', true).neq('id', product.id)
      .order('created_at', { ascending: false }).limit(24);
    if (relErr) throw new Error(relErr.message);
    related = pickRelated((rel ?? []).map(norm), product);
  }

  return { product, brands: (b.data ?? []) as Brand[], categories: (c.data ?? []) as Category[], related };
}

function readWishlist(): number[] {
  try {
    const raw = localStorage.getItem(WISH_KEY);
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list.map(Number).filter((n) => Number.isFinite(n)) : [];
  } catch { return []; }
}
function writeWishlist(ids: number[]) {
  try { localStorage.setItem(WISH_KEY, JSON.stringify(ids)); } catch { /* ignore */ }
  window.dispatchEvent(new Event('reform-wishlist-updated'));
}

export default function ProductPage() {
  const params = useParams<{ slug: string }>();
  const rawSlug = params?.slug;
  const slug = Array.isArray(rawSlug) ? rawSlug[0] : rawSlug ?? '';

  const [bundle, setBundle] = useState<Bundle | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const [imgIndex, setImgIndex] = useState(0);
  const [zoom, setZoom] = useState(false);
  const [lightbox, setLightbox] = useState(false);
  const [size, setSize] = useState<string | null>(null);
  const [color, setColor] = useState<string | null>(null);
  const [qty, setQty] = useState(1);
  const [wish, setWish] = useState(false);
  const [tab, setTab] = useState<'desc' | 'condition' | 'delivery'>('desc');
  const [guideOpen, setGuideOpen] = useState(false);
  const [selectionError, setSelectionError] = useState('');
  const [adding, setAdding] = useState(false);
  const [added, setAdded] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timers = useRef<number[]>([]);
  const touchX = useRef<number | null>(null);

  const load = useCallback(async () => {
    if (!slug) return;
    setLoading(true); setError('');
    try {
      const data = await loadBundle(slug);
      setBundle(data);
      setImgIndex(0); setZoom(false); setQty(1); setSelectionError(''); setAdded(false);
      const p = data.product;
      setSize(p && p.sizes.length === 1 ? p.sizes[0] : null);
      setColor(p && p.colors.length === 1 ? p.colors[0] : null);
      setWish(p ? readWishlist().includes(p.id) : false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось загрузить товар');
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => { void load(); }, [load]);

  const product = bundle?.product ?? null;
  const images = useMemo(() => product?.images ?? [], [product]);

  useEffect(() => {
    const sync = () => { if (product) setWish(readWishlist().includes(product.id)); };
    window.addEventListener('reform-wishlist-updated', sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener('reform-wishlist-updated', sync);
      window.removeEventListener('storage', sync);
    };
  }, [product]);

  useEffect(() => () => { timers.current.forEach((t) => window.clearTimeout(t)); }, []);

  useEffect(() => {
    document.body.style.overflow = lightbox || guideOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [lightbox, guideOpen]);

  const goImage = useCallback((i: number) => {
    if (images.length === 0) return;
    setImgIndex(Math.max(0, Math.min(i, images.length - 1)));
    setZoom(false);
  }, [images.length]);

  const nextImage = useCallback(() => {
    if (images.length === 0) return;
    setImgIndex((i) => (i + 1) % images.length);
    setZoom(false);
  }, [images.length]);

  const prevImage = useCallback(() => {
    if (images.length === 0) return;
    setImgIndex((i) => (i - 1 + images.length) % images.length);
    setZoom(false);
  }, [images.length]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setLightbox(false); setGuideOpen(false); setZoom(false); return; }
      if (images.length < 2) return;
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      if (e.key === 'ArrowRight') nextImage();
      if (e.key === 'ArrowLeft') prevImage();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [images.length, nextImage, prevImage]);

  const pushToast = useCallback((title: string, desc?: string, tone: 'ok' | 'warn' = 'ok') => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t.slice(-2), { id, title, desc, tone }]);
    const timer = window.setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3400);
    timers.current.push(timer);
  }, []);

  const brand = useMemo(() => bundle?.brands.find((b) => b.id === product?.brand_id) ?? null, [bundle, product]);
  const category = useMemo(() => bundle?.categories.find((c) => c.id === product?.category_id) ?? null, [bundle, product]);
  const sortedSizes = useMemo(() => sortSizes(product?.sizes ?? []), [product]);
  const guide = category ? GUIDES[category.slug] ?? null : null;
  const discount = product ? salePct(product) : 0;
  const soldOut = !product || product.stock <= 0;
  const freeDelivery = product ? product.price * qty >= FREE_FROM : false;

  const toggleWish = () => {
    if (!product) return;
    const list = readWishlist();
    const next = list.includes(product.id) ? list.filter((x) => x !== product.id) : [...list, product.id];
    writeWishlist(next);
    setWish(next.includes(product.id));
    pushToast(next.includes(product.id) ? 'Добавлено в избранное' : 'Убрано из избранного', product.title);
  };

  const share = async () => {
    if (!product) return;
    const url = window.location.href;
    try {
      if (navigator.share) {
        await navigator.share({ title: product.title, text: `${brand?.name ?? ''} ${product.title}`.trim(), url });
        return;
      }
      await navigator.clipboard.writeText(url);
      pushToast('Ссылка скопирована', product.title);
    } catch { /* user cancelled */ }
  };

  const addToCart = async (buyNow = false) => {
    if (!product) return;
    if (soldOut) { pushToast('Товар продан', 'Загляните в похожие вещи ниже', 'warn'); return; }
    if (product.sizes.length > 0 && !size) {
      setSelectionError('Выберите размер');
      document.getElementById('size-picker')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      pushToast('Выберите размер', undefined, 'warn');
      return;
    }
    if (product.colors.length > 0 && !color) {
      setSelectionError('Выберите цвет');
      pushToast('Выберите цвет', undefined, 'warn');
      return;
    }
    if (qty > product.stock) {
      setSelectionError(`В наличии только ${product.stock} шт.`);
      pushToast('Недостаточно остатка', `Доступно ${product.stock} шт.`, 'warn');
      return;
    }

    setSelectionError('');
    setAdding(true);
    try {
      const raw = localStorage.getItem(CART_KEY);
      const parsed = raw ? JSON.parse(raw) : { state: { items: [] }, version: 0 };
      const items = Array.isArray(parsed?.state?.items) ? parsed.state.items : [];
      const key = `${product.id}::${size ?? ''}::${color ?? ''}`;
      const existing = items.find((x: any) => x.key === key);
      if (existing) {
        existing.quantity = Math.min(Number(existing.quantity || 0) + qty, product.stock);
      } else {
        items.push({
          key, product_id: product.id, slug: product.slug, title: product.title,
          brand: brand?.name ?? '', price: product.price, image: product.images[0] ?? null,
          size, color, quantity: Math.min(qty, product.stock), stock: product.stock
        });
      }
      localStorage.setItem(CART_KEY, JSON.stringify({ state: { items }, version: 0 }));
      window.dispatchEvent(new Event('reform-cart-updated'));
      setAdded(true);
      timers.current.push(window.setTimeout(() => setAdded(false), 2200));
      pushToast(buyNow ? 'Переходим к оформлению' : 'Добавлено в корзину', `${product.title}${size ? ` · ${size}` : ''}`);
      if (buyNow) timers.current.push(window.setTimeout(() => { window.location.href = '/checkout'; }, 500));
    } catch {
      pushToast('Не удалось добавить товар', 'Проверьте настройки браузера', 'warn');
    } finally {
      setAdding(false);
    }
  };

  if (loading) return <ProductSkeleton />;

  if (error) {
    return (
      <div className="mx-auto grid min-h-[60vh] max-w-[1440px] place-items-center px-4">
        <div className="text-center">
          <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-danger/10"><Info className="h-7 w-7 text-danger" /></div>
          <h1 className="mt-5 text-2xl font-medium tracking-tight">Товар не загрузился</h1>
          <p className="mx-auto mt-2 max-w-md text-sm text-mute">{error}</p>
          <button onClick={() => void load()} className="mt-6 inline-flex h-11 items-center gap-2 bg-ink px-6 text-[11px] font-semibold uppercase tracking-[0.18em] text-paper transition hover:bg-accent">
            <RefreshCcw className="h-4 w-4" /> Попробовать снова
          </button>
        </div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="mx-auto grid min-h-[60vh] max-w-[1440px] place-items-center px-4">
        <div className="text-center">
          <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-paper"><ShoppingBag className="h-7 w-7 text-mute" /></div>
          <h1 className="mt-5 text-2xl font-medium tracking-tight">Товар не найден</h1>
          <p className="mx-auto mt-2 max-w-md text-sm text-mute">Возможно, вещь уже продана или ссылка устарела. Похожие позиции есть в каталоге.</p>
          <Link href="/catalog" className="mt-6 inline-flex h-11 items-center gap-2 bg-ink px-6 text-[11px] font-semibold uppercase tracking-[0.18em] text-paper transition hover:bg-accent">
            В каталог <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    );
  }

  const cond = CONDITIONS[product.condition];

  return (
    <div className="mx-auto max-w-[1440px] px-4 pb-28 sm:px-6 lg:px-10 lg:pb-4">
      <nav aria-label="Навигация" className="flex flex-wrap items-center gap-2 pt-2 text-[11px] uppercase tracking-[0.16em] text-mute">
        <Link href="/" className="transition hover:text-ink">Главная</Link>
        <ChevronRight className="h-3 w-3" />
        <Link href="/catalog" className="transition hover:text-ink">Каталог</Link>
        {category && (
          <>
            <ChevronRight className="h-3 w-3" />
            <Link href={`/catalog?category=${category.slug}`} className="transition hover:text-ink">{category.name}</Link>
          </>
        )}
        <ChevronRight className="h-3 w-3" />
        <span className="max-w-[200px] truncate text-ink-soft">{product.title}</span>
      </nav>

      <div className="mt-6 grid gap-10 lg:grid-cols-[minmax(0,1fr)_460px] lg:gap-14">
        <section>
          <div className="lg:sticky lg:top-28">
            <div className="flex gap-4">
              {images.length > 1 && (
                <div className="hidden w-20 shrink-0 flex-col gap-3 sm:flex">
                  {images.map((src, i) => (
                    <button key={i} onClick={() => goImage(i)} aria-label={`Фото ${i + 1}`}
                      className={`relative aspect-[3/4] overflow-hidden border transition-all duration-300 ${i === imgIndex ? 'border-ink ring-1 ring-ink' : 'border-line opacity-60 hover:opacity-100'}`}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={src} alt="" loading="lazy" className="h-full w-full object-cover" />
                    </button>
                  ))}
                </div>
              )}

              <div className="min-w-0 flex-1">
                <div className="group relative aspect-[3/4] overflow-hidden bg-line/40"
                  onTouchStart={(e) => { touchX.current = e.touches[0].clientX; }}
                  onTouchEnd={(e) => {
                    if (touchX.current == null || images.length < 2) return;
                    const dx = e.changedTouches[0].clientX - touchX.current;
                    if (Math.abs(dx) > 50) { if (dx < 0) nextImage(); else prevImage(); }
                    touchX.current = null;
                  }}>
                  {images[imgIndex] ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={images[imgIndex]} alt={`${product.title} — фото ${imgIndex + 1}`}
                      onClick={() => setZoom((z) => !z)}
                      className={`h-full w-full object-cover transition-transform duration-500 ease-out ${zoom ? 'scale-[1.9] cursor-zoom-out' : 'cursor-zoom-in'}`} />
                  ) : (
                    <div className="grid h-full place-items-center text-xs uppercase tracking-[0.2em] text-mute">Нет фото</div>
                  )}

                  <div className="pointer-events-none absolute left-4 top-4 flex flex-col gap-2">
                    {product.is_new && <span className="bg-ink px-3 py-1.5 text-[9px] font-medium uppercase tracking-[0.2em] text-paper">Новинка</span>}
                    {discount > 0 && <span className="bg-accent px-3 py-1.5 text-[9px] font-medium uppercase tracking-[0.2em] text-white">−{discount}%</span>}
                    {soldOut && <span className="bg-surface/95 px-3 py-1.5 text-[9px] font-medium uppercase tracking-[0.2em] text-ink">Продано</span>}
                  </div>

                  <div className="absolute right-4 top-4 flex flex-col gap-2">
                    <button onClick={toggleWish} aria-label={wish ? 'Убрать из избранного' : 'В избранное'}
                      className={`grid h-10 w-10 place-items-center border backdrop-blur transition ${wish ? 'border-accent bg-accent text-white' : 'border-line bg-surface/90 text-ink hover:border-ink'}`}>
                      <Heart className={`h-4 w-4 ${wish ? 'fill-current' : ''}`} />
                    </button>
                    <button onClick={() => setLightbox(true)} aria-label="Открыть на весь экран"
                      className="grid h-10 w-10 place-items-center border border-line bg-surface/90 backdrop-blur transition hover:border-ink">
                      <Maximize2 className="h-4 w-4" />
                    </button>
                    <button onClick={() => setZoom((z) => !z)} aria-label={zoom ? 'Уменьшить' : 'Увеличить'}
                      className="grid h-10 w-10 place-items-center border border-line bg-surface/90 backdrop-blur transition hover:border-ink">
                      {zoom ? <ZoomOut className="h-4 w-4" /> : <ZoomIn className="h-4 w-4" />}
                    </button>
                  </div>

                  {images.length > 1 && (
                    <>
                      <button onClick={prevImage} aria-label="Предыдущее фото"
                        className="absolute left-3 top-1/2 grid h-11 w-11 -translate-y-1/2 place-items-center border border-line bg-surface/90 opacity-0 backdrop-blur transition group-hover:opacity-100 hover:border-ink">
                        <ChevronLeft className="h-5 w-5" />
                      </button>
                      <button onClick={nextImage} aria-label="Следующее фото"
                        className="absolute right-3 top-1/2 grid h-11 w-11 -translate-y-1/2 place-items-center border border-line bg-surface/90 opacity-0 backdrop-blur transition group-hover:opacity-100 hover:border-ink">
                        <ChevronRight className="h-5 w-5" />
                      </button>
                      <div className="absolute bottom-4 left-1/2 flex -translate-x-1/2 gap-1.5">
                        {images.map((_, i) => (
                          <button key={i} onClick={() => goImage(i)} aria-label={`Перейти к фото ${i + 1}`}
                            className={`h-1.5 rounded-full transition-all ${i === imgIndex ? 'w-6 bg-ink' : 'w-1.5 bg-ink/30 hover:bg-ink/60'}`} />
                        ))}
                      </div>
                    </>
                  )}
                </div>

                {images.length > 1 && (
                  <div className="no-scrollbar mt-3 flex gap-2 overflow-x-auto sm:hidden">
                    {images.map((src, i) => (
                      <button key={i} onClick={() => goImage(i)} aria-label={`Фото ${i + 1}`}
                        className={`relative h-20 w-16 shrink-0 overflow-hidden border transition ${i === imgIndex ? 'border-ink' : 'border-line opacity-60'}`}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={src} alt="" loading="lazy" className="h-full w-full object-cover" />
                      </button>
                    ))}
                  </div>
                )}

                <p className="mt-3 flex items-center gap-2 text-xs text-mute">
                  <Info className="h-3.5 w-3.5 shrink-0" /> Реальные фото этой вещи. Нажмите на снимок, чтобы увеличить.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section>
          <div className="flex flex-wrap items-center gap-3">
            {brand && (
              <Link href={`/catalog?brand=${brand.slug}`} className="text-[11px] font-semibold uppercase tracking-[0.24em] text-accent transition hover:text-accent-deep">
                {brand.name}
              </Link>
            )}
            <span className={`inline-flex items-center gap-1.5 border px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.14em] ${cond.cls}`}>
              <BadgeCheck className="h-3 w-3" /> {cond.short}
            </span>
          </div>

          <h1 className="mt-3 text-3xl font-medium leading-tight tracking-tight sm:text-4xl">{product.title}</h1>

          <div className="mt-5 flex flex-wrap items-end gap-3">
            <span className="text-3xl font-semibold tracking-tight">{money(product.price)}</span>
            {product.old_price && product.old_price > product.price && (
              <>
                <span className="pb-1 text-base text-mute line-through">{money(product.old_price)}</span>
                <span className="mb-1 bg-accent/10 px-2 py-0.5 text-xs font-semibold text-accent">выгода {money(product.old_price - product.price)}</span>
              </>
            )}
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
            {soldOut ? (
              <span className="flex items-center gap-1.5 text-danger"><span className="h-1.5 w-1.5 rounded-full bg-danger" /> Продано</span>
            ) : product.stock <= 1 ? (
              <span className="flex items-center gap-1.5 text-warning"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-warning" /> Последний экземпляр</span>
            ) : (
              <span className="flex items-center gap-1.5 text-success"><span className="h-1.5 w-1.5 rounded-full bg-success" /> В наличии · {product.stock} шт.</span>
            )}
            <span className="text-mute">Артикул RF-{String(product.id).padStart(4, '0')}</span>
          </div>

          {sortedSizes.length > 0 && (
            <div id="size-picker" className="mt-7 scroll-mt-28">
              <div className="mb-3 flex items-center justify-between gap-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em]">Размер {size && <span className="text-accent">· {size}</span>}</p>
                {guide && (
                  <button onClick={() => setGuideOpen(true)} className="inline-flex shrink-0 items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.14em] text-mute transition hover:text-ink">
                    <Ruler className="h-3.5 w-3.5" /> Таблица размеров
                  </button>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                {sortedSizes.map((s) => (
                  <button key={s} onClick={() => { setSize(s); setSelectionError(''); }} disabled={soldOut}
                    className={`h-11 min-w-12 border px-3 text-sm font-medium transition-all duration-200 ${size === s ? 'border-ink bg-ink text-paper shadow-md' : 'border-line bg-surface hover:border-ink'} disabled:cursor-not-allowed disabled:opacity-40`}>
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {product.colors.length > 0 && (
            <div className="mt-6">
              <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.2em]">Цвет {color && <span className="text-accent">· {color}</span>}</p>
              <div className="flex flex-wrap gap-2">
                {product.colors.map((c) => (
                  <button key={c} onClick={() => { setColor(c); setSelectionError(''); }} disabled={soldOut}
                    className={`h-10 border px-4 text-sm transition-all duration-200 ${color === c ? 'border-ink bg-ink text-paper' : 'border-line bg-surface hover:border-ink'} disabled:cursor-not-allowed disabled:opacity-40`}>
                    {c}
                  </button>
                ))}
              </div>
            </div>
          )}

          {!soldOut && (
            <div className="mt-6 flex flex-wrap items-center gap-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em]">Количество</p>
              <div className="inline-flex h-11 items-center border border-line bg-surface">
                <button onClick={() => setQty((q) => clampQty(q - 1, product.stock))} disabled={qty <= 1} aria-label="Уменьшить"
                  className="grid h-full w-10 place-items-center transition hover:bg-ink/5 disabled:cursor-not-allowed disabled:opacity-30">
                  <Minus className="h-3.5 w-3.5" />
                </button>
                <span className="w-10 text-center text-sm font-medium tabular-nums">{qty}</span>
                <button onClick={() => setQty((q) => clampQty(q + 1, product.stock))} disabled={qty >= product.stock} aria-label="Увеличить"
                  className="grid h-full w-10 place-items-center transition hover:bg-ink/5 disabled:cursor-not-allowed disabled:opacity-30">
                  <Plus className="h-3.5 w-3.5" />
                </button>
              </div>
              <span className="text-sm text-mute">Итого {money(product.price * qty)}</span>
            </div>
          )}

          {selectionError && (
            <p className="mt-4 flex items-center gap-2 border border-danger/30 bg-danger/5 px-4 py-2.5 text-sm text-danger">
              <Info className="h-4 w-4 shrink-0" /> {selectionError}
            </p>
          )}

          <div className="mt-7 space-y-3">
            <button onClick={() => void addToCart(false)} disabled={soldOut || adding}
              className={`flex h-14 w-full items-center justify-center gap-2 text-[11px] font-semibold uppercase tracking-[0.2em] transition-all duration-300 disabled:cursor-not-allowed ${added ? 'bg-success text-white' : soldOut ? 'bg-line text-mute' : 'bg-ink text-paper hover:bg-accent'}`}>
              {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : added ? <Check className="h-4 w-4" /> : <ShoppingBag className="h-4 w-4" />}
              {soldOut ? 'Продано' : added ? 'Добавлено в корзину' : `В корзину · ${money(product.price * qty)}`}
            </button>
            <div className="grid grid-cols-2 gap-3">
              <button onClick={() => void addToCart(true)} disabled={soldOut || adding}
                className="flex h-12 items-center justify-center border border-ink text-[11px] font-semibold uppercase tracking-[0.16em] transition hover:bg-ink hover:text-paper disabled:cursor-not-allowed disabled:border-line disabled:text-mute">
                Купить сейчас
              </button>
              <button onClick={() => void share()}
                className="flex h-12 items-center justify-center gap-2 border border-line bg-surface text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-soft transition hover:border-ink hover:text-ink">
                <Share2 className="h-4 w-4" /> Поделиться
              </button>
            </div>
            <Link href="/cart" className="flex h-10 items-center justify-center gap-2 text-[11px] font-medium uppercase tracking-[0.16em] text-mute transition hover:text-ink">
              Перейти в корзину <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          <div className="mt-7 grid gap-px border border-line bg-line sm:grid-cols-2">
            {[
              { icon: ShieldCheck, t: 'Проверено', d: 'Аутентичность подтверждена' },
              { icon: Truck, t: freeDelivery ? 'Бесплатно' : 'Доставка 2–5 дней', d: freeDelivery ? 'Курьер по Москве' : `Бесплатно от ${money(FREE_FROM)}` },
              { icon: RefreshCcw, t: 'Возврат 14 дней', d: 'Если вещь не подошла' },
              { icon: BadgeCheck, t: 'Честное описание', d: 'Все дефекты на фото' }
            ].map((x) => (
              <div key={x.t} className="flex items-start gap-3 bg-surface p-4">
                <x.icon className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-[0.12em]">{x.t}</p>
                  <p className="mt-0.5 text-xs text-mute">{x.d}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>

      <section className="mt-16 border-t border-line pt-10">
        <div className="no-scrollbar flex gap-2 overflow-x-auto">
          {([['desc','Описание'],['condition','Состояние и проверка'],['delivery','Доставка и возврат']] as const).map(([id, label]) => (
            <button key={id} onClick={() => setTab(id)}
              className={`h-11 shrink-0 border px-5 text-[11px] font-semibold uppercase tracking-[0.16em] transition ${tab === id ? 'border-ink bg-ink text-paper' : 'border-line bg-surface hover:border-ink'}`}>
              {label}
            </button>
          ))}
        </div>

        <div className="mt-6 animate-fade-in border border-line bg-surface p-6 sm:p-8">
          {tab === 'desc' && (
            <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_300px]">
              <div>
                <h2 className="text-lg font-medium tracking-tight">Об этой вещи</h2>
                <p className="mt-4 whitespace-pre-line leading-relaxed text-ink-soft">
                  {product.description || 'Оригинальная вещь. Проверена на подлинность. Дополнительные фото и замеры — по запросу.'}
                </p>
                <p className="mt-4 text-sm text-mute">
                  Нужны точные замеры или дополнительные фото? Напишите нам — ответим в течение часа и пришлём всё, что нужно для уверенной покупки.
                </p>
              </div>
              <dl className="h-fit space-y-3 border border-line bg-paper p-5 text-sm">
                {[
                  ['Бренд', brand?.name ?? '—'],
                  ['Категория', category?.name ?? '—'],
                  ['Размеры', sortedSizes.join(', ') || '—'],
                  ['Цвет', product.colors.join(', ') || '—'],
                  ['Состояние', cond.label],
                  ['Артикул', `RF-${String(product.id).padStart(4, '0')}`]
                ].map(([k, v]) => (
                  <div key={k} className="flex justify-between gap-4">
                    <dt className="shrink-0 text-mute">{k}</dt>
                    <dd className="text-right font-medium">{v}</dd>
                  </div>
                ))}
              </dl>
            </div>
          )}

          {tab === 'condition' && (
            <div className="grid gap-8 lg:grid-cols-2">
              <div>
                <span className={`inline-flex items-center gap-2 border px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] ${cond.cls}`}>
                  <BadgeCheck className="h-3.5 w-3.5" /> {cond.label}
                </span>
                <p className="mt-4 leading-relaxed text-ink-soft">{cond.note}</p>
                <p className="mt-4 text-sm text-mute">
                  Мы фотографируем каждую вещь при дневном свете и отдельно снимаем все особенности: потёртости, следы стирки, состояние фурнитуры и подошвы. Скрытых дефектов не бывает — если что-то есть, это видно на фото и указано в описании.
                </p>
              </div>
              <ol className="space-y-4">
                {[
                  ['Проверка подлинности', 'Сверяем бирки, швы, фурнитуру и артикул с эталонными образцами бренда.'],
                  ['Оценка состояния', 'Фиксируем степень носки по четырёхбалльной шкале и описываем каждый дефект.'],
                  ['Чистка и подготовка', 'Профессиональная чистка, отпаривание, замена недостающих пуговиц.'],
                  ['Контроль перед отправкой', 'Повторная сверка с описанием и упаковка в фирменный пакет.']
                ].map(([t, d], i) => (
                  <li key={t} className="flex gap-4">
                    <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-ink text-[11px] font-semibold text-paper">{i + 1}</span>
                    <div>
                      <p className="text-sm font-medium">{t}</p>
                      <p className="mt-0.5 text-sm text-mute">{d}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          )}

          {tab === 'delivery' && (
            <div className="grid gap-8 lg:grid-cols-2">
              <div>
                <h2 className="text-lg font-medium tracking-tight">Доставка</h2>
                <ul className="mt-4 space-y-3 text-sm">
                  {[
                    ['Курьер по Москве', '1–2 дня · 500 ₽, бесплатно от 10 000 ₽ · примерка при получении'],
                    ['СДЭК по России', '2–5 дней · 350 ₽ до пункта выдачи'],
                    ['Самовывоз', 'Сегодня · Москва, ул. Большая Никитская, 12 · бесплатно']
                  ].map(([t, d]) => (
                    <li key={t} className="flex gap-3 border border-line bg-paper p-4">
                      <Truck className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
                      <div><p className="font-medium">{t}</p><p className="mt-0.5 text-mute">{d}</p></div>
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <h2 className="text-lg font-medium tracking-tight">Возврат</h2>
                <p className="mt-4 leading-relaxed text-ink-soft">
                  Если вещь не подошла по размеру или не понравилась вживую — вернём деньги в течение 14 дней с момента получения. Вещь должна сохранить товарный вид и бирки. Обратную доставку оплачивает покупатель, кроме случаев, когда мы ошиблись в описании.
                </p>
                <div className="mt-5 flex items-start gap-3 border border-success/30 bg-success/5 p-4 text-sm">
                  <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                  <p className="text-ink-soft">Если подлинность вещи не подтвердится независимой экспертизой — вернём двойную стоимость.</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </section>

      {bundle && bundle.related.length > 0 && (
        <section className="mt-16">
          <div className="mb-8 flex items-end justify-between gap-6">
            <div>
              <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.24em] text-accent">Может понравиться</p>
              <h2 className="text-2xl font-medium tracking-tight sm:text-3xl">Похожие вещи</h2>
            </div>
            <Link href="/catalog" className="group hidden items-center gap-2 text-xs font-medium uppercase tracking-[0.16em] text-ink-soft transition hover:text-ink sm:inline-flex">
              Весь каталог <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-10 sm:gap-x-5 lg:grid-cols-4">
            {bundle.related.map((p, i) => (
              <RelatedCard key={p.id} product={p} brand={bundle.brands.find((b) => b.id === p.brand_id)?.name ?? ''} index={i} />
            ))}
          </div>
        </section>
      )}

      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface/95 p-3 backdrop-blur-md lg:hidden">
        <div className="flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <p className="truncate text-[10px] uppercase tracking-[0.16em] text-mute">{brand?.name ?? 'RE:FORM'}</p>
            <p className="text-base font-semibold tabular-nums">{money(product.price * qty)}</p>
          </div>
          <button onClick={toggleWish} aria-label={wish ? 'Убрать из избранного' : 'В избранное'}
            className={`grid h-12 w-12 shrink-0 place-items-center border transition ${wish ? 'border-accent bg-accent text-white' : 'border-line'}`}>
            <Heart className={`h-4 w-4 ${wish ? 'fill-current' : ''}`} />
          </button>
          <button onClick={() => void addToCart(false)} disabled={soldOut || adding}
            className={`flex h-12 shrink-0 items-center gap-2 px-6 text-[11px] font-semibold uppercase tracking-[0.16em] transition ${added ? 'bg-success text-white' : soldOut ? 'bg-line text-mute' : 'bg-ink text-paper'}`}>
            {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : added ? <Check className="h-4 w-4" /> : <ShoppingBag className="h-4 w-4" />}
            {soldOut ? 'Продано' : added ? 'Готово' : 'В корзину'}
          </button>
        </div>
      </div>

      {lightbox && images.length > 0 && (
        <div className="fixed inset-0 z-[100] flex flex-col bg-ink/95 backdrop-blur-sm">
          <div className="flex items-center justify-between gap-4 border-b border-paper/10 px-4 py-3 text-paper">
            <p className="min-w-0 truncate text-sm">{product.title} · {imgIndex + 1} / {images.length}</p>
            <button onClick={() => setLightbox(false)} aria-label="Закрыть" className="grid h-10 w-10 shrink-0 place-items-center border border-paper/20 transition hover:bg-paper/10">
              <X className="h-5 w-5" />
            </button>
          </div>
          <div className="relative flex min-h-0 flex-1 items-center justify-center p-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={images[imgIndex]} alt={product.title} className="max-h-full max-w-full object-contain" />
            {images.length > 1 && (
              <>
                <button onClick={prevImage} aria-label="Предыдущее" className="absolute left-4 grid h-12 w-12 place-items-center border border-paper/20 text-paper transition hover:bg-paper/10">
                  <ChevronLeft className="h-6 w-6" />
                </button>
                <button onClick={nextImage} aria-label="Следующее" className="absolute right-4 grid h-12 w-12 place-items-center border border-paper/20 text-paper transition hover:bg-paper/10">
                  <ChevronRight className="h-6 w-6" />
                </button>
              </>
            )}
          </div>
          {images.length > 1 && (
            <div className="no-scrollbar flex justify-center gap-2 overflow-x-auto border-t border-paper/10 p-3">
              {images.map((src, i) => (
                <button key={i} onClick={() => goImage(i)} aria-label={`Фото ${i + 1}`}
                  className={`relative h-16 w-12 shrink-0 overflow-hidden border transition ${i === imgIndex ? 'border-paper' : 'border-paper/20 opacity-50 hover:opacity-100'}`}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={src} alt="" className="h-full w-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {guideOpen && guide && (
        <div className="fixed inset-0 z-[100] flex items-end justify-center sm:items-center sm:p-6">
          <div className="absolute inset-0 animate-fade-in bg-ink/45 backdrop-blur-sm" onClick={() => setGuideOpen(false)} />
          <div className="catalog-scroll relative max-h-[85vh] w-full max-w-lg animate-fade-up overflow-y-auto border border-line bg-surface">
            <div className="sticky top-0 flex items-center justify-between gap-4 border-b border-line bg-surface px-6 py-4">
              <h3 className="flex items-center gap-2 text-lg font-medium tracking-tight"><Ruler className="h-4 w-4 text-accent" /> Таблица размеров</h3>
              <button onClick={() => setGuideOpen(false)} aria-label="Закрыть" className="grid h-9 w-9 shrink-0 place-items-center border border-line transition hover:border-ink">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="p-6">
              <p className="text-sm text-mute">{category?.name}. Замеры сняты с вещи в расправленном виде, погрешность ±1–2 см.</p>
              <div className="mt-5 overflow-x-auto">
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr>
                      {guide.cols.map((c) => (
                        <th key={c} className="border border-line bg-paper px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-[0.14em] text-mute">{c}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {guide.rows.map((row) => {
                      const active = size === row[0];
                      return (
                        <tr key={row[0]} className={active ? 'bg-ink text-paper' : ''}>
                          {row.map((cell, ci) => (
                            <td key={ci} className={`border border-line px-3 py-2.5 tabular-nums ${ci === 0 ? 'font-semibold' : ''} ${active ? 'border-paper/20' : ''}`}>{cell}</td>
                          ))}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <p className="mt-5 text-xs text-mute">Между размерами? Берите больший — у большинства брендов крой свободный. Точные замеры конкретной вещи пришлём по запросу.</p>
            </div>
          </div>
        </div>
      )}

      <div className="pointer-events-none fixed bottom-24 right-4 z-[110] flex w-[calc(100vw-2rem)] max-w-sm flex-col gap-2 lg:bottom-4">
        {toasts.map((t) => (
          <div key={t.id} className="pointer-events-auto flex animate-toast-in items-start gap-3 bg-ink p-4 text-paper shadow-2xl">
            <span className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full ${t.tone === 'ok' ? 'bg-success' : 'bg-warning'}`}>
              {t.tone === 'ok' ? <Check className="h-3 w-3" /> : <Info className="h-3 w-3" />}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">{t.title}</p>
              {t.desc && <p className="mt-0.5 truncate text-xs text-paper/60">{t.desc}</p>}
            </div>
            <button onClick={() => setToasts((x) => x.filter((i) => i.id !== t.id))} aria-label="Закрыть" className="shrink-0 text-paper/50 transition hover:text-paper">
              <X className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

function RelatedCard({ product, brand, index }: { product: Product; brand: string; index: number }) {
  const discount = salePct(product);
  return (
    <Link href={`/product/${product.slug}`} className="group block animate-fade-up" style={{ animationDelay: `${index * 60}ms` }}>
      <div className="relative aspect-[3/4] overflow-hidden bg-line/40">
        {product.images[0] ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={product.images[0]} alt={product.title} loading="lazy"
            className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.05]" />
        ) : (
          <div className="grid h-full place-items-center text-xs uppercase tracking-[0.2em] text-mute">Нет фото</div>
        )}
        {product.images[1] && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={product.images[1]} alt="" loading="lazy"
            className="absolute inset-0 h-full w-full object-cover opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
        )}
        <div className="absolute left-3 top-3 flex flex-col gap-1.5">
          {product.is_new && <span className="bg-ink px-2.5 py-1 text-[9px] font-medium uppercase tracking-[0.18em] text-paper">Новинка</span>}
          {discount > 0 && <span className="bg-accent px-2.5 py-1 text-[9px] font-medium uppercase tracking-[0.18em] text-white">−{discount}%</span>}
        </div>
      </div>
      <div className="border-x border-b border-line bg-surface p-3.5">
        <p className="truncate text-[10px] font-medium uppercase tracking-[0.2em] text-mute">{brand || 'Без бренда'}</p>
        <h3 className="mt-1.5 line-clamp-2 min-h-[2.5rem] text-[13px] font-medium leading-snug tracking-tight transition-colors group-hover:text-accent">{product.title}</h3>
        <div className="mt-2 flex items-baseline gap-2">
          <p className="text-sm font-semibold">{money(product.price)}</p>
          {product.old_price && product.old_price > product.price && (
            <p className="text-[11px] text-mute line-through">{money(product.old_price)}</p>
          )}
        </div>
      </div>
    </Link>
  );
}

function ProductSkeleton() {
  return (
    <div className="mx-auto max-w-[1440px] px-4 sm:px-6 lg:px-10">
      <div className="flex gap-2 pt-2">
        <div className="h-3 w-16 animate-pulse bg-line" />
        <div className="h-3 w-20 animate-pulse bg-line" />
        <div className="h-3 w-32 animate-pulse bg-line" />
      </div>
      <div className="mt-6 grid gap-10 lg:grid-cols-[minmax(0,1fr)_460px] lg:gap-14">
        <div className="flex gap-4">
          <div className="hidden w-20 shrink-0 space-y-3 sm:block">
            <div className="aspect-[3/4] animate-pulse bg-line" />
            <div className="aspect-[3/4] animate-pulse bg-line" />
          </div>
          <div className="aspect-[3/4] flex-1 animate-pulse bg-line" />
        </div>
        <div className="space-y-5">
          <div className="h-3 w-28 animate-pulse bg-line" />
          <div className="h-10 w-full animate-pulse bg-line" />
          <div className="h-10 w-2/3 animate-pulse bg-line" />
          <div className="h-8 w-40 animate-pulse bg-line" />
          <div className="flex gap-2">
            {Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-11 w-12 animate-pulse bg-line" />)}
          </div>
          <div className="h-14 w-full animate-pulse bg-line" />
          <div className="grid grid-cols-2 gap-3">
            <div className="h-12 animate-pulse bg-line" />
            <div className="h-12 animate-pulse bg-line" />
          </div>
          <div className="h-32 w-full animate-pulse bg-line" />
        </div>
      </div>
    </div>
  );
}
