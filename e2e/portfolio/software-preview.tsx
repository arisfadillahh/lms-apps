import { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import SoftwareForm from '../../src/app/(admin)/admin/software/SoftwareForm';

// Browser-only API mock: never connects to Supabase or sends a production write.
const originalFetch = window.fetch.bind(window);
let failSave = true, uploads = 0, saves = 0;
window.fetch = async (input, init) => {
  if (String(input) === '/api/admin/software/logo') {
    uploads++; window.dispatchEvent(new Event('qa-count'));
    return Response.json({iconUrl:'https://lms.clev.io/logo/innovator-camp-logo-dark.png'});
  }
  if (String(input).startsWith('/api/admin/software')) {
    saves++;window.dispatchEvent(new Event('qa-count'));
    return failSave ? Response.json({error:'Simulasi gagal simpan; logo yang diunggah tetap tersedia untuk retry.'},{status:503}) : Response.json({id:'qa-software'});
  }
  return originalFetch(input,init);
};
function Harness() {
  const [counts,setCounts] = useState([0,0]);
  const [route,setRoute] = useState('Belum disimpan');
  useEffect(()=>{
    const count = () => setCounts([uploads,saves]);
    const routed = (e: Event) => setRoute((e as CustomEvent<string>).detail);
    window.addEventListener('qa-count',count);window.addEventListener('qa-route',routed);
    return()=>{window.removeEventListener('qa-count',count);window.removeEventListener('qa-route',routed);};
  },[]);
  return <main className="qa-shell"><h1>Logo Software — QA lokal</h1><p>Semua simpan/upload di halaman ini memakai mock lokal.</p>
    <label><input type="checkbox" defaultChecked onChange={e=>{failSave=e.currentTarget.checked;}}/> Simulasikan gagal simpan</label>
    <p role="status">Upload: {counts[0]} · Simpan: {counts[1]} · Tujuan: {route}</p>
    <SoftwareForm mode="edit" initialData={{id:'qa-software',name:'Scratch 3 Install',icon_url:null}} />
  </main>;
}
createRoot(document.getElementById('root')!).render(<Harness />);
