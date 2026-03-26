'use client';

import { useState } from 'react';
import { Plus, Edit2, Trash2, Save, X, Settings2, Trash } from 'lucide-react';
import { useRouter } from 'next/navigation';

type Question = {
  id: string;
  question: string;
  placeholder?: string | null;
};

type Template = {
  id: string;
  level_id: string | null;
  level?: { name: string } | null;
  questions: Question[];
};

type Level = {
  id: string;
  name: string;
};

function generateId() {
  return Math.random().toString(36).substr(2, 9);
}

export default function QuestionsClient({ initialData, levels }: { initialData: Template[], levels: Level[] }) {
  const router = useRouter();
  const [data, setData] = useState<Template[]>(initialData);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [formLevelId, setFormLevelId] = useState<string>('');
  const [formQuestions, setFormQuestions] = useState<Question[]>([]);

  const resetForm = () => {
    setFormLevelId('');
    setFormQuestions([{ id: generateId(), question: '', placeholder: '' }]);
    setEditingId(null);
  };

  const handleOpenNew = () => {
    resetForm();
    setIsModalOpen(true);
  };

  const handleOpenEdit = (item: Template) => {
    setFormLevelId(item.level_id || '');
    setFormQuestions(item.questions || []);
    setEditingId(item.id);
    setIsModalOpen(true);
  };

  const addQuestion = () => {
    setFormQuestions([...formQuestions, { id: generateId(), question: '', placeholder: '' }]);
  };

  const removeQuestion = (id: string) => {
    setFormQuestions(formQuestions.filter(q => q.id !== id));
  };

  const updateQuestion = (id: string, field: 'question' | 'placeholder', value: string) => {
    setFormQuestions(formQuestions.map(q => q.id === id ? { ...q, [field]: value } : q));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    // Clean up empty questions
    const validQuestions = formQuestions.filter(q => q.question.trim() !== '');

    if (validQuestions.length === 0) {
      alert('Minimal masukkan 1 pertanyaan.');
      setIsSubmitting(false);
      return;
    }

    const payload = {
      level_id: formLevelId === '' ? null : formLevelId,
      questions: validQuestions
    };

    try {
      if (editingId) {
        // PUT
        const res = await fetch(`/api/admin/evaluation-templates/${editingId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        if (!res.ok) throw new Error('Failed to update');
        const updated = await res.json();
        // Since the initial rendering gets real level object, do a router refresh to fetch the joined level properly, or just refresh directly.
        setData(data.map(d => d.id === editingId ? updated.data : d));
      } else {
        // POST
        const res = await fetch('/api/admin/evaluation-templates', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        if (!res.ok) throw new Error('Failed to create');
        const created = await res.json();
        setData([created.data, ...data]);
      }
      setIsModalOpen(false);
      resetForm();
      router.refresh();
    } catch (error) {
       console.error(error);
       alert('Gagal menyimpan template pertanyaan.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Yakin ingin menghapus template pertanyaan ini?')) return;
    
    try {
      const res = await fetch(`/api/admin/evaluation-templates/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete');
      setData(data.filter(d => d.id !== id));
      router.refresh();
    } catch (err) {
      alert('Gagal menghapus template.');
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="px-6 py-5 border-b border-slate-100 flex justify-between items-center bg-slate-50">
        <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
          <Settings2 size={20} className="text-clevio-navy" />
          Daftar Template Pertanyaan
        </h3>
        <button 
          onClick={handleOpenNew}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition"
        >
          <Plus size={16} /> Tambah Template
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead className="bg-slate-50 border-b-2 border-slate-200">
            <tr>
              <th className="p-4 text-slate-600 font-semibold text-sm w-48">Level / Kategori</th>
              <th className="p-4 text-slate-600 font-semibold text-sm">Daftar Pertanyaan</th>
              <th className="p-4 text-slate-600 font-semibold text-sm w-32 text-right">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {data.length === 0 ? (
              <tr>
                <td colSpan={3} className="p-12 text-center text-slate-500">Belum ada template pertanyaan.</td>
              </tr>
            ) : (
              data.map((item) => (
                <tr key={item.id} className="border-b border-slate-100 align-top">
                  <td className="p-4">
                    <span className="inline-flex px-3 py-1 rounded-full text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-100">
                      {item.level?.name || 'Semua Level (Default)'}
                    </span>
                  </td>
                  <td className="p-4">
                    <ul className="space-y-2">
                      {item.questions.map((q, idx) => (
                        <li key={idx} className="text-sm text-slate-700 flex items-start gap-2">
                          <span className="font-bold text-slate-400">{idx + 1}.</span>
                          <div>
                            <span className="font-medium text-clevio-navy block">{q.question}</span>
                            {q.placeholder && <span className="text-xs text-slate-400 italic block mt-0.5">Placeholder: {q.placeholder}</span>}
                          </div>
                        </li>
                      ))}
                    </ul>
                  </td>
                  <td className="p-4 mt-1 flex justify-end gap-2">
                    <button onClick={() => handleOpenEdit(item)} className="p-2 rounded-lg bg-slate-100 text-blue-600 hover:bg-slate-200 transition">
                      <Edit2 size={16} />
                    </button>
                    <button onClick={() => handleDelete(item.id)} className="p-2 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 transition">
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
          <div className="bg-white w-full max-w-2xl rounded-2xl shadow-xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-6 border-b border-slate-200 flex justify-between items-center bg-slate-50 shrink-0">
              <h2 className="text-xl font-bold text-slate-800">
                {editingId ? 'Edit Template Pertanyaan' : 'Tambah Template Pertanyaan'}
              </h2>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-500 hover:text-slate-800 p-2">
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 flex flex-col gap-6">
              
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Terapkan untuk Level</label>
                <select 
                  value={formLevelId} 
                  onChange={(e) => setFormLevelId(e.target.value)}
                  className="w-full p-3 rounded-lg border border-slate-300 outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                >
                  <option value="">Semua Level Umum (Default)</option>
                  {levels.map(l => (
                    <option key={l.id} value={l.id}>{l.name}</option>
                  ))}
                </select>
                <p className="text-xs text-slate-500 mt-2 italic">* Jika kelas belum memiliki template levelnya sendiri, akan memakai template "Semua Level".</p>
              </div>

              <div className="border-t border-slate-200 pt-6">
                <div className="flex justify-between items-center mb-4">
                  <label className="block text-sm font-semibold text-slate-700">Daftar Pertanyaan</label>
                  <button type="button" onClick={addQuestion} className="text-xs font-bold text-blue-600 flex items-center gap-1 hover:underline">
                    <Plus size={14} /> Tambah Pertanyaan
                  </button>
                </div>
                
                <div className="space-y-4">
                  {formQuestions.map((q, idx) => (
                    <div key={q.id} className="p-4 bg-slate-50 border border-slate-200 rounded-xl flex gap-4 items-start">
                      <div className="shrink-0 w-6 h-6 rounded-full bg-blue-100 text-blue-700 font-bold text-xs flex items-center justify-center mt-1">
                        {idx + 1}
                      </div>
                      <div className="flex-1 flex flex-col gap-3">
                        <input 
                          type="text" 
                          value={q.question}
                          onChange={(e) => updateQuestion(q.id, 'question', e.target.value)}
                          placeholder="Ketik pertanyaan (misal: Apa hal yang paling kamu sukai?)"
                          className="w-full p-2.5 rounded-lg border border-slate-300 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                          required
                        />
                        <input 
                          type="text" 
                          value={q.placeholder || ''}
                          onChange={(e) => updateQuestion(q.id, 'placeholder', e.target.value)}
                          placeholder="Placeholder opsional (tampil buram di text box coder)"
                          className="w-full p-2.5 rounded-lg border border-slate-300 text-sm outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                        />
                      </div>
                      <button 
                        type="button" 
                        onClick={() => removeQuestion(q.id)} 
                        className="text-slate-400 hover:text-red-500 hover:bg-red-50 p-2 rounded-lg mt-1"
                        disabled={formQuestions.length === 1}
                      >
                        <Trash size={16} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

            </form>

            <div className="p-6 border-t border-slate-200 flex justify-end gap-3 shrink-0 bg-white">
              <button 
                type="button" 
                onClick={() => setIsModalOpen(false)}
                className="px-5 py-2.5 rounded-lg bg-slate-100 text-slate-700 font-semibold hover:bg-slate-200 transition"
              >
                Batal
              </button>
              <button 
                type="button" 
                onClick={handleSubmit}
                disabled={isSubmitting}
                className="flex items-center gap-2 px-6 py-2.5 rounded-lg bg-blue-600 text-white font-semibold hover:bg-blue-700 transition disabled:opacity-70 disabled:cursor-not-allowed"
              >
                <Save size={18} /> Simpan Template
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
