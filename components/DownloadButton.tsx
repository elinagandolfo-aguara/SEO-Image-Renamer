'use client';

import { useState } from 'react';
import { downloadZip } from '@/lib/export';
import type { ProcessedImage } from '@/lib/types';

interface Props {
  images: ProcessedImage[];
  brand: string;
}

export default function DownloadButton({ images, brand }: Props) {
  const [loading, setLoading] = useState(false);

  async function handle() {
    setLoading(true);
    try {
      await downloadZip(images, brand || 'seo');
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      className="btn-primary"
      onClick={handle}
      disabled={loading}
      style={{ fontSize: 15, padding: '12px 28px' }}
    >
      {loading ? 'Generando ZIP...' : 'Descargar ZIP'}
    </button>
  );
}
