import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase } from '../_lib/supabase';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const id = parseInt(req.query.id as string);

    if (isNaN(id)) {
        return res.status(400).json({ error: 'Invalid card ID' });
    }

    const { data: card, error: fetchError } = await supabase
        .from('deck_cards')
        .select('id')
        .eq('id', id)
        .single();

    if (fetchError || !card) {
        return res.status(404).json({ error: 'Card not found' });
    }

    const { tags } = req.body;

    if (!Array.isArray(tags)) {
        return res.status(400).json({ error: 'Invalid tags format' });
    }

    const { error: updateError } = await supabase
        .from('deck_cards')
        .update({ custom_tags: JSON.stringify(tags) })
        .eq('id', id);

    if (updateError) {
        return res.status(500).json({ error: 'Failed to update tags' });
    }

    res.status(200).json({ status: 'Tags updated', tags });
}
