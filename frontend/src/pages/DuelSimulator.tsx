import { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { API_BASE_URL } from '../config';

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


const INSPECTOR_IMG = "https://lh3.googleusercontent.com/aida-public/AB6AXuBEO6SH4OsD-IJAe-WH8DrpwWT1-APwkY4KsKJmtwwz4cjlvaKtXHSerHtIRz42IlChyxVgEK4K_n2VRljeiorscCFq__I-Gi1RFo4CdM_pauuK3bAOilC9m_UEZ2xfddzU9Gd8j2SRldv3uvYY4nUduhBtFS5U5gJ-GL7LGSyVJ0DKS55TpTWYIttUV_yfWT3tJyrOj24LQzBlbpkdtwvCEuYFnQUS7PCdQMjygzN21bVgKHfG31MOucSHFOWsiOdyzXEjpops3kM";

export default function DuelSimulator() {
    const { id: roomCode } = useParams<{ id: string }>();
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const { user } = useAuth();
    const [room, setRoom] = useState<DuelRoom | null>(null);
    const [loading, setLoading] = useState(true);
    const [deck, setDeck] = useState<string[]>([]);
    const [hand, setHand] = useState<string[]>([]);
    const [gy, setGy] = useState<string[]>([]);

    interface FieldCard {
        img: string;
        isExtra: boolean;
        position: 'atk' | 'def';
    }
    const [fieldCards, setFieldCards] = useState<Record<string, FieldCard | undefined>>({});
    const [extraDeck, setExtraDeck] = useState<string[]>([]);
    const [showExtraDeckModal, setShowExtraDeckModal] = useState(false);
    const [placingCard, setPlacingCard] = useState<{ img: string, sourceId: string } | null>(null);
    const slotHighlightClass = placingCard ? 'ring-2 ring-primary ring-offset-2 ring-offset-[#0a0a0c] cursor-pointer hover:bg-primary/20 transition-colors' : '';

    const handleDragStart = (e: React.DragEvent, card: string, sourceId: string) => {
        e.dataTransfer.setData('cardImg', card);
        e.dataTransfer.setData('sourceId', sourceId);
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault(); // Allow drop
    };

    const handleDrop = (e: React.DragEvent, targetId: string) => {
        e.preventDefault();
        const cardImg = e.dataTransfer.getData('cardImg');
        const sourceId = e.dataTransfer.getData('sourceId');
        if (!cardImg) return;

        if (sourceId.startsWith('hand-')) {
            const handIndex = parseInt(sourceId.split('-')[1]);
            setHand(prev => prev.filter((_, idx) => idx !== handIndex));
            setFieldCards(prev => ({ ...prev, [targetId]: { img: cardImg, isExtra: false, position: 'atk' } }));
        } else if (sourceId.startsWith('extradeck-')) {
            const extraIndex = parseInt(sourceId.split('-')[1]);
            setExtraDeck(prev => prev.filter((_, idx) => idx !== extraIndex));
            setFieldCards(prev => ({ ...prev, [targetId]: { img: cardImg, isExtra: true, position: 'atk' } }));
            setShowExtraDeckModal(false);
        } else if (sourceId.startsWith('field-')) {
            const actualSourceId = sourceId.replace('field-', '');
            if (actualSourceId !== targetId) {
                setFieldCards(prev => {
                    const newField = { ...prev };
                    const movingCard = newField[actualSourceId];
                    if (movingCard) {
                        newField[targetId] = { ...movingCard };
                    } else {
                        newField[targetId] = { img: cardImg, isExtra: false, position: 'atk' };
                    }
                    newField[actualSourceId] = undefined;
                    return newField;
                });
            }
        }
    };

    const handleSlotClick = (targetId: string) => {
        if (!placingCard) return;
        const { img: cardImg, sourceId } = placingCard;

        let isExtra = false;
        let position: 'atk' | 'def' = 'atk';

        if (sourceId.startsWith('hand-')) {
            const handIndex = parseInt(sourceId.split('-')[1]);
            setHand(prev => prev.filter((_, idx) => idx !== handIndex));
            isExtra = false;
        } else if (sourceId.startsWith('extradeck-')) {
            const extraIndex = parseInt(sourceId.split('-')[1]);
            setExtraDeck(prev => prev.filter((_, idx) => idx !== extraIndex));
            isExtra = true;
        } else if (sourceId.startsWith('field-')) {
            const actualSourceId = sourceId.replace('field-', '');
            if (actualSourceId === targetId) {
                setPlacingCard(null); // Cancel click on same slot
                return;
            }
            if (fieldCards[actualSourceId]) {
                isExtra = fieldCards[actualSourceId]!.isExtra;
                position = fieldCards[actualSourceId]!.position;
            }
            setFieldCards(prev => {
                const newField = { ...prev };
                newField[actualSourceId] = undefined;
                return newField;
            });
        }
        setFieldCards(prev => ({ ...prev, [targetId]: { img: cardImg, isExtra, position } }));
        setPlacingCard(null);
        setShowExtraDeckModal(false);
    };

    const handleCardAction = (slotId: string, action: 'atk' | 'def' | 'gy' | 'hand' | 'deck' | 'extradeck') => {
        const card = fieldCards[slotId];
        if (!card) return;

        if (action === 'atk' || action === 'def') {
            setFieldCards(prev => ({
                ...prev,
                [slotId]: { ...card, position: action }
            }));
            return;
        }

        // Move to somewhere else
        setFieldCards(prev => {
            const newField = { ...prev };
            newField[slotId] = undefined;
            return newField;
        });

        if (action === 'gy') {
            setGy(prev => [...prev, card.img]);
        } else if (action === 'hand') {
            setHand(prev => [...prev, card.img]);
        } else if (action === 'deck') {
            setDeck(prev => [...prev, card.img]);
        } else if (action === 'extradeck') {
            setExtraDeck(prev => [...prev, card.img]);
        }
    };

    const renderFieldSlot = (slotId: string, defaultLabel: React.ReactNode, extraClass?: string) => {
        const card = fieldCards[slotId];
        return (
            <div
                className={`card-slot rounded-lg overflow-hidden relative group ${extraClass || ''} ${slotHighlightClass}`}
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, slotId)}
                onClick={() => handleSlotClick(slotId)}
            >
                {card ? (
                    <>
                        <img
                            src={card.img}
                            alt="Card"
                            className={`w-full h-full object-cover transition-transform duration-200 ${card.position === 'def' ? 'rotate-90 scale-[0.85]' : ''}`}
                            draggable
                            onDragStart={(e) => handleDragStart(e, card.img, `field-${slotId}`)}
                        />
                        {/* Context Menu Overlay */}
                        <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-10 p-1 pointer-events-auto">
                            <button
                                onClick={(e) => { e.stopPropagation(); handleCardAction(slotId, card.position === 'atk' ? 'def' : 'atk'); }}
                                className="text-[10px] w-full bg-white/10 hover:bg-white/30 text-white rounded py-[2px] mb-1 transition-colors font-bold uppercase"
                            >
                                Change {card.position === 'atk' ? 'DEF' : 'ATK'}
                            </button>
                            <button
                                onClick={(e) => { e.stopPropagation(); handleCardAction(slotId, 'gy'); }}
                                className="text-[10px] w-full bg-red-900/60 hover:bg-red-500 text-white rounded py-[2px] transition-colors uppercase font-bold"
                            >
                                To GY
                            </button>
                            <button
                                onClick={(e) => { e.stopPropagation(); handleCardAction(slotId, card.isExtra ? 'extradeck' : 'hand'); }}
                                className="text-[10px] w-full bg-blue-900/60 hover:bg-blue-500 text-white rounded py-[2px] transition-colors uppercase font-bold"
                            >
                                To {card.isExtra ? 'Extra' : 'Hand'}
                            </button>
                            {!card.isExtra && (
                                <button
                                    onClick={(e) => { e.stopPropagation(); handleCardAction(slotId, 'deck'); }}
                                    className="text-[10px] w-full bg-amber-900/60 hover:bg-amber-500 text-white rounded py-[2px] transition-colors uppercase font-bold"
                                >
                                    To Deck
                                </button>
                            )}
                        </div>
                    </>
                ) : (
                    <div className="slot-label pointer-events-none">{defaultLabel}</div>
                )}
            </div>
        );
    };

    useEffect(() => {
        const deckId = searchParams.get('deckId');
        if (!deckId) return;

        // Fetch deck and initialize cards
        fetch(`${API_BASE_URL}/api/deck/${deckId}`)
            .then(res => res.json())
            .then(data => {
                if (data && data.cards) {
                    let mainImages: string[] = [];
                    let extraImages: string[] = [];

                    data.cards.forEach((c: any) => {
                        const qty = c.quantity || 1;
                        for (let i = 0; i < qty; i++) {
                            if (c.imageUrl) {
                                if (c.area === 'EXTRA') {
                                    extraImages.push(c.imageUrl);
                                } else if (c.area === 'MAIN') {
                                    mainImages.push(c.imageUrl);
                                }
                            }
                        }
                    });

                    // Shuffle main deck (Fisher-Yates)
                    for (let i = mainImages.length - 1; i > 0; i--) {
                        const j = Math.floor(Math.random() * (i + 1));
                        [mainImages[i], mainImages[j]] = [mainImages[j], mainImages[i]];
                    }

                    // Draw 5 to hand
                    setHand(mainImages.slice(0, 5));
                    setDeck(mainImages.slice(5));
                    setExtraDeck(extraImages);
                }
            })
            .catch(err => console.error("Error fetching selected deck:", err));
    }, [searchParams]);

    useEffect(() => {
        if (!roomCode) return;
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

    useEffect(() => {
        if (!room) return;
        const subscription = supabase
            .channel(`room:${room.id}`)
            .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'duel_rooms', filter: `id=eq.${room.id}` }, (payload) => {
                setRoom(payload.new as DuelRoom);
            })
            .subscribe();

        return () => {
            supabase.removeChannel(subscription);
        };
    }, [room]);

    // Auto-join as opponent
    useEffect(() => {
        if (!user || !room) return;
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
    const isPlayer1 = true; // For now, you are always player on bottom
    const p1State = {
        lp: 8000,
        handCount: hand.length,
        deckCount: deck.length,
        gyCount: gy.length,
        extraDeckCount: extraDeck.length,
        username: user?.user_metadata?.username || user?.email?.split('@')[0] || 'You',
        avatar: user?.user_metadata?.avatar_url || null,
    };

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

    // Fan-spread rotation for hand cards


    return (
        <div className="h-screen overflow-hidden flex flex-col" style={{
            backgroundColor: '#0a0a0c',
            backgroundImage: 'radial-gradient(circle at 50% 50%, rgba(127, 19, 236, 0.1), transparent), linear-gradient(rgba(127, 19, 236, 0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(127, 19, 236, 0.05) 1px, transparent 1px)',
            backgroundSize: '100% 100%, 40px 40px, 40px 40px',
            color: '#e2e8f0',
            fontFamily: "'Space Grotesk', sans-serif"
        }}>

            {/* Waiting overlay */}
            {room.status === 'waiting' && !room.opponent_id && (
                <div className="absolute inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center">
                    <div className="glassmorphism rounded-2xl p-8 text-center max-w-sm mx-auto">
                        <span className="material-icons text-5xl text-[#7f13ec] animate-pulse mb-3">radar</span>
                        <h2 className="text-xl font-bold mb-2">Waiting for opponent…</h2>
                        <p className="text-white/60 text-sm mb-4">Share your room code!</p>
                        <div className="bg-black/40 border border-[#7f13ec]/30 rounded-lg px-4 py-3 font-mono text-[#7f13ec] text-lg font-bold mb-4">{room.room_code}</div>
                        <button onClick={() => navigator.clipboard.writeText(room.room_code)} className="text-xs text-white/40 hover:text-white transition-colors flex items-center gap-1 mx-auto">
                            <span className="material-icons text-sm">content_copy</span> Copy to clipboard
                        </button>
                    </div>
                </div>
            )}

            {/* ═══ HEADER ═══ */}
            <header className="p-4 flex justify-between items-center glassmorphism z-40 border-b border-[#7f13ec]/20 shrink-0">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-[#7f13ec] rounded-lg flex items-center justify-center shadow-[0_0_15px_rgba(127,19,236,0.5)]">
                        <span className="text-white font-bold text-xl">S</span>
                    </div>
                    <h1 className="text-2xl font-bold tracking-tighter text-white">SolemnStats</h1>
                </div>
                {/* Turn Tracker */}
                <div className="absolute left-1/2 -translate-x-1/2 px-8 py-2 glassmorphism rounded-full border border-[#00f2ff]/30 flex items-center gap-4">
                    <span className="text-[#00f2ff] font-bold animate-pulse">YOUR TURN</span>
                    <div className="h-4 w-[1px] bg-white/20"></div>
                    <span className="text-white/60 text-sm">TURN 03</span>
                </div>
                <div className="flex items-center gap-6">
                    <div className="text-right">
                        <p className="text-xs text-white/40 uppercase">Connection</p>
                        <p className="text-green-400 font-mono text-sm">STABLE: 24ms</p>
                    </div>
                    <button className="bg-[#7f13ec]/20 hover:bg-[#7f13ec]/40 border border-[#7f13ec]/50 px-4 py-2 rounded-lg text-sm font-medium transition-all">Settings</button>
                </div>
            </header>

            {/* ═══ MAIN: Left Panel + Duel Field + Right Panel ═══ */}
            <main className="flex-1 flex overflow-hidden relative">

                {/* ── LEFT PANEL: Status / Resources ── */}
                <aside className="w-72 p-6 flex flex-col gap-6 glassmorphism border-r border-[#7f13ec]/10 shrink-0">
                    {/* Opponent LP */}
                    <div className="space-y-2">
                        <div className="flex justify-between items-end">
                            <span className="text-white/60 text-xs uppercase font-bold tracking-widest">Opponent</span>
                            <span className="text-2xl font-bold text-white tracking-tighter">8000 <span className="text-xs text-white/40">LP</span></span>
                        </div>
                        <div className="lp-bar"><div className="lp-fill"></div></div>
                        <div className="flex gap-2 pt-2">
                            <div className="w-8 h-4 bg-white/10 rounded flex items-center justify-center text-[10px]">H: 5</div>
                            <div className="w-8 h-4 bg-white/10 rounded flex items-center justify-center text-[10px]">D: 35</div>
                        </div>
                    </div>

                    {/* Duel Log */}
                    <div className="flex-1 flex flex-col min-h-0">
                        <h3 className="text-xs font-bold text-[#00f2ff] uppercase mb-3 tracking-widest flex items-center gap-2">
                            <span className="w-2 h-2 bg-[#00f2ff] rounded-full animate-ping"></span>
                            Duel Log
                        </h3>
                        <div className="flex-1 overflow-y-auto space-y-3 pr-2 custom-scrollbar">
                            <div className="p-2 bg-white/5 border-l-2 border-[#7f13ec] rounded-r text-xs">
                                <span className="text-white/40">[Turn 01]</span> Opponent normal summoned "Blue-Eyes White Dragon".
                            </div>
                            <div className="p-2 bg-white/5 border-l-2 border-[#00f2ff] rounded-r text-xs">
                                <span className="text-white/40">[Turn 02]</span> You activated "Pot of Greed". Drew 2 cards.
                            </div>
                            <div className="p-2 bg-white/5 border-l-2 border-[#7f13ec] rounded-r text-xs">
                                <span className="text-white/40">[Turn 02]</span> Opponent set 1 card to Spell/Trap zone.
                            </div>
                            <div className="p-2 bg-white/5 border-l-2 border-[#00f2ff] rounded-r text-xs">
                                <span className="text-white/40">[Turn 03]</span> Draw Phase: You drew "Forbidden Droplet".
                            </div>
                        </div>
                    </div>

                    {/* Player LP */}
                    <div className="space-y-2">
                        <div className="flex justify-between items-end">
                            <span className="text-[#00f2ff] text-xs uppercase font-bold tracking-widest">You</span>
                            <span className="text-2xl font-bold text-white tracking-tighter">8000 <span className="text-xs text-white/40">LP</span></span>
                        </div>
                        <div className="lp-bar"><div className="lp-fill"></div></div>
                    </div>
                </aside>

                {/* ── CENTER: Duel Field ── */}
                <div className="flex-1 relative flex flex-col items-center justify-center p-4 sm:p-8 overflow-hidden min-h-0">
                    {/* 7-col × 5-row field grid */}
                    <div className="w-full h-full max-w-4xl max-h-[60vh] grid grid-cols-7 grid-rows-5 gap-1.5 sm:gap-2 items-center justify-items-center">

                        {/* ROW 1: Opponent Backrow */}
                        <div className="card-slot rounded-lg bg-gradient-to-br from-amber-600 to-amber-900 border-none shadow-[inset_0_0_20px_rgba(0,0,0,0.5)]">
                            <div className="slot-label text-white/50">Deck</div>
                        </div>
                        <div className="card-slot rounded-lg border-[#00f2ff]/40">
                            <div className="slot-label text-[#00f2ff]">P-Zone</div>
                        </div>
                        {[0, 1, 2].map(i => (
                            <div key={`opp-st-${i}`} className="card-slot rounded-lg">
                                <div className="slot-label">S/T</div>
                            </div>
                        ))}
                        <div className="card-slot rounded-lg border-[#00f2ff]/40">
                            <div className="slot-label text-[#00f2ff]">P-Zone</div>
                        </div>
                        <div className="card-slot rounded-lg bg-gradient-to-br from-slate-400 to-slate-600 border-none shadow-[inset_0_0_20px_rgba(0,0,0,0.5)]">
                            <div className="slot-label text-white/50">Extra</div>
                        </div>

                        {/* ROW 2: Opponent Monsters */}
                        <div className="card-slot rounded-lg border-[#7f13ec]/20">
                            <div className="slot-label">GY</div>
                        </div>
                        {[0, 1, 2, 3, 4].map(i => (
                            <div key={`opp-mon-${i}`} className="card-slot rounded-lg">
                                <div className="slot-label">Monster</div>
                            </div>
                        ))}
                        <div className="card-slot rounded-lg">
                            <div className="slot-label">Field</div>
                        </div>

                        {/* ROW 3: Extra Monster Zones */}
                        <div className="col-span-2"></div>
                        {renderFieldSlot('emz-left', <span className="text-[#00f2ff] font-bold">Extra<br />Monster</span>, 'border-[#00f2ff] shadow-[0_0_15px_rgba(0,242,255,0.2),inset_0_0_10px_rgba(0,242,255,0.1)]')}
                        <div className="col-start-4"></div>
                        {renderFieldSlot('emz-right', <span className="text-[#00f2ff] font-bold">Extra<br />Monster</span>, 'border-[#00f2ff] shadow-[0_0_15px_rgba(0,242,255,0.2),inset_0_0_10px_rgba(0,242,255,0.1)]')}
                        <div className="col-span-2"></div>

                        {/* ROW 4: Player Monsters */}
                        {renderFieldSlot('pl-field', 'Field')}
                        {[0, 1, 2, 3, 4].map(i => renderFieldSlot(`pl-mon-${i}`, 'Monster'))}
                        <div className="card-slot rounded-lg border-[#7f13ec]/20 relative">
                            <div className="absolute top-1 right-2 text-xs font-bold text-slate-800 border border-slate-800/40 rounded px-1 bg-white/20">{gy.length}</div>
                            <div className="slot-label">GY</div>
                        </div>

                        {/* ROW 5: Player Backrow */}
                        <div
                            className={`card-slot rounded-lg bg-gradient-to-br from-[#a6a9b0] to-[#60656e] shadow-[inset_0_0_20px_rgba(0,0,0,0.3)] border-none relative group cursor-pointer hover:scale-105 transition-transform ${placingCard && placingCard.sourceId.startsWith('extradeck-') ? 'ring-2 ring-primary ring-offset-2 ring-offset-black' : ''}`}
                            onClick={() => {
                                if (extraDeck.length > 0 && !placingCard) {
                                    setShowExtraDeckModal(true);
                                } else if (placingCard) {
                                    if (placingCard.sourceId.startsWith('extradeck-')) {
                                        setPlacingCard(null); // Cancel
                                    }
                                }
                            }}
                        >
                            <div className="absolute top-1 right-2 text-xs font-bold text-slate-800 border border-slate-800/40 rounded px-1 bg-white/20">{extraDeck.length}</div>
                            <div className="slot-label text-white/50 mix-blend-overlay">Extra</div>
                        </div>
                        {renderFieldSlot('pl-pz-left', <span className="text-[#00f2ff]">P-Zone</span>, 'border-[#00f2ff]/40')}
                        {[0, 1, 2].map(i => renderFieldSlot(`pl-st-${i}`, 'S/T'))}
                        {renderFieldSlot('pl-pz-right', <span className="text-[#00f2ff]">P-Zone</span>, 'border-[#00f2ff]/40')}
                        {/* Player Deck - Interactive drawing */}
                        <div
                            className="card-slot rounded-lg bg-gradient-to-br from-[#efcc99] to-[#bf854b] shadow-[inset_0_0_20px_rgba(0,0,0,0.3)] border-none relative group cursor-pointer hover:scale-105 transition-transform"
                            onClick={() => {
                                if (deck.length > 0) {
                                    setHand([...hand, deck[0]]);
                                    setDeck(deck.slice(1));
                                }
                            }}
                        >
                            <div className="absolute top-1 right-2 text-xs font-bold text-amber-900 border border-amber-900/40 rounded px-1 bg-white/20">{deck.length}</div>
                            <div className="slot-label text-amber-900 font-bold mix-blend-overlay">Deck</div>
                        </div>
                    </div>

                    {/* Action Overlay (Bottom Right) */}
                    <div className="absolute right-8 top-1/2 -translate-y-1/2 flex flex-col gap-2 z-20 w-48">
                        <button className="bg-[#7f13ec] hover:bg-white hover:text-[#7f13ec] px-4 py-3 rounded-md font-bold shadow-lg transition-all text-sm uppercase tracking-tighter">Attack</button>
                        <button className="glassmorphism hover:bg-[#00f2ff] hover:text-black px-4 py-3 rounded-md font-bold border border-[#00f2ff]/50 transition-all text-sm uppercase tracking-tighter">Activate Effect</button>
                        <button className="glassmorphism hover:bg-white/10 px-4 py-3 rounded-md font-bold border border-white/20 transition-all text-sm uppercase tracking-tighter">Set / Position</button>
                        <button className="bg-red-900/60 hover:bg-red-600 px-4 py-3 rounded-md font-bold border border-red-500/50 transition-all text-sm uppercase tracking-tighter mt-2">End Phase</button>
                    </div>
                </div>

                {/* ── RIGHT PANEL: Card Inspector ── */}
                <aside className="w-80 p-6 glassmorphism border-l border-[#7f13ec]/10 flex flex-col gap-4 shrink-0">
                    <div className="aspect-[2/3] w-full bg-black/40 rounded-lg border border-[#7f13ec]/40 relative group overflow-hidden">
                        <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent opacity-80"></div>
                        <img className="w-full h-full object-cover" src={INSPECTOR_IMG} alt="Card Inspector" />
                        <div className="absolute bottom-4 left-4 right-4">
                            <p className="text-[#00f2ff] font-bold text-sm">Forbidden Droplet</p>
                            <p className="text-xs text-white/60">Quick-Play Spell</p>
                        </div>
                    </div>
                    <div className="flex-1 space-y-4 overflow-y-auto custom-scrollbar pr-2">
                        <div className="flex items-center gap-2">
                            <span className="px-2 py-0.5 bg-[#00f2ff]/20 text-[#00f2ff] text-[10px] rounded border border-[#00f2ff]/40 uppercase font-bold">Quick-Play</span>
                            <span className="px-2 py-0.5 bg-white/10 text-white/60 text-[10px] rounded border border-white/10 uppercase font-bold">ROTD-EN065</span>
                        </div>
                        <p className="text-xs leading-relaxed text-white/80">
                            Send any number of other cards from your hand and/or field to the GY; choose that many Effect Monsters your opponent controls, and until the end of this turn, their ATK is halved, also their effects are negated. In response to this card's activation, your opponent cannot activate cards, or the effects of cards, with the same original type (Monster/Spell/Trap) as the cards sent to the GY to activate this card.
                        </p>
                    </div>
                </aside>
            </main >

            {/* ═══ FOOTER: Hand Display ═══ */}
            < footer className="h-40 glassmorphism border-t border-[#7f13ec]/30 flex items-center justify-center relative overflow-visible z-40 shrink-0" >
                <div className="player-hand-container flex -space-x-10 pb-8">
                    {hand.map((img, i) => {
                        // Dynamically calculate fan spread rotation based on hand size
                        const total = hand.length;
                        const maxRot = 15;
                        const rotStep = total > 1 ? (maxRot * 2) / (total - 1) : 0;
                        const rotation = total > 1 ? -maxRot + (rotStep * i) : 0;
                        const yOffset = total > 1 ? Math.abs(i - (total - 1) / 2) * Math.abs(i - (total - 1) / 2) * 2 : 0;

                        return (
                            <div
                                key={i}
                                className={`hand-card flex flex-col items-center justify-center p-1 cursor-pointer transition-transform hover:-translate-y-4`}
                                style={{
                                    transform: `rotate(${rotation}deg) translateY(${yOffset}px)`,
                                    ...(i === hand.length - 1 ? { borderColor: 'rgba(0, 242, 255, 0.6)', boxShadow: '0 0 20px rgba(0,242,255,0.3)' } : {})
                                }}
                                draggable
                                onDragStart={(e) => handleDragStart(e, img, `hand-${i}`)}
                                onClick={() => setPlacingCard({ img, sourceId: `hand-${i}` })}
                            >
                                <img className={`w-full h-full object-cover rounded pointer-events-none transition-all ${placingCard?.sourceId === `hand-${i}` ? 'ring-4 ring-primary ring-opacity-100 ring-offset-2' : ''}`} src={img} alt={`Hand card ${i + 1}`} />
                            </div>
                        );
                    })}
                </div>
            </footer >
            <div className={`fixed inset-0 z-50 flex items-center justify-center p-4 transition-all ${showExtraDeckModal ? 'visible' : 'invisible'}`}>
                <div
                    className={`absolute inset-0 bg-black/80 backdrop-blur-sm transition-opacity ${showExtraDeckModal ? 'opacity-100' : 'opacity-0'}`}
                    onClick={() => setShowExtraDeckModal(false)}
                ></div>
                <div
                    className={`bg-[#0a0a0c] border border-[#7f13ec]/30 rounded-2xl p-6 w-full max-w-4xl shadow-2xl relative transition-all ${showExtraDeckModal ? 'opacity-100 scale-100' : 'opacity-0 scale-95 pointer-events-none'}`}
                >
                    <div className="flex justify-between items-center mb-6">
                        <h2 className="text-2xl font-bold text-white uppercase italic flex items-center gap-2"><span className="material-icons text-[#7f13ec]">style</span> Extra Deck</h2>
                        <button onClick={() => setShowExtraDeckModal(false)} className="text-slate-400 hover:text-white transition-colors"><span className="material-icons">close</span></button>
                    </div>
                    <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-4 overflow-y-auto max-h-[60vh] p-4 custom-scrollbar">
                        {extraDeck.map((img, idx) => (
                            <div key={idx} className="relative group cursor-pointer hover:-translate-y-2 transition-transform">
                                <img
                                    src={img}
                                    alt={`Extra Deck ${idx}`}
                                    className={`w-full h-auto rounded-lg shadow-lg border-2 ${placingCard?.sourceId === `extradeck-${idx}` ? 'border-[#7f13ec] shadow-[0_0_15px_rgba(127,19,236,0.6)]' : 'border-transparent'}`}
                                    draggable
                                    onDragStart={(e) => {
                                        handleDragStart(e, img, `extradeck-${idx}`);
                                        setShowExtraDeckModal(false);
                                    }}
                                    onClick={() => {
                                        setPlacingCard({ img, sourceId: `extradeck-${idx}` });
                                        setShowExtraDeckModal(false); // Close immediately so they can see field
                                    }}
                                />
                            </div>
                        ))}
                    </div>
                    {extraDeck.length === 0 && (
                        <div className="text-center text-slate-500 py-12">
                            <span className="material-icons text-5xl opacity-30 mb-2">style</span>
                            <p className="font-bold">No cards in Extra Deck</p>
                        </div>
                    )}
                </div>
            </div>
        </div >
    );
}
