'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import { Save, Loader2 } from 'lucide-react';

const C = {
  void: '#0B0D10', panel: '#14181D', raised: '#1C222A', line: '#2A323C',
  mist: '#8A97A6', chalk: '#E8EDF3', signal: '#FF5A1F', volt: '#C6FF3D'
};

export default function AdminSettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [data, setData] = useState({
    shop_name: '', contact_phone: '', contact_email: '', 
    contact_telegram: '', pickup_address: ''
  });

  useEffect(() => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) return;

    const supabase = createClient(url, key);
    supabase.from('shop_settings').select('*').eq('id', 1).single().then(({ data }) => {
      if (data) setData(data);
      setLoading(false);
    });
  }, []);

  const save = async () => {
    setSaving(true);
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) return;

    const supabase = createClient(url, key);
    await supabase.from('shop_settings').update(data).eq('id', 1);
    
    setSaving(false);
    alert('Настройки сохранены!');
  };

  if (loading) return <div className="p-10 text-center" style={{ color: C.mist }}>Загрузка...</div>;

  return (
    <div className="max-w-2xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6" style={{ color: C.chalk }}>Настройки магазина</h1>
      
      <div className="space-y-6">
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider mb-2" style={{ color: C.mist }}>Название магазина</label>
          <input value={data.shop_name} onChange={e => setData({...data, shop_name: e.target.value})}
            className="w-full p-3 rounded border outline-none focus:border-[#FF5A1F]" style={{ borderColor: C.line, background: C.raised, color: C.chalk }} />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider mb-2" style={{ color: C.mist }}>Телефон</label>
            <input value={data.contact_phone} onChange={e => setData({...data, contact_phone: e.target.value})}
              className="w-full p-3 rounded border outline-none focus:border-[#FF5A1F]" style={{ borderColor: C.line, background: C.raised, color: C.chalk }} />
          </div>
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider mb-2" style={{ color: C.mist }}>Email</label>
            <input value={data.contact_email} onChange={e => setData({...data, contact_email: e.target.value})}
              className="w-full p-3 rounded border outline-none focus:border-[#FF5A1F]" style={{ borderColor: C.line, background: C.raised, color: C.chalk }} />
          </div>
        </div>

        <div>
          <label className="block text-xs font-bold uppercase tracking-wider mb-2" style={{ color: C.mist }}>Telegram</label>
          <input value={data.contact_telegram} onChange={e => setData({...data, contact_telegram: e.target.value})}
            className="w-full p-3 rounded border outline-none focus:border-[#FF5A1F]" style={{ borderColor: C.line, background: C.raised, color: C.chalk }} />
        </div>

        <div>
          <label className="block text-xs font-bold uppercase tracking-wider mb-2" style={{ color: C.mist }}>Адрес самовывоза</label>
          <textarea value={data.pickup_address} onChange={e => setData({...data, pickup_address: e.target.value})} rows={3}
            className="w-full p-3 rounded border outline-none focus:border-[#FF5A1F]" style={{ borderColor: C.line, background: C.raised, color: C.chalk }} />
        </div>

        <button onClick={save} disabled={saving}
          className="flex items-center gap-2 px-6 py-3 rounded font-bold uppercase tracking-wider transition hover:brightness-110 disabled:opacity-50"
          style={{ background: C.signal, color: C.void }}>
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Сохранить изменения
        </button>
      </div>
    </div>
  );
}
