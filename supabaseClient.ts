
import { createClient } from '@supabase/supabase-js';

// Safely access environment variables using optional chaining
const supabaseUrl = import.meta.env?.VITE_APP_SUPABASE_URL || 'https://fttgiukaclfwzmvujwrf.supabase.co';
const supabaseKey = import.meta.env?.VITE_APP_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ0dGdpdWthY2xmd3ptdnVqd3JmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ1MDY5MTIsImV4cCI6MjA5MDA4MjkxMn0.Au6wd7lCNsJa6QefKmrGx59vhmQB1FvWof44Sbd5E3U';

export const supabase = createClient(supabaseUrl, supabaseKey);

export default supabase;
