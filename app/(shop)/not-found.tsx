'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';
import {
  ArrowRight, ArrowUpRight, Check, Compass, Copy, CornerUpLeft, Home, LifeBuoy,
  Loader2, MapPin, Package, Pause, Play, Search, ShoppingBag, Sparkles, Tag, X
} from 'lucide-react';

type Product = {
  id: number; title: string; slug: string; price: number; old_price: number | null;
  images: string[]; stock: number; is_new: boolean; brand_id: number | null; category_id: number | null;
};
type Brand = { id: number; name: string; slug: string };
type Category = { id: number; name: string; slug: string };
type Toast = { id: number; title: string; desc?: string; tone: 'ok' | 'warn' };

const CART_KEY = 'reform-cart-v1';
const REDIRECT_SECONDS = 20;
const RING_RADIUS = 22;
const RING_LENGTH = 2 * Math.PI * RING_RADIUS;

const I = (id: string, w = 900) => `https://images.unsplash.com/${id}?q=80&w=${w}&auto=format&fit=crop`;

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
  { id: 1, name: 'Верхняя одежда', slug: 'outerwear' },
  { id: 2, name: 'Футболки', slug: 't-shirts' },
  { id: 3, name: 'Худи и свитшоты', slug: 'hoodies' },
  { id: 4, name: 'Рубашки', slug: 'shirts' },
  { id: 5, name: 'Джинсы и брюки', slug: 'pants' },
  { id: 6, name: 'Обувь', slug: 'shoes' },
  { id: 7, name: 'Аксессуары', slug: 'accessories' }
];

const PRODUCTS: Product[] = [
  { id: 1, title: 'Куртка Stone Island Ghost Piece', slug: 'stone-island-ghost-piece', price: 42900, old_price: 51900, images: [I('photo-1591047139829-d91aecb6caea'), I('photo-1551028719-00167b16eac5')], stock: 1, is_new: true, brand_id: 1, category_id: 1 },
  { id: 2, title: 'Худи Carhartt WIP Hooded Chase', slug: 'carhartt-hooded-chase', price: 8900, old_price: null, images: [I('photo-1556821840-3a63f95609a7'), I('photo-1578932750294-f5075e85f44a')], stock: 3, is_new: true, brand_id: 2, category_id: 3 },
  { id: 3, title: 'Пуховик The North Face Nuptse 1996', slug: 'tnf-nuptse-1996', price: 24500, old_price: 29900, images: [I('photo-1544022613-e87ca75a784a'), I('photo-1539533018447-63fcce2678e3')], stock: 1, is_new: false, brand_id: 3, category_id: 1 },
  { id: 4, title: 'Кроссовки Nike Air Max 90', slug: 'nike-air-max-90', price: 11900, old_price: null, images: [I('photo-1600185365483-26d7a4cc7519'), I('photo-1595950653106-6c9ebd614d3a')], stock: 2, is_new: false, brand_id: 4, category_id: 6 },
  { id: 5, title: 'Футболка Stüssy Basic Logo', slug: 'stussy-basic-logo', price: 4500, old_price: null, images: [I('photo-1521572163474-6864f9cf17ab'), I('photo-1576566588028-4147f3842f27')], stock: 4, is_new: true, brand_id: 6, category_id: 2 },
  { id: 6, title: 'Рубашка Ralph Lauren Oxford', slug: 'ralph-lauren-oxford', price: 7900, old_price: 9900, images: [I('photo-1596755094514-f87e34085b2c'), I('photo-1602810318383-e386cc2a3ccf')], stock: 2, is_new: false, brand_id: 7, category_id: 4 },
  { id: 7, title: 'Джинсы Acne Studios 1996', slug: 'acne-studios-1996', price: 15900, old_price: null, images: [I('photo-1542272604-787c3835535d'), I('photo-1541099649105-f69ad21f3246')], stock: 1, is_new: false, brand_id: 8, category_id: 5 },
  { id: 8, title: 'Свитшот Adidas Originals Trefoil', slug: 'adidas-trefoil-sweatshirt', price: 6500, old_price: null, images: [I('photo-1556306535-0f09a537f0a3'), I('photo-1578681994506-b8f463449011')], stock: 2, is_new: false, brand_id: 5, category_id: 3 },
  { id: 9, title: 'Кроссовки Adidas Samba OG', slug: 'adidas-samba-og', price: 10900, old_price: 12900, images: [I('photo-1600269452121-4f2416e55c28'), I('photo-1560769629-975ec94e6a86')], stock: 3, is_new: true, brand_id: 5, category_id: 6 },
  { id: 10, title: 'Куртка Carhartt WIP Detroit Jacket', slug: 'carhartt-detroit-jacket', price: 13500, old_price: null, images: [I('photo-1520975954732-35dd22299614'), I('photo-1525507119028-ed4c629a60a3')], stock: 1, is_new: false, brand_id: 2, category_id: 1 },
  { id: 11, title: 'Футболка The North Face Simple Dome', slug: 'tnf-simple-dome', price: 3200, old_price: null, images: [I('photo-1583743814966-8936f5b7be1a'), I('photo-1581655353564-df123a1eb820')], stock: 5, is_new: true, brand_id: 3, category_id: 2 },
  { id: 12, title: 'Сумка Carhartt WIP Essentials', slug: 'carhartt-essentials-bag', price: 5500, old_price: null, images: [I('photo-1553062407-98eeb64c6a62'), I('photo-1548036328-c9fa89d128fa')], stock: 2, is_new: false, brand_id: 2, category_id: 7 }
];

const QUICK_LINKS = [
  { href: '/catalog', label: 'Каталог', note: 'Все вещи в наличии', icon: Package },
  { href: '/catalog?new=1', label: 'Новинки', note: 'Приехали на этой неделе', icon: Sparkles },
  { href: '/cart', label: 'Корзина', note: 'Ваши отложенные покупки', icon: ShoppingBag },
  { href: '/account', label: 'Личный кабинет', note: 'Заказы и их статусы', icon: MapPin }
];

const money = (n: number) => new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 }).format(n) + ' ₽';
const norm = (s: string) => s.toLowerCase().replace(/ё/g, 'е').trim();
const salePct = (p: Product) => p.old_price && p.old_price > p.price ? Math.round((1 - p.price / p.old_price) * 100) : 0;

function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  let prev = Array.from({ length: n + 1 }, (_, i) => i);
  for (let i = 1; i <= m; i++) {
    const cur = [i, ...Array<number>(n).fill(0)];
    for (let j = 1; j <= n; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[n];
}

function cartCount(): number {
  try {
    const raw = localStorage.getItem(CART_KEY);
    if (!raw) return 0;
    const parsed = JSON.parse(raw);
    const items = parsed?.state?.items;
    if (!Array.isArray(items)) return 0;
    return items.reduce((s: number, x: any) => s + (Number(x?.quantity) || 0), 0);
  } catch {
    return 0;
  }
}

async function loadCatalog(): Promise<{ products: Product[]; brands: Brand[]; categories: Category[] }> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return { products: PRODUCTS, brands: BRANDS, categories: CATEGORIES };

  try {
    const supabase = createClient(url, key);
    const [p, b, c] = await Promise.all([
      supabase.from('products')
        .select('id,title,slug,price,old_price,images,stock,is_new,brand_id,category_id')
        .eq('is_published', true).order('created_at', { ascending: false }),
      supabase.from('brands').select('id,name,slug').order('name'),
      supabase.from('categories').select('id,name,slug').order('sort_order')
    ]);
    if (p.error || b.error || c.error) throw new Error('fallback');
    const products = (p.data ?? []).map((x: any) => ({
      ...x,
      price: Number(x.price) || 0,
      old_price: x.old_price == null ? null : Number(x.old_price),
      images: Array.isArray(x.images) ? x.images : [],
      stock: Number(x.stock) || 0
    })) as Product[];
    return {
      products: products.length ? products : PRODUCTS,
      brands: (b.data ?? []) as Brand[],
      categories: (c.data ?? []) as Category[]
    };
  } catch {
    return { products: PRODUCTS, brands: BRANDS, categories: CATEGORIES };
  }
}

export default function NotFound() {
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>(PRODUCTS);
  const [brands, setBrands] = useState<Brand[]>(BRANDS);
  const [categories, setCategories] = useState<Category[]>(CATEGORIES);

  const [path, setPath] = useState('');
  const [referrer, setReferrer] = useState('');
  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [focused, setFocused] = useState(false);
  const [activeResult, setActiveResult] = useState(0);
  const [count, setCount] = useState(0);
  const [copied, setCopied] = useState<'link' | 'report' | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });

  const [seconds, setSeconds] = useState(REDIRECT_SECONDS);
  const [running, setRunning] = useState(true);
  const [cancelled, setCancelled] = useState(false);

  const timers = useRef<number[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const searchBoxRef = useRef<HTMLDivElement>(null);
  const firedRef = useRef(false);

  useEffect(() => {
    setPath(window.location.pathname + window.location.search);
    setReferrer(document.referrer || '');
    setCount(cartCount());
    void loadCatalog().then((d) => {
      setProducts(d.products);
      if (d.brands.length) setBrands(d.brands);
      if (d.categories.length) setCategories(d.categories);
    });
  }, []);

  useEffect(() => {
    const sync = () => setCount(cartCount());
    window.addEventListener('reform-cart-updated', sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener('reform-cart-updated', sync);
      window.removeEventListener('storage', sync);
    };
  }, []);

  useEffect(() => () => { timers.current.forEach((t) => window.clearTimeout(t)); }, []);

  // Countdown to the catalog. Pauses on hover/focus/typing, cancels for good on request.
  useEffect(() => {
    if (!running || cancelled || firedRef.current) return;
    const id = window.setInterval(() => {
      setSeconds((s) => (s <= 1 ? 0 : s - 1));
    }, 1000);
    return () => window.clearInterval(id);
  }, [running, cancelled]);

  useEffect(() => {
    if (seconds > 0 || cancelled || firedRef.current) return;
    firedRef.current = true;
    setRunning(false);
    router.push('/catalog');
  }, [seconds, cancelled, router]);

  const stopRedirect = useCallback(() => {
    setCancelled(true);
    setRunning(false);
    firedRef.current = true;
  }, []);

  const pushToast = useCallback((title: string, desc?: string, tone: 'ok' | 'warn' = 'ok') => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t.slice(-2), { id, title, desc, tone }]);
    timers.current.push(window.setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3200));
  }, []);

  const brandName = useCallback(
    (id: number | null) => brands.find((b) => b.id === id)?.name ?? '',
    [brands]
  );
  const categoryName = useCallback(
    (id: number | null) => categories.find((c) => c.id === id)?.name ?? '',
    [categories]
  );

  const results = useMemo(() => {
    const q = norm(query);
    if (!q) return [];
    const terms = q.split(/\s+/).filter(Boolean);
    const scored: { score: number; p: Product }[] = [];
    products.forEach((p) => {
      const hay = norm(`${p.title} ${brandName(p.brand_id)} ${categoryName(p.category_id)} ${p.slug.replace(/-/g, ' ')}`);
      if (terms.every((t) => hay.includes(t))) {
        const title = norm(p.title);
        scored.push({ score: title.startsWith(q) ? 0 : title.includes(q) ? 1 : 2, p });
      }
    });
    scored.sort((a, b) => a.score - b.score || a.p.id - b.p.id);
    return scored.slice(0, 6).map((x) => x.p);
  }, [query, products, brandName, categoryName]);

  useEffect(() => {
    if (!query.trim()) { setSearching(false); return; }
    setSearching(true);
    const t = window.setTimeout(() => setSearching(false), 220);
    return () => window.clearTimeout(t);
  }, [query]);

  useEffect(() => { setActiveResult(0); }, [query]);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (searchBoxRef.current && !searchBoxRef.current.contains(e.target as Node)) setFocused(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === '/' && document.activeElement?.tagName !== 'INPUT') {
        e.preventDefault();
        stopRedirect();
        inputRef.current?.focus();
      }
      if (e.key === 'Escape') { setFocused(false); inputRef.current?.blur(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [stopRedirect]);

  const suggestion = useMemo(() => {
    const clean = (path.split('?')[0] || '/').toLowerCase().replace(/\/+$/, '') || '/';
    if (clean === '/') return null;
    const candidates: { href: string; label: string }[] = [
      { href: '/', label: 'Главная' },
      { href: '/catalog', label: 'Каталог' },
      { href: '/cart', label: 'Корзина' },
      { href: '/checkout', label: 'Оформление заказа' },
      { href: '/account', label: 'Личный кабинет' },
      { href: '/login', label: 'Вход' },
      { href: '/register', label: 'Регистрация' },
      ...products.map((p) => ({ href: `/product/${p.slug}`, label: p.title }))
    ];
    const scored = candidates
      .map((c) => ({ href: c.href, label: c.label, d: levenshtein(clean, c.href.toLowerCase()) }))
      .sort((a, b) => a.d - b.d || a.href.length - b.href.length);
    const best = scored[0];
    if (!best) return null;
    const threshold = Math.max(2, Math.floor(clean.length / 3));
    return best.d > 0 && best.d <= threshold ? { href: best.href, label: best.label } : null;
  }, [path, products]);

  const picks = useMemo(() => {
    const fresh = products.filter((p) => p.is_new && p.stock > 0);
    const pool = fresh.length >= 4 ? fresh : products.filter((p) => p.stock > 0);
    return (pool.length ? pool : products).slice(0, 4);
  }, [products]);

  const copy = async (kind: 'link' | 'report') => {
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const text = kind === 'link'
      ? origin + path
      : `RE:FORM · битая ссылка\nАдрес: ${origin}${path}\nОткуда: ${referrer || 'прямой заход'}\nВремя: ${new Date().toLocaleString('ru-RU')}\nБраузер: ${navigator.userAgent}`;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(kind);
      timers.current.push(window.setTimeout(() => setCopied(null), 2000));
      pushToast(kind === 'link' ? 'Адрес скопирован' : 'Отчёт скопирован', kind === 'report' ? 'Отправьте его нам в Telegram' : undefined);
    } catch {
      pushToast('Не удалось скопировать', 'Браузер запретил доступ к буферу', 'warn');
    }
  };

  const openResult = (p: Product) => {
    stopRedirect();
    setFocused(false);
    router.push(`/product/${p.slug}`);
  };

  const onSearchKey = (e: ReactKeyboardEvent<HTMLInputElement>) => {
    if (results.length === 0) {
      if (e.key === 'Enter' && query.trim()) {
        stopRedirect();
        router.push(`/catalog?q=${encodeURIComponent(query.trim())}`);
      }
      return;
    }
    if (e.key === 'ArrowDown') { e.preventDefault(); setActiveResult((i) => (i + 1) % results.length); }
    if (e.key === 'ArrowUp') { e.preventDefault(); setActiveResult((i) => (i - 1 + results.length) % results.length); }
    if (e.key === 'Enter') { e.preventDefault(); openResult(results[activeResult]); }
  };

  const ringOffset = RING_LENGTH * (seconds / REDIRECT_SECONDS);

  return (
    <div className="relative min-h-[calc(100vh-6rem)] overflow-hidden">
      <div aria-hidden className="pointer-events-none absolute inset-0" style={{
        background: 'radial-gradient(60% 55% at 12% 8%, rgba(154,59,38,.16), transparent 62%), radial-gradient(50% 50% at 88% 12%, rgba(29,78,216,.12), transparent 60%), radial-gradient(70% 60% at 50% 108%, rgba(31,122,77,.12), transparent 62%), linear-gradient(180deg,#FBFAF7 0%,#F4F1EA 55%,#EFEAE0 100%)'
      }} />
      <div aria-hidden className="pointer-events-none absolute inset-0 opacity-[0.05]" style={{
        backgroundImage: 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'140\' height=\'140\'%3E%3Cfilter id=\'n\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'.85\' numOctaves=\'3\'/%3E%3C/filter%3E%3Crect width=\'140\' height=\'140\' filter=\'url(%23n)\'/%3E%3C/svg%3E")'
      }} />
      <div aria-hidden className="pointer-events-none absolute -left-24 top-10 h-72 w-72 rounded-full bg-accent/10 blur-3xl" />
      <div aria-hidden className="pointer-events-none absolute -right-20 bottom-24 h-80 w-80 rounded-full bg-info/10 blur-3xl" />

      <div className="relative mx-auto max-w-[1440px] px-4 py-10 sm:px-6 lg:px-10 lg:py-16">
        <div className="grid items-start gap-12 lg:grid-cols-[minmax(0,1fr)_420px] lg:gap-16">
          <section>
            <p className="inline-flex animate-fade-up items-center gap-2 border border-accent/30 bg-accent/5 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.24em] text-accent">
              <Compass className="h-3.5 w-3.5" /> Ошибка 404 · страница не найдена
            </p>

            <div
              className="relative mt-6 select-none"
              onMouseMove={(e) => {
                const r = e.currentTarget.getBoundingClientRect();
                setTilt({
                  x: ((e.clientX - r.left) / r.width - 0.5) * 14,
                  y: ((e.clientY - r.top) / r.height - 0.5) * -10
                });
              }}
              onMouseLeave={() => setTilt({ x: 0, y: 0 })}
            >
              <h1
                className="animate-fade-up text-[26vw] font-bold leading-[0.78] tracking-tighter text-ink sm:text-[18rem] lg:text-[15rem]"
                style={{
                  animationDelay: '60ms',
                  transform: `perspective(900px) rotateY(${tilt.x}deg) rotateX(${tilt.y}deg)`,
                  transition: 'transform 240ms ease-out',
                  textShadow: '6px 6px 0 rgba(154,59,38,.16), 12px 12px 0 rgba(29,78,216,.08)'
                }}
              >
                4<span className="text-accent">0</span>4
              </h1>
              <span aria-hidden className="absolute -right-2 top-4 hidden rotate-6 border border-ink bg-surface px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.2em] shadow-lg sm:block">
                Вещь не найдена
              </span>
            </div>

            <h2 className="mt-6 max-w-xl animate-fade-up text-2xl font-medium leading-tight tracking-tight sm:text-3xl" style={{ animationDelay: '140ms' }}>
              Такой страницы нет — <span className="font-serif italic text-accent">но вещи есть.</span>
            </h2>
            <p className="mt-4 max-w-lg animate-fade-up leading-relaxed text-ink-soft" style={{ animationDelay: '200ms' }}>
              Возможно, ссылка устарела, товар уже продан или в адресе опечатка. Найдите нужное через поиск ниже — или просто загляните в каталог, там всё в наличии.
            </p>

            <div className="mt-7 animate-fade-up border border-line bg-surface/80 backdrop-blur-sm" style={{ animationDelay: '260ms' }}>
              <div className="flex flex-wrap items-center gap-3 border-b border-line px-4 py-3">
                <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-mute">Запрошенный адрес</span>
                <code className="min-w-0 flex-1 truncate rounded bg-danger/5 px-2 py-1 text-xs text-danger">{path || '…'}</code>
                <button onClick={() => void copy('link')}
                  className="inline-flex h-8 shrink-0 items-center gap-1.5 border border-line px-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-mute transition hover:border-ink hover:text-ink">
                  {copied === 'link' ? <Check className="h-3 w-3 text-success" /> : <Copy className="h-3 w-3" />}
                  {copied === 'link' ? 'Готово' : 'Копировать'}
                </button>
              </div>

              {suggestion ? (
                <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                  <p className="text-sm text-ink-soft">
                    Возможно, вы искали <strong className="font-medium text-ink">{suggestion.label}</strong>?
                  </p>
                  <Link href={suggestion.href} onClick={stopRedirect}
                    className="group inline-flex h-9 items-center gap-2 bg-ink px-4 text-[10px] font-semibold uppercase tracking-[0.16em] text-paper transition hover:bg-accent">
                    Перейти <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
                  </Link>
                </div>
              ) : (
                <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                  <p className="text-sm text-mute">Похожих адресов не нашлось — начните с каталога.</p>
                  <button onClick={() => void copy('report')}
                    className="inline-flex h-9 items-center gap-2 border border-line px-4 text-[10px] font-semibold uppercase tracking-[0.16em] text-mute transition hover:border-ink hover:text-ink">
                    {copied === 'report' ? <Check className="h-3.5 w-3.5 text-success" /> : <LifeBuoy className="h-3.5 w-3.5" />}
                    {copied === 'report' ? 'Отчёт скопирован' : 'Сообщить о битой ссылке'}
                  </button>
                </div>
              )}
            </div>

            <div className="mt-7 flex animate-fade-up flex-wrap gap-3" style={{ animationDelay: '320ms' }}>
              <Link href="/catalog" onClick={stopRedirect}
                className="group inline-flex h-[52px] items-center gap-2 bg-ink px-8 text-[11px] font-semibold uppercase tracking-[0.18em] text-paper transition hover:bg-accent">
                В каталог <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </Link>
              <Link href="/" onClick={stopRedirect}
                className="inline-flex h-[52px] items-center gap-2 border border-ink px-8 text-[11px] font-semibold uppercase tracking-[0.18em] transition hover:bg-ink hover:text-paper">
                <Home className="h-4 w-4" /> На главную
              </Link>
              <button onClick={() => { stopRedirect(); router.back(); }}
                className="inline-flex h-[52px] items-center gap-2 border border-line bg-surface px-6 text-[11px] font-semibold uppercase tracking-[0.18em] text-ink-soft transition hover:border-ink hover:text-ink">
                <CornerUpLeft className="h-4 w-4" /> Назад
              </button>
            </div>
          </section>

          <aside className="animate-fade-up lg:sticky lg:top-28" style={{ animationDelay: '180ms' }}
            onMouseEnter={() => { if (!cancelled) setRunning(false); }}
            onMouseLeave={() => { if (!cancelled && !focused) setRunning(true); }}>
            <div className="border border-line bg-surface p-5">
              <div className="flex items-center gap-4">
                <div className="relative grid h-14 w-14 shrink-0 place-items-center">
                  <svg viewBox="0 0 52 52" className="absolute inset-0 h-full w-full -rotate-90">
                    <circle cx="26" cy="26" r={RING_RADIUS} fill="none" stroke="currentColor" strokeWidth="3" className="text-line" />
                    <circle cx="26" cy="26" r={RING_RADIUS} fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"
                      className={cancelled ? 'text-mute' : 'text-accent'}
                      style={{ strokeDasharray: RING_LENGTH, strokeDashoffset: cancelled ? RING_LENGTH : RING_LENGTH - ringOffset, transition: 'stroke-dashoffset 1s linear' }} />
                  </svg>
                  <span className="text-sm font-semibold tabular-nums">{cancelled ? '—' : seconds}</span>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">
                    {cancelled ? 'Автопереход отключён' : 'Переведём в каталог'}
                  </p>
                  <p className="mt-0.5 text-xs text-mute">
                    {cancelled ? 'Вы остались на странице — ищите спокойно.' : `Через ${seconds} сек. Наведите курсор, чтобы поставить на паузу.`}
                  </p>
                </div>
              </div>
              <div className="mt-4 flex gap-2">
                {!cancelled && (
                  <button onClick={() => setRunning((r) => !r)}
                    className="inline-flex h-9 flex-1 items-center justify-center gap-2 border border-line text-[10px] font-semibold uppercase tracking-[0.16em] transition hover:border-ink">
                    {running ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
                    {running ? 'Пауза' : 'Продолжить'}
                  </button>
                )}
                <button onClick={stopRedirect} disabled={cancelled}
                  className="inline-flex h-9 flex-1 items-center justify-center gap-2 border border-line text-[10px] font-semibold uppercase tracking-[0.16em] text-mute transition hover:border-danger hover:text-danger disabled:cursor-not-allowed disabled:opacity-40">
                  <X className="h-3.5 w-3.5" /> {cancelled ? 'Отключено' : 'Остаться'}
                </button>
              </div>
            </div>

            <div ref={searchBoxRef} className="relative mt-4 border border-line bg-surface p-5">
              <div className="mb-3 flex items-center justify-between gap-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em]">Найти вещь</p>
                <kbd className="hidden border border-line bg-paper px-1.5 py-0.5 text-[10px] text-mute sm:block">/</kbd>
              </div>
              <div className={`flex h-12 items-center gap-2 border bg-paper px-3 transition ${focused ? 'border-ink' : 'border-line'}`}>
                {searching ? <Loader2 className="h-4 w-4 shrink-0 animate-spin text-accent" /> : <Search className="h-4 w-4 shrink-0 text-mute" />}
                <input
                  ref={inputRef}
                  value={query}
                  onChange={(e) => { setQuery(e.target.value); stopRedirect(); }}
                  onFocus={() => { setFocused(true); stopRedirect(); }}
                  onKeyDown={onSearchKey}
                  placeholder="Куртка, Carhartt, обувь…"
                  aria-label="Поиск по каталогу"
                  className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-mute/60"
                />
                {query && (
                  <button onClick={() => { setQuery(''); inputRef.current?.focus(); }} aria-label="Очистить"
                    className="grid h-6 w-6 shrink-0 place-items-center text-mute transition hover:text-ink">
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>

              {query.trim() !== '' && (
                <div className="catalog-scroll mt-3 max-h-80 overflow-y-auto">
                  {results.length > 0 ? (
                    <ul className="space-y-1">
                      {results.map((p, i) => (
                        <li key={p.id}>
                          <button onClick={() => openResult(p)} onMouseEnter={() => setActiveResult(i)}
                            className={`flex w-full items-center gap-3 border p-2 text-left transition ${i === activeResult ? 'border-ink bg-ink text-paper' : 'border-transparent hover:border-line'}`}>
                            <span className="relative h-12 w-9 shrink-0 overflow-hidden bg-line/40">
                              {p.images[0] ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={p.images[0]} alt="" loading="lazy" className="h-full w-full object-cover" />
                              ) : null}
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-[10px] uppercase tracking-[0.16em] opacity-60">{brandName(p.brand_id)}</span>
                              <span className="block truncate text-sm font-medium">{p.title}</span>
                            </span>
                            <span className="shrink-0 text-sm font-semibold tabular-nums">{money(p.price)}</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <div className="border border-line bg-paper p-4 text-center">
                      <p className="text-sm text-mute">Ничего не нашлось по запросу «{query}»</p>
                      <Link href={`/catalog?q=${encodeURIComponent(query.trim())}`} onClick={stopRedirect}
                        className="mt-3 inline-flex h-9 items-center gap-2 border border-ink px-4 text-[10px] font-semibold uppercase tracking-[0.16em] transition hover:bg-ink hover:text-paper">
                        Открыть весь каталог <ArrowUpRight className="h-3.5 w-3.5" />
                      </Link>
                    </div>
                  )}
                </div>
              )}

              {query.trim() === '' && (
                <div className="mt-4">
                  <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-mute">Популярные запросы</p>
                  <div className="flex flex-wrap gap-2">
                    {['Куртка', 'Худи', 'Обувь', 'Carhartt', 'Adidas'].map((t) => (
                      <button key={t} onClick={() => { setQuery(t); stopRedirect(); inputRef.current?.focus(); }}
                        className="inline-flex h-8 items-center gap-1.5 border border-line bg-paper px-3 text-xs transition hover:border-ink hover:bg-ink hover:text-paper">
                        <Tag className="h-3 w-3" /> {t}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="mt-4 grid gap-px border border-line bg-line">
              {QUICK_LINKS.map((l) => (
                <Link key={l.href} href={l.href} onClick={stopRedirect}
                  className="group flex items-center gap-3 bg-surface p-4 transition hover:bg-ink hover:text-paper">
                  <l.icon className="h-4 w-4 shrink-0 text-accent" />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium">{l.label}</span>
                    <span className="block truncate text-xs text-mute group-hover:text-paper/60">
                      {l.href === '/cart' && count > 0 ? `${count} товар(ов) ждёт оформления` : l.note}
                    </span>
                  </span>
                  {l.href === '/cart' && count > 0 ? (
                    <span className="grid h-5 min-w-5 shrink-0 place-items-center rounded-full bg-accent px-1 text-[10px] font-bold text-white">{count}</span>
                  ) : (
                    <ArrowUpRight className="h-4 w-4 shrink-0 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                  )}
                </Link>
              ))}
            </div>
          </aside>
        </div>

        <section className="mt-16 border-t border-line pt-10">
          <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.24em] text-accent">Или начните с категории</p>
              <h2 className="text-2xl font-medium tracking-tight sm:text-3xl">Куда посмотреть</h2>
            </div>
            <Link href="/catalog" onClick={stopRedirect}
              className="group inline-flex items-center gap-2 text-xs font-medium uppercase tracking-[0.16em] text-ink-soft transition hover:text-ink">
              Весь каталог <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </Link>
          </div>
          <div className="flex flex-wrap gap-2">
            {categories.map((c, i) => (
              <Link key={c.id} href={`/catalog?category=${c.slug}`} onClick={stopRedirect}
                className="animate-fade-up inline-flex h-11 items-center gap-2 border border-line bg-surface px-5 text-sm transition-all duration-300 hover:-translate-y-0.5 hover:border-ink hover:bg-ink hover:text-paper"
                style={{ animationDelay: `${i * 45}ms` }}>
                {c.name}
                <span className="text-xs text-mute">{products.filter((p) => p.category_id === c.id).length}</span>
              </Link>
            ))}
          </div>
        </section>

        <section className="mt-14">
          <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.24em] text-accent">Пока вы здесь</p>
              <h2 className="text-2xl font-medium tracking-tight sm:text-3xl">Эти вещи точно на месте</h2>
            </div>
            <Link href="/catalog?new=1" onClick={stopRedirect}
              className="group inline-flex items-center gap-2 text-xs font-medium uppercase tracking-[0.16em] text-ink-soft transition hover:text-ink">
              Все новинки <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-10 sm:gap-x-5 lg:grid-cols-4">
            {picks.map((p, i) => {
              const discount = salePct(p);
              return (
                <Link key={p.id} href={`/product/${p.slug}`} onClick={stopRedirect}
                  className="group block animate-fade-up" style={{ animationDelay: `${i * 70}ms` }}>
                  <div className="relative aspect-[3/4] overflow-hidden bg-line/40">
                    {p.images[0] ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={p.images[0]} alt={p.title} loading="lazy"
                        className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.05]" />
                    ) : (
                      <div className="grid h-full place-items-center text-xs uppercase tracking-[0.2em] text-mute">Нет фото</div>
                    )}
                    {p.images[1] && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={p.images[1]} alt="" loading="lazy"
                        className="absolute inset-0 h-full w-full object-cover opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
                    )}
                    <div className="absolute left-3 top-3 flex flex-col gap-1.5">
                      {p.is_new && <span className="bg-ink px-2.5 py-1 text-[9px] font-medium uppercase tracking-[0.18em] text-paper">Новинка</span>}
                      {discount > 0 && <span className="bg-accent px-2.5 py-1 text-[9px] font-medium uppercase tracking-[0.18em] text-white">−{discount}%</span>}
                    </div>
                  </div>
                  <div className="border-x border-b border-line bg-surface p-3.5">
                    <p className="truncate text-[10px] font-medium uppercase tracking-[0.2em] text-mute">{brandName(p.brand_id) || 'Без бренда'}</p>
                    <h3 className="mt-1.5 line-clamp-2 min-h-[2.5rem] text-[13px] font-medium leading-snug tracking-tight transition-colors group-hover:text-accent">{p.title}</h3>
                    <div className="mt-2 flex items-baseline gap-2">
                      <p className="text-sm font-semibold">{money(p.price)}</p>
                      {p.old_price && p.old_price > p.price && (
                        <p className="text-[11px] text-mute line-through">{money(p.old_price)}</p>
                      )}
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>

        <section className="mt-14 flex flex-wrap items-center justify-between gap-6 border border-line bg-surface p-6 sm:p-8">
          <div className="flex items-start gap-4">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-accent/10">
              <LifeBuoy className="h-5 w-5 text-accent" />
            </span>
            <div>
              <p className="text-base font-medium tracking-tight">Искали конкретную вещь?</p>
              <p className="mt-1 max-w-md text-sm text-mute">
                Напишите нам название или пришлите ссылку с Авито — найдём на складе или подскажем похожую модель.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-3">
            <a href="https://t.me/reform_store" target="_blank" rel="noopener noreferrer"
              className="inline-flex h-11 items-center gap-2 bg-ink px-6 text-[11px] font-semibold uppercase tracking-[0.16em] text-paper transition hover:bg-accent">
              Написать в Telegram <ArrowUpRight className="h-4 w-4" />
            </a>
            <button onClick={() => void copy('report')}
              className="inline-flex h-11 items-center gap-2 border border-line px-6 text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-soft transition hover:border-ink hover:text-ink">
              {copied === 'report' ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />}
              {copied === 'report' ? 'Скопировано' : 'Скопировать отчёт'}
            </button>
          </div>
        </section>
      </div>

      <div className="pointer-events-none fixed bottom-4 right-4 z-[95] flex w-[calc(100vw-2rem)] max-w-sm flex-col gap-2">
        {toasts.map((t) => (
          <div key={t.id} className="pointer-events-auto flex animate-toast-in items-start gap-3 bg-ink p-4 text-paper shadow-2xl">
            <span className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full ${t.tone === 'ok' ? 'bg-success' : 'bg-warning'}`}>
              {t.tone === 'ok' ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">{t.title}</p>
              {t.desc && <p className="mt-0.5 truncate text-xs text-paper/60">{t.desc}</p>}
            </div>
            <button onClick={() => setToasts((x) => x.filter((i) => i.id !== t.id))} aria-label="Закрыть"
              className="shrink-0 text-paper/50 transition hover:text-paper">
              <X className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
