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
    const [availableCategories] = useState(['Starter', 'Extender', 'Handtrap', 'Board Breaker', 'Engine', 'Non-Engine'])
    const [tagMode, setTagMode] = useState<string | null>(null);

    // Safe JSON parse helper
    const safeMsgParse = (jsonString: string): string[] => {
        try {
            const parsed = JSON.parse(jsonString || "[]");
            return Array.isArray(parsed) ? parsed : [];
        } catch (e) {
            return [];
        }
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
    // const spellPct = (stats.spells / total) * 100;
    // const trapPct = (stats.traps / total) * 100;

    // Colors for tags
    const tagColors: Record<string, string> = {
        'Starter': 'border-green-500',
        'Extender': 'border-blue-500',
        'Handtrap': 'border-red-500',
        'Board Breaker': 'border-yellow-500',
        'Engine': 'border-purple-500',
        'Non-Engine': 'border-gray-500'
    };

    const handleCardClick = (card: any) => {
        if (tagMode) {
            toggleTag(card.id, tagMode);
        } else {
            setSelectedCard(card);
            setIsTagModalOpen(true);
        }
    };

    const renderDeckSection = (title: string, area: string) => {
        if (!deck || !deck.cards) return null;
        const areaCards = deck.cards.filter((c: any) => c.area === area);
        if (areaCards.length === 0) return null;

        return (
            <div className="mb-10">
                <div className="flex items-center gap-3 mb-4">
                    <h2 className="text-[11px] font-black uppercase tracking-[0.4em] text-primary whitespace-nowrap">{title}</h2>
                    <div className="h-px bg-primary/30 flex-1"></div>
                    <span className="text-[10px] font-black text-slate-500 uppercase">
                        {areaCards.reduce((acc: number, c: any) => acc + c.quantity, 0)} Cards
                    </span>
                </div>
                <div className="grid grid-cols-5 md:grid-cols-8 lg:grid-cols-10 gap-2">
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
                                    className={`aspect-[2.5/3.6] relative group cursor-pointer overflow-hidden rounded-sm border-2 transition-all ${activeBorderColor} ${tagMode ? 'hover:scale-95' : 'hover:border-primary/50'}`}
                                    onClick={() => handleCardClick(card)}
                                >
                                    <img
                                        src={(card.imageUrl || card.image_url) || 'https://images.ygoprodeck.com/images/cards/back_high.jpg'}
                                        alt={card.cardName || card.card_name}
                                        className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110"
                                        loading="lazy"
                                    />
                                    {/* Tag Indicators */}
                                    <div className="absolute top-1 left-1 flex flex-wrap gap-0.5 pointer-events-none">
                                        {tags.map((tag: string) => (
                                            <div key={tag} className={`bg-black/90 text-white text-[5px] font-black px-1 rounded-sm uppercase ${tagColors[tag] ? tagColors[tag].replace('border-', 'border border-') : 'border border-primary'}`}>
                                                {tag}
                                            </div>
                                        ))}
                                    </div>

                                    {/* Hover Overlay */}
                                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-1">
                                        <span className="text-[7px] font-black text-white uppercase truncate">{card.cardName || card.card_name}</span>
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
        <main className="max-w-[1600px] mx-auto px-6 py-8">
            <div className="mb-8 flex justify-between items-end border-b border-primary/20 pb-4">
                <div>
                    <h1 className="text-4xl font-black italic uppercase text-white leading-none">{deck.name}</h1>
                    <p className="text-slate-500 font-bold uppercase tracking-widest text-[11px] mt-2">
                        Real-Time Analysis • {deck.totalCards || deck.total_cards} Cards • Database Connected
                    </p>
                </div>
                <div className="text-right flex flex-col items-end gap-2">
                    <span className="text-[10px] font-black text-primary uppercase block mb-1">Interactive Tagging Mode</span>
                    <div className="flex bg-slate-900 p-1 rounded-lg border border-slate-800">
                        {['Starter', 'Extender', 'Handtrap', 'Board Breaker', 'Engine', 'Non-Engine'].map(cat => (
                            <button
                                key={cat}
                                onClick={() => setTagMode(tagMode === cat ? null : cat)}
                                className={`px-3 py-1.5 rounded text-[10px] font-black uppercase transition-all flex items-center gap-2 ${tagMode === cat
                                    ? `bg-white text-black shadow-[0_0_15px_rgba(255,255,255,0.3)]`
                                    : 'text-slate-500 hover:text-white hover:bg-white/5'
                                    }`}
                            >
                                <div className={`w-2 h-2 rounded-full ${tagColors[cat]?.replace('border-', 'bg-') || 'bg-slate-500'}`}></div>
                                {cat}
                            </button>
                        ))}
                        {tagMode && (
                            <button
                                onClick={() => setTagMode(null)}
                                className="ml-2 px-2 py-1.5 text-[10px] font-black text-red-500 hover:text-red-400 uppercase border-l border-slate-700 pl-3"
                            >
                                Exit Mode
                            </button>
                        )}
                    </div>
                </div>
            </div>

            <section className="mb-12">
                {renderDeckSection("Main Deck", "MAIN")}
                {renderDeckSection("Extra Deck", "EXTRA")}
                {renderDeckSection("Side Deck", "SIDE")}

                {isTagModalOpen && selectedCard && (
                    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                        <div className="bg-card-dark border border-primary/20 rounded-xl max-w-md w-full p-6 shadow-2xl animate-in zoom-in-95 duration-200">
                            <div className="flex justify-between items-start mb-6">
                                <div>
                                    <h3 className="text-xl font-black italic uppercase text-white">{selectedCard.cardName || selectedCard.card_name}</h3>
                                    <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-1">Assign categories for analysis</p>
                                </div>
                                <button onClick={() => setIsTagModalOpen(false)} className="text-slate-500 hover:text-white transition-colors">
                                    <span className="material-icons">close</span>
                                </button>
                            </div>

                            <div className="flex gap-4 mb-8">
                                <img src={selectedCard.imageUrl || selectedCard.image_url} alt={selectedCard.cardName || selectedCard.card_name} className="w-24 rounded border border-white/10" />
                                <div className="flex-1 space-y-2">
                                    <div className="text-[9px] font-black text-primary uppercase tracking-tighter">Current Tags:</div>
                                    <div className="flex flex-wrap gap-2">
                                        {safeMsgParse(selectedCard.customTags || selectedCard.custom_tags).map((tag: string) => (
                                            <span key={tag} className="bg-primary text-background-dark text-[10px] font-black px-2 py-1 rounded uppercase flex items-center gap-1">
                                                {tag}
                                                <span className="material-icons text-[12px] cursor-pointer" onClick={() => toggleTag(selectedCard.id, tag)}>close</span>
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-4">
                                <div className="text-[11px] font-black text-white uppercase tracking-widest border-b border-primary/10 pb-2">Available Categories</div>
                                <div className="grid grid-cols-2 gap-2">
                                    {availableCategories.map(cat => (
                                        <button
                                            key={cat}
                                            onClick={() => toggleTag(selectedCard.id, cat)}
                                            className={`py-2 px-3 rounded text-[10px] font-black uppercase transition-all border ${safeMsgParse(selectedCard.customTags || selectedCard.custom_tags).includes(cat) ? 'bg-primary text-background-dark border-primary' : 'bg-slate-900 text-slate-400 border-slate-800 hover:border-primary/50'}`}
                                        >
                                            {cat}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </section>

            <div className="masonry-grid flex flex-wrap gap-6">
                <div className="ygo-card-border rounded p-6 shadow-2xl flex flex-col flex-1 min-w-[300px]">
                    <h3 className="font-black text-xs uppercase tracking-[0.2em] text-primary mb-6">Card Type Analysis</h3>
                    <div className="flex items-center gap-8 flex-1">
                        <div className="relative w-36 h-36 flex-shrink-0">
                            <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
                                <circle className="stroke-slate-800" cx="18" cy="18" fill="none" r="16" strokeWidth="3"></circle>
                                <circle cx="18" cy="18" fill="none" r="16" stroke="#fb923c" strokeDasharray={`${monsterPct} 100`} strokeWidth="3"></circle>
                            </svg>
                            <div className="absolute inset-0 flex items-center justify-center flex-col">
                                <span className="text-2xl font-black italic">{deck.totalCards || deck.total_cards}</span>
                                <span className="text-[9px] uppercase text-primary font-bold tracking-tighter">Cards</span>
                            </div>
                        </div>
                        <div className="space-y-2.5 flex-1">
                            <div className="flex justify-between text-[11px] font-bold uppercase"><span className="text-slate-400">Monsters</span><span>{stats.monsters}</span></div>
                            <div className="flex justify-between text-[11px] font-bold uppercase"><span className="text-slate-400">Spells</span><span>{stats.spells}</span></div>
                            <div className="flex justify-between text-[11px] font-bold uppercase"><span className="text-slate-400">Traps</span><span>{stats.traps}</span></div>
                        </div>
                    </div>
                </div>

                <div className="ygo-card-border rounded p-6 shadow-2xl flex flex-col flex-1 min-w-[300px]">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="font-black text-xs uppercase tracking-[0.2em] text-primary">Duel Simulation (Main Deck)</h3>
                        <button
                            onClick={() => setTagMode(tagMode ? null : 'Starter')} // Default to Starter if turning on
                            className={`text-[9px] font-black uppercase px-2 py-1 rounded border transition-colors ${tagMode ? 'bg-primary text-background-dark border-primary' : 'text-slate-500 border-slate-700 hover:text-white hover:border-white'}`}
                        >
                            {tagMode ? 'Done Editing' : 'Edit Tags'}
                        </button>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        {[
                            { name: 'Starter', color: 'bg-green-500' },
                            { name: 'Extender', color: 'bg-blue-500' },
                            { name: 'Handtrap', color: 'bg-red-500' },
                            { name: 'Board Breaker', color: 'bg-yellow-500' },
                            { name: 'Engine', color: 'bg-purple-500' },
                            { name: 'Non-Engine', color: 'bg-gray-500' }
                        ].map(config => {
                            const cat = config.name;
                            const taggedCards = (deck.cards || []).filter((c: any) => {
                                return safeMsgParse(c.customTags || c.custom_tags).includes(cat);
                            });
                            const countInDeck = taggedCards.reduce((acc: number, c: any) => acc + (c.quantity || 1), 0);
                            const N = (deck.cards || []).filter((c: any) => c.area === 'MAIN').reduce((acc: number, c: any) => acc + (c.quantity || 1), 0) || 1;
                            const k = countInDeck;
                            let prob = 0;
                            if (N >= 5 && k > 0) {
                                let chanceNoDraw = 1;
                                for (let i = 0; i < 5; i++) chanceNoDraw *= (N - k - i) / (N - i);
                                prob = (1 - chanceNoDraw) * 100;
                            }

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

            <section className="mt-8 bg-black/40 border border-primary/20 rounded p-8 relative">
                <div className="flex justify-between items-center mb-10">
                    <div>
                        <h2 className="text-2xl font-black italic uppercase text-white">Sample Opening Hand</h2>
                        <p className="text-[11px] text-slate-500 font-bold uppercase">Simulated draw from Main Deck only.</p>
                    </div>
                    <div className="flex gap-3">
                        <button onClick={() => {
                            if (!deck || !deck.cards) return;
                            const mainCards = deck.cards.filter((c: any) => c.area === 'MAIN').flatMap((card: any) =>
                                Array(Math.max(1, parseInt(card.quantity) || 1)).fill(card)
                            );
                            shuffleAndDraw(mainCards);
                        }} className="bg-slate-800 hover:bg-slate-700 text-white px-6 py-3 rounded text-[11px] font-black uppercase">Redraw</button>
                        {!showSixth && deckStack.length > 0 && <button onClick={drawSixth} className="bg-primary text-background-dark px-6 py-3 rounded text-[11px] font-black uppercase">Draw 6th</button>}
                    </div>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
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
