import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function Home() {
    const { user } = useAuth()

    return (
        <div className="flex flex-col w-full">
            {/* Hero Section */}
            <section className="relative min-h-[90vh] flex items-center justify-center overflow-hidden px-6 py-24">
                {/* Animated Background Elements */}
                <div className="absolute inset-0 -z-10">
                    <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/20 blur-[120px] rounded-full animate-pulse"></div>
                    <div className="absolute bottom-1/4 right-1/4 w-[500px] h-[500px] bg-accent-blue/10 blur-[150px] rounded-full animate-pulse" style={{ animationDelay: '1s' }}></div>
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full bg-[radial-gradient(circle_at_center,rgba(212,175,55,0.05)_0%,transparent_70%)]"></div>
                </div>

                <div className="max-w-[1200px] mx-auto text-center relative z-10">
                    <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10 mb-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
                        <span className="flex h-2 w-2 rounded-full bg-primary animate-ping"></span>
                        <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Next Gen Duelist Analytics</span>
                    </div>

                    <h1 className="text-6xl md:text-8xl font-black text-white uppercase italic tracking-tighter mb-8 leading-[0.9] animate-in fade-in slide-in-from-bottom-8 duration-1000">
                        Master the <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary via-[#f3d06b] to-primary">Meta</span>,<br />
                        Rule the <span className="italic">Duel</span>
                    </h1>

                    <p className="text-lg md:text-xl text-slate-400 max-w-2xl mx-auto mb-12 font-medium leading-relaxed animate-in fade-in slide-in-from-bottom-12 duration-1000">
                        The most advanced probability engine and deck analyzer for the modern duelist. 
                        Optimize your ratios, simulate opening hands, and track the evolving meta.
                    </p>

                    <div className="flex flex-wrap justify-center gap-6 animate-in fade-in slide-in-from-bottom-16 duration-1000">
                        {user ? (
                            <Link 
                                to="/decks" 
                                className="px-10 py-5 bg-primary text-background-dark font-black uppercase tracking-widest text-sm rounded-xl hover:scale-105 transition-all shadow-2xl shadow-primary/20 flex items-center gap-3"
                            >
                                <span className="material-icons">dashboard</span>
                                Enter Dashboard
                            </Link>
                        ) : (
                            <Link 
                                to="/login" 
                                className="px-10 py-5 bg-primary text-background-dark font-black uppercase tracking-widest text-sm rounded-xl hover:scale-105 transition-all shadow-2xl shadow-primary/20 flex items-center gap-3"
                            >
                                <span className="material-icons">login</span>
                                Get Started Free
                            </Link>
                        )}
                        <Link 
                            to="/meta-report" 
                            className="px-10 py-5 bg-white/5 text-white border border-white/10 font-black uppercase tracking-widest text-sm rounded-xl hover:bg-white/10 transition-all flex items-center gap-3 backdrop-blur-sm"
                        >
                            <span className="material-icons">insights</span>
                            View Meta Report
                        </Link>
                    </div>
                </div>

                {/* Floating Card Decorations */}
                <div className="absolute left-10 top-1/2 -translate-y-1/2 hidden xl:block opacity-20 hover:opacity-40 transition-opacity rotate-[-12deg] scale-110">
                    <img src="https://images.ygoprodeck.com/images/cards/46986414.jpg" alt="Decoration" className="w-48 rounded-lg shadow-2xl" />
                </div>
                <div className="absolute right-10 top-1/2 -translate-y-1/2 hidden xl:block opacity-20 hover:opacity-40 transition-opacity rotate-[12deg] scale-110">
                    <img src="https://images.ygoprodeck.com/images/cards/89631139.jpg" alt="Decoration" className="w-48 rounded-lg shadow-2xl" />
                </div>
            </section>

            {/* Features Grid */}
            <section className="py-24 px-6 bg-black/40">
                <div className="max-w-[1400px] mx-auto">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                        <div className="group p-8 rounded-3xl bg-white/5 border border-white/10 hover:border-primary/50 transition-all hover:-translate-y-2">
                            <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                                <span className="material-icons text-primary text-3xl">auto_fix_high</span>
                            </div>
                            <h3 className="text-xl font-bold text-white mb-4 uppercase italic">Probability Engine</h3>
                            <p className="text-slate-400 leading-relaxed">
                                Advanced hypergeometric distribution analysis to calculate exact draw odds for starters, extenders, and board breakers.
                            </p>
                        </div>

                        <div className="group p-8 rounded-3xl bg-white/5 border border-white/10 hover:border-accent-blue/50 transition-all hover:-translate-y-2">
                            <div className="w-14 h-14 rounded-2xl bg-accent-blue/10 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                                <span className="material-icons text-accent-blue text-3xl">insights</span>
                            </div>
                            <h3 className="text-xl font-bold text-white mb-4 uppercase italic">Meta Analytics</h3>
                            <p className="text-slate-400 leading-relaxed">
                                Real-time tracking of tournament results, archetype representation, and win rates across the competitive landscape.
                            </p>
                        </div>

                        <div className="group p-8 rounded-3xl bg-white/5 border border-white/10 hover:border-accent-purple/50 transition-all hover:-translate-y-2">
                            <div className="w-14 h-14 rounded-2xl bg-accent-purple/10 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                                <span className="material-icons text-accent-purple text-3xl">style</span>
                            </div>
                            <h3 className="text-xl font-bold text-white mb-4 uppercase italic">Deck Management</h3>
                            <p className="text-slate-400 leading-relaxed">
                                Clean, intuitive deck builder with live preview, quantity controls, and instant export to major simulators.
                            </p>
                        </div>
                    </div>
                </div>
            </section>

            {/* Social Proof / Stats */}
            <section className="py-24 px-6 relative overflow-hidden">
                <div className="max-w-[1000px] mx-auto text-center">
                    <h2 className="text-3xl md:text-5xl font-black text-white uppercase italic mb-16 tracking-tight">
                        Built for the <span className="text-primary">Competitive</span> Edge
                    </h2>
                    
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
                        <div className="p-6">
                            <p className="text-4xl font-black text-white mb-2">12k+</p>
                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Decks Analyzed</p>
                        </div>
                        <div className="p-6">
                            <p className="text-4xl font-black text-primary mb-2">99%</p>
                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Engine Accuracy</p>
                        </div>
                        <div className="p-6">
                            <p className="text-4xl font-black text-white mb-2">500+</p>
                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Daily Duelists</p>
                        </div>
                        <div className="p-6">
                            <p className="text-4xl font-black text-accent-blue mb-2">24/7</p>
                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Meta Updates</p>
                        </div>
                    </div>
                </div>
            </section>

            {/* CTA Section */}
            <section className="py-24 px-6">
                <div className="max-w-[1200px] mx-auto">
                    <div className="relative rounded-[40px] bg-gradient-to-br from-primary/20 to-accent-blue/10 border border-white/10 p-12 md:p-20 overflow-hidden text-center">
                        <div className="absolute top-0 left-0 w-full h-full bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-10"></div>
                        
                        <div className="relative z-10">
                            <h2 className="text-4xl md:text-6xl font-black text-white uppercase italic mb-8 tracking-tighter">
                                Ready to Elevate<br />Your Game?
                            </h2>
                            <p className="text-slate-400 text-lg max-w-xl mx-auto mb-12">
                                Join thousands of duelists using data to win more games. 
                                Free to use, forever.
                            </p>
                            <Link 
                                to={user ? "/decks" : "/login"} 
                                className="inline-flex px-12 py-6 bg-primary text-background-dark font-black uppercase tracking-[0.2em] text-sm rounded-2xl hover:scale-105 transition-all shadow-2xl shadow-primary/40"
                            >
                                {user ? "Go to Dashboard" : "Create Your Account"}
                            </Link>
                        </div>
                    </div>
                </div>
            </section>
        </div>
    )
}
