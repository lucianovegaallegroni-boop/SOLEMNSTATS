function Footer() {
    return (
        <footer className="w-full px-6 py-4 flex flex-col md:flex-row justify-between items-center text-slate-500 text-[10px] font-bold uppercase tracking-widest gap-4 border-t border-primary/10 bg-background-dark/80 backdrop-blur-md flex-shrink-0 mt-auto">
            <div className="flex items-center gap-6">
                <span>© 2024 Duelist Analytics Labs</span>
                <a className="hover:text-primary transition-colors" href="#">Hypergeometric Formulae</a>
                <a className="hover:text-primary transition-colors" href="#">Simulation Log</a>
            </div>
            <div className="flex items-center gap-2 bg-primary/5 px-4 py-1.5 rounded border border-primary/20">
                <span className="material-icons text-primary text-sm">auto_awesome</span>
                <span className="text-primary italic">Probabilistic Engine: V2.1-Stable</span>
            </div>
        </footer>
    )
}

export default Footer
