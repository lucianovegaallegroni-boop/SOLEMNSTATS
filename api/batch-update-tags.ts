import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase as supabaseClient } from './_lib/supabase';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { deckId, cardName, tags, userId } = req.body;

    if (!deckId || !cardName || !Array.isArray(tags)) {
        return res.status(400).json({ error: 'Invalid request body. Required: deckId, cardName, tags[]' });
    }

    // Security Check
    const { data: deckData, error: deckError } = await supabaseClient
        .from('decks')
        .select('user_id')
        .eq('id', deckId)
        .single();

    if (deckError || !deckData) {
        return res.status(404).json({ error: 'Deck not found' });
    }

    if (deckData.user_id && deckData.user_id !== userId) {
        return res.status(403).json({ error: 'You do not have permission to edit this deck.' });
    }

    // 1. Find all cards in this deck with this name
    const { data: cards, error: fetchError } = await supabaseClient
        .from('deck_cards')
        .select('id')
        .eq('deck_id', deckId)
        .ilike('card_name', cardName); // Case-insensitive match

    if (fetchError) {
        console.error('Error fetching cards:', fetchError);
        return res.status(500).json({ error: 'Failed to find matching cards' });
    }

    if (!cards || cards.length === 0) {
        return res.status(404).json({ error: 'No matching cards found in deck' });
    }

    const cardIds = (cards as { id: number }[]).map(c => c.id);

    // 2. Update all of them
    const { error: updateError } = await supabaseClient
        .from('deck_cards')
        .update({ custom_tags: JSON.stringify(tags) })
        .in('id', cardIds);

    if (updateError) {
        console.error('Error updating tags:', updateError);
        return res.status(500).json({ error: 'Failed to update tags' });
    }

    res.status(200).json({
        status: 'Tags updated',
        count: cardIds.length,
        updatedIds: cardIds,
        tags
    });
}
