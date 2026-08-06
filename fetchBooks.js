import fs from 'fs';
let env = '';
try { env += fs.readFileSync('.env.local', 'utf8') + '\n'; } catch(e){}
try { env += fs.readFileSync('.env', 'utf8') + '\n'; } catch(e){}

const lines = env.split('\n');
const supabaseUrlLine = lines.find(l => l.startsWith('VITE_SUPABASE_URL='));
const anonKeyLine = lines.find(l => l.startsWith('VITE_SUPABASE_ANON_KEY='));

const supabaseUrl = supabaseUrlLine ? supabaseUrlLine.split('VITE_SUPABASE_URL=')[1].trim() : '';
const anonKey = anonKeyLine ? anonKeyLine.split('VITE_SUPABASE_ANON_KEY=')[1].trim() : '';

const url = supabaseUrl + '/rest/v1/books?select=id,title,author';
fetch(url, {
    headers: {
        'apikey': anonKey,
        'Authorization': 'Bearer ' + anonKey
    }
})
.then(res => res.json())
.then(data => {
    console.log(JSON.stringify(data, null, 2));
})
.catch(err => console.error(err));
