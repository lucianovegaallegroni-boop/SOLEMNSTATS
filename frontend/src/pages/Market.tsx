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
    images?: string[];
    description?: string;
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
    const [newItem, setNewItem] = useState<{
        type: 'sell' | 'buy';
        cardName: string;
        price: string | number;
        description: string;
        condition: string;
        rarity: string;
        location: string;
        images?: string[];
    }>({
        type: 'sell',
        cardName: '',
        price: '',
        description: '',
        condition: 'Near Mint',
        rarity: 'Common',
        location: ''
    })
    const [cardSuggestions, setCardSuggestions] = useState<any[]>([])
    const [selectedCardImage, setSelectedCardImage] = useState('')
    const [previewImages, setPreviewImages] = useState<string[]>([])

    // Card Search for Buy Mode
    const [skipSearch, setSkipSearch] = useState(false)
    const [buySearchTerm, setBuySearchTerm] = useState('')



    useEffect(() => {
        fetchListings()
    }, [viewMode])

    const fetchListings = async () => {
        setLoading(true)
        try {
            const res = await fetch(`${API_BASE_URL}/api/market?type=${viewMode}`)
            const data = await res.json()
            if (Array.isArray(data)) {
                setItems(data)
            } else {
                console.error("Market API returned non-array:", data)
                setItems([])
            }
        } catch (err) {
            console.error('Error fetching listings:', err)
            setItems([])
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        // Only run search for Buy mode
        if (newItem.type !== 'buy') return;

        const query = buySearchTerm;

        if (query.length < 3 || skipSearch || (cardSuggestions[0] && cardSuggestions[0].name === query)) {
            if (query.length < 3) setCardSuggestions([])
            setSkipSearch(false)
            return
        }

        const timer = setTimeout(() => {
            fetch(`${API_BASE_URL}/api/cards?q=${encodeURIComponent(query)}`)
                .then(res => res.json())
                .then(data => {
                    setCardSuggestions(Array.isArray(data) ? data.slice(0, 5) : [])
                })
                .catch(err => console.error(err))
        }, 300)

        return () => clearTimeout(timer)
    }, [buySearchTerm, newItem.type])

    const handleListSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!user) {
            alert('Please login to list items')
            return
        }
        // Assuming 'step' is a variable that would be defined elsewhere,
        // or this condition is meant to be simplified.
        // For now, faithfully applying the provided snippet.
        // Note: 'step' is not defined in the provided document, which might cause a runtime error.
        if (newItem.type === 'buy') {
            // Handle batch upload for Buy list
            const buyItems = newItem.description.split('\n').filter(line => line.trim());
            if (buyItems.length === 0) {
                alert('Please add cards to your buy list');
                return;
            }

            setSubmitting(true);
            try {
                const promises = buyItems.map((itemLine, index) => {
                    const img = previewImages[index] || '';
                    // Extract potential rarity from the line if present, e.g. "Name (Rarity)"
                    // But for simplicity, we send the whole line as card_name
                    // and "Buying Request" as description for individual item

                    return fetch(`${API_BASE_URL}/api/market`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            type: 'buy',
                            card_name: itemLine,
                            price: '0',
                            description: 'Buying Request', // Short description for individual listing
                            condition: newItem.condition,
                            rarity: 'Common', // Default
                            location: newItem.location,
                            image_url: img,
                            images: img ? [img] : [],
                            user_id: user.id
                        })
                    });
                });

                await Promise.all(promises);

                setShowListModal(false)
                setNewItem({ type: 'sell', cardName: '', price: '', description: '', condition: 'Near Mint', rarity: 'Common', location: '' })
                setPreviewImages([])
                setSelectedCardImage('')
                fetchListings()
            } catch (err) {
                console.error(err)
                alert('Error creating listings')
            } finally {
                setSubmitting(false)
            }
        } else {
            // Handle single Sell listing
            if (!newItem.cardName) {
                alert('Please enter a card name')
                return
            }
            if (!newItem.price) {
                alert('Please enter a price')
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
                        description: newItem.description,
                        condition: newItem.condition,
                        rarity: newItem.rarity,
                        location: newItem.location,
                        image_url: previewImages[0] || selectedCardImage,
                        images: previewImages.length > 0 ? previewImages : (selectedCardImage ? [selectedCardImage] : []),
                        user_id: user.id
                    })
                })

                if (!res.ok) throw new Error('Failed to save listing')

                setShowListModal(false)
                setNewItem({ type: 'sell', cardName: '', price: '', description: '', condition: 'Near Mint', rarity: 'Common', location: '' })
                setPreviewImages([])
                setSelectedCardImage('')
                fetchListings()
            } catch (err) {
                console.error(err)
                alert('Error creating listing')
            } finally {
                setSubmitting(false)
            }
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
        if (e.target.files) {
            const newImages = Array.from(e.target.files).map(file => URL.createObjectURL(file))
            setPreviewImages(prev => [...prev, ...newImages])
        }
    }

    const handleRemoveImage = (index: number) => {
        setPreviewImages(prev => prev.filter((_, i) => i !== index))
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
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                        {filteredItems.map(item => (
                            <div
                                key={item.id}
                                className="bg-slate-900/40 rounded-xl overflow-hidden border border-white/5 group hover:border-emerald-500/30 transition-all flex flex-col cursor-default"
                            >
                                <div className="aspect-[2/3] relative group/image">
                                    <div className="w-full h-full relative">
                                        {/* Carousel Logic */}
                                        <img
                                            src={(item.images && item.images.length > 0) ? item.images[0] : item.imageUrl}
                                            alt={item.cardName}
                                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                                        />
                                    </div>
                                    <div className="absolute top-1 right-1 bg-black/80 backdrop-blur-md px-1.5 py-0.5 rounded text-[8px] font-black uppercase text-white border border-white/10 italic z-10">
                                        {item.condition}
                                    </div>
                                    {item.rarity && (
                                        <div className="absolute top-1 left-1 bg-emerald-500/90 backdrop-blur-md px-1.5 py-0.5 rounded text-[8px] font-black uppercase text-background-dark border border-emerald-400/50 z-10">
                                            {item.rarity}
                                        </div>
                                    )}
                                    {user && item.userId === user.id && (
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleDeleteItem(item.id);
                                            }}
                                            className="absolute top-1 right-1 z-30 bg-red-500/80 hover:bg-red-500 backdrop-blur-md p-1 rounded-full text-white shadow-lg transition-all opacity-0 group-hover:opacity-100 translate-y-2 group-hover:translate-y-8"
                                            title="Delete Listing"
                                        >
                                            <span className="material-icons text-xs">delete</span>
                                        </button>
                                    )}
                                </div>
                                <div className="p-3 flex flex-col flex-1">
                                    <h3 className="font-bold text-white mb-1 truncate text-xs text-left group-hover:text-emerald-400 transition-colors">{item.cardName}</h3>
                                    {item.description && (
                                        <p className="text-[9px] text-slate-400 mb-2 line-clamp-2 leading-tight font-mono bg-black/20 p-1 rounded">
                                            {item.description}
                                        </p>
                                    )}
                                    <div className="flex items-center justify-between mb-3">
                                        {item.type !== 'buy' && (
                                            <span className="text-emerald-400 font-black text-sm">${typeof item.price === 'number' ? item.price.toFixed(2) : parseFloat(item.price).toFixed(2)}</span>
                                        )}
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
                                                    onClick={(e) => e.stopPropagation()}
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
                )
                }
            </main >

            {/* List Item Modal */}
            {
                showListModal && (
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
                                    {newItem.type === 'buy' ? (
                                        <div className="space-y-4">
                                            <div className="flex justify-between items-end">
                                                <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest pl-1">List of Cards to Buy</label>
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setNewItem(prev => ({ ...prev, description: '', cardName: '' }));
                                                        setPreviewImages([]);
                                                        setBuySearchTerm('');
                                                    }}
                                                    className="text-[9px] text-red-400 hover:text-red-300 uppercase font-black transition-colors"
                                                >
                                                    Clear List
                                                </button>
                                            </div>

                                            {/* Search Input for Buy Mode */}
                                            <div className="space-y-2">
                                                <div className="flex gap-2">
                                                    <div className="relative group z-30 flex-1">
                                                        <input
                                                            type="text"
                                                            placeholder="Search card to add..."
                                                            className="w-full bg-slate-900/50 border border-white/10 rounded-2xl p-4 pl-10 text-white focus:border-emerald-500/50 outline-none transition-all font-bold placeholder:text-slate-700"
                                                            value={buySearchTerm}
                                                            onChange={(e) => {
                                                                setBuySearchTerm(e.target.value);
                                                                setSkipSearch(false);
                                                            }}
                                                        />
                                                        <span className="material-icons absolute left-4 top-1/2 -translate-y-1/2 text-slate-600">search</span>

                                                        {/* Suggestions Logic */}
                                                        {(cardSuggestions.length > 0 && newItem.type === 'buy' && buySearchTerm) && (
                                                            <div className="absolute top-full left-0 right-0 bg-slate-900/95 backdrop-blur-xl border border-white/10 rounded-2xl mt-2 p-2 shadow-2xl max-h-64 overflow-y-auto custom-scrollbar z-50">
                                                                {cardSuggestions.map(c => (
                                                                    <div
                                                                        key={c.id}
                                                                        className="p-3 hover:bg-emerald-500/10 rounded-xl cursor-pointer flex items-center gap-4 transition-all group"
                                                                        onClick={() => {
                                                                            // Add to list logic
                                                                            const currentDesc = newItem.description ? newItem.description + '\n' : '';
                                                                            // Get selected rarity or default to generic if not set (using temp state or ref would be better, but let's use a simpler approach: Rarity dropdown next to search)
                                                                            const raritySuffix = (document.getElementById('buy-rarity-select') as HTMLSelectElement)?.value || '';
                                                                            const newEntry = `1x ${c.name}${raritySuffix ? ` (${raritySuffix})` : ''}`;

                                                                            setNewItem(prev => ({
                                                                                ...prev,
                                                                                description: currentDesc + newEntry,
                                                                                // Set title to first card if empty
                                                                                cardName: prev.cardName || c.name,
                                                                            }));

                                                                            // Add image or empty string to keep alignment
                                                                            setPreviewImages(prev => [...prev, c.image_url || '']);
                                                                            setCardSuggestions([]); // Clear suggestions
                                                                            setBuySearchTerm(''); // Clear input
                                                                            setSkipSearch(true);

                                                                            // Reset rarity select
                                                                            const raritySelect = document.getElementById('buy-rarity-select') as HTMLSelectElement;
                                                                            if (raritySelect) raritySelect.value = '';
                                                                        }}
                                                                    >
                                                                        <div className="w-8 h-12 bg-black rounded overflow-hidden flex-shrink-0">
                                                                            <img src={c.image_url_small} className="w-full h-full object-cover" alt="" />
                                                                        </div>
                                                                        <div className="flex-1 min-w-0">
                                                                            <span className="text-sm text-white font-black block truncate">{c.name}</span>
                                                                        </div>
                                                                        <span className="material-icons text-emerald-500">add</span>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </div>

                                                    {/* Optional Rarity Selector for Buy Mode */}
                                                    <select
                                                        id="buy-rarity-select"
                                                        className="bg-slate-900/50 border border-white/10 rounded-2xl px-4 text-white text-xs font-bold outline-none focus:border-emerald-500/50 w-32 appearance-none cursor-pointer"
                                                        defaultValue=""
                                                    >
                                                        <option value="">Any Rarity</option>
                                                        <option value="Common">Common</option>
                                                        <option value="Rare">Rare</option>
                                                        <option value="Super Rare">Super Rare</option>
                                                        <option value="Ultra Rare">Ultra Rare</option>
                                                        <option value="Secret Rare">Secret Rare</option>
                                                        <option value="Ultimate Rare">Ultimate Rare</option>
                                                        <option value="Ghost Rare">Ghost Rare</option>
                                                        <option value="Starlight">Starlight</option>
                                                    </select>
                                                </div>
                                            </div>

                                            {/* Visual List of Added Cards */}
                                            <div className="bg-slate-900/50 border border-white/10 rounded-2xl p-4 min-h-[120px] max-h-[300px] overflow-y-auto custom-scrollbar space-y-2">
                                                {newItem.description ? (
                                                    newItem.description.split('\n').filter(line => line.trim()).map((line, idx) => (
                                                        <div key={idx} className="flex items-center gap-3 bg-black/40 p-2 rounded-xl border border-white/5 group">
                                                            {/* Try to match line to an image if possible */}
                                                            {previewImages[idx] && previewImages[idx] !== '' && (
                                                                <img src={previewImages[idx]} className="w-8 h-12 object-cover rounded bg-black" alt="" />
                                                            )}
                                                            <input
                                                                className="flex-1 bg-transparent border-none text-white text-sm font-mono outline-none"
                                                                value={line}
                                                                onChange={(e) => {
                                                                    const lines = newItem.description!.split('\n');
                                                                    lines[idx] = e.target.value;
                                                                    setNewItem(prev => ({ ...prev, description: lines.join('\n') }));
                                                                }}
                                                            />
                                                            <button
                                                                type="button"
                                                                onClick={() => {
                                                                    const lines = newItem.description!.split('\n');
                                                                    lines.splice(idx, 1);
                                                                    setNewItem(prev => ({ ...prev, description: lines.join('\n') }));
                                                                    setPreviewImages(prev => prev.filter((_, i) => i !== idx));
                                                                }}
                                                                className="text-slate-600 hover:text-red-500 p-1 opacity-0 group-hover:opacity-100 transition-all"
                                                            >
                                                                <span className="material-icons text-sm">close</span>
                                                            </button>
                                                        </div>
                                                    ))
                                                ) : (
                                                    <div className="h-full flex flex-col items-center justify-center opacity-30 gap-2">
                                                        <span className="material-icons text-3xl">playlist_add</span>
                                                        <p className="text-[10px] uppercase font-bold text-center">Search cards above to build your list</p>
                                                    </div>
                                                )}
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
                                    ) : (
                                        /* SELL MODE FORM */
                                        <>
                                            {/* Section: Details (Simplified) */}
                                            <div className="space-y-5">
                                                <div className="flex items-center gap-3">
                                                    <div className="h-px flex-1 bg-gradient-to-r from-transparent to-white/10" />
                                                    <h3 className="text-[10px] font-black uppercase text-white/30 tracking-[0.3em] whitespace-nowrap">Details</h3>
                                                    <div className="h-px flex-1 bg-gradient-to-l from-transparent to-white/10" />
                                                </div>

                                                <div className="space-y-2">
                                                    <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest pl-1">Description</label>
                                                    <p className="text-[9px] text-slate-400 pl-1 pb-1">Describe what you are selling. This will effectively act as your listing title.</p>
                                                    <textarea
                                                        value={newItem.description}
                                                        onChange={e => {
                                                            const val = e.target.value;
                                                            setNewItem(prev => ({
                                                                ...prev,
                                                                description: val,
                                                                // Auto-generate cardName (title) from first 50 chars of description
                                                                cardName: val.length > 0 ? (val.substring(0, 50) + (val.length > 50 ? '...' : '')) : ''
                                                            }))
                                                        }}
                                                        required
                                                        rows={4}
                                                        className="w-full bg-slate-900/50 border border-white/10 rounded-2xl p-4 text-white focus:border-emerald-500/50 outline-none transition-all"
                                                        placeholder="Example: Selling my collection of Blue-Eyes cards. All in near mint condition..."
                                                    />
                                                </div>

                                                {/* Rarity & Condition (Optional for bundles) */}

                                            </div>

                                            {/* Section: Price & Visuals */}
                                            <div className="space-y-5">
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

                                                <div className="space-y-4">
                                                    <div className="flex items-center justify-between">
                                                        <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest pl-1">Photos {newItem.type === 'sell' && '(Max 1)'}</label>
                                                        {(!newItem.images?.length && (!previewImages.length || newItem.type !== 'sell')) && (
                                                            <label className="cursor-pointer text-emerald-500 hover:text-emerald-400 text-[10px] font-black uppercase tracking-widest flex items-center gap-1 transition-colors">
                                                                <span className="material-icons text-sm">add_photo_alternate</span>
                                                                Add Photo
                                                                <input
                                                                    type="file"
                                                                    className="hidden"
                                                                    accept="image/*"
                                                                    multiple={newItem.type !== 'sell'}
                                                                    onChange={(e) => {
                                                                        if (newItem.type === 'sell') {
                                                                            // Enforce single image for sell mode
                                                                            if (e.target.files && e.target.files[0]) {
                                                                                const file = e.target.files[0];
                                                                                setPreviewImages([URL.createObjectURL(file)]);
                                                                            }
                                                                        } else {
                                                                            handleImageChange(e);
                                                                        }
                                                                    }}
                                                                />
                                                            </label>
                                                        )}
                                                    </div>

                                                    <div className="grid grid-cols-4 gap-2">
                                                        {previewImages.map((img, idx) => (
                                                            <div key={idx} className="aspect-square rounded-xl overflow-hidden relative group border border-white/10">
                                                                <img src={img} className="w-full h-full object-cover" alt={`Preview ${idx}`} />
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleRemoveImage(idx)}
                                                                    className="absolute top-1 right-1 bg-red-500/90 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                                                                >
                                                                    <span className="material-icons text-xs block">close</span>
                                                                </button>
                                                                {idx === 0 && <span className="absolute bottom-0 left-0 right-0 bg-black/60 text-[8px] text-white text-center py-0.5 uppercase font-bold backdrop-blur-sm">Cover</span>}
                                                            </div>
                                                        ))}
                                                        {previewImages.length === 0 && !selectedCardImage && (
                                                            <div className="col-span-4 h-32 border-2 border-dashed border-white/5 rounded-2xl flex flex-col items-center justify-center text-slate-500 gap-2">
                                                                <span className="material-icons text-2xl opacity-50">imagesmode</span>
                                                                <span className="text-[10px] uppercase font-bold opacity-50">No images selected</span>
                                                            </div>
                                                        )}
                                                        {selectedCardImage && previewImages.length === 0 && (
                                                            <div className="aspect-square rounded-xl overflow-hidden relative border border-emerald-500/30">
                                                                <img src={selectedCardImage} className="w-full h-full object-cover opacity-80" alt="Database Card" />
                                                                <span className="absolute bottom-0 left-0 right-0 bg-emerald-500/90 text-[8px] text-background-dark text-center py-0.5 uppercase font-bold backdrop-blur-sm">Database</span>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        </>
                                    )}
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
                )
            }


            {/* Gallery View Modal */}

        </div >
    )
}

