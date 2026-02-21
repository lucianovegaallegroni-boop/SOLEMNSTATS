import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import App from './App'
import Home from './pages/Home'
import Dashboard from './pages/Dashboard'
import ComboTracker from './pages/ComboTracker'
import Decks from './pages/Decks'
import EditDeck from './pages/EditDeck'
import Combos from './pages/Combos'
import Login from './pages/Login'
import Profile from './pages/Profile'
import MetaReport from './pages/MetaReport'
import Market from './pages/Market'
import DuelSimulator from './pages/DuelSimulator'
import DuelLobby from './pages/DuelLobby'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<App />}>
          <Route index element={<Home />} />
          <Route path="login" element={<Login />} />
          <Route path="profile" element={<Profile />} />
          <Route path="meta-report" element={<MetaReport />} />
          <Route path="market" element={<Market />} />
          <Route path="dashboard/:id" element={<Dashboard />} />
          <Route path="combos/:id" element={<Combos />} />
          <Route path="combo" element={<ComboTracker />} />
          <Route path="decks" element={<Decks />} />
          <Route path="edit-deck/:id" element={<EditDeck />} />
          <Route path="duel-simulator/:id" element={<DuelSimulator />} />
          <Route path="lobby" element={<DuelLobby />} />
        </Route>
      </Routes>
    </BrowserRouter>
  </React.StrictMode>,
)
