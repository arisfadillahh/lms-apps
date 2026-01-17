/**
 * Admin CCR Assignment Page
 * Route: /admin/coders/assign-ccr
 */

import CCRAssignment from './CCRAssignment';

export default function AssignCCRPage() {
    return (
        <div style={{ padding: '20px' }}>
            <h1 style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '8px' }}>
                Assign CCR Numbers
            </h1>
            <p style={{ color: '#64748b', marginBottom: '24px' }}>
                Assign CCR numbers to coders yang belum memiliki CCR
            </p>

            <CCRAssignment />
        </div>
    );
}

export const metadata = {
    title: 'Assign CCR - Admin',
    description: 'Assign CCR numbers to coders'
};
