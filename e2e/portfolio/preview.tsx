import { createRoot } from 'react-dom/client';
import PublicPortfolioExperience from '../../src/components/portfolio/PublicPortfolioExperience';
import { buildPortfolioExperienceModel, type ExperienceProject } from '../../src/lib/publicPortfolioExperience';

// Synthetic approved snapshots only. No credentials, API calls, or production records.
const screenshot = (color: string, width: number, height: number) => 'data:image/svg+xml,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 640 400"><rect width="640" height="400" fill="${color}"/><circle cx="460" cy="100" r="60" fill="#c7e961"/><path d="M0 320L180 190 280 270 400 150 640 320V400H0Z" fill="#314878"/><text x="35" y="70" fill="white" font-family="sans-serif" font-size="27">KARYA DEMO · QA LOKAL</text></svg>`);
const projects: ExperienceProject[] = Array.from({ length: 6 }, (_, i) => ({
  id: `qa-${i}`, publishedAt: '2026-10-01T00:00:00Z', snapshot: {
    title: ['Petualangan ke Planet Hijau', 'Menjaga Laut Tetap Bersih', 'Robot Penjelajah', 'Cerita Interaktif', 'Misi Penyelamatan', 'Galaksi Kreatif'][i],
    projectType: 'Game', summary: 'Sebuah petualangan tentang menjaga lingkungan dan belajar memecahkan masalah.',
    description: i === 0 ? 'Pemain menjelajahi dunia, mengumpulkan bintang, dan menyelesaikan tantangan. '.repeat(18) : 'Game ini dibuat sebagai bagian dari perjalanan belajar coding.',
    roleContribution: 'Membuat karakter, alur permainan, dan sistem skor.', tools: [i % 2 ? 'Scratch' : 'Scratch 3'],
    howToPlay: 'Gunakan tombol panah untuk bergerak. Kumpulkan bintang hingga mencapai tujuan.',
    playableUrl: i === 1 ? '' : 'https://example.com/game', repositoryUrl: null, videoUrl: null,
    learningReflection: 'Aku belajar menggunakan kondisi dan menguji permainan agar lebih mudah dipahami.', nextSteps: 'Menambah level dan mencoba tantangan baru.',
    skills: ['Game Design', 'Problem Solving'], programType: i % 2 ? 'EKSKUL' : 'WEEKLY',
    screenshots: [{ publicUrl: screenshot('#486b9d', i % 2 ? 400 : 960, i % 2 ? 800 : 540), sortOrder: 0, altText: null }, { publicUrl: screenshot('#377d73', 640, 400), sortOrder: 1, altText: null }],
  },
}));
const empty = new URLSearchParams(location.search).has('empty');
const stress = new URLSearchParams(location.search).has('stress');
const stressLabel = 'NamaAplikasiDanKeahlianYangSangatPanjangTanpaSpasiUntukQA';
const model = buildPortfolioExperienceModel({
  fullName: stress ? 'Nara Pratama Adiwijaya Kusuma — Akun Demo QA Nama Panjang' : 'Nara Pratama — Akun Demo QA', schoolName: stress ? 'Sekolah Demo dengan Nama Sangat Panjang untuk Pemeriksaan Layout' : 'Sekolah Demo', schoolVisible: stress,
  levelName: 'XPLORER', programTypes: ['EKSKUL', 'WEEKLY'], projects: empty ? [] : stress ? projects.map(p=>({...p,snapshot:{...p.snapshot,title:stressLabel,tools:[stressLabel,...p.snapshot.tools],skills:[stressLabel,...p.snapshot.skills]}})) : projects,
  learningBlocks: empty ? [] : Array.from({ length: 8 }, (_, i) => ({ id:`block-${i}`, levelName:'XPLORER', levelOrder:0, journeyOrder:i, blockName:stress ? `Block ${i + 1}: ${stressLabel}` : `Block ${i + 1}: Coding & Creativity`, status:i < 5 ? 'COMPLETED' : i === 5 ? 'IN_PROGRESS' : 'PENDING', completedAt:null })),
});
createRoot(document.getElementById('root')!).render(<PublicPortfolioExperience model={model} />);
