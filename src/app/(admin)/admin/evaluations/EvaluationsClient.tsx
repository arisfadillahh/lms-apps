'use client';

import { useState } from 'react';
import { Plus, Edit2, Trash2, GripVertical, Save, X, List } from 'lucide-react';
import { useRouter } from 'next/navigation';
import ActionDropdown from '@/components/admin/ActionDropdown';

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
        const res = await fetch(`/api/admin/evaluations/${editingId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(form),
        });
        if (!res.ok) throw new Error('Failed to update');
        const updated = await res.json();
        setData(data.map((d) => (d.id === editingId ? updated.data : d)));
      } else {
        const res = await fetch('/api/admin/evaluations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(form),
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
      setData(data.filter((d) => d.id !== id));
      router.refresh();
    } catch (err) {
      alert('Gagal menghapus kompetensi.');
    }
  };

  return (
    <div className="card">
      {/* Header */}
      <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)', background: 'var(--surface-2)' }}>
        <div className="row between">
          <div>
            <div style={{ fontWeight: 800, fontSize: 14.5 }}>Daftar Kriteria / Kompetensi Dasar</div>
            <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>
              {data.length} kompetensi terdaftar
            </div>
          </div>
          <button className="btn btn-primary" onClick={handleOpenNew}>
            <Plus size={16} />
            Tambah Kriteria
          </button>
        </div>
      </div>

      {/* Grid */}
      <div className="grid grid-3" style={{ padding: '20px' }}>
        {data.length === 0 ? (
          <div className="empty" style={{ gridColumn: '1 / -1' }}>Belum ada kriteria penilaian.</div>
        ) : (
          data
            .sort((a, b) => a.order_index - b.order_index)
            .map((item) => (
              <div key={item.id} className="card card-p" style={{ display: 'flex', flexDirection: 'column' }}>
                <div className="row between" style={{ marginBottom: 10 }}>
                  <span className="chip" style={{ fontSize: 10, fontWeight: 800 }}>Kriteria #{item.order_index}</span>
                  <ActionDropdown>
                    <div className="col gap-1" style={{ padding: '4px' }}>
                      <button
                        className="btn btn-sm btn-ghost"
                        onClick={() => handleOpenEdit(item)}
                        style={{ width: '100%', justifyContent: 'flex-start' }}
                      >
                        <Edit2 size={14} /> Edit Kriteria
                      </button>
                      <button
                        className="btn btn-sm btn-ghost text-danger"
                        onClick={() => handleDelete(item.id, item.name)}
                        style={{ width: '100%', justifyContent: 'flex-start' }}
                      >
                        <Trash2 size={14} /> Hapus Kriteria
                      </button>
                    </div>
                  </ActionDropdown>
                </div>
                <div style={{ fontWeight: 800, fontSize: 16, marginBottom: 6 }}>{item.name}</div>
                <div className="muted" style={{ fontSize: 12.5, flex: 1, marginBottom: 12 }}>{item.description}</div>
                <button className="btn btn-sm" style={{ width: '100%' }} onClick={() => router.push(`/admin/evaluations/questions`)}>
                  <List size={14} /> Kelola Pertanyaan
                </button>
              </div>
            ))
        )}
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="modal-backdrop" onClick={() => setIsModalOpen(false)}>
          <div
            style={{
              background: 'var(--surface)',
              width: '100%',
              maxWidth: 500,
              borderRadius: 'var(--radius-lg)',
              boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)',
              overflow: 'hidden',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ padding: '16px 18px', borderBottom: '1px solid var(--border)' }}>
              <div className="row between">
                <div style={{ fontWeight: 800, fontSize: 16 }}>
                  {editingId ? 'Edit Kompetensi' : 'Tambah Kompetensi Baru'}
                </div>
                <button className="btn btn-icon btn-ghost" onClick={() => setIsModalOpen(false)}>
                  <X size={18} />
                </button>
              </div>
            </div>

            <form onSubmit={handleSubmit} style={{ padding: '18px', display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 6 }}>
                  Nama Kompetensi
                </label>
                <input
                  type="text"
                  className="input"
                  style={{ width: '100%', boxSizing: 'border-box' }}
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  required
                  placeholder="Contoh: Logika Pemrograman"
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 6 }}>
                  Deskripsi Panduan
                </label>
                <textarea
                  className="input"
                  style={{ width: '100%', boxSizing: 'border-box', resize: 'vertical', fontFamily: 'inherit' }}
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  required
                  rows={4}
                  placeholder="Penjelasan kriteria penilaian untuk coach..."
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 6 }}>
                  Urutan (Index)
                </label>
                <input
                  type="number"
                  className="input"
                  style={{ width: '100%', boxSizing: 'border-box' }}
                  value={form.order_index}
                  min={0}
                  onChange={(e) => setForm({ ...form, order_index: parseInt(e.target.value) || 0 })}
                  required
                />
              </div>

              <div className="row gap-2" style={{ justifyContent: 'flex-end', marginTop: 8 }}>
                <button
                  type="button"
                  className="btn"
                  onClick={() => setIsModalOpen(false)}
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={isSubmitting}
                >
                  <Save size={16} />
                  {isSubmitting ? 'Menyimpan...' : 'Simpan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
