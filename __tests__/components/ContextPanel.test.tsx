import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ContextPanel from '@/components/ContextPanel';

const defaultProps = {
  brand: '', niche: '', url: '', language: 'ES' as const,
  city: '', regions: [] as string[], keywords: '', isScraping: false,
  onBrandChange: jest.fn(), onNicheChange: jest.fn(), onUrlChange: jest.fn(),
  onLanguageChange: jest.fn(), onCityChange: jest.fn(),
  onRegionsChange: jest.fn(), onKeywordsChange: jest.fn(),
};

describe('ContextPanel', () => {
  it('renderiza campo marca', () => {
    render(<ContextPanel {...defaultProps} />);
    expect(screen.getByPlaceholderText(/marca/i)).toBeInTheDocument();
  });

  it('renderiza campo temática', () => {
    render(<ContextPanel {...defaultProps} />);
    expect(screen.getByPlaceholderText(/temática/i)).toBeInTheDocument();
  });

  it('renderiza campo URL', () => {
    render(<ContextPanel {...defaultProps} />);
    expect(screen.getByPlaceholderText(/https/i)).toBeInTheDocument();
  });

  it('llama onBrandChange al escribir', async () => {
    const onBrandChange = jest.fn();
    render(<ContextPanel {...defaultProps} onBrandChange={onBrandChange} />);
    await userEvent.type(screen.getByPlaceholderText(/marca/i), 'Aguara');
    expect(onBrandChange).toHaveBeenCalled();
  });

  it('muestra toggle ES/EN', () => {
    render(<ContextPanel {...defaultProps} />);
    expect(screen.getByText('ES')).toBeInTheDocument();
    expect(screen.getByText('EN')).toBeInTheDocument();
  });

  it('expande sección colapsable al hacer click', async () => {
    render(<ContextPanel {...defaultProps} />);
    expect(screen.queryByPlaceholderText(/ciudad/i)).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /contexto/i }));
    expect(screen.getByPlaceholderText(/ciudad/i)).toBeInTheDocument();
  });

  it('muestra indicador cuando isScraping es true', () => {
    render(<ContextPanel {...defaultProps} isScraping={true} />);
    expect(screen.getByText(/analizando/i)).toBeInTheDocument();
  });
});
