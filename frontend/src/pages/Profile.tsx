import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { API_BASE_URL } from '../config'

export default function Profile() {
    const { user } = useAuth()
    const [loading, setLoading] = useState(false)
    const [username, setUsername] = useState(user?.user_metadata?.username || '')
    const [fullName, setFullName] = useState(user?.user_metadata?.full_name || '')
    const [phoneNumber, setPhoneNumber] = useState(user?.user_metadata?.phone_number || '')
    const [rank, setRank] = useState(user?.user_metadata?.rank || 'Legendary Duelist')
    const [avatarUrl, setAvatarUrl] = useState(user?.user_metadata?.avatar_url || '')
    const [stats, setStats] = useState({ decks: 0, combos: 0 })
    const [message, setMessage] = useState('')

    // Card Search Modal State
    const [showSearch, setShowSearch] = useState(false)
    const [searchQuery, setSearchQuery] = useState('')
    const [searchResults, setSearchResults] = useState<any[]>([])
    const [isSearching, setIsSearching] = useState(false)

    useEffect(() => {
        if (user) {
            fetchStats()
        }
    }, [user])

    // Fetch search results when query changes
    useEffect(() => {
        if (searchQuery.length < 2) {
            setSearchResults([])
            return
        }
        const timer = setTimeout(() => {
            setIsSearching(true)
            fetch(`${API_BASE_URL}/api/search-cards?q=${searchQuery}`)
                .then(res => res.json())
                .then(data => setSearchResults(data.slice(0, 20)))
                .catch(err => console.error('Search error:', err))
                .finally(() => setIsSearching(false))
        }, 500)
        return () => clearTimeout(timer)
    }, [searchQuery])

    const fetchStats = async () => {
        try {
            const deckRes = await fetch(`${API_BASE_URL}/api/list-decks?user_id=${user?.id}`)
            const deckData = await deckRes.json()
            setStats({
                decks: Array.isArray(deckData) ? deckData.length : 0,
                combos: 0
            })
        } catch (err) {
            console.error('Error fetching profile stats:', err)
        }
    }

    const handleUpdateProfile = async (e?: React.FormEvent) => {
        if (e) e.preventDefault()
        setLoading(true)
        setMessage('')

        try {
            // 1. Update Supabase Auth User Metadata
            const { error: authError } = await supabase.auth.updateUser({
                data: {
                    username,
                    full_name: fullName,
                    phone_number: phoneNumber,
                    rank,
                    avatar_url: avatarUrl
                }
            })
            if (authError) throw authError

            // 2. Upsert into public.profiles table
            const { error: profileError } = await supabase
                .from('profiles')
                .upsert({
                    id: user?.id,
                    username,
                    full_name: fullName,
                    phone_number: phoneNumber,
                    avatar_url: avatarUrl,
                    updated_at: new Date().toISOString()
                })

            if (profileError) throw profileError

            setMessage('Profile updated successfully!')
            setTimeout(() => setMessage(''), 3000)
        } catch (error: any) {
            console.error('Update profile error:', error)
            alert(error.message)
        } finally {
            setLoading(false)
        }
    }

    const selectCardAsAvatar = async (card: any) => {
        const croppedUrl = `https://images.ygoprodeck.com/images/cards_cropped/${card.id}.jpg`
        setAvatarUrl(croppedUrl)
        setShowSearch(false)
        setSearchQuery('')
        setSearchResults([])

        try {
            await supabase.auth.updateUser({
                data: {
                    username,
                    full_name: fullName,
                    phone_number: phoneNumber,
                    rank,
                    avatar_url: croppedUrl
                }
            })

            await supabase.from('profiles').upsert({
                id: user?.id,
                avatar_url: croppedUrl,
                updated_at: new Date().toISOString()
            })

            setMessage('Avatar updated!')
            setTimeout(() => setMessage(''), 3000)
        } catch (e) {
            console.error(e)
        }
    }

    const displayAvatar = avatarUrl || `https://ui-avatars.com/api/?name=${username || user?.email}&background=D4AF37&color=121212&size=200&font-size=0.4&bold=true`

    return (
        <main className="max-w-4xl mx-auto px-6 py-12">
            <div className="relative mb-8">
                <div className="ygo-card-border p-8 rounded-2xl bg-card-dark/50 overflow-hidden relative border border-border-dark">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 blur-[80px] -z-10 rounded-full translate-x-1/2 -translate-y-1/2"></div>

                    <div className="flex flex-col md:flex-row items-center gap-8">
                        <div className="relative group cursor-pointer" onClick={() => setShowSearch(true)}>
                            <div className="w-32 h-32 rounded-full border-4 border-primary p-1 bg-background-dark shadow-2xl shadow-primary/20 overflow-hidden">
                                <img
                                    src={displayAvatar}
                                    alt="Avatar"
                                    className="w-full h-full rounded-full object-cover"
                                />
                            </div>
                            <div className="absolute -bottom-2 -right-2 bg-primary text-background-dark p-2 rounded-full shadow-lg border-2 border-background-dark group-hover:scale-110 transition-transform">
                                <span className="material-icons text-sm">search</span>
                            </div>
                            <div className="absolute inset-0 bg-black/40 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                <span className="text-[10px] font-black uppercase text-white tracking-widest text-center px-2">Change Avatar</span>
                            </div>
                        </div>

                        <div className="flex-1 text-center md:text-left">
                            <h1 className="text-4xl font-black text-white uppercase italic tracking-tight mb-2">
                                {fullName || username || 'Unknown Duelist'}
                            </h1>
                            <p className="text-primary font-bold uppercase tracking-[0.3em] text-[10px] mb-4">Rank: {rank}</p>

                            <div className="flex flex-wrap justify-center md:justify-start gap-4">
                                <div className="px-4 py-2 bg-slate-800/50 rounded-lg border border-slate-700">
                                    <p className="text-[10px] font-black uppercase text-slate-500 tracking-widest mb-1">Email</p>
                                    <p className="text-sm font-medium text-white">{user?.email}</p>
                                </div>
                                <div className="px-4 py-2 bg-slate-800/50 rounded-lg border border-slate-700">
                                    <p className="text-[10px] font-black uppercase text-slate-500 tracking-widest mb-1">Member Since</p>
                                    <p className="text-sm font-medium text-white">{new Date(user?.created_at || '').toLocaleDateString()}</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6 px-2">
                    <div className="bg-card-dark p-4 rounded-xl border border-border-dark shadow-xl hover:border-primary/30 transition-all text-center group">
                        <p className="text-2xl font-black text-primary mb-1 group-hover:scale-110 transition-transform">{stats.decks}</p>
                        <p className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Total Decks</p>
                    </div>
                    <div className="bg-card-dark p-4 rounded-xl border border-border-dark shadow-xl hover:border-accent-blue/30 transition-all text-center group">
                        <p className="text-2xl font-black text-accent-blue mb-1 group-hover:scale-110 transition-transform">{stats.combos}</p>
                        <p className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Saved Combos</p>
                    </div>
                    <div className="bg-card-dark p-4 rounded-xl border border-border-dark shadow-xl hover:border-accent-purple/30 transition-all text-center group">
                        <p className="text-2xl font-black text-accent-purple mb-1 group-hover:scale-110 transition-transform">0</p>
                        <p className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Games Analyzed</p>
                    </div>
                    <div className="bg-card-dark p-4 rounded-xl border border-border-dark shadow-xl hover:border-green-500/30 transition-all text-center group">
                        <p className="text-2xl font-black text-green-500 mb-1 group-hover:scale-110 transition-transform">100%</p>
                        <p className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Win Rate Goal</p>
                    </div>
                </div>
            </div>

            <div className="bg-card-dark border border-border-dark rounded-2xl overflow-hidden mt-8">
                <div className="p-8 border-b border-border-dark">
                    <h3 className="text-xl font-bold text-white uppercase italic flex items-center gap-2">
                        <span className="material-icons text-primary">settings</span>
                        Account Settings
                    </h3>
                </div>

                <form onSubmit={handleUpdateProfile} className="p-8 space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                            <label className="text-xs font-black uppercase text-slate-500 tracking-widest">Username</label>
                            <input
                                type="text"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                className="w-full bg-slate-800/50 border border-slate-700 rounded-lg px-4 py-3 text-white focus:ring-2 focus:ring-primary outline-none transition-all"
                                placeholder="AncientDuelist"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-xs font-black uppercase text-slate-500 tracking-widest">Full Name</label>
                            <input
                                type="text"
                                value={fullName}
                                onChange={(e) => setFullName(e.target.value)}
                                className="w-full bg-slate-800/50 border border-slate-700 rounded-lg px-4 py-3 text-white focus:ring-2 focus:ring-primary outline-none transition-all"
                                placeholder="Seto Kaiba"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-xs font-black uppercase text-slate-500 tracking-widest">Phone / WhatsApp</label>
                            <input
                                type="text"
                                value={phoneNumber}
                                onChange={(e) => setPhoneNumber(e.target.value)}
                                className="w-full bg-slate-800/50 border border-slate-700 rounded-lg px-4 py-3 text-white focus:ring-2 focus:ring-primary outline-none transition-all"
                                placeholder="+1 234 567 890"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-xs font-black uppercase text-slate-500 tracking-widest">Rank</label>
                            <input
                                type="text"
                                value={rank}
                                onChange={(e) => setRank(e.target.value)}
                                className="w-full bg-slate-800/50 border border-slate-700 rounded-lg px-4 py-3 text-white focus:ring-2 focus:ring-primary outline-none transition-all"
                                placeholder="Legendary Duelist"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-xs font-black uppercase text-slate-500 tracking-widest opacity-50">Email (Cannot be changed)</label>
                            <input
                                type="text"
                                value={user?.email || ''}
                                disabled
                                className="w-full bg-slate-900 border border-slate-800 rounded-lg px-4 py-3 text-slate-500 cursor-not-allowed"
                            />
                        </div>
                    </div>

                    <div className="flex items-center justify-between pt-6">
                        {message && (
                            <p className="text-green-500 text-sm font-bold animate-in fade-in slide-in-from-left-2">{message}</p>
                        )}
                        <button
                            type="submit"
                            disabled={loading}
                            className="ml-auto px-8 py-3 bg-primary text-background-dark font-black uppercase tracking-widest text-xs rounded-lg hover:shadow-2xl hover:shadow-primary/20 transition-all transform active:scale-95 disabled:opacity-50"
                        >
                            {loading ? 'Saving...' : 'Save Changes'}
                        </button>
                    </div>
                </form>
            </div>

            {showSearch && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/95 backdrop-blur-xl p-6" onClick={() => setShowSearch(false)}>
                    <div className="bg-card-dark border border-border-dark rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl animate-in zoom-in-95" onClick={e => e.stopPropagation()}>
                        <div className="p-6 border-b border-border-dark flex justify-between items-center bg-white/5">
                            <h3 className="text-lg font-black uppercase text-white italic tracking-widest">Select Card Avatar</h3>
                            <button onClick={() => setShowSearch(false)} className="text-slate-500 hover:text-white transition-colors">
                                <span className="material-icons">close</span>
                            </button>
                        </div>
                        <div className="p-6">
                            <div className="relative mb-6">
                                <span className="material-icons absolute left-4 top-1/2 -translate-y-1/2 text-slate-500">search</span>
                                <input
                                    autoFocus
                                    type="text"
                                    className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-12 pr-4 py-4 text-white focus:ring-2 focus:ring-primary outline-none transition-all placeholder:text-slate-600"
                                    placeholder="Search for a card name... (e.g. Dark Magician)"
                                    value={searchQuery}
                                    onChange={e => setSearchQuery(e.target.value)}
                                />
                            </div>

                            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3 max-h-[50vh] overflow-y-auto custom-scrollbar pr-2">
                                {isSearching ? (
                                    <div className="col-span-full py-20 text-center">
                                        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                                        <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Searching Database...</p>
                                    </div>
                                ) : searchResults.length > 0 ? (
                                    searchResults.map(card => (
                                        <div
                                            key={card.id}
                                            onClick={() => selectCardAsAvatar(card)}
                                            className="relative aspect-[2.5/3.6] group rounded overflow-hidden border border-white/10 hover:border-primary transition-all cursor-pointer hover:scale-105"
                                        >
                                            <img src={card.image_url_small} alt={card.name} className="w-full h-full object-cover" />
                                            <div className="absolute inset-0 bg-primary/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                                <span className="material-icons text-primary shadow-lg">check_circle</span>
                                            </div>
                                        </div>
                                    ))
                                ) : searchQuery.length >= 2 ? (
                                    <div className="col-span-full py-20 text-center text-slate-500 uppercase text-xs font-black tracking-widest">
                                        No cards found for "{searchQuery}"
                                    </div>
                                ) : (
                                    <div className="col-span-full py-20 text-center text-slate-500 uppercase text-xs font-black tracking-widest">
                                        Type at least 2 characters to search
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </main>
    )
}
