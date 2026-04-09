'use client';

import { useRef, useState } from 'react';

interface Props {
  onFilesAdded: (files: File[]) => void;
  disabled: boolean;
}

const ACCEPTED = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

export default function ImageUploader({ onFilesAdded, disabled }: Props) {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function handle(files: FileList | null) {
    if (!files) return;
    const valid = Array.from(files).filter(f => ACCEPTED.includes(f.type));
    if (valid.length) onFilesAdded(valid);
  }

  return (
    <div
      onClick={() => !disabled && inputRef.current?.click()}
      onDragOver={e => { e.preventDefault(); if (!disabled) setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={e => { e.preventDefault(); setDragging(false); if (!disabled) handle(e.dataTransfer.files); }}
      style={{
        border: `2px dashed ${dragging ? 'var(--accent)' : 'var(--border)'}`,
        borderRadius: 12, padding: 40, textAlign: 'center',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        transition: 'border-color 0.2s, background 0.2s',
        background: dragging ? 'rgba(108, 99, 255, 0.05)' : 'transparent',
      }}
    >
      <div style={{ fontSize: 32, marginBottom: 8 }}>🖼️</div>
      <p style={{ color: 'var(--text-muted)', fontSize: 14, margin: 0 }}>
        Arrastrá imágenes acá o <span style={{ color: 'var(--accent)', fontWeight: 600 }}>seleccioná archivos</span>
      </p>
      <p style={{ color: 'var(--text-muted)', fontSize: 12, margin: '4px 0 0' }}>JPG, PNG, WEBP, GIF</p>
      <input
        ref={inputRef} type="file" multiple accept={ACCEPTED.join(',')}
        style={{ display: 'none' }}
        onChange={e => handle(e.target.files)}
      />
    </div>
  );
}
