import { useState, useMemo, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'


interface TournamentResult {
    playerName: string
    top: string
    archetype: string
}

interface Tournament {
    id: string
    name: string
    date: string
    results: TournamentResult[]
}

type ViewType = 'Format' | 'Tournament' | 'Month'

const ArchetypeAvatar = ({ names, metadata, size = 'size-8', className = '' }: { names: string[], metadata: Record<string, any>, size?: string, className?: string }) => {
    const getUrl = (name: string) => {
        const id = metadata[name.trim().toLowerCase()]?.id;
        if (id) return `https://images.ygoprodeck.com/images/cards_cropped/${id}.jpg`;
        return undefined;
    };

    const getBgColor = (name: string) => {
        const colors = ['bg-blue-600', 'bg-indigo-600', 'bg-purple-600', 'bg-rose-600', 'bg-emerald-600', 'bg-amber-600'];
        const charCode = name.charCodeAt(0) || 0;
        return colors[charCode % colors.length];
    };

    const Placeholder = ({ name }: { name: string }) => (
        <div className={`w-full h-full ${getBgColor(name)} flex items-center justify-center`}>
            <span className="text-[8px] font-black text-white uppercase opacity-40">{name.charAt(0)}</span>
        </div>
    );

    if (!names || names.length === 0) {
        return (
            <div className={`${size} rounded-full bg-slate-800/50 flex items-center justify-center border border-white/5 shadow-inner ${className}`}>
                <span className="material-symbols-outlined text-[10px] text-blue-primary/40">query_stats</span>
            </div>
        );
    }

    if (names.length === 1) {
        const url = getUrl(names[0]);
        return (
            <div className={`${size} rounded-full border border-white/10 overflow-hidden shadow-lg bg-slate-900 ${className}`}>
                {url ? (
                    <img
                        src={url}
                        className="w-full h-full object-cover"
                        alt=""
                        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                    />
                ) : <Placeholder name={names[0]} />}
            </div>
        );
    }

    // Split layout for 2 cards
    const url1 = getUrl(names[0]);
    const url2 = getUrl(names[1]);

    return (
        <div className={`${size} rounded-full border border-white/10 overflow-hidden shadow-lg flex bg-slate-900 ${className}`}>
            <div className="w-1/2 h-full border-r border-white/10 relative overflow-hidden">
                {url1 ? (
                    <img
                        src={url1}
                        className="absolute h-full w-[200%] max-w-none object-cover left-[-50%]"
                        alt=""
                        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; shadowPlaceholder(e, names[0]); }}
                    />
                ) : <Placeholder name={names[0]} />}
            </div>
            <div className="w-1/2 h-full relative overflow-hidden">
                {url2 ? (
                    <img
                        src={url2}
                        className="absolute h-full w-[200%] max-w-none object-cover left-[-50%]"
                        alt=""
                        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; shadowPlaceholder(e, names[1]); }}
                    />
                ) : <Placeholder name={names[1]} />}
            </div>
        </div>
    );
};

// Helper to show placeholder on img error in split view
const shadowPlaceholder = (e: React.SyntheticEvent<HTMLImageElement, Event>, name: string) => {
    const parent = (e.target as HTMLImageElement).parentElement;
    if (parent) {
        const bgColors = ['bg-blue-600', 'bg-indigo-600', 'bg-purple-600', 'bg-rose-600', 'bg-emerald-600', 'bg-amber-600'];
        const charCode = name.charCodeAt(0) || 0;
        const bgColor = bgColors[charCode % bgColors.length].replace('bg-', '');

        parent.style.backgroundColor = `var(--${bgColor}, #1e293b)`;
        const span = document.createElement('span');
        span.className = 'text-[8px] font-black text-white uppercase opacity-40 absolute inset-0 flex items-center justify-center';
        span.innerText = name.charAt(0);
        parent.appendChild(span);
    }
};

export default function MetaReport() {
    const { user } = useAuth()
    const isAuthorized = user?.user_metadata?.username === 'SerSupremo' || user?.user_metadata?.role === 'admin' || user?.app_metadata?.role === 'admin';

    const [viewType, setViewType] = useState<ViewType>('Format')
    const [showModal, setShowModal] = useState(false)
    const [isEditing, setIsEditing] = useState(false)
    const [loading, setLoading] = useState(true)
    const [hoveredSegment, setHoveredSegment] = useState<{ name: string, percentage: number } | null>(null)

    const [tournaments, setTournaments] = useState<Tournament[]>([])
    const [archetypeConfigs, setArchetypeConfigs] = useState<Record<string, string[]>>({})
    const [savedPlayers, setSavedPlayers] = useState<string[]>(['YusukeH', 'Dkayed', 'JoshM', 'Jesse Kotton', 'Joshua Schmidt'])
    const [savedDecks, setSavedDecks] = useState<string[]>(['Snake-Eye', 'Voiceless Voice', 'Labrynth', 'Tenpai Dragon', 'Branded Despia', 'Kashtira', 'Runick', 'Fire King'])

    // Config Modal State
    const [showConfigModal, setShowConfigModal] = useState(false)
    const [activeConfigArchetype, setActiveConfigArchetype] = useState<string>('')
    const [configCardNames, setConfigCardNames] = useState<string>('')
    const [cardSuggestions, setCardSuggestions] = useState<any[]>([])
    const [showSuggestions, setShowSuggestions] = useState(false)
    const [cardMetadata, setCardMetadata] = useState<Record<string, any>>({})

    // Fetch data on mount
    useEffect(() => {
        fetchTournaments()
        fetchArchetypeConfigs()
    }, [])

    const fetchTournaments = async () => {
        try {
            const res = await fetch('/api/tournaments')
            const data = await res.json()
            if (Array.isArray(data)) {
                setTournaments(data)
                const playersSet = new Set(savedPlayers);
                const decksSet = new Set(savedDecks);
                data.forEach((t: Tournament) => {
                    t.results.forEach(r => {
                        if (r.playerName) playersSet.add(r.playerName);
                        if (r.archetype) decksSet.add(r.archetype);
                    });
                });
                setSavedPlayers(Array.from(playersSet));
                setSavedDecks(Array.from(decksSet));
            }
        } catch (err) {
            console.error('Failed to fetch tournaments:', err)
        } finally {
            setLoading(false)
        }
    }


    const fetchArchetypeConfigs = async () => {
        try {
            const res = await fetch('/api/archetypes')
            const data = await res.json()
            if (Array.isArray(data)) {
                const configMap: Record<string, string[]> = {}
                const allCardNames = new Set<string>()
                data.forEach((c: any) => {
                    configMap[c.name] = (c.card_names || []).map((n: string) => n.trim());
                    configMap[c.name].forEach((name: string) => {
                        if (name) allCardNames.add(name);
                    });
                })
                setArchetypeConfigs(configMap)
                if (allCardNames.size > 0) {
                    fetchMetadata(Array.from(allCardNames))
                }
            }
        } catch (err) {
            console.error('Failed to fetch configs:', err)
        }
    }

    const fetchMetadata = async (names: string[]) => {
        try {
            const res = await fetch('/api/cards', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ names })
            })
            const data = await res.json()
            setCardMetadata(prev => ({ ...prev, ...data }))
        } catch (err) {
            console.error('Failed to fetch metadata:', err)
        }
    }

    // Sub-filter States
    const [selectedTournamentId, setSelectedTournamentId] = useState<string>('')
    const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth())

    useEffect(() => {
        if (tournaments.length > 0 && !selectedTournamentId) {
            setSelectedTournamentId(tournaments[0].id)
        }
    }, [tournaments, selectedTournamentId])

    const initialNewTournament = {
        id: '',
        name: '',
        date: new Date().toISOString().split('T')[0],
        results: [{ playerName: '', top: 'Winner', archetype: '' }]
    };

    const [newTournament, setNewTournament] = useState<Tournament>(initialNewTournament)

    // List of months for the Month view selection
    const months = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'
    ]

    // Card Search Logic for Deck Configuration Modal
    useEffect(() => {
        // Find the last card name being typed (split by comma)
        const parts = configCardNames.split(',');
        const lastPart = parts[parts.length - 1]?.trim() || '';

        // Only search if the user has typed at least 3 characters
        if (lastPart.length < 3) {
            setCardSuggestions([]);
            setShowSuggestions(false);
            return;
        }

        const timer = setTimeout(async () => {
            try {
                const res = await fetch(`/api/cards?q=${encodeURIComponent(lastPart)}`);
                const data = await res.json();
                if (Array.isArray(data)) {
                    // Limit to top 5 results for the dropdown
                    setCardSuggestions(data.slice(0, 5));
                    setShowSuggestions(true);
                }
            } catch (err) {
                console.error('Card search failed:', err);
                setShowSuggestions(false);
            }
        }, 300);

        return () => clearTimeout(timer);
    }, [configCardNames]);

    const selectSuggestion = (card: any) => {
        const parts = configCardNames.split(',').map(s => s.trim());
        parts.pop(); // Remove the incomplete name
        parts.push(card.name); // Add the selected full name

        // Update input and show comma if we only have one card so far
        const newValue = parts.join(', ');
        setConfigCardNames(newValue + (parts.length < 2 ? ', ' : ''));

        // Store metadata immediately to avoid extra fetch
        setCardMetadata(prev => ({
            ...prev,
            [card.name.toLowerCase()]: card
        }));

        setShowSuggestions(false);
        setCardSuggestions([]);
    };
    const filteredTournaments = useMemo(() => {
        if (viewType === 'Tournament' && selectedTournamentId) {
            return tournaments.filter(t => t.id === selectedTournamentId);
        } else if (viewType === 'Month') {
            return tournaments.filter(t => {
                const d = new Date(t.date);
                return d.getMonth() === selectedMonth;
            });
        }
        return tournaments;
    }, [tournaments, viewType, selectedTournamentId, selectedMonth]);

    // Dynamic Chart Logic
    const chartData = useMemo(() => {
        const archetypeCounts: Record<string, number> = {};
        let totalResults = 0;

        filteredTournaments.forEach(t => {
            t.results.forEach(r => {
                if (r.archetype) {
                    archetypeCounts[r.archetype] = (archetypeCounts[r.archetype] || 0) + 1;
                    totalResults++;
                }
            });
        });

        if (totalResults === 0) return [];

        const colors = ['bg-blue-primary', 'bg-gold', 'bg-slate-400', 'bg-emerald-500', 'bg-rose-500', 'bg-purple-500', 'bg-indigo-400'];

        const sortedDecks = Object.entries(archetypeCounts)
            .map(([name, count]) => ({
                name,
                count,
                percentage: (count / totalResults) * 100
            }))
            .sort((a, b) => b.count - a.count);

        if (sortedDecks.length <= 5) {
            return sortedDecks.map((deck, idx) => ({
                ...deck,
                color: colors[idx % colors.length]
            }));
        }

        const top5 = sortedDecks.slice(0, 5).map((deck, idx) => ({
            ...deck,
            color: colors[idx % colors.length]
        }));

        const others = sortedDecks.slice(5);
        const otherCount = others.reduce((acc, curr) => acc + curr.count, 0);
        const otherPercentage = (otherCount / totalResults) * 100;

        return [
            ...top5,
            {
                name: 'Other',
                count: otherCount,
                percentage: otherPercentage,
                color: 'bg-slate-600'
            }
        ];
    }, [filteredTournaments]);

    // Dynamic Top Rankers logic
    const topRankers = useMemo(() => {
        const playerTops: Record<string, number> = {};
        filteredTournaments.forEach(t => {
            t.results.forEach(r => {
                if (r.playerName) {
                    playerTops[r.playerName] = (playerTops[r.playerName] || 0) + 1;
                }
            });
        });

        return Object.entries(playerTops)
            .map(([name, tops]) => ({ name, tops }))
            .sort((a, b) => b.tops - a.tops)
            .slice(0, 3);
    }, [filteredTournaments]);

    const displayData = hoveredSegment || (chartData.length > 0 ? { name: chartData[0].name, percentage: chartData[0].percentage } : null);

    const addPlayerRow = () => {
        const currentCount = newTournament.results.length;
        let nextTop = 'Top 8';
        if (currentCount === 0) nextTop = 'Winner';
        else if (currentCount === 1) nextTop = 'Finalist';
        else if (currentCount < 4) nextTop = 'Top 4';
        else nextTop = 'Top 8';

        setNewTournament({
            ...newTournament,
            results: [...newTournament.results, { playerName: '', top: nextTop, archetype: '' }]
        })
    }

    const handlePlayerChange = (index: number, field: keyof TournamentResult, value: string) => {
        const updatedResults = [...newTournament.results]
        updatedResults[index] = { ...updatedResults[index], [field]: value }
        setNewTournament({ ...newTournament, results: updatedResults })
    }

    const handleEditClick = (tournament: Tournament) => {
        setNewTournament({
            ...tournament,
            date: new Date(tournament.date).toISOString().split('T')[0]
        });
        setIsEditing(true);
        setShowModal(true);
    }

    const openConfigModal = (archetype: string) => {
        setActiveConfigArchetype(archetype);
        setConfigCardNames(archetypeConfigs[archetype]?.join(', ') || '');
        setShowConfigModal(true);
    }

    const saveArchetypeConfig = async () => {
        const cardNames = configCardNames.split(',').map(s => s.trim()).filter(s => s !== '').slice(0, 2);
        try {
            const res = await fetch('/api/archetypes', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: activeConfigArchetype, card_names: cardNames })
            })
            if (res.ok) {
                setShowConfigModal(false);
                fetchArchetypeConfigs();
            }
        } catch (err) {
            console.error('Failed to save config:', err)
        }
    }

    const deleteTournament = async (id: string) => {
        if (!confirm('Are you sure you want to delete this tournament?')) return;
        try {
            const res = await fetch(`/api/tournaments?id=${id}`, { method: 'DELETE' })
            if (res.ok) fetchTournaments()
        } catch (err) {
            console.error('Delete failed:', err)
        }
    }

    const submitTournament = async (e: React.FormEvent) => {
        e.preventDefault()
        const endpoint = '/api/tournaments';
        try {
            const res = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newTournament)
            })
            if (res.ok) {
                setShowModal(false)
                setIsEditing(false)
                setNewTournament(initialNewTournament)
                fetchTournaments()
            }
        } catch (err) {
            console.error('Submission failed:', err)
        }
    }

    return (
        <main className="flex-1 p-6 lg:p-12 max-w-[1600px] mx-auto w-full relative">
            {/* Page Header */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
                <div>
                    <h1 className="text-4xl font-black text-white uppercase italic tracking-tighter mb-2">
                        Meta <span className="text-blue-primary">Intelligence</span>
                    </h1>
                    <p className="text-slate-400 font-medium max-w-lg">
                        Advanced analytics for the current TCG format. Filter by event or time period.
                    </p>
                </div>

                {isAuthorized && (
                    <button
                        onClick={() => { setIsEditing(false); setNewTournament(initialNewTournament); setShowModal(true); }}
                        className="bg-blue-primary hover:bg-blue-primary/90 text-white px-5 py-3 rounded-lg text-sm font-black uppercase italic tracking-widest flex items-center gap-2 transition-all shadow-lg shadow-blue-primary/20 transform hover:-translate-y-1"
                    >
                        <span className="material-symbols-outlined text-sm">add_circle</span>
                        Submit Tournament
                    </button>
                )}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 space-y-8">

                    {/* Meta Representation Chart */}
                    <div className="glass p-8 rounded-xl shadow-2xl relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-blue-primary/5 rounded-full -mr-16 -mt-16 blur-3xl"></div>

                        <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
                            <div>
                                <h2 className="text-xl font-bold text-white tracking-tight">Meta Distribution</h2>
                                <div className="flex items-center gap-2 mt-1">
                                    {viewType === 'Tournament' && tournaments.length > 0 && (
                                        <select
                                            value={selectedTournamentId}
                                            onChange={(e) => setSelectedTournamentId(e.target.value)}
                                            className="bg-slate-800/80 border border-white/10 rounded-md px-2 py-1 text-[10px] font-black text-blue-primary uppercase outline-none"
                                        >
                                            {tournaments.map(t => (
                                                <option key={t.id} value={t.id} className="bg-slate-900">
                                                    {t.name} • {new Date(t.date).toLocaleDateString()}
                                                </option>
                                            ))}
                                        </select>
                                    )}
                                    {viewType === 'Month' && (
                                        <select
                                            value={selectedMonth}
                                            onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
                                            className="bg-slate-800/80 border border-white/10 rounded-md px-2 py-1 text-[10px] font-black text-blue-primary uppercase outline-none"
                                        >
                                            {months.map((m, idx) => <option key={m} value={idx} className="bg-slate-900">{m}</option>)}
                                        </select>
                                    )}
                                    {viewType === 'Format' && (
                                        <span className="text-blue-primary text-[10px] font-black uppercase tracking-widest">Global Format</span>
                                    )}
                                </div>
                            </div>

                            <div className="flex flex-wrap gap-2">
                                <div className="flex bg-slate-800/50 p-1 rounded-lg border border-white/5">
                                    {(['Format', 'Tournament', 'Month'] as ViewType[]).map(type => (
                                        <button
                                            key={type}
                                            onClick={() => setViewType(type)}
                                            className={`px-3 py-1.5 text-[10px] font-black uppercase tracking-tighter rounded-md transition-all ${viewType === type ? 'bg-blue-primary text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}
                                        >
                                            {type}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
                            <div className="relative aspect-square flex items-center justify-center max-w-[300px] mx-auto w-full">
                                <div className="absolute inset-0 rounded-full border-[20px] border-blue-primary/5"></div>
                                <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
                                    <circle cx="50" cy="50" r="40" fill="transparent" stroke="currentColor" strokeWidth="12" className="text-blue-primary/20" />
                                    {chartData.map((item, idx) => {
                                        let offset = 0;
                                        for (let i = 0; i < idx; i++) offset += chartData[i].percentage;
                                        const strokeDasharray = "251.2";
                                        const strokeDashoffset = (251.2 * (100 - item.percentage)) / 100;
                                        const rotation = (offset / 100) * 360;

                                        return (
                                            <circle
                                                key={item.name}
                                                cx="50" cy="50" r="40"
                                                fill="transparent"
                                                stroke="currentColor"
                                                strokeWidth="12"
                                                strokeDasharray={strokeDasharray}
                                                strokeDashoffset={strokeDashoffset}
                                                onMouseEnter={() => setHoveredSegment({ name: item.name, percentage: item.percentage })}
                                                onMouseLeave={() => setHoveredSegment(null)}
                                                style={{
                                                    transform: `rotate(${rotation}deg)`,
                                                    transformOrigin: 'center',
                                                    cursor: 'pointer',
                                                    transition: 'all 0.3s ease'
                                                }}
                                                className={`${item.color.replace('bg-', 'text-')} hover:stroke-[14px]`}
                                            />
                                        );
                                    })}
                                </svg>
                                <div className="absolute flex flex-col items-center pointer-events-none animate-in fade-in duration-300 w-full h-full justify-center">
                                    {displayData && (
                                        <div className="absolute inset-0 flex items-center justify-center opacity-20 -z-10 group/center rotate-12">
                                            <ArchetypeAvatar
                                                names={archetypeConfigs[displayData.name] || []}
                                                metadata={cardMetadata}
                                                size="size-48"
                                                className="blur-[2px]"
                                            />
                                        </div>
                                    )}
                                    <span className="text-5xl font-black text-white italic tracking-tighter drop-shadow-[0_0_15px_rgba(255,255,255,0.2)]">
                                        {displayData ? displayData.percentage.toFixed(0) : '0'}%
                                    </span>
                                    <span className="text-[10px] text-slate-300 font-black uppercase tracking-[0.2em] px-4 text-center truncate max-w-[150px] bg-background-dark/40 backdrop-blur-sm py-1 rounded-full mt-1 border border-white/5">
                                        {displayData ? displayData.name : 'Meta'}
                                    </span>
                                </div>
                            </div>

                            <div className="space-y-6">
                                {chartData.length > 0 ? chartData.map((item, idx) => (
                                    <div key={idx} className="space-y-2 group">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                                <ArchetypeAvatar
                                                    names={archetypeConfigs[item.name] || []}
                                                    metadata={cardMetadata}
                                                    size="size-12"
                                                    className={`border-2 shaow-lg ${item.color.replace('bg-', 'border-')}`}
                                                />
                                                <span className="text-xs font-bold text-slate-200">{item.name}</span>
                                                <button
                                                    onClick={() => openConfigModal(item.name)}
                                                    className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-white/10 rounded"
                                                >
                                                    <span className="material-symbols-outlined text-[12px] text-slate-500">settings</span>
                                                </button>
                                            </div>
                                            <span className="text-xs font-black text-white">{item.percentage.toFixed(1)}%</span>
                                        </div>
                                        <div className="w-full bg-slate-800/50 h-1.5 rounded-full overflow-hidden border border-white/5 p-[1px]">
                                            <div className={`${item.color} h-full rounded-full transition-all duration-1000 ease-out`} style={{ width: `${item.percentage}%` }}></div>
                                        </div>
                                    </div>
                                )) : (
                                    <div className="text-center py-10">
                                        <p className="text-slate-500 text-[10px] font-black uppercase tracking-[0.2em]">No data records</p>
                                        <p className="text-[9px] text-slate-600 mt-2 uppercase">Try selecting another filter</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Top Cut Table */}
                    <div className="glass rounded-xl overflow-hidden shadow-2xl border border-white/5">
                        <div className="p-6 border-b border-blue-primary/10 flex justify-between items-center">
                            <div>
                                <h2 className="text-xl font-bold text-white tracking-tight italic">Registry</h2>
                                <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest mt-1">Tournament History</p>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className={`size-2 rounded-full ${loading ? 'bg-blue-primary animate-pulse' : 'bg-emerald-500'} `}></span>
                                <span className="text-[10px] font-black uppercase text-slate-400">{loading ? 'Syncing...' : 'Live Records'}</span>
                            </div>
                        </div>
                        <div className="overflow-x-auto overflow-y-auto max-h-[600px] custom-scrollbar">
                            <table className="w-full text-left text-sm border-collapse">
                                <thead className="bg-slate-900/80 sticky top-0 z-10 backdrop-blur-sm">
                                    <tr className="text-slate-500 font-black uppercase tracking-[0.1em] text-[9px] border-b border-white/5">
                                        <th className="px-6 py-5">Event Name</th>
                                        <th className="px-6 py-5">Date</th>
                                        <th className="px-6 py-5">Player Profile</th>
                                        <th className="px-6 py-5">Deck Engine</th>
                                        <th className="px-6 py-5">Standing</th>
                                        <th className="px-6 py-5 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/5">
                                    {!loading && filteredTournaments.length > 0 ? filteredTournaments.map((tournament) => (
                                        tournament.results.map((result, rIdx) => (
                                            <tr key={`${tournament.id}-${rIdx}`} className="hover:bg-white/5 transition-all group border-l-2 border-transparent hover:border-blue-primary">
                                                <td className="px-6 py-5">
                                                    <span className="text-slate-100 font-bold group-hover:text-white">{tournament.name}</span>
                                                </td>
                                                <td className="px-6 py-5 text-slate-500 font-medium">{tournament.date}</td>
                                                <td className="px-6 py-5">
                                                    <div className="flex items-center gap-3">
                                                        <img
                                                            className="size-7 rounded-full border border-blue-primary/40 p-[1px]"
                                                            src={`https://ui-avatars.com/api/?name=${result.playerName}&background=135bec&color=fff&bold=true`}
                                                            alt="Avatar"
                                                        />
                                                        <span className="font-bold text-slate-300 group-hover:text-blue-primary font-mono text-xs">{result.playerName}</span>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-5">
                                                    <div className="flex items-center gap-2">
                                                        <ArchetypeAvatar
                                                            names={archetypeConfigs[result.archetype] || []}
                                                            metadata={cardMetadata}
                                                            size="size-5"
                                                        />
                                                        <span className="text-slate-400 font-bold text-xs">{result.archetype}</span>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-5">
                                                    <span className={`px-2.5 py-1 rounded-sm text-[9px] font-black uppercase tracking-widest ${result.top === 'Winner' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30' :
                                                        result.top === 'Finalist' ? 'bg-gold/10 text-gold border border-gold/30' :
                                                            'bg-blue-primary/10 text-blue-primary border border-blue-primary/30'
                                                        }`}>
                                                        {result.top}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-5 text-right">
                                                    <div className="flex items-center justify-end gap-2 opacity-50 group-hover:opacity-100 transition-opacity">
                                                        {isAuthorized && (
                                                            <>
                                                                <button
                                                                    onClick={() => handleEditClick(tournament)}
                                                                    className="text-slate-400 hover:text-blue-primary transition-all p-1.5 hover:bg-blue-primary/10 rounded-lg"
                                                                    title="Edit Tournament"
                                                                >
                                                                    <span className="material-symbols-outlined text-sm">edit</span>
                                                                </button>
                                                                <button
                                                                    onClick={() => deleteTournament(tournament.id)}
                                                                    className="text-slate-400 hover:text-rose-500 transition-all p-1.5 hover:bg-rose-500/10 rounded-lg"
                                                                    title="Delete Tournament"
                                                                >
                                                                    <span className="material-symbols-outlined text-sm">auto_delete</span>
                                                                </button>
                                                            </>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        ))
                                    )) : !loading && (
                                        <tr>
                                            <td colSpan={6} className="px-6 py-20 text-center text-slate-500 font-black uppercase tracking-widest text-[9px]">
                                                No archives found matching the current filters.
                                            </td>
                                        </tr>
                                    )}
                                    {loading && (
                                        <tr>
                                            <td colSpan={6} className="px-6 py-20 text-center">
                                                <div className="flex flex-col items-center gap-3">
                                                    <div className="size-8 border-2 border-blue-primary border-t-transparent rounded-full animate-spin"></div>
                                                    <span className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Accessing records...</span>
                                                </div>
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>

                <div className="space-y-8">
                    <div className="glass p-6 rounded-xl border border-gold/10 relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-24 h-24 bg-gold/5 rounded-full -mr-12 -mt-12 blur-2xl"></div>
                        <div className="flex items-center gap-3 mb-6">
                            <span className="material-symbols-outlined text-gold animate-bounce">workspace_premium</span>
                            <h2 className="text-lg font-black text-white italic uppercase tracking-tight">Top Rankers</h2>
                        </div>
                        <div className="space-y-4">
                            {topRankers.length > 0 ? topRankers.map((ranker, idx) => (
                                <div key={ranker.name} className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/5 hover:border-gold/30 transition-all">
                                    <div className="flex items-center gap-3">
                                        <div className="size-10 rounded-full border-2 border-slate-700 bg-slate-800 flex items-center justify-center text-xs font-black text-slate-300">
                                            #{idx + 1}
                                        </div>
                                        <div>
                                            <p className="text-xs font-black text-white uppercase">{ranker.name}</p>
                                            <p className="text-[9px] text-slate-500 font-bold uppercase tracking-widest">{ranker.tops} Tops</p>
                                        </div>
                                    </div>
                                    <span className="material-symbols-outlined text-gold text-lg">local_fire_department</span>
                                </div>
                            )) : (
                                <p className="text-[9px] text-slate-600 uppercase text-center py-4">Waiting for leaders...</p>
                            )}
                        </div>
                    </div>

                    <div className="glass p-6 rounded-xl border border-white/5">
                        <div className="flex items-center justify-between mb-6">
                            <h2 className="text-sm font-black text-white uppercase tracking-[0.2em] italic">Meta Trends</h2>
                            <span className="text-[10px] text-emerald-500 font-black">+ Dynamic Data</span>
                        </div>
                        <div className="space-y-3">
                            {chartData.map(deck => (
                                <div key={deck.name} className="flex items-center justify-between p-3 rounded-lg border border-white/5 hover:bg-blue-primary/5 transition-colors group relative overflow-hidden">
                                    <div className="absolute inset-0 opacity-10 group-hover:opacity-25 transition-all duration-500">
                                        <ArchetypeAvatar
                                            names={archetypeConfigs[deck.name] || []}
                                            metadata={cardMetadata}
                                            size="w-full h-full"
                                            className="rounded-none border-0 shadow-none blur-[1px] object-cover scale-150 group-hover:scale-110 transition-transform duration-700"
                                        />
                                    </div>
                                    <div className="flex items-center gap-3 relative z-10">
                                        <span className={`size-1.5 rounded-full ${deck.color}`}></span>
                                        <span className="text-xs font-bold text-slate-400 group-hover:text-white uppercase">{deck.name}</span>
                                    </div>
                                    <div className="flex items-center gap-2 relative z-10">
                                        <span className="text-[10px] font-black text-white">{deck.percentage.toFixed(1)}%</span>
                                        <span className="material-symbols-outlined text-sm text-blue-primary group-hover:translate-x-1 transition-transform">trending_up</span>
                                    </div>
                                </div>
                            ))}
                            {chartData.length === 0 && (
                                <p className="text-[9px] text-slate-600 uppercase text-center py-4 italic">No meta trends detected</p>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {showModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-background-dark/90 backdrop-blur-xl" onClick={() => { setShowModal(false); setIsEditing(false); }} />
                    <div className="glass w-full max-w-2xl rounded-2xl overflow-hidden relative z-10 shadow-[0_0_100px_rgba(19,91,236,0.2)] border border-blue-primary/30 animate-in fade-in zoom-in duration-300">
                        <div className="p-8 border-b border-white/5 flex justify-between items-center bg-blue-primary/10">
                            <div className="flex items-center gap-3">
                                <div className="size-10 rounded-xl bg-blue-primary flex items-center justify-center shadow-lg shadow-blue-primary/50">
                                    <span className="material-symbols-outlined text-white">{isEditing ? 'edit_note' : 'data_saver_on'}</span>
                                </div>
                                <div>
                                    <h2 className="text-2xl font-black text-white italic uppercase tracking-tighter">{isEditing ? 'Modify Event' : 'Event Submission'}</h2>
                                    <p className="text-blue-primary text-[10px] font-black tracking-widest uppercase">{isEditing ? 'Update Records' : 'Community Registry'}</p>
                                </div>
                            </div>
                            <button onClick={() => { setShowModal(false); setIsEditing(false); }} className="size-8 rounded-full flex items-center justify-center hover:bg-white/10 transition-colors">
                                <span className="material-symbols-outlined text-slate-400">close</span>
                            </button>
                        </div>

                        <form onSubmit={submitTournament} className="p-10 space-y-10 max-h-[75vh] overflow-y-auto custom-scrollbar">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black uppercase text-slate-500 tracking-[0.3em]">Event Designation</label>
                                    <input required type="text" value={newTournament.name} onChange={(e) => setNewTournament({ ...newTournament, name: e.target.value })} placeholder="e.g. Regional Championship" className="w-full bg-white/5 border-2 border-white/5 hover:border-blue-primary/30 rounded-xl px-5 py-4 text-sm text-white focus:border-blue-primary outline-none transition-all placeholder:text-slate-700 font-bold" />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black uppercase text-slate-500 tracking-[0.3em]">Chronology</label>
                                    <input required type="date" value={newTournament.date} onChange={(e) => setNewTournament({ ...newTournament, date: e.target.value })} className="w-full bg-white/5 border-2 border-white/5 hover:border-blue-primary/30 rounded-xl px-5 py-4 text-sm text-white focus:border-blue-primary outline-none transition-all" />
                                </div>
                            </div>

                            <div className="space-y-6">
                                <div className="flex justify-between items-end">
                                    <div>
                                        <h3 className="text-xs font-black text-white italic uppercase tracking-widest">Standing List</h3>
                                        <p className="text-[10px] text-slate-500">Add player placements for this event</p>
                                    </div>
                                    <button type="button" onClick={addPlayerRow} className="bg-blue-primary/10 hover:bg-blue-primary text-blue-primary hover:text-white px-4 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all flex items-center gap-2 border border-blue-primary/30">
                                        <span className="material-symbols-outlined text-xs">group_add</span> Add Row
                                    </button>
                                </div>

                                <div className="space-y-4">
                                    <datalist id="player-list">{savedPlayers.map(p => <option key={p} value={p} />)}</datalist>
                                    <datalist id="deck-list">{savedDecks.map(d => <option key={d} value={d} />)}</datalist>

                                    {newTournament.results.map((result, idx) => (
                                        <div key={idx} className="grid grid-cols-1 md:grid-cols-12 gap-4 p-6 bg-white/5 rounded-2xl border-2 border-white/5 relative group hover:border-blue-primary/20 transition-all">
                                            <div className="md:col-span-12 lg:md:col-span-1 flex items-center justify-center font-black text-slate-700 italic text-xl">
                                                #{idx + 1}
                                            </div>
                                            <div className="md:col-span-12 lg:md:col-span-4 space-y-1">
                                                <span className="text-[9px] font-black uppercase text-slate-600 block">Competitor</span>
                                                <input required list="player-list" type="text" value={result.playerName} onChange={(e) => handlePlayerChange(idx, 'playerName', e.target.value)} placeholder="Player Username" className="w-full bg-transparent border-b border-white/10 px-0 py-1 text-sm text-white outline-none focus:border-blue-primary transition-colors font-bold" />
                                            </div>
                                            <div className="md:col-span-12 lg:md:col-span-3 space-y-1">
                                                <span className="text-[9px] font-black uppercase text-slate-600 block">Placement</span>
                                                <select value={result.top} onChange={(e) => handlePlayerChange(idx, 'top', e.target.value)} className="w-full bg-transparent border-b border-white/10 px-0 py-1 text-sm text-white outline-none focus:border-blue-primary transition-colors font-bold cursor-pointer">
                                                    <option className="bg-slate-900">Winner</option>
                                                    <option className="bg-slate-900">Finalist</option>
                                                    <option className="bg-slate-900">Top 4</option>
                                                    <option className="bg-slate-900">Top 8</option>
                                                    <option className="bg-slate-900">Top 16</option>
                                                </select>
                                            </div>
                                            <div className="md:col-span-12 lg:md:col-span-3 space-y-1">
                                                <span className="text-[9px] font-black uppercase text-slate-600 block">Engine</span>
                                                <input required list="deck-list" type="text" value={result.archetype} onChange={(e) => handlePlayerChange(idx, 'archetype', e.target.value)} placeholder="Archetype" className="w-full bg-transparent border-b border-white/10 px-0 py-1 text-sm text-white outline-none focus:border-blue-primary transition-colors font-bold" />
                                            </div>
                                            <div className="md:col-span-12 lg:md:col-span-1 flex items-center justify-end">
                                                {newTournament.results.length > 1 && (
                                                    <button type="button" onClick={() => { const results = newTournament.results.filter((_, i) => i !== idx); setNewTournament({ ...newTournament, results }) }} className="text-slate-700 hover:text-red-500 transition-colors p-2 hover:bg-red-500/10 rounded-lg">
                                                        <span className="material-symbols-outlined text-sm">remove_circle</span>
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="pt-8 flex gap-6">
                                <button type="button" onClick={() => { setShowModal(false); setIsEditing(false); }} className="flex-1 py-4 border-2 border-white/10 rounded-2xl text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-white transition-all hover:bg-white/5">
                                    Discard
                                </button>
                                <button type="submit" className="flex-1 py-4 bg-blue-primary rounded-2xl text-[10px] font-black uppercase tracking-widest text-white shadow-2xl shadow-blue-primary/20 hover:bg-blue-primary/90 transition-all transform hover:-translate-y-1 active:translate-y-0">
                                    {isEditing ? 'Update Intelligence' : 'Transmit Data'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {showConfigModal && (
                <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-background-dark/95 backdrop-blur-md" onClick={() => setShowConfigModal(false)} />
                    <div className="glass w-full max-w-md rounded-2xl overflow-hidden relative z-10 border border-gold/30 shadow-[0_0_50px_rgba(255,184,0,0.1)]">
                        <div className="p-6 border-b border-white/5 flex justify-between items-center bg-gold/5">
                            <h2 className="text-xl font-black text-white italic uppercase tracking-tighter">Deck Configuration</h2>
                            <button onClick={() => setShowConfigModal(false)}>
                                <span className="material-symbols-outlined text-slate-400 hover:text-white transition-colors">close</span>
                            </button>
                        </div>
                        <div className="p-8 space-y-6">
                            <div className="space-y-4 text-center">
                                <div className="flex justify-center gap-4">
                                    {configCardNames.split(',').map(s => s.trim()).filter(s => s !== '').slice(0, 2).map((cardName, idx) => (
                                        <div key={idx} className="relative group/card">
                                            <div className="size-20 rounded-2xl bg-slate-800 border-2 border-gold/40 overflow-hidden shadow-lg shadow-gold/10 relative">
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
                                            <div className="absolute -bottom-2 -right-2 bg-gold text-background-dark size-6 rounded-full flex items-center justify-center text-[10px] font-black shadow-lg">
                                                {idx + 1}
                                            </div>
                                        </div>
                                    ))}
                                    {configCardNames.split(',').map(s => s.trim()).filter(s => s !== '').length === 0 && (
                                        <div className="size-20 rounded-2xl bg-gold/5 flex items-center justify-center border-2 border-dashed border-gold/20">
                                            <span className="material-symbols-outlined text-gold/30 text-3xl">style</span>
                                        </div>
                                    )}
                                </div>
                                <div>
                                    <h3 className="text-sm font-black text-white uppercase tracking-widest">{activeConfigArchetype}</h3>
                                    <p className="text-[10px] text-slate-500 mt-1 uppercase tracking-tighter">Assign signature cards to this engine</p>
                                </div>
                            </div>

                            <div className="space-y-2 relative">
                                <label className="text-[9px] font-black uppercase text-slate-500 tracking-widest">Card Names (Separate by comma)</label>
                                <input
                                    type="text"
                                    value={configCardNames}
                                    onChange={(e) => setConfigCardNames(e.target.value)}
                                    onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                                    placeholder="e.g. Snake-Eye Ash, Snake-Eye Oak"
                                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-xs text-white outline-none focus:border-gold transition-all font-bold"
                                />

                                {showSuggestions && cardSuggestions.length > 0 && (
                                    <div className="absolute left-0 right-0 top-full mt-2 glass border border-gold/30 rounded-xl overflow-hidden z-20 shadow-2xl animate-in fade-in slide-in-from-top-2 duration-200">
                                        <div className="max-h-60 overflow-y-auto custom-scrollbar">
                                            {cardSuggestions.map((card) => (
                                                <button
                                                    key={card.id}
                                                    onClick={() => selectSuggestion(card)}
                                                    className="w-full flex items-center gap-3 p-3 hover:bg-gold/10 transition-colors text-left border-b border-white/5 last:border-0"
                                                >
                                                    <img
                                                        src={card.image_url_small}
                                                        alt=""
                                                        className="size-8 rounded object-cover border border-white/10"
                                                    />
                                                    <div>
                                                        <p className="text-[11px] font-black text-white uppercase tracking-tight">{card.name}</p>
                                                        <p className="text-[9px] text-slate-500 font-bold uppercase">{card.type}</p>
                                                    </div>
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                <p className="text-[9px] text-slate-600 italic">Max 2 cards. These populate visuals in charts and trends.</p>
                            </div>

                            <button
                                onClick={saveArchetypeConfig}
                                className="w-full py-4 bg-gold rounded-xl text-[10px] font-black uppercase tracking-widest text-background-dark shadow-xl shadow-gold/10 hover:bg-gold/90 transition-all active:scale-95"
                            >
                                Save Configuration
                            </button>

                        </div>
                    </div>
                </div>
            )}
        </main>
    )
}
