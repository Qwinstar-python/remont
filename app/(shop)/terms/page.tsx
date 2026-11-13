import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

export default function TermsPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 lg:px-10">
      <Link href="/" className="mb-8 inline-flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-mute transition hover:text-ink">
        <ArrowLeft className="h-4 w-4" /> На главную
      </Link>

      <h1 className="text-3xl font-medium tracking-tight sm:text-4xl">Публичная оферта</h1>
      <p className="mt-4 text-sm text-mute">Условия покупки в магазине RE:FORM</p>

      <div className="prose prose-slate mt-10 max-w-none text-ink-soft">
        <h2 className="text-xl font-medium text-ink">1. Предмет договора</h2>
        <p>Магазин RE:FORM осуществляет продажу брендовой одежды и аксессуаров (далее – Товар) дистанционным способом. Каждая вещь проходит проверку на подлинность перед выставлением на продажу.</p>

        <h2 className="mt-8 text-xl font-medium text-ink">2. Оформление заказа</h2>
        <p>Заказ считается оформленным после нажатия кнопки «Подтвердить заказ» на сайте. Менеджер магазина свяжется с вами в течение 1 рабочего дня для подтверждения наличия и уточнения деталей доставки.</p>

        <h2 className="mt-8 text-xl font-medium text-ink">3. Доставка и оплата</h2>
        <ul className="list-disc pl-5 space-y-2">
          <li>Доставка осуществляется курьером по Москве или службой СДЭК по России.</li>
          <li>Срок отправки заказа составляет не более 48 часов с момента подтверждения.</li>
          <li>Оплата производится при получении (наложенным платежом) или переводом по СБП.</li>
        </ul>

        <h2 className="mt-8 text-xl font-medium text-ink">4. Возврат товара</h2>
        <p>Покупатель имеет право отказаться от Товара в течение 14 дней с момента получения, если сохранены его товарный вид и бирки. Обратная доставка в случае возврата оплачивается покупателем, за исключением случаев, когда Товар имеет неуказанные дефекты.</p>

        <h2 className="mt-8 text-xl font-medium text-ink">5. Гарантия подлинности</h2>
        <p>Магазин гарантирует 100% аутентичность всех представленных вещей. В случае, если независимая экспертиза докажет обратное, магазин обязуется вернуть двойную стоимость Товара.</p>
      </div>
    </div>
  );
}
