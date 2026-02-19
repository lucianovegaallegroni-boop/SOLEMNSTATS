import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useNavigate } from 'react-router-dom'
import * as CryptoJS from 'crypto-js';

export default function Login() {
    const [loading, setLoading] = useState(false)
    const [email, setEmail] = useState('')
    const [username, setUsername] = useState('')
    const [password, setPassword] = useState('')
    const [confirmPassword, setConfirmPassword] = useState('')
    const [isSignUp, setIsSignUp] = useState(false)
    const navigate = useNavigate()

    const handleAuth = async (e: React.FormEvent) => {
        e.preventDefault()

        if (isSignUp && password !== confirmPassword) {
            alert("Passwords do not match!")
            return
        }

        setLoading(true)

        try {
            if (isSignUp) {
                const { error } = await supabase.auth.signUp({
                    email,
                    password,
                    options: {
                        data: {
                            username: username,
                        },
                    },
                })
                if (error) throw error
                alert('Check your email for the login link!')
            } else {
                const secretKey = import.meta.env.VITE_AES_SECRET_KEY;
                if (!secretKey) throw new Error("Encryption configuration missing");

                // Encrypt payload
                const payload = JSON.stringify({ email, password });
                const encrypted = CryptoJS.AES.encrypt(payload, secretKey).toString();

                // Call secure login endpoint
                const response = await fetch(`${import.meta.env.VITE_API_BASE_URL || ''}/api/login`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ payload: encrypted }),
                });

                const data = await response.json();

                if (!response.ok) {
                    throw new Error(data.error || 'Login failed');
                }

                if (data.session) {
                    const { error } = await supabase.auth.setSession(data.session);
                    if (error) throw error;
                }

                navigate('/')
            }
        } catch (error: any) {
            alert(error.error_description || error.message)
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="flex items-center justify-center min-h-[80vh]">
            <div className="w-full max-w-md p-8 space-y-6 bg-card-dark border border-border-dark rounded-xl shadow-2xl">
                <h2 className="text-3xl font-bold text-center text-white font-display">
                    {isSignUp ? 'Create Account' : 'Welcome Back'}
                </h2>

                <form onSubmit={handleAuth} className="space-y-4">
                    {isSignUp && (
                        <div>
                            <label className="block text-sm font-medium text-slate-400 mb-1">Username</label>
                            <input
                                type="text"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                required
                                className="w-full px-4 py-2 bg-slate-800/50 border border-slate-700 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent text-white placeholder-slate-500"
                                placeholder="AncientDuelist"
                            />
                        </div>
                    )}

                    <div>
                        <label className="block text-sm font-medium text-slate-400 mb-1">Email</label>
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                            className="w-full px-4 py-2 bg-slate-800/50 border border-slate-700 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent text-white placeholder-slate-500"
                            placeholder="duelist@example.com"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-400 mb-1">Password</label>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                            minLength={6}
                            className="w-full px-4 py-2 bg-slate-800/50 border border-slate-700 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent text-white placeholder-slate-500"
                            placeholder="••••••••"
                        />
                    </div>

                    {isSignUp && (
                        <div>
                            <label className="block text-sm font-medium text-slate-400 mb-1">Confirm Password</label>
                            <input
                                type="password"
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                required
                                minLength={6}
                                className="w-full px-4 py-2 bg-slate-800/50 border border-slate-700 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent text-white placeholder-slate-500"
                                placeholder="••••••••"
                            />
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full py-3 px-4 bg-primary hover:bg-primary/90 text-background-dark font-bold rounded-lg transition-all transform active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {loading ? 'Processing...' : (isSignUp ? 'Sign Up' : 'Sign In')}
                    </button>
                </form>

                <div className="text-center">
                    <button
                        onClick={() => setIsSignUp(!isSignUp)}
                        className="text-sm text-primary hover:underline hover:text-primary/80"
                    >
                        {isSignUp ? 'Already have an account? Sign In' : "Don't have an account? Sign Up"}
                    </button>
                </div>
            </div>
        </div>
    )
}
