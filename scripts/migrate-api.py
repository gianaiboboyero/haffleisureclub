import os
import re

api_dir = 'api'

def process_file(filepath):
    with open(filepath, 'r') as f:
        content = f.read()

    original = content

    # Replace imports
    content = re.sub(r'import\s+{\s*prisma\s*}\s+from\s+["\']\./_prisma\.js["\'];?', 'import { getSupabaseAdmin } from "./_supabaseAdmin.js";', content)
    content = re.sub(r'import\s+type\s+{\s*Prisma\s*}\s+from\s+["\']@prisma/client["\'];?', '', content)

    # Note: Regex mapping Prisma to Supabase perfectly is too complex for a simple script, 
    # it's better to manually fix or just delete the Vercel API and use client-side Supabase.

    if original != content:
        with open(filepath, 'w') as f:
            f.write(content)
        print(f"Updated {filepath}")

for filename in os.listdir(api_dir):
    if filename.endswith('.ts') and filename != '_prisma.ts':
        process_file(os.path.join(api_dir, filename))
