import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'

function Navbar() {
    const location = useLocation()
    const [sidebarOpen, setSidebarOpen] = useState(false)

    const navLinks = [
        { to: '/', label: 'Import', icon: 'upload_file' },
        { to: '/decks', label: 'My Decks', icon: 'style' },
        { to: '/combo', label: 'Combo Tracker', icon: 'account_tree' },
        { to: '#', label: 'Meta Data', icon: 'insights' },
        { to: '#', label: 'Card DB', icon: 'search' },
    ]

    const desktopLinkClass = (path: string) =>
        `${location.pathname === path ? 'text-primary border-b-2 border-primary' : 'text-slate-500 hover:text-primary transition-colors'} py-5`

    return (
        <>
            <nav className="border-b border-slate-200 dark:border-border-dark bg-white/50 dark:bg-background-dark/50 backdrop-blur-md sticky top-0 z-50">
                <div className="max-w-[1600px] mx-auto px-3 sm:px-6">
                    <div className="flex justify-between h-14 sm:h-16 items-center">
                        <div className="flex items-center gap-3 sm:gap-4">
                            {/* Hamburger — mobile only */}
                            <button
                                className="md:hidden p-1.5 rounded-lg hover:bg-white/10 transition-colors -ml-1"
                                onClick={() => setSidebarOpen(true)}
                                aria-label="Open menu"
                            >
                                <span className="material-icons text-2xl text-slate-300">menu</span>
                            </button>

                            <Link to="/" className="flex items-center gap-2 sm:gap-3">
                                <div className="w-8 h-8 sm:w-10 sm:h-10 flex items-center justify-center overflow-hidden">
                                    <img src="/logo.png" alt="Solemn Logo" className="w-full h-full object-contain" />
                                </div>
                                <span className="text-lg sm:text-2xl font-black tracking-tighter uppercase italic text-white leading-none">
                                    SOLEMN<span className="text-primary italic">STATS</span>
                                </span>
                            </Link>
                        </div>

                        {/* Desktop Nav */}
                        <div className="hidden md:flex items-center space-x-8 text-sm font-medium">
                            {navLinks.map(link => (
                                link.to.startsWith('/') ? (
                                    <Link key={link.label} className={desktopLinkClass(link.to)} to={link.to}>{link.label}</Link>
                                ) : (
                                    <a key={link.label} className="text-slate-500 hover:text-primary transition-colors py-5" href={link.to}>{link.label}</a>
                                )
                            ))}
                        </div>

                        <div className="flex items-center gap-2 sm:gap-4">
                            <button className="hidden sm:block p-2 rounded-full hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors">
                                <span className="material-icons text-xl text-slate-400">notifications</span>
                            </button>
                            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full border-2 border-primary/30 p-0.5">
                                <img alt="User profile" className="w-full h-full rounded-full object-cover" src="https://lh3.googleusercontent.com/aida-public/AB6AXuA7EQSUFfLxwsyI2ujxKFnFxeSaFKDO88NpKD9ikuVePympeW_8Zi0CEqqZ_XFbqzQDK3kxUOAGka_Iet8_vuIw-sjpYpTCENzqPQT_O7N4p0EAp5Zr0mvR496a7IOW8Pgu9-RdHXnEAOHTXLFv1hOAxrDAinsQEfWKAgaBIYjq7D1NlJy0jtBP-Rne03nli4-4B60-BXrE72Obu0Z47j-PCc9otyoopQYMjXQGtyxGB2Yhois7_UvF_efJ5w9uFRMSGrNPQahywHc" />
                            </div>
                        </div>
                    </div>
                </div>
            </nav>

            {/* Sidebar Overlay */}
            {sidebarOpen && (
                <div
                    className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] md:hidden"
                    onClick={() => setSidebarOpen(false)}
                />
            )}

            {/* Left Sidebar Drawer */}
            <div className={`fixed top-0 left-0 h-full w-72 bg-background-dark border-r border-border-dark z-[110] md:hidden transform transition-transform duration-300 ease-in-out ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
                {/* Sidebar Header */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-border-dark">
                    <Link to="/" className="flex items-center gap-2" onClick={() => setSidebarOpen(false)}>
                        <div className="w-8 h-8 flex items-center justify-center overflow-hidden">
                            <img src="/logo.png" alt="Solemn Logo" className="w-full h-full object-contain" />
                        </div>
                        <span className="text-lg font-black tracking-tighter uppercase italic text-white leading-none">
                            SOLEMN<span className="text-primary italic">STATS</span>
                        </span>
                    </Link>
                    <button
                        onClick={() => setSidebarOpen(false)}
                        className="p-1.5 rounded-lg hover:bg-white/10 transition-colors"
                        aria-label="Close menu"
                    >
                        <span className="material-icons text-xl text-slate-400">close</span>
                    </button>
                </div>

                {/* Sidebar Links */}
                <div className="py-4 flex flex-col gap-1 px-3">
                    {navLinks.map(link => {
                        const isActive = location.pathname === link.to
                        const inner = (
                            <div className={`flex items-center gap-3 px-3 py-3 rounded-lg text-sm font-bold uppercase tracking-wider transition-all ${isActive
                                ? 'text-primary bg-primary/10 border border-primary/20'
                                : 'text-slate-400 hover:text-white hover:bg-white/5 border border-transparent'
                                }`}>
                                <span className={`material-icons text-lg ${isActive ? 'text-primary' : 'text-slate-500'}`}>{link.icon}</span>
                                {link.label}
                            </div>
                        )

                        return link.to.startsWith('/') ? (
                            <Link key={link.label} to={link.to} onClick={() => setSidebarOpen(false)}>
                                {inner}
                            </Link>
                        ) : (
                            <a key={link.label} href={link.to} onClick={() => setSidebarOpen(false)}>
                                {inner}
                            </a>
                        )
                    })}
                </div>

                {/* Sidebar Footer */}
                <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-border-dark">
                    <div className="flex items-center gap-3 px-2">
                        <div className="w-9 h-9 rounded-full border-2 border-primary/30 p-0.5 flex-shrink-0">
                            <img alt="User profile" className="w-full h-full rounded-full object-cover" src="https://lh3.googleusercontent.com/aida-public/AB6AXuA7EQSUFfLxwsyI2ujxKFnFxeSaFKDO88NpKD9ikuVePympeW_8Zi0CEqqZ_XFbqzQDK3kxUOAGka_Iet8_vuIw-sjpYpTCENzqPQT_O7N4p0EAp5Zr0mvR496a7IOW8Pgu9-RdHXnEAOHTXLFv1hOAxrDAinsQEfWKAgaBIYjq7D1NlJy0jtBP-Rne03nli4-4B60-BXrE72Obu0Z47j-PCc9otyoopQYMjXQGtyxGB2Yhois7_UvF_efJ5w9uFRMSGrNPQahywHc" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-xs font-bold text-white truncate">Duelist</p>
                            <p className="text-[10px] text-slate-500 uppercase tracking-wider">Free Plan</p>
                        </div>
                        <button className="p-1.5 rounded-full hover:bg-white/10 transition-colors">
                            <span className="material-icons text-lg text-slate-500">notifications</span>
                        </button>
                    </div>
                </div>
            </div>
        </>
    )
}

export default Navbar
