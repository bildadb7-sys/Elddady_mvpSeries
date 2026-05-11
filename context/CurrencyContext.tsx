
import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { api } from '../api';
import { supabase } from '../supabaseClient';

interface CurrencyContextType {
    userCurrency: string;
    exchangeRates: Record<string, number>;
    convertPrice: (amount: number, fromCurrency: string) => number;
    formatPrice: (amount: number, currency: string) => string;
    setUserCurrency: (currency: string) => void;
    availableCurrencies: string[];
    isLoading: boolean;
}

export const CurrencyContext = createContext<CurrencyContextType | undefined>(undefined);

export const CurrencyProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [userCurrency, setUserCurrencyState] = useState('KES'); // Default
    const [exchangeRates, setExchangeRates] = useState<Record<string, number>>({});
    const [availableCurrencies, setAvailableCurrencies] = useState<string[]>(['USD', 'KES']);
    const [isLoading, setIsLoading] = useState(true);

    // 1. Fetch Cached Rates and User Preference on Mount
    useEffect(() => {
        const init = async () => {
            try {
                // Fetch Rates
                const { data: ratesData } = await supabase.from('currencies').select('code, rate_to_usd');
                if (ratesData && ratesData.length > 0) {
                    const rateMap: Record<string, number> = {};
                    const codes: string[] = [];
                    ratesData.forEach((r: any) => {
                        rateMap[r.code] = r.rate_to_usd;
                        codes.push(r.code);
                    });
                    setExchangeRates(rateMap);
                    setAvailableCurrencies(codes.sort());
                } else {
                    // Fallback rates if database is empty
                    const fallbackRates: Record<string, number> = {
                        'USD': 1,
                        'KES': 130,
                        'EUR': 0.92,
                        'GBP': 0.79
                    };
                    setExchangeRates(fallbackRates);
                    setAvailableCurrencies(Object.keys(fallbackRates).sort());
                }

                // Fetch User Preference
                const { data: { user } } = await supabase.auth.getUser();
                if (user) {
                    const { data: profile } = await supabase
                        .from('profiles')
                        .select('currency')
                        .eq('id', user.id)
                        .single();
                    if (profile?.currency) {
                        setUserCurrencyState(profile.currency);
                    }
                }
            } catch (e) {
                console.error("Currency init failed", e);
            } finally {
                setIsLoading(false);
            }
        };
        init();
    }, []);

    // 2. Conversion Logic
    // Formula: (Amount / Rate_From_To_USD) * Rate_To_To_USD
    const convertPrice = useCallback((amount: number, fromCurrency: string): number => {
        if (!fromCurrency) return amount;
        
        // Normalize KSH to KES for API compatibility
        const normalizedFrom = fromCurrency === 'KSH' ? 'KES' : fromCurrency;
        const normalizedUser = userCurrency === 'KSH' ? 'KES' : userCurrency;

        if (normalizedFrom === normalizedUser) return amount;
        if (!exchangeRates[normalizedFrom] || !exchangeRates[normalizedUser]) {
            console.warn(`Missing exchange rate for ${normalizedFrom} or ${normalizedUser}`);
            return amount; // Fallback to original amount to avoid breaking UI completely, but it will be formatted as userCurrency.
        }

        const amountInUSD = amount / exchangeRates[normalizedFrom];
        const amountInTarget = amountInUSD * exchangeRates[normalizedUser];
        
        return amountInTarget;
    }, [userCurrency, exchangeRates]);

    // 3. Formatter
    const formatPrice = useCallback((amount: number, currency: string) => {
        // Fallback for safety
        let safeCurrency = currency || 'USD';
        if (safeCurrency === 'KSH') safeCurrency = 'KES'; // Normalize KSH to KES

        if (isNaN(amount)) return `${safeCurrency} 0.00`;
        
        try {
            return new Intl.NumberFormat('en-US', {
                style: 'currency',
                currency: safeCurrency,
                minimumFractionDigits: 0,
                maximumFractionDigits: 2
            }).format(amount);
        } catch (e) {
            return `${safeCurrency} ${amount.toFixed(2)}`;
        }
    }, []);

    // 4. Update Preference
    const setUserCurrency = useCallback(async (currency: string) => {
        setUserCurrencyState(currency);
        try {
            // Fetch latest rates from the database to ensure live conversion
            const { data: ratesData } = await supabase.from('currencies').select('code, rate_to_usd');
            if (ratesData && ratesData.length > 0) {
                const rateMap: Record<string, number> = {};
                const codes: string[] = [];
                ratesData.forEach((r: any) => {
                    rateMap[r.code] = r.rate_to_usd;
                    codes.push(r.code);
                });
                setExchangeRates(rateMap);
                setAvailableCurrencies(codes.sort());
            }

            await api.updateCurrency(currency);
        } catch (e) {
            console.error("Failed to persist currency preference or fetch rates", e);
        }
    }, []);

    const contextValue = React.useMemo(() => ({
        userCurrency,
        exchangeRates,
        convertPrice,
        formatPrice,
        setUserCurrency,
        availableCurrencies,
        isLoading
    }), [userCurrency, exchangeRates, convertPrice, formatPrice, setUserCurrency, availableCurrencies, isLoading]);

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-screen bg-background">
                <i className="fas fa-circle-notch fa-spin text-4xl text-primary"></i>
            </div>
        );
    }

    return (
        <CurrencyContext.Provider value={contextValue}>
            {children}
        </CurrencyContext.Provider>
    );
};
