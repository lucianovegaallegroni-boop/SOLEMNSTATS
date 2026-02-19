import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase } from './_lib/supabase';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { name, card_names } = req.body;

    if (!name || !Array.isArray(card_names)) {
        return res.status(400).json({ error: 'Missing name or card_names array' });
    }

    try {
        const { data, error } = await supabase
            .from('archetype_configs')
            .upsert({ name, card_names, updated_at: new Date() }, { onConflict: 'name' })
            .select();

        if (error) throw error;

        res.status(200).json({ success: true, data });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
}
