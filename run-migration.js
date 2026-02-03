#!/usr/bin/env node

/**
 * Run SQL migration via Supabase REST API
 */

const fs = require('fs');
const path = require('path');

// Read environment variables
require('dotenv').config();

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    console.error('❌ Missing SUPABASE_URL or SERVICE_ROLE_KEY in .env');
    process.exit(1);
}

// Read migration file
const migrationPath = process.argv[2];
if (!migrationPath) {
    console.error('❌ Usage: node run-migration.js <migration-file.sql>');
    process.exit(1);
}

const fullPath = path.resolve(migrationPath);
if (!fs.existsSync(fullPath)) {
    console.error(`❌ Migration file not found: ${fullPath}`);
    process.exit(1);
}

const sql = fs.readFileSync(fullPath, 'utf8');

console.log(`📄 Running migration: ${path.basename(fullPath)}`);
console.log(`🔗 Supabase URL: ${SUPABASE_URL}`);

// Execute SQL via Supabase REST API
async function runMigration() {
    try {
        const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'apikey': SERVICE_ROLE_KEY,
                'Authorization': `Bearer ${SERVICE_ROLE_KEY}`
            },
            body: JSON.stringify({ query: sql })
        });

        if (!response.ok) {
            const error = await response.text();
            console.error('❌ Migration failed:', error);
            process.exit(1);
        }

        console.log('✅ Migration completed successfully!');
    } catch (error) {
        console.error('❌ Error running migration:', error.message);
        process.exit(1);
    }
}

runMigration();
