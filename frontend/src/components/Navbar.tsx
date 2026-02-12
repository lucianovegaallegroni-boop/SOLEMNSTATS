import { Link, useLocation } from 'react-router-dom'

function Navbar() {
    const location = useLocation()

    return (
        <nav className="border-b border-slate-200 dark:border-border-dark bg-white/50 dark:bg-background-dark/50 backdrop-blur-md sticky top-0 z-50">
            <div className="max-w-[1600px] mx-auto px-6">
                <div className="flex justify-between h-16 items-center">
                    <div className="flex items-center gap-4">
                        <Link to="/" className="flex items-center gap-3">
                            <div className="w-10 h-10 flex items-center justify-center overflow-hidden">
                                <img src="/logo.png" alt="Solemn Logo" className="w-full h-full object-contain" />
                            </div>
                            <span className="text-2xl font-black tracking-tighter uppercase italic text-white leading-none">
                                SOLEMN<span className="text-primary italic">STATS</span>
                            </span>
                        </Link>
                    </div>

                    <div className="hidden md:flex items-center space-x-8 text-sm font-medium">
                        <Link
                            className={`${location.pathname === '/' ? 'text-primary border-b-2 border-primary' : 'text-slate-500 hover:text-primary transition-colors'} py-5`}
                            to="/"
                        >
                            Import
                        </Link>
                        <Link
                            className={`${location.pathname === '/decks' ? 'text-primary border-b-2 border-primary' : 'text-slate-500 hover:text-primary transition-colors'} py-5`}
                            to="/decks"
                        >
                            My Decks
                        </Link>
                        <Link
                            className={`${location.pathname === '/combo' ? 'text-primary border-b-2 border-primary' : 'text-slate-500 hover:text-primary transition-colors'} py-5`}
                            to="/combo"
                        >
                            Combo Tracker
                        </Link>
                        <a className="text-slate-500 hover:text-primary transition-colors py-5" href="#">Meta Data</a>
                        <a className="text-slate-500 hover:text-primary transition-colors py-5" href="#">Card DB</a>
                    </div>

                    <div className="flex items-center gap-4">
                        <button className="p-2 rounded-full hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors">
                            <span className="material-icons text-xl text-slate-400">notifications</span>
                        </button>
                        <div className="w-10 h-10 rounded-full border-2 border-primary/30 p-0.5">
                            <img alt="User profile" className="w-full h-full rounded-full object-cover" src="https://lh3.googleusercontent.com/aida-public/AB6AXuA7EQSUFfLxwsyI2ujxKFnFxeSaFKDO88NpKD9ikuVePympeW_8Zi0CEqqZ_XFbqzQDK3kxUOAGka_Iet8_vuIw-sjpYpTCENzqPQT_O7N4p0EAp5Zr0mvR496a7IOW8Pgu9-RdHXnEAOHTXLFv1hOAxrDAinsQEfWKAgaBIYjq7D1NlJy0jtBP-Rne03nli4-4B60-BXrE72Obu0Z47j-PCc9otyoopQYMjXQGtyxGB2Yhois7_UvF_efJ5w9uFRMSGrNPQahywHc" />
                        </div>
                    </div>
                </div>
            </div>
        </nav>
    )
}

export default Navbar
