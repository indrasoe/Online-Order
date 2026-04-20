import React, { useState, useEffect, useMemo } from 'react';
import { createClient } from '@supabase/supabase-js';
import OneSignal from 'react-onesignal';
import { 
  Plus, Minus, History, Clock, User, 
  X, MessageSquare, UtensilsCrossed, AlertCircle, CheckCircle2
} from 'lucide-react';

const supabase = createClient('https://stzmwgzvgjrbcuyfhlvq.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN0em13Z3p2Z2pyYmN1eWZobHZxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM2OTExNzYsImV4cCI6MjA3OTI2NzE3Nn0.Sda7ahnvT5qVOwI-EC21313hs4wEpm4NV75sjna4kB4');

// MASUKKIN APP ID ONESIGNAL DI SINI BANG (BUKAN API KEY)
const ONESIGNAL_APP_ID = "5a2bb3f2-9c87-404b-a5cd-adf77f648940";

export default function OnlineOrder() {
  const [menu, setMenu] = useState([]);
  const [cart, setCart] = useState([]);
  const [customerName, setCustomerName] = useState('');
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [activeOrder, setActiveOrder] = useState(null);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [activeCategory, setActiveCategory] = useState('SEMUA');
  const [notification, setNotification] = useState({ show: false, msg: '', type: 'error' });
  const [isStoreOpen, setIsStoreOpen] = useState(true);

  useEffect(() => {
    if (ONESIGNAL_APP_ID !== "PASTE_APP_ID_LO_DI_SINI") {
      OneSignal.init({ appId: ONESIGNAL_APP_ID, allowLocalhostAsSecureOrigin: true });
    }
    supabase.from('products').select('*').order('name').then(({data}) => data && setMenu(data));
    supabase.from('settings').select('is_open').single().then(({data}) => data && setIsStoreOpen(data.is_open));
    const lastId = localStorage.getItem('last_online_order');
    if (lastId) subscribeOrder(lastId);
  }, []);

  const showNotif = (msg, type = 'error') => {
    setNotification({ show: true, msg, type });
    if (type === 'success') setTimeout(() => setNotification({ ...notification, show: false }), 3000);
  };

  const filteredMenu = useMemo(() => activeCategory === 'SEMUA' ? menu : menu.filter(i => i.category?.toUpperCase() === activeCategory), [menu, activeCategory]);
  const categories = ['SEMUA', ...new Set(menu.map(i => i.category?.toUpperCase()).filter(Boolean))];

  const subscribeOrder = (id) => {
    supabase.channel(`order-${id}`).on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'orders', filter: `id=eq.${id}` }, (p) => {
      setActiveOrder(p.new);
      setShowStatusModal(true);
      showNotif("STATUS PESANAN BERUBAH!", "success");
    }).subscribe();
    supabase.from('orders').select('*').eq('id', id).single().then(({data}) => data && setActiveOrder(data));
  };

  const startPayment = async () => {
    if (!isStoreOpen) return showNotif("WARUNG LAGI TUTUP BANG!");
    if (!customerName) return showNotif("NAMA PENERIMA WAJIB DIISI!");
    setLoading(true);
    const orderId = `ACUN-${Date.now().toString().slice(-4)}`;
    try {
      const { error } = await supabase.from('orders').insert([{ id: orderId, meja: 99, items: cart, total_harga: cart.reduce((a, b) => a + b.price * b.qty, 0), payment_status: 'unpaid', status: 'waiting_payment', notes: `PENERIMA: ${customerName.toUpperCase()}` }]);
      if (error) throw error;
      localStorage.setItem('last_online_order', orderId);
      const res = await fetch('https://stzmwgzvgjrbcuyfhlvq.supabase.co/functions/v1/create-payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN0em13Z3p2Z2pyYmN1eWZobHZxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM2OTExNzYsImV4cCI6MjA3OTI2NzE3Nn0.Sda7ahnvT5qVOwI-EC21313hs4wEpm4NV75sjna4kB4', 'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN0em13Z3p2Z2pyYmN1eWZobHZxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM2OTExNzYsImV4cCI6MjA3OTI2NzE3Nn0.Sda7ahnvT5qVOwI-EC21313hs4wEpm4NV75sjna4kB4' },
        body: JSON.stringify({ order_id: orderId, amount: cart.reduce((a, b) => a + b.price * b.qty, 0) })
      });
      const data = await res.json();
      if (data.token) window.snap.pay(data.token, { onSuccess: () => { setCart([]); setIsCartOpen(false); subscribeOrder(orderId); setShowStatusModal(true); setLoading(false); }, onPending: () => setLoading(false), onClose: () => setLoading(false) });
    } catch (e) { showNotif(e.message); setLoading(false); }
  };

  return (
    <div className="min-h-screen bg-slate-50 font-black italic uppercase p-4 pb-44 text-slate-800 tracking-tighter transition-all duration-500">
      
      {/* CUSTOM NOTIFICATION MODAL (BIAR GA PAKE BAWAAN BROWSER) */}
      {notification.show && (
        <div className="fixed top-6 left-4 right-4 z-[999] animate-in slide-in-from-top duration-300">
          <div className={`p-5 rounded-[2rem] shadow-2xl flex items-center gap-4 border-b-4 ${notification.type === 'error' ? 'bg-white border-rose-600 text-rose-600' : 'bg-indigo-600 border-indigo-800 text-white'}`}>
            {notification.type === 'error' ? <AlertCircle size={24} /> : <CheckCircle2 size={24} />}
            <p className="text-[10px] flex-1">{notification.msg}</p>
            <button onClick={() => setNotification({ ...notification, show: false })}><X size={18}/></button>
          </div>
        </div>
      )}

      {/* HEADER */}
      <div className="bg-white p-6 rounded-[2.5rem] shadow-sm mb-4 border-b-4 border-indigo-600 flex justify-between items-center">
        <h1 className="text-xl">NASGOR ACUN <span className="text-indigo-600">HOME</span></h1>
        {activeOrder && <button onClick={() => setShowStatusModal(true)} className="bg-indigo-50 p-3 rounded-2xl text-indigo-600 animate-bounce"><History size={20}/></button>}
      </div>

      {/* NAMA PENERIMA */}
      <div className="bg-indigo-600 p-6 rounded-[2.5rem] text-white mb-6 shadow-xl">
        <label className="text-[9px] mb-2 block opacity-80 uppercase font-black">ATAS NAMA:</label>
        <div className="relative">
          <User className="absolute left-4 top-1/2 -translate-y-1/2 text-indigo-300" size={18} />
          <input type="text" value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder="PAK ANJUN" className="w-full bg-white/10 border-2 border-white/20 rounded-2xl py-4 pl-12 pr-4 outline-none font-black italic uppercase placeholder:text-indigo-300"/>
        </div>
      </div>

      {/* CATEGORIES */}
      <div className="flex gap-2 overflow-x-auto pb-6 no-scrollbar">
        {categories.map(cat => (
          <button key={cat} onClick={() => setActiveCategory(cat)} className={`px-6 py-3 rounded-2xl text-[9px] border-2 transition-all ${activeCategory === cat ? 'bg-slate-900 text-white border-slate-900 shadow-lg' : 'bg-white text-slate-400 border-white'}`}>{cat}</button>
        ))}
      </div>

      {/* MENU */}
      <div className="space-y-4">
        {filteredMenu.map(item => (
          <div key={item.id} className={`bg-white p-4 rounded-[2.5rem] flex gap-4 items-center border-2 transition-all ${!item.is_available ? 'opacity-50 grayscale' : 'border-transparent active:border-indigo-100'}`}>
            <div className="relative w-20 h-20">
              <img src={item.image_url} className="w-full h-full rounded-2xl object-cover bg-slate-100 shadow-inner" />
              {!item.is_available && <div className="absolute inset-0 bg-black/60 rounded-2xl flex items-center justify-center text-white text-[8px] font-black">HABIS</div>}
            </div>
            <div className="flex-1 text-left italic font-black uppercase">
              <h3 className="text-[10px] leading-tight mb-1">{item.name}</h3>
              <p className="text-emerald-600 text-sm">Rp {item.price.toLocaleString()}</p>
            </div>
            <button disabled={!item.is_available || !isStoreOpen} onClick={() => { 
                const ex = cart.find(c => c.id === item.id);
                if (ex) setCart(cart.map(c => c.id === item.id ? {...c, qty: c.qty + 1} : c));
                else setCart([...cart, {...item, qty: 1, note: ''}]);
            }} className={`p-4 rounded-2xl ${item.is_available && isStoreOpen ? 'bg-slate-900 text-white shadow-lg active:scale-90' : 'bg-slate-100 text-slate-400'}`}><Plus size={16}/></button>
          </div>
        ))}
      </div>

      {/* FLOATING CART BAR */}
      {cart.length > 0 && !isCartOpen && (
        <button onClick={() => setIsCartOpen(true)} className="fixed bottom-6 left-4 right-4 bg-indigo-600 text-white p-5 rounded-[2.5rem] shadow-2xl flex justify-between items-center z-[100] border-b-4 border-indigo-800 active:scale-95 transition-all">
          <div className="flex flex-col items-start ml-4 text-left font-black italic">
            <span className="text-[8px] opacity-80">TOTAL</span>
            <span className="text-lg tracking-tighter leading-none">Rp {cart.reduce((a, b) => a + b.price * b.qty, 0).toLocaleString()}</span>
          </div>
          <div className="bg-white/20 px-5 py-3 rounded-2xl text-[9px] border border-white/10 uppercase italic font-black">CEK KERANJANG</div>
        </button>
      )}

      {/* MODAL KERANJANG */}
      {isCartOpen && (
        <div className="fixed inset-0 bg-black/60 z-[250] flex items-end">
          <div className="bg-white w-full rounded-t-[3.5rem] flex flex-col max-h-[95vh] animate-in slide-in-from-bottom duration-300">
            <div className="flex justify-between items-center p-8 pb-2">
              <h2 className="text-xl italic font-black">REVIEW ORDER</h2>
              <button onClick={() => setIsCartOpen(false)} className="p-3 bg-slate-100 rounded-full"><X size={20}/></button>
            </div>
            <div className="flex-1 overflow-y-auto px-8 py-4 space-y-6">
              {cart.map(item => (
                <div key={item.id} className="border-b border-slate-50 pb-4 italic uppercase font-black">
                  <div className="flex justify-between items-start mb-3 text-left">
                    <div className="w-2/3"><h4 className="text-[10px] leading-tight mb-1">{item.name}</h4><p className="text-emerald-600 text-[10px]">Rp {(item.price * item.qty).toLocaleString()}</p></div>
                    <div className="flex items-center gap-3 bg-slate-100 p-2 rounded-2xl">
                      <button onClick={() => setCart(cart.map(c => c.id === item.id ? {...c, qty: Math.max(0, c.qty - 1)} : c).filter(c => c.qty > 0))}><Minus size={14}/></button>
                      <span className="text-xs w-4 text-center">{item.qty}</span>
                      <button onClick={() => setCart(cart.map(c => c.id === item.id ? {...c, qty: c.qty + 1} : c))}><Plus size={14}/></button>
                    </div>
                  </div>
                  <input type="text" placeholder="TAMBAH CATATAN (PEDES/TNP KOL)" value={item.note || ''} onChange={(e) => setCart(cart.map(c => c.id === item.id ? {...c, note: e.target.value} : c))} className="w-full bg-slate-50 rounded-2xl py-3 px-5 text-[8px] outline-none border-2 border-transparent focus:border-indigo-100 font-black italic uppercase placeholder:text-slate-300"/>
                </div>
              ))}
            </div>
            <div className="bg-slate-50 p-10 rounded-t-[3.5rem] border-t border-slate-100 italic uppercase font-black">
              <div className="flex justify-between items-center mb-6 text-left">
                <span className="text-[10px]">TOTAL HARGA</span>
                <span className="text-2xl text-emerald-600">Rp {cart.reduce((a, b) => a + b.price * b.qty, 0).toLocaleString()}</span>
              </div>
              <button onClick={startPayment} disabled={loading} className="w-full py-6 bg-indigo-600 text-white rounded-[2rem] shadow-xl font-black italic tracking-widest active:scale-95 disabled:opacity-50">
                {loading ? <Clock className="animate-spin mx-auto"/> : "KONFIRMASI & BAYAR"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* STATUS ORDER (PROGRESS VISUAL) */}
      {showStatusModal && activeOrder && (
        <div className="fixed inset-0 bg-black/95 z-[300] flex items-center justify-center p-6 italic uppercase font-black text-center transition-all">
          <div className="bg-white rounded-[3.5rem] p-10 w-full max-w-sm border-[12px] border-slate-50 shadow-2xl animate-in zoom-in">
            <div className="w-20 h-20 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center mx-auto mb-6 shadow-sm border-4 border-white">
                {activeOrder.status === 'served' ? <UtensilsCrossed size={36} /> : <Clock size={36} className="animate-spin" />}
            </div>
            <h2 className="text-xl mb-1 italic tracking-tighter leading-none">ORDER ID: {activeOrder.id}</h2>
            <p className="text-[8px] text-slate-400 mb-6 font-black tracking-normal">KASIH LIAT KODE INI PAS JEMPUT YA!</p>
            
            <div className="flex justify-between mb-8 px-2 relative">
                <div className={`w-1/3 h-2 rounded-full ${activeOrder.status ? 'bg-indigo-600' : 'bg-slate-200'}`}></div>
                <div className={`w-1/3 h-2 rounded-full mx-1 ${activeOrder.status === 'on_process' || activeOrder.status === 'served' ? 'bg-indigo-600' : 'bg-slate-200'}`}></div>
                <div className={`w-1/3 h-2 rounded-full ${activeOrder.status === 'served' ? 'bg-emerald-500' : 'bg-slate-200'}`}></div>
            </div>

            <div className="bg-slate-50 p-8 rounded-[2.5rem] mb-8 italic shadow-inner">
                <h3 className={`text-2xl leading-none ${activeOrder.status === 'served' ? 'text-emerald-600' : 'text-indigo-600'}`}>
                    {activeOrder.status === 'waiting_payment' ? 'BELUM BAYAR' : 
                     activeOrder.status === 'on_process' ? 'LAGI DIMASAK' : 
                     activeOrder.status === 'served' ? 'SIAP DIAMBIL!' : 'DIPROSES'}
                </h3>
            </div>
            <button onClick={() => setShowStatusModal(false)} className="w-full py-5 bg-slate-900 text-white rounded-[2rem] text-[10px] font-black tracking-widest uppercase">TUTUP</button>
          </div>
        </div>
      )}
    </div>
  );
}