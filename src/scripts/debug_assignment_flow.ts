
import { autoAssignLessonsForClass } from '../lib/services/lessonAutoAssign';
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

// Manual Env Parsing to supply credentials to DAO if needed?
// The DAOs use `getSupabaseAdmin`, which likely expects PROCESS.ENV to be set.
// We need to set process.env BEFORE importing the DAOs or running the function.

const envPath = path.resolve(__dirname, '../../.env');
try {
    const envContent = fs.readFileSync(envPath, 'utf8');
    const lines = envContent.split('\n');
    for (const line of lines) {
        const parts = line.split('=');
        if (parts.length >= 2) {
            const key = parts[0].trim();
            const val = parts.slice(1).join('=').trim().replace(/"/g, '');
            process.env[key] = val;
        }
    }
} catch (e) {
    console.error("Could not read .env", e);
}

async function main() {
    const classId = 'dcddb509-d0f9-4a80-9758-a14a990d0636';
    console.log(`Running Auto Assign for ${classId}...`);
    try {
        const result = await autoAssignLessonsForClass(classId);
        console.log("Result:", result);
    } catch (e) {
        console.error("Error running auto-assign:", e);
    }
}

main();
