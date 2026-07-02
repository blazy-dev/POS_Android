import { render, screen } from '@testing-library/react';
import { ErrorMessage } from '@/components/ui/error-message';

describe('ErrorMessage', () => {
  it('muestra el titulo y mensaje', () => {
    render(<ErrorMessage title="Error" message="Algo salio mal" />);
    expect(screen.getByText('Error')).toBeInTheDocument();
    expect(screen.getByText('Algo salio mal')).toBeInTheDocument();
  });

  it('muestra icono de alerta', () => {
    render(<ErrorMessage title="Error" message="Test" />);
    expect(
      screen.getByText('Error').closest('div')?.querySelector('svg'),
    ).toBeInTheDocument();
  });

  it('muestra boton de reintentar cuando onRetry esta presente', () => {
    const onRetry = vi.fn();
    render(
      <ErrorMessage title="Error" message="Fallo" onRetry={onRetry} />,
    );
    expect(screen.getByRole('button', { name: 'Reintentar' })).toBeInTheDocument();
  });

  it('no muestra boton de reintentar sin onRetry', () => {
    render(<ErrorMessage title="Error" message="Fallo" />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});
