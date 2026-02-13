import { useState, useEffect } from 'react'
import { API_BASE_URL } from '../config'

interface YGOCard {
    id: number;
    name: string;
    type: string;
    desc: string;
    atk?: number;
    def?: number;
    level?: number;
    race: string;
    attribute?: string;
    image_url: string;
    image_url_small: string;
}

function ComboTracker() {
    const [searchQuery, setSearchQuery] = useState('')
    const [searchResults, setSearchResults] = useState<YGOCard[]>([])
    const [isSearching, setIsSearching] = useState(false)

    // Efecto de búsqueda con debounce manual simple
    useEffect(() => {
        const timer = setTimeout(() => {
            if (searchQuery.length > 2) {
                handleSearch(searchQuery)
            } else if (searchQuery.length === 0) {
                setSearchResults([])
            }
        }, 500)

        return () => clearTimeout(timer)
    }, [searchQuery])

    const handleSearch = async (query: string) => {
        setIsSearching(true)
        try {
            const response = await fetch(`${API_BASE_URL}/api/search-cards?q=${encodeURIComponent(query)}`)
            const data = await response.json()
            setSearchResults(data)
        } catch (error) {
            console.error('Error searching cards:', error)
        } finally {
            setIsSearching(false)
        }
    }

    return (
        <div className="flex flex-col flex-1 h-[calc(100vh-64px)] overflow-hidden">
            {/* Secondary Header / Simulation Bar */}
            <header className="bg-background-dark/80 backdrop-blur-xl border-b border-primary/30 flex-shrink-0">
                <div className="max-w-full mx-auto px-6 py-3 flex flex-col md:flex-row justify-between items-center gap-4">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-deck-purple border border-primary/50 flex items-center justify-center shadow-lg">
                            <span className="material-symbols-outlined text-primary">calculate</span>
                        </div>
                        <div>
                            <h1 className="text-xl font-bold tracking-wider text-white uppercase italic">Combo Probability Tracker</h1>
                            <div className="flex items-center gap-3 mt-0.5">
                                <span className="bg-primary text-black px-2 py-0.5 text-[10px] font-black uppercase tracking-tighter">Simulation Mode</span>
                                <div className="flex gap-3 text-[11px] font-medium text-slate-400">
                                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-primary"></span>Deck Size: 40</span>
                                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-accent-blue"></span>Hand: 5</span>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <button className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 px-4 py-2 rounded transition-all text-xs font-bold uppercase tracking-widest">
                            <span className="material-icons text-sm">save</span> Save Presets
                        </button>
                        <button className="flex items-center gap-2 bg-primary text-black hover:brightness-110 px-5 py-2 rounded transition-all text-xs font-black uppercase tracking-widest shadow-[0_0_15px_rgba(177,145,73,0.3)]">
                            <span className="material-icons text-sm">play_arrow</span> Run Simulation
                        </button>
                    </div>
                </div>
            </header>

            {/* Main Layout Area */}
            <main className="flex-1 flex overflow-hidden">
                {/* Left Sidebar - Database */}
                <aside className="w-80 border-r border-primary/20 bg-background-dark flex flex-col flex-shrink-0">
                    <div className="p-4 border-b border-primary/10">
                        <div className="relative">
                            {isSearching ? (
                                <div className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
                            ) : (
                                <span className="material-icons absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm">search</span>
                            )}
                            <input
                                className="w-full bg-slate-900/50 border-slate-800 focus:border-primary/50 focus:ring-0 text-xs py-2 pl-9 rounded placeholder:text-slate-600 font-medium text-slate-200"
                                placeholder="Search Card Database..."
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                        </div>
                        <div className="flex gap-2 mt-3">
                            <button className="flex-1 py-1 text-[9px] font-black uppercase tracking-tighter border border-primary/30 text-primary bg-primary/5">Results ({searchResults.length})</button>
                        </div>
                    </div>
                    <div className="flex-1 overflow-y-auto custom-scrollbar">
                        <div className="p-2 space-y-1">
                            {searchResults.length === 0 && !isSearching && searchQuery.length > 0 && (
                                <div className="text-center py-10">
                                    <p className="text-[10px] font-bold text-slate-600 uppercase italic">No cards found</p>
                                </div>
                            )}
                            {searchResults.map((card, idx) => (
                                <div key={card.id || idx} className="sidebar-item group flex items-center gap-3 p-2 rounded cursor-pointer transition-all border border-transparent hover:border-primary/20">
                                    <div className="w-10 h-14 bg-slate-800 flex-shrink-0 border border-slate-700 overflow-hidden relative">
                                        <img alt={card.name} className="w-full h-full object-cover" src={card.image_url_small} />
                                    </div>
                                    <div className="flex-1 overflow-hidden">
                                        <p className="text-[11px] font-black text-slate-200 uppercase truncate">{card.name}</p>
                                        <p className="text-[9px] text-slate-500 font-bold italic">{card.type} • {card.attribute || card.race}</p>
                                    </div>
                                    <span className="material-icons text-primary opacity-0 group-hover:opacity-100 text-sm">add_circle</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </aside>

                {/* Center Section - Combo Builder */}
                <section className="flex-1 overflow-y-auto custom-scrollbar p-8 bg-black/20">
                    <div className="flex justify-between items-end mb-8">
                        <div>
                            <h2 className="text-2xl font-black italic uppercase tracking-wider text-white">Build a Combo</h2>
                            <p className="text-[11px] text-slate-500 font-bold uppercase tracking-widest mt-1">Define card groups and logic for probability calculation.</p>
                        </div>
                        <button className="bg-deck-purple border border-primary/30 text-primary px-4 py-2 rounded text-[10px] font-black uppercase tracking-[0.2em] hover:bg-deck-purple/80 transition-all">
                            + New Combo Group
                        </button>
                    </div>

                    <div className="space-y-6">
                        {/* Group 01 */}
                        <div className="ygo-card-border p-6 rounded relative">
                            <div className="flex justify-between items-center mb-6">
                                <div className="flex items-center gap-3">
                                    <span className="w-8 h-8 rounded bg-primary text-black flex items-center justify-center font-black text-xs">01</span>
                                    <h3 className="font-black text-sm uppercase tracking-widest text-white">Primary Starter Group</h3>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="text-[10px] font-bold text-slate-500 uppercase">Logic:</span>
                                    <select className="bg-slate-900 border-slate-800 text-[10px] font-black uppercase py-1 px-3 text-primary focus:ring-0">
                                        <option>Draw at least 1</option>
                                        <option>Draw exactly 1</option>
                                        <option>Draw none</option>
                                    </select>
                                    <button className="p-1 hover:text-red-500 transition-colors"><span className="material-icons text-sm">delete</span></button>
                                </div>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {[
                                    { name: 'Branded Fusion', copies: 3, img: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAPe7Uow3vLzGiVODn-7zAfJSfUfVjGH1dDJxRtmPleKr-EwEoIY-eUYBVuPZCf4beJJfxz2nV567bmGYscEyVziIHpzflA98G_jer0NZyUMPlmcVOF_7hMLzRm4RkD8qs9UHYZ1_mYhDYQeCG9Q-I-z8riEN4sps_yaa7gB8N-n-asim_QeRWzt7aFsJpS3jivzE66Mbw6xEH0_sbdha0-4qfqKHCEm4gauTK3tinTirwAskoCp7xjdD2Bq7Z-WE38EdJkL7qSkB4' },
                                    { name: 'Aluber the Jester', copies: 3, img: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBSg8pgP5pLbhPFrAMoBSb_IURnrl3XA_hF7dM-1ktFvVydd-za67sA9-_vDRa_G4xitWssNU_nN4TIQs4p282wXHUOLvl8dVaTo5mUZcYU6QEBz57yKByF2LMlNrVpVRRbfiGgXLyGQRJM2VwJMWP4iZ35PN_O82xywSO-3_ovzVnEKCPv1VT9iPaPuZeynwfz0rZA0y4XDpW2I8AErtsU8ErjRaBUTufvShlxnyYxBlSiElw-hsqSOX3h7oVkg7M4Dz6SNza5Udk' }
                                ].map((card, idx) => (
                                    <div key={idx} className="flex items-center gap-3 bg-black/40 border border-slate-800 p-3 rounded group text-slate-200">
                                        <div className="w-12 h-16 bg-slate-900 flex-shrink-0 border border-primary/20 overflow-hidden">
                                            <img alt={card.name} className="w-full h-full object-cover" src={card.img} />
                                        </div>
                                        <div className="flex-1">
                                            <p className="text-[10px] font-black uppercase text-slate-200">{card.name}</p>
                                            <div className="flex items-center gap-2 mt-1">
                                                <span className="text-[9px] text-slate-500 font-bold uppercase">Copies:</span>
                                                <input className="w-12 bg-slate-900 border-slate-800 text-[10px] p-0.5 text-center text-primary font-bold" type="number" defaultValue={card.copies} />
                                            </div>
                                        </div>
                                        <button className="opacity-0 group-hover:opacity-100 text-slate-600 hover:text-red-500 transition-all">
                                            <span className="material-icons text-xs">close</span>
                                        </button>
                                    </div>
                                ))}
                                <div className="border border-dashed border-slate-800 flex items-center justify-center rounded p-3 hover:border-primary/40 cursor-pointer transition-all">
                                    <span className="text-[10px] font-black uppercase text-slate-600">+ Drag Card Here</span>
                                </div>
                            </div>
                        </div>

                        {/* Group 02 */}
                        <div className="ygo-card-border p-6 rounded relative">
                            <div className="flex justify-between items-center mb-6">
                                <div className="flex items-center gap-3">
                                    <span className="w-8 h-8 rounded bg-accent-blue text-white flex items-center justify-center font-black text-xs">02</span>
                                    <h3 className="font-black text-sm uppercase tracking-widest text-white">Specific Interaction</h3>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="text-[10px] font-bold text-slate-500 uppercase">Logic:</span>
                                    <select className="bg-slate-900 border-slate-800 text-[10px] font-black uppercase py-1 px-3 text-accent-blue focus:ring-0">
                                        <option>Draw exactly 1</option>
                                        <option>Draw at least 1</option>
                                    </select>
                                    <button className="p-1 hover:text-red-500 transition-colors"><span className="material-icons text-sm">delete</span></button>
                                </div>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                <div className="flex items-center gap-3 bg-black/40 border border-slate-800 p-3 rounded group text-slate-200">
                                    <div className="w-12 h-16 bg-slate-900 flex-shrink-0 border border-accent-blue/20 overflow-hidden">
                                        <img alt="Infinite Impermanence" className="w-full h-full object-cover" src="https://lh3.googleusercontent.com/aida-public/AB6AXuAvKlg9AJ23oBUehoF7F9ISDdyKAXsZg8SNO3BGNNbV8ZbC_VEVhWcN4ucczi8XJ_mE_2-yAFJm5T595k37Wtvjwc9ywUYyts0z_MbVeaAyI_UsxBz4neDy3pMbTC7nJcOx8_pffeApVWWfllb9m4R-KwtL1aMfRsheMymhYliNNKIJFylXRRby13uG6b9druV8DSLL5ukUO1eLE9EzKRMGZiXfsQdPvhEQnCiR1omuMQf1IWIb7GbaK073gGuByl02O6zeSUV9g4w" />
                                    </div>
                                    <div className="flex-1">
                                        <p className="text-[10px] font-black uppercase text-slate-200">Infinite Impermanence</p>
                                        <div className="flex items-center gap-2 mt-1">
                                            <span className="text-[9px] text-slate-500 font-bold uppercase">Copies:</span>
                                            <input className="w-12 bg-slate-900 border-slate-800 text-[10px] p-0.5 text-center text-accent-blue font-bold" type="number" defaultValue={3} />
                                        </div>
                                    </div>
                                    <button className="opacity-0 group-hover:opacity-100 text-slate-600 hover:text-red-500 transition-all">
                                        <span className="material-icons text-xs">close</span>
                                    </button>
                                </div>
                                <div className="border border-dashed border-slate-800 flex items-center justify-center rounded p-3 hover:border-accent-blue/40 cursor-pointer transition-all">
                                    <span className="text-[10px] font-black uppercase text-slate-600">+ Drag Card Here</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                {/* Right Sidebar - Results */}
                <aside className="w-96 border-l border-primary/20 bg-background-dark/50 flex flex-col p-6 overflow-y-auto custom-scrollbar flex-shrink-0">
                    <h3 className="font-black text-xs uppercase tracking-[0.2em] text-primary mb-6">Simulation Results</h3>
                    <div className="bg-deck-purple/40 border border-primary/30 p-6 rounded mb-8 text-center relative overflow-hidden">
                        <div className="absolute inset-0 bg-primary/5 -skew-x-12 translate-x-1/2 pointer-events-none"></div>
                        <p className="text-[10px] font-black uppercase text-primary tracking-widest mb-2 relative">Probability of Draw</p>
                        <h4 className="text-6xl font-black italic text-white relative">42.5<span className="text-2xl text-primary">%</span></h4>
                        <div className="mt-4 flex justify-center gap-2 relative">
                            <span className="bg-green-500/10 text-green-500 text-[9px] font-black px-2 py-1 rounded uppercase">High Consistency</span>
                        </div>
                    </div>

                    <div className="space-y-6">
                        <div>
                            <h5 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-4 flex items-center gap-2">
                                <span className="material-icons text-xs">settings</span> Simulation Settings
                            </h5>
                            <div className="space-y-4">
                                <div className="flex justify-between items-center p-3 bg-black/40 border border-slate-800 rounded">
                                    <span className="text-[11px] font-bold text-slate-400 uppercase">Opening Hand Size</span>
                                    <div className="flex bg-slate-900 p-1 rounded">
                                        <button className="px-3 py-1 text-[10px] font-black bg-primary text-black rounded">5</button>
                                        <button className="px-3 py-1 text-[10px] font-black text-slate-500">6</button>
                                    </div>
                                </div>
                                <div className="space-y-3">
                                    <p className="text-[9px] font-black uppercase text-slate-600 tracking-tighter">"What if?" Effect Simulation</p>
                                    {[
                                        { name: 'Pot of Prosperity', img: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDgTJFtne6kfSYWS0CdtQ78WgRavEs_iBo_hfKorHYq2Y_88nAZxb_zE5BZNg6G0EVd-GH_qonDhDNRbpd3Vlu9QL-kScOdKKaZNVr8oO1iX6SEYiCHVUXDT2eHW0q9I10D6U-BS_mban2sSqbd13FesVAHD3tEG2ZzFu8wapFVxaHOPVpgxeU7iMF24aDU6NePxTdTZ_d6fnJvrasifCcP7Hm43AsJzSVFrlYIsjjOk0zbDDZeJGYNprF55YdJZLIFqmNxCCn_E4U' },
                                        { name: 'Pot of Desires', img: '', label: 'DES' }
                                    ].map((pot, idx) => (
                                        <label key={idx} className="flex items-center justify-between p-3 bg-black/40 border border-slate-800 rounded cursor-pointer group">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-10 bg-slate-900 overflow-hidden border border-slate-700">
                                                    {pot.img ? <img alt={pot.name} className="w-full h-full object-cover" src={pot.img} /> : <div className="w-full h-full flex items-center justify-center bg-slate-800"><span className="text-[8px] font-bold">{pot.label}</span></div>}
                                                </div>
                                                <span className="text-[10px] font-black uppercase group-hover:text-primary transition-colors">{pot.name}</span>
                                            </div>
                                            <input className="rounded border-slate-800 bg-slate-900 text-primary focus:ring-0 focus:ring-offset-0" type="checkbox" />
                                        </label>
                                    ))}
                                </div>
                            </div>
                        </div>

                        <div className="pt-6 border-t border-slate-800">
                            <h5 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-4">Combo Step Breakdown</h5>
                            <div className="space-y-2">
                                <div className="flex justify-between items-center text-[11px] font-bold uppercase py-2">
                                    <span className="text-slate-500 italic">01. Draw Starter</span>
                                    <span className="text-primary">86.4%</span>
                                </div>
                                <div className="w-full bg-slate-900 h-1 rounded-full overflow-hidden">
                                    <div className="bg-primary h-full" style={{ width: '86.4%' }}></div>
                                </div>
                                <div className="flex justify-between items-center text-[11px] font-bold uppercase py-2 mt-4">
                                    <span className="text-slate-500 italic">02. Starter + Interaction</span>
                                    <span className="text-accent-blue">42.5%</span>
                                </div>
                                <div className="w-full bg-slate-900 h-1 rounded-full overflow-hidden">
                                    <div className="bg-accent-blue h-full" style={{ width: '42.5%' }}></div>
                                </div>
                            </div>
                        </div>
                        <button className="w-full py-4 mt-4 border border-primary/40 bg-primary/10 text-[11px] font-black text-primary hover:bg-primary/20 transition-all uppercase tracking-[0.3em] italic">
                            Export Analysis Report
                        </button>
                    </div>
                </aside>
            </main>
        </div>
    )
}

export default ComboTracker
