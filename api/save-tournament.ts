import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase } from './_lib/supabase';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { name, date, results } = req.body;

    if (!name || !date || !results || !Array.isArray(results)) {
        return res.status(400).json({ error: 'Missing required tournament data' });
    }

    try {
        // 1. Insert Tournament
        const { data: tournament, error: tError } = await supabase
            .from('tournaments')
            .insert({ name, date })
            .select()
            .single();

        if (tError) throw tError;

        // 2. Insert Results
        const resultsToInsert = results.map(r => ({
            tournament_id: tournament.id,
            player_name: r.playerName,
            top_placement: r.top,
            archetype: r.archetype
        }));

        const { error: rError } = await supabase
            .from('tournament_results')
            .insert(resultsToInsert);

        if (rError) throw rError;

        // 3. Return combined data
        res.status(201).json({
            ...tournament,
            results
        });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
}
