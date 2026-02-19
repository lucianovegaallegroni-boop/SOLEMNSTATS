import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase } from './_lib/supabase';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    // GET: List tournaments (from list-tournaments.ts)
    if (req.method === 'GET') {
        try {
            const { data, error } = await supabase
                .from('tournaments')
                .select('*, tournament_results(*)')
                .order('date', { ascending: false });

            if (error) throw error;

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

            return res.status(200).json(formattedData);
        } catch (error: any) {
            return res.status(500).json({ error: error.message });
        }
    }

    // POST: Save or Update tournament (merged save-tournament.ts and update-tournament.ts)
    if (req.method === 'POST') {
        const { id, name, date, results } = req.body;
        if (!name || !date || !results || !Array.isArray(results)) {
            return res.status(400).json({ error: 'Missing required tournament data' });
        }

        try {
            let tournamentId = id;

            if (id) {
                // Update
                const { error: tError } = await supabase
                    .from('tournaments')
                    .update({ name, date })
                    .eq('id', id);
                if (tError) throw tError;

                // Delete old results
                const { error: dError } = await supabase
                    .from('tournament_results')
                    .delete()
                    .eq('tournament_id', id);
                if (dError) throw dError;
            } else {
                // Create
                const { data: tournament, error: tError } = await supabase
                    .from('tournaments')
                    .insert({ name, date })
                    .select()
                    .single();
                if (tError) throw tError;
                tournamentId = tournament.id;
            }

            // Insert Results
            const resultsToInsert = results.map(r => ({
                tournament_id: tournamentId,
                player_name: r.playerName,
                top_placement: r.top,
                archetype: r.archetype
            }));

            const { error: rError } = await supabase
                .from('tournament_results')
                .insert(resultsToInsert);

            if (rError) throw rError;

            return res.status(id ? 200 : 201).json({ success: true, id: tournamentId });
        } catch (error: any) {
            return res.status(500).json({ error: error.message });
        }
    }

    // DELETE: Remove tournament (from delete-tournament.ts)
    if (req.method === 'DELETE') {
        const { id } = req.query;
        if (!id) return res.status(400).json({ error: 'Missing tournament ID' });

        try {
            const { error } = await supabase
                .from('tournaments')
                .delete()
                .eq('id', id);
            if (error) throw error;
            return res.status(200).json({ success: true });
        } catch (error: any) {
            return res.status(500).json({ error: error.message });
        }
    }

    return res.status(405).json({ error: 'Method not allowed' });
}
