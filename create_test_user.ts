import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY!;

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function main() {
    const { data, error } = await supabase.auth.signUp({
        email: 'test_duelist@solemnstats.com',
        password: 'Password123!',
        options: {
            data: {
                username: 'TestDuelist'
            }
        }
    });

    if (error) {
        console.error("Signup error:", error);
    } else {
        console.log("User created:", data.user?.email);
    }
}

main();
