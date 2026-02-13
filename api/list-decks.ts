import type { VercelRequest, VercelResponse } from '@vercel/node';
import { prisma } from './_lib/prisma';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const decks = await prisma.deck.findMany({
        orderBy: { createdAt: 'desc' },
        include: { cards: true },
    });

    res.status(200).json(decks);
}
