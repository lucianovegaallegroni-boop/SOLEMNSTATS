import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase } from './_lib/supabase';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    // GET: List market items (from list-market.ts)
    if (req.method === 'GET') {
        const { type } = req.query;
        // 1. Fetch listings
        const query = supabase
            .from('market_listings')
            .select('*')
            .order('created_at', { ascending: false });

        if (type) {
            query.eq('type', type);
        }

        const { data: listings, error } = await query;
        if (error) {
            console.error('Supabase Market Fetch Error (Listings):', error);
            return res.status(500).json({ error: error.message, details: error });
        }

        if (!listings || listings.length === 0) {
            return res.status(200).json([]);
        }

        // 2. Fetch profiles for these listings
        const userIds = [...new Set(listings.map(l => l.user_id).filter(Boolean))];

        let profilesMap: Record<string, any> = {};
        if (userIds.length > 0) {
            const { data: profiles, error: profilesError } = await supabase
                .from('profiles')
                .select('id, full_name, phone_number')
                .in('id', userIds);

            if (profilesError) {
                console.error('Supabase Market Fetch Error (Profiles):', profilesError);
                // Continue without profiles if this fails, rather than crashing
            } else {
                profiles?.forEach(p => {
                    profilesMap[p.id] = p;
                });
            }
        }

        // 3. Map and merge
        const mappedListings = listings.map(item => {
            const profile = profilesMap[item.user_id];
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
                imageUrl: item.image_url, // Backward compatibility
                images: item.images || (item.image_url ? [item.image_url] : []), // New field
                description: item.description, // New field
                condition: item.condition,
                postedAt: formatDate(item.created_at)
            };
        });

        return res.status(200).json(mappedListings);
    }

    // POST: Save market item (from save-market-item.ts)
    if (req.method === 'POST') {
        const { type, card_name, price, condition, rarity, location, image_url, images, description, user_id } = req.body;

        // Validation: For 'sell', price is required. For 'buy', price is optional (can be 0 or null).
        if (!card_name || !type || !user_id) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        // Ensure images is an array
        const imagesArray = Array.isArray(images) ? images : (image_url ? [image_url] : []);
        // Main image for backward compatibility
        const mainImage = image_url || (imagesArray.length > 0 ? imagesArray[0] : null);

        const { data, error } = await supabase
            .from('market_listings')
            .insert({
                type,
                card_name,
                price: parseFloat(price) || 0,
                condition,
                rarity,
                location,
                image_url: mainImage,
                images: imagesArray,
                description,
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
