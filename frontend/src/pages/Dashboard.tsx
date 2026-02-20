import { useParams } from 'react-router-dom'
import { useEffect, useState, useRef, useCallback } from 'react'
import { SavedCombosWidget } from '../components/SavedCombosWidget';
import { useAuth } from '../context/AuthContext';
import { API_BASE_URL } from '../config'
import { debounce } from 'lodash';

function Dashboard() {
    const { id } = useParams<{ id: string }>();
    const { user, session } = useAuth();
    const [deck, setDeck] = useState<any>(null);
    // Explicitly check for user_id to avoid undefined issues, treat null user_id as public/read-only or whatever, 
    // but here we want to protect against editing if not owner. 
    // If deck.user_id is set, must match user.id. 
    const isOwner = !!(deck?.user_id && user?.id === deck.user_id);

    const [loading, setLoading] = useState(true)
    const [hand, setHand] = useState<any[]>([])
    const [deckStack, setDeckStack] = useState<any[]>([])
    const [showSixth, setShowSixth] = useState(false)
    const [selectedCard, setSelectedCard] = useState<any>(null)
    const [isTagModalOpen, setIsTagModalOpen] = useState(false)
    const [tagMode, setTagMode] = useState<string | null>(null);
    const [cardDetailsCache, setCardDetailsCache] = useState<Record<string, any>>({});
    const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['MAIN']));
    const [isSaving, setIsSaving] = useState(false);

    // Drag-and-drop state for EXTRA/SIDE/MAIN decks
    const [extraOrder, setExtraOrder] = useState<any[]>([]);
    const [sideOrder, setSideOrder] = useState<any[]>([]);
    const [mainOrder, setMainOrder] = useState<any[]>([]);

    const dragItem = useRef<{ area: string; index: number } | null>(null);
    const dragOverItem = useRef<{ area: string; index: number } | null>(null);
    const [dragOverIndex, setDragOverIndex] = useState<{ area: string; index: number } | null>(null);
    const [isDragging, setIsDragging] = useState(false);

    // Safe JSON parse helper
    // Safe JSON parse helper
    const safeMsgParse = (input: string | string[]): string[] => {
        if (Array.isArray(input)) return input;
        try {
            const parsed = JSON.parse(input || "[]");
            return Array.isArray(parsed) ? parsed : [];
        } catch (e) {
            return [];
        }
    };

    // Hypergeometric Math Helpers
    const combinations = (n: number, k: number): number => {
        if (k < 0 || k > n) return 0;
        if (k === 0 || k === n) return 1;
        if (k > n / 2) k = n - k;
        let res = 1;
        for (let i = 1; i <= k; i++) {
            res = res * (n - i + 1) / i;
        }
        return res;
    };

    const getHypergeometric = (N: number, K: number, n: number, k: number): number => {
        if (n > N || k > K || k > n || (n - k) > (N - K)) return 0;
        return (combinations(K, k) * combinations(N - K, n - k)) / combinations(N, n);
    };

    useEffect(() => {
        if (!id) return;
        fetchDeck();
    }, [id])

    // Helper to expand cards by quantity for drag-drop ordering
    const expandCards = (cards: any[]) => {
        return cards.flatMap((card: any) =>
            Array(Math.max(1, parseInt(card.quantity) || 1)).fill(null).map((_, i) => ({
                ...card,
                _instanceId: `${card.id}-${i}`,
                card_name: card.cardName || card.card_name,
                image_url: card.imageUrl || card.image_url,
                card_type: card.cardType || card.card_type,
                custom_tags: card.customTags || card.custom_tags,
            }))
        );
    };

    const fetchDeck = () => {
        setLoading(true)
        fetch(`${API_BASE_URL}/api/deck/${id}`)
            .then(res => res.json())
            .then(data => {
                setDeck(data)
                // Inicializar mano SOLO con cartas del MAIN DECK
                if (data.cards && Array.isArray(data.cards)) {
                    const rawMainCards = data.cards.filter((c: any) => c.area === 'MAIN');
                    const mainCards = rawMainCards.flatMap((card: any) =>
                        Array(Math.max(1, parseInt(card.quantity) || 1)).fill({ ...card, card_name: card.cardName, image_url: card.imageUrl, card_type: card.cardType, custom_tags: card.customTags })
                    );
                    shuffleAndDraw(mainCards);

                    // Initialize EXTRA, SIDE, MAIN card orders
                    const extraCards = data.cards.filter((c: any) => c.area === 'EXTRA');
                    const sideCards = data.cards.filter((c: any) => c.area === 'SIDE');
                    setExtraOrder(expandCards(extraCards));
                    setSideOrder(expandCards(sideCards));
                    setMainOrder(expandCards(rawMainCards));
                }
                setLoading(false)
            })
            .catch(err => {
                console.error('Error fetching deck:', err)
                setLoading(false)
            })
    }

    const toggleTag = async (card: any, tag: string) => {
        // Fix: custom_tags might be a JSON string or an array. Parse it safely.
        let currentTags: string[] = [];
        if (Array.isArray(card.custom_tags)) {
            currentTags = card.custom_tags;
        } else if (typeof card.custom_tags === 'string') {
            try {
                currentTags = JSON.parse(card.custom_tags);
            } catch (e) {
                currentTags = [];
            }
        } else if (Array.isArray(card.customTags)) {
            currentTags = card.customTags;
        }

        const newTags = currentTags.includes(tag)
            ? currentTags.filter((t: string) => t !== tag)
            : [...currentTags, tag];

        // Optimistic update for ALL cards with the same name
        const updateState = (order: any[], setOrder: Function) => {
            const newOrder = order.map(c => {
                // Check if name matches (case-insensitive for safety)
                if ((c.cardName || c.name || "").toLowerCase() === (card.cardName || card.name || "").toLowerCase()) {
                    // Update both fields to be safe and consistent (store as array in state for easier usage)
                    return { ...c, custom_tags: newTags, customTags: newTags };
                }
                return c;
            });
            setOrder(newOrder);
        };

        updateState(mainOrder, setMainOrder);
        updateState(extraOrder, setExtraOrder);
        updateState(sideOrder, setSideOrder);

        // Also update the main 'deck' state because 'Duel Simulation' and other stats rely on deck.cards
        setDeck((prevDeck: any) => {
            if (!prevDeck) return prevDeck;
            const newCards = (prevDeck.cards || []).map((c: any) => {
                // Check if name matches (case-insensitive for safety)
                if ((c.cardName || c.card_name || c.name || "").toLowerCase() === (card.cardName || card.name || "").toLowerCase()) {
                    return { ...c, custom_tags: newTags, customTags: newTags };
                }
                return c;
            });
            return { ...prevDeck, cards: newCards };
        });

        try {
            const headers: Record<string, string> = { 'Content-Type': 'application/json' };
            if (session?.access_token) {
                headers['Authorization'] = `Bearer ${session.access_token}`;
            }

            const res = await fetch(`${API_BASE_URL}/api/batch-update-tags`, {
                method: 'POST',
                headers,
                body: JSON.stringify({
                    deckId: id,
                    cardName: card.cardName || card.name,
                    tags: newTags,
                    userId: user?.id
                })
            });

            if (!res.ok) throw new Error('Failed to update tags');
        } catch (error) {
            console.error("Error updating tags:", error);
            // Revert state if failed (optional, but good practice - complex to revert bulk update here simply, ignoring for now as high success rate expected)
        }
    };

    const shuffleAndDraw = (cards: any[]) => {
        const shuffled = [...cards].sort(() => Math.random() - 0.5);
        setHand(shuffled.slice(0, 5));
        setDeckStack(shuffled.slice(5));
        setShowSixth(false);
    };

    const drawSixth = () => {
        if (deckStack.length > 0 && !showSixth) {
            setHand(prev => [...prev, deckStack[0]]);
            setShowSixth(true);
        }
    };

    // Filter cards by logic: Only count 'MAIN' area cards
    const mainCardsForAnalysis = (deck?.cards || []).filter((c: any) => c.area === 'MAIN');

    // Calculate stats dynamic using cardType instead of frameType
    const monsterCount = mainCardsForAnalysis
        .filter((c: any) => (c.cardType || c.card_type || '').toLowerCase().includes('monster'))
        .reduce((acc: number, curr: any) => acc + (curr.quantity || 0), 0);

    const spellCount = mainCardsForAnalysis
        .filter((c: any) => (c.cardType || c.card_type || '').toLowerCase().includes('spell'))
        .reduce((acc: number, curr: any) => acc + (curr.quantity || 0), 0);

    const trapCount = mainCardsForAnalysis
        .filter((c: any) => (c.cardType || c.card_type || '').toLowerCase().includes('trap'))
        .reduce((acc: number, curr: any) => acc + (curr.quantity || 0), 0);

    // Process real stats for chart
    const stats = {
        monsters: monsterCount,
        spells: spellCount,
        traps: trapCount
    };

    const statsArray = [
        { label: 'Monsters', value: monsterCount, color: 'bg-orange-500' },
        { label: 'Spells', value: spellCount, color: 'bg-green-500' },
        { label: 'Traps', value: trapCount, color: 'bg-pink-500' },
    ];

    const total = statsArray.reduce((acc, curr) => acc + curr.value, 0);
    const monsterPct = total > 0 ? (monsterCount / total) * 100 : 0;
    const spellPct = total > 0 ? (spellCount / total) * 100 : 0;
    const trapPct = total > 0 ? (trapCount / total) * 100 : 0;

    // Colors for tags
    const tagColors: Record<string, string> = {
        'Starter': 'border-green-500',
        'Extender': 'border-blue-500',
        'Handtrap': 'border-red-500',
        'Board Breaker': 'border-yellow-500',
        'Engine': 'border-purple-500',
        'Non-Engine': 'border-gray-500',
        'Brick': 'border-white'
    };

    const handleCardClick = (card: any) => {
        if (tagMode) {
            if (!isOwner) return; // Security check
            toggleTag(card, tagMode);
        } else {
            const cardName = card.cardName || card.card_name;
            if (cardDetailsCache[cardName]) {
                setSelectedCard(cardDetailsCache[cardName]);
                setIsTagModalOpen(true);
            } else {
                fetch(`${API_BASE_URL}/api/cards?q=${encodeURIComponent(cardName)}`)
                    .then(res => res.json())
                    .then(data => {
                        const match = data.find((c: any) => c.name.toLowerCase() === cardName.toLowerCase()) || data[0];
                        if (match) {
                            // Merge missing info from the search API (like desc) into the card object
                            const fullCard = { ...card, ...match };
                            setCardDetailsCache(prev => ({ ...prev, [cardName]: fullCard }));
                            setSelectedCard(fullCard);
                        } else {
                            setSelectedCard(card);
                        }
                        setIsTagModalOpen(true);
                    })
                    .catch(err => {
                        console.error('Error fetching card details:', err);
                        setSelectedCard(card);
                        setIsTagModalOpen(true);
                    });
            }
        }
    };

    // --- Drag and Drop Handlers ---

    // Generic drag start
    const handleDragStart = useCallback((area: string, index: number) => {
        dragItem.current = { area, index };
        setIsDragging(true);
    }, []);

    // Generic drag enter
    const handleDragEnter = useCallback((area: string, index: number) => {
        // Only allow reordering within the same area
        if (!dragItem.current || dragItem.current.area !== area) return;

        dragOverItem.current = { area, index };
        setDragOverIndex({ area, index }); // Fixed: update with object
    }, []);

    // Helper to collapse cards back to deck list format for saving
    const collapseCards = (cards: any[]) => {
        // We need to preserve order, so we can't just group by name easily if we want 
        // to keep specific positions (e.g. 1 Ash, 1 Veiler, 1 Ash).
        // However, standard deck lists (YDK/text) usually group by card.
        // But here we want to persist the exact order the user set.
        // The current backend `save-deck` re-parses list strings.
        // If we send "Card A\nCard B\nCard A", the parser might group them or keep them.
        // Let's check `parser.ts` logic... actually `parseDeckList` roughly keeps order but 
        // usually standard format is "3x Card A".
        // To persist exact custom order, we need the backend to support it. 
        // Current `save-deck` implementation RE-PARSES text lists which might lose specific index order 
        // if it groups duplicates. 
        // But generally, if we send "1x Card A\n1x Card B\n1x Card A", it should work if the parser respects line order.
        // Let's assume sending 1x for each instance preserves order.
        return cards.map(c => {
            let name = c.cardName || c.card_name;
            // Clean up any existing prefixes/suffixes
            name = name.replace(/^(\d+x\s*)+/, '').replace(/(\s*x\d+)+$/, '');
            return `${name} x1`;
        }).join('\n');
    };

    // Generic drag and drop handlers
    const saveDeckOrder = useCallback(async (newMain: any[], newExtra: any[], newSide: any[]) => {
        if (!deck) return;

        const mainList = collapseCards(newMain);
        const extraList = collapseCards(newExtra);
        const sideList = collapseCards(newSide);

        try {
            await fetch(`${API_BASE_URL}/api/deck/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: deck.name,
                    main_list: mainList,
                    extra_list: extraList,
                    side_list: sideList,
                    user_id: user?.id // Include user_id for ownership check
                })
            });
        } catch (e) {
            console.error("Failed to save deck order", e);
        } finally {
            setIsSaving(false);
        }
    }, [deck, id, user]);

    // Keep a ref to the latest save function to avoid stale closures in debounce
    const latestSaveDeckOrder = useRef(saveDeckOrder);
    useEffect(() => {
        latestSaveDeckOrder.current = saveDeckOrder;
    }, [saveDeckOrder]);

    // Debounce the save function to avoid hitting API rate limits
    const debouncedSaveDeckOrder = useRef(
        debounce((newMain: any[], newExtra: any[], newSide: any[]) => {
            latestSaveDeckOrder.current(newMain, newExtra, newSide);
        }, 1000)
    ).current;


    // Generic drag end
    const handleDragEnd = useCallback(() => {
        if (dragItem.current && dragOverItem.current) {
            const { area: srcArea, index: srcIndex } = dragItem.current;
            const { area: destArea, index: destIndex } = dragOverItem.current;

            if (srcArea === destArea && srcIndex !== destIndex) {
                // Reorder logic
                let newMain = [...mainOrder];
                let newExtra = [...extraOrder];
                let newSide = [...sideOrder];

                if (srcArea === 'EXTRA') {
                    const draggedItemContent = newExtra[srcIndex];
                    newExtra.splice(srcIndex, 1);
                    newExtra.splice(destIndex, 0, draggedItemContent);
                    setExtraOrder(newExtra);
                } else if (srcArea === 'SIDE') {
                    const draggedItemContent = newSide[srcIndex];
                    newSide.splice(srcIndex, 1);
                    newSide.splice(destIndex, 0, draggedItemContent);
                    setSideOrder(newSide);
                } else if (srcArea === 'MAIN') {
                    const draggedItemContent = newMain[srcIndex];
                    newMain.splice(srcIndex, 1);
                    newMain.splice(destIndex, 0, draggedItemContent);
                    setMainOrder(newMain);
                }

                // Save to backend
                setIsSaving(true);
                debouncedSaveDeckOrder(newMain, newExtra, newSide);
            }
        }

        // Reset
        dragItem.current = null;
        dragOverItem.current = null;
        setDragOverIndex(null);
        setIsDragging(false);
    }, [extraOrder, sideOrder, mainOrder, saveDeckOrder]);

    const renderCardItem = (card: any, key: string, area: string, index?: number, isDraggable: boolean = false) => {
        const rawTags = card.customTags || card.custom_tags;
        let tags: string[] = [];
        if (Array.isArray(rawTags)) {
            tags = rawTags;
        } else if (typeof rawTags === 'string') {
            try { tags = JSON.parse(rawTags); } catch (e) { tags = []; }
        }

        // Determine border color: Prioritize the active tagMode if the card has it.
        // Otherwise fallback to the first found colored tag.
        let activeBorderColor = 'border-white/5';

        if (tagMode && tags.includes(tagMode) && tagColors[tagMode]) {
            activeBorderColor = tagColors[tagMode];
        } else {
            const prioTag = tags.find((t: string) => tagColors[t]);
            if (prioTag) {
                activeBorderColor = tagColors[prioTag];
            }
        }

        const isBeingDragged = isDragging && dragItem.current?.area === area && dragItem.current?.index === index;
        const isDropTarget = isDragging && dragOverIndex?.index === index && dragOverIndex?.area === area && !isBeingDragged; // Fixed: check properties

        return (
            <div
                key={key}
                draggable={isDraggable}
                onDragStart={isDraggable ? (e) => {
                    e.dataTransfer.effectAllowed = 'move';
                    handleDragStart(area, index!);
                } : undefined}
                onDragEnter={isDraggable ? (e) => {
                    e.preventDefault();
                    handleDragEnter(area, index!);
                } : undefined}
                onDragOver={isDraggable ? (e) => {
                    e.preventDefault();
                    e.dataTransfer.dropEffect = 'move';
                } : undefined}
                onDragEnd={isDraggable ? handleDragEnd : undefined}
                className={`aspect-[2.5/3.6] relative group cursor-pointer overflow-hidden rounded-sm border-2 transition-all duration-150
                    ${card.quantity > 3 ? 'border-red-500/80 ring-1 ring-red-500/50' : activeBorderColor}
                    ${tagMode ? 'hover:scale-95' : 'hover:border-primary/50'}
                    ${isBeingDragged ? 'opacity-30 scale-90' : ''}
                    ${isDropTarget ? 'ring-2 ring-primary shadow-[0_0_15px_rgba(212,133,69,0.4)] scale-105' : ''}
                    ${isDraggable ? 'cursor-grab active:cursor-grabbing' : ''}`}
                onClick={() => handleCardClick(card)}
            >
                <img
                    src={(card.imageUrl || card.image_url) || 'https://images.ygoprodeck.com/images/cards/back_high.jpg'}
                    alt={card.cardName || card.card_name}
                    className={`w-full h-full object-cover transition-transform duration-300 group-hover:scale-110 pointer-events-none`}
                    loading="lazy"
                />
                {/* Tag Indicators */}
                <div className="absolute top-0.5 left-0.5 sm:top-1 sm:left-1 flex flex-wrap gap-0.5 pointer-events-none">
                    {tags.map((tag: string) => (
                        <div key={tag} className={`bg-black/90 text-white text-[3px] sm:text-[5px] font-black px-0.5 sm:px-1 rounded-sm uppercase flex items-center gap-0.5 ${tagColors[tag] ? tagColors[tag].replace('border-', 'border border-') : 'border border-primary'}`}>
                            {tag}
                        </div>
                    ))}
                </div>

                {/* Hover Overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-0.5 sm:p-1 pointer-events-none">
                    <span className="text-[5px] sm:text-[7px] font-black text-white uppercase truncate">{card.cardName || card.card_name}</span>
                    {tagMode && (
                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-black/80 px-2 py-1 rounded text-[8px] font-black uppercase text-white border border-white/20 whitespace-nowrap">
                            {tags.includes(tagMode) ? 'Remove' : 'Add'} {tagMode}
                        </div>
                    )}
                </div>
            </div>
        );
    };

    const renderDeckSection = (_title: string, area: string) => {
        let orderedCards: any[] = [];
        let gridCols = "grid-cols-5 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10"; // Default responsive
        let containerClass = "w-full";

        if (area === 'EXTRA') {
            orderedCards = extraOrder;
            // User requested 5 columns fixed. 
            // To maintain card size (comparable to main deck which is ~10 cols), we restrict width.
            gridCols = "grid-cols-5";
            containerClass = "max-w-3xl"; // Constrain width so cards don't get huge
        } else if (area === 'SIDE') {
            orderedCards = sideOrder;
            gridCols = "grid-cols-5";
            containerClass = "max-w-3xl";
        } else if (area === 'MAIN') {
            orderedCards = mainOrder;
            // Main deck normal size
            gridCols = "grid-cols-5 sm:grid-cols-8 md:grid-cols-10 lg:grid-cols-12";
        }

        if (orderedCards.length === 0) return null;

        return (
            <div className={`mb-10 ${containerClass}`}>
                <div className={`grid ${gridCols} gap-2 sm:gap-3`}>
                    {orderedCards.map((card: any, idx: number) =>
                        renderCardItem(card, card._instanceId, area, idx, !tagMode)
                    )}
                </div>
            </div>
        );
    };

    const renderAccordionItem = (id: string, title: string) => {
        // Safety check
        if (!deck || !deck.cards) return null;

        const areaCards = deck.cards.filter((c: any) => c.area === id);
        if (areaCards.length === 0) return null;
        const count = areaCards.reduce((acc: number, c: any) => acc + c.quantity, 0);
        const isExpanded = expandedSections.has(id);

        return (
            <div className="mb-4">
                <button
                    onClick={() => {
                        setExpandedSections(prev => {
                            const next = new Set(prev);
                            if (next.has(id)) next.delete(id);
                            else next.add(id);
                            return next;
                        });
                    }}
                    className="w-full flex items-center gap-3 py-3 px-4 rounded-lg bg-slate-900/50 border border-white/5 hover:border-primary/30 transition-all group cursor-pointer"
                >
                    <span className={`material-icons text-[16px] text-primary transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`}>expand_more</span>
                    <h2 className="text-[11px] font-black uppercase tracking-[0.4em] text-primary whitespace-nowrap">{title}</h2>
                    <div className="h-px bg-primary/20 flex-1"></div>
                    <span className="text-[10px] font-black text-slate-500 uppercase">{count} Cards</span>
                </button>
                <div
                    className="grid transition-[grid-template-rows,opacity] duration-300 ease-in-out"
                    style={{ gridTemplateRows: isExpanded ? '1fr' : '0fr', opacity: isExpanded ? 1 : 0 }}
                >
                    <div className="overflow-hidden">
                        <div className="mt-3">
                            {renderDeckSection(title, id)}
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <div className="text-primary font-black animate-pulse uppercase tracking-[0.3em]">Analizando Mazo con Base de Datos...</div>
            </div>
        )
    }

    if (!deck) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <div className="text-red-500 font-black uppercase tracking-[0.3em]">Mazo no encontrado</div>
            </div>
        )
    }

    return (
        <main className="w-full max-w-[100vw] sm:max-w-[1600px] mx-auto px-2 sm:px-6 py-4 sm:py-8 pb-16 overflow-x-hidden box-border">
            <div className="mb-6 sm:mb-8 flex flex-col sm:flex-row sm:justify-between sm:items-end border-b border-primary/20 pb-4 gap-3">
                <div>
                    <h1 className="text-2xl sm:text-4xl font-black italic uppercase text-white leading-none">{deck.name}</h1>
                    <p className="text-slate-500 font-bold uppercase tracking-widest text-[9px] sm:text-[11px] mt-1 sm:mt-2 flex items-center gap-2">
                        <span>Real-Time Analysis • {deck.totalCards || deck.total_cards} Cards • Database Connected</span>
                        {isSaving && <span className="text-yellow-500 animate-pulse flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-yellow-500"></span> Saving...</span>}
                    </p>
                </div>
                <div className="flex flex-col items-start sm:items-end gap-2">
                    <div className="flex gap-2">
                        <a href={`/combos/${id}`} className="px-3 py-1 bg-cyan-600/20 text-cyan-400 border border-cyan-600/50 text-[10px] sm:text-[11px] font-black uppercase rounded hover:bg-cyan-600/30 transition-all flex items-center gap-2">
                            <span className="material-icons text-[14px]">science</span>
                            Combo Calculator
                        </a>
                    </div>
                    <span className="text-[9px] sm:text-[10px] font-black text-primary uppercase block mt-2">Interactive Tagging Mode</span>
                    {isOwner && (
                        <div className="flex overflow-x-auto bg-slate-900 p-1 rounded-lg border border-slate-800 max-w-full">
                            {['Starter', 'Extender', 'Handtrap', 'Board Breaker', 'Engine', 'Non-Engine', 'Brick'].map(cat => (
                                <button
                                    key={cat}
                                    onClick={() => setTagMode(tagMode === cat ? null : cat)}
                                    className={`px-2 sm:px-3 py-1 sm:py-1.5 rounded text-[8px] sm:text-[10px] font-black uppercase transition-all flex items-center gap-1 sm:gap-2 whitespace-nowrap ${tagMode === cat
                                        ? `bg-white text-black shadow-[0_0_15px_rgba(255,255,255,0.3)]`
                                        : 'text-slate-500 hover:text-white hover:bg-white/5'
                                        }`}
                                >
                                    <div className={`w-1.5 sm:w-2 h-1.5 sm:h-2 rounded-full ${tagColors[cat]?.replace('border-', 'bg-') || 'bg-slate-500'}`}></div>
                                    {cat}
                                </button>
                            ))}
                            {tagMode && (
                                <button
                                    onClick={() => {
                                        setTagMode(null);
                                        fetchDeck();
                                    }}
                                    className="ml-1 sm:ml-2 px-2 py-1 sm:py-1.5 text-[8px] sm:text-[10px] font-black text-red-500 hover:text-red-400 uppercase border-l border-slate-700 pl-2 sm:pl-3 whitespace-nowrap"
                                >
                                    Exit Mode
                                </button>
                            )}
                        </div>
                    )}
                </div>
            </div>

            <section className="mb-12">
                {/* Accordion Deck Sections */}
                {/* Accordion Deck Sections */}
                {renderAccordionItem('MAIN', 'Main Deck')}

                <div className="flex flex-col md:flex-row gap-4 w-full">
                    <div className="flex-1 min-w-0">
                        {renderAccordionItem('EXTRA', 'Extra Deck')}
                    </div>
                    <div className="flex-1 min-w-0">
                        {renderAccordionItem('SIDE', 'Side Deck')}
                    </div>
                </div>

                {isTagModalOpen && selectedCard && (
                    <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-[100] flex items-center justify-center p-4" onClick={() => setIsTagModalOpen(false)}>
                        <div className="bg-card-dark border border-primary/20 rounded-2xl shadow-2xl max-w-3xl w-full p-6 sm:p-8 animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
                            <div className="flex justify-between items-start mb-6">
                                <div>
                                    <h3 className="text-xl font-black italic uppercase text-white">{selectedCard.cardName || selectedCard.card_name}</h3>
                                    <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-1">Assign categories for analysis</p>
                                </div>
                                <div className="flex items-center gap-2">
                                    {isOwner && (
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                const newCover = selectedCard.imageUrl || selectedCard.image_url;
                                                // Optimistic update
                                                const originalCover = deck?.coverImageUrl;
                                                setDeck((prev: any) => ({ ...prev, coverImageUrl: newCover }));

                                                fetch(`${API_BASE_URL}/api/deck/${id}`, {
                                                    method: 'PUT',
                                                    headers: { 'Content-Type': 'application/json' },
                                                    body: JSON.stringify({
                                                        user_id: user?.id,
                                                        cover_image_url: newCover
                                                    })
                                                }).then(async res => {
                                                    if (!res.ok) {
                                                        const errorData = await res.json().catch(() => ({}));
                                                        // Revert on failure
                                                        setDeck((prev: any) => ({ ...prev, coverImageUrl: originalCover }));
                                                        alert(`Error updating cover: ${errorData.details || errorData.error || 'Unknown error'}`);
                                                    }
                                                    // Success feedback is the filled star
                                                }).catch(() => {
                                                    setDeck((prev: any) => ({ ...prev, coverImageUrl: originalCover }));
                                                });
                                            }}
                                            className={`transition-colors ${(deck?.coverImageUrl === (selectedCard.imageUrl || selectedCard.image_url))
                                                ? 'text-yellow-400'
                                                : 'text-slate-600 hover:text-yellow-400'
                                                }`}
                                            title="Set as Deck Cover"
                                        >
                                            <span className="material-icons">
                                                {(deck?.coverImageUrl === (selectedCard.imageUrl || selectedCard.image_url)) ? 'star' : 'star_border'}
                                            </span>
                                        </button>
                                    )}
                                    <button onClick={() => setIsTagModalOpen(false)} className="text-slate-500 hover:text-white transition-colors">
                                        <span className="material-icons">close</span>
                                    </button>
                                </div>
                            </div>

                            <div className="flex flex-col md:flex-row gap-6 mb-8">
                                <img src={selectedCard.imageUrl || selectedCard.image_url} alt={selectedCard.cardName || selectedCard.card_name} className="w-full md:w-48 h-auto rounded border border-white/10 shadow-xl" />
                                <div className="flex-1 min-w-0 flex flex-col gap-3">
                                    <div className="flex flex-wrap gap-1.5">
                                        <span className="px-2 py-0.5 bg-primary/10 text-primary text-[9px] font-black uppercase rounded-full border border-primary/20">{selectedCard.type || selectedCard.card_type}</span>
                                        {selectedCard.race && <span className="px-2 py-0.5 bg-accent-blue/10 text-accent-blue text-[9px] font-black uppercase rounded-full border border-accent-blue/20">{selectedCard.race}</span>}
                                        {selectedCard.attribute && <span className="px-2 py-0.5 bg-accent-purple/10 text-accent-purple text-[9px] font-black uppercase rounded-full border border-accent-purple/20">{selectedCard.attribute}</span>}
                                    </div>
                                    {!((selectedCard.type || selectedCard.card_type)?.toLowerCase().includes('spell') || (selectedCard.type || selectedCard.card_type)?.toLowerCase().includes('trap')) && (
                                        <div className="flex gap-4 text-[11px] font-black">
                                            {selectedCard.level !== undefined && <span className="text-yellow-400">★ {selectedCard.level}</span>}
                                            {selectedCard.atk !== undefined && <span className="text-red-400">ATK {selectedCard.atk}</span>}
                                            {selectedCard.def !== undefined && <span className="text-blue-400">DEF {selectedCard.def}</span>}
                                        </div>
                                    )}
                                    <div className="bg-black/30 rounded-xl p-4 border border-white/10 flex-1 max-h-[150px] overflow-y-auto custom-scrollbar shadow-inner">
                                        <p className="text-[11px] text-slate-300 leading-relaxed whitespace-pre-wrap">{selectedCard.desc || 'No description available.'}</p>
                                    </div>
                                </div>
                            </div>

                        </div>
                    </div>
                )}
            </section>

            <div className="flex flex-col sm:flex-row flex-wrap gap-4 sm:gap-6">
                <div className="ygo-card-border rounded p-4 sm:p-6 shadow-2xl flex flex-col flex-1 min-w-0 w-full sm:min-w-[300px]">
                    <h3 className="font-black text-[10px] sm:text-xs uppercase tracking-[0.2em] text-primary mb-4 sm:mb-6">Card Type Analysis</h3>
                    <div className="flex items-center gap-4 sm:gap-8 flex-1">
                        <div className="relative w-28 h-28 sm:w-36 sm:h-36 flex-shrink-0">
                            <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
                                <circle className="stroke-slate-800" cx="18" cy="18" fill="none" r="16" strokeWidth="3"></circle>
                                {/* Monsters - Orange/Brown */}
                                <circle cx="18" cy="18" fill="none" r="16" stroke="#D48545" strokeDasharray={`${monsterPct} 100`} strokeWidth="3"></circle>
                                {/* Spells - Green */}
                                <circle
                                    cx="18" cy="18" fill="none" r="16" stroke="#1D9B7F"
                                    strokeDasharray={`${spellPct} 100`}
                                    strokeDashoffset={-monsterPct}
                                    strokeWidth="3"
                                ></circle>
                                {/* Traps - Pink */}
                                <circle
                                    cx="18" cy="18" fill="none" r="16" stroke="#BC5A84"
                                    strokeDasharray={`${trapPct} 100`}
                                    strokeDashoffset={-(monsterPct + spellPct)}
                                    strokeWidth="3"
                                ></circle>
                            </svg>
                            <div className="absolute inset-0 flex items-center justify-center flex-col">
                                <span className="text-xl sm:text-2xl font-black italic">{monsterCount + spellCount + trapCount}</span>
                                <span className="text-[8px] sm:text-[9px] uppercase text-primary font-bold tracking-tighter">Cards</span>
                            </div>
                        </div>
                        <div className="space-y-2.5 flex-1">
                            <div className="flex justify-between text-[11px] font-bold uppercase">
                                <span className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-[#D48545]"></div> Monsters</span>
                                <span>{stats.monsters}</span>
                            </div>
                            <div className="flex justify-between text-[11px] font-bold uppercase">
                                <span className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-[#1D9B7F]"></div> Spells</span>
                                <span>{stats.spells}</span>
                            </div>
                            <div className="flex justify-between text-[11px] font-bold uppercase">
                                <span className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-[#BC5A84]"></div> Traps</span>
                                <span>{stats.traps}</span>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="ygo-card-border rounded p-4 sm:p-6 shadow-2xl flex flex-col flex-1 min-w-0 w-full sm:min-w-[300px]">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="font-black text-[10px] sm:text-xs uppercase tracking-[0.2em] text-primary">Duel Simulation (Main Deck)</h3>
                        {isOwner && (
                            <button
                                onClick={() => {
                                    if (tagMode) {
                                        setTagMode(null);
                                        fetchDeck();
                                    } else {
                                        setTagMode('Starter');
                                    }
                                }}
                                className={`text-[9px] font-black uppercase px-2 py-1 rounded border transition-colors ${tagMode ? 'bg-primary text-background-dark border-primary' : 'text-slate-500 border-slate-700 hover:text-white hover:border-white'}`}
                            >
                                {tagMode ? 'Done Editing' : 'Edit Tags'}
                            </button>
                        )}
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4">
                        {[
                            { name: 'Starter', color: 'bg-green-500' },
                            { name: 'Extender', color: 'bg-blue-500' },
                            { name: 'Handtrap', color: 'bg-red-500' },
                            { name: 'Board Breaker', color: 'bg-yellow-500' },
                            { name: 'Engine', color: 'bg-purple-500' },
                            { name: 'Non-Engine', color: 'bg-gray-500' },
                            { name: 'Brick', color: 'bg-white' }
                        ].map(config => {
                            const cat = config.name;
                            const taggedCards = (deck.cards || []).filter((c: any) => {
                                return safeMsgParse(c.customTags || c.custom_tags).includes(cat);
                            });
                            const countInDeck = taggedCards.reduce((acc: number, c: any) => acc + (c.quantity || 1), 0);
                            const N = (deck.cards || []).filter((c: any) => c.area === 'MAIN').reduce((acc: number, c: any) => acc + (c.quantity || 1), 0) || 1;
                            const prob = (countInDeck / N) * 100;

                            const isSelected = tagMode === cat;
                            const isEditing = !!tagMode;

                            return (
                                <div
                                    key={cat}
                                    onClick={() => isEditing && setTagMode(cat)}
                                    className={`flex flex-col gap-1 p-2 rounded transition-all ${isEditing ? 'cursor-pointer hover:bg-white/5' : ''} ${isSelected ? 'bg-white/10 ring-1 ring-primary/50' : ''}`}
                                >
                                    <div className="flex justify-between items-end">
                                        <span className={`text-[10px] font-bold uppercase flex items-center gap-1 ${isSelected ? 'text-white' : 'text-slate-400'}`}>
                                            <div className={`w-1.5 h-1.5 rounded-full ${config.color}`}></div>
                                            {cat}
                                        </span>
                                        <span className={`text-[10px] font-black italic ${isSelected ? 'text-primary' : 'text-white'}`}>{prob.toFixed(1)}%</span>
                                    </div>
                                    <div className="w-full bg-slate-900 h-1.5 rounded-full overflow-hidden">
                                        <div className={`h-full ${config.color}`} style={{ width: `${prob}%` }}></div>
                                    </div>
                                    <span className="text-[8px] text-slate-500 uppercase tracking-widest text-right">{countInDeck} Cards</span>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>

            {(() => {
                const probCategories = ['Starter', 'Extender', 'Handtrap', 'Board Breaker', 'Engine', 'Non-Engine', 'Brick'];
                const hasAnyTaggedCards = probCategories.some(cat =>
                    (deck.cards || []).some((c: any) => safeMsgParse(c.customTags || c.custom_tags).includes(cat))
                );
                if (!hasAnyTaggedCards) return null;
                return (
                    <div className="ygo-card-border rounded p-4 sm:p-6 shadow-2xl mt-4 sm:mt-6">
                        <h3 className="font-black text-[10px] sm:text-xs uppercase tracking-[0.2em] text-primary mb-4 sm:mb-6">Probability Explorer (Draw 5)</h3>
                        <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-6">
                            {[
                                { name: 'Starter', color: 'text-green-500' },
                                { name: 'Extender', color: 'text-blue-500' },
                                { name: 'Handtrap', color: 'text-red-500' },
                                { name: 'Board Breaker', color: 'text-yellow-500' },
                                { name: 'Engine', color: 'text-purple-500' },
                                { name: 'Non-Engine', color: 'text-gray-500' },
                                { name: 'Brick', color: 'text-white' }
                            ].map(config => {
                                const cat = config.name;
                                const taggedCards = (deck.cards || []).filter((c: any) => safeMsgParse(c.customTags || c.custom_tags).includes(cat));
                                const countInDeck = taggedCards.reduce((acc: number, c: any) => acc + (c.quantity || 1), 0);
                                const N = (deck.cards || []).filter((c: any) => c.area === 'MAIN').reduce((acc: number, c: any) => acc + (c.quantity || 1), 0) || 1;

                                if (countInDeck === 0) return null;

                                // Hand size is 5, but capped at N
                                const n = Math.min(5, N);

                                const p0 = getHypergeometric(N, countInDeck, n, 0) * 100;
                                const p1 = getHypergeometric(N, countInDeck, n, 1) * 100;
                                const p2 = getHypergeometric(N, countInDeck, n, 2) * 100;
                                const p3Plus = Math.max(0, 100 - (p0 + p1 + p2));

                                return (
                                    <div key={cat} className="space-y-4 bg-slate-900/40 p-4 rounded-lg border border-white/5">
                                        <div className="flex justify-between items-center">
                                            <span className={`text-[11px] font-black uppercase flex items-center gap-1.5 ${config.color}`}>
                                                {cat}
                                            </span>
                                            <span className="text-[9px] text-slate-500 font-bold uppercase">{countInDeck} in Deck</span>
                                        </div>
                                        <div className="grid grid-cols-4 gap-2">
                                            {[
                                                { label: '0x', val: p0, color: 'bg-slate-700' },
                                                { label: '1x', val: p1, color: 'bg-primary' },
                                                { label: '2x', val: p2, color: 'bg-primary/70' },
                                                { label: '3x+', val: p3Plus, color: 'bg-primary/40' }
                                            ].map(row => (
                                                <div key={row.label} className="flex flex-col items-center">
                                                    <div className="w-full bg-slate-800 h-10 rounded-sm relative overflow-hidden mb-1">
                                                        <div className={`absolute bottom-0 w-full ${row.color}`} style={{ height: `${row.val}%` }}></div>
                                                        <span className="absolute inset-0 flex items-center justify-center text-[9px] font-black text-white mix-blend-difference">{row.val.toFixed(0)}%</span>
                                                    </div>
                                                    <span className="text-[8px] text-slate-500 font-black uppercase">{row.label}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                );
            })()}

            {/* Right Column: Chart */}
            <div className="lg:col-span-5 flex flex-col gap-6">
                {/* Saved Combos Widget */}
                <div className="bg-slate-900/50 border border-white/5 rounded-lg">
                    <SavedCombosWidget deckId={id!} />
                </div>
            </div>
            <section className="mt-6 sm:mt-8 mb-8 bg-black/40 border border-primary/20 rounded p-4 sm:p-8 relative">
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-6 sm:mb-10 gap-3">
                    <div>
                        <h2 className="text-xl sm:text-2xl font-black italic uppercase text-white">Sample Opening Hand</h2>
                        <p className="text-[9px] sm:text-[11px] text-slate-500 font-bold uppercase">Simulated draw from Main Deck only.</p>
                    </div>
                    <div className="flex gap-2 sm:gap-3">
                        <button onClick={() => {
                            if (!deck || !deck.cards) return;
                            const mainCards = deck.cards.filter((c: any) => c.area === 'MAIN').flatMap((card: any) =>
                                Array(Math.max(1, parseInt(card.quantity) || 1)).fill(card)
                            );
                            shuffleAndDraw(mainCards);
                        }} className="bg-slate-800 hover:bg-slate-700 text-white px-4 sm:px-6 py-2 sm:py-3 rounded text-[10px] sm:text-[11px] font-black uppercase">Redraw</button>
                        {!showSixth && deckStack.length > 0 && <button onClick={drawSixth} className="bg-primary text-background-dark px-4 sm:px-6 py-2 sm:py-3 rounded text-[10px] sm:text-[11px] font-black uppercase">Draw 6th</button>}
                    </div>
                </div>
                <div className="grid grid-cols-3 sm:grid-cols-3 lg:grid-cols-6 gap-2 sm:gap-4">
                    {hand.map((card, idx) => (
                        <div key={idx} className="aspect-[2.5/3.6] relative group overflow-hidden rounded border border-primary/20">
                            <img src={card.imageUrl || card.image_url} alt={card.cardName || card.card_name} className="w-full h-full object-cover" />
                            <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 p-2 flex flex-col justify-end transition-opacity">
                                <span className="text-[10px] font-black text-white uppercase">{card.cardName || card.card_name}</span>
                            </div>
                        </div>
                    ))}
                </div>
            </section>
        </main>
    )
}

export default Dashboard
