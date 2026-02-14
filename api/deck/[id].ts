import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase } from '../_lib/supabase';
import { parseDeckList } from '../_lib/parser';
import { getCardsMetadata, findBestMatch } from '../_lib/card-service';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    const id = parseInt(req.query.id as string);

    if (isNaN(id)) {
        return res.status(400).json({ error: 'Invalid deck ID' });
    }

    // Helper to map deck to valid response format
    const mapDeck = (deck: any) => ({
        ...deck,
        createdAt: deck.created_at,
        totalCards: deck.total_cards,
        rawList: deck.raw_list,
        cards: deck.cards ? deck.cards.map((c: any) => ({
            ...c,
            deckId: c.deck_id,
            cardName: c.card_name,
            cardType: c.card_type,
            imageUrl: c.image_url,
            customTags: c.custom_tags,
        })) : []
    });

    // GET — retrieve a single deck
    if (req.method === 'GET') {
        const { data: deck, error } = await supabase
            .from('decks')
            .select('*, cards:deck_cards(*)')
            .eq('id', id)
            .order('id', { foreignTable: 'cards', ascending: true })
            .single();

        if (error || !deck) {
            return res.status(404).json({ error: 'Deck not found' });
        }

        return res.status(200).json(mapDeck(deck));
    }

    // PUT — update a deck
    if (req.method === 'PUT') {
        // Check if deck exists
        const { data: existingDeck, error: fetchError } = await supabase
            .from('decks')
            .select('id, name')
            .eq('id', id)
            .single();

        if (fetchError || !existingDeck) {
            return res.status(404).json({ error: 'Deck not found' });
        }

        const { main_list = '', extra_list = '', side_list = '', name } = req.body;

        if (!main_list && !extra_list && !side_list && !name) {
            // If nothing to update, just return current deck
            // But usually PUT requires full resource or at least some body.
            // If body is empty, we might error or just return.
            // Assuming parsed lists are required if provided.
        }

        const allCards = [
            ...parseDeckList(main_list, 'MAIN'),
            ...parseDeckList(extra_list, 'EXTRA'),
            ...parseDeckList(side_list, 'SIDE'),
        ];

        const totalCount = allCards.reduce((acc, c) => acc + c.quantity, 0);

        // Fetch metadata if lists changed
        let metadata: any = {};
        if (allCards.length > 0) {
            const cardNames = allCards.map((c) => c.name);
            metadata = await getCardsMetadata(cardNames);
        }

        // Update deck info
        const { error: updateError } = await supabase
            .from('decks')
            .update({
                name: name || existingDeck.name,
                raw_list: main_list || undefined,
                total_cards: totalCount > 0 ? totalCount : undefined, // Only update if re-parsed
            })
            .eq('id', id);

        if (updateError) {
            return res.status(500).json({ error: 'Failed to update deck info' });
        }

        // If lists were provided, rebuild cards
        if (allCards.length > 0) {
            // Delete old cards
            await supabase.from('deck_cards').delete().eq('deck_id', id);

            const cardsToInsert = [];
            for (const cardData of allCards) {
                let meta = metadata[cardData.name.toLowerCase()];
                let cardName = cardData.name;

                if (!meta) {
                    const fuzzy = await findBestMatch(cardData.name);
                    if (fuzzy) {
                        meta = {
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
                    deck_id: id,
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

            if (cardsToInsert.length > 0) {
                await supabase.from('deck_cards').insert(cardsToInsert);
            }
        }

        // Fetch updated deck
        const { data: updatedDeck, error: finalFetchError } = await supabase
            .from('decks')
            .select('*, cards:deck_cards(*)')
            .eq('id', id)
            .order('id', { foreignTable: 'cards', ascending: true })
            .single();

        if (finalFetchError) {
            return res.status(500).json({ error: 'Failed to fetch updated deck' });
        }

        return res.status(200).json(mapDeck(updatedDeck));
    }

    // DELETE
    if (req.method === 'DELETE') {
        const { error } = await supabase.from('decks').delete().eq('id', id);
        if (error) {
            return res.status(500).json({ error: 'Failed to delete deck' });
        }
        return res.status(204).end();
    }

    return res.status(405).json({ error: 'Method not allowed' });
}
