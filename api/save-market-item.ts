import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase } from './_lib/supabase';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const {
        type,
        card_name,
        price,
        condition,
        rarity,
        location,
        image_url,
        user_id
    } = req.body;

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

    if (error) {
        return res.status(500).json({ error: error.message });
    }

    res.status(201).json(data);
}
