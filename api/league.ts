import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase, getSupabase } from './_lib/supabase';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    const supabaseClient = getSupabase(req);

    // GET: Fetch either standings or tournament history
    if (req.method === 'GET') {
        const { view } = req.query;

        if (view === 'history') {
            const { data, error } = await supabase
                .from('league_tournaments')
                .select('*, league_results(*)')
                .order('date', { ascending: false });

            if (error) return res.status(500).json({ error: error.message });
            return res.status(200).json(data);
        }

        // Default: Standings (Leaderboard)
        const { data, error } = await supabase
            .from('league_standings')
            .select('*')
            .order('total_points', { ascending: false });

        if (error) return res.status(500).json({ error: error.message });
        return res.status(200).json(data);
    }

    // POST: Create new League Tournament and its results
    if (req.method === 'POST') {
        const { tournamentName, date, participants } = req.body;

        if (!tournamentName || !date || !participants || !Array.isArray(participants)) {
            return res.status(400).json({ error: 'Missing tournament data' });
        }

        try {
            // 1. Create League Tournament
            const { data: tournament, error: tError } = await supabaseClient
                .from('league_tournaments')
                .insert({ name: tournamentName, date })
                .select()
                .single();

            if (tError) throw tError;

            // 2. Format and Calculate Points for Results
            const resultsToInsert = participants.map((p: any) => {
                let points = 3; // participation
                const place = String(p.placement || '').toLowerCase();

                if (place === '1st' || place === '1' || place === 'winner') points += 9;
                else if (place === '2nd' || place === '2' || place === 'finalist') points += 6;
                else if (place.includes('3rd') || place.includes('4th') || place === '3' || place === '4' || place.includes('top 4')) points += 3;

                return {
                    tournament_id: tournament.id,
                    player_name: p.playerName,
                    placement: p.placement,
                    archetype: p.archetype || null,
                    points: points,
                    show_in_meta: !!p.showInMeta
                };
            });

            const { error: rError } = await supabaseClient
                .from('league_results')
                .insert(resultsToInsert);

            if (rError) throw rError;

            // 3. Optional Sync to Meta Intelligence Report
            const metaResults = participants.filter((p: any) => p.showInMeta && p.archetype);
            if (metaResults.length > 0) {
                // Find or create global tournament entry
                const { data: gTournament, error: gError } = await supabaseClient
                    .from('tournaments')
                    .insert({ name: tournamentName, date, category: 'Advance' })
                    .select()
                    .single();

                if (!gError && gTournament) {
                    const gResults = metaResults.map((p: any) => ({
                        tournament_id: gTournament.id,
                        player_name: p.playerName,
                        top_placement: p.placement,
                        archetype: p.archetype
                    }));
                    await supabaseClient.from('tournament_results').insert(gResults);
                }
            }

            return res.status(201).json({ success: true, id: tournament.id });
        } catch (err: any) {
            return res.status(500).json({ error: err.message });
        }
    }

    // DELETE: Remove League Tournament
    if (req.method === 'DELETE') {
        const { id } = req.query;
        if (!id) return res.status(400).json({ error: 'Missing ID' });

        const { error } = await supabaseClient
            .from('league_tournaments')
            .delete()
            .eq('id', id);

        if (error) return res.status(500).json({ error: error.message });
        return res.status(200).json({ success: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
}
