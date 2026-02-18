import { useState, useEffect } from "react"
import { useNavigate } from 'react-router-dom'
import { API_BASE_URL } from '../config'

import { useAuth } from '../context/AuthContext'

function Home() {
    const navigate = useNavigate()
    const { user } = useAuth()

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
    const [cardMetadata, setCardMetadata] = useState<Record<string, string>>({})
    const [selectedCard, setSelectedCard] = useState<any>(null)
    const [cardDetailsCache, setCardDetailsCache] = useState<Record<string, any>>({})

    const [cursorPosition, setCursorPosition] = useState(0)
    const [suppressedLine, setSuppressedLine] = useState<string | null>(null)

    // Debounce search for autocomplete based on cursor position
    useEffect(() => {
        const currentList = deckLists[activeTab];

        // Find line at cursor
        let start = cursorPosition;
        let end = cursorPosition;

        // Safety check for bounds
        if (start > currentList.length) start = currentList.length;
        if (end > currentList.length) end = currentList.length;

        while (start > 0 && currentList[start - 1] !== '\n') {
            start--;
        }
        while (end < currentList.length && currentList[end] !== '\n') {
            end++;
        }

        const currentLine = currentList.substring(start, end).trim();
        const cleanLine = currentLine.replace(/ x\d+$/i, '');

        // If this line matches the suppressed line exactly, don't search
        if (currentLine === suppressedLine) {
            setSuggestions([]);
            return;
        }

        // If we moved to a new line or changed content, clear suppression
        if (currentLine !== suppressedLine) {
            setSuppressedLine(null);
        }

        if (cleanLine.length < 2) {
            setSuggestions([]);
            setActiveSuggestionIdx(0);
            return;
        }

        const timer = setTimeout(() => {
            fetch(`${API_BASE_URL}/api/search-cards?q=${cleanLine}`)
                .then(res => res.json())
                .then(data => setSuggestions(data.slice(0, 30)))
                .catch(err => console.error('Search error:', err));
        }, 300);

        return () => clearTimeout(timer);
    }, [deckLists, activeTab, cursorPosition, suppressedLine]);

    // Metadata auto-fetcher for manual entries
    useEffect(() => {
        const allNames = Object.values(deckLists).flatMap(list =>
            list.split('\n')
                .filter(l => l.trim())
                .map(l => l.replace(/\s*[xX]\s*\d+$/, '').trim())
        );
        const uniqueNames = Array.from(new Set(allNames));
        const missing = uniqueNames.filter(name => !cardMetadata[name]);

        if (missing.length === 0) return;

        const timer = setTimeout(() => {
            missing.forEach(name => {
                fetch(`${API_BASE_URL}/api/search-cards?q=${encodeURIComponent(name)}`)
                    .then(res => res.json())
                    .then(data => {
                        const match = data.find((c: any) => c.name.toLowerCase() === name.toLowerCase()) || data[0];
                        if (match) {
                            setCardMetadata(prev => ({ ...prev, [name]: match.image_url_small }));
                        }
                    })
                    .catch(e => console.error('Meta fetch error:', e));
            });
        }, 1000);

        return () => clearTimeout(timer);
    }, [deckLists, cardMetadata]);

    const openCardDetail = (name: string) => {
        if (cardDetailsCache[name]) {
            setSelectedCard(cardDetailsCache[name]);
            return;
        }
        fetch(`${API_BASE_URL}/api/search-cards?q=${encodeURIComponent(name)}`)
            .then(res => res.json())
            .then(data => {
                const match = data.find((c: any) => c.name.toLowerCase() === name.toLowerCase()) || data[0];
                if (match) {
                    setCardDetailsCache(prev => ({ ...prev, [name]: match }));
                    setSelectedCard(match);
                }
            })
            .catch(e => console.error('Detail fetch error:', e));
    };

    const selectSuggestion = (idx: number, area: 'MAIN' | 'EXTRA' | 'SIDE') => {
        if (!suggestions[idx]) return;
        const suggestion = suggestions[idx];
        const currentList = deckLists[area];

        let start = cursorPosition;
        while (start > 0 && currentList[start - 1] !== '\n') start--;
        let end = cursorPosition;
        while (end < currentList.length && currentList[end] !== '\n') end++;

        const currentLine = currentList.substring(start, end);
        const match = currentLine.match(/(.*?)\s*[xX]\s*(\d+)$/);
        const quantity = match ? ` x${match[2]}` : '';

        const selectedCardName = suggestion.name;
        const newLine = selectedCardName + quantity;
        const newList = currentList.substring(0, start) + newLine + currentList.substring(end);

        setDeckLists(prev => ({ ...prev, [area]: newList }));
        setCardMetadata(prev => ({ ...prev, [selectedCardName]: suggestion.image_url_small }));
        setSuppressedLine(newLine);
        setSuggestions([]);
        setActiveSuggestionIdx(0);
    }

    const handleCursorActivity = (e: React.SyntheticEvent<HTMLTextAreaElement>) => {
        const target = e.target as HTMLTextAreaElement;
        setCursorPosition(target.selectionStart);
    }

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
                selectSuggestion(activeSuggestionIdx, activeTab);
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
                    name: deckName.trim() || "Mazo Importado",
                    user_id: user?.id
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
                                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${area === 'MAIN'
                                        ? (getSectionCount(deckLists[area]) < 40 || getSectionCount(deckLists[area]) > 60
                                            ? 'bg-red-500/10 text-red-500'
                                            : 'bg-primary/10 text-primary')
                                        : getSectionCount(deckLists[area]) > 15
                                            ? 'bg-red-500/10 text-red-500'
                                            : 'bg-accent-blue/10 text-accent-blue'
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
                                            onKeyUp={handleCursorActivity}
                                            onClick={handleCursorActivity}
                                            onSelect={handleCursorActivity}
                                        ></textarea>

                                        {activeTab === area && suggestions.length > 0 && !suppressedLine && (
                                            <div className={`absolute bottom-4 right-4 z-50 bg-card-dark border rounded-lg shadow-2xl p-2 min-w-[200px] max-h-[300px] overflow-hidden flex flex-col animate-in fade-in slide-in-from-bottom-2 ${area === 'MAIN' ? 'border-primary/30' : area === 'EXTRA' ? 'border-accent-blue/30' : 'border-accent-purple/30'}`}>
                                                <p className={`text-[10px] font-black uppercase mb-2 tracking-widest border-b pb-1 ${area === 'MAIN' ? 'text-primary border-primary/10' : area === 'EXTRA' ? 'text-accent-blue border-accent-blue/10' : 'text-accent-purple border-accent-purple/10'}`}>Suggestions (Shift)</p>
                                                <div className="space-y-1 overflow-y-auto custom-scrollbar pr-1">
                                                    {suggestions.map((card, idx) => (
                                                        <div
                                                            key={card.id}
                                                            onClick={() => selectSuggestion(idx, area)}
                                                            className={`flex items-center gap-2 p-1.5 rounded transition-colors cursor-pointer ${idx === activeSuggestionIdx ? (area === 'MAIN' ? 'bg-primary/20 border border-primary/30' : area === 'EXTRA' ? 'bg-accent-blue/20 border border-accent-blue/30' : 'bg-accent-purple/20 border border-accent-purple/30') : 'hover:bg-white/5'}`}
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
                                        <div className="flex-1 overflow-y-auto p-2 custom-scrollbar bg-black/40">
                                            {deckLists[area].trim() ? (
                                                <div className="grid grid-cols-6 sm:grid-cols-8 md:grid-cols-10 gap-1">
                                                    {deckLists[area].split('\n').flatMap((line, i) => {
                                                        if (!line.trim()) return [];
                                                        const match = line.match(/(.*?)\s*[xX]\s*(\d+)$/) || [null, line, '1'];
                                                        const name = match[1]?.trim() || line.trim();
                                                        const qty = parseInt(match[2] as string) || 1;
                                                        const imageUrl = cardMetadata[name];
                                                        const isOverLimit = qty > 3;

                                                        return Array.from({ length: qty }, (_, copyIdx) => (
                                                            <div key={`${i}-${copyIdx}`} className={`relative aspect-[2.5/3.6] group rounded overflow-hidden border transition-all cursor-pointer ${isOverLimit ? 'border-red-500/50 ring-1 ring-red-500/30' : 'border-white/10 hover:border-primary/50'}`} onClick={() => openCardDetail(name)}>
                                                                {imageUrl ? (
                                                                    <img src={imageUrl} alt={name} className="w-full h-full object-cover" />
                                                                ) : (
                                                                    <div className="w-full h-full bg-slate-800 flex items-center justify-center p-1">
                                                                        <span className="text-[5px] font-black uppercase text-center text-slate-500">{name}</span>
                                                                    </div>
                                                                )}
                                                                {/* Hover overlay with actions */}
                                                                <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                                                    <div className="flex gap-0.5">
                                                                        <button onClick={() => updateQuantity(area, i, qty + 1)} className="w-4 h-4 bg-primary/20 hover:bg-primary/40 rounded flex items-center justify-center text-primary"><span className="material-icons text-[10px] font-black">add</span></button>
                                                                        <button onClick={() => updateQuantity(area, i, qty - 1)} className="w-4 h-4 bg-red-500/20 hover:bg-red-500/40 rounded flex items-center justify-center text-red-500"><span className="material-icons text-[10px] font-black">remove</span></button>
                                                                    </div>
                                                                    <button onClick={() => removeCard(area, i)} className="w-4 h-4 bg-white/10 hover:bg-white/20 rounded flex items-center justify-center text-white"><span className="material-icons text-[10px] font-black">delete</span></button>
                                                                </div>
                                                            </div>
                                                        ));
                                                    })}
                                                </div>
                                            ) : (
                                                <div className="h-full flex items-center justify-center text-slate-500 italic text-sm font-black uppercase tracking-widest">No cards in {area}</div>
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

            {/* Card Detail Modal */}
            {selectedCard && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-md p-4 sm:p-6" onClick={() => setSelectedCard(null)}>
                    <div className="bg-card-dark border border-border-dark rounded-3xl shadow-2xl max-w-3xl w-full overflow-hidden animate-in fade-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
                        <div className="flex flex-col md:flex-row">
                            <div className="w-full md:w-[300px] flex-shrink-0 bg-black/20">
                                <img src={selectedCard.image_url} alt={selectedCard.name} className="w-full h-auto md:h-full object-contain" />
                            </div>
                            <div className="flex-1 p-6 sm:p-8 flex flex-col gap-4 overflow-y-auto max-h-[80vh] custom-scrollbar">
                                <div className="flex justify-between items-start gap-4">
                                    <h2 className="text-xl sm:text-2xl font-black text-white uppercase tracking-wider leading-tight">{selectedCard.name}</h2>
                                    <button onClick={() => setSelectedCard(null)} className="text-slate-500 hover:text-white transition-colors">
                                        <span className="material-icons">close</span>
                                    </button>
                                </div>
                                <div className="flex flex-wrap gap-1.5">
                                    <span className="px-2 py-0.5 bg-primary/10 text-primary text-[10px] font-black uppercase rounded-full">{selectedCard.type}</span>
                                    {selectedCard.race && <span className="px-2 py-0.5 bg-accent-blue/10 text-accent-blue text-[10px] font-black uppercase rounded-full">{selectedCard.race}</span>}
                                    {selectedCard.attribute && <span className="px-2 py-0.5 bg-accent-purple/10 text-accent-purple text-[10px] font-black uppercase rounded-full">{selectedCard.attribute}</span>}
                                </div>
                                {!(selectedCard.type?.toLowerCase().includes('spell') || selectedCard.type?.toLowerCase().includes('trap')) && (selectedCard.atk !== undefined || selectedCard.def !== undefined) && (
                                    <div className="flex gap-4 text-xs font-black">
                                        {selectedCard.level !== undefined && <span className="text-yellow-400">★ {selectedCard.level}</span>}
                                        {selectedCard.atk !== undefined && <span className="text-red-400">ATK {selectedCard.atk}</span>}
                                        {selectedCard.def !== undefined && <span className="text-blue-400">DEF {selectedCard.def}</span>}
                                    </div>
                                )}
                                <div className="border-t border-border-dark pt-3">
                                    <p className="text-[11px] text-slate-300 leading-relaxed whitespace-pre-wrap">{selectedCard.desc}</p>
                                </div>
                                <button onClick={() => setSelectedCard(null)} className="mt-auto self-end px-4 py-1.5 bg-primary/10 hover:bg-primary/20 text-primary text-xs font-black uppercase rounded-lg transition-colors">Close</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </main>
    )
}


export default Home
