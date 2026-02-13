import type { VercelRequest, VercelResponse } from '@vercel/node';
import { searchCards } from './_lib/card-service';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const query = (req.query.q as string) || '';
    const results = await searchCards(query);
    res.status(200).json(results);
}
