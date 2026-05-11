import path from 'path';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
// scripts/updateRates.js
// Run this with: node scripts/updateRates.js
// Requirement: Set SUPABASE_URL, SUPABASE_SERVICE_KEY, and EXCHANGE_RATE_API_KEY in .env

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABSE_SERVICE_ROLE_KEY; // MUST use Service Role for DB writes
const API_KEY = process.env.EXCHANGE_RATE_API_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY || !API_KEY) {
    console.error("Missing Environment Variables. Required: SUPABASE_URL, SUPABSE_SERVICE_ROLE_KEY, EXCHANGE_RATE_API_KEY");
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const updateRates = async () => {
    console.log("🔄 Fetching Live Rates from ExchangeRate-API...");
    
    try {
        // Fetch rates with USD as base
        const res = await fetch(`https://v6.exchangerate-api.com/v6/${API_KEY}/latest/USD`);
        const data = await res.json();

        if (data.result !== 'success') {
            throw new Error(`API Error: ${data['error-type']}`);
        }

        const rates = data.conversion_rates;
        const currencyCodes = Object.keys(rates);
        
        console.log(`✅ Fetched ${currencyCodes.length} currencies.`);

        // Prepare Upsert Payload
        const payload = currencyCodes.map(code => ({
            code: code,
            rate_to_usd: rates[code],
            last_updated: new Date().toISOString()
        }));

        // Batch Upsert into 'currencies' table
        const { error } = await supabase
            .from('currencies')
            .upsert(payload, { onConflict: 'code' });

        if (error) {
            throw error;
        }

        console.log("💾 Successfully cached rates to Supabase.");
        process.exit(0);

    } catch (err) {
        console.error("❌ Failed to update rates:", err.message);
        process.exit(1);
    }
};

updateRates();
