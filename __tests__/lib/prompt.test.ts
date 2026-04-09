import { buildPrompt } from '@/lib/prompt';
import type { AnalysisContext } from '@/lib/types';

const base: AnalysisContext = {
  niche: 'pool safety fencing',
  siteText: 'We install pool barriers in South Florida.',
  language: 'EN',
};

describe('buildPrompt', () => {
  it('incluye el nicho', () => {
    expect(buildPrompt(base)).toContain('pool safety fencing');
  });

  it('incluye el texto del sitio', () => {
    expect(buildPrompt(base)).toContain('We install pool barriers in South Florida.');
  });

  it('incluye el idioma', () => {
    expect(buildPrompt(base)).toContain('EN');
  });

  it('incluye ciudad cuando se provee', () => {
    expect(buildPrompt({ ...base, city: 'Miami' })).toContain('Miami');
  });

  it('omite línea de ciudad cuando no se provee', () => {
    const p = buildPrompt(base);
    expect(p).not.toContain('Ciudad:');
    expect(p).not.toContain('City:');
  });

  it('incluye regiones cuando se proveen', () => {
    const p = buildPrompt({ ...base, regions: ['Coral Gables', 'Brickell'] });
    expect(p).toContain('Coral Gables');
    expect(p).toContain('Brickell');
  });

  it('incluye keywords cuando se proveen', () => {
    expect(buildPrompt({ ...base, keywords: 'aluminum fence' })).toContain('aluminum fence');
  });

  it('omite keywords cuando no se proveen', () => {
    expect(buildPrompt(base)).not.toContain('Keywords');
  });

  it('siempre incluye ejemplos few-shot', () => {
    expect(buildPrompt(base)).toContain('white-safety-mesh-barrier-oak-trees');
  });

  it('termina con instrucción de solo JSON', () => {
    expect(buildPrompt(base)).toContain('SOLO con el JSON');
  });
});
