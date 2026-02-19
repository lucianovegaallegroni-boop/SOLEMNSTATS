
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase } from './_lib/supabase';
import CryptoJS from 'crypto-js';

const SECRET_KEY = process.env.AES_SECRET_KEY || '';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { payload } = req.body;

    if (!payload) {
        return res.status(400).json({ error: 'Missing encrypted payload' });
    }

    if (!SECRET_KEY) {
        console.error('Missing AES_SECRET_KEY in server environment');
        return res.status(500).json({ error: 'Server configuration error' });
    }

    try {
        // Decrypt payload
        const bytes = CryptoJS.AES.decrypt(payload, SECRET_KEY);
        const originalText = bytes.toString(CryptoJS.enc.Utf8);

        if (!originalText) {
            throw new Error('Decryption failed');
        }

        const { email, password } = JSON.parse(originalText);

        if (!email || !password) {
            return res.status(400).json({ error: 'Invalid payload structure' });
        }

        // Authenticate with Supabase
        const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password,
        });

        if (error) {
            return res.status(401).json({ error: error.message });
        }

        return res.status(200).json(data);

    } catch (error: any) {
        console.error('Login error:', error);
        return res.status(400).json({ error: 'Invalid login request' });
    }
}
