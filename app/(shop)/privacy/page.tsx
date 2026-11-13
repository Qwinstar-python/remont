import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 lg:px-10">
      <Link href="/" className="mb-8 inline-flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-mute transition hover:text-ink">
        <ArrowLeft className="h-4 w-4" /> На главную
      </Link>

      <h1 className="text-3xl font-medium tracking-tight sm:text-4xl">Политика конфиденциальности</h1>
      <p className="mt-4 text-sm text-mute">Последнее обновление: 14 ноября 2026 г.</p>

      <div className="prose prose-slate mt-10 max-w-none text-ink-soft">
        <h2 className="text-xl font-medium text-ink">1. Общие положения</h2>
        <p>Настоящая политика обработки персональных данных составлена в соответствии с требованиями Федерального закона от 27.07.2006 № 152-ФЗ «О персональных данных» и определяет порядок обработки персональных данных и меры по обеспечению безопасности персональных данных, предпринимаемые магазином брендовой одежды RE:FORM (далее – Оператор).</p>
        
        <h2 className="mt-8 text-xl font-medium text-ink">2. Какие данные мы собираем</h2>
        <p>Мы обрабатываем только те данные, которые необходимы для оформления и доставки заказа:</p>
        <ul className="list-disc pl-5 space-y-2">
          <li>Фамилия, имя и отчество;</li>
          <li>Контактный телефон;</li>
          <li>Адрес электронной почты;</li>
          <li>Адрес доставки (город, улица, дом, квартира).</li>
        </ul>

        <h2 className="mt-8 text-xl font-medium text-ink">3. Цели обработки данных</h2>
        <p>Ваши данные используются исключительно для:</p>
        <ul className="list-disc pl-5 space-y-2">
          <li>Идентификации покупателя при оформлении заказа;</li>
          <li>Связи с покупателем для подтверждения наличия и размеров;</li>
          <li>Доставки товара курьерскими службами или через пункты выдачи;</li>
          <li>Обработки возвратов и гарантийных случаев.</li>
        </ul>

        <h2 className="mt-8 text-xl font-medium text-ink">4. Безопасность</h2>
        <p>Оператор принимает необходимые организационные и технические меры для защиты персональной информации пользователя от неправомерного или случайного доступа, уничтожения, изменения, блокирования, копирования, распространения.</p>

        <h2 className="mt-8 text-xl font-medium text-ink">5. Контакты</h2>
        <p>По всем вопросам, связанным с обработкой ваших данных, вы можете связаться с нами по адресу: <strong>hello@reform.store</strong> или по телефону: <strong>+7 (999) 123-45-67</strong>.</p>
      </div>
    </div>
  );
}
