import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getCardsMetadata } from './_lib/card-service';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { names } = req.body;

    if (!names || !Array.isArray(names)) {
        return res.status(400).json({ error: 'Missing names array in request body' });
    }

    try {
        const metadata = await getCardsMetadata(names);
        res.status(200).json(metadata);
    } catch (error: any) {
        console.error('Error fetching cards metadata:', error);
        res.status(500).json({ error: error.message });
    }
}
