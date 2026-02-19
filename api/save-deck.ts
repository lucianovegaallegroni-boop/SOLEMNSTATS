import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase } from './_lib/supabase';
import { parseDeckList } from './_lib/parser';
import { getCardsMetadata, findBestMatch } from './_lib/card-service';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { main_list = '', extra_list = '', side_list = '', name = 'My New Deck', user_id } = req.body;

    if (!main_list && !extra_list && !side_list) {
        return res.status(400).json({ error: 'No deck list provided' });
    }

    const allCards = [
        ...parseDeckList(main_list, 'MAIN'),
        ...parseDeckList(extra_list, 'EXTRA'),
        ...parseDeckList(side_list, 'SIDE'),
    ];

    const totalCount = allCards.reduce((acc, c) => acc + c.quantity, 0);

    // Fetch metadata from YGOPRODeck API
    const cardNames = allCards.map((c) => c.name);
    const metadata = await getCardsMetadata(cardNames);

    // Create deck
    const { data: deck, error: deckError } = await supabase
        .from('decks')
        .insert({
            name,
            raw_list: main_list,
            total_cards: totalCount,
            user_id: user_id || null, // Allow null for now if not provided, though ideally required
        })
        .select()
        .single();

    if (deckError || !deck) {
        return res.status(500).json({ error: deckError?.message || 'Failed to create deck' });
    }

    // Prepare cards with metadata
    const cardsToInsert = [];
    for (const cardData of allCards) {
        let meta = metadata[cardData.name.toLowerCase()];
        let cardName = cardData.name;

        if (!meta) {
            const fuzzy = await findBestMatch(cardData.name);
            if (fuzzy) {
                meta = {
                    id: fuzzy.id,
                    type: fuzzy.type,
                    image_url: fuzzy.image_url,
                    attribute: fuzzy.attribute,
                    level: fuzzy.level,
                    atk: fuzzy.atk,
                    def: fuzzy.def,
                };
                cardName = fuzzy.name;
            }
        }

        cardsToInsert.push({
            deck_id: deck.id,
            card_name: cardName,
            area: cardData.area,
            quantity: cardData.quantity,
            card_type: meta?.type || 'Unknown',
            image_url: meta?.image_url || '',
            attribute: meta?.attribute || '',
            level: meta?.level ?? null,
            atk: meta?.atk ?? null,
            defense: meta?.def ?? null,
        });
    }

    // Batch insert cards
    if (cardsToInsert.length > 0) {
        const { error: cardsError } = await supabase.from('deck_cards').insert(cardsToInsert);
        if (cardsError) {
            return res.status(500).json({ error: 'Failed to save deck cards: ' + cardsError.message });
        }
    }

    // Return the full deck with cards
    const { data: fullDeck, error: fetchError } = await supabase
        .from('decks')
        .select('*, deck_cards(*)')
        .eq('id', deck.id)
        .order('id', { foreignTable: 'deck_cards', ascending: true })
        .single();

    if (fetchError) {
        return res.status(500).json({ error: 'Failed to fetch created deck' });
    }

    res.status(201).json(fullDeck);
}
