import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase, getSupabase } from './_lib/supabase';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    const supabaseClient = getSupabase(req);

    if (req.method === 'GET') {
        const { data, error } = await supabase
            .from('players')
            .select('*');

        if (error) return res.status(500).json({ error: error.message });
        return res.status(200).json(data);
    }

    if (req.method === 'POST') {
        const { name, cardNames, card_names } = req.body;
        const names = Array.isArray(cardNames) ? cardNames : (Array.isArray(card_names) ? card_names : []);

        if (!name) return res.status(400).json({ error: 'Missing player name' });

        const { data, error } = await supabaseClient
            .from('players')
            .upsert({
                name,
                card_names: names
            }, { onConflict: 'name' })
            .select()
            .single();

        if (error) return res.status(500).json({ error: error.message });
        return res.status(200).json(data);
    }

    return res.status(405).json({ error: 'Method not allowed' });
}
