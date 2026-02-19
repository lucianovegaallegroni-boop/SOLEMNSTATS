import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase } from './_lib/supabase';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'DELETE') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { id, user_id } = req.query;

    if (!id || !user_id) {
        return res.status(400).json({ error: 'Missing required parameters (id, user_id)' });
    }

    // Attempt to delete with ownership check
    const { data, error } = await supabase
        .from('market_listings')
        .delete()
        .eq('id', id)
        .eq('user_id', user_id)
        .select();

    if (error) {
        console.error('Delete listing error:', error);
        return res.status(500).json({ error: error.message });
    }

    if (!data || data.length === 0) {
        return res.status(404).json({ error: 'Listing not found or you do not have permission to delete it' });
    }

    res.status(200).json({ message: 'Listing deleted successfully' });
}
