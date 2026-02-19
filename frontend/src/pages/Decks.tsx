import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { API_BASE_URL } from '../config'
import { ConfirmationModal } from '../components/ConfirmationModal'

interface Deck {
    id: number;
    name: string;
    createdAt: string;
    totalCards: number;
    coverImageUrl?: string;
    rawList: string;
    cards: any[];
}

import { useAuth } from '../context/AuthContext'

function Decks() {
    const { user } = useAuth()
    const [decks, setDecks] = useState<Deck[]>([])
    const [loading, setLoading] = useState(true)

    // Modal state
    const [modalConfig, setModalConfig] = useState<{
        isOpen: boolean;
        title: string;
        message: string;
        onConfirm: () => void;
        type?: 'primary' | 'danger';
    }>({
        isOpen: false,
        title: '',
        message: '',
        onConfirm: () => { },
    });

    useEffect(() => {
        fetchDecks()
    }, [user])

    const fetchDecks = () => {
        const url = user
            ? `${API_BASE_URL}/api/decks?user_id=${user.id}`
            : `${API_BASE_URL}/api/decks`

        fetch(url)
            .then(response => response.json())
            .then(data => {
                setDecks(data)
                setLoading(false)
            })
            .catch(error => {
                console.error('Error fetching decks:', error)
                setLoading(false)
            })
    }

    const handleDelete = async (id: number, name: string) => {
        setModalConfig({
            isOpen: true,
            title: 'Delete Deck',
            message: `Are you sure you want to delete the deck "${name}"? This action cannot be undone.`,
            type: 'danger',
            onConfirm: async () => {
                try {
                    const response = await fetch(`${API_BASE_URL}/api/deck/${id}`, {
                        method: 'DELETE',
                    });

                    if (response.ok) {
                        setDecks(decks.filter(deck => deck.id !== id));
                        setModalConfig(prev => ({ ...prev, isOpen: false }));
                    } else {
                        alert("Error al borrar el mazo.");
                        setModalConfig(prev => ({ ...prev, isOpen: false }));
                    }
                } catch (error) {
                    console.error('Error deleting deck:', error);
                    alert("Error de conexión al borrar el mazo.");
                    setModalConfig(prev => ({ ...prev, isOpen: false }));
                }
            }
        });
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
            </div>
        )
    }

    return (
        <main className="max-w-[1200px] mx-auto px-6 py-12">
            <div className="flex justify-between items-end mb-10">
                <div>
                    <h1 className="text-4xl font-bold tracking-tight text-white uppercase italic">My <span className="text-primary">Decks</span></h1>
                    <p className="text-slate-500 font-medium uppercase tracking-widest text-xs mt-2">Manage and analyze your saved deck collections</p>
                </div>
                <Link to="/" className="bg-primary/10 border border-primary/20 text-primary px-6 py-2 rounded-lg font-bold text-sm hover:bg-primary/20 transition-all flex items-center gap-2">
                    <span className="material-icons text-sm">add_circle</span>
                    New Deck
                </Link>
            </div>

            {decks.length === 0 ? (
                <div className="text-center py-20 bg-card-dark/30 rounded-2xl border border-dashed border-border-dark">
                    <span className="material-icons text-6xl text-slate-700 mb-4">folder_off</span>
                    <h3 className="text-xl font-bold text-slate-400">No decks found</h3>
                    <p className="text-slate-600 mb-6">Import your first deck to see it here.</p>
                    <Link to="/" className="inline-flex items-center justify-center px-8 py-3 bg-primary text-background-dark rounded-lg font-bold hover:bg-[#c19a2e] transition-all">
                        Import Now
                    </Link>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {decks.map((deck) => {
                        // Helper to get cropped artwork version
                        const getCroppedImage = (url: string | undefined) => {
                            if (!url) return 'https://images.ygoprodeck.com/images/cards/back_high.jpg';
                            // If it's a default backing, don't crop
                            if (url.includes('back_high')) return url;
                            // Replace /cards/ with /cards_cropped/ for artwork only
                            return url.replace('/cards/', '/cards_cropped/').replace('/cards_small/', '/cards_cropped/');
                        };

                        const coverCard = (deck.cards || []).find((c: any) => c.imageUrl) ||
                            (deck.cards || [])[0];
                        const rawCoverImage = deck.coverImageUrl || coverCard?.imageUrl;
                        const coverImage = getCroppedImage(rawCoverImage);

                        return (
                            <div key={deck.id} className="ygo-card-border p-0 rounded-xl hover:scale-[1.02] transition-all group overflow-hidden flex flex-col bg-card-dark relative">
                                {/* Deck Cover Image Background with Gradient */}
                                <div className="absolute inset-0 z-0">
                                    <img
                                        src={coverImage}
                                        alt="Deck Cover"
                                        className="w-full h-full object-cover opacity-20 group-hover:opacity-30 transition-opacity blur-[2px]"
                                    />
                                    <div className="absolute inset-0 bg-gradient-to-t from-card-dark via-card-dark/80 to-transparent"></div>
                                </div>

                                <div className="relative z-10 p-6 flex-1 flex flex-col">
                                    <div className="flex justify-between items-start mb-4">
                                        <div className="flex gap-3 items-center">
                                            {/* Small circular avatar of the Ace Card */}
                                            <div className="w-10 h-10 rounded-full border border-primary/30 overflow-hidden shadow-lg bg-black">
                                                <img src={coverImage} alt="Ace" className="w-full h-full object-cover" />
                                            </div>
                                            <div className="flex flex-col">
                                                <span className="text-[10px] font-black text-slate-500 uppercase tracking-tighter">
                                                    {new Date(deck.createdAt).toLocaleDateString()}
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    <h3 className="text-xl font-black text-white uppercase italic mb-1 truncate shadow-black drop-shadow-md">{deck.name}</h3>
                                    <p className="text-xs font-bold text-primary uppercase tracking-widest mb-6">
                                        {deck.totalCards} Cards Total
                                    </p>

                                    <div className="mt-auto flex items-center gap-2 pt-4 border-t border-white/10">
                                        <Link to={`/dashboard/${deck.id}`} className="flex-1 py-2 bg-primary text-background-dark hover:bg-[#c19a2e] rounded flex items-center justify-center transition-all shadow-lg shadow-primary/10" title="View Deck">
                                            <span className="material-icons">visibility</span>
                                        </Link>
                                        <button
                                            onClick={() => {
                                                navigator.clipboard.writeText(`${window.location.origin}/dashboard/${deck.id}`);
                                                // Could add a toast here, but for now a simple alert or just action is fine. 
                                                // Ideally use a toast state.
                                                const btn = document.getElementById(`share-btn-${deck.id}`);
                                                if (btn) {
                                                    const originalText = btn.innerHTML;
                                                    btn.innerHTML = '<span class="material-icons text-sm">check</span>';
                                                    setTimeout(() => btn.innerHTML = originalText, 2000);
                                                }
                                            }}
                                            id={`share-btn-${deck.id}`}
                                            className="px-3 py-2 text-center bg-slate-800 hover:bg-slate-700 rounded text-slate-400 hover:text-white transition-all border border-slate-700"
                                            title="Share Deck Link"
                                        >
                                            <span className="material-icons text-sm">share</span>
                                        </button>
                                        <Link to={`/edit-deck/${deck.id}`} className="px-3 py-2 text-center bg-slate-800 hover:bg-slate-700 rounded text-slate-400 hover:text-white transition-all border border-slate-700" title="Edit Deck">
                                            <span className="material-icons text-sm">edit</span>
                                        </Link>
                                        <button
                                            className="px-3 py-2 text-center bg-slate-800 hover:bg-red-900/50 hover:text-red-400 rounded text-slate-400 transition-all border border-slate-700"
                                            onClick={() => handleDelete(deck.id, deck.name)}
                                            title="Delete Deck"
                                        >
                                            <span className="material-icons text-sm">delete</span>
                                        </button>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            <ConfirmationModal
                {...modalConfig}
                onCancel={() => setModalConfig(prev => ({ ...prev, isOpen: false }))}
            />
        </main>
    )
}

export default Decks
