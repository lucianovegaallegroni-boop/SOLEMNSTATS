import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
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
    opponent_avatar: string | null;
    format: string;
    type: string;
    status: string;
    spectators: number;
}

// Named card slot images for demonstration
const HAND_CARD_IMAGES = [
    "https://lh3.googleusercontent.com/aida-public/AB6AXuCGpLaW5uRzCxd9vEc2kXhkA3Ws1dTYbchRL6fqyfYbBsTs5bTmq505Yu2ueoIUmrnspY5Q2iRC-cpNrVc86tQ439dudmj5NIH7h23OaKGc8Vkix3WEzpqJLS_eUGOiPb5Mkd5yFbpysI37cwla7YZHJDn9uh7kBk8t_enlpgdRIHSvSyS34Su5CFc3HBYr4o2SZegqcGiR-8n0dJ75tfIZNGD1RMcpRimCfJeOYy7KkfaZ3bNM9EpzjskRdQAWX1R5bScVdN8fQu8",
    "https://lh3.googleusercontent.com/aida-public/AB6AXuC2dBNNwoif_lHH70DyKsc0ZVHQjikyKNX8SU-v0-c4wM8aan2VE3wBNgeGfMN4ej4sfCc2re1aTyjv61NvAcAEMvYc6iohcxloFRJHVqxC0WcsTfFlyhJU3oGPR2wLqWUWm20CbP2xJgx0IGtqua47o-OaQdkTU0avR1iEDLjtWKlb2RwOoTgKHHZgQ0sQAxpUaMOqDE3OSHksntvlKEwlxFRT5u0-yN3c7Z3kVPZof2cx5i3038F-8kX3Wq3GSUqxFzA7sPGURQg",
    "https://lh3.googleusercontent.com/aida-public/AB6AXuCVVqmtHmE4W0m3GXIWxXp6Dg_KeK0ZyGn4IvR4Gvtv71kjSLAUUIQbSsRAXx9vYtkCrnbiWKtGtm75yiBSmFZgIUxdq4WzU_ga-TFYMmkjiJtaY_yJNrlFsS2zUlF8fW3N_G334Km396FH1nEkJi_YgY09Qnpcdsi3-f6LQmDKY4dJEPsQftvOknHUaRviOyZ28QfLa3g7rt9EZZYI6i0AQ1Rf6QMcUQfp9PIbyB1-UOg5v-ot3B2_u69vTP47ZnKrYpqZQ5l1l9s",
    "https://lh3.googleusercontent.com/aida-public/AB6AXuBkwCWykHuC9eVy0IfzqkGumZrd7PtaNf86CTtkojv6ldJehOoMIVrnVl3NanoAQEjTpVzm3YTtYB1OqL94tZ3tkJBOxVEPAw4WdgOq2mi2_PUpERgP_LjMSLXtaGsmGqiAmmjwQWGcXibuONRwCsyE86-sY9sY_JYeoi92a7M-RBUsoADLZTKuwfbicKMrekOKY-tHYy375HZhlIkS_dGDGBH1YiBCQeJftCWF2cn3ktV-KLm7Aim_RotZhew_qexqDtqfMjw1xJw",
    "https://lh3.googleusercontent.com/aida-public/AB6AXuA3C5m6FQrklsEZsD0_-hv6523OGPbc_KSfvxvtGl2md3pvdqIcVAYXPu_rd7iraP6PQSpi08UHkB3VaYcsqrFyN6NGH968zmwsrSa3Cz6o20NzKawhUZyIrn7xSSyXEtY95c0bZAZO98GjB531sjQided9qOcRlObwxKIe0EkkeRJXfiaTwPkPh1GbeylGz3vb-chiTJ-CvVoJpD0z-w4UdCWi0nDc99UL6DqDzHNQGN65Zx60lOLD7d2z7nM3wQx-_abGiAFe7RM",
];

export default function DuelSimulator() {
    const { id: roomCode } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { user } = useAuth();
    const [room, setRoom] = useState<DuelRoom | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!roomCode) return;

        // Initial room load (no auto-join here, just data)
        const loadRoom = async () => {
            const { data } = await supabase
                .from('duel_rooms')
                .select('*')
                .eq('room_code', roomCode)
                .single();
            if (data) setRoom(data);
            setLoading(false);
        };

        loadRoom();

        // Subscribe to this specific room's real-time changes
        const channel = supabase
            .channel(`room_${roomCode}`)
            .on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'duel_rooms',
                    filter: `room_code=eq.${roomCode}`,
                },
                (payload) => {
                    setRoom(payload.new as DuelRoom);
                }
            )
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, [roomCode]);

    // Separate effect: auto-join as opponent once user is known
    useEffect(() => {
        if (!user || !room) return;
        // Only run if this user is not the host and there is no opponent yet
        if (room.host_id === user.id || room.opponent_id) return;

        const doAutoJoin = async () => {
            const { data: updated } = await supabase
                .from('duel_rooms')
                .update({
                    opponent_id: user.id,
                    opponent_username: user.user_metadata?.username || user.email?.split('@')[0] || 'Challenger',
                    opponent_avatar: user.user_metadata?.avatar_url || null,
                    status: 'in_progress',
                })
                .eq('id', room.id)
                .select()
                .single();

            if (updated) setRoom(updated);
        };

        doAutoJoin();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user, room?.id]);

    // Determine player roles
    const isHost = user?.id === room?.host_id;
    const myUsername = isHost ? room?.host_username : (room?.opponent_username || 'Waiting...');
    const myAvatar = isHost ? room?.host_avatar : room?.opponent_avatar;
    const opponentUsername = isHost ? (room?.opponent_username || 'Waiting for opponent…') : room?.host_username;
    const opponentAvatar = isHost ? room?.opponent_avatar : room?.host_avatar;
    const opponentName = opponentUsername || 'Waiting...';

    if (loading) {
        return (
            <div className="min-h-screen bg-background-dark flex items-center justify-center">
                <div className="text-center text-slate-400">
                    <span className="material-icons text-5xl animate-spin text-primary mb-4">refresh</span>
                    <p className="font-bold">Loading duel room...</p>
                </div>
            </div>
        );
    }

    if (!room) {
        return (
            <div className="min-h-screen bg-background-dark flex items-center justify-center">
                <div className="text-center text-slate-400 space-y-4">
                    <span className="material-icons text-5xl text-slate-600">search_off</span>
                    <p className="font-bold">Room not found: <span className="text-primary font-mono">{roomCode}</span></p>
                    <button onClick={() => navigate('/lobby')} className="mt-2 bg-primary text-white px-6 py-2 rounded-lg font-bold text-sm hover:brightness-110">
                        Return to Lobby
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="bg-background-dark font-display text-slate-100 h-screen overflow-hidden flex flex-col relative w-full">
            <main className="flex-1 flex overflow-hidden relative">
                {/* Sidebar: Card Preview & Duel Log */}
                <aside className="w-80 border-r border-primary/20 flex flex-col bg-background-dark/40 backdrop-blur-sm z-10 shrink-0">
                    <div className="p-4 flex-1 overflow-y-auto space-y-4">
                        {/* Card Preview Card */}
                        <div className="glass-panel rounded-xl overflow-hidden">
                            <div className="aspect-[3/4] bg-cover relative" style={{ backgroundImage: "url('https://lh3.googleusercontent.com/aida-public/AB6AXuAwSinl0hjQkWMGcR6GKZGGPlz5R-uImRsKNF29nMzTy5MrhSGucMefpEfOonQdDWDVfZQ9W2V1pIyRI2nbySIxsNgZq-oKR44nAZRVA733KhdU8iuJMChkWAIoZN7lsGjsXmlKDAVKZ6i-tG3M-p-ZONSwniOuxkOHWaxZYzWYxfoauxRpl6lbECEpiHd27NkB06s9s2T37lgmGJy_ere5AOqqlMR7QtwqYHcpZupJH6NG24Lb8LR0cuGx3mMuQCUuRh1VqDSRfaQ')" }}>
                                <div className="absolute bottom-0 inset-x-0 p-3 bg-gradient-to-t from-black to-transparent">
                                    <h3 className="font-bold text-accent-gold">Solemn Judgment Dragon</h3>
                                    <div className="flex gap-2 text-xs font-bold">
                                        <span className="bg-primary/80 px-1 rounded">LV 8</span>
                                        <span className="bg-background-dark/80 px-1 rounded">ATK 3000 / DEF 2600</span>
                                    </div>
                                </div>
                            </div>
                            <div className="p-3 text-xs leading-relaxed text-slate-300">
                                [Dragon / Effect] Cannot be Normal Summoned/Set. Must be Special Summoned (from your hand) by having exactly 3 LIGHT monsters in your GY...
                            </div>
                        </div>

                        {/* Room Info */}
                        <div className="glass-panel rounded-xl p-3 text-xs space-y-2">
                            <div className="text-primary font-bold tracking-wider uppercase text-[10px] flex items-center gap-2">
                                <span className="material-icons text-sm">meeting_room</span> Room Info
                            </div>
                            <div className="flex justify-between"><span className="text-slate-500">Code:</span><span className="font-mono text-slate-300">{room.room_code}</span></div>
                            <div className="flex justify-between"><span className="text-slate-500">Format:</span><span className="text-slate-300">{room.format}</span></div>
                            <div className="flex justify-between"><span className="text-slate-500">Type:</span><span className="text-slate-300">{room.type}</span></div>
                            <div className="flex justify-between items-center">
                                <span className="text-slate-500">Status:</span>
                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold flex items-center gap-1 ${room.status === 'in_progress' ? 'bg-red-500/20 text-red-400' : 'bg-green-500/20 text-green-400'}`}>
                                    {room.status === 'in_progress' ? (
                                        <><span className="w-1.5 h-1.5 bg-red-400 rounded-full animate-pulse"></span> LIVE</>
                                    ) : (
                                        <><span className="w-1.5 h-1.5 bg-green-400 rounded-full"></span> Waiting</>
                                    )}
                                </span>
                            </div>
                        </div>

                        {/* Duel Log */}
                        <div className="space-y-2">
                            <h4 className="text-xs font-bold text-primary flex items-center gap-2">
                                <span className="material-icons text-sm">history</span> DUEL HISTORY
                            </h4>
                            <div className="space-y-2 text-[11px] font-mono">
                                <div className="p-2 border-l-2 border-primary/40 bg-primary/5">
                                    <span className="text-primary font-bold">Turn 5:</span> Player 2 Normal Summons "Effect Veiler".
                                </div>
                                <div className="p-2 border-l-2 border-slate-700 bg-slate-900/40">
                                    <span className="text-slate-400 font-bold">Turn 5:</span> Player 2 activates Effect of "Lumina".
                                </div>
                                <div className="p-2 border-l-2 border-accent-gold/40 bg-accent-gold/5">
                                    <span className="text-accent-gold font-bold">Turn 4:</span> Player 1 inflicts 2000 damage to Player 2.
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Deck Controls */}
                    <div className="p-4 border-t border-primary/20 space-y-3">
                        <button className="w-full py-2 bg-primary text-white rounded-lg font-bold text-sm shadow-lg shadow-primary/20 hover:brightness-110">ACTIVATE EFFECT</button>
                        <div className="grid grid-cols-2 gap-2">
                            <button className="py-2 bg-slate-800 text-slate-100 rounded-lg text-xs font-bold border border-slate-700 hover:bg-slate-700">ATTACK</button>
                            <button className="py-2 bg-slate-800 text-slate-100 rounded-lg text-xs font-bold border border-slate-700 hover:bg-slate-700">POSITION</button>
                        </div>
                    </div>
                </aside>

                {/* Duel Field Area */}
                <div className="flex-1 flex flex-col bg-background-dark relative overflow-hidden">
                    {/* Background */}
                    <div className="absolute inset-0 opacity-10 pointer-events-none" style={{ backgroundImage: "radial-gradient(#7f13ec 1px, transparent 1px)", backgroundSize: "40px 40px" }}></div>

                    {/* Waiting overlay */}
                    {room.status === 'waiting' && !room.opponent_id && (
                        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm z-40 flex items-center justify-center">
                            <div className="glass-panel rounded-2xl p-8 border border-primary/40 text-center max-w-sm mx-auto shadow-2xl shadow-primary/20">
                                <span className="material-icons text-5xl text-primary animate-pulse mb-3">radar</span>
                                <h2 className="text-xl font-bold mb-2">Waiting for opponent…</h2>
                                <p className="text-slate-400 text-sm mb-4">Share your room code!</p>
                                <div className="bg-slate-900 border border-primary/30 rounded-lg px-4 py-3 font-mono text-primary text-lg font-bold mb-4">{room.room_code}</div>
                                <button onClick={() => navigator.clipboard.writeText(room.room_code)} className="text-xs text-slate-400 hover:text-white transition-colors flex items-center gap-1 mx-auto">
                                    <span className="material-icons text-sm">content_copy</span> Copy to clipboard
                                </button>
                            </div>
                        </div>
                    )}

                    {/* ── OPPONENT HUD ── */}
                    <div className="px-4 py-1 flex justify-between items-center z-10 shrink-0 border-b border-white/5">
                        <div className="flex items-center gap-2">
                            <img src={opponentAvatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(opponentName)}&background=4b0082&color=ffffff&bold=true&size=128`} alt={opponentName} className="w-7 h-7 rounded-full border-2 border-red-500/50 object-cover" />
                            <div>
                                <p className="text-[8px] text-slate-500 font-bold tracking-widest uppercase leading-none">Opponent</p>
                                <h2 className={`text-sm font-bold leading-tight ${!room.opponent_id ? 'text-slate-600 italic' : 'text-slate-200'}`}>{opponentName}</h2>
                            </div>
                            <div className="glass-panel px-2 py-0.5 rounded border-l-2 border-l-red-500 ml-1">
                                <span className="text-[7px] text-slate-400 block leading-none">LP</span>
                                <span className="text-base font-bold text-white leading-tight">8000</span>
                            </div>
                        </div>
                        <div className="text-[8px] text-slate-700 font-mono">{room.room_code}</div>
                    </div>

                    {/* ── OPPONENT HAND ── */}
                    <div className="shrink-0 flex justify-center items-end gap-0.5 px-4 h-12 py-1 z-10">
                        {[0, 1, 2, 3, 4, 5, 6].map(i => (
                            <div key={i} className="h-full aspect-[3/4] bg-primary/10 border border-primary/20 rounded shadow" style={{ transform: `rotate(${(i - 3) * 2}deg)` }}></div>
                        ))}
                    </div>

                    {/* ── 4 ZONE ROWS + PHASE BAR ── */}
                    <div className="flex-1 flex flex-col justify-center gap-1 px-2 z-10 overflow-hidden">

                        {/* Row 1 — Opponent Spell/Trap */}
                        <div className="h-[70px] shrink-0 grid grid-cols-7 gap-1">
                            <div className="card-slot rounded h-full flex items-center justify-center border-dashed border-green-500/30 bg-green-500/5">
                                <span className="text-[6px] font-black text-green-400/50 uppercase rotate-[-90deg] whitespace-nowrap">Field</span>
                            </div>
                            {[0, 1, 2, 3, 4].map(i => <div key={i} className="card-slot rounded h-full"></div>)}
                            <div className="card-slot rounded h-full flex items-center justify-center border-dashed border-slate-500/30">
                                <span className="text-[6px] font-black text-slate-500/60 uppercase">GY</span>
                            </div>
                        </div>

                        {/* Row 2 — Opponent Monster */}
                        <div className="h-[70px] shrink-0 grid grid-cols-7 gap-1">
                            <div className="card-slot rounded h-full flex items-center justify-center border-dashed border-blue-500/30 bg-blue-500/5">
                                <span className="text-[6px] font-black text-blue-400/40 uppercase">EMZ</span>
                            </div>
                            {[0, 1, 2, 3, 4].map(i => <div key={i} className="card-slot rounded h-full"></div>)}
                            <div className="card-slot rounded h-full flex items-center justify-center border-dashed border-primary/30 bg-primary/5">
                                <span className="text-[6px] font-black text-primary/40 uppercase">EX</span>
                            </div>
                        </div>

                        {/* Phase Bar */}
                        <div className="shrink-0 glass-panel flex items-center rounded-full border-primary/20 relative py-1 my-0.5">
                            <div className="flex gap-3 mx-auto text-[9px] font-black tracking-widest uppercase items-center relative z-10 justify-center">
                                {['Draw', 'Standby', 'Main 1', 'Battle', 'Main 2', 'End'].map((phase, i) => (
                                    <span key={phase} className={i === 2 ? 'text-primary border border-primary/50 px-2 py-0.5 rounded-full text-[8px]' : 'text-slate-500 hover:text-primary cursor-pointer transition-colors text-[8px]'}>{phase}</span>
                                ))}
                            </div>
                            <button className="absolute right-3 bg-primary px-3 py-0.5 rounded-full text-[8px] font-black text-white hover:brightness-125 uppercase shadow-[0_0_12px_rgba(127,19,236,0.5)]">END TURN</button>
                        </div>

                        {/* Row 3 — Player Monster */}
                        <div className="h-[70px] shrink-0 grid grid-cols-7 gap-1">
                            <div className="card-slot rounded h-full flex items-center justify-center border-dashed border-blue-500/30 bg-blue-500/5">
                                <span className="text-[6px] font-black text-blue-400/40 uppercase">EMZ</span>
                            </div>
                            {[0, 1, 2, 3, 4].map(i => <div key={i} className={`card-slot rounded h-full ${i === 2 ? 'neon-pulse border-solid border-primary/80' : ''}`}></div>)}
                            <div className="card-slot rounded h-full flex items-center justify-center border-dashed border-primary/30 bg-primary/5">
                                <span className="text-[6px] font-black text-primary/40 uppercase">EX</span>
                            </div>
                        </div>

                        {/* Row 4 — Player Spell/Trap */}
                        <div className="h-[70px] shrink-0 grid grid-cols-7 gap-1">
                            <div className="card-slot rounded h-full flex items-center justify-center border-dashed border-green-500/30 bg-green-500/5">
                                <span className="text-[6px] font-black text-green-400/50 uppercase rotate-[-90deg] whitespace-nowrap">Field</span>
                            </div>
                            {[0, 1, 2, 3, 4].map(i => <div key={i} className="card-slot rounded h-full"></div>)}
                            <div className="card-slot rounded h-full flex items-center justify-center border-dashed border-slate-500/30">
                                <span className="text-[6px] font-black text-slate-500/60 uppercase">GY</span>
                            </div>
                        </div>
                    </div>

                    {/* ── PLAYER HAND ── */}
                    <div className="shrink-0 flex justify-center items-center gap-0.5 px-4 h-14 py-1 z-10">
                        {HAND_CARD_IMAGES.map((img, i) => (
                            <div key={i} className="h-full aspect-[3/4] bg-cover border border-primary/30 rounded shadow-xl hover:-translate-y-4 transition-all duration-200 cursor-pointer relative hover:scale-110 hover:z-50" style={{ backgroundImage: `url('${img}')`, zIndex: i + 1 }}></div>
                        ))}
                    </div>

                    {/* ── PLAYER HUD ── */}
                    <div className="px-4 py-1 flex justify-between items-center z-20 shrink-0 border-t border-white/5">
                        <div className="flex items-center gap-2">
                            <div className="glass-panel px-2 py-0.5 rounded border-l-2 border-l-primary">
                                <span className="text-[7px] text-slate-400 block leading-none">LP</span>
                                <span className="text-base font-bold text-white leading-tight">8000</span>
                            </div>
                            <img src={myAvatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(myUsername || '')}&background=4b0082&color=ffffff&bold=true&size=128`} alt={myUsername || ''} className="w-7 h-7 rounded-full border-2 border-primary/60 object-cover" />
                            <div>
                                <p className="text-[8px] text-primary font-bold tracking-widest uppercase leading-none">You</p>
                                <h2 className="text-sm font-bold text-slate-200 leading-tight">{myUsername}</h2>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-[8px] text-slate-600 font-bold uppercase">{room.format} · {room.type}</span>
                            <button onClick={() => navigate('/lobby')} className="text-[8px] text-slate-500 hover:text-primary transition-colors flex items-center gap-0.5 font-bold uppercase tracking-wider">
                                <span className="material-icons text-xs">arrow_back</span> Lobby
                            </button>
                        </div>
                    </div>
                </div>
            </main>


            {/* Footer */}
            <footer className="bg-background-dark border-t border-primary/10 px-6 py-2 flex justify-between items-center text-[10px] font-medium tracking-wider text-slate-500 uppercase z-20 shrink-0">
                <div className="flex gap-6">
                    <span>Room: {room.room_code}</span>
                    <span>Format: {room.format}</span>
                </div>
                <div className="flex gap-4 text-primary">
                    <span className="flex items-center gap-1">
                        <span className="material-icons text-sm">group</span>
                        {room.spectators} Spectators
                    </span>
                    <button onClick={() => navigate('/lobby')} className="flex items-center gap-1 text-slate-500 hover:text-primary transition-colors">
                        <span className="material-icons text-sm">arrow_back</span> Lobby
                    </button>
                </div>
            </footer>
        </div>
    );
}
