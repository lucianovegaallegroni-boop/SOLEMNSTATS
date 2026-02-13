import type { VercelRequest, VercelResponse } from '@vercel/node';
import { prisma } from './_lib/prisma';
import { parseDeckList } from './_lib/parser';
import { getCardsMetadata, findBestMatch } from './_lib/card-service';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { main_list = '', extra_list = '', side_list = '', name = 'My New Deck' } = req.body;

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
    const deck = await prisma.deck.create({
        data: {
            name,
            rawList: main_list,
            totalCards: totalCount,
        },
    });

    // Create cards with metadata
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
                deckId: deck.id,
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

    // Return the full deck with cards
    const fullDeck = await prisma.deck.findUnique({
        where: { id: deck.id },
        include: { cards: true },
    });

    res.status(201).json(fullDeck);
}
