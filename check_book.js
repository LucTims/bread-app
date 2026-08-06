import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const env = fs.readFileSync('.env', 'utf-8');
let url = '', key = '';
for (const line of env.split('\n')) {
    if (line.startsWith('VITE_SUPABASE_URL=')) url = line.split('=')[1].trim();
    if (line.startsWith('VITE_SUPABASE_ANON_KEY=')) key = line.split('=')[1].trim();
}

const supabase = createClient(url, key);

async function check() {
    const { data: books, error: bookErr } = await supabase.from('books').select('*').ilike('title', '%BVMAC%');
    console.log("Books:", books);

    if (books && books.length > 0) {
        for (const book of books) {
            console.log(`\nChecking file for book ${book.id} - ${book.title}`);
            const filePath = book.file_url || `pdfs/${book.id}.pdf`;
            console.log("Expected filePath:", filePath);
            
            const dir = filePath.substring(0, filePath.lastIndexOf('/'));
            const filename = filePath.substring(filePath.lastIndexOf('/') + 1);
            const { data: list, error: listErr } = await supabase.storage.from('books').list(dir, {
                limit: 100,
                search: filename
            });
            console.log("Storage list result:", list);
        }
    }
}
check();
