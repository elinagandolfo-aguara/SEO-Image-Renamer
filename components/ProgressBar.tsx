'use client';

interface Props {
  total: number;
  done: number;
  errors: number;
}

export default function ProgressBar({ total, done, errors }: Props) {
  const pct = total > 0 ? Math.round(((done + errors) / total) * 100) : 0;

  return (
    <div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          marginBottom: 8,
          fontSize: 13,
          color: 'var(--text-muted)',
        }}
      >
        <span>Procesando imágenes...</span>
        <span style={{ display: 'flex', gap: 16 }}>
          <span>
            Total: <strong style={{ color: 'var(--text)' }}>{total}</strong>
          </span>
          <span>
            Listos: <strong style={{ color: 'var(--success)' }}>{done}</strong>
          </span>
          {errors > 0 && (
            <span>
              Errores: <strong style={{ color: 'var(--error)' }}>{errors}</strong>
            </span>
          )}
        </span>
      </div>
      <div style={{ height: 6, background: 'var(--border)', borderRadius: 3, overflow: 'hidden' }}>
        <div
          style={{
            height: '100%',
            width: `${pct}%`,
            background: 'linear-gradient(90deg, var(--accent), var(--accent-end))',
            borderRadius: 3,
            transition: 'width 0.3s ease',
          }}
        />
      </div>
    </div>
  );
}
