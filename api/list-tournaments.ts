import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase } from './_lib/supabase';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { data, error } = await supabase
            .from('tournaments')
            .select('*, tournament_results(*)')
            .order('date', { ascending: false });

        if (error) throw error;

        // Transform data to match the frontend expectations
        const formattedData = data.map(tournament => ({
            id: tournament.id.toString(),
            name: tournament.name,
            date: new Date(tournament.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
            results: tournament.tournament_results.map((r: any) => ({
                playerName: r.player_name,
                top: r.top_placement,
                archetype: r.archetype
            }))
        }));

        res.status(200).json(formattedData);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
}
