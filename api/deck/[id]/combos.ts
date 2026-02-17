import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase } from '../../_lib/supabase';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    const deckId = parseInt(req.query.id as string);

    if (isNaN(deckId)) {
        return res.status(400).json({ error: 'Invalid deck ID' });
    }

    // GET: List all combos for the deck
    if (req.method === 'GET') {
        const { data, error } = await supabase
            .from('deck_combos')
            .select('*')
            .eq('deck_id', deckId)
            .order('created_at', { ascending: false });

        if (error) {
            return res.status(500).json({ error: error.message });
        }

        return res.status(200).json(data);
    }

    // POST: Create or Update a combo
    if (req.method === 'POST') {
        console.log('Combo POST body:', req.body);
        const { id: comboId, name, steps, probability } = req.body;

        if (!name || !steps || probability === undefined) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        const upsertData: any = {
            deck_id: deckId,
            name,
            steps, // JSONB
            probability
        };

        if (comboId) {
            upsertData.id = comboId;
        }

        const { data, error } = await supabase
            .from('deck_combos')
            .upsert([upsertData], { onConflict: 'id' })
            .select()
            .single();

        if (error) {
            return res.status(500).json({ error: error.message });
        }

        return res.status(201).json(data);
    }

    // DELETE: Remove a combo
    if (req.method === 'DELETE') {
        const comboId = req.body.comboId || req.query.comboId;

        if (!comboId) {
            return res.status(400).json({ error: 'Missing combo ID' });
        }

        const { error } = await supabase
            .from('deck_combos')
            .delete()
            .eq('id', comboId)
            .eq('deck_id', deckId); // Security check

        if (error) {
            return res.status(500).json({ error: error.message });
        }

        return res.status(200).json({ success: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
}
