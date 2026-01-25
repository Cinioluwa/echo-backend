import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';

// Minimal fetch wrapper since we might be in node environment without global fetch in older versions, 
// but Node 18+ has fetch. Assuming Node 18+.
const API_URL = 'http://localhost:3000/api';

async function verifyExport() {
    console.log('🚀 Starting Manual Export Verification...');

    // 1. Login as Admin
    console.log('🔑 Logging in as admin@cu.edu.ng...');
    const loginRes = await fetch(`${API_URL}/users/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            email: 'admin@cu.edu.ng',
            password: 'password123'
        })
    });

    if (!loginRes.ok) {
        console.error('❌ Login failed:', await loginRes.text());
        return;
    }

    const { token } = await loginRes.json();
    console.log('✅ Login successful. Token received.');

    // 2. Request Export
    console.log('📥 Requesting CSV Export...');
    const exportRes = await fetch(`${API_URL}/admin/export/pings`, {
        headers: {
            'Authorization': `Bearer ${token}`
        }
    });

    if (!exportRes.ok) {
        console.error('❌ Export failed:', await exportRes.text());
        return;
    }

    const csvText = await exportRes.text();
    console.log(`✅ CSV Received (${csvText.length} bytes)`);

    // 3. Save to Disk
    const outputPath = path.resolve('manual_export_verification.csv');
    fs.writeFileSync(outputPath, csvText);

    console.log(`💾 Saved to: ${outputPath}`);
    console.log('\n--- CSV PREVIEW ---');
    console.log(csvText.split('\n').slice(0, 5).join('\n'));
    console.log('...\n-------------------');
}

verifyExport().catch(console.error);
