'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { createClient } from '@supabase/supabase-js';
import {
  ArrowRight, ArrowUpRight, BadgeCheck, Clock, ExternalLink, Instagram,
  Mail, MapPin, Phone, RefreshCcw, Send, ShieldCheck, ShoppingBag, Truck
} from 'lucide-react';

type Condition = 'new' | 'excellent' | 'good' | 'fair';
type Product = {
  id: number; title: string; slug: string; description: string | null;
  price: number; old_price: number | null; brand_id: number | null; category_id: number | null;
  condition: Condition; sizes: string[]; colors: string[]; images: string[];
  stock: number; is_new: boolean; is_popular: boolean; created_at: string;
};
type Brand = { id: number; name: string; slug: string };
type Category = { id: number; name: string; slug: string; image_url: string | null; sort_order: number };
type Banner = { id: number; title: string | null; subtitle: string | null; image_url: string; link_url: string | null; sort_order: number };
type Data = { products: Product[]; brands: Brand[]; categories: Category[]; banners: Banner[] };

const I = (id: string, w = 1000) => `https://images.unsplash.com/${id}?q=80&w=${w}&auto=format&fit=crop`;
const D = (n: number) => new Date(Date.now() - n * 864e5).toISOString();

const CONTACTS = {
  phone: '+7 (999) 123-45-67',
  phoneHref: 'tel:+79991234567',
  email: 'hello@reform.store',
  telegram: 'https://t.me/reform_store',
  whatsapp: 'https://wa.me/79991234567',
  avito: 'https://www.avito.ru',
  instagram: 'https://instagram.com',
  address: 'Москва, ул. Большая Никитская, 12',
  hours: 'Ежедневно 12:00–21:00 · примерка по записи'
};

const BRAND_STYLE: Record<string, string> = {
  nike: 'text-2xl font-black italic tracking-tight',
  adidas: 'text-2xl font-bold lowercase tracking-tight',
  'stone-island': 'text-xs font-medium uppercase tracking-[0.3em]',
  'carhartt-wip': 'text-lg font-black uppercase tracking-wide',
  'the-north-face': 'text-sm font-bold uppercase tracking-wide',
  stussy: 'font-serif text-2xl font-semibold italic',
  'ralph-lauren': 'font-serif text-sm uppercase tracking-[0.25em]',
  'acne-studios': 'text-sm font-light uppercase tracking-[0.3em]'
};

const MARQUEE = [
  'Новые поступления каждую неделю', '100% аутентичность', 'Доставка по всей России',
  'Честное описание состояния', 'Возврат 14 дней'
];

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
  colors: string[], imgs: string[], stock: number, is_new: boolean, is_popular: boolean, age: number
): Product => ({
  id, title, slug,
  description: 'Оригинальная вещь. Проверена на подлинность. Дополнительные фото и замеры — по запросу.',
  price, old_price, brand_id, category_id, condition, sizes, colors,
  images: imgs.map((x) => I(x)), stock, is_new, is_popular, created_at: D(age)
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

const BANNERS: Banner[] = [
  { id: 1, title: 'Стиль с историей', subtitle: 'Брендовый ресейл с проверкой подлинности', image_url: I('photo-1469334031218-e382a71b716b', 1600), link_url: '/catalog?new=1', sort_order: 1 },
  { id: 2, title: 'С Авито — в собственный магазин', subtitle: 'Весь ассортимент теперь здесь', image_url: I('photo-1441986300917-64674bd600d8', 1600), link_url: '/catalog', sort_order: 2 }
];

const DEMO: Data = { products: PRODUCTS, brands: BRANDS, categories: CATEGORIES, banners: BANNERS };

async function loadData(): Promise<Data> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return DEMO;

  const supabase = createClient(url, key);
  const [p, b, c, bn] = await Promise.all([
    supabase.from('products')
      .select('id,title,slug,description,price,old_price,brand_id,category_id,condition,sizes,colors,images,stock,is_new,is_popular,created_at')
      .eq('is_published', true).order('created_at', { ascending: false }),
    supabase.from('brands').select('id,name,slug').order('name'),
    supabase.from('categories').select('id,name,slug,image_url,sort_order').order('sort_order'),
    supabase.from('banners').select('id,title,subtitle,image_url,link_url,sort_order').eq('is_active', true).order('sort_order')
  ]);
  if (p.error) throw new Error(p.error.message);
  if (b.error) throw new Error(b.error.message);
  if (c.error) throw new Error(c.error.message);
  if (bn.error) throw new Error(bn.error.message);

  return {
    products: (p.data ?? []).map((x) => ({ ...x, price: Number(x.price), old_price: x.old_price == null ? null : Number(x.old_price) })) as Product[],
    brands: (b.data ?? []) as Brand[],
    categories: (c.data ?? []) as Category[],
    banners: (bn.data ?? []) as Banner[]
  };
}

const money = (n: number) => new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 }).format(n) + ' ₽';
const sale = (p: Product) => p.old_price && p.old_price > p.price ? Math.round((1 - p.price / p.old_price) * 100) : 0;
const plural = (n: number, a: string, b: string, c: string) => {
  const m = Math.abs(n) % 100, k = m % 10;
  if (m > 10 && m < 20) return c;
  if (k > 1 && k < 5) return b;
  if (k === 1) return a;
  return c;
};

export default function HomePage() {
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [toasts, setToasts] = useState<{ id: number; title: string; desc?: string }[]>([]);
  const heroRef = useRef<HTMLDivElement>(null);
  const [shift, setShift] = useState(0);

  const load = useCallback(async () => {
    setError(null); setData(null);
    try { setData(await loadData()); }
    catch (e) { setError(e instanceof Error ? e.message : 'Не удалось загрузить главную'); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    let frame = 0;
    const onScroll = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(() => {
        frame = 0;
        const el = heroRef.current;
        if (!el) return;
        const rect = el.getBoundingClientRect();
        if (rect.bottom < 0 || rect.top > window.innerHeight) return;
        setShift(Math.max(-40, Math.min(40, (window.innerHeight / 2 - rect.top - rect.height / 2) * 0.06)));
      });
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, [data]);

  const brandName = useCallback(
    (id: number | null) => data?.brands.find((b) => b.id === id)?.name ?? '',
    [data]
  );

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

  const sections = useMemo(() => {
    if (!data) return null;
    const fresh = data.products.filter((p) => p.is_new).slice(0, 4);
    const popSrc = data.products.filter((p) => p.is_popular);
    return {
      hero: data.banners[0] ?? BANNERS[0],
      editorial: data.banners[1] ?? BANNERS[1],
      heroProduct: data.products[0] ?? null,
      newArrivals: fresh.length ? fresh : data.products.slice(0, 4),
      popular: (popSrc.length >= 4 ? popSrc : data.products.slice(4, 8)).slice(0, 4),
      cats: ['outerwear', 'hoodies', 'shoes', 'accessories']
        .map((s) => data.categories.find((c) => c.slug === s))
        .filter(Boolean) as Category[],
      brands: data.brands.slice(0, 8)
    };
  }, [data]);

  if (error) {
    return (
      <div className="mx-auto grid min-h-[60vh] max-w-[1440px] place-items-center px-4">
        <div className="text-center">
          <h1 className="text-2xl font-medium tracking-tight">Главная не загрузилась</h1>
          <p className="mx-auto mt-2 max-w-md text-sm text-mute">{error}</p>
          <button onClick={load} className="mt-6 inline-flex h-11 items-center gap-2 bg-ink px-6 text-[11px] font-semibold uppercase tracking-[0.18em] text-paper transition hover:bg-accent">
            <RefreshCcw className="h-4 w-4" /> Попробовать снова
          </button>
        </div>
      </div>
    );
  }

  if (!data || !sections) return <HomeSkeleton />;

  return (
    <>
      {/* HERO */}
      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0" style={{
          background: 'radial-gradient(55% 70% at 8% 0%, rgba(154,59,38,.12), transparent 62%), radial-gradient(45% 60% at 95% 15%, rgba(29,78,216,.07), transparent 60%), linear-gradient(180deg,#FBFAF7,#F6F4EF)'
        }} />
        <div className="relative mx-auto max-w-[1440px] px-4 pt-6 sm:px-6 lg:px-10 lg:pt-12">
          <div className="grid items-center gap-10 lg:grid-cols-2">
            <div>
              <p className="animate-fade-up text-[11px] font-medium uppercase tracking-[0.28em] text-accent">Брендовый ресейл · Москва</p>
              <h1 className="mt-5 animate-fade-up text-5xl font-medium leading-[1.02] tracking-tight sm:text-6xl lg:text-7xl" style={{ animationDelay: '80ms' }}>
                Одежда,<br />у которой есть<br /><span className="font-serif italic text-accent">история.</span>
              </h1>
              <p className="mt-6 max-w-md animate-fade-up text-base leading-relaxed text-ink-soft" style={{ animationDelay: '160ms' }}>
                Stone Island, Carhartt WIP, The North Face и другие бренды — каждая вещь проверена на подлинность, честно описана и готова к новой жизни.
              </p>
              <div className="mt-8 flex animate-fade-up flex-wrap gap-3" style={{ animationDelay: '240ms' }}>
                <Link href="/catalog" className="inline-flex h-[52px] items-center gap-2 bg-ink px-8 text-xs font-medium uppercase tracking-[0.14em] text-paper transition hover:bg-accent">
                  Смотреть каталог <ArrowRight className="h-4 w-4" />
                </Link>
                <Link href="/catalog?new=1" className="inline-flex h-[52px] items-center border border-ink px-8 text-xs font-medium uppercase tracking-[0.14em] transition hover:bg-ink hover:text-paper">
                  Новинки
                </Link>
              </div>
              <div className="mt-12 grid animate-fade-up grid-cols-3 gap-6 border-t border-line pt-6" style={{ animationDelay: '320ms' }}>
                {[['100%', 'аутентичность'], ['48 ч', 'отправка заказа'], ['14 дней', 'на возврат']].map(([n, l]) => (
                  <div key={l}>
                    <p className="text-2xl font-medium tracking-tight sm:text-3xl">{n}</p>
                    <p className="mt-1 text-xs uppercase tracking-[0.14em] text-mute">{l}</p>
                  </div>
                ))}
              </div>
            </div>

            <div ref={heroRef} className="relative animate-fade-up" style={{ animationDelay: '200ms' }}>
              <div className="absolute -left-4 -top-4 h-full w-full border border-accent/40" aria-hidden />
              <div className="relative aspect-[4/5] overflow-hidden bg-line/40">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={sections.hero.image_url} alt={sections.hero.title ?? 'RE:FORM'}
                  style={{ transform: `translateY(${shift}px) scale(1.08)` }}
                  className="h-full w-full object-cover transition-transform duration-300 ease-out" />
              </div>
              {sections.heroProduct && (
                <Link href={`/product/${sections.heroProduct.slug}`}
                  className="group absolute bottom-5 left-5 flex items-center gap-3 bg-surface p-3 pr-4 shadow-xl transition hover:bg-ink hover:text-paper">
                  <div className="relative h-14 w-12 shrink-0 overflow-hidden bg-line/40">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={sections.heroProduct.images[0]} alt="" className="h-full w-full object-cover" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] uppercase tracking-[0.16em] text-mute group-hover:text-paper/60">{brandName(sections.heroProduct.brand_id)}</p>
                    <p className="max-w-[160px] truncate text-xs font-medium">{sections.heroProduct.title}</p>
                    <p className="text-xs font-medium text-accent">{money(sections.heroProduct.price)}</p>
                  </div>
                  <ArrowUpRight className="h-4 w-4 shrink-0 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                </Link>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* MARQUEE */}
      <div className="mt-16 overflow-hidden border-y border-line bg-surface py-4" aria-hidden>
        <div className="flex w-max animate-marquee">
          {[0, 1].map((copy) => (
            <div key={copy} className="flex shrink-0 items-center">
              {MARQUEE.map((t) => (
                <span key={`${copy}-${t}`} className="flex items-center text-[11px] font-medium uppercase tracking-[0.24em] text-ink-soft">
                  <span className="px-6">{t}</span><span className="text-accent">✦</span>
                </span>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* CATEGORIES */}
      <section id="categories" className="mx-auto max-w-[1440px] scroll-mt-28 px-4 pt-20 sm:px-6 lg:px-10">
        <Reveal><SectionHead eyebrow="Категории" title="Куда смотреть" href="/catalog" /></Reveal>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {sections.cats.map((c, i) => (
            <Reveal key={c.id} delay={i * 80}>
              <Link href={`/catalog?category=${c.slug}`} className="group relative block aspect-[3/4] overflow-hidden bg-line/40">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={c.image_url ?? ''} alt={c.name} loading="lazy"
                  className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105" />
                <div className="absolute inset-0 bg-gradient-to-t from-ink/75 via-ink/10 to-transparent" />
                <div className="absolute inset-x-0 bottom-0 flex items-end justify-between p-4 text-paper">
                  <div>
                    <p className="text-sm font-medium uppercase tracking-[0.14em]">{c.name}</p>
                    <p className="mt-0.5 text-xs text-paper/70">
                      {data.products.filter((p) => p.category_id === c.id).length} {plural(data.products.filter((p) => p.category_id === c.id).length, 'товар', 'товара', 'товаров')}
                    </p>
                  </div>
                  <ArrowUpRight className="h-5 w-5 transition-transform group-hover:-translate-y-1 group-hover:translate-x-1" />
                </div>
              </Link>
            </Reveal>
          ))}
        </div>
      </section>

      {/* NEW */}
      <section id="new" className="mx-auto max-w-[1440px] scroll-mt-28 px-4 pt-20 sm:px-6 lg:px-10">
        <Reveal><SectionHead eyebrow="Только что приехало" title="Новинки" href="/catalog?new=1" linkLabel="Все новинки" /></Reveal>
        <div className="grid grid-cols-2 gap-x-4 gap-y-12 sm:gap-x-5 lg:grid-cols-4">
          {sections.newArrivals.map((p, i) => (
            <Reveal key={p.id} delay={i * 80}>
              <Card product={p} brand={brandName(p.brand_id)} index={i} onAdd={addToCart} />
            </Reveal>
          ))}
        </div>
      </section>

      {/* EDITORIAL */}
      <section className="mt-24 bg-surface">
        <div className="mx-auto grid max-w-[1440px] items-center gap-10 px-4 py-16 sm:px-6 lg:grid-cols-2 lg:px-10 lg:py-24">
          <Reveal className="relative aspect-[4/3] overflow-hidden bg-line/40">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={sections.editorial.image_url} alt="Магазин RE:FORM" loading="lazy" className="absolute inset-0 h-full w-full object-cover" />
          </Reveal>
          <Reveal delay={120}>
            <p className="text-[11px] font-medium uppercase tracking-[0.28em] text-accent">Наша история</p>
            <h2 className="mt-4 text-3xl font-medium leading-tight tracking-tight sm:text-4xl">
              С Авито — <span className="font-serif italic">в собственный магазин.</span>
            </h2>
            <p className="mt-5 max-w-md leading-relaxed text-ink-soft">
              Пять лет мы продавали брендовые вещи на Авито и заработали рейтинг 5.0. Теперь весь ассортимент — здесь: с удобной корзиной, быстрой доставкой и той же честностью в описании каждой вещи.
            </p>
            <ul className="mt-6 space-y-3 text-sm">
              {['Каждая вещь проходит проверку подлинности', 'Реальные фото и точные замеры', 'Отправка в течение 48 часов'].map((t) => (
                <li key={t} className="flex items-center gap-3"><BadgeCheck className="h-5 w-5 shrink-0 text-accent" />{t}</li>
              ))}
            </ul>
            <Link href="/catalog" className="mt-8 inline-flex h-[52px] items-center gap-2 bg-ink px-8 text-xs font-medium uppercase tracking-[0.14em] text-paper transition hover:bg-accent">
              Перейти в каталог <ArrowRight className="h-4 w-4" />
            </Link>
          </Reveal>
        </div>
      </section>

      {/* POPULAR */}
      <section id="popular" className="mx-auto max-w-[1440px] scroll-mt-28 px-4 pt-20 sm:px-6 lg:px-10">
        <Reveal><SectionHead eyebrow="Выбор покупателей" title="Популярное" href="/catalog?sort=popular" /></Reveal>
        <div className="grid grid-cols-2 gap-x-4 gap-y-12 sm:gap-x-5 lg:grid-cols-4">
          {sections.popular.map((p, i) => (
            <Reveal key={p.id} delay={i * 80}>
              <Card product={p} brand={brandName(p.brand_id)} index={i} onAdd={addToCart} />
            </Reveal>
          ))}
        </div>
      </section>

      {/* BRANDS */}
      <section id="brands" className="mx-auto max-w-[1440px] scroll-mt-28 px-4 pt-24 sm:px-6 lg:px-10">
        <Reveal><SectionHead eyebrow="Бренды" title="Только оригиналы" href="/catalog" linkLabel="Все бренды" /></Reveal>
        <Reveal>
          <div className="grid grid-cols-2 border-l border-t border-line md:grid-cols-4">
            {sections.brands.map((b) => (
              <Link key={b.id} href={`/catalog?brand=${b.slug}`}
                className="grid h-28 place-items-center border-b border-r border-line bg-surface px-4 text-center transition-all duration-300 hover:bg-ink hover:text-paper">
                <span className={BRAND_STYLE[b.slug] ?? 'text-sm font-medium uppercase tracking-[0.2em]'}>{b.name}</span>
              </Link>
            ))}
          </div>
        </Reveal>
      </section>

      {/* TRUST */}
      <section className="mx-auto max-w-[1440px] px-4 pt-20 sm:px-6 lg:px-10">
        <div className="grid gap-px border border-line bg-line sm:grid-cols-2 lg:grid-cols-4">
          {[
            { icon: ShieldCheck, t: 'Аутентичность', d: 'Проверяем каждую вещь перед продажей' },
            { icon: Truck, t: 'Доставка 2–5 дней', d: 'Бесплатно от 10 000 ₽' },
            { icon: RefreshCcw, t: 'Возврат 14 дней', d: 'Если вещь не подошла — вернём деньги' },
            { icon: BadgeCheck, t: 'Честное состояние', d: 'Все дефекты показаны на фото' }
          ].map((x, i) => (
            <Reveal key={x.t} delay={i * 70} className="bg-surface p-6">
              <x.icon className="h-6 w-6 text-accent" />
              <p className="mt-4 text-sm font-medium uppercase tracking-[0.12em]">{x.t}</p>
              <p className="mt-1.5 text-sm text-mute">{x.d}</p>
            </Reveal>
          ))}
        </div>
      </section>

      {/* CONTACTS */}
      <section id="contacts" className="mx-auto max-w-[1440px] scroll-mt-28 px-4 pt-24 sm:px-6 lg:px-10">
        <div className="grid gap-10 lg:grid-cols-2">
          <Reveal>
            <p className="text-[11px] font-medium uppercase tracking-[0.28em] text-accent">Контакты</p>
            <h2 className="mt-4 text-3xl font-medium tracking-tight sm:text-4xl">Шоурум и связь</h2>
            <p className="mt-4 max-w-md text-ink-soft">
              Приезжайте на примерку или напишите нам — отвечаем быстро, помогаем с размером и отправляем дополнительные фото по запросу.
            </p>
            <ul className="mt-8 space-y-5 text-sm">
              <li className="flex items-start gap-4">
                <MapPin className="mt-0.5 h-5 w-5 shrink-0 text-accent" />
                <div><p className="font-medium">{CONTACTS.address}</p><p className="text-mute">Шоурум · примерка по записи</p></div>
              </li>
              <li className="flex items-start gap-4">
                <Phone className="mt-0.5 h-5 w-5 shrink-0 text-accent" />
                <a href={CONTACTS.phoneHref} className="font-medium transition hover:text-accent">{CONTACTS.phone}</a>
              </li>
              <li className="flex items-start gap-4">
                <Mail className="mt-0.5 h-5 w-5 shrink-0 text-accent" />
                <a href={`mailto:${CONTACTS.email}`} className="font-medium transition hover:text-accent">{CONTACTS.email}</a>
              </li>
              <li className="flex items-start gap-4">
                <Clock className="mt-0.5 h-5 w-5 shrink-0 text-accent" />
                <p className="text-ink-soft">{CONTACTS.hours}</p>
              </li>
            </ul>
          </Reveal>

          <Reveal delay={120} className="border border-line bg-surface p-8">
            <p className="text-sm font-medium uppercase tracking-[0.16em]">Мы на связи</p>
            <div className="mt-6 space-y-3">
              {[
                { href: CONTACTS.telegram, icon: Send, t: 'Telegram', d: 'Самый быстрый способ связи' },
                { href: CONTACTS.whatsapp, icon: Phone, t: 'WhatsApp', d: 'Фото, видео, вопросы по размерам' },
                { href: CONTACTS.avito, icon: ExternalLink, t: 'Авито', d: 'Наш профиль с отзывами 5.0' },
                { href: CONTACTS.instagram, icon: Instagram, t: 'Instagram', d: 'Новые поступления каждый день' }
              ].map((s) => (
                <a key={s.t} href={s.href} target="_blank" rel="noopener noreferrer"
                  className="group flex items-center gap-4 border border-line p-4 transition-all hover:border-ink hover:bg-ink hover:text-paper">
                  <s.icon className="h-5 w-5 shrink-0 text-accent" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">{s.t}</p>
                    <p className="truncate text-xs text-mute group-hover:text-paper/60">{s.d}</p>
                  </div>
                  <ArrowUpRight className="h-4 w-4 shrink-0 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                </a>
              ))}
            </div>
          </Reveal>
        </div>
      </section>

      {/* TOASTS */}
      <div className="pointer-events-none fixed bottom-4 right-4 z-[90] flex w-[calc(100vw-2rem)] max-w-sm flex-col gap-2">
        {toasts.map((t) => (
          <div key={t.id} className="pointer-events-auto flex animate-toast-in items-start gap-3 bg-ink p-4 text-paper shadow-2xl">
            <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-success"><ShoppingBag className="h-3 w-3" /></span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">{t.title}</p>
              {t.desc && <p className="mt-0.5 truncate text-xs text-paper/60">{t.desc}</p>}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

function Reveal({ children, className = '', delay = 0 }: { children: ReactNode; className?: string; delay?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) { setShown(true); io.disconnect(); }
    }, { threshold: 0.1 });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <div ref={ref} style={{ transitionDelay: `${delay}ms` }}
      className={`transition-all duration-700 ease-out ${shown ? 'translate-y-0 opacity-100' : 'translate-y-6 opacity-0'} ${className}`}>
      {children}
    </div>
  );
}

function SectionHead({ eyebrow, title, href, linkLabel = 'Смотреть все' }: {
  eyebrow: string; title: string; href: string; linkLabel?: string;
}) {
  return (
    <div className="mb-8 flex items-end justify-between gap-6">
      <div>
        <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.24em] text-accent">{eyebrow}</p>
        <h2 className="text-2xl font-medium tracking-tight sm:text-3xl">{title}</h2>
      </div>
      <Link href={href} className="group hidden items-center gap-2 text-xs font-medium uppercase tracking-[0.16em] text-ink-soft transition hover:text-ink sm:inline-flex">
        {linkLabel}<ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
      </Link>
    </div>
  );
}

function Card({ product, brand, index, onAdd }: {
  product: Product; brand: string; index: number; onAdd: (p: Product) => void;
}) {
  const discount = sale(product);
  const soldOut = product.stock <= 0;
  return (
    <article className="group">
      <Link href={`/product/${product.slug}`} className="block">
        <div className="relative aspect-[3/4] overflow-hidden bg-line/40">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={product.images[0]} alt={product.title} loading={index < 4 ? 'eager' : 'lazy'}
            className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.045]" />
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
        <p className="truncate text-[10px] font-medium uppercase tracking-[0.2em] text-mute">{brand || 'Без бренда'}</p>
        <Link href={`/product/${product.slug}`}>
          <h3 className="mt-1.5 line-clamp-2 min-h-[2.5rem] text-[13px] font-medium leading-snug tracking-tight transition-colors group-hover:text-accent">{product.title}</h3>
        </Link>
        <div className="mt-2 flex items-end justify-between gap-2">
          <div>
            <p className="text-sm font-semibold">{money(product.price)}</p>
            {product.old_price && product.old_price > product.price && (
              <p className="text-[11px] text-mute line-through">{money(product.old_price)}</p>
            )}
          </div>
          <button disabled={soldOut} onClick={() => onAdd(product)} aria-label="Добавить в корзину"
            className="grid h-9 w-9 shrink-0 place-items-center border border-ink bg-surface transition hover:bg-ink hover:text-paper disabled:cursor-not-allowed disabled:border-line disabled:text-mute/40 disabled:hover:bg-surface">
            <ShoppingBag className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </article>
  );
}

function HomeSkeleton() {
  return (
    <div className="mx-auto max-w-[1440px] px-4 pt-10 sm:px-6 lg:px-10">
      <div className="grid gap-10 lg:grid-cols-2">
        <div className="space-y-6 pt-10">
          <div className="h-4 w-48 animate-pulse bg-line" />
          <div className="h-16 w-full animate-pulse bg-line" />
          <div className="h-16 w-3/4 animate-pulse bg-line" />
          <div className="h-5 w-full animate-pulse bg-line" />
          <div className="h-12 w-64 animate-pulse bg-line" />
        </div>
        <div className="aspect-[4/5] w-full animate-pulse bg-line" />
      </div>
      <div className="mt-20 grid grid-cols-2 gap-5 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => <div key={i} className="aspect-[3/4] animate-pulse bg-line" />)}
      </div>
    </div>
  );
}
