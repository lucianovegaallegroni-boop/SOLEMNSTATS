import { Outlet } from 'react-router-dom'
import Navbar from './components/Navbar'
import Footer from './components/Footer'

function App() {
  return (
    <div className="bg-background-dark text-slate-100 font-display min-h-screen flex flex-col relative overflow-hidden">
      <Navbar />
      <div className="flex-1 flex flex-col">
        <Outlet />
      </div>

      {/* Background Glows */}
      <div className="fixed top-0 left-0 w-full h-full pointer-events-none -z-10 overflow-hidden">
        <div className="absolute top-[-10%] left-[-5%] w-96 h-96 bg-primary/5 blur-[120px] rounded-full"></div>
        <div className="absolute bottom-[5%] right-[-5%] w-80 h-80 bg-accent-blue/10 blur-[100px] rounded-full"></div>
        <div className="absolute top-[40%] right-[10%] w-64 h-64 bg-primary/5 blur-[150px] rounded-full"></div>
      </div>

      <Footer />
    </div>
  )
}

export default App
