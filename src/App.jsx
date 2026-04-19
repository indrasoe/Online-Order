import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { Plus, Minus, ChevronRight, History, Clock, User, ShoppingCart, X, MessageSquare } from 'lucide-react';

// --- KUNCI GUDANG SUPABASE LO ---
const SUPABASE_URL = 'https://stzmwgzvgjrbcuyfhlvq.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN0em13Z3p2Z2pyYmN1eWZobHZxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM2OTExNzYsImV4cCI6MjA3OTI2NzE3Nn0.Sda7ahnvT5qVOwI-EC21313hs4wEpm4NV75sjna4kB4'; 
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const MIDTRANS_CLIENT_KEY = 'Mid-client-BZFtVjMHqC2TSRz0'; // Sandbox/Production Client Key lo

export default function OnlineOrder() {
  const [menu, setMenu] = useState([]);
  const [cart, setCart] = useState([]);
  const [customerName, setCustomerName] = useState(''); 
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [activeOrder, setActiveOrder] = useState(null);
  const [showStatusModal, setShowStatusModal] = useState(false);

  useEffect(() => {
    // 1. Ambil Menu
    const getMenu = async () => {
      const { data } = await supabase.from('products').select('*').eq('is_available', true).order('name');
      if (data) setMenu(data);
    };
    getMenu();

    // 2. Load Midtrans Script
    const script = document.createElement('script');
    script.src = 'https://app.midtrans.com/snap/snap.js';
    script.setAttribute('data-client-key', MIDTRANS_CLIENT_KEY);
    script.async = true;
    document.body.appendChild(script);

    // 3. Cek Pesanan Terakhir (Persistence)
    const lastOrderId = localStorage.getItem('last_online_order');
    if (lastOrderId) subscribeOrder(lastOrderId);
  }, []);

  const subscribeOrder = (orderId) => {
    supabase.channel(`order-${orderId}`).on('postgres_changes', { 
      event: 'UPDATE', 
      schema: 'public', 
      table: 'orders', 
      filter: `id=eq.${orderId}` 
    }, (p) => {
      setActiveOrder(p.new);
      setShowStatusModal(true);
    }).subscribe();

    supabase.from('orders').select('*').eq('id', orderId).single().then(({ data }) => { 
      if (data) setActiveOrder(data); 
    });
  };

  const updateQty = (id, delta) => {
    setCart(prev => prev.map(item => item.id === id ? { ...item, qty: Math.max(0, item.qty + delta) } : item).filter(item => item.qty > 0));
  };

  const updateNote = (id, note) => {
    setCart(prev => prev.map(item => item.id === id ? { ...item, note } : item));
  };

  const total = cart.reduce((a, b) => a + b.price * b.qty, 0);

  const startPayment = async () => {
    if (!customerName) return alert("ISI NAMA DULU BANG!");
    setLoading(true);
    
    const orderId = `ONLINE-${Date.now()}`;
    const orderData = {
      id: orderId,
      meja: 99, 
      items: cart,
      total_harga: total,
      payment_status: 'unpaid',
      status: 'waiting_payment',
      notes: `PENERIMA: ${customerName.toUpperCase()}`
    };

    try {
      // Step 1: Simpan ke DB status waiting
      await supabase.from('orders').insert([orderData]);
      localStorage.setItem('last_online_order', orderId);

      // Step 2: Minta token ke Edge Function
      const res = await fetch(`${SUPABASE_URL}/functions/v1/create-payment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` },
        body: JSON.stringify({ order_id: orderId, amount: total })
      });
      const data = await res.json();

      if (data.token) {
        window.snap.pay(data.token, {
          onSuccess: () => { 
            setCart([]); 
            setIsCartOpen(false); 
            subscribeOrder(orderId); 
            setShowStatusModal(true); 
            setLoading(false); 
          },
          onPending: () => setLoading(false), 
          onClose: () => setLoading(false)
        });
      }
    } catch (e) { 
      alert("Koneksi Error: " + e.message); 
      setLoading(false); 
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 font-black italic uppercase p-4 pb-40">
      
      {/* HEADER */}
      <div className="bg-white p-6 rounded-[2.5rem] shadow-sm mb-4 border-b-4 border-indigo-600 flex justify-between items-center">
        <div>
            <h1 className="text-xl tracking-tighter leading-none">NASGOR ACUN <span className="text-indigo-600 font-black">HOME</span></h1>
            <p className="text-[7px] text-slate-400 mt-1">ORDER DARI RUMAH</p>
        </div>
        {activeOrder && (
          <button onClick={() => setShowStatusModal(true)} className="bg-indigo-50 p-3 rounded-2xl text-indigo-600 animate-pulse">
            <History size={20} />
          </button>
        )}
      </div>

      {/* INPUT NAMA */}
      <div className="bg-indigo-600 p-6 rounded-[2.5rem] text-white mb-6 shadow-lg">
        <label className="text-[9px] mb-2 block opacity-80">ATAS NAMA PENERIMA:</label>
        <div className="relative">
          <User className="absolute left-4 top-1/2 -translate-y-1/2 text-indigo-300" size={18} />
          <input 
            type="text" 
            value={customerName} 
            onChange={(e) => setCustomerName(e.target.value)} 
            placeholder="CONTOH: PAK ANJUN" 
            className="w-full bg-white/10 border-2 border-white/20 rounded-2xl py-4 pl-12 pr-4 outline-none placeholder:text-indigo-300 italic font-black"
          />
        </div>
      </div>

      {/* MENU LIST */}
      <div className="space-y-4">
        {menu.map(item => (
          <div key={item.id} className="bg-white p-4 rounded-[2rem] shadow-sm flex gap-4 items-center border-2 border-transparent active:border-indigo-100 transition-all">
            <img src={item.image_url} className="w-20 h-20 rounded-2xl object-cover bg-slate-100 shadow-inner" />
            <div className="flex-1">
              <h3 className="text-[10px] leading-tight mb-1">{item.name}</h3>
              <p className="text-emerald-600 text-sm">Rp {item.price.toLocaleString()}</p>
            </div>
            <button 
                onClick={() => {
                    const exist = cart.find(c => c.id === item.id);
                    if (exist) updateQty(item.id, 1);
                    else setCart([...cart, { ...item, qty: 1, note: '' }]);
                }} 
                className="bg-slate-900 text-white p-4 rounded-2xl active:scale-90 transition-transform shadow-lg shadow-slate-200"
            >
              <Plus size={16} />
            </button>
          </div>
        ))}
      </div>

      {/* FLOATING CART (SESUAI REQUEST: TOTAL HARGA) */}
      {cart.length > 0 && !isCartOpen && (
        <button 
          onClick={() => setIsCartOpen(true)} 
          className="fixed bottom-6 left-4 right-4 bg-indigo-600 text-white p-5 rounded-[2.5rem] shadow-2xl flex justify-between items-center z-[100] active:scale-95 transition-transform"
        >
          <div className="flex flex-col items-start ml-4">
            <span className="text-[8px] opacity-80 tracking-widest">TOTAL PESANAN</span>
            <span className="text-lg font-black tracking-tighter">Rp {total.toLocaleString()}</span>
          </div>
          <div className="flex items-center gap-2 bg-white/20 px-5 py-3 rounded-2xl text-[9px] font-black border border-white/10">
            <ShoppingCart size={14} />
            CEK KERANJANG
          </div>
        </button>
      )}

      {/* CART OVERLAY (MODAL REVIEW PESANAN) */}
      {isCartOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[150] flex items-end">
          <div className="bg-white w-full rounded-t-[3rem] p-0 max-h-[95vh] flex flex-col shadow-2xl overflow-hidden">
            
            <div className="flex justify-between items-center p-6 pb-2">
              <h2 className="text-xl tracking-tighter font-black">REVIEW PESANAN</h2>
              <button onClick={() => setIsCartOpen(false)} className="p-3 bg-slate-100 rounded-full active:scale-75 transition-all">
                <X size={20}/>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6 custom-scrollbar">
              {cart.map(item => (
                <div key={item.id} className="border-b border-slate-50 pb-4">
                  <div className="flex justify-between items-start mb-3">
                    <div className="w-2/3">
                      <h4 className="text-[10px] leading-tight mb-1 font-black">{item.name}</h4>
                      <p className="text-emerald-600 text-[10px] font-black">Rp {(item.price * item.qty).toLocaleString()}</p>
                    </div>
                    <div className="flex items-center gap-3 bg-slate-100 p-2 rounded-2xl">
                      <button onClick={() => updateQty(item.id, -1)} className="text-indigo-600 p-1"><Minus size={14}/></button>
                      <span className="text-xs font-black w-4 text-center">{item.qty}</span>
                      <button onClick={() => updateQty(item.id, 1)} className="text-indigo-600 p-1"><Plus size={14}/></button>
                    </div>
                  </div>
                  <div className="relative">
                    <MessageSquare size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" />
                    <input 
                      type="text" 
                      placeholder="TAMBAHKAN CATATAN (PEDAS, DLL)..." 
                      value={item.note || ''}
                      onChange={(e) => updateNote(item.id, e.target.value)}
                      className="w-full bg-slate-50 rounded-2xl py-3 pl-9 pr-4 text-[9px] outline-none border-2 border-transparent focus:border-indigo-100 italic font-black"
                    />
                  </div>
                </div>
              ))}
            </div>

            {/* TOTALAN AREA */}
            <div className="bg-slate-50 p-8 rounded-t-[3rem] border-t border-slate-100 shadow-[0_-10px_40px_rgba(0,0,0,0.05)]">
              <div className="space-y-2 mb-6">
                <div className="flex justify-between items-center text-slate-400">
                  <span className="text-[9px]">SUBTOTAL</span>
                  <span className="text-[10px]">Rp {total.toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center text-slate-400 pt-1">
                  <span className="text-[9px]">BIAYA LAYANAN</span>
                  <span className="text-[10px]">Rp 0</span>
                </div>
                <div className="flex justify-between items-center pt-3 mt-2 border-t border-slate-200">
                  <span className="text-[10px] text-slate-900 font-black">TOTAL PEMBAYARAN</span>
                  <span className="text-xl text-emerald-600 font-black">Rp {total.toLocaleString()}</span>
                </div>
              </div>

              <button 
                onClick={startPayment} 
                disabled={loading} 
                className="w-full py-5 bg-indigo-600 text-white rounded-[2rem] flex justify-center items-center gap-3 shadow-xl shadow-indigo-100 active:scale-95 disabled:opacity-50 transition-all font-black"
              >
                {loading ? <Clock size={20} className="animate-spin" /> : <>KONFIRMASI & BAYAR <ChevronRight size={20}/></>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* STATUS MODAL (REALTIME DARI ADMIN) */}
      {showStatusModal && activeOrder && (
        <div className="fixed inset-0 bg-slate-900/95 backdrop-blur-md z-[200] flex items-center justify-center p-6 text-center">
            <div className="bg-white w-full max-w-sm rounded-[3rem] p-8 shadow-2xl">
                <div className="w-16 h-16 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Clock size={32} className={activeOrder.status !== 'served' ? "animate-spin" : ""} />
                </div>
                <h2 className="text-xl mb-2 tracking-tighter font-black">STATUS PESANAN</h2>
                <div className="bg-slate-50 p-6 rounded-[2rem] mb-6">
                    <h3 className="text-2xl text-indigo-600 uppercase tracking-tighter font-black">
                        {activeOrder.status.replace('_', ' ')}
                    </h3>
                </div>
                <p className="text-[9px] text-slate-400 mb-8 font-black">ID: #{activeOrder.id.slice(-5)}</p>
                <button onClick={() => setShowStatusModal(false)} className="w-full py-4 bg-slate-900 text-white rounded-2xl text-[10px] font-black">TUTUP</button>
            </div>
        </div>
      )}
    </div>
  );
}