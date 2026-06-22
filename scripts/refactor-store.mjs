import fs from 'fs';
import path from 'path';

const storePath = path.join(process.cwd(), 'apps/web/src/store/useClubStore.ts');
let content = fs.readFileSync(storePath, 'utf8');

// Remove import { db, getDeviceId... }
content = content.replace(/import\s+{\s*db[^\n]+/g, '');

// Strip persist commands
content = content.replace(/await\s+db\.[a-zA-Z]+\.clear\(\);/g, '');
content = content.replace(/await\s+db\.[a-zA-Z]+\.bulkPut\([^)]+\);/g, '');
content = content.replace(/await\s+db\.[a-zA-Z]+\.put\([^)]+\);/g, '');
content = content.replace(/await\s+db\.[a-zA-Z]+\.delete\([^)]+\);/g, '');
content = content.replace(/await\s+db\.[a-zA-Z]+\.bulkDelete\([^)]+\);/g, '');
content = content.replace(/await\s+db\.syncQueue\.add\([^)]+\);/g, '');

// Stub out load from db
content = content.replace(/await\s+db\.players\.toArray\(\)/g, '[]');
content = content.replace(/await\s+db\.matches\.toArray\(\)/g, '[]');
content = content.replace(/await\s+db\.courts\.toArray\(\)/g, '[]');
content = content.replace(/await\s+db\.sessions\.toArray\(\)/g, '[]');

// Strip localStorage
content = content.replace(/localStorage\.setItem\([^)]+\);?/g, '');
content = content.replace(/localStorage\.removeItem\([^)]+\);?/g, '');
content = content.replace(/localStorage\.getItem\([^)]+\)/g, 'null');

// Replace pendingSyncCount logic
content = content.replace(/const\s+count\s*=\s*await\s+db\.syncQueue.*?\.count\(\);/gs, 'const count = 0;');

fs.writeFileSync(storePath, content);
console.log("Store refactored");
