import { useState, useEffect, useRef } from 'react';
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
    const [lp] = useState(8000);
    const [showExtraDeckModal, setShowExtraDeckModal] = useState(false);
    const [placingCard, setPlacingCard] = useState<{ img: string, sourceId: string } | null>(null);
    const slotHighlightClass = placingCard ? 'ring-2 ring-primary ring-offset-2 ring-offset-[#0a0a0c] cursor-pointer hover:bg-primary/20 transition-colors' : '';

    const channelRef = useRef<any>(null);
    const cardCache = useRef<Record<string, any>>({});
    const [hoveredCardDetails, setHoveredCardDetails] = useState<any>(null);

    const localStateRef = useRef({
        lp: 8000,
        deckSize: 0,
        hand: [] as string[],
        gySize: 0,
        extraSize: 0,
        fieldCards: {} as Record<string, FieldCard | undefined>
    });

    useEffect(() => {
        localStateRef.current = {
            lp,
            deckSize: deck.length,
            hand,
            gySize: gy.length,
            extraSize: extraDeck.length,
            fieldCards
        };
    }, [lp, deck.length, hand, gy.length, extraDeck.length, fieldCards]);

    const handleCardHover = async (imgUrl: string | undefined) => {
        if (!imgUrl || imgUrl.includes('card-back') || imgUrl.startsWith('data:')) return;

        const idMatch = imgUrl.match(/\/(\d+)\.jpg$/);
        if (!idMatch) return;

        const cardId = idMatch[1];
        if (cardCache.current[cardId]) {
            setHoveredCardDetails(cardCache.current[cardId]);
            return;
        }

        try {
            const res = await fetch(`https://db.ygoprodeck.com/api/v7/cardinfo.php?id=${cardId}`);
            const data = await res.json();
            if (data && data.data && data.data.length > 0) {
                cardCache.current[cardId] = data.data[0];
                setHoveredCardDetails(data.data[0]);
            }
        } catch (err) {
            console.error("Failed to fetch card info", err);
        }
    };

    const [oppState, setOppState] = useState({
        lp: 8000,
        deckSize: 0,
        hand: [] as string[],
        gySize: 0,
        extraSize: 0,
        fieldCards: {} as Record<string, FieldCard | undefined>
    });

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

    const renderOpponentSlot = (slotId: string, defaultLabel: React.ReactNode, extraClass?: string) => {
        const card = oppState.fieldCards[slotId];
        return (
            <div
                className={`card-slot rounded-lg overflow-hidden relative ${extraClass || ''}`}
                onMouseEnter={() => handleCardHover(card?.img)}
            >
                {card ? (
                    <img
                        src={card.img}
                        alt="Opponent Card"
                        className={`w-full h-full object-cover transition-transform duration-200 ${card.position === 'def' ? 'rotate-90 scale-[0.85]' : 'rotate-180'}`}
                    />
                ) : (
                    <div className="slot-label pointer-events-none opacity-50">{defaultLabel}</div>
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
        if (!room?.id || !user?.id) return;
        const subscription = supabase
            .channel(`room:${room.id}`, {
                config: {
                    broadcast: { self: true },
                },
            })
            .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'duel_rooms', filter: `id=eq.${room.id}` }, (payload) => {
                setRoom(payload.new as DuelRoom);
            })
            .on('broadcast', { event: 'sync_state' }, (payload) => {
                if (payload.payload.playerId !== user.id) {
                    setOppState(payload.payload.state);
                }
            })
            .on('broadcast', { event: 'request_sync' }, (payload) => {
                if (payload.payload.playerId !== user.id) {
                    subscription.send({
                        type: 'broadcast',
                        event: 'sync_state',
                        payload: {
                            playerId: user.id,
                            state: localStateRef.current
                        }
                    });
                }
            })
            .subscribe((status) => {
                if (status === 'SUBSCRIBED') {
                    // When we finally subscribe, ask the other player for their current state
                    subscription.send({
                        type: 'broadcast',
                        event: 'request_sync',
                        payload: { playerId: user.id }
                    });
                }
            });

        channelRef.current = subscription;

        return () => {
            supabase.removeChannel(subscription);
            channelRef.current = null;
        };
    }, [room?.id, user?.id]);

    useEffect(() => {
        if (!channelRef.current || !room || !user) return;
        channelRef.current.send({
            type: 'broadcast',
            event: 'sync_state',
            payload: {
                playerId: user.id,
                state: {
                    lp: lp,
                    deckSize: deck.length,
                    hand: hand,
                    gySize: gy.length,
                    extraSize: extraDeck.length,
                    fieldCards: fieldCards
                }
            }
        });
    }, [deck.length, hand, gy.length, extraDeck.length, fieldCards, lp, room, user]);

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

    const isHost = user?.id === room?.host_id;
    const myUsername = isHost ? room?.host_username : (room?.opponent_username || user?.user_metadata?.username || 'You');
    const myAvatar = isHost ? room?.host_avatar : (room?.opponent_avatar || user?.user_metadata?.avatar_url);
    const oppUsername = isHost ? (room?.opponent_username || 'Waiting...') : room?.host_username;
    const oppAvatar = isHost ? room?.opponent_avatar : room?.host_avatar;

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

            {/* ═══ MAIN: Left Panel + Duel Field + Right Panel ═══ */}
            <main className="flex-1 flex overflow-hidden relative">

                {/* ── LEFT PANEL: Status / Resources ── */}
                <aside className="w-72 p-6 flex flex-col gap-6 glassmorphism border-r border-[#7f13ec]/10 shrink-0">

                    {/* Turn Tracker */}
                    <div className="w-full py-2 bg-black/40 rounded-lg border border-[#00f2ff]/30 flex flex-col items-center justify-center gap-1 shadow-lg shrink-0">
                        <span className="text-[#00f2ff] font-bold animate-pulse tracking-widest text-sm">YOUR TURN</span>
                        <div className="w-1/2 h-[1px] bg-[#00f2ff]/20"></div>
                        <span className="text-white/60 text-[10px] tracking-widest">TURN 03</span>
                    </div>

                    {/* Opponent Info & LP */}
                    <div className="space-y-3">
                        <div className="flex items-center gap-3 bg-black/40 p-2 rounded-lg border border-white/5">
                            <img src={oppAvatar || `https://ui-avatars.com/api/?name=${oppUsername}&background=D4AF37&color=121212`} alt="Opponent Avatar" className="w-12 h-16 rounded object-cover border-2 border-red-500/50 shadow-[0_0_10px_rgba(239,68,68,0.3)]" />
                            <div className="flex-1 overflow-hidden">
                                <p className="text-xs text-white/60 uppercase font-bold tracking-widest truncate">{oppUsername}</p>
                            </div>
                        </div>
                        <div className="flex justify-between items-end">
                            <span className="text-2xl font-bold text-white tracking-tighter w-full text-right">{oppState.lp} <span className="text-xs text-white/40">LP</span></span>
                        </div>
                        <div className="lp-bar"><div className="lp-fill bg-red-500" style={{ width: `${Math.max(0, (oppState.lp / 8000) * 100)}%` }}></div></div>
                        <div className="flex gap-2 justify-end">
                            <div className="px-2 py-0.5 bg-white/10 rounded text-[10px] text-white/60">Hand: {oppState.hand.length}</div>
                            <div className="px-2 py-0.5 bg-white/10 rounded text-[10px] text-white/60">Deck: {oppState.deckSize}</div>
                            <div className="px-2 py-0.5 bg-white/10 rounded text-[10px] text-white/60">Extra: {oppState.extraSize}</div>
                            <div className="px-2 py-0.5 bg-white/10 rounded text-[10px] text-white/60">GY: {oppState.gySize}</div>
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

                    {/* Player Info & LP */}
                    <div className="space-y-3">
                        <div className="flex gap-2 justify-start">
                            <div className="px-2 py-0.5 bg-white/10 rounded text-[10px] text-white/60">Hand: {hand.length}</div>
                            <div className="px-2 py-0.5 bg-white/10 rounded text-[10px] text-white/60">Deck: {deck.length}</div>
                            <div className="px-2 py-0.5 bg-white/10 rounded text-[10px] text-white/60">Extra: {extraDeck.length}</div>
                            <div className="px-2 py-0.5 bg-white/10 rounded text-[10px] text-white/60">GY: {gy.length}</div>
                        </div>
                        <div className="lp-bar"><div className="lp-fill bg-[#00f2ff]" style={{ width: `${Math.max(0, (lp / 8000) * 100)}%` }}></div></div>
                        <div className="flex justify-between items-end">
                            <span className="text-2xl font-bold text-white tracking-tighter w-full text-left">{lp} <span className="text-xs text-white/40">LP</span></span>
                        </div>
                        <div className="flex items-center gap-3 bg-black/40 p-2 rounded-lg border border-white/5">
                            <img src={myAvatar || `https://ui-avatars.com/api/?name=${myUsername}&background=D4AF37&color=121212`} alt="Your Avatar" className="w-12 h-16 rounded object-cover border-2 border-[#00f2ff]/50 shadow-[0_0_10px_rgba(0,242,255,0.3)]" />
                            <div className="flex-1 overflow-hidden">
                                <p className="text-xs text-[#00f2ff] uppercase font-bold tracking-widest truncate">{myUsername}</p>
                            </div>
                        </div>
                    </div>
                </aside>

                {/* ── CENTER: Duel Field ── */}
                <div className="flex-1 relative flex flex-col items-center justify-center p-4 sm:p-8 overflow-hidden min-h-0">

                    {/* Opponent Hand Display */}
                    <div className="absolute top-0 left-1/2 -translate-x-1/2 flex -space-x-8 pt-4 z-20 pointer-events-none">
                        {oppState.hand.map((_, i) => {
                            const total = oppState.hand.length;
                            const maxRot = 15;
                            const rotStep = total > 1 ? (maxRot * 2) / (total - 1) : 0;
                            const rotation = total > 1 ? -maxRot + (rotStep * i) : 0;
                            const yOffset = total > 1 ? Math.abs(i - (total - 1) / 2) * Math.abs(i - (total - 1) / 2) * 2 : 0;

                            return (
                                <div
                                    key={`opp-hand-${i}`}
                                    className="w-[60px] h-[85px] sm:w-[72px] sm:h-[104px] rounded-sm border-2 border-[#a87f4c] shadow-md shadow-black/80"
                                    style={{
                                        transform: `rotate(${180 - rotation}deg) translateY(${yOffset}px)`,
                                        transformOrigin: 'bottom center',
                                        background: 'repeating-linear-gradient(45deg, #1b0726, #1b0726 10px, #0f0314 10px, #0f0314 20px)'
                                    }}
                                />
                            );
                        })}
                    </div>

                    {/* 7-col × 5-row field grid */}
                    <div className="w-full h-full max-w-4xl max-h-[60vh] grid grid-cols-7 grid-rows-5 gap-1.5 sm:gap-2 items-center justify-items-center mt-24">

                        {/* ROW 1: Opponent Backrow */}
                        <div className="card-slot rounded-lg bg-gradient-to-br from-amber-600 to-amber-900 border-none shadow-[inset_0_0_20px_rgba(0,0,0,0.5)] flex flex-col items-center justify-center">
                            <span className="text-xs font-bold text-slate-800 border border-slate-800/40 rounded px-1 bg-white/20 mb-1">{oppState.deckSize}</span>
                            <div className="slot-label text-white/50">Deck</div>
                        </div>
                        {renderOpponentSlot('pl-pz-right', <span className="text-[#00f2ff]">P-Zone</span>, 'border-[#00f2ff]/40')}
                        {[2, 1, 0].map(i => renderOpponentSlot(`pl-st-${i}`, 'S/T'))}
                        {renderOpponentSlot('pl-pz-left', <span className="text-[#00f2ff]">P-Zone</span>, 'border-[#00f2ff]/40')}
                        <div className="card-slot rounded-lg bg-gradient-to-br from-[#a6a9b0] to-[#60656e] border-none shadow-[inset_0_0_20px_rgba(0,0,0,0.5)] flex flex-col items-center justify-center">
                            <span className="text-xs font-bold text-slate-800 border border-slate-800/40 rounded px-1 bg-white/20 mb-1">{oppState.extraSize}</span>
                            <div className="slot-label text-white/50">Extra</div>
                        </div>

                        {/* ROW 2: Opponent Monsters */}
                        <div className="card-slot rounded-lg border-[#7f13ec]/20 flex flex-col items-center justify-center">
                            <span className="text-xs font-bold text-slate-800 border border-slate-800/40 rounded px-1 bg-white/20 mb-1">{oppState.gySize}</span>
                            <div className="slot-label">GY</div>
                        </div>
                        {[4, 3, 2, 1, 0].map(i => renderOpponentSlot(`pl-mon-${i}`, 'Monster'))}
                        {renderOpponentSlot('pl-field', 'Field')}

                        {/* ROW 3: Extra Monster Zones */}
                        <div className="col-span-2"></div>
                        {fieldCards['emz-left'] ? renderFieldSlot('emz-left', <span className="text-[#00f2ff] font-bold">Extra<br />Monster</span>, 'border-[#00f2ff] shadow-[0_0_15px_rgba(0,242,255,0.2),inset_0_0_10px_rgba(0,242,255,0.1)]') :
                            oppState.fieldCards['emz-right'] ? renderOpponentSlot('emz-right', '', 'border-red-500 shadow-[0_0_15px_rgba(239,68,68,0.2)]') :
                                renderFieldSlot('emz-left', <span className="text-[#00f2ff] font-bold">Extra<br />Monster</span>, 'border-[#00f2ff] shadow-[0_0_15px_rgba(0,242,255,0.2),inset_0_0_10px_rgba(0,242,255,0.1)]')}

                        <div className="col-start-4"></div>

                        {fieldCards['emz-right'] ? renderFieldSlot('emz-right', <span className="text-[#00f2ff] font-bold">Extra<br />Monster</span>, 'border-[#00f2ff] shadow-[0_0_15px_rgba(0,242,255,0.2),inset_0_0_10px_rgba(0,242,255,0.1)]') :
                            oppState.fieldCards['emz-left'] ? renderOpponentSlot('emz-left', '', 'border-red-500 shadow-[0_0_15px_rgba(239,68,68,0.2)]') :
                                renderFieldSlot('emz-right', <span className="text-[#00f2ff] font-bold">Extra<br />Monster</span>, 'border-[#00f2ff] shadow-[0_0_15px_rgba(0,242,255,0.2),inset_0_0_10px_rgba(0,242,255,0.1)]')}
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
                </div>

                {/* ── RIGHT PANEL: Card Inspector ── */}
                <aside className="w-80 p-6 glassmorphism border-l border-[#7f13ec]/10 flex flex-col gap-4 shrink-0">
                    <div className="aspect-[2/3] w-full bg-black/40 rounded-lg border border-[#7f13ec]/40 relative group overflow-hidden">
                        <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent opacity-80 z-10"></div>
                        <img className="w-full h-full object-cover relative z-0" src={hoveredCardDetails?.card_images[0]?.image_url || INSPECTOR_IMG} alt="Card Inspector" />
                        <div className="absolute bottom-4 left-4 right-4 z-20">
                            <p className="text-[#00f2ff] font-bold text-sm leading-tight">{hoveredCardDetails?.name || 'Hover a card'}</p>
                            <p className="text-xs text-white/60">{hoveredCardDetails?.type || 'No card selected'}</p>
                        </div>
                    </div>
                    <div className="flex-1 space-y-4 overflow-y-auto custom-scrollbar pr-2">
                        {hoveredCardDetails ? (
                            <>
                                <div className="flex flex-wrap items-center gap-2">
                                    {hoveredCardDetails.race && <span className="px-2 py-0.5 bg-[#00f2ff]/20 text-[#00f2ff] text-[10px] rounded border border-[#00f2ff]/40 uppercase font-bold tracking-wider">{hoveredCardDetails.race}</span>}
                                    {hoveredCardDetails.attribute && <span className="px-2 py-0.5 bg-amber-500/20 text-amber-400 text-[10px] rounded border border-amber-500/40 uppercase font-bold tracking-wider">{hoveredCardDetails.attribute}</span>}
                                    {hoveredCardDetails.atk !== undefined && <span className="px-2 py-0.5 bg-red-500/20 text-red-400 text-[10px] rounded border border-red-500/40 uppercase font-bold tracking-wider">ATK {hoveredCardDetails.atk}</span>}
                                    {hoveredCardDetails.def !== undefined && <span className="px-2 py-0.5 bg-blue-500/20 text-blue-400 text-[10px] rounded border border-blue-500/40 uppercase font-bold tracking-wider">DEF {hoveredCardDetails.def}</span>}
                                    {hoveredCardDetails.level !== undefined && <span className="px-2 py-0.5 bg-yellow-500/20 text-yellow-400 text-[10px] rounded border border-yellow-500/40 uppercase font-bold tracking-wider">LVL {hoveredCardDetails.level}</span>}
                                </div>
                                <p className="text-xs leading-relaxed text-white/80 whitespace-pre-wrap font-sans">
                                    {hoveredCardDetails.desc}
                                </p>
                            </>
                        ) : (
                            <p className="text-xs text-white/40 text-center mt-10 px-4">Hover over any card on the field or hand to read its details.</p>
                        )}
                    </div>
                </aside>
            </main>

            {/* ═══ FOOTER: Hand Display ═══ */}
            <footer className="h-40 glassmorphism border-t border-[#7f13ec]/30 flex items-center justify-center relative overflow-visible z-40 shrink-0">
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
                                onMouseEnter={() => handleCardHover(img)}
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
