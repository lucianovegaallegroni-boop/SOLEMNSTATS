import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { API_BASE_URL } from '../config'
import { ConfirmationModal } from '../components/ConfirmationModal'

interface Deck {
    id: number;
    name: string;
    createdAt: string;
    totalCards: number;
    rawList: string;
}

function Decks() {
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
    }, [])

    const fetchDecks = () => {
        fetch(`${API_BASE_URL}/api/list-decks`)
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
                    {decks.map((deck) => (
                        <div key={deck.id} className="ygo-card-border p-6 rounded-xl hover:scale-[1.02] transition-all group">
                            <div className="flex justify-between items-start mb-4">
                                <div className="p-2 bg-primary/10 rounded-lg">
                                    <span className="material-icons text-primary">layers</span>
                                </div>
                                <span className="text-[10px] font-black text-slate-500 uppercase tracking-tighter">
                                    {new Date(deck.createdAt).toLocaleDateString()}
                                </span>
                            </div>

                            <h3 className="text-xl font-black text-white uppercase italic mb-1 truncate">{deck.name}</h3>
                            <p className="text-xs font-bold text-primary uppercase tracking-widest mb-6">
                                {deck.totalCards} Cards Total
                            </p>

                            <div className="flex items-center gap-2 pt-4 border-t border-slate-800">
                                <Link to={`/dashboard/${deck.id}`} className="flex-1 py-2 text-center bg-slate-800 hover:bg-slate-700 rounded text-[10px] font-black uppercase tracking-widest transition-all">
                                    View
                                </Link>
                                <Link to={`/edit-deck/${deck.id}`} className="px-4 py-2 text-center bg-primary/10 border border-primary/30 hover:bg-primary/20 rounded text-[10px] font-black uppercase tracking-widest text-primary transition-all">
                                    Edit
                                </Link>
                                <button
                                    className="p-2 text-slate-500 hover:text-red-500 transition-colors"
                                    onClick={() => handleDelete(deck.id, deck.name)}
                                >
                                    <span className="material-icons text-sm">delete</span>
                                </button>
                            </div>
                        </div>
                    ))}
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
