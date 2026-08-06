const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
dotenv.config({ path: '.env' });

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function check() {
    // 1. Get user (we can't query auth.users with anon key easily, so let's query profiles if it exists, or just query orders directly)
    // Wait, orders table has user_id, but can we get the email? Probably not directly.
    // Let's just find the book first.
    const { data: books, error: bookErr } = await supabase.from('books').select('*').ilike('title', '%BVMAC%');
    console.log("Books:", books);
    if (bookErr) console.error("Book Error:", bookErr);

    if (books && books.length > 0) {
        for (const book of books) {
            console.log(`\nChecking file for book ${book.id} - ${book.title}`);
            const filePath = book.file_url || `pdfs/${book.id}.pdf`;
            console.log("Expected filePath:", filePath);
            
            // Check if file exists
            // We can't directly check existence via API without downloading, but we can list the directory
            const dir = filePath.substring(0, filePath.lastIndexOf('/'));
            const filename = filePath.substring(filePath.lastIndexOf('/') + 1);
            const { data: list, error: listErr } = await supabase.storage.from('books').list(dir, {
                limit: 100,
                search: filename
            });
            console.log("Storage list result:", list);
            if (listErr) console.error("List Error:", listErr);
        }
    }
}
check();
