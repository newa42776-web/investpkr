
export enum TransactionType {
  DEPOSIT = 'DEPOSIT',
  WITHDRAWAL = 'WITHDRAWAL',
  PROFIT = 'PROFIT',
  INVESTMENT = 'INVESTMENT',
  REFERRAL_BONUS = 'REFERRAL_BONUS'
}

export interface VIPPlan {
  id: number;
  name: string;
  price: number;
  dailyProfit: number;
  durationDays: number;
  level: number;
  color: string;
}

export interface Transaction {
  id: string;
  type: TransactionType;
  amount: number;
  timestamp: number;
  description: string;
  status: 'PENDING' | 'COMPLETED' | 'FAILED';
  method?: string;
  proofId?: string;
  proofImage?: string; // Base64 encoded screenshot
  userPhone?: string; // For admin tracking
}

export interface UserStats {
  balance: number;
  totalInvested: number;
  totalEarned: number;
  totalWithdrawn: number;
  referralEarnings: number;
  autoClaimEnabled?: boolean;
}

export interface UserProfitEntry {
  timestamp: number;
  amount: number;
}

export interface UserInvestment {
  planId: number;
  purchaseDate: number;
  lastProfitClaimed: number;
  profitHistory?: UserProfitEntry[];
}

export interface User {
  username: string;
  email: string;
  phone: string;
  password?: string;
  referredBy?: string; // Phone number of the referrer
  isLoggedIn: boolean;
  isAdmin?: boolean;
}
