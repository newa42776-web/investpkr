
import { UserStats, VIPPlan } from './types';

export const VIP_PLANS: VIPPlan[] = [
  {
    id: 1,
    name: 'VIP 1 - Core',
    price: 500,
    dailyProfit: 50,
    durationDays: 30,
    level: 1,
    color: 'border-blue-500/30 text-blue-400 bg-blue-500/5'
  },
  {
    id: 2,
    name: 'VIP 2 - Prime',
    price: 1000,
    dailyProfit: 110,
    durationDays: 30,
    level: 2,
    color: 'border-slate-400/30 text-slate-300 bg-slate-400/5'
  },
  {
    id: 3,
    name: 'VIP 3 - Elite',
    price: 2000,
    dailyProfit: 240,
    durationDays: 30,
    level: 3,
    color: 'border-amber-400/30 text-amber-400 bg-amber-400/5'
  },
  {
    id: 4,
    name: 'VIP 4 - Master',
    price: 5000,
    dailyProfit: 600,
    durationDays: 30,
    level: 4,
    color: 'border-indigo-400/30 text-indigo-400 bg-indigo-400/5'
  },
  {
    id: 5,
    name: 'VIP 5 - Prestige',
    price: 10000,
    dailyProfit: 1300,
    durationDays: 45,
    level: 5,
    color: 'border-cyan-400/30 text-cyan-400 bg-cyan-400/5'
  },
  {
    id: 6,
    name: 'VIP 6 - Sovereign',
    price: 20000,
    dailyProfit: 3000,
    durationDays: 60,
    level: 6,
    color: 'border-rose-500/30 text-rose-400 bg-rose-500/5'
  }
];

export const INITIAL_STATS: UserStats = {
  balance: 0,
  totalInvested: 0,
  totalEarned: 0,
  totalWithdrawn: 0,
  referralEarnings: 0,
  autoClaimEnabled: true,
};
