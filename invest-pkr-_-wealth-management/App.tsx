
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { VIP_PLANS as DEFAULT_VIP_PLANS, INITIAL_STATS } from './constants';
import { TransactionType, Transaction, UserStats, UserInvestment, VIPPlan, User } from './types';
import { getChatResponse } from './services/geminiService';
import { PersistenceService } from './services/persistenceService';

const ADMIN_PHONE = '03185535594';
const ADMIN_PASS = 'Hanzla@123';

const formatCurrency = (amount: number) => 
  `Rs. ${new Intl.NumberFormat('en-PK').format(amount)}`;

const isValidPakPhone = (phone: string) => {
  const pakPhoneRegex = /^03[0-9]{9}$/;
  return pakPhoneRegex.test(phone);
};

const Modal: React.FC<{ isOpen: boolean; onClose: () => void; title: string; children: React.ReactNode }> = ({ isOpen, onClose, title, children }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-md" onClick={onClose}></div>
      <div className="relative w-full max-w-md glass-card rounded-3xl p-6 md:p-8 animate-in overflow-hidden shadow-2xl border-white/10">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-amber-500 to-amber-200"></div>
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-[10px] font-black uppercase tracking-widest text-amber-500">{title}</h3>
          <button onClick={onClose} className="text-slate-500 hover:text-white transition-all"><i className="fas fa-times"></i></button>
        </div>
        <div className="max-h-[75vh] overflow-y-auto custom-scrollbar pr-1">
          {children}
        </div>
      </div>
    </div>
  );
};

const App: React.FC = () => {
  const [registeredUsers, setRegisteredUsers] = useState<User[]>([]);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isAppLoading, setIsAppLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [vipPlans, setVipPlans] = useState<VIPPlan[]>(DEFAULT_VIP_PLANS);

  const [stats, setStats] = useState<UserStats>(INITIAL_STATS);
  const [investments, setInvestments] = useState<UserInvestment[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);

  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [showPassword, setShowPassword] = useState(false);
  const [hideBalance, setHideBalance] = useState(() => localStorage.getItem('investpkr_ui_hide_balance') === 'true');
  const [activeTab, setActiveTab] = useState<'dashboard' | 'plans' | 'withdraw' | 'deposit' | 'support' | 'profile' | 'admin'>('dashboard');
  const [adminSubTab, setAdminSubTab] = useState<'requests' | 'plans' | 'users'>('requests');
  
  const [chatInput, setChatInput] = useState("");
  const [chatHistory, setChatHistory] = useState<{ role: 'user' | 'support', text: string }[]>([]);
  const [isSupportLoading, setIsSupportLoading] = useState(false);
  const [notification, setNotification] = useState<{message: string, type: 'success' | 'error'} | null>(null);
  
  const [confirmingDeposit, setConfirmingDeposit] = useState<{ amount: number, tid: string, method: string, screenshot?: string } | null>(null);
  const [viewingReceipt, setViewingReceipt] = useState<string | null>(null);
  const [editingPlan, setEditingPlan] = useState<VIPPlan | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [screenshotPreview, setScreenshotPreview] = useState<string | null>(null);
  const [urlRefCode, setUrlRefCode] = useState<string | null>(null);

  useEffect(() => {
    const init = async () => {
      const users = await PersistenceService.loadGlobalUsers();
      const plans = await PersistenceService.loadVipPlans(DEFAULT_VIP_PLANS);
      setRegisteredUsers(users);
      setVipPlans(plans);

      const savedActive = localStorage.getItem('investpkr_active_user');
      if (savedActive) setCurrentUser(JSON.parse(savedActive));
      setIsAppLoading(false);
    };
    init();
    const params = new URLSearchParams(window.location.search);
    const ref = params.get('ref');
    if (ref && isValidPakPhone(ref)) { setUrlRefCode(ref); setAuthMode('register'); }
  }, []);

  useEffect(() => {
    const loadData = async () => {
      if (currentUser) {
        setIsAppLoading(true);
        const data = await PersistenceService.loadUserData(currentUser.phone);
        if (data) {
          setStats(data.stats || INITIAL_STATS);
          setInvestments(data.investments || []);
          setTransactions(data.transactions || []);
        }
        setIsAppLoading(false);
      }
    };
    loadData();
  }, [currentUser?.phone]);

  const triggerSave = useCallback(async () => {
    if (currentUser) {
      setIsSaving(true);
      await PersistenceService.saveUserData(currentUser.phone, { stats, investments, transactions });
      setIsSaving(false);
    }
  }, [currentUser, stats, investments, transactions]);

  useEffect(() => {
    if (!isAppLoading && currentUser) {
      const timer = setTimeout(triggerSave, 1500);
      return () => clearTimeout(timer);
    }
  }, [stats, investments, transactions, isAppLoading, currentUser, triggerSave]);

  const showNotify = (message: string, type: 'success' | 'error') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 4000);
  };

  const handleLogout = () => {
    setCurrentUser(null);
    localStorage.removeItem('investpkr_active_user');
    showNotify("Successfully logged out!", "success");
  };

  const addTransaction = useCallback((type: TransactionType, amount: number, description: string, status: 'PENDING' | 'COMPLETED' | 'FAILED' = 'COMPLETED', method?: string, proofId?: string, proofImage?: string) => {
    const newTx: Transaction = {
      id: Math.random().toString(36).substr(2, 6).toUpperCase(),
      type, amount, timestamp: Date.now(), description, status, method, proofId, proofImage, userPhone: currentUser?.phone
    };
    setTransactions(prev => [newTx, ...prev].slice(0, 50));
    return newTx;
  }, [currentUser?.phone]);

  const collectProfits = useCallback((isAuto: boolean = false) => {
    if (investments.length === 0) {
      if (!isAuto) { showNotify("Pehle koi VIP plan khareedain!", "error"); setActiveTab('plans'); }
      return;
    }
    let totalProfitSum = 0;
    let anyProfitCollected = false;
    const now = Date.now();
    const DAY_MS = 86400000;
    const updatedInvestments = investments.map(inv => {
      const plan = vipPlans.find(p => p.id === inv.planId);
      if (plan) {
        const timeDiff = now - inv.lastProfitClaimed;
        const daysPassed = Math.floor(timeDiff / DAY_MS);
        if (daysPassed >= 1) {
          anyProfitCollected = true;
          totalProfitSum += plan.dailyProfit * daysPassed;
          return { ...inv, lastProfitClaimed: inv.lastProfitClaimed + (daysPassed * DAY_MS) };
        }
      }
      return inv;
    });
    if (anyProfitCollected && totalProfitSum > 0) {
      setInvestments(updatedInvestments);
      setStats(prev => ({ ...prev, balance: prev.balance + totalProfitSum, totalEarned: prev.totalEarned + totalProfitSum }));
      addTransaction(TransactionType.PROFIT, totalProfitSum, `Daily ROI Collected`);
      showNotify(`+${formatCurrency(totalProfitSum)} Balance mein shamil!`, "success");
    } else if (!isAuto) showNotify("Profit abhi taiyar nahi hai! 24 ghante baad check karein.", "error");
  }, [investments, addTransaction, vipPlans]);

  const buyPlan = (plan: VIPPlan) => {
    if (stats.balance >= plan.price) {
      setStats(prev => ({ ...prev, balance: prev.balance - plan.price, totalInvested: prev.totalInvested + plan.price }));
      setInvestments(prev => [...prev, { planId: plan.id, purchaseDate: Date.now(), lastProfitClaimed: Date.now() }]);
      addTransaction(TransactionType.INVESTMENT, plan.price, `${plan.name} Activated`);
      showNotify(`${plan.name} active ho gaya!`, "success");
      setActiveTab('dashboard');
    } else {
      showNotify("Balance kam hai! Deposit karein.", "error");
      setActiveTab('deposit');
    }
  };

  const processAdminAction = async (phone: string, txId: string, action: 'APPROVE' | 'REJECT') => {
    setIsAppLoading(true);
    const userData = await PersistenceService.loadUserData(phone);
    if (userData) {
      const txIndex = userData.transactions.findIndex((t: Transaction) => t.id === txId);
      if (txIndex > -1) {
        const tx = userData.transactions[txIndex];
        if (action === 'APPROVE') {
          tx.status = 'COMPLETED';
          if (tx.type === TransactionType.DEPOSIT) userData.stats.balance += tx.amount;
          else if (tx.type === TransactionType.WITHDRAWAL) userData.stats.totalWithdrawn += tx.amount;
        } else {
          tx.status = 'FAILED';
          if (tx.type === TransactionType.WITHDRAWAL) userData.stats.balance += tx.amount;
        }
        await PersistenceService.saveUserData(phone, userData);
        if (currentUser?.phone === phone) {
           setStats(userData.stats);
           setTransactions(userData.transactions);
        }
        showNotify(`Request ${action === 'APPROVE' ? 'Approved' : 'Rejected'}!`, action === 'APPROVE' ? 'success' : 'error');
      }
    }
    setIsAppLoading(false);
  };

  const handleSavePlan = async (e: React.FormEvent) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget as HTMLFormElement);
    const planData: VIPPlan = {
      id: editingPlan?.id || Date.now(),
      name: fd.get('name') as string,
      price: Number(fd.get('price')),
      dailyProfit: Number(fd.get('dailyProfit')),
      durationDays: Number(fd.get('duration')),
      level: Number(fd.get('level')),
      color: (fd.get('color') as string) || 'border-blue-500/30 text-blue-400 bg-blue-500/5'
    };
    const newPlans = editingPlan?.id
      ? vipPlans.map(p => p.id === editingPlan.id ? planData : p)
      : [...vipPlans, planData];
    setVipPlans(newPlans);
    await PersistenceService.saveVipPlans(newPlans);
    setEditingPlan(null);
    showNotify("VIP Plan configuration updated!", "success");
  };

  const handleDeletePlan = async (id: number) => {
    if (confirm("Plan delete karne se investors ka nuqsan ho sakta hai. Kya aap sure hain?")) {
      const newPlans = vipPlans.filter(p => p.id !== id);
      setVipPlans(newPlans);
      await PersistenceService.saveVipPlans(newPlans);
      showNotify("Plan removed from store.", "error");
    }
  };

  if (isAppLoading && !currentUser) {
    return <div className="min-h-screen flex items-center justify-center flex-col gap-4">
      <div className="loader w-10 h-10"></div>
      <p className="text-[10px] uppercase font-black tracking-widest text-amber-500 animate-pulse">Syncing Cloud Database...</p>
    </div>;
  }

  if (!currentUser) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="max-w-xs w-full glass-card p-10 rounded-3xl shadow-2xl border-white/5 bg-slate-900/60 animate-in">
          <div className="text-center mb-10">
            <h1 className="text-3xl font-black gold-gradient-text tracking-tighter uppercase mb-1">INVEST PKR</h1>
            <p className="text-slate-500 text-[8px] uppercase tracking-[0.2em] font-black">Private Wealth Management</p>
          </div>
          <form onSubmit={async (e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            const ph = fd.get('phone') as string;
            const pw = fd.get('password') as string;
            if (!isValidPakPhone(ph)) return showNotify("Pakistan number (03XXXXXXXXX) format use karen!", "error");
            
            if (ph === ADMIN_PHONE && pw === ADMIN_PASS) {
              const masterAdmin: User = { username: 'Master Admin', phone: ADMIN_PHONE, password: ADMIN_PASS, email: '', isLoggedIn: true, isAdmin: true };
              setCurrentUser(masterAdmin);
              localStorage.setItem('investpkr_active_user', JSON.stringify(masterAdmin));
              return;
            }

            if (authMode === 'register') {
              if (registeredUsers.some(u => u.phone === ph)) return showNotify("Number already exists!", "error");
              const newUser: User = { 
                username: fd.get('username') as string, 
                phone: ph, 
                password: pw, 
                email: "", 
                referredBy: (fd.get('referral') as string) || undefined, 
                isLoggedIn: true, 
                isAdmin: false 
              };
              const newUsers = [...registeredUsers, newUser];
              setRegisteredUsers(newUsers);
              await PersistenceService.saveGlobalUsers(newUsers);
              setCurrentUser(newUser);
              localStorage.setItem('investpkr_active_user', JSON.stringify(newUser));
              showNotify("Account created successfully!", "success");
            } else {
              const user = registeredUsers.find(u => u.phone === ph && u.password === pw);
              if (user) { 
                setCurrentUser(user); 
                localStorage.setItem('investpkr_active_user', JSON.stringify(user)); 
                showNotify(`Welcome back, ${user.username}!`, "success");
              }
              else showNotify("Number ya password ghalat hai!", "error");
            }
          }} className="space-y-4">
            {authMode === 'register' && (
              <>
                <input name="username" type="text" className="w-full bg-black/40 border border-white/10 rounded-2xl px-5 py-4 text-white text-sm outline-none focus:border-amber-500/50" placeholder="Full Name" required />
                <input name="referral" type="tel" defaultValue={urlRefCode || ""} className="w-full bg-black/40 border border-white/10 rounded-2xl px-5 py-4 text-amber-500/80 text-sm outline-none font-mono focus:border-amber-500/50" placeholder="Referral Code (Optional)" />
              </>
            )}
            <input name="phone" type="tel" className="w-full bg-black/40 border border-white/10 rounded-2xl px-5 py-4 text-white text-sm outline-none font-mono focus:border-amber-500/50" placeholder="Phone (03XXXXXXXXX)" required />
            <div className="relative">
              <input name="password" type={showPassword ? "text" : "password"} className="w-full bg-black/40 border border-white/10 rounded-2xl px-5 py-4 text-white text-sm outline-none focus:border-amber-500/50" placeholder="Password" required />
              <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white transition-all"><i className={`fas ${showPassword ? 'fa-eye-slash' : 'fa-eye'}`}></i></button>
            </div>
            <button type="submit" className="w-full py-4 bg-amber-500 text-black font-black rounded-2xl text-[10px] uppercase hover:bg-amber-400 transition-all shadow-lg active:scale-95">
              {authMode === 'login' ? 'Enter Dashboard' : 'Join Platform'}
            </button>
          </form>
          <button onClick={() => setAuthMode(authMode === 'login' ? 'register' : 'login')} className="w-full mt-8 text-[9px] text-slate-500 uppercase font-black text-center tracking-widest hover:text-amber-500 transition-colors">
            {authMode === 'login' ? "Naya account banayein" : "Already registered? Login"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-24 md:pb-0 md:pl-64 transition-all duration-500">
      {notification && (
        <div className={`fixed top-6 right-6 z-[200] px-6 py-4 rounded-2xl shadow-2xl border backdrop-blur-3xl animate-in ${notification.type === 'success' ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' : 'bg-rose-600/30 text-rose-50 border-rose-500/50'}`}>
          <div className="flex items-center gap-3 text-[10px] font-black uppercase tracking-tighter">
            <i className={`fas ${notification.type === 'success' ? 'fa-check-circle' : 'fa-exclamation-triangle'}`}></i>
            {notification.message}
          </div>
        </div>
      )}

      {/* Cloud Sync Status */}
      <div className="fixed top-6 left-6 md:left-[272px] z-[60] flex items-center gap-2 bg-black/60 px-4 py-2 rounded-full border border-white/10 backdrop-blur-md shadow-2xl">
        <div className={`w-2 h-2 rounded-full ${isSaving ? 'bg-amber-500 animate-pulse' : 'bg-emerald-500 shadow-[0_0_10px_#10b981]'}`}></div>
        <span className="text-[8px] font-black uppercase tracking-[0.2em] text-white/50">{isSaving ? 'Syncing...' : 'Secure Cloud'}</span>
      </div>

      <Modal isOpen={!!confirmingDeposit} onClose={() => setConfirmingDeposit(null)} title="Final Review">
        {confirmingDeposit && (
          <div className="space-y-6">
            <div className="p-5 bg-black/60 rounded-2xl border border-white/10 space-y-3">
              <div className="flex justify-between items-center text-[10px] text-slate-500 uppercase font-bold"><span>Deposit Amount</span><span className="text-white text-xs">{formatCurrency(confirmingDeposit.amount)}</span></div>
              <div className="flex justify-between items-center text-[10px] text-slate-500 uppercase font-bold"><span>TID Code</span><span className="font-mono text-emerald-400">{confirmingDeposit.tid}</span></div>
            </div>
            <button onClick={() => {addTransaction(TransactionType.DEPOSIT, confirmingDeposit.amount, `${confirmingDeposit.method} Deposit`, 'PENDING', confirmingDeposit.method, confirmingDeposit.tid, confirmingDeposit.screenshot); setConfirmingDeposit(null); setScreenshotPreview(null); showNotify("Deposit successfully submitted for review!", "success");}} className="w-full py-4 bg-amber-500 text-black font-black rounded-2xl text-[10px] uppercase shadow-xl hover:bg-amber-400 transition-all active:scale-95">Confirm & Send</button>
          </div>
        )}
      </Modal>

      <Modal isOpen={!!viewingReceipt} onClose={() => setViewingReceipt(null)} title="Transaction Receipt">
        {viewingReceipt && <img src={viewingReceipt} className="w-full max-h-[65vh] object-contain rounded-2xl shadow-2xl border border-white/10 bg-black/40" alt="Proof" />}
      </Modal>

      <Modal isOpen={!!editingPlan} onClose={() => setEditingPlan(null)} title={editingPlan?.id ? "Edit VIP Parameters" : "Create New Asset"}>
        <form onSubmit={handleSavePlan} className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-[8px] uppercase font-black text-slate-500 ml-1">Plan Name</label>
              <input name="name" defaultValue={editingPlan?.name} className="w-full bg-black/40 border border-white/10 rounded-xl p-4 text-[10px] text-white font-bold" required />
            </div>
            <div className="space-y-2">
              <label className="text-[8px] uppercase font-black text-slate-500 ml-1">Level</label>
              <input name="level" type="number" defaultValue={editingPlan?.level} className="w-full bg-black/40 border border-white/10 rounded-xl p-4 text-[10px] text-white font-bold" required />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-[8px] uppercase font-black text-slate-500 ml-1">Price (PKR)</label>
              <input name="price" type="number" defaultValue={editingPlan?.price} className="w-full bg-black/40 border border-white/10 rounded-xl p-4 text-[10px] text-white font-bold" required />
            </div>
            <div className="space-y-2">
              <label className="text-[8px] uppercase font-black text-slate-500 ml-1">Daily ROI</label>
              <input name="dailyProfit" type="number" defaultValue={editingPlan?.dailyProfit} className="w-full bg-black/40 border border-white/10 rounded-xl p-4 text-[10px] text-white font-bold text-emerald-400" required />
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-[8px] uppercase font-black text-slate-500 ml-1">Contract Duration (Days)</label>
            <input name="duration" type="number" defaultValue={editingPlan?.durationDays} className="w-full bg-black/40 border border-white/10 rounded-xl p-4 text-[10px] text-white font-bold" required />
          </div>
          <button type="submit" className="w-full py-4 bg-amber-500 text-black font-black rounded-2xl text-[10px] uppercase shadow-lg shadow-amber-500/20 active:scale-95 transition-all">Save Asset Config</button>
        </form>
      </Modal>

      <aside className="hidden md:flex fixed left-0 top-0 bottom-0 w-64 glass-card flex-col z-[70] border-r border-white/5 bg-slate-950/60 shadow-2xl">
        <div className="p-8 border-b border-white/5 text-center">
          <h1 className="text-xl font-black gold-gradient-text tracking-tighter uppercase mb-8">INVEST PKR</h1>
          <div className="bg-white/5 p-5 rounded-2xl border border-white/10 text-left mb-2 shadow-inner">
             <p className="text-[7px] text-slate-500 uppercase font-black mb-1">Authenticated As</p>
             <p className="text-[10px] text-white font-black truncate">{currentUser.username}</p>
          </div>
        </div>
        <nav className="flex-1 p-5 space-y-2 mt-4 overflow-y-auto custom-scrollbar">
          <SidebarLink icon="fa-home" label="Dashboard" active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} />
          <SidebarLink icon="fa-gem" label="VIP Store" active={activeTab === 'plans'} onClick={() => setActiveTab('plans')} />
          <SidebarLink icon="fa-plus-circle" label="Deposit" active={activeTab === 'deposit'} onClick={() => setActiveTab('deposit')} />
          <SidebarLink icon="fa-wallet" label="Withdraw" active={activeTab === 'withdraw'} onClick={() => setActiveTab('withdraw')} />
          <SidebarLink icon="fa-users" label="Team Management" active={activeTab === 'profile'} onClick={() => setActiveTab('profile')} />
          <SidebarLink icon="fa-headset" label="AI Concierge" active={activeTab === 'support'} onClick={() => setActiveTab('support')} />
          {currentUser.isAdmin && (
            <div className="pt-6 mt-6 border-t border-white/5">
               <SidebarLink icon="fa-shield-halved" label="Command Center" active={activeTab === 'admin'} onClick={() => setActiveTab('admin')} />
            </div>
          )}
        </nav>
        <div className="p-8 border-t border-white/5 bg-black/20">
          <button onClick={handleLogout} className="w-full py-3 text-slate-500 hover:text-rose-500 text-[9px] font-black uppercase transition-all flex items-center justify-center gap-2 group">
            <i className="fas fa-power-off group-hover:rotate-90 transition-transform"></i> Exit Platform
          </button>
        </div>
      </aside>

      <main className="max-w-5xl mx-auto p-4 md:p-10 space-y-10 animate-in pt-20">
        {activeTab === 'dashboard' && (
          <div className="space-y-10">
            <div className="glass-card p-10 md:p-12 rounded-[2.5rem] relative overflow-hidden bg-slate-900/60 shadow-2xl border-white/10 group">
              <div className="absolute top-0 right-0 w-[50%] h-full bg-gradient-to-l from-amber-500/10 to-transparent skew-x-[-12deg] pointer-events-none"></div>
              <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-8">
                <div>
                  <div className="flex items-center gap-3 mb-3">
                    <h2 className="text-amber-500/60 text-[10px] font-black uppercase tracking-[0.2em]">Asset Balance</h2>
                    <button onClick={() => setHideBalance(!hideBalance)} className="text-slate-600 hover:text-white transition-colors"><i className={`fas ${hideBalance ? 'fa-eye-slash' : 'fa-eye'} text-xs`}></i></button>
                  </div>
                  <p className="text-5xl md:text-6xl font-black text-white tracking-tighter drop-shadow-2xl">
                    {hideBalance ? 'PKR ••••••••' : formatCurrency(stats.balance).replace('Rs.', 'PKR')}
                  </p>
                </div>
                <button onClick={() => collectProfits()} className="px-10 py-5 bg-amber-500 text-black font-black rounded-3xl text-[10px] uppercase shadow-[0_15px_35px_rgba(245,158,11,0.3)] hover:bg-amber-400 hover:-translate-y-1 transition-all active:scale-95">Claim Dividends</button>
              </div>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
              <StatCard icon="fa-coins" label="Total ROI" value={hideBalance ? '••••' : formatCurrency(stats.totalEarned)} color="text-emerald-400" />
              <StatCard icon="fa-handshake" label="Referral" value={hideBalance ? '••••' : formatCurrency(stats.referralEarnings)} color="text-amber-400" />
              <StatCard icon="fa-chart-line" label="Investment" value={hideBalance ? '••••' : formatCurrency(stats.totalInvested)} color="text-blue-400" />
              <StatCard icon="fa-arrow-up-right-from-square" label="Withdrawn" value={hideBalance ? '••••' : formatCurrency(stats.totalWithdrawn)} color="text-rose-400" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 pb-32">
              <div className="lg:col-span-2 glass-card rounded-3xl p-8 border-white/5 bg-slate-950/40">
                <div className="flex justify-between items-center mb-8 pb-4 border-b border-white/10">
                  <h3 className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Transaction Ledger</h3>
                  <span className="text-[8px] font-bold text-slate-700">Latest 50 Entries</span>
                </div>
                <div className="space-y-4 max-h-[500px] overflow-y-auto pr-3 custom-scrollbar">
                  {transactions.map((tx) => (
                    <div key={tx.id} className="flex items-center justify-between p-5 bg-white/[0.03] rounded-2xl border border-white/5 hover:bg-white/[0.06] transition-all group">
                      <div className="flex items-center gap-5">
                        <div className={`w-10 h-10 rounded-2xl flex items-center justify-center text-[11px] bg-black border border-white/10 ${tx.status === 'PENDING' ? 'text-amber-500 animate-pulse shadow-[0_0_15px_rgba(245,158,11,0.1)]' : 'text-slate-400'}`}>
                          <i className={`fas ${tx.status === 'PENDING' ? 'fa-hourglass-half' : 'fa-check-circle'}`}></i>
                        </div>
                        <div>
                          <p className="text-[11px] font-black text-white/90 truncate max-w-[180px]">{tx.description}</p>
                          <p className="text-[8px] text-slate-600 font-black mt-1 uppercase tracking-tighter">{new Date(tx.timestamp).toLocaleString()}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        {tx.proofImage && <button onClick={() => setViewingReceipt(tx.proofImage!)} className="text-[7px] text-amber-500 border border-amber-500/20 px-2 py-1 rounded-lg font-black uppercase hover:bg-amber-500/10 transition-colors">Receipt</button>}
                        <p className={`text-[12px] font-black ${tx.type === TransactionType.DEPOSIT || tx.type === TransactionType.PROFIT || tx.type === TransactionType.REFERRAL_BONUS ? 'text-emerald-500' : 'text-rose-500'}`}>
                          {tx.type === TransactionType.DEPOSIT || tx.type === TransactionType.PROFIT || tx.type === TransactionType.REFERRAL_BONUS ? '+' : '-'}{formatCurrency(tx.amount).replace('Rs. ', '')}
                        </p>
                      </div>
                    </div>
                  ))}
                  {transactions.length === 0 && <div className="py-24 text-center opacity-10 text-[10px] uppercase font-black tracking-[0.4em]">Empty Ledger</div>}
                </div>
              </div>

              <div className="glass-card rounded-3xl p-8 border-white/5 bg-slate-950/40 flex flex-col">
                <h3 className="text-[10px] font-black uppercase text-slate-500 mb-8 pb-4 border-b border-white/10 tracking-widest text-center">Active Assets</h3>
                <div className="space-y-4 overflow-y-auto max-h-[500px] pr-2 custom-scrollbar">
                  {investments.map((inv, idx) => {
                    const plan = vipPlans.find(p => p.id === inv.planId);
                    return (
                      <div key={idx} className="flex items-center justify-between p-5 bg-white/5 rounded-2xl border border-white/5 shadow-inner">
                        <div className="flex items-center gap-5">
                          <div className="w-12 h-12 rounded-2xl bg-black flex items-center justify-center text-amber-500 text-lg border border-white/10 shadow-lg"><i className="fas fa-gem"></i></div>
                          <div>
                            <p className="font-black text-[11px] text-white uppercase">{plan?.name}</p>
                            <p className="text-[9px] text-emerald-400 font-black mt-1">{formatCurrency(plan?.dailyProfit || 0)}/Day Yield</p>
                          </div>
                        </div>
                        <div className="text-right"><div className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></div></div>
                      </div>
                    );
                  })}
                  {investments.length === 0 && <div className="py-24 text-center opacity-10 text-[10px] uppercase font-black tracking-[0.4em] px-4">No Active Assets</div>}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* REST OF THE TABS WITH SAME POLISHED STYLE */}
        {activeTab === 'plans' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 pb-32 animate-in">
            {vipPlans.map((plan) => (
              <div key={plan.id} className="glass-card rounded-[2.5rem] p-10 border border-white/5 bg-slate-900/60 hover:-translate-y-3 transition-all duration-500 shadow-2xl group flex flex-col">
                <div className="flex justify-between items-start mb-10">
                  <div className="flex flex-col gap-1">
                    <h3 className="text-2xl font-black text-white group-hover:text-amber-500 transition-colors tracking-tighter">{plan.name}</h3>
                    <p className="text-[8px] font-black text-slate-600 uppercase tracking-widest">Level {plan.level} Certified</p>
                  </div>
                  <div className="w-14 h-14 bg-amber-500/10 text-amber-500 rounded-3xl flex items-center justify-center text-xl shadow-inner"><i className="fas fa-gem"></i></div>
                </div>
                <div className="space-y-5 mb-12 text-[11px]">
                  <div className="flex justify-between border-b border-white/5 pb-4"><span className="text-slate-500 font-bold uppercase">Required Asset</span><span className="font-black text-white">{formatCurrency(plan.price)}</span></div>
                  <div className="flex justify-between border-b border-white/5 pb-4"><span className="text-slate-500 font-bold uppercase">Daily Dividends</span><span className="font-black text-emerald-400">+{formatCurrency(plan.dailyProfit)}</span></div>
                  <div className="flex justify-between border-b border-white/5 pb-4"><span className="text-slate-500 font-bold uppercase">Contract Length</span><span className="font-black text-white">{plan.durationDays} Trading Days</span></div>
                </div>
                <button onClick={() => buyPlan(plan)} className="w-full py-5 bg-white text-black font-black rounded-[1.5rem] text-[10px] uppercase shadow-2xl hover:bg-amber-500 transition-all active:scale-95 mt-auto">Acquire Now</button>
              </div>
            ))}
          </div>
        )}

        {/* Support, Deposit, Profile Tabs (Styled with the new 2.5rem radius and fonts) */}
        {activeTab === 'support' && (
           <div className="max-w-3xl mx-auto flex flex-col h-[75vh] glass-card rounded-[2.5rem] overflow-hidden border border-white/10 bg-slate-950/60 shadow-2xl animate-in">
             <div className="p-8 border-b border-white/10 bg-slate-900/40 flex items-center justify-between">
                <div className="flex items-center gap-5">
                   <div className="w-12 h-12 bg-amber-500 rounded-2xl flex items-center justify-center text-black text-xl shadow-lg shadow-amber-500/10"><i className="fas fa-robot"></i></div>
                   <div>
                      <h3 className="text-sm text-white font-black uppercase tracking-widest">AI Concierge</h3>
                      <p className="text-[8px] text-emerald-500 font-black uppercase tracking-widest animate-pulse mt-1">Ready for consultation</p>
                   </div>
                </div>
             </div>
             <div className="flex-1 overflow-y-auto p-8 space-y-8 bg-black/20 custom-scrollbar">
               {chatHistory.map((chat, i) => (
                 <div key={i} className={`flex ${chat.role === 'user' ? 'justify-end' : 'justify-start'} animate-in`}>
                   <div className={`max-w-[80%] p-6 rounded-[1.5rem] text-[11px] leading-relaxed font-bold shadow-2xl ${chat.role === 'user' ? 'bg-amber-500 text-black rounded-tr-none' : 'bg-slate-900 text-slate-200 border border-white/10 rounded-tl-none'}`}>
                     {chat.text}
                   </div>
                 </div>
               ))}
               {isSupportLoading && <div className="text-[9px] text-amber-500 uppercase font-black animate-pulse px-4">Consulting Algorithms...</div>}
             </div>
             <form onSubmit={async (e) => {
                e.preventDefault();
                if (!chatInput.trim() || isSupportLoading) return;
                const msg = chatInput; setChatInput("");
                setChatHistory(prev => [...prev, { role: 'user', text: msg }]);
                setIsSupportLoading(true);
                try {
                  const res = await getChatResponse(msg, stats.balance);
                  setChatHistory(prev => [...prev, { role: 'support', text: res || "I'm busy." }]);
                } catch { setChatHistory(prev => [...prev, { role: 'support', text: "Connectivity issue." }]); }
                finally { setIsSupportLoading(false); }
             }} className="p-6 border-t border-white/10 bg-slate-900/80 flex gap-4">
                <input type="text" value={chatInput} onChange={(e) => setChatInput(e.target.value)} placeholder="Inquire about VIP plans or portfolio growth..." className="flex-1 bg-black/40 border border-white/10 rounded-2xl px-6 py-5 text-[11px] font-bold text-white outline-none focus:border-amber-500/30" />
                <button disabled={isSupportLoading} className="bg-amber-500 text-black px-10 rounded-2xl hover:bg-amber-400 transition-all shadow-xl active:scale-95"><i className="fas fa-paper-plane"></i></button>
             </form>
           </div>
        )}

        {/* Admin Panel (Command Center) UI Polishing */}
        {activeTab === 'admin' && currentUser.isAdmin && (
           <div className="space-y-10 animate-in pb-32">
             <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-slate-900/40 p-10 rounded-[2.5rem] border border-white/10 shadow-2xl">
                <div>
                   <h2 className="text-3xl font-black text-white uppercase tracking-tighter">Command Center</h2>
                   <p className="text-[10px] text-slate-500 uppercase font-black tracking-widest mt-2">Platform Administration Hub</p>
                </div>
                <div className="flex gap-2 bg-black/40 p-2 rounded-[1.5rem] border border-white/10">
                   <AdminNavBtn label="Requests" active={adminSubTab === 'requests'} onClick={() => setAdminSubTab('requests')} />
                   <AdminNavBtn label="VIP Store" active={adminSubTab === 'plans'} onClick={() => setAdminSubTab('plans')} />
                   <AdminNavBtn label="Database" active={adminSubTab === 'users'} onClick={() => setAdminSubTab('users')} />
                </div>
             </div>

             {adminSubTab === 'requests' && (
                <div className="glass-card rounded-[2.5rem] p-10 border-white/5 bg-slate-950/40 shadow-2xl">
                  <h3 className="text-[10px] font-black uppercase text-amber-500 mb-10 flex items-center gap-3 tracking-[0.3em]"><i className="fas fa-list-check"></i> Pending Transaction Queue</h3>
                  <div className="space-y-6">
                    {registeredUsers.filter(u => u.phone !== ADMIN_PHONE).map(user => (
                       <UserPendingRequests key={user.phone} user={user} processAction={processAdminAction} setViewingReceipt={setViewingReceipt} />
                    ))}
                    <div className="text-center py-20 opacity-10 text-[10px] uppercase font-black tracking-[0.5em]">System Idle</div>
                  </div>
                </div>
             )}

             {adminSubTab === 'plans' && (
                <div className="space-y-10">
                   <div className="flex justify-between items-center bg-slate-900/40 p-8 rounded-3xl border border-white/5">
                      <h3 className="text-[11px] font-black uppercase text-amber-500 tracking-widest">Store Management</h3>
                      <button onClick={() => setEditingPlan({ id: 0, name: '', price: 0, dailyProfit: 0, durationDays: 30, level: 1, color: '' })} className="px-8 py-4 bg-amber-500 text-black text-[10px] font-black uppercase rounded-2xl shadow-xl hover:bg-amber-400 transition-all active:scale-95">+ Create Asset</button>
                   </div>
                   <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                     {vipPlans.map(plan => (
                       <div key={plan.id} className="glass-card p-8 rounded-3xl border border-white/10 bg-slate-950/40 hover:border-amber-500/30 transition-all group">
                         <div className="flex justify-between items-start mb-6">
                           <h4 className="text-sm font-black text-white uppercase group-hover:text-amber-500 transition-colors">{plan.name}</h4>
                           <span className="text-[9px] font-black bg-white/5 px-3 py-1.5 rounded-lg text-slate-500">Lv {plan.level}</span>
                         </div>
                         <div className="space-y-3 text-[11px] font-bold mb-8">
                           <div className="flex justify-between text-slate-500"><span>Required:</span><span className="text-white">{formatCurrency(plan.price)}</span></div>
                           <div className="flex justify-between text-slate-500"><span>ROI:</span><span className="text-emerald-400">+{formatCurrency(plan.dailyProfit)}</span></div>
                         </div>
                         <div className="flex gap-3">
                            <button onClick={() => setEditingPlan(plan)} className="flex-1 py-3 bg-white/5 hover:bg-white/10 rounded-xl text-[9px] font-black uppercase border border-white/5 transition-all">Edit</button>
                            <button onClick={() => handleDeletePlan(plan.id)} className="py-3 px-5 bg-rose-900/20 hover:bg-rose-900/40 text-rose-500 rounded-xl text-[9px] font-black uppercase transition-all">Delete</button>
                         </div>
                       </div>
                     ))}
                   </div>
                </div>
             )}

             {adminSubTab === 'users' && (
                <div className="glass-card rounded-[2.5rem] p-10 border-white/5 bg-slate-950/40">
                   <h3 className="text-[10px] font-black uppercase text-amber-500 mb-10 flex items-center gap-3 tracking-[0.3em]"><i className="fas fa-database"></i> Registered User Base</h3>
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {registeredUsers.filter(u => u.phone !== ADMIN_PHONE).map(user => (
                        <div key={user.phone} className="p-6 bg-black/40 rounded-3xl border border-white/10 flex justify-between items-center hover:bg-black/60 transition-all cursor-default">
                           <div className="flex items-center gap-5">
                              <div className="w-14 h-14 rounded-2xl bg-amber-500/10 flex items-center justify-center text-amber-500 font-black text-xl shadow-inner border border-amber-500/10">{user.username[0]}</div>
                              <div>
                                 <p className="text-xs font-black text-white uppercase">{user.username}</p>
                                 <p className="text-[10px] text-slate-500 font-mono mt-1">{user.phone}</p>
                              </div>
                           </div>
                           <div className="text-right">
                              <p className="text-[8px] text-slate-600 font-black uppercase mb-1">Status</p>
                              <div className="flex items-center gap-2 text-[10px] font-black text-emerald-500 uppercase"><i className="fas fa-check-circle"></i> Active</div>
                           </div>
                        </div>
                      ))}
                   </div>
                </div>
             )}
           </div>
        )}

        {/* Standard User Tabs (Deposit/Withdraw) */}
        {activeTab === 'deposit' && (
           <div className="max-w-md mx-auto glass-card rounded-[2.5rem] p-10 border-white/10 bg-slate-900/60 shadow-2xl animate-in">
              <h2 className="text-2xl font-black mb-10 uppercase text-center gold-gradient-text tracking-tighter">Capital Injection</h2>
              <div className="bg-black/80 p-8 rounded-3xl border border-white/10 mb-10 text-center relative shadow-inner overflow-hidden">
                <div className="absolute top-0 right-0 w-full h-1 bg-amber-500/20"></div>
                <p className="text-[10px] text-amber-500 uppercase font-black tracking-widest mb-4">Transfer Via EasyPaisa / JazzCash</p>
                <p className="text-xl text-white font-black mb-1">Wasif Ali</p>
                <p className="text-3xl font-mono text-amber-500 font-black tracking-[0.1em]">{ADMIN_PHONE}</p>
              </div>
              <form onSubmit={(e) => {
                e.preventDefault();
                const d = new FormData(e.currentTarget);
                const amt = Number(d.get('amount'));
                if (amt < 500) return showNotify("Minimum deposit of PKR 500 required!", "error");
                if (!screenshotPreview) return showNotify("Receipt image is mandatory!", "error");
                setConfirmingDeposit({ amount: amt, tid: String(d.get('tid')), method: 'EasyPaisa', screenshot: screenshotPreview || undefined });
              }} className="space-y-6">
                <input name="amount" type="number" placeholder="Enter Capital (Min 500)" required className="w-full bg-black/40 border border-white/10 rounded-2xl px-6 py-5 text-white text-sm outline-none focus:border-amber-500/30" />
                <input name="tid" type="text" placeholder="Transaction ID (TID)" required className="w-full bg-black/40 border border-white/10 rounded-2xl px-6 py-5 text-white text-sm outline-none font-mono focus:border-amber-500/30" />
                <div onClick={() => fileInputRef.current?.click()} className={`w-full aspect-video rounded-3xl border-2 border-dashed flex flex-col items-center justify-center cursor-pointer transition-all hover:bg-white/5 ${screenshotPreview ? 'border-amber-500/50' : 'border-white/10'}`}>
                  {screenshotPreview ? <img src={screenshotPreview} className="w-full h-full object-cover rounded-3xl" /> : <div className="text-center"><i className="fas fa-cloud-upload-alt text-2xl text-slate-700 mb-3"></i><p className="text-[10px] text-slate-500 uppercase font-black">Upload Official Receipt</p></div>}
                  <input type="file" ref={fileInputRef} onChange={(e) => { const file = e.target.files?.[0]; if (file) { const reader = new FileReader(); reader.onloadend = () => setScreenshotPreview(reader.result as string); reader.readAsDataURL(file); } }} accept="image/*" className="hidden" />
                </div>
                <button type="submit" className="w-full py-5 bg-amber-500 text-black font-black rounded-3xl uppercase text-[10px] shadow-xl hover:bg-amber-400 transition-all active:scale-95">Send for Approval</button>
              </form>
           </div>
        )}

        {activeTab === 'withdraw' && (
           <div className="max-w-md mx-auto glass-card rounded-[2.5rem] p-10 border-white/10 bg-slate-900/60 shadow-2xl animate-in">
              <h2 className="text-2xl font-black mb-10 uppercase text-center text-rose-500 tracking-tighter">Liquidate Profits</h2>
              <div className="bg-black/80 p-8 rounded-3xl border border-white/10 mb-10 text-center shadow-inner">
                <p className="text-[10px] text-slate-600 uppercase font-black tracking-widest mb-3">Withdrawable Balance</p>
                <p className="text-4xl font-black text-white">{formatCurrency(stats.balance)}</p>
              </div>
              <form onSubmit={(e) => {
                e.preventDefault();
                const d = new FormData(e.currentTarget);
                const amount = Number(d.get('amount'));
                if (amount < 100) return showNotify("Minimum withdrawal limit is PKR 100!", "error");
                if (amount > stats.balance) return showNotify("Insufficient funds in liquidity!", "error");
                setStats(s => ({ ...s, balance: s.balance - amount }));
                addTransaction(TransactionType.WITHDRAWAL, amount, `Withdrawal to ${d.get('walletNo')}`, 'PENDING');
                showNotify("Liquidation request queued for processing!", "success");
              }} className="space-y-6">
                <input name="walletNo" type="tel" placeholder="Mobile Account Number" required className="w-full bg-black/40 border border-white/10 rounded-2xl px-6 py-5 text-white text-sm outline-none focus:border-rose-500/30" />
                <input name="amount" type="number" min="100" placeholder="Liquidation Amount" required className="w-full bg-black/40 border border-white/10 rounded-2xl px-6 py-5 text-white text-sm outline-none focus:border-rose-500/30" />
                <button type="submit" className="w-full py-5 bg-rose-600 text-white font-black rounded-3xl uppercase text-[10px] shadow-xl hover:bg-rose-500 transition-all active:scale-95">Request Payout</button>
                <p className="text-[8px] text-slate-600 font-black uppercase text-center tracking-widest opacity-50">Processing Time: 2-24 Business Hours</p>
              </form>
           </div>
        )}

        {activeTab === 'profile' && (
           <div className="max-w-md mx-auto space-y-8 pb-32">
              <div className="glass-card rounded-[2.5rem] p-10 border-white/10 bg-slate-900/60 text-center shadow-2xl animate-in">
                 <div className="w-24 h-24 bg-gradient-to-br from-amber-500 to-amber-200 rounded-[2rem] mx-auto mb-8 flex items-center justify-center text-3xl text-black font-black shadow-2xl">{currentUser.username[0]}</div>
                 <h2 className="text-2xl font-black text-white uppercase tracking-tighter">{currentUser.username}</h2>
                 <p className="text-[9px] text-slate-600 font-black uppercase tracking-[0.3em] mt-1">{currentUser.phone}</p>
                 
                 <div className="mt-12 space-y-5">
                    <div className="bg-black/60 p-6 rounded-3xl border border-white/5 text-left shadow-inner">
                       <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-4">Network Referral Link</p>
                       <div className="bg-black/80 px-5 py-4 rounded-2xl border border-white/5 flex items-center justify-between group">
                          <span className="font-mono text-[10px] text-amber-500/80 truncate mr-3">{`${window.location.origin}/?ref=${currentUser.phone}`}</span>
                          <button onClick={() => {navigator.clipboard.writeText(`${window.location.origin}/?ref=${currentUser.phone}`); showNotify("Referral link copied!", "success")}} className="text-slate-500 hover:text-white transition-all"><i className="fas fa-copy text-sm"></i></button>
                       </div>
                    </div>
                    <button onClick={handleLogout} className="w-full py-5 bg-rose-500/10 border border-rose-500/20 rounded-2xl text-[10px] font-black uppercase text-rose-500 hover:bg-rose-500/20 transition-all">Terminate Session</button>
                 </div>
              </div>
           </div>
        )}
      </main>

      {/* MOBILE NAVIGATION BAR (REFINED) */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 glass-card border-t border-white/10 px-8 py-5 flex justify-around items-center z-[100] bg-black/95 shadow-[0_-15px_50px_rgba(0,0,0,0.9)] backdrop-blur-2xl">
        <MobileNavLink icon="fa-home" active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} />
        <MobileNavLink icon="fa-gem" active={activeTab === 'plans'} onClick={() => setActiveTab('plans')} />
        <div className="relative">
          <button onClick={() => collectProfits()} className="w-20 h-20 bg-amber-500 text-black rounded-full flex items-center justify-center -mt-16 shadow-[0_10px_30px_rgba(245,158,11,0.5)] border-[10px] border-[#01040f] active:scale-90 transition-all">
            <i className="fas fa-bolt-lightning text-3xl"></i>
          </button>
        </div>
        <MobileNavLink icon="fa-wallet" active={activeTab === 'withdraw'} onClick={() => setActiveTab('withdraw')} />
        <MobileNavLink icon="fa-user-tie" active={activeTab === 'profile'} onClick={() => setActiveTab('profile')} />
      </nav>
    </div>
  );
};

/* --- Helper Components --- */

const AdminNavBtn: React.FC<{ label: string, active: boolean, onClick: () => void }> = ({ label, active, onClick }) => (
  <button onClick={onClick} className={`px-6 py-3 rounded-2xl text-[10px] font-black uppercase transition-all duration-300 ${active ? 'bg-amber-500 text-black shadow-lg shadow-amber-500/20' : 'text-slate-600 hover:text-white'}`}>{label}</button>
);

const UserPendingRequests: React.FC<{ user: User, processAction: any, setViewingReceipt: any }> = ({ user, processAction, setViewingReceipt }) => {
  const [requests, setRequests] = useState<Transaction[]>([]);
  useEffect(() => {
    PersistenceService.loadUserData(user.phone).then(d => {
      if (d && d.transactions) setRequests(d.transactions.filter((t: Transaction) => t.status === 'PENDING'));
    });
  }, [user.phone]);

  if (requests.length === 0) return null;

  return (
    <>
      {requests.map(req => (
        <div key={req.id} className="p-6 bg-black/40 rounded-3xl border border-white/10 flex flex-col md:flex-row justify-between md:items-center gap-6 animate-in">
          <div className="flex items-center gap-6">
            <div className={`w-16 h-16 rounded-[1.25rem] flex items-center justify-center text-xl shadow-inner ${req.type === TransactionType.DEPOSIT ? 'bg-emerald-500/10 text-emerald-500' : 'bg-rose-500/10 text-rose-500'}`}><i className={`fas ${req.type === TransactionType.DEPOSIT ? 'fa-arrow-down-wide-short' : 'fa-arrow-up-from-bracket'}`}></i></div>
            <div>
              <p className="text-xs font-black text-white uppercase">{user.username} <span className="text-[10px] text-slate-600 font-mono ml-3">({user.phone})</span></p>
              <p className="text-[11px] font-black text-amber-500 mt-2">{formatCurrency(req.amount)} | <span className="text-slate-400">{req.method}</span></p>
              {req.proofId && <p className="text-[9px] font-mono text-slate-700 mt-1 uppercase tracking-tighter">System TID: {req.proofId}</p>}
            </div>
          </div>
          <div className="flex items-center gap-4">
            {req.proofImage && <button onClick={() => setViewingReceipt(req.proofImage!)} className="px-5 py-3 rounded-xl bg-blue-500/10 text-blue-400 text-[9px] font-black uppercase border border-blue-500/20 hover:bg-blue-500/20 transition-all">Review Receipt</button>}
            <div className="flex gap-2">
              <button onClick={() => processAction(user.phone, req.id, 'APPROVE')} className="px-6 py-3 bg-emerald-500 text-black text-[9px] font-black uppercase rounded-xl shadow-lg hover:bg-emerald-400 transition-all">Authorize</button>
              <button onClick={() => processAction(user.phone, req.id, 'REJECT')} className="px-6 py-3 bg-rose-600 text-white text-[9px] font-black uppercase rounded-xl hover:bg-rose-500 transition-all">Void</button>
            </div>
          </div>
        </div>
      ))}
    </>
  );
};

const MobileNavLink: React.FC<{ icon: string, active: boolean, onClick: () => void }> = ({ icon, active, onClick }) => (
  <button onClick={onClick} className={`p-4 transition-all duration-300 ${active ? 'text-amber-500 scale-125' : 'text-slate-600'}`}>
    <i className={`fas ${icon} text-2xl`}></i>
  </button>
);

const SidebarLink: React.FC<{ icon: string, label: string, active: boolean, onClick: () => void }> = ({ icon, label, active, onClick }) => (
  <button onClick={onClick} className={`w-full flex items-center gap-5 px-6 py-5 rounded-2xl transition-all duration-300 group ${active ? 'bg-amber-500 text-black font-black shadow-lg shadow-amber-500/20' : 'text-slate-500 hover:bg-white/5 hover:text-white'}`}>
    <i className={`fas ${icon} text-sm transition-transform group-hover:scale-110`}></i>
    <span className="text-[10px] uppercase tracking-wider font-black">{label}</span>
  </button>
);

const StatCard: React.FC<{ icon: string, label: string, value: string, color: string }> = ({ icon, label, value, color }) => (
  <div className="glass-card p-6 md:p-8 rounded-[1.75rem] border border-white/5 flex flex-col gap-5 group shadow-2xl relative overflow-hidden bg-slate-900/40">
    <div className={`w-12 h-12 rounded-2xl bg-black border border-white/10 flex items-center justify-center text-xl shadow-inner ${color}`}>
      <i className={`fas ${icon}`}></i>
    </div>
    <div className="text-left relative z-10">
       <p className="text-[8px] text-slate-600 font-black uppercase mb-1 tracking-[0.2em]">{label}</p>
       <p className="text-sm md:text-base font-black text-white tracking-tight">{value}</p>
    </div>
  </div>
);

export default App;
