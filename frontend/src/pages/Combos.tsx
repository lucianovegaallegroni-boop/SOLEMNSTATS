import { useParams, Link, useLocation } from 'react-router-dom';
import { useEffect, useState, useMemo, useRef } from 'react';
import { API_BASE_URL } from '../config';

interface Card {
    id: number | string;
    cardName: string;
    card_name?: string; // fallback
    imageUrl: string;
    image_url?: string; // fallback
    quantity: number;
    customTags?: string;
    custom_tags?: string;
}

interface ComboStep {
    id: string; // "step-1", "step-2" etc.
    label: string; // "Card #1", "Card #2"
    cards: Card[]; // List of alternative cards that satisfy this step
    quantity: number; // How many cards from this group are needed (default 1)
}

interface SavedCombo {
    id: number;
    name: string;
    probability: number;
    steps: ComboStep[];
    created_at: string;
}

function Combos() {
    const { id } = useParams<{ id: string }>();
    const location = useLocation();
    const [deck, setDeck] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    // Combo Builder State
    const [comboSize, setComboSize] = useState<number>(2); // Default to 2-card combo
    const [comboSteps, setComboSteps] = useState<ComboStep[]>([]);
    const [activeStepId, setActiveStepId] = useState<string | null>(null);

    const [simulationResult, setSimulationResult] = useState<{ probability: number, successCount: number, totalSims: number } | null>(null);
    const [isSimulating, setIsSimulating] = useState(false);

    // Saving State
    const [savedCombos, setSavedCombos] = useState<SavedCombo[]>([]);
    const [comboName, setComboName] = useState('');
    const [editingComboId, setEditingComboId] = useState<number | null>(null);
    const [isSaving, setIsSaving] = useState(false);

    // DND State
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const [, setIsDragging] = useState(false);
    const dragItem = useRef<Card | null>(null);

    useEffect(() => {
        if (!id) return;
        fetchDeck();
        fetchSavedCombos();

        // Check if we have a combo to edit from navigation state
        const state = location.state as { comboToEdit?: SavedCombo };
        if (state?.comboToEdit) {
            const combo = state.comboToEdit;
            setComboName(combo.name);
            setEditingComboId(combo.id);
            setComboSize(combo.steps.length);
            setComboSteps(combo.steps);
            // Pre-fill simulation result to show the results panel immediately
            setSimulationResult({
                probability: combo.probability,
                successCount: 0, // Placeholder
                totalSims: 1000000
            });
        }
    }, [id, location.state]);

    useEffect(() => {
        // Initialize steps based on comboSize
        setComboSteps(prev => {
            const newSteps: ComboStep[] = [];
            for (let i = 0; i < comboSize; i++) {
                newSteps.push({
                    id: `step-${i + 1}`,
                    label: `Step #${i + 1}`,
                    cards: [],
                    quantity: 1
                });
            }

            // Restore previous configuration where possible
            const result = newSteps.map((step, idx) => {
                if (prev[idx]) return { ...step, cards: prev[idx].cards, quantity: prev[idx].quantity || 1 };
                return step;
            });

            return result;
        });

        // Reset active step if out of bounds or not set
        if (!activeStepId || !activeStepId.startsWith('step-')) {
            setActiveStepId('step-1');
        }
    }, [comboSize]);

    const fetchDeck = () => {
        setLoading(true);
        fetch(`${API_BASE_URL}/api/deck/${id}`)
            .then(res => res.json())
            .then(data => {
                setDeck(data);
                setLoading(false);
            })
            .catch(err => {
                console.error('Error fetching deck:', err);
                setLoading(false);
            });
    };

    const fetchSavedCombos = () => {
        fetch(`${API_BASE_URL}/api/deck/${id}/combos`)
            .then(res => res.json())
            .then(data => {
                if (Array.isArray(data)) setSavedCombos(data);
            })
            .catch(console.error);
    };

    const mainDeckCards = useMemo(() => {
        if (!deck || !deck.cards) return [];
        return deck.cards.filter((c: any) => c.area === 'MAIN');
    }, [deck]);

    const availableProbs = useMemo(() => {
        // Extract unique cards for selection
        const map = new Map();
        mainDeckCards.forEach((c: Card) => {
            const name = c.cardName || c.card_name || '';
            if (!map.has(name)) {
                map.set(name, {
                    ...c, // keep full card data for adding
                    name,
                    img: c.imageUrl || c.image_url,
                    count: mainDeckCards.filter((x: Card) => (x.cardName || x.card_name) === name).reduce((a: number, b: any) => a + (b.quantity || 1), 0)
                });
            }
        });
        return Array.from(map.values());
    }, [mainDeckCards]);

    const addCardToStep = (card: any, stepId: string) => {
        setComboSteps(prev => prev.map(step => {
            if (step.id === stepId) {
                // Prevent duplicates in same step
                const exists = step.cards.some(c => (c.cardName || c.card_name) === (card.cardName || card.card_name));
                if (exists) return step;
                return { ...step, cards: [...step.cards, card] };
            }
            return step;
        }));
    };

    const removeCardFromStep = (stepId: string, cardIndex: number) => {
        setComboSteps(prev => prev.map(step => {
            if (step.id === stepId) {
                const newCards = [...step.cards];
                newCards.splice(cardIndex, 1);
                return { ...step, cards: newCards };
            }
            return step;
        }));
    };

    const updateStepQuantity = (stepId: string, qty: number) => {
        setComboSteps(prev => prev.map(step => {
            if (step.id === stepId) return { ...step, quantity: qty };
            return step;
        }));
    };

    // --- Drag and Drop Logic ---
    const handleDragStart = (e: React.DragEvent, card: any) => {
        dragItem.current = card;
        setIsDragging(true);
        e.dataTransfer.effectAllowed = 'copy';
        // Set drag image?
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy';
    };

    const handleDrop = (e: React.DragEvent, stepId: string) => {
        e.preventDefault();
        setIsDragging(false);
        if (dragItem.current) {
            addCardToStep(dragItem.current, stepId);
            setActiveStepId(stepId); // Activate dropped step
        }
        dragItem.current = null;
    };

    const runSimulation = () => {
        if (!deck) return;
        setIsSimulating(true);
        setSimulationResult(null);

        // Run in timeout to allow UI update
        setTimeout(() => {
            const ITERATIONS = 1000000;
            const HAND_SIZE = 5;

            // Expand deck into full array
            const fullDeck = mainDeckCards.flatMap((c: any) =>
                Array(Math.max(1, parseInt(c.quantity) || 1)).fill(c.cardName || c.card_name)
            );

            if (fullDeck.length < HAND_SIZE) {
                alert("Deck size too small!");
                setIsSimulating(false);
                return;
            }

            let successes = 0;

            // Prepare requirements
            const requiredSteps = comboSteps.map(s => ({
                id: s.id,
                allowed: new Set(s.cards.map(c => c.cardName || c.card_name)),
                quantity: s.quantity || 1
            }));

            // If a step has 0 cards, it can NEVER be satisfied (unless quantity 0, which is trivial)
            if (requiredSteps.some(s => s.quantity > 0 && s.allowed.size === 0)) {
                setSimulationResult({ probability: 0, successCount: 0, totalSims: ITERATIONS });
                setIsSimulating(false);
                return;
            }

            const canSatisfySteps = (hand: string[], stepIdx: number): boolean => {
                if (stepIdx >= requiredSteps.length) return true; // All steps satisfied

                const req = requiredSteps[stepIdx];
                const needed = req.quantity;

                // We need to find `needed` cards in `hand` that match `req.allowed`.
                // Optimization: Filter hand for matching candidates first? 

                // Helper for recursive combination search within a single step
                // (e.g. need 2 matching cards for this step)
                const findMatches = (currentHand: string[], countNeeded: number): boolean => {
                    if (countNeeded === 0) {
                        // Consumed all for this step, proceed to next step
                        return canSatisfySteps(currentHand, stepIdx + 1);
                    }

                    for (let i = 0; i < currentHand.length; i++) {
                        if (req.allowed.has(currentHand[i])) {
                            // Consume match
                            const nextHand = [...currentHand];
                            nextHand.splice(i, 1);
                            // Optimization: if we just spliced i, next iteration should start at i (since array shifted)
                            // But since we are recursing on refined needed count, we need to be careful not to double count.
                            // Actually, standard iteration is fine if we return TRUE immediately.
                            if (findMatches(nextHand, countNeeded - 1)) return true;
                        }
                    }
                    return false;
                };

                return findMatches(hand, needed);
            };

            for (let i = 0; i < ITERATIONS; i++) {
                // Fisher-Yates shuffle optimized for just first 5 elements
                const currentDeck = [...fullDeck];
                const hand: string[] = [];

                // Draw HAND_SIZE cards
                for (let k = 0; k < HAND_SIZE; k++) {
                    const idx = Math.floor(Math.random() * (currentDeck.length - k)) + k;
                    // Swap
                    const temp = currentDeck[k];
                    currentDeck[k] = currentDeck[idx];
                    currentDeck[idx] = temp;

                    hand.push(currentDeck[k]);
                }

                if (canSatisfySteps(hand, 0)) {
                    successes++;
                }
            }

            setSimulationResult({
                probability: (successes / ITERATIONS) * 100,
                successCount: successes,
                totalSims: ITERATIONS
            });
            setIsSimulating(false);
        }, 100);
    };

    const startEditing = (combo: SavedCombo) => {
        setComboName(combo.name);
        setEditingComboId(combo.id);
        setComboSize(combo.steps.length);
        setComboSteps(combo.steps);
        setSimulationResult({
            probability: combo.probability,
            successCount: 0,
            totalSims: 1000000
        });
        // Scroll to builder
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const cancelEdit = () => {
        setComboName('');
        setEditingComboId(null);
        setSimulationResult(null);
    };

    const saveCombo = async () => {
        if (!simulationResult || !comboName.trim()) return;
        setIsSaving(true);
        console.log('Front-end saving combo. editingComboId:', editingComboId);
        try {
            const body = {
                id: editingComboId,
                name: comboName,
                steps: comboSteps,
                probability: simulationResult.probability
            };
            console.log('Front-end save body:', body);
            const res = await fetch(`${API_BASE_URL}/api/deck/${id}/combos`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });
            if (res.ok) {
                setComboName('');
                setEditingComboId(null);
                fetchSavedCombos();
            }
        } catch (e) {
            console.error(e);
        } finally {
            setIsSaving(false);
        }
    };

    const deleteCombo = async (comboId: number) => {
        if (!confirm('Are you sure?')) return;
        try {
            await fetch(`${API_BASE_URL}/api/deck/${id}/combos?comboId=${comboId}`, { method: 'DELETE' });
            fetchSavedCombos();
        } catch (e) { console.error(e); }
    };

    if (loading) return <div className="text-primary p-10 font-black animate-pulse uppercase">Loading Deck...</div>;
    if (!deck) return <div className="text-red-500 p-10 font-black uppercase">Deck Not Found</div>;

    return (
        <main className="w-full max-w-[1600px] mx-auto px-6 py-8 pb-16 min-h-screen">
            <div className="mb-8 flex justify-between items-end border-b border-primary/20 pb-4">
                <div>
                    <h1 className="text-4xl font-black italic uppercase text-white leading-none">Combo Calculator</h1>
                    <p className="text-slate-500 font-bold uppercase tracking-widest text-[11px] mt-2">
                        Monte Carlo Simulation • {deck.name as string}
                    </p>
                </div>
                <Link to={`/dashboard/${id}`} className="text-primary hover:text-white text-xs font-black uppercase tracking-widest flex items-center gap-2">
                    <span className="material-icons text-sm">arrow_back</span> Back to Dashboard
                </Link>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                {/* Left Panel: Card Selector - Spans 4 cols */}
                <div className="lg:col-span-4 bg-slate-900/50 border border-white/5 rounded-lg p-6 max-h-[80vh] overflow-y-auto custom-scrollbar flex flex-col">
                    <h2 className="text-xs font-black uppercase tracking-[0.2em] text-primary mb-4">Deck Library</h2>
                    <p className="text-[10px] text-slate-500 mb-4 uppercase font-bold">Drag cards to a step or click to add to the active step.</p>
                    <div className="grid grid-cols-4 sm:grid-cols-5 gap-2 content-start">
                        {availableProbs.map((c: any) => (
                            <div
                                key={c.name}
                                draggable
                                onDragStart={(e) => handleDragStart(e, c)}
                                onClick={() => activeStepId && addCardToStep(c, activeStepId)}
                                className="aspect-[2.5/3.6] relative group cursor-pointer rounded overflow-hidden border border-white/10 hover:border-primary/50 transition-all hover:scale-105 active:scale-95"
                            >
                                <img src={c.img} alt={c.name} className="w-full h-full object-cover pointer-events-none" />
                                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                                    <span className="material-icons text-white">add_circle</span>
                                </div>
                                <div className="absolute bottom-0 right-0 bg-black/80 text-white text-[9px] font-black px-1.5 py-0.5 rounded-tl">
                                    x{c.count}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Right Panel: Builder & Results - Spans 8 cols */}
                <div className="lg:col-span-8 flex flex-col gap-6">

                    {/* Combo Configuration */}
                    <div className="bg-slate-900/50 border border-white/5 rounded-lg p-6">
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-xs font-black uppercase tracking-[0.2em] text-primary">Define Combo Sequence</h2>

                            {/* Combo Size Selector */}
                            <div className="flex bg-black/50 rounded-lg p-1 border border-white/10 overflow-x-auto">
                                {[1, 2, 3, 4, 5].map(size => (
                                    <button
                                        key={size}
                                        onClick={() => setComboSize(size)}
                                        className={`px-3 sm:px-4 py-1.5 rounded text-[10px] font-black uppercase transition-all whitespace-nowrap ${comboSize === size
                                            ? 'bg-primary text-background-dark shadow-lg'
                                            : 'text-slate-500 hover:text-white hover:bg-white/5'
                                            }`}
                                    >
                                        {size} Step{size > 1 ? 's' : ''}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Combo Steps Container */}
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {comboSteps.map((step, idx) => (
                                <div
                                    key={step.id}
                                    onClick={() => setActiveStepId(step.id)}
                                    onDragOver={handleDragOver}
                                    onDrop={(e) => handleDrop(e, step.id)}
                                    className={`relative min-h-[220px] rounded-lg p-3 transition-all border-2 flex flex-col gap-2 ${activeStepId === step.id
                                        ? 'border-primary bg-primary/5 shadow-[0_0_15px_rgba(212,133,69,0.1)]'
                                        : 'border-dashed border-white/10 hover:border-white/30 bg-black/20'
                                        }`}
                                >
                                    <div className="flex justify-between items-center mb-2 border-b border-white/5 pb-2">
                                        <div>
                                            <span className={`text-[10px] font-black uppercase tracking-widest block ${activeStepId === step.id ? 'text-primary' : 'text-slate-500'}`}>
                                                Step #{idx + 1}
                                            </span>
                                        </div>

                                        {/* Quantity Selector */}
                                        <div className="flex items-center gap-2 bg-black/40 rounded px-2 py-1 border border-white/10">
                                            <span className="text-[8px] uppercase text-slate-500 font-bold">Need</span>
                                            <select
                                                value={step.quantity || 1}
                                                onChange={(e) => updateStepQuantity(step.id, parseInt(e.target.value))}
                                                className="bg-transparent text-white text-[10px] font-bold focus:outline-none cursor-pointer"
                                            >
                                                <option value={1} className="bg-slate-900">1</option>
                                                <option value={2} className="bg-slate-900">2</option>
                                                <option value={3} className="bg-slate-900">3</option>
                                                <option value={4} className="bg-slate-900">4</option>
                                                <option value={5} className="bg-slate-900">5</option>
                                            </select>
                                        </div>
                                    </div>

                                    {/* Cards in Step */}
                                    <div className="flex-1 grid grid-cols-3 gap-1 content-start overflow-y-auto max-h-[160px] custom-scrollbar pr-1">
                                        {step.cards.length === 0 ? (
                                            <div className="col-span-3 flex flex-col items-center justify-center h-full text-slate-600">
                                                <span className="material-icons text-2xl opacity-20">add_to_photos</span>
                                                <span className="text-[8px] uppercase font-bold mt-2 text-center opacity-50">Drag or Click</span>
                                            </div>
                                        ) : (
                                            step.cards.map((c, cIdx) => (
                                                <div key={`${step.id}-${cIdx}`} className="aspect-[2.5/3.6] relative group rounded overflow-hidden border border-white/10 hover:border-red-500/50 transition-colors">
                                                    <img src={c.imageUrl || c.image_url} alt={c.cardName || c.card_name} className="w-full h-full object-cover" />
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); removeCardFromStep(step.id, cIdx); }}
                                                        className="absolute inset-0 bg-black/80 opacity-0 group-hover:opacity-100 flex items-center justify-center text-red-500 transition-opacity"
                                                    >
                                                        <span className="material-icons text-sm">close</span>
                                                    </button>
                                                </div>
                                            ))
                                        )}
                                    </div>

                                    {/* OR Indicator */}
                                    {step.cards.length > 1 && (
                                        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 bg-black/80 px-2 py-0.5 rounded text-[8px] font-black text-white uppercase border border-white/10 shadow-xl z-10 pointer-events-none whitespace-nowrap">
                                            ANY {step.quantity}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Simulation Button & Results */}
                    <div className="bg-gradient-to-br from-primary/10 to-transparent border border-primary/20 rounded-lg p-8 flex flex-col items-center justify-center gap-6 relative overflow-hidden min-h-[250px]">
                        {isSimulating ? (
                            <div className="flex flex-col items-center gap-4 z-10">
                                <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
                                <span className="text-primary font-black uppercase tracking-widest animate-pulse">Simulating 1M Hands...</span>
                            </div>
                        ) : (
                            <div className="z-10 flex flex-col items-center gap-4 w-full">
                                {simulationResult ? (
                                    <div className="text-center animate-in zoom-in duration-300 w-full flex flex-col items-center">
                                        <div className="text-[10px] text-slate-400 font-bold uppercase tracking-[0.2em] mb-2">Probability</div>
                                        <div className="text-6xl sm:text-8xl font-black italic text-transparent bg-clip-text bg-gradient-to-b from-white to-slate-400 drop-shadow-2xl">
                                            {simulationResult.probability.toFixed(2)}%
                                        </div>
                                        <div className="text-[10px] text-primary font-bold uppercase tracking-widest mt-4 mb-8 bg-primary/10 px-4 py-2 rounded-full border border-primary/20 inline-block">
                                            {simulationResult.successCount.toLocaleString()} / {simulationResult.totalSims.toLocaleString()} Hands
                                        </div>

                                        {/* Save Section */}
                                        <div className="w-full max-w-md bg-black/40 border border-white/10 rounded-lg p-4 flex gap-2">
                                            <input
                                                type="text"
                                                placeholder="Name this combo (e.g. Full Combo)"
                                                value={comboName}
                                                onChange={(e) => setComboName(e.target.value)}
                                                className="flex-1 bg-transparent border-b border-white/20 text-sm px-2 focus:outline-none focus:border-primary text-white placeholder-slate-600"
                                            />
                                            <button
                                                onClick={saveCombo}
                                                disabled={!comboName.trim() || isSaving}
                                                className="bg-white text-black text-xs font-black uppercase px-4 py-2 rounded hover:bg-primary hover:text-white transition-colors disabled:opacity-50"
                                            >
                                                {isSaving ? 'Saving...' : (editingComboId ? 'Update' : 'Save')}
                                            </button>
                                            {editingComboId && (
                                                <button
                                                    onClick={cancelEdit}
                                                    className="bg-slate-800 text-slate-400 text-xs font-black uppercase px-4 py-2 rounded hover:bg-red-500 hover:text-white transition-colors"
                                                >
                                                    Cancel
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                ) : (
                                    <span className="text-slate-500 font-black uppercase tracking-widest text-xs">Ready to Calculate</span>
                                )}

                                <button
                                    onClick={runSimulation}
                                    disabled={comboSteps.some(s => s.cards.length === 0)}
                                    className={`mt-4 px-8 py-4 bg-primary text-background-dark text-sm font-black uppercase tracking-[0.1em] rounded shadow-[0_0_20px_rgba(212,133,69,0.4)] hover:shadow-[0_0_30px_rgba(212,133,69,0.6)] hover:scale-105 active:scale-95 transition-all disabled:opacity-50 disabled:grayscale disabled:cursor-not-allowed`}
                                >
                                    {simulationResult ? 'Run Again' : 'Calculate Probability'}
                                </button>
                            </div>
                        )}

                        {/* Background Decor */}
                        <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 blur-[100px] rounded-full pointer-events-none"></div>
                        <div className="absolute bottom-0 left-0 w-64 h-64 bg-accent-blue/5 blur-[100px] rounded-full pointer-events-none"></div>
                    </div>

                    {/* Saved Combos List */}
                    {savedCombos.length > 0 && (
                        <div className="bg-slate-900/50 border border-white/5 rounded-lg p-6">
                            <h2 className="text-xs font-black uppercase tracking-[0.2em] text-white mb-4">Saved Combos</h2>
                            <div className="space-y-2">
                                {savedCombos.map(combo => (
                                    <div key={combo.id} className="flex items-center justify-between bg-black/40 p-3 rounded border border-white/5 hover:border-white/20 transition-colors">
                                        <div className="flex items-center gap-4">
                                            <span className="text-primary font-black text-lg w-16 text-right">{Number(combo.probability).toFixed(2)}%</span>
                                            <div>
                                                <div className="text-sm font-bold text-white uppercase">{combo.name}</div>
                                                <div className="text-[10px] text-slate-500">{combo.steps.length} Step Combo</div>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <button onClick={() => startEditing(combo)} className="text-slate-600 hover:text-primary transition-colors p-1" title="Edit">
                                                <span className="material-icons text-sm">edit</span>
                                            </button>
                                            <button onClick={() => deleteCombo(combo.id)} className="text-slate-600 hover:text-red-500 transition-colors p-1" title="Delete">
                                                <span className="material-icons text-sm">delete</span>
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                </div>
            </div>
        </main>
    );
}

export default Combos;
