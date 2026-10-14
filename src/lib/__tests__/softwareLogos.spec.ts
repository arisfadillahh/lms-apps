import { describe, expect, it } from 'vitest';
import { defaultSoftwareLogo, normalizeSoftwareLogoUrl, resolveSoftwareLogo } from '@/lib/softwareLogos';
import { buildPortfolioExperienceModel } from '@/lib/publicPortfolioExperience';

describe('software logo identity and catalog precedence', () => {
  it.each(['Scratch 3 Install','Scratch 3 Online','Scratch Online - Sample',' Scratch 3.0 '])('recognizes %s as Scratch without a data migration', name => {
    expect(defaultSoftwareLogo(name)).toBe('/api/software/logos/scratch');
  });
  it('keeps Scratch Jr distinct and refuses fuzzy unrelated matches', () => {
    expect(defaultSoftwareLogo('Scratch Jr Install')).toBe('/api/software/logos/scratchjr');
    expect(defaultSoftwareLogo('My Scratch-inspired tool')).toBeNull();
    expect(resolveSoftwareLogo('Scratch Jr', [{name:'Scratch 3 Online',icon_url:'https://assets.example/scratch.png'}])).toBe('/api/software/logos/scratchjr');
  });
  it('prioritizes an exact catalog record over a family default', () => {
    const catalog = [{name:'Scratch 3 Online',icon_url:'https://assets.example/online.png'},{name:'Scratch 3 Install',icon_url:'https://assets.example/install.png'}];
    expect(resolveSoftwareLogo('Scratch 3 Online', catalog)).toBe('https://assets.example/online.png');
    expect(resolveSoftwareLogo('Scratch 3', catalog)).toBe('/api/software/logos/scratch');
    expect(resolveSoftwareLogo('Scratch 3 Online', [{name:'Scratch 3 Online',icon_url:null},{name:'Scratch 3 Install',icon_url:'https://assets.example/install.png'}])).toBe('/api/software/logos/scratch');
  });
  it('uses an unambiguous family logo and preserves custom unknown-software logos', () => {
    expect(resolveSoftwareLogo('Scratch 3', [{name:'Scratch 3 Install',icon_url:'https://assets.example/logo.png'}])).toBe('https://assets.example/logo.png');
    expect(resolveSoftwareLogo('Custom CAD', [{name:'Custom CAD',icon_url:'https://assets.example/cad.png'}])).toBe('https://assets.example/cad.png');
    expect(resolveSoftwareLogo('Custom CAD')).toBeNull();
  });
  it.each(['javascript:alert(1)','data:image/svg+xml,test','http://assets.example/logo.png','https://user:secret@assets.example/a.png','https://127.0.0.1/logo.png','//assets.example/a.png','/api/admin/users','https://assets.example/\\evil.png'])('rejects unsafe source %s', url => {
    expect(normalizeSoftwareLogoUrl(url)).toBeNull();
  });
  it('renders only tools used by approved projects and does not serialize the catalog', () => {
    const model = buildPortfolioExperienceModel({fullName:'Coder QA',schoolName:null,schoolVisible:false,levelName:null,programTypes:[],projects:[],softwareCatalog:[{name:'Private unused software',icon_url:'https://assets.example/a.png'}]});
    expect(model.toolLogos).toEqual([]);
    expect(model).not.toHaveProperty('softwareCatalog');
  });
});
