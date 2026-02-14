import { useParams } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { API_BASE_URL } from '../config'

function Dashboard() {
    const { id } = useParams<{ id: string }>()
    const [deck, setDeck] = useState<any>(null)
    const [loading, setLoading] = useState(true)
    const [hand, setHand] = useState<any[]>([])
    const [deckStack, setDeckStack] = useState<any[]>([])
    const [showSixth, setShowSixth] = useState(false)
    const [selectedCard, setSelectedCard] = useState<any>(null)
    const [isTagModalOpen, setIsTagModalOpen] = useState(false)
    const [tagMode, setTagMode] = useState<string | null>(null);
    const [cardDetailsCache, setCardDetailsCache] = useState<Record<string, any>>({});
    const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['MAIN']));

    // Safe JSON parse helper
    const safeMsgParse = (jsonString: string): string[] => {
        try {
            const parsed = JSON.parse(jsonString || "[]");
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

    const fetchDeck = () => {
        setLoading(true)
        fetch(`${API_BASE_URL}/api/deck/${id}`)
            .then(res => res.json())
            .then(data => {
                setDeck(data)
                // Inicializar mano SOLO con cartas del MAIN DECK
                if (data.cards && Array.isArray(data.cards)) {
                    const mainCards = data.cards.filter((c: any) => c.area === 'MAIN').flatMap((card: any) =>
                        Array(Math.max(1, parseInt(card.quantity) || 1)).fill({ ...card, card_name: card.cardName, image_url: card.imageUrl, card_type: card.cardType, custom_tags: card.customTags })
                    );
                    shuffleAndDraw(mainCards);
                }
                setLoading(false)
            })
            .catch(err => {
                console.error('Error fetching deck:', err)
                setLoading(false)
            })
    }

    const toggleTag = (cardId: number, tag: string) => {
        const card = deck.cards.find((c: any) => c.id === cardId);
        if (!card) return;

        if (!card) return;

        let currentTags: string[] = [];
        try {
            currentTags = safeMsgParse(card.customTags || card.custom_tags);
        } catch (e) { currentTags = []; }

        const newTags = currentTags.includes(tag)
            ? currentTags.filter((t: string) => t !== tag)
            : [...currentTags, tag];

        fetch(`${API_BASE_URL}/api/update-card-tags/${cardId}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ tags: newTags })
        })
            .then(() => fetchDeck())
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

    // Procesar estadísticas reales del mazo
    const stats = deck && deck.cards ? deck.cards.reduce((acc: any, card: any) => {
        const type = ((card.cardType || card.card_type) || 'Unknown').toLowerCase();
        const qty = card.quantity || 1;

        if (type.includes('monster')) acc.monsters += qty;
        else if (type.includes('spell')) acc.spells += qty;
        else if (type.includes('trap')) acc.traps += qty;

        if (card.attribute) acc.attributes[card.attribute] = (acc.attributes[card.attribute] || 0) + qty;
        if (card.level) acc.levels[card.level] = (acc.levels[card.level] || 0) + qty;

        return acc;
    }, { monsters: 0, spells: 0, traps: 0, attributes: {}, levels: {} }) : { monsters: 0, spells: 0, traps: 0, attributes: {}, levels: {} };

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

    const total = deck.total_cards || 1;
    const monsterPct = (stats.monsters / total) * 100;
    const spellPct = (stats.spells / total) * 100;
    const trapPct = (stats.traps / total) * 100;

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
            toggleTag(card.id, tagMode);
        } else {
            const cardName = card.cardName || card.card_name;
            if (cardDetailsCache[cardName]) {
                setSelectedCard(cardDetailsCache[cardName]);
                setIsTagModalOpen(true);
            } else {
                fetch(`${API_BASE_URL}/api/search-cards?q=${encodeURIComponent(cardName)}`)
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

    const renderDeckSection = (_title: string, area: string) => {
        if (!deck || !deck.cards) return null;
        const areaCards = deck.cards.filter((c: any) => c.area === area);
        if (areaCards.length === 0) return null;

        return (
            <div className="mb-10">
                <div className="grid grid-cols-5 sm:grid-cols-8 md:grid-cols-10 lg:grid-cols-12 gap-0.5 sm:gap-1 md:gap-2">
                    {areaCards.map((card: any) => (
                        Array(card.quantity).fill(card).map((_, i) => {
                            const rawTags = card.customTags || card.custom_tags;
                            const tags = rawTags ? JSON.parse(rawTags) : [];
                            // Find the first tag that has a color mapping, or default to primary
                            const activeBorderColor = tags.find((t: string) => tagColors[t])
                                ? tagColors[tags.find((t: string) => tagColors[t])!]
                                : 'border-white/5';

                            return (
                                <div
                                    key={`${card.id}-${i}`}
                                    className={`aspect-[2.5/3.6] relative group cursor-pointer overflow-hidden rounded-sm border-2 transition-all ${card.quantity > 3 ? 'border-red-500/80 ring-1 ring-red-500/50' : activeBorderColor} ${tagMode ? 'hover:scale-95' : 'hover:border-primary/50'}`}
                                    onClick={() => handleCardClick(card)}
                                >
                                    <img
                                        src={(card.imageUrl || card.image_url) || 'https://images.ygoprodeck.com/images/cards/back_high.jpg'}
                                        alt={card.cardName || card.card_name}
                                        className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110"
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
                                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-0.5 sm:p-1">
                                        <span className="text-[5px] sm:text-[7px] font-black text-white uppercase truncate">{card.cardName || card.card_name}</span>
                                        {tagMode && (
                                            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-black/80 px-2 py-1 rounded text-[8px] font-black uppercase text-white border border-white/20 whitespace-nowrap">
                                                {tags.includes(tagMode) ? 'Remove' : 'Add'} {tagMode}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        })
                    ))}
                </div>
            </div>
        );
    }

    return (
        <main className="w-full max-w-[100vw] sm:max-w-[1600px] mx-auto px-2 sm:px-6 py-4 sm:py-8 pb-16 overflow-x-hidden box-border">
            <div className="mb-6 sm:mb-8 flex flex-col sm:flex-row sm:justify-between sm:items-end border-b border-primary/20 pb-4 gap-3">
                <div>
                    <h1 className="text-2xl sm:text-4xl font-black italic uppercase text-white leading-none">{deck.name}</h1>
                    <p className="text-slate-500 font-bold uppercase tracking-widest text-[9px] sm:text-[11px] mt-1 sm:mt-2">
                        Real-Time Analysis • {deck.totalCards || deck.total_cards} Cards • Database Connected
                    </p>
                </div>
                <div className="flex flex-col items-start sm:items-end gap-2">
                    <span className="text-[9px] sm:text-[10px] font-black text-primary uppercase block">Interactive Tagging Mode</span>
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
                                onClick={() => setTagMode(null)}
                                className="ml-1 sm:ml-2 px-2 py-1 sm:py-1.5 text-[8px] sm:text-[10px] font-black text-red-500 hover:text-red-400 uppercase border-l border-slate-700 pl-2 sm:pl-3 whitespace-nowrap"
                            >
                                Exit Mode
                            </button>
                        )}
                    </div>
                </div>
            </div>

            <section className="mb-12">
                {/* Accordion Deck Sections */}
                {[
                    { id: 'MAIN', title: 'Main Deck' },
                    { id: 'EXTRA', title: 'Extra Deck' },
                    { id: 'SIDE', title: 'Side Deck' }
                ].map(section => {
                    const areaCards = deck.cards.filter((c: any) => c.area === section.id);
                    if (areaCards.length === 0) return null;
                    const count = areaCards.reduce((acc: number, c: any) => acc + c.quantity, 0);
                    const isExpanded = expandedSections.has(section.id);

                    return (
                        <div key={section.id} className="mb-4">
                            <button
                                onClick={() => {
                                    setExpandedSections(prev => {
                                        const next = new Set(prev);
                                        if (next.has(section.id)) next.delete(section.id);
                                        else next.add(section.id);
                                        return next;
                                    });
                                }}
                                className="w-full flex items-center gap-3 py-3 px-4 rounded-lg bg-slate-900/50 border border-white/5 hover:border-primary/30 transition-all group cursor-pointer"
                            >
                                <span className={`material-icons text-[16px] text-primary transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`}>expand_more</span>
                                <h2 className="text-[11px] font-black uppercase tracking-[0.4em] text-primary whitespace-nowrap">{section.title}</h2>
                                <div className="h-px bg-primary/20 flex-1"></div>
                                <span className="text-[10px] font-black text-slate-500 uppercase">{count} Cards</span>
                            </button>
                            <div
                                className="grid transition-[grid-template-rows,opacity] duration-300 ease-in-out"
                                style={{ gridTemplateRows: isExpanded ? '1fr' : '0fr', opacity: isExpanded ? 1 : 0 }}
                            >
                                <div className="overflow-hidden">
                                    <div className="mt-3">
                                        {renderDeckSection(section.title, section.id)}
                                    </div>
                                </div>
                            </div>
                        </div>
                    );
                })}

                {isTagModalOpen && selectedCard && (
                    <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-[100] flex items-center justify-center p-4" onClick={() => setIsTagModalOpen(false)}>
                        <div className="bg-card-dark border border-primary/20 rounded-2xl shadow-2xl max-w-3xl w-full p-6 sm:p-8 animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
                            <div className="flex justify-between items-start mb-6">
                                <div>
                                    <h3 className="text-xl font-black italic uppercase text-white">{selectedCard.cardName || selectedCard.card_name}</h3>
                                    <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-1">Assign categories for analysis</p>
                                </div>
                                <button onClick={() => setIsTagModalOpen(false)} className="text-slate-500 hover:text-white transition-colors">
                                    <span className="material-icons">close</span>
                                </button>
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
                                <span className="text-xl sm:text-2xl font-black italic">{deck.totalCards || deck.total_cards}</span>
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
                        <button
                            onClick={() => setTagMode(tagMode ? null : 'Starter')} // Default to Starter if turning on
                            className={`text-[9px] font-black uppercase px-2 py-1 rounded border transition-colors ${tagMode ? 'bg-primary text-background-dark border-primary' : 'text-slate-500 border-slate-700 hover:text-white hover:border-white'}`}
                        >
                            {tagMode ? 'Done Editing' : 'Edit Tags'}
                        </button>
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
