import type { VercelRequest, VercelResponse } from '@vercel/node';
import { prisma } from '../_lib/db';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const id = parseInt(req.query.id as string);

    if (isNaN(id)) {
        return res.status(400).json({ error: 'Invalid card ID' });
    }

    const card = await prisma.deckCard.findUnique({ where: { id } });
    if (!card) {
        return res.status(404).json({ error: 'Card not found' });
    }

    const { tags } = req.body;

    if (!Array.isArray(tags)) {
        return res.status(400).json({ error: 'Invalid tags format' });
    }

    await prisma.deckCard.update({
        where: { id },
        data: { customTags: JSON.stringify(tags) },
    });

    res.status(200).json({ status: 'Tags updated', tags });
}
