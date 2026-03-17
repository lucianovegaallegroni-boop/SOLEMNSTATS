import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { API_BASE_URL } from '../config'

interface LeagueStanding {
    player_name: string;
    total_points: number;
    tournaments_played: number;
    last_active: string;
}

interface Participant {
    playerName: string;
    placement: string;
    archetype?: string;
    showInMeta?: boolean;
}

interface LeagueResult {
    id: string;
    player_name: string;
    placement: string;
    archetype: string;
    points: number;
    show_in_meta: boolean;
}

interface LeagueTournament {
    id: string;
    name: string;
    date: string;
    league_results: LeagueResult[];
}

function ArchetypeAvatar({ names, metadata, size = 'size-8', className = '' }: { names: string[], metadata: Record<string, any>, size?: string, className?: string }) {
    const getUrl = (name: string) => {
        const id = metadata[name.trim().toLowerCase()]?.id;
        return id ? `https://images.ygoprodeck.com/images/cards_cropped/${id}.jpg` : null;
    };

    if (!names || names.length === 0) {
        return (
            <div className={`${size} ${className} rounded-full bg-slate-800/50 border border-white/5 flex items-center justify-center`}>
                <span className="material-symbols-outlined text-[10px] text-slate-600">person</span>
            </div>
        );
    }

    if (names.length === 1) {
        const url = getUrl(names[0]);
        return url ? (
            <img src={url} className={`${size} ${className} rounded-full object-cover border border-white/10 shadow-lg`} alt={names[0]} />
        ) : (
            <div className={`${size} ${className} rounded-full bg-slate-800 flex items-center justify-center border border-white/5 text-[8px] font-bold text-slate-500 uppercase tracking-tighter overflow-hidden`}>
                {names[0].substring(0, 2)}
            </div>
        );
    }

    // Split view for 2 cards
    const url1 = getUrl(names[0]);
    const url2 = getUrl(names[1]);

    return (
        <div className={`${size} ${className} rounded-full overflow-hidden flex border border-white/10 shadow-lg relative`}>
            <div className="w-1/2 h-full border-r border-white/5 overflow-hidden">
                {url1 ? <img src={url1} className="w-full h-full object-cover" alt={names[0]} /> : <div className="bg-slate-800 w-full h-full" />}
            </div>
            <div className="w-1/2 h-full overflow-hidden">
                {url2 ? <img src={url2} className="w-full h-full object-cover" alt={names[1]} /> : <div className="bg-slate-700 w-full h-full" />}
            </div>
        </div>
    );
}

export default function League() {
    const { user, session } = useAuth()
    const isAuthorized = user?.user_metadata?.username === 'SerSupremo' || user?.user_metadata?.role === 'admin' || user?.app_metadata?.role === 'admin';

    const [activeTab, setActiveTab] = useState<'leaderboard' | 'history'>('leaderboard')
    const [standings, setStandings] = useState<LeagueStanding[]>([])
    const [history, setHistory] = useState<LeagueTournament[]>([])
    const [loading, setLoading] = useState(true)
    const [showModal, setShowModal] = useState(false)
    const [submitting, setSubmitting] = useState(false)
    const [expandedTournamentId, setExpandedTournamentId] = useState<string | null>(null)
    const [savedPlayers, setSavedPlayers] = useState<string[]>([])
    const [savedDecks, setSavedDecks] = useState<string[]>([])

    // Player Config State
    const [playerConfigs, setPlayerConfigs] = useState<Record<string, string[]>>({})
    const [cardMetadata, setCardMetadata] = useState<Record<string, any>>({})
    const [showPlayerConfigModal, setShowPlayerConfigModal] = useState(false)
    const [activeConfigPlayer, setActiveConfigPlayer] = useState<string>('')
    const [playerCardNames, setPlayerCardNames] = useState<string>('')

    // Form State
    const [tournamentName, setTournamentName] = useState('')
    const [tournamentDate, setTournamentDate] = useState(new Date().toISOString().split('T')[0])
    const [participants, setParticipants] = useState<Participant[]>([
        { playerName: '', placement: '1st', archetype: '', showInMeta: true },
        { playerName: '', placement: '2nd', archetype: '', showInMeta: true },
        { playerName: '', placement: '3rd', archetype: '', showInMeta: true },
        { playerName: '', placement: '4th', archetype: '', showInMeta: true }
    ])

    useEffect(() => {
        fetchData()
    }, [activeTab])

    const fetchData = async () => {
        setLoading(true)
        await Promise.all([
            fetchStandings(),
            fetchHistory(),
            fetchArchetypes(),
            fetchPlayerConfigs()
        ])
        setLoading(false)
    }

    const fetchPlayerConfigs = async () => {
        try {
            const res = await fetch(`${API_BASE_URL}/api/players`)
            const data = await res.json()
            if (Array.isArray(data)) {
                const configMap: Record<string, string[]> = {}
                const allCardNames = new Set<string>()
                data.forEach((p: any) => {
                    configMap[p.name] = (p.card_names || []).map((n: string) => n.trim());
                    configMap[p.name].forEach((name: string) => {
                        if (name) allCardNames.add(name);
                    });
                })
                setPlayerConfigs(configMap)
                if (allCardNames.size > 0) {
                    fetchMetadata(Array.from(allCardNames))
                }
            }
        } catch (err) {
            console.error('Failed to fetch player configs:', err)
        }
    }

    const fetchMetadata = async (names: string[]) => {
        try {
            const res = await fetch(`${API_BASE_URL}/api/cards`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ names })
            })
            const data = await res.json()
            if (data.cards) {
                setCardMetadata(prev => ({ ...prev, ...data.cards }))
            }
        } catch (err) {
            console.error('Failed to fetch metadata:', err)
        }
    }

    const fetchArchetypes = async () => {
        try {
            const res = await fetch(`${API_BASE_URL}/api/archetypes`)
            const data = await res.json()
            if (Array.isArray(data)) {
                setSavedDecks(data.map((a: any) => a.name))
            }
        } catch (err) {
            console.error('Failed to fetch archetypes:', err)
        }
    }

    const fetchStandings = async () => {
        try {
            const res = await fetch(`${API_BASE_URL}/api/league`)
            const data = await res.json()
            if (Array.isArray(data)) {
                setStandings(data)
                // Seed player autocomplete from standings
                setSavedPlayers(prev => Array.from(new Set([...prev, ...data.map((p: any) => p.player_name)])))
            }
        } catch (err) {
            console.error('Failed to fetch standings:', err)
        }
    }

    const fetchHistory = async () => {
        try {
            const res = await fetch(`${API_BASE_URL}/api/league?view=history`)
            const data = await res.json()
            if (Array.isArray(data)) setHistory(data)
        } catch (err) {
            console.error('Failed to fetch history:', err)
        }
    }

    const deleteTournament = async (id: string) => {
        if (!confirm('Are you sure you want to delete this tournament and all its points?')) return
        try {
            const res = await fetch(`${API_BASE_URL}/api/league?id=${id}`, {
                method: 'DELETE',
                headers: {
                    ...(session?.access_token ? { 'Authorization': `Bearer ${session.access_token}` } : {})
                }
            })
            if (res.ok) fetchHistory()
        } catch (err) {
            console.error('Delete failed:', err)
        }
    }

    const addParticipantRow = () => {
        setParticipants([...participants, { playerName: '', placement: 'Participant', archetype: '', showInMeta: false }])
    }

    const handleParticipantChange = (index: number, field: keyof Participant, value: any) => {
        const updated = [...participants]
        updated[index] = { ...updated[index], [field]: value }
        setParticipants(updated)
    }

    const removeParticipant = (index: number) => {
        const updated = [...participants]
        updated.splice(index, 1)
        setParticipants(updated)
    }

    const openPlayerConfigModal = (playerName: string) => {
        setActiveConfigPlayer(playerName)
        setPlayerCardNames((playerConfigs[playerName] || []).join(', '))
        setShowPlayerConfigModal(true)
    }

    const savePlayerConfig = async () => {
        if (!activeConfigPlayer) return
        const cardNames = playerCardNames.split(',').map(s => s.trim()).filter(s => s !== '')
        try {
            const res = await fetch(`${API_BASE_URL}/api/players`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: activeConfigPlayer, cardNames })
            })
            if (res.ok) {
                setShowPlayerConfigModal(false)
                fetchPlayerConfigs()
            }
        } catch (err) {
            console.error('Save player config failed:', err)
        }
    }

    const submitTournament = async (e: React.FormEvent) => {
        e.preventDefault()
        const validParticipants = participants.filter(p => p.playerName.trim() !== '')
        if (validParticipants.length === 0) {
            alert('Add at least one player')
            return
        }

        setSubmitting(true)
        try {
            const res = await fetch(`${API_BASE_URL}/api/league`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(session?.access_token ? { 'Authorization': `Bearer ${session.access_token}` } : {})
                },
                body: JSON.stringify({
                    tournamentName,
                    date: tournamentDate,
                    participants: validParticipants
                })
            })

            if (res.ok) {
                setShowModal(false)
                setTournamentName('')
                setParticipants([
                    { playerName: '', placement: '1st', archetype: '', showInMeta: true },
                    { playerName: '', placement: '2nd', archetype: '', showInMeta: true },
                    { playerName: '', placement: '3rd', archetype: '', showInMeta: true },
                    { playerName: '', placement: '4th', archetype: '', showInMeta: true }
                ])
                if (activeTab === 'leaderboard') fetchStandings()
                else fetchHistory()
            } else {
                const errData = await res.json()
                alert(`Error: ${errData.error || 'Failed to submit'}`)
            }
        } catch (err) {
            console.error('Submission failed:', err)
        } finally {
            setSubmitting(false)
        }
    }

    return (
        <main className="flex-1 p-6 lg:p-12 max-w-[1200px] mx-auto w-full relative">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-8">
                <div>
                    <h1 className="text-4xl font-black text-white uppercase italic tracking-tighter mb-2">
                        Competitive <span className="text-emerald-500">League</span>
                    </h1>
                    <div className="flex gap-4 mt-4">
                        <button
                            onClick={() => setActiveTab('leaderboard')}
                            className={`text-[10px] font-black uppercase tracking-[0.2em] px-4 py-2 rounded-md transition-all ${activeTab === 'leaderboard' ? 'bg-emerald-500 text-background-dark shadow-lg shadow-emerald-500/20' : 'text-slate-500 hover:text-slate-300'}`}
                        >
                            Leaderboard
                        </button>
                        <button
                            onClick={() => setActiveTab('history')}
                            className={`text-[10px] font-black uppercase tracking-[0.2em] px-4 py-2 rounded-md transition-all ${activeTab === 'history' ? 'bg-emerald-500 text-background-dark shadow-lg shadow-emerald-500/20' : 'text-slate-500 hover:text-slate-300'}`}
                        >
                            History
                        </button>
                    </div>
                </div>

                {isAuthorized && (
                    <button
                        onClick={() => setShowModal(true)}
                        className="bg-emerald-500 hover:bg-emerald-400 text-background-dark px-5 py-3 rounded-lg text-sm font-black uppercase italic tracking-widest flex items-center gap-2 transition-all shadow-lg shadow-emerald-500/20 transform hover:-translate-y-1"
                    >
                        <span className="material-icons text-sm">add_circle</span>
                        Register Tournament
                    </button>
                )}
            </div>

            {/* Content Area */}
            {activeTab === 'leaderboard' ? (
                /* Leaderboard Table */
                <div className="glass rounded-xl overflow-hidden shadow-2xl border border-emerald-500/10 relative">
                    <div className="p-6 border-b border-emerald-500/10 flex justify-between items-center bg-slate-900/50">
                        <div>
                            <h2 className="text-xl font-bold text-white tracking-tight italic">Standings</h2>
                            <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest mt-1">Current Circuit</p>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className={`size-2 rounded-full ${loading ? 'bg-sky-500 animate-pulse' : 'bg-emerald-500'}`}></span>
                            <span className="text-[10px] font-black uppercase text-slate-400">{loading ? 'Syncing...' : 'Live Ranking'}</span>
                        </div>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm border-collapse">
                            <thead className="bg-slate-900/80 sticky top-0 z-10 backdrop-blur-sm">
                                <tr className="text-slate-500 font-black uppercase tracking-[0.1em] text-[10px] border-b border-white/5">
                                    <th className="px-6 py-5 w-16 text-center">Rank</th>
                                    <th className="px-6 py-5">Player Name</th>
                                    <th className="px-6 py-5 text-center">Tournaments</th>
                                    <th className="px-6 py-5 text-center text-emerald-400">Total Points</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                                {!loading && standings.length > 0 ? standings.map((player, idx) => (
                                    <tr key={player.player_name} className="hover:bg-white/5 transition-all group border-l-2 border-transparent hover:border-emerald-500">
                                        <td className="px-6 py-5 text-center">
                                            {idx === 0 ? <span className="material-icons text-yellow-400 text-lg">workspace_premium</span> :
                                                idx === 1 ? <span className="material-icons text-slate-300 text-lg">workspace_premium</span> :
                                                    idx === 2 ? <span className="material-icons text-amber-700 text-lg">workspace_premium</span> :
                                                        <span className="text-slate-400 font-bold block">{idx + 1}</span>}
                                        </td>
                                        <td className="px-6 py-5">
                                            <div className="flex items-center gap-3 cursor-pointer group/player" onClick={() => openPlayerConfigModal(player.player_name)}>
                                                <ArchetypeAvatar
                                                    names={playerConfigs[player.player_name] || []}
                                                    metadata={cardMetadata}
                                                    size="size-8"
                                                />
                                                <span className="font-bold text-slate-100 group-hover/player:text-emerald-400 text-base">{player.player_name}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-5 text-center text-slate-400 font-medium">{player.tournaments_played}</td>
                                        <td className="px-6 py-5 text-center">
                                            <span className={`px-3 py-1.5 rounded-md text-xs font-black uppercase tracking-widest ${idx === 0 ? 'bg-yellow-400/10 text-yellow-400 border border-yellow-400/30' : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'}`}>
                                                {player.total_points} PTS
                                            </span>
                                        </td>
                                    </tr>
                                )) : !loading && <tr><td colSpan={4} className="px-6 py-20 text-center text-slate-500 font-black uppercase tracking-widest text-[10px]">No archives found.</td></tr>}
                            </tbody>
                        </table>
                    </div>
                </div>
            ) : (
                /* History / Tournaments List */
                <div className="space-y-4">
                    {loading ? (
                        <div className="flex justify-center py-20"><div className="size-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin"></div></div>
                    ) : history.length > 0 ? history.map((tournament) => (
                        <div key={tournament.id} className="glass rounded-xl border border-white/5 overflow-hidden transition-all">
                            <div
                                className="p-5 flex items-center justify-between cursor-pointer hover:bg-white/5 transition-colors"
                                onClick={() => setExpandedTournamentId(expandedTournamentId === tournament.id ? null : tournament.id)}
                            >
                                <div className="flex items-center gap-4">
                                    <span className={`material-icons text-slate-500 transition-transform ${expandedTournamentId === tournament.id ? 'rotate-90 text-emerald-500' : ''}`}>chevron_right</span>
                                    <div>
                                        <h3 className="text-lg font-bold text-white tracking-tight">{tournament.name}</h3>
                                        <p className="text-[10px] font-black uppercase text-slate-500 tracking-widest">{new Date(tournament.date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-6">
                                    <div className="text-right">
                                        <span className="text-[10px] font-black text-emerald-400 uppercase tracking-widest block">{tournament.league_results?.length} Players</span>
                                    </div>
                                    {isAuthorized && (
                                        <button
                                            onClick={(e) => { e.stopPropagation(); deleteTournament(tournament.id); }}
                                            className="text-slate-600 hover:text-red-500 transition-colors p-2"
                                            title="Delete Tournament"
                                        >
                                            <span className="material-icons text-sm">delete</span>
                                        </button>
                                    )}
                                </div>
                            </div>

                            {expandedTournamentId === tournament.id && (
                                <div className="border-t border-white/5 bg-black/20 overflow-x-auto">
                                    <table className="w-full text-left text-[11px] border-collapse">
                                        <thead>
                                            <tr className="text-slate-500 font-black uppercase text-[9px] border-b border-white/5">
                                                <th className="px-6 py-3">Player</th>
                                                <th className="px-6 py-3">Placement</th>
                                                <th className="px-6 py-3">Archetype</th>
                                                <th className="px-6 py-3 text-right">Points</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-white/5">
                                            {tournament.league_results?.sort((a, b) => b.points - a.points).map((res) => (
                                                <tr key={res.id} className="hover:bg-white/5">
                                                    <td className="px-6 py-3">
                                                        <div className="flex items-center gap-3 cursor-pointer group/player" onClick={() => openPlayerConfigModal(res.player_name)}>
                                                            <ArchetypeAvatar
                                                                names={playerConfigs[res.player_name] || []}
                                                                metadata={cardMetadata}
                                                                size="size-6"
                                                            />
                                                            <span className="text-xs font-bold text-slate-300 group-hover/player:text-blue-primary transition-colors">{res.player_name}</span>
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-3 text-slate-400 font-black uppercase tracking-tighter">{res.placement}</td>
                                                    <td className="px-6 py-3">
                                                        {res.archetype ? <span className="text-emerald-500 font-bold">{res.archetype}</span> : <span className="text-slate-600 italic">No Deck recorded</span>}
                                                    </td>
                                                    <td className="px-6 py-3 text-right font-black text-white">{res.points} PTS</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    )) : <div className="text-center py-20 text-slate-500 uppercase font-black text-[10px]">No tournament history available.</div>}
                </div>
            )}

            {/* Modal for adding tournament results */}
            {showModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/95 backdrop-blur-md overflow-y-auto">
                    <div className="bg-slate-900 border border-white/10 rounded-2xl w-full max-w-4xl overflow-hidden shadow-2xl my-auto">
                        <div className="p-6 border-b border-white/10 flex justify-between items-center bg-black/20">
                            <div>
                                <h2 className="text-xl font-black uppercase text-white tracking-widest italic">Register Tournament</h2>
                                <p className="text-[9px] text-slate-500 font-black uppercase tracking-[0.2em] mt-1">Automatic League & Meta Integration</p>
                            </div>
                            <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-white transition-colors">
                                <span className="material-icons">close</span>
                            </button>
                        </div>

                        <form onSubmit={submitTournament} className="p-6 space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Event Name</label>
                                    <input type="text" required value={tournamentName} onChange={e => setTournamentName(e.target.value)} className="w-full bg-slate-800 border border-white/5 rounded-lg px-4 py-2.5 text-white focus:border-emerald-500/50 outline-none transition-colors" placeholder="e.g. OTS Local Championship" />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Date</label>
                                    <input type="date" required value={tournamentDate} onChange={e => setTournamentDate(e.target.value)} className="w-full bg-slate-800 border border-white/5 rounded-lg px-4 py-2.5 text-white focus:border-emerald-500/50 outline-none transition-colors [color-scheme:dark]" />
                                </div>
                            </div>

                            <div className="space-y-4">
                                <div className="flex justify-between items-center border-b border-white/5 pb-2">
                                    <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Participants & Top Decks</label>
                                    <button type="button" onClick={addParticipantRow} className="text-[10px] font-black border border-emerald-500/50 text-emerald-400 uppercase tracking-widest px-3 py-1 rounded bg-emerald-500/10 hover:bg-emerald-500/30 transition-colors">+ Add Position</button>
                                </div>

                                <div className="max-h-[400px] overflow-y-auto space-y-2 custom-scrollbar pr-2">
                                    {participants.map((p, index) => (
                                        <div key={index} className="flex flex-wrap md:flex-nowrap gap-2 items-center bg-slate-800/50 p-3 rounded-lg border border-white/5 group relative">
                                            <span className="hidden md:block text-slate-500 font-bold opacity-30 w-6 text-center text-xs">{index + 1}</span>

                                            <div className="flex-1 min-w-[140px]">
                                                <input
                                                    type="text"
                                                    placeholder="Player Name"
                                                    list="player-list"
                                                    value={p.playerName}
                                                    onChange={e => handleParticipantChange(index, 'playerName', e.target.value)}
                                                    className="w-full bg-slate-900 border border-white/5 rounded-md px-3 py-2 text-white text-sm focus:border-emerald-500/50 outline-none"
                                                />
                                            </div>

                                            <div className="w-32">
                                                <select value={p.placement} onChange={e => handleParticipantChange(index, 'placement', e.target.value)} className="w-full bg-slate-900 border border-white/5 rounded-md px-3 py-2 text-white text-[11px] font-black uppercase outfit focus:border-emerald-500/50 outline-none">
                                                    <option value="1st">1st Place</option>
                                                    <option value="2nd">2nd Place</option>
                                                    <option value="3rd">3rd Place</option>
                                                    <option value="4th">4th Place</option>
                                                    <option value="Top 8">Top 8</option>
                                                    <option value="Top 16">Top 16</option>
                                                    <option value="Participant">Participant</option>
                                                </select>
                                            </div>

                                            <div className="flex-1 min-w-[140px]">
                                                <input
                                                    type="text"
                                                    placeholder="Deck / Archetype (Optional)"
                                                    list="deck-list"
                                                    value={p.archetype}
                                                    onChange={e => handleParticipantChange(index, 'archetype', e.target.value)}
                                                    className="w-full bg-slate-900 border border-white/5 rounded-md px-3 py-2 text-white text-sm focus:border-emerald-500/50 outline-none"
                                                />
                                            </div>

                                            {/* Report to Meta Toggle (only for Tops) */}
                                            {['1st', '2nd', '3rd', '4th', 'Winner', 'Finalist'].includes(p.placement) && (
                                                <div className="flex items-center gap-2 bg-blue-primary/10 px-3 py-2 rounded-md border border-blue-primary/20">
                                                    <input
                                                        type="checkbox"
                                                        id={`meta-${index}`}
                                                        checked={p.showInMeta}
                                                        onChange={e => handleParticipantChange(index, 'showInMeta', e.target.checked)}
                                                        className="size-3 rounded border-white/20 bg-slate-900 text-blue-primary focus:ring-blue-primary active:ring-blue-primary"
                                                    />
                                                    <label htmlFor={`meta-${index}`} className="text-[9px] font-black text-blue-primary uppercase tracking-widest cursor-pointer whitespace-nowrap">Report Meta</label>
                                                </div>
                                            )}

                                            <button type="button" onClick={() => removeParticipant(index)} className="p-2 text-slate-500 hover:text-red-400 transition-colors">
                                                <span className="material-icons text-sm">delete</span>
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="pt-4 border-t border-white/10 flex justify-end gap-3 items-center">
                                <p className="text-[10px] text-slate-500 font-bold italic mr-auto">Check "Report Meta" to auto-populate the Meta Intelligence tab.</p>
                                <button type="button" onClick={() => setShowModal(false)} className="px-5 py-2 rounded-lg text-sm font-black uppercase tracking-widest text-slate-400 hover:text-white transition-colors">Cancel</button>
                                <button type="submit" disabled={submitting} className="bg-emerald-500 hover:bg-emerald-400 text-background-dark px-6 py-2 rounded-lg text-sm font-black uppercase tracking-widest shadow-lg shadow-emerald-500/20 disabled:opacity-50">
                                    {submitting ? 'Saving...' : 'Sync Tournament'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            <datalist id="player-list">
                {savedPlayers.map(name => <option key={name} value={name} />)}
            </datalist>
            <datalist id="deck-list">
                {savedDecks.map(name => <option key={name} value={name} />)}
            </datalist>

            {showPlayerConfigModal && (
                <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-background-dark/95 backdrop-blur-md" onClick={() => setShowPlayerConfigModal(false)} />
                    <div className="glass w-full max-w-md rounded-2xl overflow-hidden relative z-10 border border-emerald-500/30 shadow-[0_0_50px_rgba(16,185,129,0.1)]">
                        <div className="p-6 border-b border-white/5 flex justify-between items-center bg-emerald-500/5">
                            <h2 className="text-xl font-black text-white italic uppercase tracking-tighter">Player Configuration</h2>
                            <button onClick={() => setShowPlayerConfigModal(false)}>
                                <span className="material-symbols-outlined text-slate-400 hover:text-white transition-colors">close</span>
                            </button>
                        </div>
                        <div className="p-8 space-y-6">
                            <div className="space-y-4 text-center">
                                <div className="flex justify-center gap-4">
                                    {playerCardNames.split(',').map(s => s.trim()).filter(s => s !== '').slice(0, 2).map((cardName, idx) => (
                                        <div key={idx} className="relative group/card">
                                            <div className="size-20 rounded-2xl bg-slate-800 border-2 border-emerald-500/40 overflow-hidden shadow-lg shadow-emerald-500/10 relative">
                                                <img
                                                    src={cardMetadata[cardName.trim().toLowerCase()]?.id
                                                        ? `https://images.ygoprodeck.com/images/cards_cropped/${cardMetadata[cardName.trim().toLowerCase()].id}.jpg`
                                                        : undefined}
                                                    className="w-full h-full object-cover"
                                                    alt={cardName}
                                                    onError={(e) => {
                                                        const target = e.target as HTMLImageElement;
                                                        target.style.display = 'none';
                                                    }}
                                                />
                                            </div>
                                            <div className="absolute -bottom-2 -right-2 bg-emerald-500 text-background-dark size-6 rounded-full flex items-center justify-center text-[10px] font-black shadow-lg">
                                                {idx + 1}
                                            </div>
                                        </div>
                                    ))}
                                    {playerCardNames.split(',').map(s => s.trim()).filter(s => s !== '').length === 0 && (
                                        <div className="size-20 rounded-2xl bg-emerald-500/5 flex items-center justify-center border-2 border-dashed border-emerald-500/20">
                                            <span className="material-symbols-outlined text-emerald-500/30 text-3xl">person</span>
                                        </div>
                                    )}
                                </div>
                                <div>
                                    <h3 className="text-sm font-black text-white uppercase tracking-widest">{activeConfigPlayer}</h3>
                                    <p className="text-[10px] text-slate-500 mt-1 uppercase tracking-tighter">Assign signature cards to this player</p>
                                </div>
                            </div>

                            <div className="space-y-2 relative">
                                <label className="text-[9px] font-black uppercase text-slate-500 tracking-widest">Card Names (Separate by comma)</label>
                                <input
                                    type="text"
                                    value={playerCardNames}
                                    onChange={(e) => setPlayerCardNames(e.target.value)}
                                    placeholder="e.g. Blue-Eyes White Dragon, Dark Magician"
                                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-xs text-white outline-none focus:border-emerald-500 transition-all font-bold"
                                />
                                <p className="text-[9px] text-slate-600 italic">Assign representative cards for the player avatar.</p>
                            </div>

                            <button
                                onClick={savePlayerConfig}
                                className="w-full py-4 bg-emerald-500 rounded-xl text-[10px] font-black uppercase tracking-widest text-background-dark shadow-xl shadow-emerald-500/10 hover:bg-emerald-400 transition-all active:scale-95"
                            >
                                Save Player config
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </main>
    )
}
