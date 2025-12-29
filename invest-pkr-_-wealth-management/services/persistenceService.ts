
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_KEY = process.env.SUPABASE_KEY || '';

const supabase = (SUPABASE_URL && SUPABASE_KEY) ? createClient(SUPABASE_URL, SUPABASE_KEY) : null;

export const PersistenceService = {
  isCloudEnabled: () => !!supabase,

  saveUserData: async (phone: string, data: any) => {
    localStorage.setItem(`investpkr_data_${phone}`, JSON.stringify(data));
    if (supabase) {
      try {
        await supabase.from('user_data').upsert({ phone, content: data, updated_at: new Date().toISOString() });
      } catch (e) { console.warn("Cloud Sync Failed", e); }
    }
  },

  loadUserData: async (phone: string) => {
    let localData = null;
    try {
      const saved = localStorage.getItem(`investpkr_data_${phone}`);
      localData = saved ? JSON.parse(saved) : null;
    } catch (e) {}

    if (supabase) {
      try {
        const { data } = await supabase.from('user_data').select('content').eq('phone', phone).single();
        if (data?.content) return data.content;
      } catch (e) {}
    }
    return localData;
  },

  saveGlobalUsers: async (users: any[]) => {
    localStorage.setItem('investpkr_users_db', JSON.stringify(users));
    if (supabase) {
      try { await supabase.from('global_config').upsert({ key: 'users_list', value: users }); } catch (e) {}
    }
  },

  loadGlobalUsers: async () => {
    if (supabase) {
      try {
        const { data } = await supabase.from('global_config').select('value').eq('key', 'users_list').single();
        if (data?.value) return data.value;
      } catch (e) {}
    }
    const saved = localStorage.getItem('investpkr_users_db');
    return saved ? JSON.parse(saved) : [];
  },

  saveVipPlans: async (plans: any[]) => {
    localStorage.setItem('investpkr_vip_plans', JSON.stringify(plans));
    if (supabase) {
      try { await supabase.from('global_config').upsert({ key: 'vip_plans', value: plans }); } catch (e) {}
    }
  },

  loadVipPlans: async (defaults: any[]) => {
    if (supabase) {
      try {
        const { data } = await supabase.from('global_config').select('value').eq('key', 'vip_plans').single();
        if (data?.value) return data.value;
      } catch (e) {}
    }
    const saved = localStorage.getItem('investpkr_vip_plans');
    return saved ? JSON.parse(saved) : defaults;
  }
};
