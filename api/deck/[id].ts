import type { VercelRequest, VercelResponse } from '@vercel/node';
import { prisma } from '../_lib/db';
import { parseDeckList } from '../_lib/parser';
import { getCardsMetadata, findBestMatch } from '../_lib/card-service';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    const id = parseInt(req.query.id as string);

    if (isNaN(id)) {
        return res.status(400).json({ error: 'Invalid deck ID' });
    }

    // GET — retrieve a single deck
    if (req.method === 'GET') {
        const deck = await prisma.deck.findUnique({
            where: { id },
            include: { cards: true },
        });

        if (!deck) {
            return res.status(404).json({ error: 'Deck not found' });
        }

        return res.status(200).json(deck);
    }

    // PUT — update a deck
    if (req.method === 'PUT') {
        const existingDeck = await prisma.deck.findUnique({ where: { id } });
        if (!existingDeck) {
            return res.status(404).json({ error: 'Deck not found' });
        }

        const { main_list = '', extra_list = '', side_list = '', name } = req.body;

        if (!main_list && !extra_list && !side_list) {
            return res.status(400).json({ error: 'No deck list provided' });
        }

        const allCards = [
            ...parseDeckList(main_list, 'MAIN'),
            ...parseDeckList(extra_list, 'EXTRA'),
            ...parseDeckList(side_list, 'SIDE'),
        ];

        const totalCount = allCards.reduce((acc, c) => acc + c.quantity, 0);

        const cardNames = allCards.map((c) => c.name);
        const metadata = await getCardsMetadata(cardNames);

        // Update deck info
        await prisma.deck.update({
            where: { id },
            data: {
                name: name || existingDeck.name,
                rawList: main_list,
                totalCards: totalCount,
            },
        });

        // Delete old cards and create new ones
        await prisma.deckCard.deleteMany({ where: { deckId: id } });

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

            await prisma.deckCard.create({
                data: {
                    deckId: id,
                    cardName,
                    area: cardData.area,
                    quantity: cardData.quantity,
                    cardType: meta?.type || 'Unknown',
                    imageUrl: meta?.image_url || '',
                    attribute: meta?.attribute || '',
                    level: meta?.level ?? null,
                    atk: meta?.atk ?? null,
                    defense: meta?.def ?? null,
                },
            });
        }

        const updatedDeck = await prisma.deck.findUnique({
            where: { id },
            include: { cards: true },
        });

        return res.status(200).json(updatedDeck);
    }

    // DELETE
    if (req.method === 'DELETE') {
        const deck = await prisma.deck.findUnique({ where: { id } });
        if (!deck) {
            return res.status(404).json({ error: 'Deck not found' });
        }

        await prisma.deck.delete({ where: { id } });
        return res.status(204).end();
    }

    return res.status(405).json({ error: 'Method not allowed' });
}
