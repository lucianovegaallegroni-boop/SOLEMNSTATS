import type { VercelRequest, VercelResponse } from '@vercel/node';
import { searchCards, getCardsMetadata } from './_lib/card-service';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    // GET: Search cards (from search-cards.ts)
    if (req.method === 'GET') {
        const query = (req.query.q as string) || '';
        const results = await searchCards(query);
        return res.status(200).json(results);
    }

    // POST: Get metadata (from get-cards-metadata.ts)
    if (req.method === 'POST') {
        const { names } = req.body;
        if (!names || !Array.isArray(names)) {
            return res.status(400).json({ error: 'Missing names array in request body' });
        }

        try {
            const metadata = await getCardsMetadata(names);
            return res.status(200).json(metadata);
        } catch (error: any) {
            console.error('Error fetching cards metadata:', error);
            return res.status(500).json({ error: error.message });
        }
    }

    return res.status(405).json({ error: 'Method not allowed' });
}
