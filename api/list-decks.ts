import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase } from './_lib/supabase';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { data: decks, error } = await supabase
        .from('decks')
        .select(`
            *,
            cards:deck_cards(*)
        `)
        .order('created_at', { ascending: false })
        .order('id', { foreignTable: 'cards', ascending: true });

    if (error) {
        return res.status(500).json({ error: error.message });
    }

    // Map fields to match previous Prisma output if necessary (Prisma used camelCase, Supabase uses snake_case)
    // However, the frontend might expect camelCase. I should probably run a mapper or update frontend.
    // Given the task is to migrate backend, ideally I should keep response format same.
    // Prisma: createdAt, totalCards
    // Supabase: created_at, total_cards

    // I will map the response to camelCase to ensure frontend compatibility
    const mappedDecks = decks?.map(deck => ({
        ...deck,
        createdAt: deck.created_at,
        totalCards: deck.total_cards,
        rawList: deck.raw_list,
        cards: deck.cards.map((c: any) => ({
            ...c,
            deckId: c.deck_id,
            cardName: c.card_name,
            cardType: c.card_type,
            imageUrl: c.image_url,
            customTags: c.custom_tags,
        }))
    }));

    res.status(200).json(mappedDecks);
}
