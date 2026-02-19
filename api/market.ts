import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase } from './_lib/supabase';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    // GET: List market items (from list-market.ts)
    if (req.method === 'GET') {
        const { type } = req.query;
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
        if (error) return res.status(500).json({ error: error.message });

        const mappedListings = listings?.map(item => {
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

        return res.status(200).json(mappedListings);
    }

    // POST: Save market item (from save-market-item.ts)
    if (req.method === 'POST') {
        const { type, card_name, price, condition, rarity, location, image_url, user_id } = req.body;
        if (!card_name || !price || !type || !user_id) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        const { data, error } = await supabase
            .from('market_listings')
            .insert({
                type,
                card_name,
                price: parseFloat(price),
                condition,
                rarity,
                location,
                image_url,
                user_id
            })
            .select()
            .single();

        if (error) return res.status(500).json({ error: error.message });
        return res.status(201).json(data);
    }

    // DELETE: Remove market item (from delete-market-item.ts)
    if (req.method === 'DELETE') {
        const { id, user_id } = req.query;
        if (!id || !user_id) {
            return res.status(400).json({ error: 'Missing required parameters (id, user_id)' });
        }

        const { data, error } = await supabase
            .from('market_listings')
            .delete()
            .eq('id', id)
            .eq('user_id', user_id)
            .select();

        if (error) return res.status(500).json({ error: error.message });
        if (!data || data.length === 0) {
            return res.status(404).json({ error: 'Listing not found or permission denied' });
        }
        return res.status(200).json({ message: 'Listing deleted successfully' });
    }

    return res.status(405).json({ error: 'Method not allowed' });
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
