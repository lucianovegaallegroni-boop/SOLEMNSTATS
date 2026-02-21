import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

interface DuelRoom {
    id: string;
    room_code: string;
    host_id: string;
    host_username: string;
    host_avatar: string | null;
    opponent_id: string | null;
    opponent_username: string | null;
    format: string;
    type: string;
    status: string;
    spectators: number;
    created_at: string;
}

function generateRoomCode(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    const part1 = Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
    const part2 = Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
    return `DUEL-${part1}-${part2}`;
}

export default function DuelLobby() {
    const navigate = useNavigate();
    const { user } = useAuth();
    const [searchQuery, setSearchQuery] = useState('');
    const [rooms, setRooms] = useState<DuelRoom[]>([]);
    const [loading, setLoading] = useState(true);
    const [formatFilter, setFormatFilter] = useState('all');
    const [typeFilter, setTypeFilter] = useState('all');
    const [hosting, setHosting] = useState(false);
    const [joinFormat, setJoinFormat] = useState('Advanced');
    const [joinType, setJoinType] = useState('Casual');
    const [showHostModal, setShowHostModal] = useState(false);

    // Load rooms from Supabase
    const fetchRooms = useCallback(async () => {
        const { data, error } = await supabase
            .from('duel_rooms')
            .select('*')
            .neq('status', 'finished')
            .order('created_at', { ascending: false });

        if (!error && data) {
            setRooms(data);
        }
        setLoading(false);
    }, []);

    useEffect(() => {
        fetchRooms();

        // Subscribe to real-time changes on duel_rooms
        const channel = supabase
            .channel('duel_rooms_lobby')
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'duel_rooms' },
                (payload) => {
                    if (payload.eventType === 'INSERT') {
                        setRooms(prev => [payload.new as DuelRoom, ...prev]);
                    } else if (payload.eventType === 'UPDATE') {
                        setRooms(prev => prev.map(r => r.id === (payload.new as DuelRoom).id ? payload.new as DuelRoom : r));
                    } else if (payload.eventType === 'DELETE') {
                        setRooms(prev => prev.filter(r => r.id !== payload.old.id));
                    }
                }
            )
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, [fetchRooms]);

    const handleHostMatch = async () => {
        if (!user) { navigate('/login'); return; }
        setHosting(true);

        const room_code = generateRoomCode();
        const { error } = await supabase.from('duel_rooms').insert({
            room_code,
            host_id: user.id,
            host_username: user.user_metadata?.username || user.email?.split('@')[0] || 'Unknown',
            host_avatar: user.user_metadata?.avatar_url || null,
            format: joinFormat,
            type: joinType,
            status: 'waiting',
        });

        if (!error) {
            setShowHostModal(false);
            navigate(`/duel-simulator/${room_code}`);
        }
        setHosting(false);
    };

    const handleJoin = async (room: DuelRoom) => {
        if (!user) { navigate('/login'); return; }
        if (room.host_id === user.id) {
            // Host re-entering their own room
            navigate(`/duel-simulator/${room.room_code}`);
            return;
        }

        const { error } = await supabase.from('duel_rooms').update({
            opponent_id: user.id,
            opponent_username: user.user_metadata?.username || user.email?.split('@')[0] || 'Unknown',
            opponent_avatar: user.user_metadata?.avatar_url || null,
            status: 'in_progress',
        }).eq('id', room.id);

        if (!error) {
            navigate(`/duel-simulator/${room.room_code}`);
        }
    };

    const handleSpectate = (room: DuelRoom) => {
        navigate(`/duel-simulator/${room.room_code}`);
    };

    // Apply filters
    const filteredRooms = rooms.filter(room => {
        const matchesSearch = room.host_username.toLowerCase().includes(searchQuery.toLowerCase()) || room.format.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesFormat = formatFilter === 'all' || room.format.toLowerCase() === formatFilter;
        const matchesType = typeFilter === 'all' || room.type.toLowerCase() === typeFilter;
        return matchesSearch && matchesFormat && matchesType;
    });

    return (
        <div className="bg-background-dark text-slate-100 min-h-[calc(100vh-64px)] p-6 lg:p-8 relative overflow-hidden flex flex-col items-center">
            {/* Background Decoration */}
            <div className="absolute inset-0 opacity-5 pointer-events-none" style={{ backgroundImage: "radial-gradient(#7f13ec 1px, transparent 1px)", backgroundSize: "40px 40px" }}></div>

            {/* Host Modal */}
            {showHostModal && (
                <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="glass-panel rounded-2xl p-6 w-full max-w-sm border border-primary/30 shadow-2xl shadow-primary/10">
                        <h2 className="text-xl font-bold mb-4">Host a New Match</h2>
                        <div className="space-y-4">
                            <div>
                                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1">Format</label>
                                <select value={joinFormat} onChange={e => setJoinFormat(e.target.value)} className="w-full bg-slate-900 border border-slate-700 text-slate-200 rounded-lg px-4 py-2.5 outline-none focus:border-primary">
                                    <option>Advanced</option>
                                    <option>GOAT</option>
                                    <option>Edison</option>
                                    <option>Traditional</option>
                                </select>
                            </div>
                            <div>
                                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1">Type</label>
                                <select value={joinType} onChange={e => setJoinType(e.target.value)} className="w-full bg-slate-900 border border-slate-700 text-slate-200 rounded-lg px-4 py-2.5 outline-none focus:border-primary">
                                    <option>Casual</option>
                                    <option>Ranked</option>
                                </select>
                            </div>
                        </div>
                        <div className="flex gap-3 mt-6">
                            <button onClick={() => setShowHostModal(false)} className="flex-1 py-2.5 rounded-lg border border-slate-700 text-slate-400 hover:text-slate-200 hover:border-slate-500 transition-colors font-bold text-sm">Cancel</button>
                            <button onClick={handleHostMatch} disabled={hosting} className="flex-1 py-2.5 rounded-lg bg-primary text-white font-bold text-sm hover:brightness-110 disabled:opacity-50">
                                {hosting ? 'Creating...' : 'Start Room'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <div className="w-full max-w-5xl z-10 flex flex-col gap-8">
                {/* Header */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 border-b border-primary/20 pb-6">
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight text-white flex items-center gap-3">
                            <span className="material-icons text-primary text-4xl">radar</span>
                            Duel Lobby
                        </h1>
                        <p className="text-slate-400 mt-2 text-sm flex items-center gap-2">
                            Find an opponent or broadcast your duel to the world.
                            <span className="flex items-center gap-1 text-xs text-green-400 bg-green-500/10 px-2 py-0.5 rounded-full border border-green-500/20">
                                <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse inline-block"></span>
                                LIVE
                            </span>
                        </p>
                    </div>
                    <button
                        onClick={() => user ? setShowHostModal(true) : navigate('/login')}
                        className="bg-primary hover:bg-primary/80 transition-colors text-white px-6 py-2.5 rounded-lg font-bold flex items-center gap-2 shadow-[0_0_15px_rgba(127,19,236,0.3)] hover:shadow-[0_0_20px_rgba(127,19,236,0.5)]"
                    >
                        <span className="material-icons text-sm">add</span>
                        HOST MATCH
                    </button>
                </div>

                {/* Filters & Search */}
                <div className="flex flex-col sm:flex-row gap-4">
                    <div className="relative flex-1">
                        <span className="material-icons absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">search</span>
                        <input
                            type="text"
                            placeholder="Search by Host or Format..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full bg-slate-900/50 border border-slate-700 focus:border-primary text-slate-200 rounded-lg pl-10 pr-4 py-2.5 outline-none transition-colors"
                        />
                    </div>
                    <div className="flex gap-2">
                        <select value={formatFilter} onChange={e => setFormatFilter(e.target.value)} className="bg-slate-900/50 border border-slate-700 focus:border-primary text-slate-200 rounded-lg px-4 py-2.5 outline-none transition-colors cursor-pointer">
                            <option value="all">All Formats</option>
                            <option value="advanced">Advanced</option>
                            <option value="goat">GOAT</option>
                            <option value="edison">Edison</option>
                        </select>
                        <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)} className="bg-slate-900/50 border border-slate-700 focus:border-primary text-slate-200 rounded-lg px-4 py-2.5 outline-none transition-colors cursor-pointer">
                            <option value="all">Any Type</option>
                            <option value="ranked">Ranked</option>
                            <option value="casual">Casual</option>
                        </select>
                    </div>
                </div>

                {/* Room List */}
                <div className="grid grid-cols-1 gap-4">
                    {loading ? (
                        <div className="py-12 text-center text-slate-500">
                            <span className="material-icons text-4xl opacity-50 animate-spin mb-3">refresh</span>
                            <p>Loading rooms...</p>
                        </div>
                    ) : filteredRooms.length > 0 ? (
                        filteredRooms.map(room => (
                            <div
                                key={room.id}
                                className="glass-panel rounded-xl p-5 border border-primary/20 hover:border-primary/50 transition-all flex flex-col md:flex-row justify-between items-start md:items-center gap-4 group"
                            >
                                <div className="flex items-center gap-4">
                                    <img
                                        src={room.host_avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(room.host_username)}&background=4b0082&color=ffffff&bold=true&size=128`}
                                        alt={room.host_username}
                                        className="w-12 h-12 rounded-full border-2 border-primary/50 object-cover flex-shrink-0"
                                    />
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <h3 className="font-bold text-lg text-slate-100">{room.host_username}</h3>
                                            <span className={`text-[10px] px-2 py-0.5 rounded font-bold ${room.type === 'Ranked' ? 'bg-accent-gold/20 text-accent-gold border border-accent-gold/30' : 'bg-slate-700 text-slate-300'}`}>
                                                {room.type}
                                            </span>
                                            {room.status === 'in_progress' && (
                                                <span className="text-[10px] px-2 py-0.5 rounded font-bold bg-red-500/20 text-red-400 border border-red-500/30 flex items-center gap-1">
                                                    <span className="w-1 h-1 rounded-full bg-red-400 animate-pulse inline-block"></span>
                                                    LIVE
                                                </span>
                                            )}
                                        </div>
                                        <div className="flex gap-3 text-xs text-slate-400 mt-1">
                                            <span className="flex items-center gap-1"><span className="material-icons text-[14px]">category</span> {room.format}</span>
                                            {room.opponent_username && (
                                                <span className="flex items-center gap-1 text-slate-500"><span className="material-icons text-[14px]">people</span> vs {room.opponent_username}</span>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                <div className="flex flex-col md:flex-row items-start md:items-center gap-4 md:gap-8 w-full md:w-auto mt-2 md:mt-0 pt-4 md:pt-0 border-t md:border-t-0 border-slate-700/50">
                                    <div className="text-sm font-mono text-slate-500">
                                        {room.room_code}
                                    </div>

                                    {room.status === 'waiting' ? (
                                        <button
                                            onClick={() => handleJoin(room)}
                                            className="w-full md:w-auto bg-primary/10 hover:bg-primary/20 text-primary border border-primary/30 py-2 px-6 rounded-lg font-bold transition-colors ml-auto shadow-[0_0_10px_rgba(127,19,236,0)] group-hover:shadow-[0_0_15px_rgba(127,19,236,0.2)]"
                                        >
                                            {room.host_id === user?.id ? 'ENTER ROOM' : 'JOIN DUEL'}
                                        </button>
                                    ) : (
                                        <div className="flex items-center gap-4 w-full md:w-auto ml-auto">
                                            <span className="text-xs text-accent-gold flex items-center gap-1">
                                                <span className="material-icons text-[14px]">videocam</span>
                                                In Progress
                                            </span>
                                            <button
                                                onClick={() => handleSpectate(room)}
                                                className="bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-600 py-2 px-4 rounded-lg font-bold transition-colors text-xs"
                                            >
                                                SPECTATE
                                                {room.spectators > 0 && <span className="ml-1 opacity-50">({room.spectators})</span>}
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))
                    ) : (
                        <div className="py-12 text-center text-slate-500 border border-dashed border-slate-700 rounded-xl glass-panel">
                            <span className="material-icons text-4xl opacity-50 mb-3">search_off</span>
                            <p>No rooms found. Be the first to host a match!</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
