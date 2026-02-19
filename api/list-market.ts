import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase } from './_lib/supabase';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { type } = req.query;

    // Build query with join to profiles
    const query = supabase
        .from('market_listings')
        .select(`
            *,
            profiles:user_id (
                full_name,
                phone_number
            )
        `)
        .order('created_at', { ascending: false });

    if (type) {
        query.eq('type', type);
    }

    const { data: listings, error } = await query;

    if (error) {
        console.error('Fetch listings error:', error);
        return res.status(500).json({ error: error.message });
    }

    const mappedListings = listings?.map(item => {
        // Handle potential array return for joins
        const profile = Array.isArray(item.profiles) ? item.profiles[0] : item.profiles;

        return {
            id: item.id,
            userId: item.user_id,
            type: item.type,
            cardName: item.card_name,
            price: item.price,
            currency: 'USD',
            rarity: item.rarity,
            sellerName: profile?.full_name || 'Member',
            sellerPhone: profile?.phone_number || '',
            location: item.location,
            imageUrl: item.image_url,
            condition: item.condition,
            postedAt: formatDate(item.created_at)
        };
    });

    res.status(200).json(mappedListings);
}

function formatDate(dateStr: string) {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
}
