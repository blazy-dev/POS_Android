import { render, screen } from '@testing-library/react';
import { Input } from '@/components/ui/input';

describe('Input', () => {
  it('renderiza un input', () => {
    render(<Input placeholder="Escribe algo" />);
    expect(screen.getByPlaceholderText('Escribe algo')).toBeInTheDocument();
  });

  it('acepta type', () => {
    render(<Input type="email" data-testid="email-input" />);
    const input = screen.getByTestId('email-input');
    expect(input).toHaveAttribute('type', 'email');
  });

  it('es deshabilitado cuando se pasa disabled', () => {
    render(<Input disabled />);
    expect(screen.getByRole('textbox')).toBeDisabled();
  });
});
