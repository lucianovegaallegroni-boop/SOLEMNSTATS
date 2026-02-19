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
        coverImageUrl: deck.cover_image_url,
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
            .select('id, name, user_id')
            .eq('id', id)
            .single();

        if (fetchError || !existingDeck) {
            return res.status(404).json({ error: 'Deck not found' });
        }

        const { main_list = '', extra_list = '', side_list = '', name, user_id, cover_image_url } = req.body || {};

        // Security Check: If the deck belongs to a user, ensuring the requester is that user
        if (existingDeck.user_id && existingDeck.user_id !== user_id) {
            return res.status(403).json({ error: 'You do not have permission to edit this deck.' });
        }

        if (!main_list && !extra_list && !side_list && !name && !cover_image_url) {
            // If nothing to update, just return current deck
            // But usually PUT requires full resource or at least some body.
            // If body is empty, we might error or just return.
            // Assuming parsed lists are required if provided.
        }

        let totalCount = 0;
        let allCards: any[] = [];

        // Only re-parse if lists are provided
        if (main_list || extra_list || side_list) {
            allCards = [
                ...parseDeckList(main_list || '', 'MAIN'),
                ...parseDeckList(extra_list || '', 'EXTRA'),
                ...parseDeckList(side_list || '', 'SIDE'),
            ];
            totalCount = allCards.reduce((acc, c) => acc + c.quantity, 0);
        }

        // Fetch metadata if lists changed
        let metadata: any = {};
        if (allCards.length > 0) {
            const cardNames = allCards.map((c) => c.name);
            metadata = await getCardsMetadata(cardNames);
        }

        // Update deck info
        const updatePayload: any = {
            name: name || existingDeck.name,
        };

        if (main_list || extra_list || side_list) {
            updatePayload.raw_list = main_list; // This logic might be slightly flawed if only extra/side provided, but assuming main is primary. 
            // Ideally we should store all 3 raw lists or composite them. 
            // Current DB likely just has one 'raw_list' text field? 
            // Checked `api/save-deck.ts` -> it saves `currRawList` which seems to be just main list or concatenated?
            // `api/save-deck.ts` line 84: `raw_list: mainListStr` -> seemingly only main list is saved as raw_list.
            // So we'll keep that behavior for now.
            if (main_list) updatePayload.raw_list = main_list;
        }

        if (totalCount > 0) {
            updatePayload.total_cards = totalCount;
        }

        if (cover_image_url) {
            updatePayload.cover_image_url = cover_image_url;
        }

        const { error: updateError } = await supabase
            .from('decks')
            .update(updatePayload)
            .eq('id', id);

        if (updateError) {
            console.error('Update deck error:', updateError);
            // Debug logging to file
            const fs = require('fs');
            fs.appendFileSync('debug.log', JSON.stringify({
                timestamp: new Date().toISOString(),
                payload: updatePayload,
                error: updateError
            }, null, 2) + '\n');

            return res.status(500).json({
                error: 'Failed to update deck info',
                details: JSON.stringify(updateError)
            });
        }

        // If lists were provided, rebuild cards
        if (allCards.length > 0) {
            // 1. Fetch current cards to cache their metadata (images, types, etc.)
            const { data: currentCards } = await supabase
                .from('deck_cards')
                .select('card_name, card_type, image_url, attribute, level, atk, defense')
                .eq('deck_id', id);

            // Create a map of "normalized_name" -> metadata
            const existingMetaMap = new Map();
            if (currentCards) {
                currentCards.forEach((c: any) => {
                    if (c.card_name) {
                        existingMetaMap.set(c.card_name.toLowerCase(), c);
                    }
                });
            }

            // 2. Delete old cards
            await supabase.from('deck_cards').delete().eq('deck_id', id);

            const cardsToInsert = [];
            for (const cardData of allCards) {
                const lowerName = cardData.name.toLowerCase();

                // Priority 1: Use metadata from the batch fetch (if it was a new card that we fetched)
                let meta = metadata[lowerName];
                let cardName = cardData.name;

                // Priority 2: Use existing metadata from the DB (preserves images if API fails)
                if (!meta && existingMetaMap.has(lowerName)) {
                    const existing = existingMetaMap.get(lowerName);
                    meta = {
                        type: existing.card_type,
                        image_url: existing.image_url,
                        attribute: existing.attribute,
                        level: existing.level,
                        atk: existing.atk,
                        def: existing.defense // Note: DB column is 'defense', standard object is 'def'
                    };
                    cardName = existing.card_name || cardData.name;
                }

                // Priority 3: Fuzzy search fallback (slow, last resort)
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
