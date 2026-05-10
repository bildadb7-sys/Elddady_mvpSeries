import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { AppSettings } from '../types';

export const useAppSettings = () => {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const { data, error } = await supabase
          .from('app_settings')
          .select('*')
          .eq('id', 1)
          .single();

        if (error) throw error;
        setSettings(data);
      } catch (error) {
        console.error('Error fetching app settings:', error);
        // Fallback defaults
        setSettings({ id: 1, ads_enabled: true, ppc_cost: 4.00 });
      } finally {
        setLoading(false);
      }
    };

    fetchSettings();
  }, []);

  return { settings, loading };
};
