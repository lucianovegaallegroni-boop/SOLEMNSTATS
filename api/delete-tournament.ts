import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase } from './_lib/supabase';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'DELETE') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { id } = req.query;

    if (!id) {
        return res.status(400).json({ error: 'Missing tournament ID' });
    }

    try {
        const { error } = await supabase
            .from('tournaments')
            .delete()
            .eq('id', id);

        if (error) throw error;

        res.status(200).json({ success: true });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
}
