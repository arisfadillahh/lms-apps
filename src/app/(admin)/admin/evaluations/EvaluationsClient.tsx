'use client';

import { useState } from 'react';
import { Plus, Edit2, Trash2, GripVertical, Save, X } from 'lucide-react';
import { useRouter } from 'next/navigation';

type Criteria = {
  id: string;
  name: string;
  description: string | null;
  order_index: number;
};

export default function EvaluationsClient({ initialData }: { initialData: Criteria[] }) {
  const router = useRouter();
  const [data, setData] = useState<Criteria[]>(initialData);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [form, setForm] = useState({ name: '', description: '', order_index: 0 });

  const resetForm = () => {
    setForm({ name: '', description: '', order_index: data.length + 1 });
    setEditingId(null);
  };

  const handleOpenNew = () => {
    resetForm();
    setIsModalOpen(true);
  };

  const handleOpenEdit = (item: Criteria) => {
    setForm({ name: item.name, description: item.description || '', order_index: item.order_index });
    setEditingId(item.id);
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      if (editingId) {
        // PUT
        const res = await fetch(`/api/admin/evaluations/${editingId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(form)
        });
        if (!res.ok) throw new Error('Failed to update');
        const updated = await res.json();
        setData(data.map(d => d.id === editingId ? updated.data : d));
      } else {
        // POST
        const res = await fetch('/api/admin/evaluations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(form)
        });
        if (!res.ok) throw new Error('Failed to create');
        const created = await res.json();
        setData([...data, created.data]);
      }
      setIsModalOpen(false);
      resetForm();
      router.refresh();
    } catch (error) {
       console.error(error);
       alert('Gagal menyimpan data.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!window.confirm(`Yakin ingin menghapus kompetensi "${name}"? Ini mungkin berdampak pada rapor historis yang belum dipublish.`)) return;
    
    try {
      const res = await fetch(`/api/admin/evaluations/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete');
      setData(data.filter(d => d.id !== id));
      router.refresh();
    } catch (err) {
      alert('Gagal menghapus kompetensi.');
    }
  };

  return (
    <div style={{ background: '#fff', borderRadius: '1rem', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)', overflow: 'hidden' }}>
      <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc' }}>
        <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#1e293b', margin: 0 }}>Daftar Kriteria / Kompetensi Dasar</h3>
        <button 
          onClick={handleOpenNew}
          style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 1rem', background: '#3b82f6', color: '#fff', borderRadius: '0.5rem', fontWeight: 600, border: 'none', cursor: 'pointer' }}
        >
          <Plus size={16} /> Tambah Kriteria
        </button>
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
            <tr>
              <th style={{ padding: '1rem 1.5rem', color: '#475569', fontSize: '0.85rem', fontWeight: 600, width: '60px' }}>Urutan</th>
              <th style={{ padding: '1rem 1.5rem', color: '#475569', fontSize: '0.85rem', fontWeight: 600, width: '250px' }}>Nama Kompetensi</th>
              <th style={{ padding: '1rem 1.5rem', color: '#475569', fontSize: '0.85rem', fontWeight: 600 }}>Deskripsi Panduan Coach</th>
              <th style={{ padding: '1rem 1.5rem', color: '#475569', fontSize: '0.85rem', fontWeight: 600, width: '120px', textAlign: 'right' }}>Aksi</th>
            </tr>
          </thead>
          <tbody>
            {data.length === 0 ? (
              <tr>
                <td colSpan={4} style={{ padding: '3rem', textAlign: 'center', color: '#64748b' }}>Belum ada kriteria penilaian.</td>
              </tr>
            ) : (
              data.sort((a,b) => a.order_index - b.order_index).map((item) => (
                <tr key={item.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '1rem 1.5rem', color: '#64748b', fontWeight: 600 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <GripVertical size={16} style={{ cursor: 'grab', opacity: 0.5 }} />
                      {item.order_index}
                    </div>
                  </td>
                  <td style={{ padding: '1rem 1.5rem', fontWeight: 700, color: '#0f172a' }}>{item.name}</td>
                  <td style={{ padding: '1rem 1.5rem', color: '#475569', fontSize: '0.9rem', lineHeight: 1.5 }}>{item.description}</td>
                  <td style={{ padding: '1rem 1.5rem', textAlign: 'right' }}>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                      <button onClick={() => handleOpenEdit(item)} style={{ padding: '0.4rem', borderRadius: '0.4rem', background: '#f1f5f9', color: '#3b82f6', border: 'none', cursor: 'pointer' }}><Edit2 size={16} /></button>
                      <button onClick={() => handleDelete(item.id, item.name)} style={{ padding: '0.4rem', borderRadius: '0.4rem', background: '#fef2f2', color: '#ef4444', border: 'none', cursor: 'pointer' }}><Trash2 size={16} /></button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div style={{ background: '#fff', width: '100%', maxWidth: '500px', borderRadius: '1.5rem', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)', overflow: 'hidden' }}>
            <div style={{ padding: '1.5rem', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
                {editingId ? 'Edit Kompetensi' : 'Tambah Kompetensi Baru'}
              </h2>
              <button 
                onClick={() => setIsModalOpen(false)}
                style={{ background: 'transparent', border: 'none', color: '#64748b', cursor: 'pointer', padding: '0.5rem' }}
              >
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={handleSubmit} style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.9rem', fontWeight: 600, color: '#334155', marginBottom: '0.5rem' }}>Nama Kompetensi</label>
                <input 
                  type="text" 
                  value={form.name} 
                  onChange={e => setForm({...form, name: e.target.value})}
                  required
                  placeholder="Contoh: Logika Pemrograman"
                  style={{ width: '100%', padding: '0.75rem', borderRadius: '0.5rem', border: '1px solid #cbd5e1', fontSize: '0.95rem', outline: 'none' }}
                />
              </div>
              
              <div>
                <label style={{ display: 'block', fontSize: '0.9rem', fontWeight: 600, color: '#334155', marginBottom: '0.5rem' }}>Deskripsi Panduan</label>
                <textarea 
                  value={form.description} 
                  onChange={e => setForm({...form, description: e.target.value})}
                  required
                  rows={4}
                  placeholder="Penjelasan kriteria penilaian untuk coach..."
                  style={{ width: '100%', padding: '0.75rem', borderRadius: '0.5rem', border: '1px solid #cbd5e1', fontSize: '0.95rem', outline: 'none', resize: 'vertical' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.9rem', fontWeight: 600, color: '#334155', marginBottom: '0.5rem' }}>Urutan (Index)</label>
                <input 
                  type="number" 
                  value={form.order_index} 
                  min={0}
                  onChange={e => setForm({...form, order_index: parseInt(e.target.value) || 0})}
                  required
                  style={{ width: '100%', padding: '0.75rem', borderRadius: '0.5rem', border: '1px solid #cbd5e1', fontSize: '0.95rem', outline: 'none' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '1rem' }}>
                <button 
                  type="button" 
                  onClick={() => setIsModalOpen(false)}
                  style={{ padding: '0.75rem 1.25rem', borderRadius: '0.5rem', background: '#f1f5f9', color: '#475569', fontWeight: 600, border: 'none', cursor: 'pointer' }}
                >
                  Batal
                </button>
                <button 
                  type="submit" 
                  disabled={isSubmitting}
                  style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.75rem 1.5rem', borderRadius: '0.5rem', background: '#3b82f6', color: '#fff', fontWeight: 600, border: 'none', cursor: isSubmitting ? 'not-allowed' : 'pointer', opacity: isSubmitting ? 0.7 : 1 }}
                >
                  <Save size={18} /> Simpan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
