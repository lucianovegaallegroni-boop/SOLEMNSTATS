import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase, getSupabase } from './_lib/supabase';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    const supabaseClient = getSupabase(req);

    try {
        // GET: Fetch leagues, standings or tournament history
        if (req.method === 'GET') {
            const view = req.query.view;
            const league_id = req.query.league_id;

            if (view === 'leagues') {
                const { data, error } = await supabase
                    .from('leagues')
                    .select('*')
                    .order('created_at', { ascending: false });

                if (error) return res.status(500).json({ error: `Supabase error (leagues): ${error.message}` });
                return res.status(200).json(data || []);
            }

            if (view === 'history') {
                let query = supabase
                    .from('league_tournaments')
                    .select('*, league_results(*)')
                    .order('date', { ascending: false });
                
                if (league_id) {
                    query = query.eq('league_id', league_id);
                }

                const { data, error } = await query;

                if (error) return res.status(500).json({ error: `Supabase error (history): ${error.message}` });
                return res.status(200).json(data || []);
            }

            // Default: Standings (Leaderboard)
            let query = supabase
                .from('league_standings')
                .select('*')
                .order('total_points', { ascending: false });

            if (league_id) {
                query = query.eq('league_id', league_id);
            }

            const { data, error } = await query;

            if (error) return res.status(500).json({ error: `Supabase error (standings): ${error.message}` });
            return res.status(200).json(data || []);
        }

        // POST: Create new League or Register Tournament
        if (req.method === 'POST') {
            const view = req.query.view;

            // Create League
            if (view === 'leagues') {
                const { name, points_participation, points_1st, points_2nd, points_3rd } = req.body;
                if (!name) return res.status(400).json({ error: 'Missing league name' });

                const { data, error } = await supabaseClient
                    .from('leagues')
                    .insert({ 
                        name, 
                        points_participation: points_participation || 0,
                        points_1st: points_1st || 0,
                        points_2nd: points_2nd || 0,
                        points_3rd: points_3rd || 0
                    })
                    .select()
                    .single();

                if (error) return res.status(500).json({ error: `Supabase error (create league): ${error.message}` });
                return res.status(201).json(data);
            }

            // Register Tournament
            const { league_id, tournamentName, date, participants } = req.body;

            if (!tournamentName || !date || !participants || !Array.isArray(participants) || !league_id) {
                return res.status(400).json({ error: 'Missing required tournament data (tournamentName, date, participants, league_id)' });
            }

            // 1. Fetch League config
            const { data: league, error: lError } = await supabase
                .from('leagues')
                .select('*')
                .eq('id', league_id)
                .single();
            
            if (lError) throw new Error(`League lookup error: ${lError.message}`);
            if (!league) return res.status(404).json({ error: 'League not found' });

            // 2. Create League Tournament
            const { data: tournament, error: tError } = await supabaseClient
                .from('league_tournaments')
                .insert({ name: tournamentName, date, league_id })
                .select()
                .single();

            if (tError) throw new Error(`Tournament creation error: ${tError.message}`);

            // 3. Format and Calculate Points for Results
            const resultsToInsert = participants.map((p: any) => {
                let points = 0;
                
                if (!p.noPoints) {
                    points = league.points_participation || 0;
                    const place = String(p.placement || '').toLowerCase();

                    if (place === '1st' || place === '1' || place === 'winner') points += (league.points_1st || 0);
                    else if (place === '2nd' || place === '2' || place === 'finalist') points += (league.points_2nd || 0);
                    else if (place.includes('3rd') || place.includes('4th') || place === '3' || place === '4' || place.includes('top 4')) points += (league.points_3rd || 0);
                }

                return {
                    tournament_id: tournament.id,
                    player_name: p.playerName,
                    placement: p.placement,
                    archetype: p.archetype || null,
                    points: typeof p.points === 'number' ? p.points : points,
                    show_in_meta: !!p.showInMeta
                };
            });

            const { error: rError } = await supabaseClient
                .from('league_results')
                .insert(resultsToInsert);

            if (rError) throw new Error(`Results insertion error: ${rError.message}`);

            // 4. Optional Sync to Meta Intelligence Report
            const metaResults = participants.filter((p: any) => p.showInMeta && p.archetype);
            if (metaResults.length > 0) {
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
        }

        // PUT: Update League Tournament
        if (req.method === 'PUT') {
            const { id, league_id, tournamentName, date, participants } = req.body;

            if (!id || !tournamentName || !date || !participants || !Array.isArray(participants) || !league_id) {
                return res.status(400).json({ error: 'Missing required tournament data' });
            }

            // 1. Fetch League config
            const { data: league, error: lError } = await supabase
                .from('leagues')
                .select('*')
                .eq('id', league_id)
                .single();
            
            if (lError || !league) return res.status(404).json({ error: 'League not found' });

            // 2. Update League Tournament
            const { error: tError } = await supabaseClient
                .from('league_tournaments')
                .update({ name: tournamentName, date, league_id })
                .eq('id', id);

            if (tError) throw new Error(`Tournament update error: ${tError.message}`);

            // 3. Delete old results
            const { error: delError } = await supabaseClient
                .from('league_results')
                .delete()
                .eq('tournament_id', id);

            if (delError) throw new Error(`Results deletion error: ${delError.message}`);

            // 4. Format and Calculate Points for Results
            const resultsToInsert = participants.map((p: any) => {
                let points = 0;
                
                if (!p.noPoints) {
                    points = league.points_participation || 0;
                    const place = String(p.placement || '').toLowerCase();

                    if (place === '1st' || place === '1' || place === 'winner') points += (league.points_1st || 0);
                    else if (place === '2nd' || place === '2' || place === 'finalist') points += (league.points_2nd || 0);
                    else if (place.includes('3rd') || place.includes('4th') || place === '3' || place === '4' || place.includes('top 4')) points += (league.points_3rd || 0);
                }

                return {
                    tournament_id: id,
                    player_name: p.playerName,
                    placement: p.placement,
                    archetype: p.archetype || null,
                    points: typeof p.points === 'number' ? p.points : points,
                    show_in_meta: !!p.showInMeta
                };
            });

            const { error: rError } = await supabaseClient
                .from('league_results')
                .insert(resultsToInsert);

            if (rError) throw new Error(`Results insertion error: ${rError.message}`);

            return res.status(200).json({ success: true, id });
        }

        // DELETE: Remove League Tournament
        if (req.method === 'DELETE') {
            const id = req.query.id;
            if (!id) return res.status(400).json({ error: 'Missing ID' });

            const { error } = await supabaseClient
                .from('league_tournaments')
                .delete()
                .eq('id', id);

            if (error) return res.status(500).json({ error: `Supabase error (delete): ${error.message}` });
            return res.status(200).json({ success: true });
        }

        return res.status(405).json({ error: 'Method not allowed' });
    } catch (err: any) {
        console.error('API Error:', err);
        return res.status(500).json({ error: err.message });
    }
}
