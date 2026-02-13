import { useState, useEffect } from "react"
import { useNavigate } from 'react-router-dom'
import { API_BASE_URL } from '../config'

function Home() {
    const navigate = useNavigate()

    const [activeTab, setActiveTab] = useState<'MAIN' | 'EXTRA' | 'SIDE'>('MAIN')
    const [deckLists, setDeckLists] = useState({
        MAIN: '',
        EXTRA: '',
        SIDE: ''
    })
    const [deckName, setDeckName] = useState('')
    const [isAnalyzing, setIsAnalyzing] = useState(false)
    const [suggestions, setSuggestions] = useState<any[]>([])
    const [activeSuggestionIdx, setActiveSuggestionIdx] = useState(0)

    // Debounce search for autocomplete based on current active tab list
    useEffect(() => {
        const currentList = deckLists[activeTab];
        const lastLine = currentList.split('\n').pop()?.trim().replace(/ x\d+$/i, '') || '';

        if (lastLine.length < 2) {
            setSuggestions([]);
            setActiveSuggestionIdx(0);
            return;
        }

        const timer = setTimeout(() => {
            fetch(`${API_BASE_URL}/api/search-cards?q=${lastLine}`)
                .then(res => res.json())
                .then(data => setSuggestions(data.slice(0, 5)))
                .catch(err => console.error('Search error:', err));
        }, 300);

        return () => clearTimeout(timer);
    }, [deckLists, activeTab]);

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (suggestions.length > 0) {
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                setActiveSuggestionIdx(prev => (prev + 1) % suggestions.length);
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setActiveSuggestionIdx(prev => (prev - 1 + suggestions.length) % suggestions.length);
            } else if (e.key === 'Shift') {
                e.preventDefault();
                const currentList = deckLists[activeTab];
                const lines = currentList.split('\n');
                const lastLine = lines[lines.length - 1];

                const match = lastLine.match(/(.*?)\s*[xX]\s*(\d+)$/);
                const quantity = match ? ` x${match[2]}` : '';

                lines[lines.length - 1] = suggestions[activeSuggestionIdx].name + quantity;

                setDeckLists(prev => ({
                    ...prev,
                    [activeTab]: lines.join('\n')
                }));
                setSuggestions([]);
                setActiveSuggestionIdx(0);
            }
        }
    };

    const updateQuantity = (area: 'MAIN' | 'EXTRA' | 'SIDE', lineIndex: number, newQty: number) => {
        if (newQty < 1) return;
        const lines = deckLists[area].split('\n');
        const line = lines[lineIndex];
        const match = line.match(/(.*?)\s*[xX]\s*(\d+)$/);

        if (match) {
            lines[lineIndex] = `${match[1]} x${newQty}`;
        } else {
            lines[lineIndex] = `${line.trim()} x${newQty}`;
        }

        setDeckLists(prev => ({ ...prev, [area]: lines.join('\n') }));
    };

    const removeCard = (area: 'MAIN' | 'EXTRA' | 'SIDE', lineIndex: number) => {
        const lines = deckLists[area].split('\n');
        lines.splice(lineIndex, 1);
        setDeckLists(prev => ({ ...prev, [area]: lines.join('\n') }));
    };

    const handleAnalyze = async () => {
        if (!deckLists.MAIN.trim() && !deckLists.EXTRA.trim() && !deckLists.SIDE.trim()) {
            alert("Por favor, ingresa al menos una carta.");
            return;
        }

        if (getSectionCount(deckLists.EXTRA) > 15) {
            alert("El Extra Deck no puede tener más de 15 cartas.");
            return;
        }

        if (getSectionCount(deckLists.SIDE) > 15) {
            alert("El Side Deck no puede tener más de 15 cartas.");
            return;
        }

        setIsAnalyzing(true);
        try {
            const response = await fetch(`${API_BASE_URL}/api/save-deck/`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    main_list: deckLists.MAIN,
                    extra_list: deckLists.EXTRA,
                    side_list: deckLists.SIDE,
                    name: deckName.trim() || "Mazo Importado"
                }),
            });

            if (response.ok) {
                const data = await response.json();
                navigate(`/dashboard/${data.id}`);
            } else {
                const errorData = await response.json();
                alert(`Error: ${errorData.error || 'No se pudo guardar el mazo'}`);
            }
        } catch (error) {
            console.error('Error saving deck:', error);
            alert("Error de conexión con el servidor.");
        } finally {
            setIsAnalyzing(false);
        }
    }

    const getSectionCount = (text: string) => {
        return text.split('\n').reduce((acc, line) => {
            if (!line.trim()) return acc;
            const match = line.match(/[xX]\s*(\d+)$/);
            const qty = match ? parseInt(match[1]) : 1;
            return acc + qty;
        }, 0);
    };

    const getAllItemsCount = () => {
        return Object.values(deckLists).reduce((acc, list) => acc + getSectionCount(list), 0);
    }

    return (
        <main className="max-w-full mx-auto px-6 py-12">
            <div className="text-center mb-10">
                <h1 className="text-4xl font-bold mb-4 tracking-tight">Import Your <span className="text-primary">Deck List</span></h1>
                <p className="text-slate-500 dark:text-slate-400 text-lg max-w-xl mx-auto">
                    Analyze consistency across Main, Extra, and Side decks.
                </p>
            </div>

            <div className="bg-white dark:bg-card-dark border border-slate-200 dark:border-border-dark rounded-xl shadow-2xl overflow-hidden">
                <div className="p-8">
                    <div className="mb-10">
                        <label className="block text-xs font-black uppercase tracking-[0.2em] text-slate-500 mb-2">Deck Name</label>
                        <input
                            type="text"
                            className="w-full bg-slate-50 dark:bg-background-dark/50 border border-slate-200 dark:border-border-dark rounded-lg px-4 py-3 text-sm focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all text-slate-900 dark:text-white placeholder:text-slate-600"
                            placeholder="Example: My Branded Engine 2024"
                            value={deckName}
                            onChange={(e) => setDeckName(e.target.value)}
                        />
                    </div>

                    <div className="space-y-12">
                        {(['MAIN', 'EXTRA', 'SIDE'] as const).map(area => (
                            <div key={area} className="border-t border-slate-200 dark:border-border-dark pt-8 first:border-0 first:pt-0">
                                <div className="flex items-center gap-3 mb-4">
                                    <h3 className={`text-sm font-black uppercase tracking-[0.2em] ${area === 'MAIN' ? 'text-primary' : area === 'EXTRA' ? 'text-accent-blue' : 'text-accent-purple'}`}>
                                        {area} Deck
                                    </h3>
                                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${area === 'MAIN' ? 'bg-primary/10 text-primary' :
                                        getSectionCount(deckLists[area]) > 15 ? 'bg-red-500/10 text-red-500' : 'bg-accent-blue/10 text-accent-blue'
                                        }`}>
                                        {getSectionCount(deckLists[area])} cards
                                    </span>
                                </div>

                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                                    {/* Left: Input Editor */}
                                    <div className="relative">
                                        <textarea
                                            className={`w-full h-[400px] bg-slate-50 dark:bg-background-dark/50 border border-slate-200 dark:border-border-dark rounded-lg p-6 font-mono text-sm text-slate-900 dark:text-slate-100 focus:ring-2 outline-none custom-scrollbar resize-none transition-all ${area === 'MAIN' ? 'focus:ring-primary' : area === 'EXTRA' ? 'focus:ring-accent-blue' : 'focus:ring-accent-purple'}`}
                                            placeholder={`Paste your ${area.toLowerCase()} deck list here...`}
                                            value={deckLists[area]}
                                            onFocus={() => setActiveTab(area)}
                                            onChange={(e) => setDeckLists(prev => ({ ...prev, [area]: e.target.value }))}
                                            onKeyDown={handleKeyDown}
                                        ></textarea>

                                        {activeTab === area && suggestions.length > 0 && (
                                            <div className={`absolute bottom-4 right-4 z-50 bg-card-dark border rounded-lg shadow-2xl p-2 min-w-[200px] animate-in fade-in slide-in-from-bottom-2 ${area === 'MAIN' ? 'border-primary/30' : area === 'EXTRA' ? 'border-accent-blue/30' : 'border-accent-purple/30'}`}>
                                                <p className={`text-[10px] font-black uppercase mb-2 tracking-widest border-b pb-1 ${area === 'MAIN' ? 'text-primary border-primary/10' : area === 'EXTRA' ? 'text-accent-blue border-accent-blue/10' : 'text-accent-purple border-accent-purple/10'}`}>Suggestions (Shift)</p>
                                                <div className="space-y-1">
                                                    {suggestions.map((card, idx) => (
                                                        <div
                                                            key={card.id}
                                                            className={`flex items-center gap-2 p-1.5 rounded transition-colors ${idx === activeSuggestionIdx ? (area === 'MAIN' ? 'bg-primary/20 border border-primary/30' : area === 'EXTRA' ? 'bg-accent-blue/20 border border-accent-blue/30' : 'bg-accent-purple/20 border border-accent-purple/30') : 'hover:bg-white/5'}`}
                                                        >
                                                            <img src={card.image_url_small} alt="" className="w-6 h-9 object-cover rounded-sm" />
                                                            <p className="text-[10px] font-bold text-white truncate">{card.name}</p>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {/* Right: Live Preview */}
                                    <div className="bg-slate-50 dark:bg-background-dark/30 border border-slate-200 dark:border-border-dark rounded-lg flex flex-col h-[400px]">
                                        <div className="px-4 py-3 border-b border-slate-200 dark:border-border-dark flex justify-between items-center bg-white/5">
                                            <span className={`text-xs font-black uppercase tracking-widest ${area === 'MAIN' ? 'text-primary' : area === 'EXTRA' ? 'text-accent-blue' : 'text-accent-purple'}`}>Live Preview</span>
                                        </div>
                                        <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                                            {deckLists[area].trim() ? (
                                                <div className="space-y-2">
                                                    {deckLists[area].split('\n').map((line, i) => {
                                                        if (!line.trim()) return null;
                                                        const match = line.match(/(.*?)\s*[xX]\s*(\d+)$/) || [null, line, '1'];
                                                        const name = match[1]?.trim() || line.trim();
                                                        const qty = parseInt(match[2] as string) || 1;
                                                        return (
                                                            <div key={i} className="flex items-center justify-between p-3 bg-white dark:bg-card-dark/40 border border-slate-200 dark:border-primary/10 rounded-lg group hover:border-primary/30 transition-all">
                                                                <div className="flex items-center gap-3 overflow-hidden">
                                                                    <button onClick={() => removeCard(area, i)} className="text-slate-600 hover:text-red-500"><span className="material-icons text-lg">delete_outline</span></button>
                                                                    <span className="text-sm font-bold text-slate-700 dark:text-slate-200 truncate uppercase italic">{name}</span>
                                                                </div>
                                                                <div className="flex items-center gap-1 bg-background-dark/50 rounded-md p-1 border border-white/5">
                                                                    <button onClick={() => updateQuantity(area, i, qty - 1)} className="w-4 h-4 flex items-center justify-center text-slate-400 hover:text-white"><span className="material-icons text-xs">remove</span></button>
                                                                    <span className="text-[12px] font-black text-primary italic px-2">{qty}</span>
                                                                    <button onClick={() => updateQuantity(area, i, qty + 1)} className="w-4 h-4 flex items-center justify-center text-slate-400 hover:text-white"><span className="material-icons text-xs">add</span></button>
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            ) : (
                                                <div className="h-full flex items-center justify-center text-slate-500 italic text-sm">No cards</div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="flex justify-between items-center mt-12 pt-8 border-t border-slate-200 dark:border-border-dark">
                        <div className="text-xs font-bold text-slate-500 uppercase tracking-widest">
                            Total Cards: <span className="text-primary">{getAllItemsCount()}</span>
                        </div>
                        <div className="flex gap-4">
                            <button onClick={() => setDeckLists({ MAIN: '', EXTRA: '', SIDE: '' })} className="px-6 py-3 text-slate-500 font-medium font-black uppercase text-xs tracking-widest">Clear All</button>
                            <button
                                onClick={handleAnalyze}
                                disabled={isAnalyzing}
                                className="px-10 py-3 bg-primary text-background-dark rounded-lg font-bold text-lg hover:bg-[#c19a2e] transition-all neon-glow"
                            >
                                {isAnalyzing ? 'Analyzing...' : 'Analyze Deck'}
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-12">
                <div className="p-6 bg-white dark:bg-card-dark border border-slate-200 dark:border-border-dark rounded-xl border-t-2 border-t-primary/50">
                    <span className="material-icons text-primary mb-3">auto_fix_high</span>
                    <h4 className="font-bold mb-1">Probability Engine</h4>
                    <p className="text-xs text-slate-500 leading-relaxed">Calculate the odds of drawing your starters, 'outs', or hand traps in your opening 5 cards.</p>
                </div>
                <div className="p-6 bg-white dark:bg-card-dark border border-slate-200 dark:border-border-dark rounded-xl border-t-2 border-t-accent-purple/50">
                    <span className="material-icons text-primary mb-3">gavel</span>
                    <h4 className="font-bold mb-1">Banlist Check</h4>
                    <p className="text-xs text-slate-500 leading-relaxed">Instantly verify if your deck complies with the latest Forbidden & Limited lists.</p>
                </div>
                <div className="p-6 bg-white dark:bg-card-dark border border-slate-200 dark:border-border-dark rounded-xl border-t-2 border-t-primary/50">
                    <span className="material-icons text-primary mb-3">auto_graph</span>
                    <h4 className="font-bold mb-1">Combo Paths</h4>
                    <p className="text-xs text-slate-500 leading-relaxed">Map out potential end-boards based on your engine size and generic extender ratios.</p>
                </div>
            </div>

            <div className="mt-16 text-center border-t border-slate-200 dark:border-border-dark pt-8 pb-12">
                <p className="text-slate-500 text-sm mb-4">Analyze your total consistency across all deck sections.</p>
            </div>
        </main>
    )
}


export default Home
