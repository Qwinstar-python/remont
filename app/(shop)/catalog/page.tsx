'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { createClient } from '@supabase/supabase-js';
import {
  AlertTriangle, Check, ChevronDown, RotateCcw,
  Search, ShoppingBag, SlidersHorizontal, X
} from 'lucide-react';

/* ---------------- Types ---------------- */

type Condition = 'new' | 'excellent' | 'good' | 'fair';
type Sort = 'newest' | 'popular' | 'price-asc' | 'price-desc' | 'discount';

type Product = {
  id: number; title: string; slug: string; description: string | null;
  price: number; old_price: number | null;
  brand_id: number | null; category_id: number | null;
  condition: Condition; sizes: string[]; colors: string[]; images: string[];
  stock: number; is_new: boolean; is_popular: boolean;
  is_published: boolean; created_at: string;
};
type Brand = { id: number; name: string; slug: string };
type Category = { id: number; name: string; slug: string; image_url: string | null; sort_order: number };
type Filters = {
  q: string; brand: string[]; category: string | null; size: string[];
  condition: Condition[]; min: string; max: string; sort: Sort;
  newOnly: boolean; inStockOnly: boolean;
};
type Data = { products: Product[]; brands: Brand[]; categories: Category[] };

/* ---------------- Constants & demo data ---------------- */

const DEFAULT_FILTERS: Filters = {
  q: '', brand: [], category: null, size: [], condition: [],
  min: '', max: '', sort: 'newest', newOnly: false, inStockOnly: false
};

const SORTS: { value: Sort; label: string }[] = [
  { value: 'newest', label: 'Сначала новые' },
  { value: 'popular', label: 'Популярные' },
  { value: 'price-asc', label: 'Сначала дешевле' },
  { value: 'price-desc', label: 'Сначала дороже' },
  { value: 'discount', label: 'По скидке' }
];

const CONDITIONS: { value: Condition; label: string; short: string }[] = [
  { value: 'new', label: 'Новый с биркой', short: 'Новый' },
  { value: 'excellent', label: 'Отличное состояние', short: 'Отличное' },
  { value: 'good', label: 'Хорошее состояние', short: 'Хорошее' },
  { value: 'fair', label: 'Удовлетворительное', short: 'С ноской' }
];

const SIZE_ORDER = ['ONE SIZE','XS','S','M','L','XL','XXL','30','31','32','33','34','36','38','39','40','41','42','43','44','45','46'];

const I = (id: string) => `https://images.unsplash.com/${id}?q=80&w=1000&auto=format&fit=crop`;
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
  price: number, old_price: number | null, condition: Condition,
  sizes: string[], colors: string[], imgs: string[],
  stock: number, is_new: boolean, is_popular: boolean, age: number
): Product => ({
  id, title, slug,
  description: 'Оригинальная вещь. Проверена на подлинность. Дополнительные фото и замеры — по запросу.',
  price, old_price, brand_id, category_id, condition, sizes, colors,
  images: imgs.map(I), stock, is_new, is_popular, is_published: true, created_at: D(age)
});

const PRODUCTS: Product[] = [
  mk(1,'Куртка Stone Island Ghost Piece','stone-island-ghost-piece',1,1,42900,51900,'excellent',['S','M','L'],['Чёрный'],['photo-1591047139829-d91aecb6caea','photo-1551028719-00167b16eac5'],1,true,true,1),
  mk(2,'Худи Carhartt WIP Hooded Chase','carhartt-hooded-chase',2,3,8900,null,'new',['S','M','L','XL'],['Серый'],['photo-1556821840-3a63f95609a7','photo-1578932750294-f5075e85f44a'],3,true,false,2),
  mk(3,'Пуховик The North Face Nuptse 1996','tnf-nuptse-1996',3,1,24500,29900,'excellent',['M','L'],['Чёрный'],['photo-1544022613-e87ca75a784a','photo-1539533018447-63fcce2678e3'],1,false,true,4),
  mk(4,'Кроссовки Nike Air Max 90','nike-air-max-90',4,6,11900,null,'good',['40','41','42','43'],['Белый'],['photo-1600185365483-26d7a4cc7519','photo-1595950653106-6c9ebd614d3a'],2,false,true,6),
  mk(5,'Футболка Stüssy Basic Logo','stussy-basic-logo',6,2,4500,null,'new',['S','M','L'],['Белый'],['photo-1521572163474-6864f9cf17ab','photo-1576566588028-4147f3842f27'],4,true,false,1),
  mk(6,'Рубашка Ralph Lauren Oxford','ralph-lauren-oxford',7,4,7900,9900,'excellent',['M','L','XL'],['Голубой'],['photo-1596755094514-f87e34085b2c','photo-1602810318383-e386cc2a3ccf'],2,false,false,8),
  mk(7,'Джинсы Acne Studios 1996','acne-studios-1996',8,5,15900,null,'good',['30','31','32'],['Синий'],['photo-1542272604-787c3835535d','photo-1541099649105-f69ad21f3246'],1,false,false,10),
  mk(8,'Свитшот Adidas Trefoil','adidas-trefoil-sweatshirt',5,3,6500,null,'excellent',['S','M','L'],['Чёрный'],['photo-1556306535-0f09a537f0a3','photo-1578681994506-b8f463449011'],2,false,true,3),
  mk(9,'Кроссовки Adidas Samba OG','adidas-samba-og',5,6,10900,12900,'new',['39','40','41','42'],['Белый'],['photo-1600269452121-4f2416e55c28','photo-1560769629-975ec94e6a86'],3,true,true,2),
  mk(10,'Куртка Carhartt Detroit Jacket','carhartt-detroit-jacket',2,1,13500,null,'good',['M','L'],['Бежевый'],['photo-1520975954732-35dd22299614','photo-1525507119028-ed4c629a60a3'],1,false,false,12),
  mk(11,'Футболка The North Face Simple Dome','tnf-simple-dome',3,2,3200,null,'new',['S','M','L','XL'],['Чёрный'],['photo-1583743814966-8936f5b7be1a','photo-1581655353564-df123a1eb820'],5,true,false,1),
  mk(12,'Сумка Carhartt Essentials','carhartt-essentials-bag',2,7,5500,null,'excellent',['ONE SIZE'],['Чёрный'],['photo-1553062407-98eeb64c6a62','photo-1548036328-c9fa89d128fa'],2,false,false,5)
];

const DEMO: Data = { products: PRODUCTS, brands: BRANDS, categories: CATEGORIES };

/* ---------------- Data loading ---------------- */

async function loadData(): Promise<Data> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return DEMO;

  const supabase = createClient(url, key);
  const [p, b, c] = await Promise.all([
    supabase.from('products').select('*').eq('is_published', true).order('created_at', { ascending: false }),
    supabase.from('brands').select('id,name,slug').order('name'),
    supabase.from('categories').select('id,name,slug,image_url,sort_order').order('sort_order')
  ]);
  if (p.error) throw new Error(p.error.message);
  if (b.error) throw new Error(b.error.message);
  if (c.error) throw new Error(c.error.message);

  return {
    products: (p.data ?? []).map((x) => ({ ...x, price: Number(x.price), old_price: x.old_price == null ? null : Number(x.old_price) })) as Product[],
    brands: (b.data ?? []) as Brand[],
    categories: (c.data ?? []) as Category[]
  };
}

/* ---------------- Utils ---------------- */

const money = (n: number) => new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 }).format(n) + ' ₽';
const plural = (n: number, a: string, b: string, c: string) => {
  const m = Math.abs(n) % 100, k = m % 10;
  if (m > 10 && m < 20) return c;
  if (k > 1 && k < 5) return b;
  if (k === 1) return a;
  return c;
};
const sale = (p: Product) => p.old_price && p.old_price > p.price ? Math.round((1 - p.price / p.old_price) * 100) : 0;
const condLabel = (c: Condition) => CONDITIONS.find((x) => x.value === c)?.short ?? c;

function parseFilters(search: string): Filters {
  const s = new URLSearchParams(search);
  const arr = (k: string) => s.get(k)?.split(',').filter(Boolean) ?? [];
  const sort = s.get('sort') as Sort | null;
  return {
    q: s.get('q') ?? '', brand: arr('brand'), category: s.get('category'),
    size: arr('size'),
    condition: arr('condition').filter((c): c is Condition => CONDITIONS.some((x) => x.value === c)),
    min: s.get('min') ?? '', max: s.get('max') ?? '',
    sort: sort && SORTS.some((x) => x.value === sort) ? sort : 'newest',
    newOnly: s.get('new') === '1', inStockOnly: s.get('stock') === '1'
  };
}

function serializeFilters(f: Filters): string {
  const s = new URLSearchParams();
  if (f.q.trim()) s.set('q', f.q.trim());
  if (f.brand.length) s.set('brand', f.brand.join(','));
  if (f.category) s.set('category', f.category);
  if (f.size.length) s.set('size', f.size.join(','));
  if (f.condition.length) s.set('condition', f.condition.join(','));
  if (f.min) s.set('min', f.min);
  if (f.max) s.set('max', f.max);
  if (f.sort !== 'newest') s.set('sort', f.sort);
  if (f.newOnly) s.set('new', '1');
  if (f.inStockOnly) s.set('stock', '1');
  return s.toString();
}

function collectSizes(products: Product[]): string[] {
  return [...new Set(products.flatMap((p) => p.sizes))].sort((a, b) => {
    const ai = SIZE_ORDER.indexOf(a), bi = SIZE_ORDER.indexOf(b);
    if (ai === -1 && bi === -1) return a.localeCompare(b, 'ru');
    if (ai === -1) return 1;
    if (bi === -1) return -1;
    return ai - bi;
  });
}

function applyFilters(data: Data, f: Filters): Product[] {
  const brandIds = new Set(data.brands.filter((b) => f.brand.includes(b.slug)).map((b) => b.id));
  const catId = f.category ? data.categories.find((c) => c.slug === f.category)?.id ?? null : null;
  const q = f.q.trim().toLowerCase();
  const min = f.min === '' ? null : Number(f.min);
  const max = f.max === '' ? null : Number(f.max);

  const list = data.products.filter((p) => {
    if (f.newOnly && !p.is_new) return false;
    if (f.inStockOnly && p.stock <= 0) return false;
    if (catId != null && p.category_id !== catId) return false;
    if (brandIds.size && (p.brand_id == null || !brandIds.has(p.brand_id))) return false;
    if (f.size.length && !f.size.some((s) => p.sizes.includes(s))) return false;
    if (f.condition.length && !f.condition.includes(p.condition)) return false;
    if (min != null && !Number.isNaN(min) && p.price < min) return false;
    if (max != null && !Number.isNaN(max) && p.price > max) return false;
    if (q) {
      const brand = data.brands.find((b) => b.id === p.brand_id)?.name ?? '';
      if (![p.title, p.description ?? '', brand, p.colors.join(' ')].join(' ').toLowerCase().includes(q)) return false;
    }
    return true;
  });

  const byDate = (a: Product, b: Product) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  switch (f.sort) {
    case 'price-asc': return list.sort((a, b) => a.price - b.price || byDate(a, b));
    case 'price-desc': return list.sort((a, b) => b.price - a.price || byDate(a, b));
    case 'popular': return list.sort((a, b) => Number(b.is_popular) - Number(a.is_popular) || byDate(a, b));
    case 'discount': return list.sort((a, b) => sale(b) - sale(a) || byDate(a, b));
    default: return list.sort(byDate);
  }
}

/* ---------------- Page ---------------- */

export default function CatalogPage() {
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [visible, setVisible] = useState(12);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [toasts, setToasts] = useState<{ id: number; title: string; desc?: string }[]>([]);
  const urlReady = useRef(false);

  const load = useCallback(async () => {
    setError(null); setData(null);
    try { setData(await loadData()); }
    catch (e) { setError(e instanceof Error ? e.message : 'Не удалось загрузить каталог'); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    if (!data || urlReady.current) return;
    urlReady.current = true;
    setFilters(parseFilters(window.location.search));
  }, [data]);

  useEffect(() => {
    if (!urlReady.current) return;
    const qs = serializeFilters(filters);
    window.history.replaceState(null, '', qs ? `/catalog?${qs}` : '/catalog');
    setVisible(12);
  }, [filters]);

  useEffect(() => {
    document.body.style.overflow = mobileOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [mobileOpen]);

  const patch = (p: Partial<Filters>) => setFilters((f) => ({ ...f, ...p }));
  const toggle = (key: 'brand' | 'size' | 'condition', value: string) =>
    setFilters((f) => {
      const arr = f[key] as string[];
      return { ...f, [key]: arr.includes(value) ? arr.filter((x) => x !== value) : [...arr, value] };
    });
  const reset = () => setFilters((f) => ({ ...DEFAULT_FILTERS, q: f.q, sort: f.sort }));

  const filtered = useMemo(() => data ? applyFilters(data, filters) : [], [data, filters]);
  const sizes = useMemo(() => data ? collectSizes(data.products) : [], [data]);
  const brandName = useCallback((id: number | null) => data?.brands.find((b) => b.id === id)?.name ?? '', [data]);

  const activeCount =
    filters.brand.length + filters.size.length + filters.condition.length +
    (filters.category ? 1 : 0) + (filters.min ? 1 : 0) + (filters.max ? 1 : 0) +
    (filters.newOnly ? 1 : 0) + (filters.inStockOnly ? 1 : 0);

  const pushToast = (title: string, desc?: string) => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, title, desc }]);
    window.setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3200);
  };

  const addToCart = (p: Product) => {
    if (p.stock <= 0) return;
    try {
      const raw = localStorage.getItem('reform-cart-v1');
      const parsed = raw ? JSON.parse(raw) : { state: { items: [] }, version: 0 };
      const items = Array.isArray(parsed?.state?.items) ? parsed.state.items : [];
      const size = p.sizes[0] ?? null, color = p.colors[0] ?? null;
      const key = `${p.id}::${size ?? ''}::${color ?? ''}`;
      const ex = items.find((x: any) => x.key === key);
      if (ex) ex.quantity = Math.min(ex.quantity + 1, p.stock);
      else items.push({
        key, product_id: p.id, slug: p.slug, title: p.title, brand: brandName(p.brand_id),
        price: p.price, image: p.images[0] ?? null, size, color, quantity: 1, stock: p.stock
      });
      localStorage.setItem('reform-cart-v1', JSON.stringify({ state: { items }, version: 0 }));
      window.dispatchEvent(new Event('reform-cart-updated'));
      pushToast('Добавлено в корзину', `${p.title}${size ? ` · ${size}` : ''}`);
    } catch { pushToast('Не удалось добавить товар'); }
  };

  const currentCategory = data?.categories.find((c) => c.slug === filters.category);
  const heading = filters.newOnly ? 'Новинки' : currentCategory?.name ?? 'Каталог';

  return (
    <div className="min-h-screen bg-paper text-ink">
      {/* Header */}
      <section className="relative overflow-hidden border-b border-line">
        <div className="pointer-events-none absolute inset-0" style={{
          background: 'radial-gradient(60% 80% at 10% 10%, rgba(154,59,38,.10), transparent 60%), radial-gradient(50% 70% at 90% 20%, rgba(29,78,216,.06), transparent 60%), linear-gradient(180deg,#FBFAF7,#F6F4EF)'
        }} />
        <div className="relative mx-auto max-w-[1440px] px-4 py-10 sm:px-6 lg:px-10 lg:py-14">
          <p className="text-[10px] font-semibold uppercase tracking-[0.32em] text-accent">RE:FORM · Брендовый ресейл</p>
          <div className="mt-4 flex flex-wrap items-end gap-x-6 gap-y-2">
            <h1 className="text-[clamp(2.6rem,7vw,5.5rem)] font-medium leading-[0.92] tracking-[-0.04em]">{heading}</h1>
            <span className="mb-1 border-l border-ink/20 pl-4 text-sm text-mute">
              {data ? `${filtered.length} ${plural(filtered.length, 'товар', 'товара', 'товаров')}` : 'Загрузка…'}
            </span>
          </div>
          <p className="mt-5 max-w-xl text-sm leading-relaxed text-ink-soft sm:text-base">
            Оригинальные вещи с честным описанием состояния. Фильтруйте по бренду, размеру и цене — каждая позиция проверена перед продажей.
          </p>
        </div>
      </section>

      {/* Toolbar */}
      <div className="sticky top-0 z-30 border-b border-line bg-paper/95 backdrop-blur-xl">
        <div className="mx-auto max-w-[1440px] px-4 py-3 sm:px-6 lg:px-10">
          <div className="flex flex-col gap-2 lg:flex-row">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-mute" />
              <input value={filters.q} onChange={(e) => patch({ q: e.target.value })}
                placeholder="Поиск: Stone Island, худи, чёрный…"
                className="h-12 w-full border border-line bg-surface pl-11 pr-11 text-sm outline-none transition placeholder:text-mute/60 focus:border-ink" />
              {filters.q && (
                <button onClick={() => patch({ q: '' })} aria-label="Очистить поиск"
                  className="absolute right-3 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center text-mute hover:text-ink">
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
            <div className="flex gap-2">
              <button onClick={() => setMobileOpen(true)}
                className="inline-flex h-12 items-center gap-2 border border-ink bg-surface px-4 text-[11px] font-semibold uppercase tracking-[0.16em] transition hover:bg-ink hover:text-paper lg:hidden">
                <SlidersHorizontal className="h-4 w-4" /> Фильтры
                {activeCount > 0 && <span className="grid h-5 min-w-5 place-items-center rounded-full bg-accent px-1 text-[10px] text-white">{activeCount}</span>}
              </button>
              <div className="relative flex-1 lg:w-56 lg:flex-none">
                <select value={filters.sort} onChange={(e) => patch({ sort: e.target.value as Sort })}
                  className="h-12 w-full appearance-none border border-line bg-surface px-4 pr-10 text-[11px] font-medium uppercase tracking-[0.12em] outline-none focus:border-ink">
                  {SORTS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
                <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-mute" />
              </div>
            </div>
          </div>

          <div className="no-scrollbar mt-3 flex gap-2 overflow-x-auto">
            <Chip active={!filters.category} onClick={() => patch({ category: null })}>Все</Chip>
            {data?.categories.map((c) => (
              <Chip key={c.id} active={filters.category === c.slug}
                onClick={() => patch({ category: filters.category === c.slug ? null : c.slug })}>{c.name}</Chip>
            ))}
            <Chip active={filters.newOnly} onClick={() => patch({ newOnly: !filters.newOnly })} tone="accent">Только новинки</Chip>
            <Chip active={filters.inStockOnly} onClick={() => patch({ inStockOnly: !filters.inStockOnly })} tone="success">В наличии</Chip>
          </div>
        </div>
      </div>

      {/* Active filters */}
      {data && activeCount > 0 && (
        <div className="border-b border-line bg-surface/60">
          <div className="mx-auto flex max-w-[1440px] flex-wrap items-center gap-2 px-4 py-3 sm:px-6 lg:px-10">
            <span className="text-[10px] uppercase tracking-[0.2em] text-mute">Активно:</span>
            {currentCategory && <Tag label={currentCategory.name} onRemove={() => patch({ category: null })} />}
            {filters.brand.map((s) => <Tag key={s} label={data.brands.find((b) => b.slug === s)?.name ?? s} onRemove={() => toggle('brand', s)} />)}
            {filters.size.map((s) => <Tag key={s} label={`Размер ${s}`} onRemove={() => toggle('size', s)} />)}
            {filters.condition.map((c) => <Tag key={c} label={condLabel(c)} onRemove={() => toggle('condition', c)} />)}
            {(filters.min || filters.max) && <Tag label={`${filters.min || '0'} — ${filters.max || '∞'} ₽`} onRemove={() => patch({ min: '', max: '' })} />}
            {filters.newOnly && <Tag label="Новинки" onRemove={() => patch({ newOnly: false })} />}
            {filters.inStockOnly && <Tag label="В наличии" onRemove={() => patch({ inStockOnly: false })} />}
            <button onClick={reset} className="ml-auto inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-accent">
              <RotateCcw className="h-3 w-3" /> Сбросить
            </button>
          </div>
        </div>
      )}

      {/* Content */}
      <div className="mx-auto max-w-[1440px] px-4 py-8 sm:px-6 lg:px-10">
        {error ? <ErrorState message={error} onRetry={load} /> : !data ? <SkeletonGrid /> : (
          <div className="grid gap-10 lg:grid-cols-[260px_minmax(0,1fr)]">
            <aside className="hidden lg:block">
              <div className="catalog-scroll sticky top-[15.5rem] max-h-[calc(100vh-17rem)] overflow-y-auto border border-line bg-surface p-5">
                <FilterPanel data={data} filters={filters} sizes={sizes} patch={patch} toggle={toggle} reset={reset} />
              </div>
            </aside>

            <section>
              <div className="mb-6 flex items-center justify-between">
                <p className="text-xs uppercase tracking-[0.18em] text-mute">Показано {Math.min(visible, filtered.length)} из {filtered.length}</p>
                <p className="hidden text-xs text-mute sm:block">Проверка подлинности · Отправка за 48 часов</p>
              </div>

              {filtered.length === 0 ? <EmptyState onReset={reset} /> : (
                <>
                  <div className="grid grid-cols-2 gap-x-3 gap-y-8 sm:gap-x-5 lg:grid-cols-3 xl:grid-cols-4">
                    {filtered.slice(0, visible).map((p, i) => (
                      <ProductCard key={p.id} product={p} brand={brandName(p.brand_id)} index={i} onAdd={addToCart} />
                    ))}
                  </div>
                  {filtered.length > visible && (
                    <div className="mt-12 text-center">
                      <button onClick={() => setVisible((v) => v + 12)}
                        className="inline-flex h-12 items-center gap-2 border border-ink bg-surface px-8 text-[11px] font-semibold uppercase tracking-[0.18em] transition hover:bg-ink hover:text-paper">
                        Показать ещё <span className="text-mute">{filtered.length - visible}</span>
                      </button>
                    </div>
                  )}
                </>
              )}
            </section>
          </div>
        )}
      </div>

      {/* Mobile filters */}
      {mobileOpen && data && (
        <div className="fixed inset-0 z-[80] lg:hidden">
          <div className="absolute inset-0 bg-ink/45 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
          <div className="catalog-scroll absolute inset-y-0 right-0 flex w-full max-w-sm flex-col overflow-y-auto bg-paper animate-drawer-in">
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-line bg-paper/95 px-5 py-4 backdrop-blur">
              <h2 className="text-lg font-medium tracking-tight">Фильтры</h2>
              <button onClick={() => setMobileOpen(false)} aria-label="Закрыть"
                className="grid h-10 w-10 place-items-center border border-line bg-surface"><X className="h-4 w-4" /></button>
            </div>
            <div className="flex-1 p-5">
              <FilterPanel data={data} filters={filters} sizes={sizes} patch={patch} toggle={toggle} reset={reset} />
            </div>
            <div className="sticky bottom-0 border-t border-line bg-surface p-4">
              <button onClick={() => setMobileOpen(false)}
                className="flex h-12 w-full items-center justify-center gap-2 bg-ink text-[11px] font-semibold uppercase tracking-[0.18em] text-paper">
                <Check className="h-4 w-4" /> Показать {filtered.length} {plural(filtered.length, 'товар', 'товара', 'товаров')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toasts */}
      <div className="pointer-events-none fixed bottom-4 right-4 z-[90] flex w-[calc(100vw-2rem)] max-w-sm flex-col gap-2">
        {toasts.map((t) => (
          <div key={t.id} className="pointer-events-auto flex items-start gap-3 bg-ink p-4 text-paper shadow-2xl animate-toast-in">
            <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-success"><Check className="h-3 w-3" /></span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">{t.title}</p>
              {t.desc && <p className="mt-0.5 truncate text-xs text-paper/60">{t.desc}</p>}
            </div>
            <button onClick={() => setToasts((x) => x.filter((i) => i.id !== t.id))} aria-label="Закрыть" className="text-paper/50 hover:text-paper"><X className="h-4 w-4" /></button>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------------- Components ---------------- */

function Chip({ active, onClick, children, tone = 'ink' }: {
  active: boolean; onClick: () => void; children: ReactNode; tone?: 'ink' | 'accent' | 'success';
}) {
  const activeCls = tone === 'accent' ? 'border-accent bg-accent text-white'
    : tone === 'success' ? 'border-success bg-success text-white'
    : 'border-ink bg-ink text-paper';
  const idleCls = tone === 'accent' ? 'hover:border-accent hover:text-accent'
    : tone === 'success' ? 'hover:border-success hover:text-success'
    : 'hover:border-ink';
  return (
    <button onClick={onClick}
      className={`h-9 shrink-0 border px-4 text-[10px] font-semibold uppercase tracking-[0.16em] transition ${active ? activeCls : `border-line bg-surface ${idleCls}`}`}>
      {children}
    </button>
  );
}

function ProductCard({ product, brand, index, onAdd }: {
  product: Product; brand: string; index: number; onAdd: (p: Product) => void;
}) {
  const discount = sale(product);
  const soldOut = product.stock <= 0;
  return (
    <article className="group animate-fade-up" style={{ animationDelay: `${Math.min(index, 11) * 45}ms` }}>
      <Link href={`/product/${product.slug}`} className="block">
        <div className="relative aspect-[3/4] overflow-hidden bg-line/40">
          {product.images[0] ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={product.images[0]} alt={product.title} loading={index < 4 ? 'eager' : 'lazy'}
              className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.045]" />
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
            {soldOut && <span className="bg-surface/90 px-2.5 py-1 text-[9px] font-medium uppercase tracking-[0.18em]">Продано</span>}
          </div>
        </div>
      </Link>
      <div className="border-x border-b border-line bg-surface p-3.5">
        <div className="flex items-start justify-between gap-2">
          <p className="truncate text-[10px] font-medium uppercase tracking-[0.2em] text-mute">{brand || 'Без бренда'}</p>
          <span className="shrink-0 text-[10px] text-mute">{condLabel(product.condition)}</span>
        </div>
        <Link href={`/product/${product.slug}`}>
          <h3 className="mt-1.5 line-clamp-2 min-h-[2.5rem] text-[13px] font-medium leading-snug tracking-tight transition-colors group-hover:text-accent">{product.title}</h3>
        </Link>
        <div className="mt-2 flex items-end justify-between gap-2">
          <div>
            <p className="text-sm font-semibold">{money(product.price)}</p>
            {product.old_price && product.old_price > product.price && <p className="text-[11px] text-mute line-through">{money(product.old_price)}</p>}
          </div>
          <button disabled={soldOut} onClick={() => onAdd(product)} aria-label="Добавить в корзину" title={soldOut ? 'Продано' : 'В корзину'}
            className="grid h-9 w-9 place-items-center border border-ink bg-surface transition hover:bg-ink hover:text-paper disabled:cursor-not-allowed disabled:border-line disabled:text-mute/40 disabled:hover:bg-surface">
            <ShoppingBag className="h-3.5 w-3.5" />
          </button>
        </div>
        {product.sizes.length > 0 && (
          <div className="mt-2.5 flex flex-wrap gap-1 border-t border-line/60 pt-2.5">
            {product.sizes.slice(0, 4).map((s) => <span key={s} className="border border-line px-1.5 py-0.5 text-[9px] uppercase text-mute">{s}</span>)}
            {product.sizes.length > 4 && <span className="px-1 py-0.5 text-[9px] text-mute">+{product.sizes.length - 4}</span>}
          </div>
        )}
      </div>
    </article>
  );
}

function FilterPanel({ data, filters, sizes, patch, toggle, reset }: {
  data: Data; filters: Filters; sizes: string[];
  patch: (p: Partial<Filters>) => void;
  toggle: (key: 'brand' | 'size' | 'condition', value: string) => void;
  reset: () => void;
}) {
  return (
    <div className="space-y-7">
      <div className="flex items-center justify-between">
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.22em]">Фильтры</h2>
        <button onClick={reset} className="text-[10px] font-medium uppercase tracking-[0.16em] text-accent">Сбросить</button>
      </div>

      <Section title="Бренд">
        <div className="space-y-2.5">
          {data.brands.map((b) => {
            const checked = filters.brand.includes(b.slug);
            const count = data.products.filter((x) => x.brand_id === b.id).length;
            return (
              <label key={b.id} className="group flex cursor-pointer items-center gap-3">
                <span className={`grid h-4 w-4 place-items-center border transition ${checked ? 'border-ink bg-ink text-paper' : 'border-line bg-surface group-hover:border-ink'}`}>
                  {checked && <Check className="h-3 w-3" />}
                </span>
                <input type="checkbox" checked={checked} onChange={() => toggle('brand', b.slug)} className="sr-only" />
                <span className="flex-1 text-[13px]">{b.name}</span>
                <span className="text-[11px] text-mute/70">{count}</span>
              </label>
            );
          })}
        </div>
      </Section>

      <Section title="Размер">
        <div className="flex flex-wrap gap-1.5">
          {sizes.map((s) => (
            <button key={s} onClick={() => toggle('size', s)}
              className={`h-8 min-w-8 border px-2 text-[10px] font-semibold uppercase transition ${filters.size.includes(s) ? 'border-ink bg-ink text-paper' : 'border-line bg-surface hover:border-ink'}`}>{s}</button>
          ))}
        </div>
      </Section>

      <Section title="Цена, ₽">
        <div className="flex items-center gap-2">
          <input type="number" min={0} value={filters.min} onChange={(e) => patch({ min: e.target.value })} placeholder="От"
            className="h-10 w-full border border-line bg-surface px-3 text-sm outline-none focus:border-ink" />
          <span className="text-mute/60">—</span>
          <input type="number" min={0} value={filters.max} onChange={(e) => patch({ max: e.target.value })} placeholder="До"
            className="h-10 w-full border border-line bg-surface px-3 text-sm outline-none focus:border-ink" />
        </div>
      </Section>

      <Section title="Состояние">
        <div className="space-y-2.5">
          {CONDITIONS.map((c) => {
            const checked = filters.condition.includes(c.value);
            const count = data.products.filter((x) => x.condition === c.value).length;
            return (
              <label key={c.value} className="group flex cursor-pointer items-center gap-3">
                <span className={`grid h-4 w-4 place-items-center border transition ${checked ? 'border-ink bg-ink text-paper' : 'border-line bg-surface group-hover:border-ink'}`}>
                  {checked && <Check className="h-3 w-3" />}
                </span>
                <input type="checkbox" checked={checked} onChange={() => toggle('condition', c.value)} className="sr-only" />
                <span className="flex-1 text-[13px]">{c.label}</span>
                <span className="text-[11px] text-mute/70">{count}</span>
              </label>
            );
          })}
        </div>
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="border-t border-line/60 pt-5 first:border-t-0 first:pt-0">
      <h3 className="mb-3 text-[10px] font-semibold uppercase tracking-[0.22em] text-mute">{title}</h3>
      {children}
    </section>
  );
}

function Tag({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <button onClick={onRemove}
      className="inline-flex h-7 items-center gap-1.5 border border-line bg-surface px-2.5 text-[10px] font-medium uppercase tracking-[0.12em] text-ink-soft transition hover:border-accent hover:text-accent">
      {label} <X className="h-3 w-3" />
    </button>
  );
}

function SkeletonGrid() {
  return (
    <div className="grid gap-10 lg:grid-cols-[260px_minmax(0,1fr)]">
      <div className="hidden border border-line bg-surface p-5 lg:block">
        <div className="mb-6 h-4 w-24 animate-pulse bg-line" />
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="mb-7 space-y-3">
            <div className="h-3 w-16 animate-pulse bg-line" />
            <div className="h-3 w-full animate-pulse bg-line" />
            <div className="h-3 w-5/6 animate-pulse bg-line" />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-x-3 gap-y-8 sm:gap-x-5 lg:grid-cols-3 xl:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i}>
            <div className="aspect-[3/4] w-full animate-pulse bg-line" />
            <div className="border-x border-b border-line bg-surface p-3.5">
              <div className="h-2.5 w-20 animate-pulse bg-line" />
              <div className="mt-3 h-3.5 w-full animate-pulse bg-line" />
              <div className="mt-2 h-3.5 w-2/3 animate-pulse bg-line" />
              <div className="mt-3 h-4 w-24 animate-pulse bg-line" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function EmptyState({ onReset }: { onReset: () => void }) {
  return (
    <div className="grid min-h-[420px] place-items-center border border-line bg-surface px-6 text-center">
      <div>
        <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-paper"><Search className="h-6 w-6 text-mute" /></div>
        <h2 className="mt-5 text-xl font-medium tracking-tight">Ничего не найдено</h2>
        <p className="mx-auto mt-2 max-w-sm text-sm text-mute">Измените запрос или сбросьте часть фильтров. Новинки приезжают каждую неделю.</p>
        <button onClick={onReset} className="mt-6 inline-flex h-11 items-center gap-2 bg-ink px-6 text-[11px] font-semibold uppercase tracking-[0.18em] text-paper transition hover:bg-accent">
          <RotateCcw className="h-4 w-4" /> Сбросить фильтры
        </button>
      </div>
    </div>
  );
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="grid min-h-[420px] place-items-center border border-danger/20 bg-surface px-6 text-center">
      <div>
        <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-danger/10"><AlertTriangle className="h-6 w-6 text-danger" /></div>
        <h2 className="mt-5 text-xl font-medium tracking-tight">Каталог не загрузился</h2>
        <p className="mx-auto mt-2 max-w-md text-sm text-mute">{message}</p>
        <button onClick={onRetry} className="mt-6 inline-flex h-11 items-center gap-2 bg-ink px-6 text-[11px] font-semibold uppercase tracking-[0.18em] text-paper transition hover:bg-accent">
          <RotateCcw className="h-4 w-4" /> Попробовать снова
        </button>
      </div>
    </div>
  );
}
