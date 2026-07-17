import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

export async function getFreeBooks() {
    try {
        const { data } = await supabase
            .from('books')
            .select('id, title, author, cover_url, file_url, description')
            .ilike('title', '%devenez riche%')
            .limit(1);
        return data || [];
    } catch (e) {
        return [];
    }
}
