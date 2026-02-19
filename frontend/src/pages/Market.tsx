import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { API_BASE_URL } from '../config'

interface MarketItem {
    id: string;
    userId?: string;
    type: 'sell' | 'buy';
    cardName: string;
    price: string | number;
    currency: string;
    sellerName: string;
    sellerPhone: string;
    location: string;
    imageUrl: string;
    condition: string;
    rarity: string;
    postedAt: string;
}

export default function Market() {
    const { user } = useAuth()
    const [viewMode, setViewMode] = useState<'buy' | 'sell'>('sell')
    const [showListModal, setShowListModal] = useState(false)
    const [searchTerm, setSearchTerm] = useState('')
    const [loading, setLoading] = useState(true)
    const [submitting, setSubmitting] = useState(false)
    const [items, setItems] = useState<MarketItem[]>([])

    // New Listing Form State
    const [newItem, setNewItem] = useState({
        type: 'sell',
        cardName: '',
        price: '',
        condition: 'Near Mint',
        rarity: 'Common',
        location: ''
    })
    const [cardSuggestions, setCardSuggestions] = useState<any[]>([])
    const [selectedCardImage, setSelectedCardImage] = useState('')
    const [previewImage, setPreviewImage] = useState<string | null>(null)

    // Card Search for Listing Suggestion
    const [isSearchingCards, setIsSearchingCards] = useState(false)
    const [skipSearch, setSkipSearch] = useState(false)

    useEffect(() => {
        fetchListings()
    }, [viewMode])

    const fetchListings = async () => {
        setLoading(true)
        try {
            const res = await fetch(`${API_BASE_URL}/api/market?type=${viewMode}`)
            const data = await res.json()
            setItems(data)
        } catch (err) {
            console.error('Error fetching listings:', err)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        if (newItem.cardName.length < 3 || skipSearch || (cardSuggestions[0] && cardSuggestions[0].name === newItem.cardName)) {
            setCardSuggestions([])
            setSkipSearch(false)
            return
        }

        setIsSearchingCards(true)
        const timer = setTimeout(() => {
            fetch(`${API_BASE_URL}/api/cards?q=${encodeURIComponent(newItem.cardName)}`)
                .then(res => res.json())
                .then(data => {
                    setCardSuggestions(Array.isArray(data) ? data.slice(0, 5) : [])
                })
                .catch(err => console.error(err))
                .finally(() => setIsSearchingCards(false))
        }, 300)

        return () => clearTimeout(timer)
    }, [newItem.cardName])

    const handleSelectCard = (card: any) => {
        setSkipSearch(true);
        setNewItem(prev => ({ ...prev, cardName: card.name }));
        setSelectedCardImage(card.image_url);
        setCardSuggestions([]);
    }

    const handleListSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!user) {
            alert('Please login to list items')
            return
        }
        setSubmitting(true)

        try {
            const res = await fetch(`${API_BASE_URL}/api/market`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    type: newItem.type,
                    card_name: newItem.cardName,
                    price: newItem.price,
                    condition: newItem.condition,
                    rarity: newItem.rarity,
                    location: newItem.location,
                    image_url: previewImage || selectedCardImage,
                    user_id: user.id
                })
            })

            if (!res.ok) throw new Error('Failed to save listing')

            setShowListModal(false)
            setNewItem({ type: 'sell', cardName: '', price: '', condition: 'Near Mint', rarity: 'Common', location: '' })
            setPreviewImage(null)
            setSelectedCardImage('')
            fetchListings()
        } catch (err) {
            console.error(err)
            alert('Error creating listing')
        } finally {
            setSubmitting(false)
        }
    }

    const handleDeleteItem = async (id: string) => {
        if (!user || !window.confirm('¿Estás seguro de que quieres borrar este item?')) return;

        try {
            const res = await fetch(`${API_BASE_URL}/api/market?id=${id}&user_id=${user.id}`, {
                method: 'DELETE'
            });

            if (!res.ok) {
                const errorData = await res.json();
                throw new Error(errorData.error || 'Failed to delete listing');
            }

            fetchListings();
        } catch (err: any) {
            console.error(err);
            alert(err.message || 'Error deleting listing');
        }
    };

    const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (file) {
            const url = URL.createObjectURL(file)
            setPreviewImage(url)
        }
    }

    const filteredItems = items.filter(item =>
        item.cardName.toLowerCase().includes(searchTerm.toLowerCase())
    )

    return (
        <div className="min-h-screen bg-[#0a0a0c] text-slate-300 pb-20">
            {/* Header with Glassmorphism */}
            <div className="sticky top-0 z-40 bg-[#0a0a0c]/80 backdrop-blur-xl border-b border-white/5 py-4">
                <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-center gap-6">
                        <div className="flex bg-slate-900/50 p-1 rounded-lg border border-white/5">
                            <button
                                onClick={() => setViewMode('sell')}
                                className={`px-6 py-2 rounded-md font-black uppercase text-xs tracking-widest transition-all ${viewMode === 'sell' ? 'bg-emerald-500 text-background-dark shadow-lg shadow-emerald-500/20' : 'text-slate-500 hover:text-white'}`}
                            >
                                Sell
                            </button>
                            <button
                                onClick={() => setViewMode('buy')}
                                className={`px-6 py-2 rounded-md font-black uppercase text-xs tracking-widest transition-all ${viewMode === 'buy' ? 'bg-sky-500 text-background-dark shadow-lg shadow-sky-500/20' : 'text-slate-500 hover:text-white'}`}
                            >
                                Buy
                            </button>
                        </div>
                    </div>

                    <div className="flex flex-1 md:max-w-xl items-center gap-4">
                        <div className="relative flex-1 group">
                            <span className="material-icons absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-emerald-500 transition-colors">search</span>
                            <input
                                type="text"
                                placeholder={`Search for cards to ${viewMode === 'sell' ? 'buy' : 'sell'}...`}
                                className="w-full bg-slate-900/50 border border-white/5 rounded-xl py-3 pl-12 pr-4 text-sm focus:border-emerald-500/50 outline-none transition-all placeholder:text-slate-600"
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                            />
                        </div>
                        {user && (
                            <button
                                onClick={() => setShowListModal(true)}
                                className="bg-emerald-500 hover:bg-emerald-400 text-background-dark font-black px-6 py-3 rounded-xl text-xs uppercase tracking-widest transition-all shadow-lg shadow-emerald-500/20 flex items-center gap-2 flex-shrink-0"
                            >
                                <span className="material-icons text-sm">add_circle</span>
                                List Item
                            </button>
                        )}
                    </div>
                </div>
            </div>

            <main className="max-w-7xl mx-auto px-6 pt-8">
                {loading ? (
                    <div className="flex flex-col items-center justify-center py-32 opacity-50">
                        <div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mb-6"></div>
                        <p className="font-black uppercase tracking-[0.3em] text-[10px]">Loading Marketplace...</p>
                    </div>
                ) : filteredItems.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-32 bg-slate-900/20 rounded-3xl border border-dashed border-white/5">
                        <span className="material-icons text-6xl text-slate-800 mb-4 font-light">storefront</span>
                        <p className="text-slate-500 font-bold text-center">No listings found in this category.</p>
                        {user && (
                            <button onClick={() => setShowListModal(true)} className="mt-4 text-emerald-500 font-black uppercase text-[10px] tracking-widest hover:underline">Be the first to list!</button>
                        )}
                    </div>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-4">
                        {filteredItems.map(item => (
                            <div key={item.id} className="bg-slate-900/40 rounded-xl overflow-hidden border border-white/5 group hover:border-emerald-500/30 transition-all flex flex-col">
                                <div className="aspect-[2/3] relative">
                                    <img src={item.imageUrl} alt={item.cardName} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                                    <div className="absolute top-1 right-1 bg-black/80 backdrop-blur-md px-1.5 py-0.5 rounded text-[8px] font-black uppercase text-white border border-white/10 italic">
                                        {item.condition}
                                    </div>
                                    {item.rarity && (
                                        <div className="absolute top-1 left-1 bg-emerald-500/90 backdrop-blur-md px-1.5 py-0.5 rounded text-[8px] font-black uppercase text-background-dark border border-emerald-400/50">
                                            {item.rarity}
                                        </div>
                                    )}
                                    {user && item.userId === user.id && (
                                        <button
                                            onClick={() => handleDeleteItem(item.id)}
                                            className="absolute top-1 right-1 z-10 bg-red-500/80 hover:bg-red-500 backdrop-blur-md p-1 rounded-full text-white shadow-lg transition-all"
                                            title="Delete Listing"
                                        >
                                            <span className="material-icons text-xs">delete</span>
                                        </button>
                                    )}
                                </div>
                                <div className="p-3 flex flex-col flex-1">
                                    <h3 className="font-bold text-white mb-1 truncate text-xs text-left group-hover:text-emerald-400 transition-colors">{item.cardName}</h3>
                                    <div className="flex items-center justify-between mb-3">
                                        <span className="text-emerald-400 font-black text-sm">${typeof item.price === 'number' ? item.price.toFixed(2) : parseFloat(item.price).toFixed(2)}</span>
                                        <span className="text-[8px] text-slate-600 font-bold uppercase">{item.postedAt}</span>
                                    </div>

                                    <div className="mt-auto pt-3 border-t border-white/5">
                                        <div className="flex items-center gap-2 mb-3">
                                            <div className="w-6 h-6 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-500 font-black text-[10px]">
                                                {item.sellerName?.[0] || 'M'}
                                            </div>
                                            <div className="flex-1 min-w-0 text-left">
                                                <p className="text-[10px] font-bold text-white truncate">{item.sellerName}</p>
                                                {item.sellerPhone && (
                                                    <p className="text-[10px] text-emerald-500 font-black tracking-tighter">{item.sellerPhone}</p>
                                                )}
                                                <p className="text-[8px] text-slate-500 truncate">{item.location}</p>
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-1 gap-2">
                                            {item.sellerPhone ? (
                                                <a
                                                    href={`https://wa.me/${item.sellerPhone.replace(/\D/g, '')}`}
                                                    target="_blank"
                                                    className="bg-emerald-600 hover:bg-emerald-500 text-white font-black py-2 rounded-lg text-[10px] uppercase tracking-widest transition-all text-center flex items-center justify-center gap-1 shadow-lg shadow-emerald-600/10"
                                                >
                                                    <span className="material-icons text-xs">chat</span>
                                                    WhatsApp
                                                </a>
                                            ) : (
                                                <button disabled className="bg-slate-800 text-slate-500 font-bold py-2 rounded-lg text-[10px] opacity-50 uppercase">No Phone</button>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </main>

            {/* List Item Modal */}
            {showListModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/95 backdrop-blur-xl transition-all">
                    <div className="bg-[#0f1115] border border-white/10 rounded-3xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl animate-in zoom-in-95 duration-300 custom-scrollbar">
                        <div className="sticky top-0 z-10 bg-[#0f1115]/80 backdrop-blur-md border-b border-white/10 p-6 flex items-center justify-between">
                            <h2 className="text-2xl font-black uppercase italic text-white tracking-widest flex items-center gap-3">
                                <span className="material-icons text-emerald-500">add_business</span>
                                List New Item
                            </h2>
                            <button onClick={() => setShowListModal(false)} className="text-slate-500 hover:text-white transition-colors p-2 hover:bg-white/5 rounded-full">
                                <span className="material-icons">close</span>
                            </button>
                        </div>

                        <form onSubmit={handleListSubmit} className="p-8 space-y-10">
                            {/* Segmented Control for Listing Type */}
                            <div className="space-y-4">
                                <label className="text-[10px] font-black uppercase text-slate-500 tracking-[0.2em]">Listing Category</label>
                                <div className="grid grid-cols-2 bg-slate-900/80 p-1.5 rounded-2xl border border-white/5 relative">
                                    <div
                                        className={`absolute inset-y-1.5 w-[calc(50%-6px)] rounded-xl transition-all duration-300 ease-out z-0 ${newItem.type === 'sell' ? 'translate-x-0 bg-emerald-500 shadow-lg shadow-emerald-500/20' : 'translate-x-full bg-sky-500 shadow-lg shadow-sky-500/20'}`}
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setNewItem(prev => ({ ...prev, type: 'sell' }))}
                                        className={`relative z-10 py-3 rounded-xl font-black text-xs uppercase tracking-widest transition-colors duration-200 ${newItem.type === 'sell' ? 'text-background-dark' : 'text-slate-500 hover:text-white'}`}
                                    >
                                        I'm Selling
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setNewItem(prev => ({ ...prev, type: 'buy' }))}
                                        className={`relative z-10 py-3 rounded-xl font-black text-xs uppercase tracking-widest transition-colors duration-200 ${newItem.type === 'buy' ? 'text-background-dark' : 'text-slate-500 hover:text-white'}`}
                                    >
                                        I'm Buying
                                    </button>
                                </div>
                            </div>

                            <div className="space-y-8">
                                {/* Section: Card Identity */}
                                <div className="space-y-5">
                                    <div className="flex items-center gap-3">
                                        <div className="h-px flex-1 bg-gradient-to-r from-transparent to-white/10" />
                                        <h3 className="text-[10px] font-black uppercase text-white/30 tracking-[0.3em] whitespace-nowrap">Card Identity</h3>
                                        <div className="h-px flex-1 bg-gradient-to-l from-transparent to-white/10" />
                                    </div>

                                    <div className="space-y-2 relative">
                                        <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest pl-1">Name of the Card</label>
                                        <div className="relative group">
                                            <input
                                                type="text"
                                                value={newItem.cardName}
                                                onChange={e => setNewItem(prev => ({ ...prev, cardName: e.target.value }))}
                                                required
                                                className="w-full bg-slate-900/50 border border-white/10 rounded-2xl p-4 text-white focus:border-emerald-500/50 focus:bg-slate-900 outline-none transition-all placeholder:text-slate-700 font-bold"
                                                placeholder="e.g. Blue-Eyes White Dragon"
                                            />
                                            {newItem.cardName && (
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setNewItem(prev => ({ ...prev, cardName: '' }));
                                                        setSelectedCardImage('');
                                                        setPreviewImage(null);
                                                    }}
                                                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-600 hover:text-white transition-colors"
                                                >
                                                    <span className="material-icons text-lg">cancel</span>
                                                </button>
                                            )}
                                        </div>

                                        {/* Enhanced Suggestions Dropdown */}
                                        {(cardSuggestions.length > 0 || isSearchingCards) && (
                                            <div className="absolute z-50 w-full bg-slate-900/90 backdrop-blur-xl border border-white/10 rounded-2xl mt-2 p-2 shadow-2xl max-h-64 overflow-y-auto custom-scrollbar animate-in fade-in slide-in-from-top-2 duration-200">
                                                {isSearchingCards && (
                                                    <div className="px-4 py-8 flex flex-col items-center gap-2 opacity-50">
                                                        <div className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
                                                        <span className="text-[8px] font-black uppercase tracking-widest text-emerald-500">Scanning Database...</span>
                                                    </div>
                                                )}
                                                {cardSuggestions.map(c => (
                                                    <div
                                                        key={c.id}
                                                        className="p-3 hover:bg-emerald-500/10 rounded-xl cursor-pointer flex items-center gap-4 transition-all group"
                                                        onClick={() => handleSelectCard(c)}
                                                    >
                                                        <div className="w-10 h-14 bg-black rounded overflow-hidden flex-shrink-0 shadow-lg group-hover:scale-105 transition-transform">
                                                            <img src={c.image_url_small} className="w-full h-full object-cover" alt="" />
                                                        </div>
                                                        <div className="flex-1 min-w-0">
                                                            <span className="text-sm text-white font-black block truncate mb-0.5">{c.name}</span>
                                                            <span className="text-[9px] text-slate-500 group-hover:text-emerald-400 uppercase font-black tracking-widest transition-colors">{c.type}</span>
                                                        </div>
                                                        <span className="material-icons text-slate-800 opacity-0 group-hover:opacity-100 group-hover:text-emerald-500 transition-all scale-75 group-hover:scale-100">add_circle</span>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Section: Offer Details */}
                                <div className="space-y-5">
                                    <div className="flex items-center gap-3">
                                        <div className="h-px flex-1 bg-gradient-to-r from-transparent to-white/10" />
                                        <h3 className="text-[10px] font-black uppercase text-white/30 tracking-[0.3em] whitespace-nowrap">Offer Details</h3>
                                        <div className="h-px flex-1 bg-gradient-to-l from-transparent to-white/10" />
                                    </div>

                                    <div className="grid grid-cols-2 gap-6">
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest pl-1">Price (USD)</label>
                                            <div className="relative group">
                                                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-emerald-500 font-bold">$</span>
                                                <input
                                                    type="number"
                                                    step="0.01"
                                                    value={newItem.price}
                                                    onChange={e => setNewItem(prev => ({ ...prev, price: e.target.value }))}
                                                    required
                                                    className="w-full bg-slate-900/50 border border-white/10 rounded-2xl p-4 pl-8 text-white focus:border-emerald-500/50 outline-none transition-all font-bold"
                                                    placeholder="0.00"
                                                />
                                            </div>
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest pl-1">Set Rarity</label>
                                            <select
                                                value={newItem.rarity}
                                                onChange={e => setNewItem(prev => ({ ...prev, rarity: e.target.value }))}
                                                className="w-full bg-slate-900/50 border border-white/10 rounded-2xl p-4 text-white focus:border-emerald-500/50 outline-none transition-all appearance-none cursor-pointer font-bold"
                                            >
                                                <option>Common</option>
                                                <option>Rare</option>
                                                <option>Super Rare</option>
                                                <option>Ultra Rare</option>
                                                <option>Secret Rare</option>
                                                <option>Ultimate Rare</option>
                                                <option>Ghost Rare</option>
                                                <option>Collector's Rare</option>
                                                <option>Starlight Rare</option>
                                                <option>Quarter Century Secret Rare</option>
                                            </select>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-6">
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest pl-1">Condition</label>
                                            <select
                                                value={newItem.condition}
                                                onChange={e => setNewItem(prev => ({ ...prev, condition: e.target.value }))}
                                                className="w-full bg-slate-900/50 border border-white/10 rounded-2xl p-4 text-white focus:border-emerald-500/50 outline-none transition-all appearance-none cursor-pointer font-bold"
                                            >
                                                <option>Near Mint</option>
                                                <option>Lightly Played</option>
                                                <option>Moderately Played</option>
                                                <option>Heavily Played</option>
                                                <option>Damaged</option>
                                            </select>
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest pl-1">Shipping Location</label>
                                            <div className="relative">
                                                <span className="material-icons absolute left-4 top-1/2 -translate-y-1/2 text-slate-600 text-sm">location_on</span>
                                                <input
                                                    type="text"
                                                    value={newItem.location}
                                                    onChange={e => setNewItem(prev => ({ ...prev, location: e.target.value }))}
                                                    required
                                                    className="w-full bg-slate-900/50 border border-white/10 rounded-2xl p-4 pl-10 text-white focus:border-emerald-500/50 outline-none transition-all font-bold"
                                                    placeholder="City, Country"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Section: Visuals & Preview */}
                                <div className="space-y-5">
                                    <div className="flex items-center gap-3">
                                        <div className="h-px flex-1 bg-gradient-to-r from-transparent to-white/10" />
                                        <h3 className="text-[10px] font-black uppercase text-white/30 tracking-[0.3em] whitespace-nowrap">Visuals & Preview</h3>
                                        <div className="h-px flex-1 bg-gradient-to-l from-transparent to-white/10" />
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest pl-1">Actual Photo (Recommended)</label>
                                            <div className="bg-slate-900/50 border-2 border-dashed border-white/5 rounded-3xl h-[280px] flex items-center justify-center overflow-hidden relative group hover:border-emerald-500/30 transition-all">
                                                {(previewImage) ? (
                                                    <>
                                                        <img src={previewImage} alt="Manual Photo" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                                                        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                                            <button
                                                                type="button"
                                                                onClick={() => setPreviewImage(null)}
                                                                className="bg-red-600 hover:bg-red-500 text-white font-black px-4 py-2 rounded-xl text-[10px] uppercase tracking-widest transition-all"
                                                            >
                                                                Remove Photo
                                                            </button>
                                                        </div>
                                                    </>
                                                ) : (
                                                    <div className="text-center p-6 flex flex-col items-center gap-4">
                                                        <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center text-slate-600 group-hover:text-emerald-500 group-hover:bg-emerald-500/10 transition-all">
                                                            <span className="material-icons text-3xl">add_a_photo</span>
                                                        </div>
                                                        <div className="space-y-1">
                                                            <p className="text-slate-400 text-xs font-bold">Upload an actual photo</p>
                                                            <p className="text-[9px] text-slate-600 font-bold uppercase tracking-widest">Better results & trust</p>
                                                        </div>
                                                        <label className="cursor-pointer bg-white/5 hover:bg-white text-slate-400 hover:text-background-dark font-black px-6 py-3 rounded-2xl text-[10px] uppercase tracking-widest transition-all shadow-xl active:scale-95 border border-white/5 hover:border-white">
                                                            Manual Upload
                                                            <input type="file" className="hidden" accept="image/*" onChange={handleImageChange} />
                                                        </label>
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest pl-1">Marketplace Live Preview</label>
                                            <div className="bg-slate-900/30 rounded-3xl border border-white/5 p-4 h-[280px] flex items-center justify-center relative overflow-hidden group">
                                                {/* Grid lines or abstract bg for preview area */}
                                                <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)', backgroundSize: '24px 24px' }} />

                                                {newItem.cardName ? (
                                                    <div className="bg-slate-950 rounded-2xl border border-white/10 w-44 shadow-2xl scale-90 md:scale-100 animate-in fade-in zoom-in-95 duration-500">
                                                        <div className="aspect-[3/4] p-1.5 relative">
                                                            <img
                                                                src={previewImage || selectedCardImage || 'https://images.ygoprodeck.com/images/cards/back_high.jpg'}
                                                                className="w-full h-full object-cover rounded-lg"
                                                                alt=""
                                                            />
                                                            <div className="absolute top-3 right-3 bg-black/80 backdrop-blur-md px-1.5 py-0.5 rounded text-[7px] font-black uppercase text-white border border-white/10 italic">
                                                                {newItem.condition}
                                                            </div>
                                                            <div className="absolute top-3 left-3 bg-emerald-500/90 backdrop-blur-md px-1.5 py-0.5 rounded text-[7px] font-black uppercase text-background-dark border border-emerald-400/50">
                                                                {newItem.rarity}
                                                            </div>
                                                        </div>
                                                        <div className="px-3 pb-3 pt-1">
                                                            <p className="text-[10px] font-black text-white truncate text-left">{newItem.cardName}</p>
                                                            <div className="flex items-center justify-between">
                                                                <p className="text-emerald-400 font-black text-xs">${newItem.price || '0.00'}</p>
                                                                <span className="text-[6px] text-slate-500 font-bold uppercase tracking-tighter">Just Now</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <div className="text-center space-y-2 opacity-20">
                                                        <span className="material-icons text-5xl">visibility_off</span>
                                                        <p className="text-[10px] font-black uppercase tracking-widest">Awaiting card data</p>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <button
                                type="submit"
                                disabled={submitting}
                                className="w-full bg-emerald-500 hover:bg-emerald-400 text-background-dark font-black py-5 rounded-3xl text-xs uppercase tracking-[0.3em] transition-all shadow-2xl shadow-emerald-500/20 active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-3 group"
                            >
                                {submitting ? (
                                    <>
                                        <div className="w-4 h-4 border-2 border-background-dark border-t-transparent rounded-full animate-spin" />
                                        Publishing...
                                    </>
                                ) : (
                                    <>
                                        <span className="material-icons text-sm group-hover:translate-x-1 transition-transform">send</span>
                                        Finalize & Publicly List
                                    </>
                                )}
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    )
}
