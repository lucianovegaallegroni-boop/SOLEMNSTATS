import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import App from './App'
import Home from './pages/Home'
import Dashboard from './pages/Dashboard'
import ComboTracker from './pages/ComboTracker'
import Decks from './pages/Decks'
import EditDeck from './pages/EditDeck'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<App />}>
          <Route index element={<Home />} />
          <Route path="dashboard/:id" element={<Dashboard />} />
          <Route path="combo" element={<ComboTracker />} />
          <Route path="decks" element={<Decks />} />
          <Route path="edit-deck/:id" element={<EditDeck />} />
        </Route>
      </Routes>
    </BrowserRouter>
  </React.StrictMode>,
)
