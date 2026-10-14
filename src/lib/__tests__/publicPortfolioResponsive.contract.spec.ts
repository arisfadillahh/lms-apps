import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import PublicPortfolioExperience from '@/components/portfolio/PublicPortfolioExperience';
import { buildPortfolioExperienceModel, type ExperienceProject, type PortfolioExperienceInput } from '@/lib/publicPortfolioExperience';

vi.stubGlobal('React', React);
vi.mock('next/image', () => ({ default: ({ priority: _priority, ...props }: React.ImgHTMLAttributes<HTMLImageElement> & { priority?: boolean }) => React.createElement('img', props) }));

const project: ExperienceProject = {
  id: 'approved-fixture', publishedAt: '2026-10-01T00:00:00Z', snapshot: {
    title: 'Misi Planet Hijau', projectType: 'Game', summary: 'Game tentang lingkungan.', description: 'Kumpulkan bintang.',
    roleContribution: 'Membuat karakter.', tools: ['Scratch'], howToPlay: 'Gunakan panah.', playableUrl: '', repositoryUrl: null, videoUrl: null,
    learningReflection: 'Belajar logika.', nextSteps: 'Menambah level.', skills: ['Logic'], programType: 'EKSKUL', screenshots: [],
  },
};
const base: PortfolioExperienceInput = { fullName:'Coder QA', schoolName:'Sekolah privat fixture', schoolVisible:false, levelName:'XPLORER', programTypes:['EKSKUL','WEEKLY'], projects:[project] };
const render = (changes: Partial<PortfolioExperienceInput> = {}) => renderToStaticMarkup(React.createElement(PublicPortfolioExperience, { model:buildPortfolioExperienceModel({...base,...changes}) }));
const textOf = (markup: string) => markup.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
const links = (markup: string) => [...markup.matchAll(/<a\b[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g)].map((match) => ({href:match[1],text:textOf(match[2])}));

describe('public portfolio rendered behavior', () => {
  it('renders real approved counts, program context, and clear anchor actions', () => {
    const html = render();
    expect(links(html)).toEqual(expect.arrayContaining([
      {href:'#projects',text:'Lihat karya'}, {href:'#journey',text:'Perjalanan belajar'},
    ]));
    const stats = html.match(/<section[^>]*aria-label="Ringkasan portofolio"[^>]*>([\s\S]*?)<\/section>/)?.[1] ?? '';
    expect([...stats.matchAll(/<strong>(\d+)<\/strong>/g)].map((match) => Number(match[1]))).toEqual([1,0,1,1]);
    expect(textOf(html)).toMatch(/XPLORER Ekskul Weekly/);
    expect(html.match(/aria-pressed="true"/g)?.length).toBe(1);
  });

  it('does not expose an opted-out school or attribute a fallback reflection to the coder', () => {
    expect(textOf(render())).not.toMatch(/Sekolah privat fixture/);
    expect(textOf(render({schoolVisible:true}))).toMatch(/Sekolah privat fixture/);
    const empty = textOf(render({projects:[]}));
    expect(empty).toMatch(/Karya sedang dipersiapkan/);
    expect(empty).not.toMatch(/— Coder/);
  });

  it('keeps a later active block in the initial journey preview', () => {
    const learningBlocks: NonNullable<PortfolioExperienceInput['learningBlocks']> = Array.from({length:8},(_,i)=>({ id:`block-${i}`, blockName:`Materi unik ${i}`, levelName:'XPLORER', levelOrder:0, journeyOrder:i, status:i<5?'COMPLETED':i===5?'IN_PROGRESS':'PENDING', completedAt:null }));
    const html = render({learningBlocks});
    const headings = [...html.matchAll(/<h3[^>]*>(Materi unik \d+)<\/h3>/g)].map((match)=>match[1]);
    expect(headings).toEqual(['Materi unik 4','Materi unik 5','Materi unik 6','Materi unik 7']);
    expect(textOf(html)).toMatch(/Lihat semua 8 block/);
    expect(textOf(html)).toMatch(/Sedang dipelajari/);
  });

  it('renders all tool filters, including a fifth tool, and retains the official logo', () => {
    const projects = Array.from({length:6},(_,i)=>({...project,id:`project-${i}`,snapshot:{...project.snapshot,tools:[`Tool ${i}`]}}));
    const html = render({projects});
    expect([...html.matchAll(/<button[^>]*aria-pressed="(?:true|false)"[^>]*>([^<]+)<\/button>/g)].map((match)=>match[1])).toEqual(['Semua (6)','Tool 0','Tool 1','Tool 2','Tool 3','Tool 4','Tool 5']);
    expect([...html.matchAll(/<img[^>]*src="([^"]+)"/g)].map((match)=>match[1])).toEqual(expect.arrayContaining(['/images/clevio-logo.png.png']));
  });

  it.each(['PENDING', 'COMPLETED'] as const)('keeps the journey meaningful when every block is %s', (status) => {
    const learningBlocks = Array.from({length:6},(_,i)=>({id:`b-${i}`,blockName:`Materi ${i}`,levelName:'XPLORER',levelOrder:0,journeyOrder:i,status,completedAt:null}));
    const html = render({learningBlocks});
    const headings = [...html.matchAll(/<h3[^>]*>(Materi \d+)<\/h3>/g)].map((match)=>match[1]);
    expect(headings).toEqual(status === 'PENDING' ? ['Materi 0','Materi 1','Materi 2','Materi 3'] : ['Materi 2','Materi 3','Materi 4','Materi 5']);
  });
});
