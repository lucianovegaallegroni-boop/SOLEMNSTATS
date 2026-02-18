import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase } from './_lib/supabase';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { id, name, date, results } = req.body;

    if (!id || !name || !date || !results || !Array.isArray(results)) {
        return res.status(400).json({ error: 'Missing required tournament data' });
    }

    try {
        // 1. Update Tournament Header
        const { error: tError } = await supabase
            .from('tournaments')
            .update({ name, date })
            .eq('id', id);

        if (tError) throw tError;

        // 2. Delete old results for this tournament
        const { error: dError } = await supabase
            .from('tournament_results')
            .delete()
            .eq('tournament_id', id);

        if (dError) throw dError;

        // 3. Insert new results
        const resultsToInsert = results.map(r => ({
            tournament_id: id,
            player_name: r.playerName,
            top_placement: r.top,
            archetype: r.archetype
        }));

        const { error: rError } = await supabase
            .from('tournament_results')
            .insert(resultsToInsert);

        if (rError) throw rError;

        res.status(200).json({ success: true });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
}
