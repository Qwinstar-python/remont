'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Heart, ShoppingBag, Trash2 } from 'lucide-react';

const WISH_KEY = 'reform-wishlist-v1';
const IMG = (id: string) => `https://images.unsplash.com/${id}?q=80&w=600&auto=format&fit=crop`;

// Демо-данные (те же, что в каталоге, чтобы сайт работал без базы при проверке)
const PRODUCTS = [
  { id: 1, title: 'Куртка Stone Island Ghost Piece', slug: 'stone-island-ghost-piece', brand: 'Stone Island', price: 42900, old_price: 51900, img: 'photo-1591047139829-d91aecb6caea' },
  { id: 2, title: 'Худи Carhartt WIP Hooded Chase', slug: 'carhartt-hooded-chase', brand: 'Carhartt WIP', price: 8900, img: 'photo-1556821840-3a63f95609a7' },
  { id: 3, title: 'Пуховик The North Face Nuptse 1996', slug: 'tnf-nuptse-1996', brand: 'The North Face', price: 24500, old_price: 29900, img: 'photo-1544022613-e87ca75a784a' },
  { id: 4, title: 'Кроссовки Nike Air Max 90', slug: 'nike-air-max-90', brand: 'Nike', price: 11900, img: 'photo-1600185365483-26d7a4cc7519' },
  { id: 5, title: 'Футболка Stüssy Basic Logo', slug: 'stussy-basic-logo', brand: 'Stüssy', price: 4500, img: 'photo-1521572163474-6864f9cf17ab' },
  { id: 6, title: 'Рубашка Ralph Lauren Oxford', slug: 'ralph-lauren-oxford', brand: 'Ralph Lauren', price: 7900, old_price: 9900, img: 'photo-1596755094514-f87e34085b2c' },
  { id: 9, title: 'Кроссовки Adidas Samba OG', slug: 'adidas-samba-og', brand: 'Adidas', price: 10900, old_price: 12900, img: 'photo-1600269452121-4f2416e55c28' },
];

const money = (n: number) => new Intl.NumberFormat('ru-RU').format(n) + ' ₽';

export default function WishlistPage() {
  const [ids, setIds] = useState<number[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(WISH_KEY);
      if (raw) setIds(JSON.parse(raw));
    } catch {}
    setReady(true);
  }, []);

  // Синхронизация: если на другой вкладке добавили в избранное, тут тоже обновится
  useEffect(() => {
    const sync = () => {
      try {
        const raw = localStorage.getItem(WISH_KEY);
        if (raw) setIds(JSON.parse(raw));
      } catch {}
    };
    window.addEventListener('storage', sync);
    window.addEventListener('reform-wishlist-updated', sync);
    return () => {
      window.removeEventListener('storage', sync);
      window.removeEventListener('reform-wishlist-updated', sync);
    };
  }, []);

  const items = PRODUCTS.filter((p) => ids.includes(p.id));
  const total = items.reduce((s, p) => s + p.price, 0);

  const remove = (id: number) => {
    const next = ids.filter((x) => x !== id);
    setIds(next);
    localStorage.setItem(WISH_KEY, JSON.stringify(next));
    window.dispatchEvent(new Event('reform-wishlist-updated'));
  };

  if (!ready) return null;

  return (
    <div className="mx-auto max-w-[1440px] px-4 py-10 sm:px-6 lg:px-10">
      <Link href="/catalog" className="mb-8 inline-flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-mute transition hover:text-ink">
        <ArrowLeft className="h-4 w-4" /> Вернуться в каталог
      </Link>

      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.28em] text-accent">Избранное</p>
          <h1 className="mt-2 text-3xl font-medium tracking-tight sm:text-4xl">Ваши желания</h1>
          <p className="mt-2 text-sm text-mute">{items.length} {items.length === 1 ? 'вещь' : items.length < 5 ? 'вещи' : 'вещей'} отложено</p>
        </div>
      </div>

      {items.length === 0 ? (
        <div className="mt-12 grid min-h-[400px] place-items-center border border-line bg-surface text-center">
          <div>
            <Heart className="mx-auto h-12 w-12 text-mute" />
            <h2 className="mt-4 text-xl font-medium">Здесь пока пусто</h2>
            <p className="mt-2 text-sm text-mute">Нажимайте на сердечко в каталоге, чтобы сохранить понравившиеся вещи.</p>
            <Link href="/catalog" className="mt-6 inline-flex h-12 items-center gap-2 bg-ink px-8 text-[11px] font-semibold uppercase tracking-[0.18em] text-paper transition hover:bg-accent">
              В каталог <ShoppingBag className="h-4 w-4" />
            </Link>
          </div>
        </div>
      ) : (
        <>
          <div className="mt-8 grid grid-cols-2 gap-x-4 gap-y-10 sm:gap-x-6 lg:grid-cols-4">
            {items.map((p) => (
              <div key={p.id} className="group relative animate-fade-up">
                <Link href={`/product/${p.slug}`} className="block aspect-[3/4] overflow-hidden rounded-lg bg-line/40">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={IMG(p.img)} alt={p.title} loading="lazy" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
                </Link>
                
                <button onClick={() => remove(p.id)} aria-label="Удалить из избранного"
                  className="absolute right-3 top-3 grid h-9 w-9 place-items-center rounded-full bg-surface/90 text-mute backdrop-blur transition hover:bg-danger hover:text-white">
                  <Trash2 className="h-4 w-4" />
                </button>

                <div className="mt-3">
                  <p className="truncate text-[10px] font-medium uppercase tracking-[0.2em] text-mute">{p.brand}</p>
                  <Link href={`/product/${p.slug}`} className="mt-1 block truncate text-sm font-medium leading-snug transition hover:text-accent">
                    {p.title}
                  </Link>
                  <div className="mt-2 flex items-baseline gap-2">
                    <span className="font-semibold">{money(p.price)}</span>
                    {p.old_price && <span className="text-xs text-mute line-through">{money(p.old_price)}</span>}
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-12 flex flex-wrap items-center justify-between gap-6 border-t border-line pt-8">
            <p className="text-lg">
              Общая сумма: <span className="font-bold">{money(total)}</span>
            </p>
            <Link href="/cart" className="inline-flex h-12 items-center gap-2 bg-ink px-8 text-[11px] font-semibold uppercase tracking-[0.18em] text-paper transition hover:bg-accent">
              Перенести всё в корзину <ArrowLeft className="h-4 w-4 rotate-180" />
            </Link>
          </div>
        </>
      )}
    </div>
  );
}
