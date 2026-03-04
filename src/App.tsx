import React, { useState, useEffect, useMemo } from 'react';
import { 
  LayoutDashboard, 
  Plus, 
  History, 
  ArrowUpCircle, 
  ArrowDownCircle, 
  AlertCircle, 
  Trash2,
  Package,
  Search,
  ChevronRight,
  Loader2,
  LogIn,
  LogOut,
  User as UserIcon,
  Lock
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { supabase } from './lib/supabase';

interface User {
  id: number;
  username: string;
  name: string;
  role: string;
}

interface Item {
  id: number;
  name: string;
  unit: string;
  category: string;
  min_stock: number;
  current_stock: number;
}

interface Transaction {
  id: number;
  item_id: number;
  item_name: string;
  type: 'IN' | 'OUT';
  quantity: number;
  date: string;
  note: string;
  unit: string;
}

interface Patient {
  id: number;
  type: 'DIET' | 'HERBAL';
  name: string;
  chart_number: string;
  phone: string;
  consultation_date: string;
  next_contact_date: string;
  status: string;
  memo: string;
  diet_stage: string;
  total_count: string;
  months: string;
  phone_consultation: string;
  created_at: string;
}

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(true);
  const [authLoading, setAuthLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'items' | 'history' | 'patients'>('dashboard');
  const [patientType, setPatientType] = useState<'DIET' | 'HERBAL'>('DIET');
  const [historyFilter, setHistoryFilter] = useState<string>('all');
  const [historySearch, setHistorySearch] = useState('');
  const [dashboardSearch, setDashboardSearch] = useState('');

  // Sync state with URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tab = params.get('tab');
    const filter = params.get('filter');
    const search = params.get('search');

    if (tab && ['dashboard', 'items', 'history', 'patients'].includes(tab)) {
      setActiveTab(tab as any);
    }
    if (filter) setHistoryFilter(filter);
    if (search) setHistorySearch(search);
  }, []);

  useEffect(() => {
    if (!user) return;
    const params = new URLSearchParams();
    params.set('tab', activeTab);
    if (activeTab === 'history') {
      if (historyFilter !== 'all') params.set('filter', historyFilter);
      if (historySearch) params.set('search', historySearch);
    }
    const newUrl = `${window.location.pathname}?${params.toString()}`;
    window.history.replaceState({}, '', newUrl);
  }, [activeTab, historyFilter, historySearch, user]);
  
  // Login form state
  const [loginForm, setLoginForm] = useState({ username: '', password: '' });
  const [loginError, setLoginError] = useState('');
  const [configError, setConfigError] = useState(false);

  useEffect(() => {
    if (!import.meta.env.VITE_SUPABASE_URL || !import.meta.env.VITE_SUPABASE_ANON_KEY) {
      setConfigError(true);
    }
  }, []);

  // Form states
  const [showAddItem, setShowAddItem] = useState(false);
  const [showTransaction, setShowTransaction] = useState<{show: boolean, type: 'IN' | 'OUT', itemId?: number}>({ show: false, type: 'IN' });
  
  const [newItem, setNewItem] = useState({ name: '', unit: '박스', category: '한약', min_stock: 10 });
  const [newTransaction, setNewTransaction] = useState({ item_id: 0, quantity: 0, note: '', date: new Date().toISOString().split('T')[0] });
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<{show: boolean, itemId?: number, itemName?: string}>({ show: false });
  const [showPatientDeleteConfirm, setShowPatientDeleteConfirm] = useState<{show: boolean, patientId?: number, patientName?: string}>({ show: false });
  const [showAddPatient, setShowAddPatient] = useState(false);
  const [editingPatient, setEditingPatient] = useState<Patient | null>(null);
  const [newPatient, setNewPatient] = useState<Partial<Patient>>({
    type: 'DIET',
    name: '',
    chart_number: '',
    phone: '',
    consultation_date: new Date().toISOString().split('T')[0],
    next_contact_date: '',
    status: '상담 예약',
    memo: '',
    diet_stage: '',
    total_count: '',
    months: '',
    phone_consultation: ''
  });

  useEffect(() => {
    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        setUser({
          id: session.user.id as any,
          username: session.user.email || '',
          name: session.user.user_metadata.name || session.user.email?.split('@')[0] || '사용자',
          role: session.user.user_metadata.role || 'staff'
        });
      }
      setAuthLoading(false);
    };

    checkUser();
    fetchData();

    // Supabase Real-time subscriptions
    const inventorySubscription = supabase
      .channel('inventory-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'inventory' }, () => fetchData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'transactions' }, () => fetchData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'patients' }, () => fetchData())
      .subscribe();

    return () => {
      supabase.removeChannel(inventorySubscription);
    };
  }, []);

  const itemsWithStock = React.useMemo(() => {
    return items.map(item => {
      const itemTransactions = transactions.filter(t => t.item_id === item.id);
      const stock = itemTransactions.reduce((acc, t) => {
        return t.type === 'IN' ? acc + t.quantity : acc - t.quantity;
      }, 0);
      return { ...item, current_stock: stock };
    });
  }, [items, transactions]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: loginForm.username.includes('@') ? loginForm.username : `${loginForm.username}@example.com`,
        password: loginForm.password,
      });

      if (error) throw error;

      if (data.user) {
        setUser({
          id: data.user.id as any,
          username: data.user.email || '',
          name: data.user.user_metadata.name || data.user.email?.split('@')[0] || '사용자',
          role: data.user.user_metadata.role || 'staff'
        });
      }
    } catch (error: any) {
      setLoginError(error.message || '로그인에 실패했습니다.');
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setUser(null);
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const [
        { data: itemsData, error: itemsError },
        { data: transData, error: transError },
        { data: patientsData, error: patientsError }
      ] = await Promise.all([
        supabase.from('inventory').select('*').order('name'),
        supabase.from('transactions').select('*, inventory(name, unit)').order('date', { ascending: false }),
        supabase.from('patients').select('*').order('created_at', { ascending: false })
      ]);

      if (itemsError) throw itemsError;
      if (transError) throw transError;
      if (patientsError) throw patientsError;

      setItems(itemsData || []);
      
      // Map transactions to include item_name and unit from the joined inventory table
      const formattedTransactions = (transData || []).map((t: any) => ({
        ...t,
        item_name: t.inventory?.name || '알 수 없음',
        unit: t.inventory?.unit || ''
      }));
      setTransactions(formattedTransactions);
      setPatients(patientsData || []);
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const { error } = await supabase.from('inventory').insert([newItem]);
      if (error) throw error;
      setNewItem({ name: '', unit: '박스', category: '한약', min_stock: 10 });
      setShowAddItem(false);
      fetchData();
    } catch (error) {
      console.error('Failed to add item:', error);
    }
  };

  const handleAddTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const { error } = await supabase.from('transactions').insert([{
        ...newTransaction,
        type: showTransaction.type
      }]);
      if (error) throw error;
      setNewTransaction({ item_id: 0, quantity: 0, note: '', date: new Date().toISOString().split('T')[0] });
      setShowTransaction({ show: false, type: 'IN' });
      fetchData();
    } catch (error) {
      console.error('Failed to add transaction:', error);
    }
  };

  const handleDeleteItem = (id: number) => {
    const item = items.find(i => i.id === id);
    if (item) {
      setShowDeleteConfirm({ show: true, itemId: id, itemName: item.name });
    }
  };

  const confirmDelete = async (id: number) => {
    setShowDeleteConfirm({ show: false });
    try {
      const { error } = await supabase.from('inventory').delete().eq('id', id);
      if (error) throw error;
      fetchData();
    } catch (error) {
      console.error('Failed to delete item:', error);
      alert('삭제 중 오류가 발생했습니다.');
    }
  };

  const handleAddPatient = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const patientData = { ...newPatient, type: patientType };
      let error;
      
      if (editingPatient) {
        ({ error } = await supabase.from('patients').update(patientData).eq('id', editingPatient.id));
      } else {
        ({ error } = await supabase.from('patients').insert([patientData]));
      }
      
      if (error) throw error;

      setShowAddPatient(false);
      setEditingPatient(null);
      setNewPatient({
        type: patientType,
        name: '',
        chart_number: '',
        phone: '',
        consultation_date: new Date().toISOString().split('T')[0],
        next_contact_date: '',
        status: '상담 예약',
        memo: '',
        diet_stage: '',
        total_count: '',
        months: '',
        phone_consultation: ''
      });
      fetchData();
    } catch (error) {
      console.error('Failed to save patient:', error);
    }
  };

  const handleDeletePatient = (id: number) => {
    const patient = patients.find(p => p.id === id);
    if (patient) {
      setShowPatientDeleteConfirm({ show: true, patientId: id, patientName: patient.name });
    }
  };

  const confirmDeletePatient = async (id: number) => {
    setShowPatientDeleteConfirm({ show: false });
    try {
      const { error } = await supabase.from('patients').delete().eq('id', id);
      if (error) throw error;
      fetchData();
    } catch (error) {
      console.error('Failed to delete patient:', error);
      alert('환자 삭제 중 오류가 발생했습니다.');
    }
  };

  const filteredTransactions = transactions.filter(t => {
    const itemMatch = t.item_name.toLowerCase().includes(historySearch.toLowerCase()) || 
                     (t.note && t.note.toLowerCase().includes(historySearch.toLowerCase()));
    
    if (!itemMatch) return false;
    if (historyFilter === 'all') return true;

    const transDate = new Date(t.date);
    const [filterYear, filterMonth] = historyFilter.split('-').map(Number);
    
    return transDate.getFullYear() === filterYear && (transDate.getMonth() + 1) === filterMonth;
  });

  const lowStockItems = itemsWithStock.filter(item => item.current_stock <= item.min_stock);
  const dashboardSearchResults = dashboardSearch.trim() 
    ? itemsWithStock.filter(item => item.name.toLowerCase().includes(dashboardSearch.toLowerCase()))
    : [];

  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md"
        >
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-emerald-600 rounded-2xl flex items-center justify-center text-white mx-auto mb-4 shadow-lg">
              <Package size={32} />
            </div>
            <h1 className="text-3xl font-black text-slate-900 tracking-tight">한약 재고관리</h1>
            <p className="text-slate-500 mt-2">한의원 내부 시스템에 로그인하세요.</p>
          </div>

          <div className="bg-white p-8 rounded-3xl shadow-xl border border-slate-100">
            {configError && (
              <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-sm">
                <p className="font-bold flex items-center gap-2 mb-1">
                  <AlertCircle size={16} />
                  Supabase 설정이 필요합니다
                </p>
                <p>AI Studio의 환경 변수(Environment Variables)에 URL과 Anon Key를 입력해 주세요.</p>
              </div>
            )}
            <form onSubmit={handleLogin} className="space-y-6">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">아이디</label>
                <div className="relative">
                  <UserIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <input 
                    required
                    type="text"
                    value={loginForm.username}
                    onChange={e => setLoginForm({...loginForm, username: e.target.value})}
                    className="w-full pl-12 pr-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                    placeholder="아이디를 입력하세요"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">비밀번호</label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <input 
                    required
                    type="password"
                    value={loginForm.password}
                    onChange={e => setLoginForm({...loginForm, password: e.target.value})}
                    className="w-full pl-12 pr-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                    placeholder="비밀번호를 입력하세요"
                  />
                </div>
              </div>

              {loginError && (
                <motion.div 
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="p-3 bg-red-50 text-red-600 text-sm font-bold rounded-xl flex items-center gap-2"
                >
                  <AlertCircle size={16} />
                  {loginError}
                </motion.div>
              )}

              <button 
                type="submit"
                className="w-full bg-emerald-600 text-white py-4 rounded-xl font-bold text-lg hover:bg-emerald-700 transition-all shadow-md active:scale-[0.98]"
              >
                로그인
              </button>
            </form>
          </div>
          
          <p className="text-center text-slate-400 text-sm mt-8">
            계정 정보가 없으시면 관리자에게 문의하세요.
          </p>
        </motion.div>
      </div>
    );
  }

  if (loading && items.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col md:flex-row">
      {/* Sidebar */}
      <aside className="w-full md:w-64 bg-white border-r border-slate-200 p-6 flex flex-col gap-8">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-emerald-600 rounded-xl flex items-center justify-center text-white">
            <Package size={24} />
          </div>
          <h1 className="font-bold text-xl tracking-tight">한약 재고관리</h1>
        </div>

        <nav className="flex flex-col gap-2">
          <button 
            onClick={() => setActiveTab('dashboard')}
            className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeTab === 'dashboard' ? 'bg-emerald-50 text-emerald-700 font-medium' : 'text-slate-500 hover:bg-slate-50'}`}
          >
            <LayoutDashboard size={20} />
            대시보드
          </button>
          <button 
            onClick={() => setActiveTab('items')}
            className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeTab === 'items' ? 'bg-emerald-50 text-emerald-700 font-medium' : 'text-slate-500 hover:bg-slate-50'}`}
          >
            <Package size={20} />
            품목 관리
          </button>
          <button 
            onClick={() => setActiveTab('history')}
            className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeTab === 'history' ? 'bg-emerald-50 text-emerald-700 font-medium' : 'text-slate-500 hover:bg-slate-50'}`}
          >
            <History size={20} />
            입출고 내역
          </button>
          <button 
            onClick={() => setActiveTab('patients')}
            className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeTab === 'patients' ? 'bg-emerald-50 text-emerald-700 font-medium' : 'text-slate-500 hover:bg-slate-50'}`}
          >
            <UserIcon size={20} />
            비급여 환자 관리
          </button>
        </nav>

        <div className="mt-auto flex flex-col gap-4">
          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
            <p className="text-xs text-slate-400 uppercase font-bold tracking-wider mb-2">접속 계정</p>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-slate-200 rounded-full flex items-center justify-center text-slate-600 font-bold text-xs">
                {user.name[0]}
              </div>
              <div>
                <p className="text-sm font-bold text-slate-900 leading-none">{user.name}</p>
                <p className="text-[10px] text-slate-400 uppercase font-bold mt-1">{user.role === 'admin' ? '관리자' : '직원'}</p>
              </div>
            </div>
          </div>

          <button 
            onClick={handleLogout}
            className="flex items-center gap-3 px-4 py-3 rounded-xl text-red-500 hover:bg-red-50 transition-all font-medium"
          >
            <LogOut size={20} />
            로그아웃
          </button>

          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
            <p className="text-xs text-slate-400 uppercase font-bold tracking-wider mb-2">재고 부족 알림</p>
            <p className="text-3xl font-black text-slate-900">{lowStockItems.length} <span className="text-sm font-normal text-slate-500">품목</span></p>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-6 md:p-10 overflow-y-auto">
        <AnimatePresence mode="wait">
          {activeTab === 'dashboard' && (
            <motion.div 
              key="dashboard"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-8"
            >
              <header className="flex justify-between items-end">
                <div>
                  <h2 className="text-3xl font-bold text-slate-900">대시보드</h2>
                  <p className="text-slate-500">현재 재고 현황과 주요 알림을 확인하세요.</p>
                </div>
                <div className="flex flex-col items-end gap-3">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input 
                      type="text"
                      placeholder="품목 바로 검색..."
                      value={dashboardSearch}
                      onChange={(e) => setDashboardSearch(e.target.value)}
                      className="pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none w-64 shadow-sm"
                    />
                  </div>
                  <div className="flex gap-3">
                    <button 
                      onClick={() => { setShowTransaction({ show: true, type: 'IN' }); setNewTransaction(prev => ({ ...prev, item_id: items[0]?.id || '' })) }}
                      className="flex items-center gap-2 bg-emerald-600 text-white px-5 py-2.5 rounded-xl font-medium hover:bg-emerald-700 transition-colors shadow-sm"
                    >
                      <ArrowUpCircle size={18} />
                      입고하기
                    </button>
                    <button 
                      onClick={() => { setShowTransaction({ show: true, type: 'OUT' }); setNewTransaction(prev => ({ ...prev, item_id: items[0]?.id || '' })) }}
                      className="flex items-center gap-2 bg-slate-900 text-white px-5 py-2.5 rounded-xl font-medium hover:bg-slate-800 transition-colors shadow-sm"
                    >
                      <ArrowDownCircle size={18} />
                      출고하기
                    </button>
                  </div>
                </div>
              </header>

              {/* Stats Grid */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="glass-card p-6">
                  <div className="flex justify-between items-start mb-4">
                    <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
                      <Package size={24} />
                    </div>
                    <span className="text-xs font-bold text-slate-400 uppercase">전체 품목</span>
                  </div>
                  <p className="text-5xl font-black text-slate-900 tracking-tighter">{itemsWithStock.length}</p>
                  <p className="text-sm text-slate-500 mt-1">등록된 한약 종류</p>
                </div>

                <div className="glass-card p-6 border-red-200 bg-red-50/30">
                  <div className="flex justify-between items-start mb-4">
                    <div className="p-2 bg-red-100 text-red-600 rounded-lg">
                      <AlertCircle size={24} />
                    </div>
                    <span className="text-xs font-bold text-red-600 uppercase">재고 부족</span>
                  </div>
                  <p className="text-5xl font-black text-red-600 tracking-tighter">{lowStockItems.length}</p>
                  <p className="text-sm text-slate-500 mt-1">최소 수량 미달 품목</p>
                </div>

                <div className="glass-card p-6">
                  <div className="flex justify-between items-start mb-4">
                    <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg">
                      <History size={24} />
                    </div>
                    <span className="text-xs font-bold text-slate-400 uppercase">최근 거래</span>
                  </div>
                  <p className="text-5xl font-black text-slate-900 tracking-tighter">{transactions.filter(t => {
                    const d = new Date(t.date);
                    const today = new Date();
                    return d.toDateString() === today.toDateString();
                  }).length}</p>
                  <p className="text-sm text-slate-500 mt-1">오늘 발생한 입출고</p>
                </div>
              </div>

              {/* Search Results or Low Stock Table */}
              <section className="glass-card overflow-hidden">
                <div className="p-6 border-b border-slate-100 flex justify-between items-center">
                  <h3 className="font-bold text-lg">
                    {dashboardSearch.trim() ? `검색 결과: "${dashboardSearch}"` : '재고 부족 품목'}
                  </h3>
                  {!dashboardSearch.trim() && (
                    <button onClick={() => setActiveTab('items')} className="text-emerald-600 text-sm font-medium flex items-center gap-1 hover:underline">
                      전체 보기 <ChevronRight size={16} />
                    </button>
                  )}
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead className="bg-slate-50/50 text-slate-400 text-xs uppercase font-bold tracking-wider">
                      <tr>
                        <th className="px-6 py-4">품목명</th>
                        <th className="px-6 py-4">카테고리</th>
                        <th className="px-6 py-4 text-right">현재 재고</th>
                        <th className="px-6 py-4 text-right">최소 수량</th>
                        <th className="px-6 py-4 text-center">상태</th>
                        <th className="px-6 py-4 text-center">작업</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {dashboardSearch.trim() ? (
                        dashboardSearchResults.length > 0 ? dashboardSearchResults.map(item => (
                          <tr key={item.id} className="hover:bg-slate-50/50 transition-colors">
                            <td className="px-6 py-4 font-medium text-slate-900">{item.name}</td>
                            <td className="px-6 py-4 text-slate-500 text-sm">{item.category}</td>
                            <td className={`px-6 py-4 text-right font-mono font-black text-xl ${item.current_stock <= item.min_stock ? 'text-red-600' : 'text-blue-700'}`}>
                              {item.current_stock} <span className="text-xs font-normal text-slate-400">{item.unit}</span>
                            </td>
                            <td className="px-6 py-4 text-right text-slate-400 text-base font-medium">{item.min_stock} <span className="text-xs">{item.unit}</span></td>
                            <td className="px-6 py-4 text-center">
                              {item.current_stock <= item.min_stock ? (
                                <span className="px-2.5 py-1 bg-red-100 text-red-700 rounded-full text-xs font-bold">재고 부족</span>
                              ) : (
                                <span className="px-2.5 py-1 bg-emerald-100 text-emerald-700 rounded-full text-xs font-bold">정상</span>
                              )}
                            </td>
                            <td className="px-6 py-4 text-center">
                              <div className="flex justify-center gap-2">
                                <button 
                                  onClick={() => handleDeleteItem(item.id)}
                                  className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                  title="삭제"
                                >
                                  <Trash2 size={16} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        )) : (
                          <tr>
                            <td colSpan={6} className="px-6 py-10 text-center text-slate-400 italic">검색 결과가 없습니다.</td>
                          </tr>
                        )
                      ) : (
                        lowStockItems.length > 0 ? lowStockItems.map(item => (
                          <tr key={item.id} className="hover:bg-slate-50/50 transition-colors">
                            <td className="px-6 py-4 font-medium text-slate-900">{item.name}</td>
                            <td className="px-6 py-4 text-slate-500 text-sm">{item.category}</td>
                            <td className="px-6 py-4 text-right font-mono text-red-600 font-black text-2xl">{item.current_stock} <span className="text-xs font-normal text-slate-400">{item.unit}</span></td>
                            <td className="px-6 py-4 text-right text-slate-400 text-base font-medium">{item.min_stock} <span className="text-xs">{item.unit}</span></td>
                            <td className="px-6 py-4 text-center">
                              <span className="px-2.5 py-1 bg-red-100 text-red-700 rounded-full text-xs font-bold">재고 부족</span>
                            </td>
                            <td className="px-6 py-4 text-center">
                              <div className="flex justify-center gap-2">
                                <button 
                                  onClick={() => handleDeleteItem(item.id)}
                                  className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                  title="삭제"
                                >
                                  <Trash2 size={16} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        )) : (
                          <tr>
                            <td colSpan={6} className="px-6 py-10 text-center text-slate-400 italic">재고가 부족한 품목이 없습니다.</td>
                          </tr>
                        )
                      )}
                    </tbody>
                  </table>
                </div>
              </section>
            </motion.div>
          )}

          {activeTab === 'items' && (
            <motion.div 
              key="items"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-6"
            >
              <header className="flex justify-between items-end">
                <div>
                  <h2 className="text-3xl font-bold text-slate-900">품목 관리</h2>
                  <p className="text-slate-500">한약 목록을 추가하거나 수정할 수 있습니다.</p>
                </div>
                <button 
                  onClick={() => setShowAddItem(true)}
                  className="flex items-center gap-2 bg-emerald-600 text-white px-5 py-2.5 rounded-xl font-medium hover:bg-emerald-700 transition-colors shadow-sm"
                >
                  <Plus size={18} />
                  새 품목 추가
                </button>
              </header>

              <div className="glass-card overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead className="bg-slate-50/50 text-slate-400 text-xs uppercase font-bold tracking-wider">
                      <tr>
                        <th className="px-6 py-4">품목명</th>
                        <th className="px-6 py-4">카테고리</th>
                        <th className="px-6 py-4">단위</th>
                        <th className="px-6 py-4 text-right">현재 재고</th>
                        <th className="px-6 py-4 text-right">최소 수량</th>
                        <th className="px-6 py-4 text-center">작업</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {itemsWithStock.length > 0 ? itemsWithStock.map(item => (
                        <tr key={item.id} className="hover:bg-slate-50/50 transition-colors">
                          <td className="px-6 py-4 font-medium text-slate-900">{item.name}</td>
                          <td className="px-6 py-4 text-slate-500 text-sm">{item.category}</td>
                          <td className="px-6 py-4 text-slate-500 text-sm">{item.unit}</td>
                          <td className={`px-6 py-4 text-right font-mono font-black text-3xl ${item.current_stock <= item.min_stock ? 'text-red-600' : 'text-blue-700'}`}>
                            {item.current_stock}
                          </td>
                          <td className="px-6 py-4 text-right text-slate-400 text-lg font-medium">{item.min_stock}</td>
                          <td className="px-6 py-4 text-center">
                            <div className="flex justify-center gap-2">
                              <button 
                                onClick={() => { setShowTransaction({ show: true, type: 'IN', itemId: item.id }); setNewTransaction(prev => ({ ...prev, item_id: item.id })) }}
                                className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                                title="입고"
                              >
                                <ArrowUpCircle size={18} />
                              </button>
                              <button 
                                onClick={() => { setShowTransaction({ show: true, type: 'OUT', itemId: item.id }); setNewTransaction(prev => ({ ...prev, item_id: item.id })) }}
                                className="p-1.5 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                                title="출고"
                              >
                                <ArrowDownCircle size={18} />
                              </button>
                              <button 
                                onClick={() => handleDeleteItem(item.id)}
                                className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                title="삭제"
                              >
                                <Trash2 size={18} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      )) : (
                        <tr>
                          <td colSpan={6} className="px-6 py-10 text-center text-slate-400 italic">등록된 품목이 없습니다.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'history' && (
            <motion.div 
              key="history"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-6"
            >
              <header className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div>
                  <h2 className="text-3xl font-bold text-slate-900">입출고 내역</h2>
                  <p className="text-slate-500">과거의 모든 재고 변동 내역을 확인하세요.</p>
                </div>
                
                <div className="flex flex-wrap items-center gap-3">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input 
                      type="text"
                      placeholder="품목명 또는 메모 검색..."
                      value={historySearch}
                      onChange={(e) => setHistorySearch(e.target.value)}
                      className="pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none w-64"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={() => setHistoryFilter('all')}
                      className={`px-4 py-2 rounded-xl text-sm font-medium transition-all border ${historyFilter === 'all' ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'}`}
                    >
                      전체 보기
                    </button>
                    <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-3 py-2">
                      <span className="text-xs font-bold text-slate-400 uppercase">월별 선택:</span>
                      <input 
                        type="month"
                        value={historyFilter === 'all' ? '' : historyFilter}
                        onChange={(e) => setHistoryFilter(e.target.value || 'all')}
                        className="bg-transparent outline-none text-sm font-medium text-slate-700"
                      />
                    </div>
                  </div>
                </div>
              </header>

              <div className="glass-card overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead className="bg-slate-50/50 text-slate-400 text-xs uppercase font-bold tracking-wider">
                      <tr>
                        <th className="px-6 py-4">날짜</th>
                        <th className="px-6 py-4">품목명</th>
                        <th className="px-6 py-4">구분</th>
                        <th className="px-6 py-4 text-right">수량</th>
                        <th className="px-6 py-4">비고</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredTransactions.length > 0 ? filteredTransactions.map(t => (
                        <tr key={t.id} className="hover:bg-slate-50/50 transition-colors">
                          <td className="px-6 py-4 text-slate-500 text-sm font-mono">
                            {new Date(t.date).toLocaleDateString()} {new Date(t.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </td>
                          <td className="px-6 py-4 font-medium text-slate-900">{t.item_name}</td>
                          <td className="px-6 py-4">
                            <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${t.type === 'IN' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-700'}`}>
                              {t.type === 'IN' ? '입고' : '출고'}
                            </span>
                          </td>
                          <td className={`px-6 py-4 text-right font-mono font-black text-xl ${t.type === 'IN' ? 'text-emerald-600' : 'text-slate-600'}`}>
                            {t.type === 'IN' ? '+' : '-'}{t.quantity} <span className="text-xs font-normal text-slate-400">{t.unit}</span>
                          </td>
                          <td className="px-6 py-4 text-slate-800 text-base font-semibold">{t.note || '-'}</td>
                        </tr>
                      )) : (
                        <tr>
                          <td colSpan={5} className="px-6 py-10 text-center text-slate-400 italic">내역이 없습니다.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'patients' && (
            <motion.div 
              key="patients"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-6"
            >
              <header className="flex justify-between items-end">
                <div>
                  <h2 className="text-3xl font-bold text-slate-900">
                    {patientType === 'DIET' ? '다이어트 환자 관리' : '비급여 한약 관리'}
                  </h2>
                  <p className="text-slate-500">비급여 환자 상담 및 진행 상태를 관리하세요.</p>
                </div>
                <div className="flex gap-3">
                  <div className="flex bg-slate-100 p-1 rounded-xl">
                    <button 
                      onClick={() => setPatientType('DIET')}
                      className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${patientType === 'DIET' ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                      다이어트
                    </button>
                    <button 
                      onClick={() => setPatientType('HERBAL')}
                      className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${patientType === 'HERBAL' ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                      비급여 한약
                    </button>
                  </div>
                  <button 
                    onClick={() => {
                      setEditingPatient(null);
                      setNewPatient({
                        type: patientType,
                        name: '',
                        chart_number: '',
                        phone: '',
                        consultation_date: new Date().toISOString().split('T')[0],
                        next_contact_date: '',
                        status: patientType === 'DIET' ? '상담 예약' : '시작 전',
                        memo: '',
                        diet_stage: '',
                        total_count: '',
                        months: '',
                        phone_consultation: ''
                      });
                      setShowAddPatient(true);
                    }}
                    className="flex items-center gap-2 bg-emerald-600 text-white px-5 py-2.5 rounded-xl font-medium hover:bg-emerald-700 transition-colors shadow-sm"
                  >
                    <Plus size={18} />
                    새로 만들기
                  </button>
                </div>
              </header>

              <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead className="bg-slate-50 text-slate-500 text-xs font-bold border-b border-slate-200">
                      <tr>
                        {patientType === 'DIET' ? (
                          <>
                            <th className="px-4 py-3 border-r border-slate-200">메모</th>
                            <th className="px-4 py-3 border-r border-slate-200">성함</th>
                            <th className="px-4 py-3 border-r border-slate-200">차트번호</th>
                            <th className="px-4 py-3 border-r border-slate-200">상담 날짜</th>
                            <th className="px-4 py-3 border-r border-slate-200">다음 연락 예정일</th>
                            <th className="px-4 py-3 border-r border-slate-200">진행상태</th>
                            <th className="px-4 py-3">다이어트 단계 / 총 갯수</th>
                          </>
                        ) : (
                          <>
                            <th className="px-4 py-3 border-r border-slate-200">성함</th>
                            <th className="px-4 py-3 border-r border-slate-200">상태</th>
                            <th className="px-4 py-3 border-r border-slate-200">전화번호</th>
                            <th className="px-4 py-3 border-r border-slate-200">상담 날짜</th>
                            <th className="px-4 py-3 border-r border-slate-200">다음 연락 예정일</th>
                            <th className="px-4 py-3 border-r border-slate-200">개월수</th>
                            <th className="px-4 py-3">전화 문진</th>
                          </>
                        )}
                        <th className="px-4 py-3 text-center">작업</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {patients.filter(p => p.type === patientType).length > 0 ? (
                        patients.filter(p => p.type === patientType).map(patient => (
                          <tr key={patient.id} className="hover:bg-slate-50/50 transition-colors group">
                            {patientType === 'DIET' ? (
                              <>
                                <td className="px-4 py-3 border-r border-slate-100 text-slate-500 text-sm truncate max-w-[150px]">{patient.memo || '-'}</td>
                                <td className="px-4 py-3 border-r border-slate-100 font-bold text-slate-900">{patient.name}</td>
                                <td className="px-4 py-3 border-r border-slate-100 text-slate-500 font-mono">{patient.chart_number || '-'}</td>
                                <td className="px-4 py-3 border-r border-slate-100 text-slate-600">{patient.consultation_date}</td>
                                <td className="px-4 py-3 border-r border-slate-100">
                                  <div className="flex items-center gap-1 text-red-500 font-medium">
                                    {patient.next_contact_date || '-'}
                                    {patient.next_contact_date && <History size={14} />}
                                  </div>
                                </td>
                                <td className="px-4 py-3 border-r border-slate-100">
                                  <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                                    patient.status === '진행 중' ? 'bg-blue-100 text-blue-700' : 'bg-red-100 text-red-700'
                                  }`}>
                                    {patient.status}
                                  </span>
                                </td>
                                <td className="px-4 py-3 text-slate-700">
                                  {patient.diet_stage} / {patient.total_count}
                                </td>
                              </>
                            ) : (
                              <>
                                <td className="px-4 py-3 border-r border-slate-100 font-bold text-slate-900">{patient.name}</td>
                                <td className="px-4 py-3 border-r border-slate-100">
                                  <span className="px-3 py-1 bg-slate-200 text-slate-700 rounded-full text-xs font-bold">
                                    {patient.status}
                                  </span>
                                </td>
                                <td className="px-4 py-3 border-r border-slate-100 text-slate-600">{patient.phone || '-'}</td>
                                <td className="px-4 py-3 border-r border-slate-100 text-slate-600">{patient.consultation_date}</td>
                                <td className="px-4 py-3 border-r border-slate-100 text-slate-600">{patient.next_contact_date || '-'}</td>
                                <td className="px-4 py-3 border-r border-slate-100 text-slate-700 font-medium">{patient.months || '-'}</td>
                                <td className="px-4 py-3 text-slate-500 text-sm">{patient.phone_consultation || '-'}</td>
                              </>
                            )}
                            <td className="px-4 py-3 text-center">
                              <div className="flex justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button 
                                  onClick={() => {
                                    setEditingPatient(patient);
                                    setNewPatient(patient);
                                    setShowAddPatient(true);
                                  }}
                                  className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                                >
                                  <Plus size={16} />
                                </button>
                                <button 
                                  onClick={() => handleDeletePatient(patient.id)}
                                  className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                >
                                  <Trash2 size={16} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={8} className="px-6 py-20 text-center text-slate-400 italic">
                            등록된 환자가 없습니다. '새로 만들기' 버튼을 눌러 추가하세요.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Modals */}
      <AnimatePresence>
        {showAddItem && (
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden"
            >
              <div className="p-6 border-b border-slate-100">
                <h3 className="text-xl font-bold">새 품목 추가</h3>
              </div>
              <form onSubmit={handleAddItem} className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">품목명</label>
                  <input 
                    required
                    type="text" 
                    value={newItem.name}
                    onChange={e => setNewItem({...newItem, name: e.target.value})}
                    className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all"
                    placeholder="예: 공진단, 경옥고"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">단위</label>
                    <input 
                      required
                      type="text" 
                      value={newItem.unit}
                      onChange={e => setNewItem({...newItem, unit: e.target.value})}
                      className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all"
                      placeholder="예: 박스, 환, 포"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">카테고리</label>
                    <select 
                      value={newItem.category}
                      onChange={e => setNewItem({...newItem, category: e.target.value})}
                      className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all"
                    >
                      <option value="한약">한약</option>
                      <option value="약재">약재</option>
                      <option value="소모품">소모품</option>
                      <option value="기타">기타</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">최소 수량 (알림 기준)</label>
                  <input 
                    required
                    type="number" 
                    value={newItem.min_stock}
                    onChange={e => setNewItem({...newItem, min_stock: parseInt(e.target.value)})}
                    className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all"
                  />
                </div>
                <div className="flex gap-3 pt-4">
                  <button 
                    type="button"
                    onClick={() => setShowAddItem(false)}
                    className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 font-medium text-slate-600 hover:bg-slate-50 transition-colors"
                  >
                    취소
                  </button>
                  <button 
                    type="submit"
                    className="flex-1 px-4 py-2.5 rounded-xl bg-emerald-600 text-white font-medium hover:bg-emerald-700 transition-colors shadow-sm"
                  >
                    추가하기
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}

        {showTransaction.show && (
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden"
            >
              <div className={`p-6 border-b border-slate-100 flex items-center gap-3 ${showTransaction.type === 'IN' ? 'text-emerald-700' : 'text-slate-900'}`}>
                {showTransaction.type === 'IN' ? <ArrowUpCircle size={24} /> : <ArrowDownCircle size={24} />}
                <h3 className="text-xl font-bold">{showTransaction.type === 'IN' ? '물품 입고' : '물품 출고'}</h3>
              </div>
              <form onSubmit={handleAddTransaction} className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">품목 선택</label>
                  <select 
                    required
                    value={newTransaction.item_id}
                    onChange={e => setNewTransaction({...newTransaction, item_id: e.target.value})}
                    className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all"
                  >
                    <option value="" disabled>품목을 선택하세요</option>
                    {itemsWithStock.map(item => (
                      <option key={item.id} value={item.id}>{item.name} (현재: {item.current_stock} {item.unit})</option>
                    ))}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">수량</label>
                    <input 
                      required
                      type="number" 
                      min="1"
                      value={newTransaction.quantity || ''}
                      onChange={e => setNewTransaction({...newTransaction, quantity: parseInt(e.target.value)})}
                      className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all"
                      placeholder="수량 입력"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">날짜</label>
                    <input 
                      required
                      type="date" 
                      value={newTransaction.date}
                      onChange={e => setNewTransaction({...newTransaction, date: e.target.value})}
                      className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">비고 (메모)</label>
                  <textarea 
                    value={newTransaction.note}
                    onChange={e => setNewTransaction({...newTransaction, note: e.target.value})}
                    className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all resize-none h-24"
                    placeholder="예: 환자 처방, 신규 주문 입고 등"
                  />
                </div>
                <div className="flex gap-3 pt-4">
                  <button 
                    type="button"
                    onClick={() => setShowTransaction({ show: false, type: 'IN' })}
                    className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 font-medium text-slate-600 hover:bg-slate-50 transition-colors"
                  >
                    취소
                  </button>
                  <button 
                    type="submit"
                    className={`flex-1 px-4 py-2.5 rounded-xl text-white font-medium transition-colors shadow-sm ${showTransaction.type === 'IN' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-slate-900 hover:bg-slate-800'}`}
                  >
                    {showTransaction.type === 'IN' ? '입고 완료' : '출고 완료'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}

        {showDeleteConfirm.show && (
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden"
            >
              <div className="p-6 border-b border-slate-100 flex items-center gap-3 text-red-600">
                <Trash2 size={24} />
                <h3 className="text-xl font-bold">품목 삭제 확인</h3>
              </div>
              <div className="p-6">
                <p className="text-slate-600">
                  <span className="font-bold text-slate-900">"{showDeleteConfirm.itemName}"</span> 품목을 정말 삭제하시겠습니까?
                </p>
                <p className="text-sm text-red-500 mt-2">※ 해당 품목과 관련된 모든 입출고 내역이 영구적으로 삭제되며 복구할 수 없습니다.</p>
              </div>
              <div className="p-6 bg-slate-50 flex gap-3">
                <button 
                  onClick={() => setShowDeleteConfirm({ show: false })}
                  className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 font-medium text-slate-600 hover:bg-slate-100 transition-colors"
                >
                  취소
                </button>
                <button 
                  onClick={() => {
                    if (showDeleteConfirm.itemId) {
                      confirmDelete(showDeleteConfirm.itemId);
                    }
                  }}
                  className="flex-1 px-4 py-2.5 rounded-xl bg-red-600 text-white font-medium hover:bg-red-700 transition-colors shadow-sm"
                >
                  삭제하기
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {showAddPatient && (
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden"
            >
              <div className="p-6 border-b border-slate-100 flex justify-between items-center">
                <h3 className="text-xl font-bold">
                  {editingPatient ? '환자 정보 수정' : (patientType === 'DIET' ? '다이어트 환자 등록' : '비급여 한약 환자 등록')}
                </h3>
                <button onClick={() => setShowAddPatient(false)} className="text-slate-400 hover:text-slate-600">
                  <Plus size={24} className="rotate-45" />
                </button>
              </div>
              <form onSubmit={handleAddPatient} className="p-6 grid grid-cols-2 gap-4">
                <div className="col-span-2 md:col-span-1">
                  <label className="block text-sm font-bold text-slate-700 mb-1">성함</label>
                  <input 
                    required
                    type="text" 
                    value={newPatient.name}
                    onChange={e => setNewPatient({...newPatient, name: e.target.value})}
                    className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 outline-none"
                    placeholder="환자 성함"
                  />
                </div>
                <div className="col-span-2 md:col-span-1">
                  <label className="block text-sm font-bold text-slate-700 mb-1">
                    {patientType === 'DIET' ? '차트번호' : '전화번호'}
                  </label>
                  <input 
                    type="text" 
                    value={patientType === 'DIET' ? newPatient.chart_number : newPatient.phone}
                    onChange={e => setNewPatient({...newPatient, [patientType === 'DIET' ? 'chart_number' : 'phone']: e.target.value})}
                    className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 outline-none"
                    placeholder={patientType === 'DIET' ? '차트번호 입력' : '010-0000-0000'}
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">상담 날짜</label>
                  <input 
                    type="date" 
                    value={newPatient.consultation_date}
                    onChange={e => setNewPatient({...newPatient, consultation_date: e.target.value})}
                    className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">다음 연락 예정일</label>
                  <input 
                    type="date" 
                    value={newPatient.next_contact_date}
                    onChange={e => setNewPatient({...newPatient, next_contact_date: e.target.value})}
                    className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">진행 상태</label>
                  <select 
                    value={newPatient.status}
                    onChange={e => setNewPatient({...newPatient, status: e.target.value})}
                    className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 outline-none"
                  >
                    {patientType === 'DIET' ? (
                      <>
                        <option value="상담 예약">상담 예약</option>
                        <option value="진행 중">진행 중</option>
                        <option value="종료">종료</option>
                      </>
                    ) : (
                      <>
                        <option value="시작 전">시작 전</option>
                        <option value="복용 중">복용 중</option>
                        <option value="완료">완료</option>
                      </>
                    )}
                  </select>
                </div>
                {patientType === 'DIET' ? (
                  <>
                    <div>
                      <label className="block text-sm font-bold text-slate-700 mb-1">다이어트 단계</label>
                      <input 
                        type="text" 
                        value={newPatient.diet_stage}
                        onChange={e => setNewPatient({...newPatient, diet_stage: e.target.value})}
                        className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 outline-none"
                        placeholder="예: 감비환 1단계"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-slate-700 mb-1">총 갯수</label>
                      <input 
                        type="text" 
                        value={newPatient.total_count}
                        onChange={e => setNewPatient({...newPatient, total_count: e.target.value})}
                        className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 outline-none"
                        placeholder="예: 12-1"
                      />
                    </div>
                  </>
                ) : (
                  <>
                    <div>
                      <label className="block text-sm font-bold text-slate-700 mb-1">개월수</label>
                      <input 
                        type="text" 
                        value={newPatient.months}
                        onChange={e => setNewPatient({...newPatient, months: e.target.value})}
                        className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 outline-none"
                        placeholder="예: 3개월"
                      />
                    </div>
                    <div className="col-span-2">
                      <label className="block text-sm font-bold text-slate-700 mb-1">전화 문진</label>
                      <input 
                        type="text" 
                        value={newPatient.phone_consultation}
                        onChange={e => setNewPatient({...newPatient, phone_consultation: e.target.value})}
                        className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 outline-none"
                        placeholder="문진 내용 요약"
                      />
                    </div>
                  </>
                )}
                <div className="col-span-2">
                  <label className="block text-sm font-bold text-slate-700 mb-1">메모</label>
                  <textarea 
                    value={newPatient.memo}
                    onChange={e => setNewPatient({...newPatient, memo: e.target.value})}
                    className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 outline-none h-24 resize-none"
                    placeholder="기타 특이사항 입력"
                  />
                </div>
                <div className="col-span-2 flex gap-3 pt-4">
                  <button 
                    type="button"
                    onClick={() => setShowAddPatient(false)}
                    className="flex-1 px-4 py-3 rounded-xl border border-slate-200 font-bold text-slate-500 hover:bg-slate-50 transition-all"
                  >
                    취소
                  </button>
                  <button 
                    type="submit"
                    className="flex-1 px-4 py-3 rounded-xl bg-emerald-600 text-white font-bold hover:bg-emerald-700 transition-all shadow-md"
                  >
                    {editingPatient ? '수정 완료' : '등록 완료'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}

        {showPatientDeleteConfirm.show && (
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden"
            >
              <div className="p-6 border-b border-slate-100 flex items-center gap-3 text-red-600">
                <Trash2 size={24} />
                <h3 className="text-xl font-bold">환자 정보 삭제 확인</h3>
              </div>
              <div className="p-6">
                <p className="text-slate-600">
                  <span className="font-bold text-slate-900">"{showPatientDeleteConfirm.patientName}"</span> 환자 정보를 정말 삭제하시겠습니까?
                </p>
                <p className="text-sm text-red-500 mt-2">※ 삭제된 정보는 복구할 수 없습니다.</p>
              </div>
              <div className="p-6 bg-slate-50 flex gap-3">
                <button 
                  onClick={() => setShowPatientDeleteConfirm({ show: false })}
                  className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 font-medium text-slate-600 hover:bg-slate-100 transition-colors"
                >
                  취소
                </button>
                <button 
                  onClick={() => {
                    if (showPatientDeleteConfirm.patientId) {
                      confirmDeletePatient(showPatientDeleteConfirm.patientId);
                    }
                  }}
                  className="flex-1 px-4 py-2.5 rounded-xl bg-red-600 text-white font-medium hover:bg-red-700 transition-colors shadow-sm"
                >
                  삭제하기
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
