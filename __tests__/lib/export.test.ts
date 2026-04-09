import { buildCsvContent, buildZipFilename } from '@/lib/export';
import type { ProcessedImage } from '@/lib/types';

const mockImages: ProcessedImage[] = [
  {
    id: '1',
    file: new File([''], 'photo1.jpg', { type: 'image/jpeg' }),
    previewUrl: '',
    status: 'done',
    result: { filename: 'pool-fence-miami', alt: 'Black pool fence in Miami backyard.' },
  },
  {
    id: '2',
    file: new File([''], 'photo2.png', { type: 'image/png' }),
    previewUrl: '',
    status: 'done',
    result: { filename: 'white-mesh-barrier', alt: 'White mesh barrier near oak trees.' },
  },
];

describe('buildCsvContent', () => {
  it('incluye header row', () => {
    expect(buildCsvContent(mockImages).split('\n')[0]).toBe('archivo,alt_text');
  });

  it('incluye una fila por imagen con resultado', () => {
    const rows = buildCsvContent(mockImages).trim().split('\n');
    expect(rows).toHaveLength(3); // header + 2
  });

  it('agrega extensión .jpg al filename', () => {
    expect(buildCsvContent(mockImages)).toContain('pool-fence-miami.jpg');
  });

  it('envuelve alt text en comillas', () => {
    expect(buildCsvContent(mockImages)).toContain('"Black pool fence in Miami backyard."');
  });

  it('omite imágenes sin resultado', () => {
    const withError: ProcessedImage[] = [
      ...mockImages,
      { id: '3', file: new File([''], 'bad.jpg', { type: 'image/jpeg' }), previewUrl: '', status: 'error', error: 'Failed' },
    ];
    const rows = buildCsvContent(withError).trim().split('\n');
    expect(rows).toHaveLength(3);
  });
});

describe('buildZipFilename', () => {
  it('incluye el nombre de la marca en minúsculas', () => {
    expect(buildZipFilename('Aguara')).toContain('aguara');
  });

  it('slugifica la marca', () => {
    expect(buildZipFilename('Pool Fence Pro')).toContain('pool-fence-pro');
  });

  it('empieza con seo-images-', () => {
    expect(buildZipFilename('Aguara')).toMatch(/^seo-images-/);
  });

  it('termina en .zip', () => {
    expect(buildZipFilename('Aguara')).toMatch(/\.zip$/);
  });
});
