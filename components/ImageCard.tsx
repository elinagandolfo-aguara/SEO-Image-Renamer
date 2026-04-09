'use client';

import type { ProcessedImage } from '@/lib/types';

const STATUS = {
  pending:   { label: 'Pendiente',    color: 'var(--text-muted)' },
  analyzing: { label: 'Analizando...', color: 'var(--accent)' },
  done:      { label: 'Listo',         color: 'var(--success)' },
  error:     { label: 'Error',         color: 'var(--error)' },
};

export default function ImageCard({ image }: { image: ProcessedImage }) {
  const { label, color } = STATUS[image.status];

  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden', display: 'flex' }}>
      <div style={{ width: 120, flexShrink: 0, position: 'relative' }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={image.previewUrl} alt={image.file.name} style={{ width: '100%', height: 100, objectFit: 'cover', display: 'block' }} />
        {image.status === 'analyzing' && (
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(14,14,17,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ width: 24, height: 24, border: '2px solid var(--accent)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
          </div>
        )}
      </div>

      <div style={{ padding: '12px 16px', flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
          <span style={{ fontSize: 12, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '60%' }}>
            {image.file.name}
          </span>
          <span style={{ fontSize: 12, fontWeight: 600, color, flexShrink: 0 }}>{label}</span>
        </div>

        {image.result && (
          <>
            <div style={{ marginBottom: 6 }}>
              <span style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Filename</span>
              <p style={{ margin: '2px 0 0', fontSize: 13, fontFamily: 'monospace', color: 'var(--accent)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {image.result.filename}.jpg
              </p>
            </div>
            <div>
              <span style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Alt text</span>
              <p style={{ margin: '2px 0 0', fontSize: 13, color: 'var(--text)', lineHeight: 1.4 }}>{image.result.alt}</p>
            </div>
          </>
        )}

        {image.error && <p style={{ margin: 0, fontSize: 13, color: 'var(--error)' }}>{image.error}</p>}
      </div>
    </div>
  );
}
