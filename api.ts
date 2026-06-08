
import { supabase } from './supabaseClient';
import { User, Product, Vroom, Post, Conversation, Message, Order, DetailedDispute, PostReport, SearchResults, CartItem, Comment, Reaction } from './types';
import { APP_URL } from './constants';
import { getApiCache, setApiCache, addToOutbox } from './utils/db';

// --- HELPERS ---

const API_URL = import.meta.env?.VITE_API_URL || '/api';

const isOnline = (lastSeenAt?: string) => {
    if (!lastSeenAt) return false;
    const diff = new Date().getTime() - new Date(lastSeenAt).getTime();
    return diff < 2 * 60 * 1000; // 2 minutes threshold
};

export const mapProduct = (p: any): Product => {
    // Parse comma-separated images if they exist
    const imageList = typeof p.image === 'string' && p.image.includes(',') 
        ? p.image.split(',').map((u: string) => u.trim()) 
        : [p.image];
    const mainImage = imageList[0] || 'placeholder';

    return {
        id: p.id,
        name: p.name,
        description: p.description,
        price: p.price,
        currency: p.currency,
        image: mainImage,
        images: imageList,
        video: p.video,
        likes: p.likes_count || 0,
        stock: p.stock_count,
        isOutOfStock: p.is_out_of_stock,
        commentsCount: p.comments_aggregate?.[0]?.count || p.comments_count || 0,
        sharesCount: p.shares_count || 0,
        userId: p.owner_id,
        category: p.category,
        tags: p.tags,
        // Defaults, usually overwritten if auth context is available during fetch
        isLiked: false,
        isBookmarked: false
    };
};

const getFollowedVroomIds = async (): Promise<Set<string>> => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return new Set();
    const { data } = await supabase.from('vroom_followers').select('vroom_id').eq('user_id', user.id);
    return new Set(data?.map((d: any) => d.vroom_id) || []);
};

const generateLocalTags = (description: string) => {
    const words = description.toLowerCase().split(/\s+/).filter(w => w.length > 4);
    const unique = [...new Set(words)].slice(0, 8);
    return unique.map(tag => ({ tag, weight: 1 }));
};

const fetchWithAuth = async (endpoint: string, options: any = {}) => {
    const { data: { session } } = await supabase.auth.getSession();
    const headers = {
        'Content-Type': 'application/json',
        ...(session?.access_token ? { 'Authorization': `Bearer ${session.access_token}` } : {}),
        ...options.headers
    };

    const res = await fetch(`${API_URL}${endpoint}`, {
        ...options,
        headers
    });

    if (!res.ok) throw new Error(`Request failed: ${res.statusText}`);
    return res.json();
};

export const api = {
    signup: async (formData: any) => {
        const firstName = formData.firstName.toLowerCase().replace(/[^a-z0-9]/g, '');
        const lastName = formData.secondName.toLowerCase().replace(/[^a-z0-9]/g, '');

        let handle = `@${firstName}${lastName}`;

        // Check Tier 1
        let { data: existing } = await supabase.from('profiles').select('id').eq('handle', handle).maybeSingle();

        if (existing) {
            // Tier 2
            handle = `@${firstName}_${lastName}`;
            let { data: existing2 } = await supabase.from('profiles').select('id').eq('handle', handle).maybeSingle();

            if (existing2) {
                // Tier 3
                const chars = '0123456789abcdefghijklmnopqrstuvwxyz';
                let isUnique = false;
                while (!isUnique) {
                    const randomSuffix = chars[Math.floor(Math.random() * 36)] + chars[Math.floor(Math.random() * 36)];
                    handle = `@${firstName}_${lastName}_${randomSuffix}`;
                    let { data: existing3 } = await supabase.from('profiles').select('id').eq('handle', handle).maybeSingle();
                    if (!existing3) {
                        isUnique = true;
                    }
                }
            }
        }

        // Step 1: Create the auth user. Custom fields go into raw_user_meta_data
        // (visible in Supabase Dashboard → Authentication → Users → raw_user_meta_data).
        // Note: Supabase's auth.users table does NOT have columns for gender/dob/country/phone
        // by design — those live in public.profiles which we populate in Step 2.
        // emailRedirectTo: after email confirmation, Supabase redirects here
        // with the session in the URL fragment. App.tsx's onAuthStateChange
        // picks it up via the SIGNED_IN / USER_UPDATED event automatically.
        const emailRedirectTo = APP_URL;

        const { data, error } = await supabase.auth.signUp({
            email: formData.email,
            password: formData.password,
            options: {
                emailRedirectTo,
                data: {
                    name: `${formData.firstName} ${formData.secondName}`,
                    handle: handle,
                    mobile: formData.mobile,
                    country: formData.country,
                    gender: formData.gender,
                    dob: formData.dob
                }
            }
        });

        if (error) {
            if (error.message?.includes('Database error saving new user')) {
                throw new Error('Registration failed: You must be 18 years or older to create an account. Please verify your date of birth.');
            }
            throw error;
        }
        
        if (!data.user) throw new Error('Signup succeeded but no user was returned.');

        // Step 2: Directly upsert ALL profile fields into public.profiles.
        // This is the definitive source of truth for the app and is more
        // reliable than depending solely on the handle_new_user DB trigger.
        const profilePayload = {
            id: data.user.id,
            email: formData.email,
            name: `${formData.firstName} ${formData.secondName}`,
            handle: handle,
            mobile: formData.mobile || '',
            country: formData.country || '',
            gender: formData.gender || '',
            dob: formData.dob || '',
            currency: 'USD',
            wallet_balance: 0,
            is_admin: false,
            last_seen_at: new Date().toISOString(),
        };

        const { error: profileError } = await supabase
            .from('profiles')
            .upsert(profilePayload, { onConflict: 'id' });

        // Log profile error but don't throw — auth succeeded, profile can be retried
        if (profileError) {
            console.error('Profile save failed after signup:', profileError);
        }

        return { user: data.user };
    },


    login: async (email: string, password: string, captchaToken?: string) => {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) {
            // Log full error details so devs can diagnose in the browser console
            console.error('[Auth] signInWithPassword error:', JSON.stringify(error, null, 2));

            const msg = error.message?.toLowerCase() || '';
            if (msg.includes('invalid login credentials') || msg.includes('invalid_credentials')) {
                throw new Error(
                    'Wrong email or password. ' +
                    'If you signed up recently, your email may not be confirmed yet. ' +
                    'Run AUTH_FIX_SQL in Supabase or check your inbox.'
                );
            }
            if (msg.includes('email not confirmed') || msg.includes('email_not_confirmed')) {
                throw new Error('Your email has not been confirmed. Please check your inbox for a confirmation link.');
            }
            throw error;
        }
        return { user: data.user };
    },

    // checkEmailRegistered: looks up the profiles table for an account by email.
    // Returns true if a profile row exists (meaning the user completed Sign Up).
    checkEmailRegistered: async (email: string): Promise<boolean> => {
        if (!email || !email.trim()) return false;
        const { data, error } = await supabase
            .from('profiles')
            .select('id')
            .ilike('email', email.trim())
            .maybeSingle();
        if (error) {
            console.warn('checkEmailRegistered error:', error);
            return false;
        }
        return !!data;
    },

    googleLogin: async () => {
        // redirectTo: after Google OAuth, Supabase redirects here with the session
        // fragment. App.tsx's onAuthStateChange SIGNED_IN event fires, which then
        // calls handleAuthSession → if no profile found the user is signed out
        // and shown the 'Account Not Found' screen (belt-and-suspenders fallback
        // on top of the before_user_created DB hook which blocks it server-side).
        const redirectTo = APP_URL;
        const { data, error } = await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: {
                redirectTo,
                queryParams: {
                    // Force Google to show the account picker every time
                    prompt: 'select_account',
                }
            }
        });
        if (error) throw error;
        return data;
    },

    logout: async () => {
        await supabase.auth.signOut();
    },

    startBoost: async (productId: string, budget: number) => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error("Not authenticated");

        const { error } = await supabase.rpc('start_boost', {
            p_user_id: user.id,
            p_product_id: productId,
            p_budget: budget
        });

        if (error) throw error;
    },

    registerBoostClick: async (productId: string, clickingUserId?: string) => {
        // Using clickingUserId if passed, else depending on the RLS/backend logic
        const { error } = await supabase.rpc('register_boost_click', {
            p_product_id: productId,
            p_clicking_user_id: clickingUserId // Optional param for the time being
        });
        if (error) {
            console.error("Boost click error:", error);
        }
    },

    startPromotion: async (itemType: string, itemId: string) => {
        console.warn('startPromotion is deprecated. For products, use startBoost.');
    },

    forgotPassword: async (email: string) => {
        const { error } = await supabase.auth.resetPasswordForEmail(email);
        if (error) throw error;
    },

    getUserProducts: async (): Promise<Product[]> => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return [];

        const { data, error } = await supabase
            .from('products')
            .select('*, profiles!products_owner_id_fkey(name)')
            .eq('owner_id', user.id)
            .order('created_at', { ascending: false });

        if (error) throw error;
        return data.map(mapProduct);
    },

    getProductById: async (id: string): Promise<Product> => {
        const { data, error } = await supabase
            .from('products')
            .select('*, profiles!products_owner_id_fkey(name)')
            .eq('id', id)
            .single();
        if (error) throw error;
        return mapProduct(data);
    },

    getMe: async (): Promise<User> => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error("Not authenticated");

        const { data: profile, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', user.id)
            .single();

        if (error) throw error;

        return {
            id: profile.id,
            name: profile.name,
            handle: profile.handle,
            avatar: profile.avatar,
            email: profile.email,
            bannerImage: profile.banner_image,
            bio: profile.bio,
            location: profile.location,
            website: profile.website,
            instagram: profile.instagram,
            mobile: profile.mobile,
            currency: profile.currency,
            walletBalance: profile.wallet_balance,
            isAdmin: profile.handle === '@elddadinc' || profile.email === 'eldady.inc@gmail.com',// profile.is_admin,
            isOnline: true
        };
    },

    getPublicProfile: async (userId: string): Promise<User> => {
        const [profileResult, followerCountResult] = await Promise.all([
            supabase.from('profiles').select('*').eq('id', userId).single(),
            supabase.from('user_follows').select('*', { count: 'exact', head: true }).eq('following_id', userId)
        ]);

        const profile = profileResult.data;
        if (profileResult.error || !profile) throw profileResult.error || new Error('Profile not found');

        const followersCount = followerCountResult.count || 0;

        return {
            id: profile.id,
            name: profile.name,
            handle: profile.handle,
            avatar: profile.avatar,
            bannerImage: profile.banner_image,
            bio: profile.bio,
            location: profile.location,
            website: profile.website,
            instagram: profile.instagram,
            isOnline: isOnline(profile.last_seen_at),
            lastSeenAt: profile.last_seen_at,
            followersCount,
            followingCount: profile.following_count
        };
    },

    updatePresence: async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
            await supabase.from('profiles').update({ last_seen_at: new Date().toISOString() }).eq('id', user.id);
        }
    },

    updateProfile: async (data: any): Promise<User> => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error("Not authenticated");

        const updates = {
            name: `${data.firstName} ${data.lastName}`,
            handle: `@${data.username}`,
            bio: data.bio,
            location: data.location,
            website: data.website,
            instagram: data.instagram,
            updated_at: new Date().toISOString()
        };

        const { error } = await supabase
            .from('profiles')
            .update(updates)
            .eq('id', user.id);

        if (error) throw error;
        return api.getMe();
    },

    updateProfileImage: async (type: 'avatar' | 'banner' | 'vroom', file: File) => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error("Not authenticated");

        const bucket = type === 'avatar' ? 'avatars' : 'banners';
        const fileExt = file.name.split('.').pop();
        const fileName = `${user.id}-${Math.random()}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
            .from(bucket)
            .upload(fileName, file);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
            .from(bucket)
            .getPublicUrl(fileName);

        if (type === 'vroom') return { url: publicUrl };

        const updateField = type === 'avatar' ? 'avatar' : 'banner_image';
        await supabase.from('profiles').update({ [updateField]: publicUrl }).eq('id', user.id);

        return { url: publicUrl };
    },

    updateCurrency: async (newCurrency: string) => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error("Not authenticated");

        const { error } = await supabase.from('profiles').update({ currency: newCurrency }).eq('id', user.id);
        if (error) throw error;
        return api.getMe();
    },

    getFeed: async (): Promise<Post[]> => {
        try {
            if (typeof navigator !== 'undefined' && !navigator.onLine) {
                const cached = await getApiCache('feed');
                if (cached) return cached;
            }

            const { data: { user } } = await supabase.auth.getUser();

            const { data, error } = await supabase
                .from('posts')
                .select(`
                    *,
                    user:profiles!user_id(*),
                    product:products!product_id(
                        *,
                        product_likes(user_id),
                        bookmarks(user_id),
                        comments_aggregate:comments(count)
                    )
                `)
                .order('created_at', { ascending: false })
                .limit(20);

            if (error) throw error;

            const feedData = data.map((p: any) => {
                const isLiked = p.product.product_likes?.some((l: any) => l.user_id === user?.id) || false;
                const isBookmarked = p.product.bookmarks?.some((b: any) => b.user_id === user?.id) || false;
                const commentsCount = p.product.comments_aggregate?.[0]?.count || 0;

                return {
                    id: p.id,
                    user: p.user,
                    product: {
                        ...mapProduct(p.product),
                        userId: p.product.owner_id,
                        likes: p.product.likes_count || 0,
                        sharesCount: p.product.shares_count || 0,
                        isOutOfStock: p.product.is_out_of_stock,
                        commentsCount: commentsCount,
                        isLiked,
                        isBookmarked
                    },
                    timestamp: new Date(p.created_at).toLocaleDateString(),
                    content: p.content,
                    commentsCount: commentsCount,
                    sharesCount: p.product.shares_count || 0
                };
            });
            
            if (typeof navigator !== 'undefined') {
                setApiCache('feed', feedData).catch(console.error);
            }

            return feedData;
        } catch (e) {
            console.error("Feed fetch error", e);
            if (typeof navigator !== 'undefined') {
                const cached = await getApiCache('feed');
                if (cached) return cached;
            }
            return [];
        }
    },

    postProduct: async (data: any) => {
        if (typeof navigator !== 'undefined' && !navigator.onLine) {
            await addToOutbox('postProduct', { data });
            return;
        }

        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error("Not authenticated");

        let imageUrls: string[] = [];
        let videoUrl = '';
        
        if (data.mediaType === 'video' && data.media) {
            const res = await fetch(data.media);
            const blob = await res.blob();
            const fileName = `${Date.now()}.mp4`;
            const { error: uploadError } = await supabase.storage.from('products').upload(fileName, blob);
            if (uploadError) throw uploadError;
            const { data: { publicUrl } } = supabase.storage.from('products').getPublicUrl(fileName);
            videoUrl = publicUrl;
        } else if (data.mediaType === 'image' && data.mediaList && data.mediaList.length > 0) {
            for (let i = 0; i < data.mediaList.length; i++) {
                const res = await fetch(data.mediaList[i]);
                const blob = await res.blob();
                const fileName = `${Date.now()}-${i}.jpg`;
                const { error: uploadError } = await supabase.storage.from('products').upload(fileName, blob);
                if (uploadError) throw uploadError;
                const { data: { publicUrl } } = supabase.storage.from('products').getPublicUrl(fileName);
                imageUrls.push(publicUrl);
            }
        } else if (data.mediaType === 'image' && data.media) {
            // Fallback for single image (just in case)
            const res = await fetch(data.media);
            const blob = await res.blob();
            const fileName = `${Date.now()}.jpg`;
            const { error: uploadError } = await supabase.storage.from('products').upload(fileName, blob);
            if (uploadError) throw uploadError;
            const { data: { publicUrl } } = supabase.storage.from('products').getPublicUrl(fileName);
            imageUrls.push(publicUrl);
        }

        const finalImageString = imageUrls.length > 0 ? imageUrls.join(',') : 'placeholder';

        const { data: product, error: prodError } = await supabase
            .from('products')
            .insert({
                owner_id: user.id,
                name: data.name,
                description: data.description,
                price: parseFloat(data.price),
                currency: data.currency,
                image: finalImageString,
                video: videoUrl,
                category: data.category,
                tags: data.tags
            })
            .select()
            .single();

        if (prodError) throw prodError;

        if (data.tags && Array.isArray(data.tags) && data.tags.length > 0) {
            const tagsToProcess = data.tags.map((t: any) => {
                if (typeof t === 'string') return t.toLowerCase();
                if (typeof t === 'object' && t !== null && t.tag) return String(t.tag).toLowerCase();
                return String(t).toLowerCase();
            });
            const { data: existingTags } = await supabase.from('tags').select('tag, count').in('tag', tagsToProcess);
            const existingMap = new Map<string, number>(existingTags?.map((t: any) => [t.tag, t.count]) || []);
            const tagRecords = tagsToProcess.map((tag: string) => ({
                tag: tag,
                count: (existingMap.get(tag) || 0) + 1,
                last_used_at: new Date().toISOString()
            }));
            await supabase.from('tags').upsert(tagRecords, { onConflict: 'tag' });
        }

        const { error: postError } = await supabase
            .from('posts')
            .insert({
                user_id: user.id,
                product_id: product.id,
                content: `Check out my new product: ${data.name}`
            });

        if (postError) throw postError;
    },

    toggleLike: async (productId: string) => {
        if (typeof navigator !== 'undefined' && !navigator.onLine) {
            await addToOutbox('toggleLike', { productId });
            return { likes: 0, isLiked: true }; // Optimistic
        }

        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error("Not authenticated");

        const { data: existing } = await supabase.from('product_likes').select('*').eq('product_id', productId).eq('user_id', user.id).single();

        let newLikes = 0;
        let isLiked = false;

        if (existing) {
            await supabase.from('product_likes').delete().eq('product_id', productId).eq('user_id', user.id);
            await supabase.rpc('decrement_product_likes', { p_id: productId });
            isLiked = false;
        } else {
            await supabase.from('product_likes').insert({ product_id: productId, user_id: user.id });
            await supabase.rpc('increment_product_likes', { p_id: productId });
            isLiked = true;
        }

        const { data } = await supabase.from('products').select('likes_count').eq('id', productId).single();
        newLikes = data?.likes_count || 0;

        return { likes: newLikes, isLiked };
    },

    toggleBookmark: async (productId: string) => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error("Not authenticated");

        const { data: existing } = await supabase.from('bookmarks').select('*').eq('product_id', productId).eq('user_id', user.id).single();

        if (existing) {
            await supabase.from('bookmarks').delete().eq('product_id', productId).eq('user_id', user.id);
            return { isBookmarked: false };
        } else {
            await supabase.from('bookmarks').insert({ product_id: productId, user_id: user.id });
            return { isBookmarked: true };
        }
    },

    incrementShare: async (productId: string) => {
        await supabase.rpc('increment_product_shares', { p_id: productId });
        const { data } = await supabase.from('products').select('shares_count').eq('id', productId).single();
        return data?.shares_count || 0;
    },

    reportPost: async (postId: string, reason: string) => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error("Not authenticated");

        await supabase.from('reports').insert({
            reporter_id: user.id,
            post_id: postId,
            reason
        });
    },

    toggleStockStatus: async (productId: string, status: boolean) => {
        await supabase.from('products').update({ is_out_of_stock: status }).eq('id', productId);
    },

    search: async (query: string): Promise<SearchResults> => {
        let productsRaw, profilesRaw, vroomsRaw;

        try {
            if (!query || query.trim() === '') {
                const { data: p } = await supabase.from('products').select('*').order('created_at', { ascending: false }).limit(50);
                const { data: u } = await supabase.from('profiles').select('*').limit(20);
                const { data: v } = await supabase.from('vrooms').select('*, products(count)').order('created_at', { ascending: false }).limit(20);

                productsRaw = p;
                profilesRaw = u;
                vroomsRaw = v;
            } else {
                const { data: p } = await supabase.from('products').select('*').or(`name.ilike.%${query}%,description.ilike.%${query}%,category.ilike.%${query}%`);
                const { data: u } = await supabase.from('profiles').select('*').or(`name.ilike.%${query}%,handle.ilike.%${query}%,bio.ilike.%${query}%`);
                const { data: v } = await supabase.from('vrooms').select('*, products(count)').or(`name.ilike.%${query}%,description.ilike.%${query}%`);

                productsRaw = p;
                profilesRaw = u;
                vroomsRaw = v;
            }
        } catch (error) {
            console.error("Search API Error:", error);
            return { products: [], users: [], vrooms: [], hashtags: [] };
        }

        const followedIds = await getFollowedVroomIds();

        return {
            products: (productsRaw || []).map(mapProduct) as Product[],
            users: (profilesRaw || []).map((p: any) => ({
                id: p.id,
                name: p.name,
                handle: p.handle,
                avatar: p.avatar,
                walletBalance: 0,
                isOnline: false
            })) as User[],
            vrooms: (vroomsRaw || []).map((v: any) => ({
                id: v.id,
                name: v.name,
                description: v.description,
                coverImage: v.cover_image,
                productCount: v.products?.[0]?.count || 0,
                followers: v.followers_count || 0,
                views: v.views_count?.toString() || '0',
                ownerId: v.owner_id,
                isPublic: v.is_public,
                isFollowing: followedIds.has(v.id),
                products: []
            })) as Vroom[],
            hashtags: []
        };
    },

    getTrendingTags: async () => {
        const { data, error } = await supabase
            .from('tags')
            .select('*')
            .order('count', { ascending: false })
            .limit(10);

        let tagsData = data || [];

        if (error || tagsData.length === 0) {
            if (error) console.error("Error fetching trending tags from 'tags' table:", error);

            // Fallback: fetch tags from recent products
            const { data: productsData, error: productsError } = await supabase
                .from('products')
                .select('tags')
                .order('created_at', { ascending: false })
                .limit(100);

            if (!productsError && productsData) {
                const tagCounts: Record<string, number> = {};
                productsData.forEach(product => {
                    let productTags = product.tags;
                    if (typeof productTags === 'string') {
                        try {
                            productTags = JSON.parse(productTags);
                        } catch (e) { }
                    }
                    if (productTags && Array.isArray(productTags)) {
                        productTags.forEach((t: any) => {
                            let cleanTag = t;
                            try {
                                if (typeof cleanTag === 'string' && (cleanTag.trim().startsWith('{') || cleanTag.trim().startsWith('['))) {
                                    const parsed = JSON.parse(cleanTag);
                                    if (parsed.tag) cleanTag = parsed.tag;
                                } else if (typeof cleanTag === 'object' && cleanTag !== null) {
                                    if (cleanTag.tag) cleanTag = cleanTag.tag;
                                    else cleanTag = JSON.stringify(cleanTag);
                                }
                            } catch (e) { }

                            if (typeof cleanTag !== 'string') cleanTag = String(cleanTag);
                            cleanTag = cleanTag.toLowerCase();

                            tagCounts[cleanTag] = (tagCounts[cleanTag] || 0) + 1;
                        });
                    }
                });

                tagsData = Object.entries(tagCounts)
                    .map(([tag, count]) => ({ tag, count }))
                    .sort((a, b) => b.count - a.count)
                    .slice(0, 10);
            }
        }

        if (tagsData.length === 0) {
            // If still empty, provide some default trending tags
            tagsData = [
                { tag: 'fashion', count: 100 },
                { tag: 'tech', count: 85 },
                { tag: 'lifestyle', count: 70 },
                { tag: 'art', count: 65 },
                { tag: 'music', count: 50 }
            ];
        }

        return tagsData.map((t: any) => {
            let cleanTag = t.tag;
            try {
                if (typeof cleanTag === 'string' && (cleanTag.trim().startsWith('{') || cleanTag.trim().startsWith('['))) {
                    const parsed = JSON.parse(cleanTag);
                    if (parsed.tag) cleanTag = parsed.tag;
                } else if (typeof cleanTag === 'object' && cleanTag !== null) {
                    if (cleanTag.tag) cleanTag = cleanTag.tag;
                    else cleanTag = JSON.stringify(cleanTag);
                }
            } catch (e) { }

            if (typeof cleanTag !== 'string') {
                cleanTag = String(cleanTag);
            }

            return { tag: cleanTag, score: t.count };
        });
    },

    searchTags: async (query: string) => {
        const { data } = await supabase.from('tags').select('tag').ilike('tag', `%${query}%`).limit(5);
        return (data || []).map((t: any) => ({ value: t.tag, label: t.tag }));
    },

    generateTags: async (description: string) => {
        try {
            const controller = new AbortController();
            const id = setTimeout(() => controller.abort(), 3000);

            const res = await fetch(`${API_URL}/tags/suggest`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ description }),
                signal: controller.signal
            });
            clearTimeout(id);

            if (res.ok) {
                const data = await res.json();
                if (data.tags && Array.isArray(data.tags)) return { tags: data.tags };
            }
            throw new Error("Server tag generation failed");
        } catch (e) {
            console.warn("Using local tag generator");
            return { tags: generateLocalTags(description) };
        }
    },

    getPopularVrooms: async (): Promise<Vroom[]> => {
        const { data } = await supabase
            .from('vrooms')
            .select('*, products(count)')
            .order('views_count', { ascending: false })
            .limit(10);

        const followedIds = await getFollowedVroomIds();

        return (data || []).map((v: any) => ({
            id: v.id,
            name: v.name,
            description: v.description,
            coverImage: v.cover_image,
            productCount: v.products?.[0]?.count || 0,
            followers: v.followers_count || 0,
            views: v.views_count.toString(),
            recent_views: v.views_count,
            ownerId: v.owner_id,
            isPublic: v.is_public,
            isFollowing: followedIds.has(v.id),
            products: []
        }));
    },

    getUserVrooms: async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return [];
        const { data } = await supabase
            .from('vrooms')
            .select('*, products(count)')
            .eq('owner_id', user.id);

        return (data || []).map((v: any) => ({
            id: v.id,
            name: v.name,
            description: v.description,
            coverImage: v.cover_image,
            productCount: v.products?.[0]?.count || 0,
            followers: v.followers_count || 0,
            views: v.views_count?.toString() || '0',
            ownerId: v.owner_id,
            isPublic: v.is_public,
            products: []
        }));
    },

    getPublicUserVrooms: async (userId: string): Promise<Vroom[]> => {
        const { data } = await supabase
            .from('vrooms')
            .select('*, products(count)')
            .eq('owner_id', userId)
            .eq('is_public', true);

        const followedIds = await getFollowedVroomIds();

        return (data || []).map((v: any) => ({
            id: v.id,
            name: v.name,
            description: v.description,
            coverImage: v.cover_image,
            productCount: v.products?.[0]?.count || 0,
            followers: v.followers_count || 0,
            views: v.views_count?.toString() || '0',
            ownerId: v.owner_id,
            isPublic: v.is_public,
            isFollowing: followedIds.has(v.id),
            products: []
        }));
    },

    getPublicUserFollowingVrooms: async (userId: string): Promise<Vroom[]> => {
        const { data } = await supabase
            .from('vroom_followers')
            .select('vroom:vrooms(*, products(count))')
            .eq('user_id', userId);

        const followedIds = await getFollowedVroomIds();

        return (data || [])
            .filter((f: any) => f.vroom && f.vroom.is_public)
            .map((f: any) => ({
                id: f.vroom.id,
                name: f.vroom.name,
                description: f.vroom.description,
                coverImage: f.vroom.cover_image,
                productCount: f.vroom.products?.[0]?.count || 0,
                followers: f.vroom.followers_count || 0,
                views: f.vroom.views_count?.toString() || '0',
                ownerId: f.vroom.owner_id,
                isPublic: f.vroom.is_public,
                isFollowing: followedIds.has(f.vroom.id),
                products: []
            }));
    },

    getVroomById: async (id: string): Promise<Vroom> => {
        const { data: v, error } = await supabase
            .from('vrooms')
            .select('*, products(*)')
            .eq('id', id)
            .single();

        if (error) throw error;

        const followedIds = await getFollowedVroomIds();

        return {
            id: v.id,
            name: v.name,
            description: v.description,
            coverImage: v.cover_image,
            productCount: v.products ? v.products.length : 0,
            followers: v.followers_count || 0,
            views: v.views_count.toString(),
            ownerId: v.owner_id,
            isPublic: v.is_public,
            isFollowing: followedIds.has(v.id),
            products: (v.products || []).map(mapProduct)
        };
    },

    createVroom: async (data: any) => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error("Not authenticated");

        const { data: vroom, error } = await supabase.from('vrooms').insert({
            owner_id: user.id,
            name: data.name,
            description: data.description,
            cover_image: data.coverImage,
            is_public: data.is_public
        }).select().single();

        if (error) throw error;

        return {
            id: vroom.id,
            name: vroom.name,
            description: vroom.description,
            coverImage: vroom.cover_image,
            productCount: 0,
            followers: vroom.followers_count || 0,
            views: vroom.views_count.toString(),
            ownerId: vroom.owner_id,
            isPublic: vroom.is_public,
            products: []
        };
    },

    updateVroom: async (id: string, data: any) => {
        const { data: vroom, error } = await supabase.from('vrooms').update({
            name: data.name,
            description: data.description,
            cover_image: data.coverImage,
            is_public: data.is_public
        }).eq('id', id).select('*, products(*)').single();

        if (error) throw error;
        const followedIds = await getFollowedVroomIds();

        return {
            id: vroom.id,
            name: vroom.name,
            description: vroom.description,
            coverImage: vroom.cover_image,
            productCount: vroom.products ? vroom.products.length : 0,
            followers: vroom.followers_count || 0,
            views: vroom.views_count.toString(),
            ownerId: vroom.owner_id,
            isPublic: vroom.is_public,
            isFollowing: followedIds.has(vroom.id),
            products: (vroom.products || []).map(mapProduct)
        };
    },

    toggleFollowVroom: async (vroomId: string) => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error("Not authenticated");

        const { data: existing } = await supabase
            .from('vroom_followers')
            .select('*')
            .eq('vroom_id', vroomId)
            .eq('user_id', user.id)
            .single();

        let result;
        if (existing) {
            const { error: delErr } = await supabase.from('vroom_followers').delete().eq('vroom_id', vroomId).eq('user_id', user.id);
            if (delErr) throw delErr;

            // Increment/decrement robustly via backend
            await fetch(`${API_URL}/vrooms/${vroomId}/unfollow`, { method: 'POST' });

            const { count } = await supabase.from('vroom_followers').select('*', { count: 'exact', head: true }).eq('vroom_id', vroomId);
            result = { isFollowing: false, followers: count || 0 };
        } else {
            const { error: insErr } = await supabase.from('vroom_followers').insert({ vroom_id: vroomId, user_id: user.id });
            if (insErr) throw insErr;

            // Increment robustly via backend
            await fetch(`${API_URL}/vrooms/${vroomId}/follow`, { method: 'POST' });

            const { count } = await supabase.from('vroom_followers').select('*', { count: 'exact', head: true }).eq('vroom_id', vroomId);
            result = { isFollowing: true, followers: count || 1 };
        }

        window.dispatchEvent(new CustomEvent('vroom-follow-changed', {
            detail: { vroomId, ...result }
        }));

        return result;
    },

    recordVroomView: async (id: string) => {
        let counted = false;
        let newCount: number | null = null;
        try {
            const res = await fetch(`${API_URL}/vrooms/${id}/view`, { method: 'POST' });
            if (res.ok) {
                const data = await res.json();
                counted = data.counted;
                if (data.newCount !== undefined) newCount = data.newCount;
            }
        } catch (e) {
            // Fallback to direct RPC if backend is not available
            try {
                const { data, error } = await supabase.rpc('increment_vroom_views', { vroom_uuid: id });
                if (!error) {
                    counted = true;
                    if (data !== null) newCount = Number(data);
                }
            } catch (err) {
                console.error(err);
            }
        }

        if (counted) {
            window.dispatchEvent(new CustomEvent('vroom-viewed', { detail: { vroomId: id, newCount } }));
        }
        return counted;
    },

    getVroomsDashboard: async () => {
        const myVrooms = await api.getUserVrooms();
        const popular = await api.getPopularVrooms();
        const { data: { user } } = await supabase.auth.getUser();

        let following: any[] = [];
        if (user) {
            const { data } = await supabase.from('vroom_followers').select('vroom:vrooms(*, products(count))').eq('user_id', user.id);
            following = (data || []).map((f: any) => ({
                id: f.vroom.id,
                name: f.vroom.name,
                description: f.vroom.description,
                coverImage: f.vroom.cover_image,
                productCount: f.vroom.products?.[0]?.count || 0,
                followers: f.vroom.followers_count || 0,
                views: f.vroom.views_count.toString(),
                ownerId: f.vroom.owner_id,
                isPublic: f.vroom.is_public,
                isFollowing: true,
                products: []
            }));
        }

        return {
            myVroom: myVrooms[0] || null,
            following: following,
            suggested: popular
        }
    },

    getAvailableProductsForVroom: async (vroomId: string) => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return [];
        const { data } = await supabase.from('products').select('*').eq('owner_id', user.id).is('vroom_id', null);
        return (data || []).map(mapProduct) as Product[];
    },

    addProductToVroom: async (vroomId: string, productId: string) => {
        await supabase.from('products').update({ vroom_id: vroomId }).eq('id', productId);
        return (await api.getVroomById(vroomId));
    },

    getConversations: async (): Promise<Conversation[]> => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return [];

        const { data: myConvs } = await supabase
            .from('conversation_participants')
            .select('conversation_id, last_read_at')
            .eq('user_id', user.id);

        const convIds = myConvs?.map(c => c.conversation_id) || [];
        const readMap = new Map(myConvs?.map(c => [c.conversation_id, new Date(c.last_read_at || 0).getTime()]) || []);

        if (convIds.length === 0) return [];

        const { data: conversations } = await supabase
            .from('conversations')
            .select(`
                *,
                participants:conversation_participants(
                    user:profiles(*)
                ),
                messages:messages(
                    *,
                    sender:profiles(*),
                    message_reactions(
                        emoji,
                        user_id
                    )
                )
            `)
            .in('id', convIds)
            .order('last_message_at', { ascending: false });

        return (conversations || []).map((c: any) => {
            const isGroup = c.is_group;

            const otherParticipant = !isGroup
                ? c.participants.find((p: any) => p.user.id !== user.id)?.user
                : null;

            const messages = (c.messages || [])
                .filter((m: any) => !m.visible_to || m.visible_to === user.id)
                .sort((a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
                .map((m: any) => ({
                    id: m.id,
                    senderId: m.sender_id,
                    senderName: m.sender?.name,
                    senderAvatar: m.sender?.avatar,
                    content: m.content,
                    image: m.image_url,
                    timestamp: new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                    createdAt: m.created_at,
                    isMe: m.sender_id === user.id,
                    isSystem: m.is_system,
                    reactions: m.message_reactions?.reduce((acc: any[], r: any) => {
                        const existing = acc.find(x => x.emoji === r.emoji);
                        if (existing) {
                            existing.userIds.push(r.user_id);
                            existing.count++;
                        } else {
                            acc.push({ emoji: r.emoji, count: 1, userIds: [r.user_id] });
                        }
                        return acc;
                    }, []) || [],
                    isEdited: m.is_edited,
                    isDeleted: m.is_deleted,
                    starredBy: m.starred_by || [],
                    status: m.status || 'sent',
                    replyToId: m.reply_to_id
                }));

            messages.forEach((m: any) => {
                if (m.replyToId) {
                    const r = messages.find((x: any) => x.id === m.replyToId);
                    if (r) {
                        m.replyTo = { id: r.id, content: r.content, senderName: r.senderName, image: r.image };
                    }
                }
            });

            const lastMsg = messages.length > 0 ? messages[messages.length - 1] : null;
            const lastReadTime = readMap.get(c.id) || 0;
            // Calculate unread count based on raw created_at in the DB
            const unreadCount = (c.messages || []).filter((dbMsg: any) => dbMsg.sender_id !== user.id && new Date(dbMsg.created_at).getTime() > lastReadTime).length;

            return {
                id: c.id,
                isGroup: isGroup,
                groupName: c.group_name,
                groupDescription: c.group_description,
                groupPhoto: c.group_photo,
                ownerId: c.owner_id,
                user: otherParticipant ? {
                    id: otherParticipant.id,
                    name: otherParticipant.name,
                    handle: otherParticipant.handle,
                    avatar: otherParticipant.avatar,
                    isOnline: isOnline(otherParticipant.last_seen_at),
                    lastSeenAt: otherParticipant.last_seen_at
                } : undefined,
                lastMessage: lastMsg?.content || (lastMsg?.image ? 'Image' : 'Started a conversation'),
                lastMessageTime: lastMsg?.timestamp || '',
                lastMessageTimestamp: new Date(c.last_message_at).getTime(),
                messages: messages,
                participants: c.participants.map((p: any) => ({
                    ...p.user,
                    isOnline: isOnline(p.user.last_seen_at),
                    isAdmin: p.is_admin
                })),
                unreadCount: unreadCount
            };
        });
    },

    sendMessage: async (conversationId: string, content: string, replyToId?: string, image?: string) => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error("Not authenticated");

        let imageUrl = null;
        if (image) {
            const fileName = `chat-${Date.now()}-${Math.random().toString(36).substring(7)}`;
            const res = await fetch(image);
            const blob = await res.blob();
            const { error: uploadError } = await supabase.storage.from('products').upload(fileName, blob);
            if (!uploadError) {
                const { data } = supabase.storage.from('products').getPublicUrl(fileName);
                imageUrl = data.publicUrl;
            }
        }

        const { error } = await supabase.from('messages').insert({
            conversation_id: conversationId,
            sender_id: user.id,
            content,
            image_url: imageUrl,
            reply_to_id: replyToId
        });

        if (error) throw error;

        await supabase.from('conversations')
            .update({ last_message_at: new Date().toISOString() })
            .eq('id', conversationId);

        // Optimistic read for sender
        api.markConversationAsRead(conversationId);
    },

    markConversationAsRead: async (conversationId: string) => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        await supabase.from('conversation_participants')
            .update({ last_read_at: new Date().toISOString() })
            .eq('conversation_id', conversationId)
            .eq('user_id', user.id);
            
        // Trigger Read Receipts instantly
        await api.markConversationStatus(conversationId, 'read');
    },

    markConversationStatus: async (conversationId: string, status: 'delivered' | 'read') => {
        try {
            await supabase.rpc('mark_conversation_status', {
                p_conversation_id: conversationId,
                p_status: status
            });
        } catch (e) {
            console.error("Error setting conversation status:", e);
        }
    },

    subscribeToMessages: (conversationId: string, callback: (msg: Message, eventType: 'INSERT' | 'UPDATE' | 'DELETE') => void) => {
        return supabase
            .channel(`public:messages:conversation_id=eq.${conversationId}`)
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'messages', filter: `conversation_id=eq.${conversationId}` },
                async (payload) => {
                    const eventType = payload.eventType as 'INSERT' | 'UPDATE' | 'DELETE';
                    if (eventType === 'DELETE') {
                        callback({ id: (payload.old as any)?.id } as Message, eventType);
                        return;
                    }

                    const msg = payload.new as any;
                    const { data: sender } = await supabase.from('profiles').select('*').eq('id', msg.sender_id).single();
                    const { data: { user } } = await supabase.auth.getUser();

                    let replyTo = undefined;
                    if (msg.reply_to_id) {
                        const { data: replyMsg } = await supabase.from('messages').select('content, image_url, sender_id').eq('id', msg.reply_to_id).single();
                        if (replyMsg) {
                            const { data: replySender } = await supabase.from('profiles').select('name').eq('id', replyMsg.sender_id).single();
                            replyTo = {
                                id: msg.reply_to_id,
                                content: replyMsg.content,
                                image: replyMsg.image_url,
                                senderName: replySender?.name
                            };
                        }
                    }

                    callback({
                        id: msg.id,
                        senderId: msg.sender_id,
                        senderName: sender?.name,
                        senderAvatar: sender?.avatar,
                        content: msg.content,
                        image: msg.image_url,
                        timestamp: new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                        createdAt: msg.created_at,
                        isMe: user?.id === msg.sender_id,
                        isSystem: msg.is_system,
                        reactions: [],
                        isEdited: msg.is_edited,
                        isDeleted: msg.is_deleted,
                        starredBy: msg.starred_by || [],
                        status: msg.status || 'sent',
                        replyTo: replyTo
                    }, eventType);
                })
            .subscribe();
    },

    editMessage: async (messageId: string, content: string) => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error("Not authenticated");

        const { data: msg } = await supabase.from('messages').select('created_at').eq('id', messageId).single();
        if (!msg) throw new Error("Message not found");
        if (Date.now() - new Date(msg.created_at).getTime() > 3 * 60 * 1000) {
            throw new Error("Message can only be edited within 3 minutes");
        }

        const { error } = await supabase.from('messages')
            .update({ content, is_edited: true })
            .eq('id', messageId)
            .eq('sender_id', user.id);

        if (error) throw error;
    },

    deleteMessage: async (messageId: string) => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error("Not authenticated");

        const { error } = await supabase.from('messages')
            .update({ content: 'Text deleted', is_deleted: true, image_url: null })
            .eq('id', messageId)
            .eq('sender_id', user.id);

        if (error) throw error;
    },

    toggleStarMessage: async (messageId: string) => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error("Not authenticated");

        const { data: msg } = await supabase.from('messages').select('starred_by').eq('id', messageId).single();
        if (!msg) return;

        let starredBy = msg.starred_by || [];
        if (starredBy.includes(user.id)) {
            starredBy = starredBy.filter((id: string) => id !== user.id);
        } else {
            starredBy.push(user.id);
        }

        const { error } = await supabase.from('messages').update({ starred_by: starredBy }).eq('id', messageId);
        if (error) throw error;
    },

    reactToMessage: async (messageId: string, emoji: string) => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error("Not authenticated");

        const { data: existing } = await supabase.from('message_reactions')
            .select('id')
            .eq('message_id', messageId)
            .eq('user_id', user.id)
            .eq('emoji', emoji)
            .single();

        if (existing) {
            await supabase.from('message_reactions').delete().eq('id', existing.id);
        } else {
            await supabase.from('message_reactions').insert({
                message_id: messageId,
                user_id: user.id,
                emoji: emoji
            });
        }
    },

    startDirectMessage: async (targetUserId: string): Promise<Conversation> => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error("Not authenticated");

        // Simple check to find existing DM
        const allConvs = await api.getConversations();
        const existingDM = allConvs.find(c => !c.isGroup && c.participants?.some(p => p.id === targetUserId));

        if (existingDM) return existingDM;

        // Create new DM
        const newId = crypto.randomUUID();
        await supabase.from('conversations').insert({ id: newId, is_group: false, owner_id: user.id });

        const { error: partErr } = await supabase.from('conversation_participants').insert([
            { conversation_id: newId, user_id: user.id },
            { conversation_id: newId, user_id: targetUserId }
        ]);

        if (partErr) {
            console.error("DM participant insert RLS error:", partErr);
            throw new Error("Could not add participants to DM. RLS Policy might be blocking it.");
        }

        const updatedConvs = await api.getConversations();
        return updatedConvs.find(c => c.id === newId) || {
            id: newId,
            isGroup: false,
            ownerId: user.id,
            lastMessage: 'Started a conversation',
            lastMessageTime: '',
            lastMessageTimestamp: Date.now(),
            messages: [],
            participants: [],
            unreadCount: 0
        } as any;
    },

    createGroup: async (name: string, photo: string, members: string[]) => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error("Not authenticated");

        const newId = crypto.randomUUID();
        const { error } = await supabase.from('conversations').insert({
            id: newId,
            is_group: true,
            group_name: name,
            group_photo: photo || `https://ui-avatars.com/api/?name=${name}&background=random`,
            owner_id: user.id
        });

        if (error) throw error;

        const participants = [user.id, ...members].map(uid => ({ conversation_id: newId, user_id: uid, is_admin: uid === user.id }));
        const { error: partErr } = await supabase.from('conversation_participants').insert(participants);
        if (partErr) console.warn("Group participant insert RLS error:", partErr);

        return {
            id: newId,
            isGroup: true,
            groupName: name,
            groupPhoto: photo || `https://ui-avatars.com/api/?name=${name}&background=random`,
            ownerId: user.id,
            lastMessage: 'Group created',
            lastMessageTime: '',
            lastMessageTimestamp: Date.now(),
            messages: [],
            participants: [],
            unreadCount: 0
        } as any;
    },

    joinGroup: async (id: string) => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error("Not authenticated");

        const { error } = await supabase.from('conversation_participants').insert({ conversation_id: id, user_id: user.id });
        if (error) throw error;

        const allConvs = await api.getConversations();
        return allConvs.find(c => c.id === id)!;
    },

    leaveGroup: async (id: string) => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error("Not authenticated");
        await supabase.from('conversation_participants').delete().eq('conversation_id', id).eq('user_id', user.id);
    },

    addGroupMember: async (conversationId: string, userId: string) => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error("Not authenticated");
        await supabase.from('conversation_participants').insert({ conversation_id: conversationId, user_id: userId });
    },

    removeGroupMember: async (conversationId: string, userId: string) => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error("Not authenticated");
        await supabase.from('conversation_participants').delete().eq('conversation_id', conversationId).eq('user_id', userId);
    },

    makeGroupAdmin: async (conversationId: string, userId: string) => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error("Not authenticated");
        const { error } = await supabase.from('conversation_participants').update({ is_admin: true }).eq('conversation_id', conversationId).eq('user_id', userId);
        if (error) throw error;
    },

    removeGroupAdmin: async (conversationId: string, userId: string) => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error("Not authenticated");
        const { error } = await supabase.from('conversation_participants').update({ is_admin: false }).eq('conversation_id', conversationId).eq('user_id', userId);
        if (error) throw error;
    },

    updateGroupInfo: async (conversationId: string, name: string, description: string): Promise<void> => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error("Not authenticated");

        // Verify admin
        const { data: member } = await supabase.from('conversation_participants')
            .select('is_admin')
            .eq('conversation_id', conversationId)
            .eq('user_id', user.id)
            .single();

        const { data: conv } = await supabase.from('conversations').select('owner_id').eq('id', conversationId).single();
        const isOwner = conv?.owner_id === user.id;

        if (!isOwner && !member?.is_admin) throw new Error("Not authorized to edit group");

        const { error } = await supabase.from('conversations').update({
            group_name: name,
            group_description: description
        }).eq('id', conversationId);

        if (error) throw error;
    },

    updateGroupPhoto: async (conversationId: string, file: File): Promise<string> => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error("Not authenticated");

        const fileExt = file.name.split('.').pop();
        const fileName = `group-${conversationId}-${Date.now()}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
            .from('avatars')
            .upload(fileName, file, { upsert: true });

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(fileName);

        const { error } = await supabase
            .from('conversations')
            .update({ group_photo: publicUrl })
            .eq('id', conversationId);

        if (error) throw error;
        return publicUrl;
    },

    getAllUsers: async () => {
        const { data } = await supabase.from('profiles').select('*');
        return (data || []) as User[];
    },

    createOrder: async (items: CartItem[], shippingData: any) => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error("Not authenticated");

        const { data: profile } = await supabase.from('profiles').select('currency').eq('id', user.id).single();
        const currencyCode = profile?.currency || 'USD';

        let lastOrderId: string | null = null;
        
        for (const item of items) {
            const amount = item.price * item.quantity;
            const { data: orderId, error } = await supabase.rpc('create_secure_order', {
                buyer_id: user.id,
                seller_id: item.userId,
                amount_in_buyer_currency: amount,
                buyer_currency_code: currencyCode,
                shipping_details: shippingData,
                item_quantity: item.quantity,
                item_name: item.name,
                product_id: item.id
            });

            if (error) throw error;
            lastOrderId = orderId;
        }

        return lastOrderId;
    },

    getOrders: async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return [];
        const { data, error } = await supabase.from('orders').select('*, order_items(*, product:products(*)), disputes_detailed(status)').eq('buyer_id', user.id).order('created_at', { ascending: false });
        if (error) {
            console.error('[getOrders] Query error:', error.message);
            return [];
        }
        console.log('[getOrders] Raw DB response:', JSON.stringify((data || []).map((o: any) => ({
            id: o.id?.slice(-6),
            status: o.status,
            disputes_detailed: o.disputes_detailed
        }))));
        return (data || []).map((o: any) => {
            // CRITICAL: disputes_detailed.order_id has a UNIQUE constraint,
            // so Supabase returns it as an OBJECT (not array). Handle both formats.
            const dd = o.disputes_detailed;
            const disputeStatus = dd
                ? (Array.isArray(dd) ? dd[0]?.status : dd.status) || null
                : null;
            const isDisputeResolved = disputeStatus === 'Refunded' || disputeStatus === 'Released';
            return {
                id: o.id,
                items: o.order_items || [],
                shipping: o.shipping_address,
                total: o.amount_paid,
                currency: o.buyer_currency || 'USD',
                timestamp: o.created_at,
                status: o.status,
                disputeResolved: isDisputeResolved,
                disputeStatus: disputeStatus // Add specific dispute status for badge rendering
            };
        });
    },

    confirmOrder: async (orderId: string) => {
        // Client-side guard: check order status and dispute status before calling the RPC.
        // The release_escrow RPC also enforces this server-side.
        const { data: order } = await supabase.from('orders').select('status').eq('id', orderId).single();
        if (!order) {
            throw new Error("Order not found.");
        }
        if (order.status === 'Disputed') {
            throw new Error("This order is under dispute and cannot be confirmed. Only the Admin can release or refund the escrow funds.");
        }
        if (order.status === 'Refunded') {
            throw new Error("This order has already been refunded by Admin. Funds cannot be released to seller.");
        }
        if (order.status === 'Completed') {
            throw new Error("This order has already been completed. Funds have already been released.");
        }

        // Additional check: verify no active dispute exists
        const { data: dispute } = await supabase.from('disputes_detailed').select('status').eq('order_id', orderId).single();
        if (dispute && (dispute.status === 'Pending' || dispute.status === 'Reviewing' || dispute.status === 'Need More Info')) {
            throw new Error("This order has an active dispute. Only Admin can resolve it.");
        }
        // Also block if dispute was resolved (Refunded/Released) — escrow already moved
        if (dispute && (dispute.status === 'Refunded' || dispute.status === 'Released')) {
            throw new Error("This dispute has already been resolved by Admin. No further action is possible.");
        }

        // Final defense-in-depth: verify escrow is still 'Held' before calling the RPC.
        // This catches any edge case where admin acted but order status wasn't updated yet.
        const { data: escrow } = await supabase.from('escrow_balances').select('status').eq('order_id', orderId).single();
        if (!escrow || escrow.status !== 'Held') {
            throw new Error(`Escrow funds have already been ${escrow?.status?.toLowerCase() || 'processed'}. Cannot confirm order.`);
        }

        await supabase.rpc('release_escrow', { order_uuid: orderId });
    },

    disputeOrder: async (orderId: string, claims: string, photos: string[]) => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error("Not authenticated");

        await supabase.from('disputes_detailed').insert({
            order_id: orderId,
            user_id: user.id,
            claims,
            evidence_photos: photos
        });

        await supabase.from('orders').update({ status: 'Disputed' }).eq('id', orderId);
    },

    getDisputeByOrderId: async (orderId: string): Promise<DetailedDispute | null> => {
        const { data } = await supabase.from('disputes_detailed').select('*').eq('order_id', orderId).single();
        if (!data) return null;
        return {
            id: data.id,
            orderId: data.order_id,
            userId: data.user_id,
            claims: data.claims,
            evidencePhotos: data.evidence_photos,
            timestamp: data.created_at,
            status: data.status
        };
    },

    cancelDispute: async (orderId: string) => {
        await supabase.from('disputes_detailed').delete().eq('order_id', orderId);
        await supabase.from('orders').update({ status: 'Shipped' }).eq('id', orderId);
    },

    refundBuyer: async (orderId: string) => {
        await fetchWithAuth('/admin/refund', {
            method: 'POST',
            body: JSON.stringify({ orderId })
        });
        // disputes_detailed status is now updated server-side in /api/admin/refund
    },

    releaseToSeller: async (orderId: string) => {
        await fetchWithAuth('/admin/release', {
            method: 'POST',
            body: JSON.stringify({ orderId })
        });
        // Dispute status is updated by the backend, no additional client call needed
    },

    needMoreInfo: async (orderId: string) => {
        await fetchWithAuth('/admin/needmoreinfo', {
            method: 'POST',
            body: JSON.stringify({ orderId })
        });
        // Escrow and dispute status remain unchanged (Pending) – handled server-side
    },

    fundWallet: async (amount: number, method: string, phone?: string) => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error("Not authenticated");

        if (method === 'M-Pesa') {
            if (!phone) throw new Error("Phone number is required for M-Pesa");
            const res = await fetchWithAuth('/mpesa/stkpush', {
                method: 'POST',
                body: JSON.stringify({ amount, phone })
            });
            // Return the checkoutRequestId so the UI can poll for confirmation
            return {
                newBalance: undefined,
                isPending: true,
                message: res.message,
                checkoutRequestId: res.checkoutRequestId
            };
        }

        // Direct Supabase credit (for demo/test mode)
        const { data: newBalance, error } = await supabase.rpc('fund_wallet', {
            user_uuid: user.id,
            amount,
            reference: null
        });
        if (error) throw error;
        return { newBalance, isPending: false, checkoutRequestId: null };
    },

    withdrawWallet: async (amount: number, method: string, details: string) => {
        const res = await fetchWithAuth('/wallet/withdraw', {
            method: 'POST',
            body: JSON.stringify({ amount, method, details })
        });
        return res;
    },

    // Poll Safaricom to confirm STK payment status and auto-credit wallet if confirmed.
    // Call this every ~3s after initiating STK push until status is 'completed' or 'failed'.
    queryMpesaTransaction: async (checkoutRequestId: string): Promise<{
        status: 'pending' | 'completed' | 'failed' | 'cancelled';
        message?: string;
    }> => {
        try {
            const res = await fetchWithAuth('/mpesa/query', {
                method: 'POST',
                body: JSON.stringify({ checkoutRequestId })
            });
            return { status: res.status || 'pending', message: res.message };
        } catch (e: any) {
            return { status: 'pending', message: e.message };
        }
    },





    getBookmarks: async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return [];
        const { data } = await supabase.from('bookmarks').select('product:products(*)').eq('user_id', user.id);
        return (data || []).map((b: any) => mapProduct(b.product)) as Product[];
    },

    getFollowing: async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return [];
        const { data } = await supabase.from('user_follows').select('profile:profiles!following_id(*)').eq('follower_id', user.id);
        return (data || []).map((f: any) => f.profile) as User[];
    },

    getFollowers: async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return [];
        const { data } = await supabase.from('user_follows').select('profile:profiles!follower_id(*)').eq('following_id', user.id);
        return (data || []).map((f: any) => f.profile) as User[];
    },

    getAdminData: async () => {
        const { data: reports } = await supabase.from('reports').select('*, post:posts(content, user_id)');
        const { data: disputes } = await supabase.from('disputes_detailed').select(`
            *,
            order:orders(
                buyer_id, seller_id, created_at,
                buyer:profiles!buyer_id(name, handle, email, mobile),
                seller:profiles!seller_id(name, handle, email, mobile),
                order_items(quantity, product:products(name))
            )
        `);
        const { data: appSettings } = await supabase.from('app_settings').select('*').eq('id', 1).single();
        const { data: boostedProducts } = await supabase.from('boosted_products').select('*, user:profiles!boosted_products_user_id_fkey(*)');
        return {
            reports: (reports || []).map((r: any) => ({
                id: r.id,
                postId: r.post_id,
                reporterId: r.reporter_id,
                reason: r.reason,
                timestamp: r.created_at,
                postContent: r.post?.content || 'Content no longer available',
                postAuthorId: r.post?.user_id
            })) as PostReport[],
            disputes: (disputes || []).map((d: any) => ({
                id: d.id,
                orderId: d.order_id,
                userId: d.user_id,
                claims: d.claims,
                evidencePhotos: d.evidence_photos,
                timestamp: d.created_at,
                status: d.status,
                buyer: d.order?.buyer,
                seller: d.order?.seller,
                purchaseDate: d.order?.created_at,
                productDetails: d.order?.order_items?.map((item: any) => `${item.product?.name || 'Unknown Item'} (Qty: ${item.quantity})`).join(', ')
            })) as DetailedDispute[],
            zahidiBalance: appSettings?.zahidi_balance || 0,
            ppcCost: appSettings?.ppc_cost || 15,
            adsEnabled: appSettings?.ads_enabled ?? true,
            boostedProducts: (boostedProducts || []).map((b: any) => ({
                id: b.id,
                productId: b.product_id,
                sellerName: b.user?.name || 'Unknown',
                sellerCountry: b.user?.country || 'Unknown',
                clicks: b.number_of_clicks,
                deducted: b.amount_deducted,
                status: b.status
            }))
        };
    },

    updatePPCCost: async (cost: number) => {
        const { error } = await supabase.from('app_settings').update({ ppc_cost: cost }).eq('id', 1);
        if (error) throw error;
    },

    updateAdsEnabled: async (enabled: boolean) => {
        const { error } = await supabase.from('app_settings').update({ ads_enabled: enabled }).eq('id', 1);
        if (error) throw error;
    },

    getDiscovery: async () => {
        const { data: { user } } = await supabase.auth.getUser();
        let myLocation = '';
        if (user) {
            const { data: me } = await supabase.from('profiles').select('location').eq('id', user.id).single();
            myLocation = me?.location || '';
        }

        const { data: boosted } = await supabase.from('boosted_products').select('product_id').eq('status', 'active');
        const boostedIds = (boosted || []).map((b: any) => b.product_id);

        const { data } = await supabase.from('posts').select(`*, user:profiles!user_id(*), product:products!product_id(*)`).limit(30);
        if (!data) return [];

        let allPosts = [...data];

        allPosts.sort((a, b) => {
            const aBoosted = boostedIds.includes(a.product_id);
            const bBoosted = boostedIds.includes(b.product_id);
            if (aBoosted && !bBoosted) return -1;
            if (!aBoosted && bBoosted) return 1;

            if (myLocation) {
               const aLocMatch = (a.user?.location || '').toLowerCase() === myLocation.toLowerCase();
               const bLocMatch = (b.user?.location || '').toLowerCase() === myLocation.toLowerCase();
               if (aLocMatch && !bLocMatch) return -1;
               if (!aLocMatch && bLocMatch) return 1;
            }
            return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        });

        return allPosts.slice(0, 10).map((p: any) => ({ 
            ...p,
            id: `disc-${p.id}`,
            product: {
                ...mapProduct(p.product),
                isSponsored: boostedIds.includes(p.product_id)
            }
        }));
    },

    getRecommendations: async (productId: string): Promise<Post[]> => {
        try {
            const res = await fetchWithAuth('/recommendations', { method: 'POST', body: JSON.stringify({ productId }) });
            if (res.posts && res.posts.length > 0) return res.posts;
            return await api.getDiscovery();
        } catch {
            return await api.getDiscovery();
        }
    },

    getComments: async (productId: string): Promise<Comment[]> => {
        const { data: comments, error } = await supabase
            .from('comments')
            .select(`
                *,
                user:profiles!user_id(*),
                reactions:comment_reactions(emoji, user_id)
            `)
            .eq('product_id', productId)
            .order('created_at', { ascending: true });

        if (error) {
            console.error("Error fetching comments:", error);
            return [];
        }

        const commentMap = new Map<string, Comment>();
        const roots: Comment[] = [];

        comments.forEach((c: any) => {
            const reactionMap = new Map<string, Reaction>();
            if (c.reactions) {
                c.reactions.forEach((r: any) => {
                    if (!reactionMap.has(r.emoji)) {
                        reactionMap.set(r.emoji, { emoji: r.emoji, count: 0, userIds: [] });
                    }
                    const reaction = reactionMap.get(r.emoji)!;
                    reaction.count++;
                    reaction.userIds.push(r.user_id);
                });
            }

            const formattedComment: Comment = {
                id: c.id,
                user: {
                    id: c.user.id,
                    name: c.user.name,
                    handle: c.user.handle,
                    avatar: c.user.avatar,
                    isOnline: false
                },
                content: c.content,
                timestamp: new Date(c.created_at).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' }),
                replies: [],
                reactions: Array.from(reactionMap.values()),
                image: c.image_url
            };

            commentMap.set(c.id, formattedComment);
        });

        comments.forEach((c: any) => {
            const current = commentMap.get(c.id);
            if (current) {
                if (c.parent_id && commentMap.has(c.parent_id)) {
                    const parent = commentMap.get(c.parent_id);
                    parent?.replies.push(current);
                } else {
                    roots.push(current);
                }
            }
        });

        return roots;
    },

    addComment: async (productId: string, content: string, parentId: string | null, image?: string) => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error("Not authenticated");

        let imageUrl = null;
        if (image) {
            const res = await fetch(image);
            const blob = await res.blob();
            const fileName = `comment-${Date.now()}-${Math.random().toString(36).substring(7)}.jpg`;
            const { error: uploadError } = await supabase.storage.from('products').upload(fileName, blob);
            if (!uploadError) {
                const { data: { publicUrl } } = supabase.storage.from('products').getPublicUrl(fileName);
                imageUrl = publicUrl;
            }
        }

        const { data, error } = await supabase.from('comments').insert({
            product_id: productId,
            user_id: user.id,
            content,
            parent_id: parentId,
            image_url: imageUrl
        }).select(`
            *,
            user:profiles!user_id(*)
        `).single();

        if (error) throw error;

        return {
            id: data.id,
            user: {
                id: data.user.id,
                name: data.user.name,
                handle: data.user.handle,
                avatar: data.user.avatar
            },
            content: data.content,
            timestamp: new Date(data.created_at).toLocaleString(),
            replies: [],
            reactions: [],
            image: data.image_url
        } as Comment;
    },

    addCommentReaction: async (productId: string, commentId: string, emoji: string) => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error("Not authenticated");

        const { data: existing } = await supabase.from('comment_reactions')
            .select('*')
            .eq('comment_id', commentId)
            .eq('user_id', user.id)
            .eq('emoji', emoji)
            .single();

        if (existing) {
            await supabase.from('comment_reactions').delete()
                .eq('comment_id', commentId)
                .eq('user_id', user.id)
                .eq('emoji', emoji);
            return { action: 'removed' };
        } else {
            await supabase.from('comment_reactions').insert({
                comment_id: commentId,
                user_id: user.id,
                emoji
            });
            return { action: 'added' };
        }
    },

    toggleFollowUser: async (targetId: string) => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error("Not authenticated");

        const { data: existing } = await supabase.from('user_follows')
            .select('*')
            .eq('follower_id', user.id)
            .eq('following_id', targetId)
            .maybeSingle();

        let result;
        if (existing) {
            await supabase.from('user_follows').delete().eq('follower_id', user.id).eq('following_id', targetId);
            // Count directly from junction table (always accurate, persists on reload)
            const { count: newFollowers } = await supabase.from('user_follows').select('*', { count: 'exact', head: true }).eq('following_id', targetId);
            const { count: newFollowing } = await supabase.from('user_follows').select('*', { count: 'exact', head: true }).eq('follower_id', user.id);
            // Persist counts to profiles for consistency
            await Promise.all([
                supabase.from('profiles').update({ followers_count: newFollowers || 0 }).eq('id', targetId),
                supabase.from('profiles').update({ following_count: newFollowing || 0 }).eq('id', user.id)
            ]);
            result = { isFollowing: false, followers: newFollowers || 0 };
        } else {
            await supabase.from('user_follows').insert({ follower_id: user.id, following_id: targetId });
            // Count directly from junction table (always accurate, persists on reload)
            const { count: newFollowers } = await supabase.from('user_follows').select('*', { count: 'exact', head: true }).eq('following_id', targetId);
            const { count: newFollowing } = await supabase.from('user_follows').select('*', { count: 'exact', head: true }).eq('follower_id', user.id);
            // Persist counts to profiles for consistency
            await Promise.all([
                supabase.from('profiles').update({ followers_count: newFollowers || 0 }).eq('id', targetId),
                supabase.from('profiles').update({ following_count: newFollowing || 0 }).eq('id', user.id)
            ]);
            result = { isFollowing: true, followers: newFollowers || 1 };
        }

        window.dispatchEvent(new CustomEvent('user-follow-changed', {
            detail: { userId: targetId, ...result }
        }));

        return result;
    },

    getIsFollowedByUser: async (targetId: string) => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return false;
        const { data } = await supabase.from('user_follows').select('follower_id').eq('follower_id', targetId).eq('following_id', user.id).maybeSingle();
        return !!data;
    },

    getIsFollowingUser: async (targetId: string) => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return false;
        const { data } = await supabase.from('user_follows').select('follower_id').eq('follower_id', user.id).eq('following_id', targetId).maybeSingle();
        return !!data;
    },

    getUserStats: async (userId: string) => {
        const [products, vrooms, followers] = await Promise.all([
            supabase.from('products').select('*', { count: 'exact', head: true }).eq('owner_id', userId),
            supabase.from('vrooms').select('*', { count: 'exact', head: true }).eq('owner_id', userId),
            supabase.from('user_follows').select('*', { count: 'exact', head: true }).eq('following_id', userId)
        ]);

        return {
            products: products.count || 0,
            vrooms: vrooms.count || 0,
            followers: followers.count || 0
        };
    },

    // ---- System Messaging ----

    /**
     * Sends an automated system message into a conversation (e.g. order notification).
     * Skips the real-time upload plumbing — just writes a message with is_system = true.
     */
    sendSystemMessage: async (conversationId: string, content: string, visibleTo?: string) => {
        const { error } = await supabase.from('messages').insert({
            conversation_id: conversationId,
            sender_id: null,
            content,
            is_system: true,
            ...(visibleTo ? { visible_to: visibleTo } : {})
        });
        if (error) console.error('System message failed', error);

        // Bump conversation's last_message_at
        await supabase.from('conversations')
            .update({ last_message_at: new Date().toISOString() })
            .eq('id', conversationId);
    },

    /**
     * Sends a message to a user directly from the Elddady Admin account.
     */
    sendAdminSystemMessage: async (targetUserId: string, content: string) => {
        try {
            await fetchWithAuth('/admin/system-message', {
                method: 'POST',
                body: JSON.stringify({ targetUserId, content })
            });
        } catch (e) {
            console.error('Failed to send admin system message', e);
        }
    },

    /**
     * After checkout, notify each seller via the newly implemented admin system messaging.
     */
    notifySellerOnCheckout: async (items: CartItem[], buyerName: string) => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        // Group items by seller
        const itemsBySeller: Record<string, CartItem[]> = {};
        for (const item of items) {
            if (!item.userId) continue;
            if (!itemsBySeller[item.userId]) itemsBySeller[item.userId] = [];
            itemsBySeller[item.userId].push(item);
        }

        for (const [sellerId, sellerItems] of Object.entries(itemsBySeller)) {
            // Skip if buyer === seller
            if (sellerId === user.id) continue;
            try {
                const itemSummary = sellerItems
                    .map(i => `• ${i.quantity}x ${i.name}`)
                    .join('\n');

                const msg = `🛍️ NEW ORDER from ${buyerName}\n\n${itemSummary}\n\nPlease prepare and ship the item(s) as soon as possible. Payment is held in escrow until the buyer confirms delivery.`;

                // Uses the new server-side endpoint that ensures it strictly comes from @elddadinc
                await api.sendAdminSystemMessage(sellerId, msg);
            } catch (e) {
                console.error('Failed to notify seller', sellerId, e);
            }
        }
    },

    /**
     * Delete a flagged post and move it to the archive via backend endpoint
     */
    deletePost: async (postId: string) => {
        try {
            await fetchWithAuth('/admin/delete-post', {
                method: 'POST',
                body: JSON.stringify({ postId })
            });
        } catch (e) {
            console.error('Failed to delete post', e);
            throw e;
        }
    },

    /**
     * Freeze/ban a user from the platform
     */
    freezeUser: async (targetUserId: string) => {
        try {
            await fetchWithAuth('/admin/ban-user', {
                method: 'POST',
                body: JSON.stringify({ targetUserId })
            });
        } catch (e) {
            console.error('Failed to freeze user', e);
            throw e;
        }
    }
};

