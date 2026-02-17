import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { API_BASE_URL } from '../config';

interface ComboStep {
    id: string;
    label: string;
    quantity: number;
    cards: any[];
}

interface SavedCombo {
    id: number;
    name: string;
    probability: number;
    steps: ComboStep[];
    created_at: string;
}

export function SavedCombosWidget({ deckId }: { deckId: string }) {
    const [combos, setCombos] = useState<SavedCombo[]>([]);
    const navigate = useNavigate();

    const fetchCombos = () => {
        fetch(`${API_BASE_URL}/api/deck/${deckId}/combos`)
            .then(res => res.json())
            .then(data => {
                console.log('Dashboard fetched combos:', data);
                if (Array.isArray(data)) setCombos(data);
            })
            .catch(console.error);
    };

    const deleteCombo = async (comboId: number) => {
        if (!confirm('Delete this combo?')) return;
        try {
            await fetch(`${API_BASE_URL}/api/deck/${deckId}/combos?comboId=${comboId}`, { method: 'DELETE' });
            fetchCombos();
        } catch (e) { console.error(e); }
    };

    useEffect(() => {
        if (deckId) fetchCombos();
    }, [deckId]);

    if (combos.length === 0) return null;

    return (
        <div className="bg-slate-900/50 border border-white/5 rounded-lg p-6">
            <h2 className="text-xs font-black uppercase tracking-[0.2em] text-primary mb-4">Saved Combos</h2>
            <div className="space-y-2">
                {combos.map(combo => (
                    <div key={combo.id} className="bg-black/40 p-4 rounded border border-white/5 hover:border-white/20 transition-all group">
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-4">
                                <span className="text-primary font-black text-lg w-16 text-right">{Number(combo.probability).toFixed(2)}%</span>
                                <div>
                                    <div className="text-sm font-bold text-white uppercase">{combo.name}</div>
                                    <div className="text-[10px] text-slate-500 uppercase tracking-wider">{combo.steps.map(s => s.quantity).reduce((a, b) => a + b, 0)} Total Copies Needed</div>
                                </div>
                            </div>
                            <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button
                                    onClick={() => navigate(`/combos/${deckId}`, { state: { comboToEdit: combo } })}
                                    className="text-slate-600 hover:text-primary transition-colors p-1"
                                    title="Edit Combo"
                                >
                                    <span className="material-icons text-sm">edit</span>
                                </button>
                                <button
                                    onClick={() => deleteCombo(combo.id)}
                                    className="text-slate-600 hover:text-red-500 transition-colors p-1"
                                    title="Delete Combo"
                                >
                                    <span className="material-icons text-sm">delete</span>
                                </button>
                            </div>
                        </div>

                        {/* Combo Steps and Cards */}
                        <div className="space-y-3 pl-4 border-l border-white/10 ml-8">
                            {combo.steps.map((step, idx) => (
                                <div key={step.id} className="space-y-1">
                                    <div className="flex items-center gap-2">
                                        <span className="text-[9px] font-black text-slate-500 uppercase">Card #{idx + 1}</span>
                                        {step.quantity > 1 && <span className="text-[8px] bg-white/5 text-slate-400 px-1 rounded font-bold uppercase">Need {step.quantity}</span>}
                                    </div>
                                    <div className="flex flex-wrap gap-1.5">
                                        {step.cards.map((card, cIdx) => (
                                            <div key={`${step.id}-${cIdx}`} className="w-10 aspect-[2.5/3.6] relative group/card rounded overflow-hidden border border-white/10 hover:border-primary/50 transition-all bg-slate-800">
                                                <img
                                                    src={card.imageUrl || card.image_url}
                                                    alt={card.cardName || card.card_name}
                                                    className="w-full h-full object-cover"
                                                    title={card.cardName || card.card_name}
                                                />
                                                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/card:opacity-100 transition-opacity pointer-events-none" />
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
