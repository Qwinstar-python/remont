'use client';

import { useEffect, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Heart, Menu, Search, ShoppingBag, User, X } from 'lucide-react';
import { createClient } from '@supabase/supabase-js';

const NAV = [
  { href: '/catalog', label: 'Каталог' },
  { href: '/catalog?new=1', label: 'Новинки' },
  { href: '/#brands', label: 'Бренды' },
  { href: '/#contacts', label: 'Контакты' }
];

export function Logo({ className = '' }: { className?: string }) {
  return (
    <Link href="/" className={`text-lg font-bold tracking-tight ${className}`}>
      RE<span className="text-accent">:</span>FORM
    </Link>
  );
}

function cartCount(): number {
  try {
    const raw = localStorage.getItem('reform-cart-v1');
    if (!raw) return 0;
    const parsed = JSON.parse(raw);
    const items = Array.isArray(parsed?.state?.items) ? parsed.state.items : [];
    return items.reduce((s: number, x: any) => s + (Number(x?.quantity) || 0), 0);
  } catch {
    return 0;
  }
}

export function Header() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const [count, setCount] = useState(0);
  const [loggedIn, setLoggedIn] = useState(false);
  const pathname = usePathname();

  // Следим за скроллом для шапки
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Проверяем авторизацию и корзину при загрузке
  useEffect(() => {
    const sync = async () => {
      setCount(cartCount());
      
      // Проверяем сессию в Supabase
      const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      if (url && key) {
        const supabase = createClient(url, key);
        const { data } = await supabase.auth.getSession();
        setLoggedIn(!!data.session);
      }
    };
    
    sync();

    // Слушаем изменения корзины
    window.addEventListener('reform-cart-updated', sync);
    
    // Слушаем изменения авторизации (вход/выход в другой вкладке)
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (url && key) {
        const supabase = createClient(url, key);
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
          setLoggedIn(!!session);
        });
        return () => subscription.unsubscribe();
    }
  }, []);

  useEffect(() => { setOpen(false); }, [pathname]);

  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  return (
    <header className={`fixed inset-x-0 top-0 z-50 transition-all duration-300 ${scrolled ? 'border-b border-line bg-paper/90 backdrop-blur-md' : 'bg-paper'}`}>
      <div className={`flex items-center justify-center overflow-hidden bg-ink px-4 text-center text-[10px] uppercase tracking-[0.22em] text-paper transition-all duration-300 ${scrolled ? 'h-0 opacity-0' : 'h-8 opacity-100'}`}>
        Бесплатная доставка от 10 000 ₽ · Проверка подлинности
      </div>

      <div className="mx-auto flex h-16 max-w-[1440px] items-center justify-between gap-4 px-4 sm:px-6 lg:px-10">
        <div className="flex items-center gap-3">
          <button onClick={() => setOpen(true)} aria-label="Открыть меню" className="grid h-10 w-10 place-items-center lg:hidden">
            <Menu className="h-5 w-5" />
          </button>
          <Logo />
        </div>

        <nav className="hidden items-center gap-8 lg:flex">
          {NAV.map((l) => (
            <Link key={l.label} href={l.href}
              className={`text-[11px] font-medium uppercase tracking-[0.2em] transition-colors hover:text-accent ${pathname === '/catalog' && l.href === '/catalog' ? 'text-accent' : 'text-ink-soft'}`}>
              {l.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-1">
          <Link href="/catalog" aria-label="Поиск" className="grid h-10 w-10 place-items-center transition hover:text-accent">
            <Search className="h-5 w-5" />
          </Link>
          
          {/* Ссылка на Избранное */}
          <Link href="/wishlist" aria-label="Избранное" className="grid h-10 w-10 place-items-center transition hover:text-accent">
            <Heart className="h-5 w-5" />
          </Link>

          <Link href={loggedIn ? '/account' : '/login'} aria-label="Личный кабинет"
            className={`grid h-10 w-10 place-items-center transition ${loggedIn ? 'text-accent' : 'hover:text-accent'}`}>
            <User className="h-5 w-5" />
          </Link>
          <Link href="/cart" aria-label="Корзина" className="relative grid h-10 w-10 place-items-center transition hover:text-accent">
            <ShoppingBag className="h-5 w-5" />
            {count > 0 && (
              <span className="absolute -right-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-accent px-1 text-[10px] font-bold text-white">
                {count}
              </span>
            )}
          </Link>
        </div>
      </div>

      {open && (
        <div className="fixed inset-0 z-[60] flex animate-fade-in flex-col bg-paper lg:hidden">
          <div className="flex h-16 items-center justify-between border-b border-line px-4">
            <Logo />
            <button onClick={() => setOpen(false)} aria-label="Закрыть меню" className="grid h-10 w-10 place-items-center">
              <X className="h-5 w-5" />
            </button>
          </div>
          <nav className="flex flex-1 flex-col overflow-y-auto p-6">
            {NAV.map((l, i) => (
              <Link key={l.label} href={l.href} onClick={() => setOpen(false)}
                className="animate-fade-up border-b border-line py-4 text-2xl font-medium tracking-tight"
                style={{ animationDelay: `${i * 70}ms` }}>
                {l.label}
              </Link>
            ))}
            <Link href={loggedIn ? '/account' : '/login'} onClick={() => setOpen(false)}
              className="animate-fade-up py-4 text-2xl font-medium tracking-tight text-accent"
              style={{ animationDelay: '300ms' }}>
              {loggedIn ? 'Личный кабинет' : 'Войти'}
            </Link>
          </nav>
        </div>
      )}
    </header>
  );
}

export function Footer() {
  return (
    <footer className="mt-24 bg-ink text-paper">
      <div className="mx-auto max-w-[1440px] px-4 py-16 sm:px-6 lg:px-10">
        <div className="grid gap-12 md:grid-cols-2 lg:grid-cols-4">
          <div>
            <p className="text-lg font-bold tracking-tight">RE<span className="text-accent">:</span>FORM</p>
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-paper/60">
              Брендовая одежда с историей. Раньше вы находили нас на Авито — теперь у нас собственный магазин.
            </p>
          </div>
          <div>
            <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-paper/40">Магазин</p>
            <ul className="mt-4 space-y-3 text-sm">
              <li><Link className="text-paper/70 transition hover:text-paper" href="/catalog">Каталог</Link></li>
              <li><Link className="text-paper/70 transition hover:text-paper" href="/catalog?new=1">Новинки</Link></li>
              <li><Link className="text-paper/70 transition hover:text-paper" href="/catalog?sort=popular">Популярное</Link></li>
              <li><Link className="text-paper/70 transition hover:text-paper" href="/#brands">Бренды</Link></li>
            </ul>
          </div>
          <div>
            <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-paper/40">Покупателям</p>
            <ul className="mt-4 space-y-3 text-sm">
              <li><Link className="text-paper/70 transition hover:text-paper" href="/#contacts">Доставка и оплата</Link></li>
              <li><Link className="text-paper/70 transition hover:text-paper" href="/#contacts">Возврат · 14 дней</Link></li>
              <li><Link className="text-paper/70 transition hover:text-paper" href="/cart">Корзина</Link></li>
              <li><Link className="text-paper/70 transition hover:text-paper" href="/account">Мои заказы</Link></li>
            </ul>
          </div>
          <div>
            <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-paper/40">Контакты</p>
            <ul className="mt-4 space-y-3 text-sm text-paper/70">
              <li>Москва, ул. Большая Никитская, 12</li>
              <li><a className="transition hover:text-paper" href="tel:+79991234567">+7 (999) 123-45-67</a></li>
              <li><a className="transition hover:text-paper" href="mailto:hello@reform.store">hello@reform.store</a></li>
            </ul>
          </div>
        </div>
        <p className="mt-16 select-none text-center text-[16vw] font-bold leading-[0.8] tracking-tight text-paper/5 lg:text-[11rem]">RE:FORM</p>
        <div className="mt-10 border-t border-paper/10 pt-6 text-xs text-paper/40">
          © 2026 RE:FORM. Все права защищены.
        </div>
      </div>
    </footer>
  );
}

export default function ShopLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <Header />
      <main className="min-h-screen pt-24">{children}</main>
      <Footer />
    </>
  );
}
