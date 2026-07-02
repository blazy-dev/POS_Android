import { render, screen } from '@testing-library/react';
import { Spinner } from '@/components/ui/spinner';

describe('Spinner', () => {
  it('renderiza el elemento de carga', () => {
    const { container } = render(<Spinner />);
    const el = container.querySelector('.animate-spin');
    expect(el).toBeInTheDocument();
  });

  it('aplica clase de animacion', () => {
    const { container } = render(<Spinner />);
    const el = container.querySelector('.animate-spin');
    expect(el?.className).toContain('animate-spin');
    expect(el?.className).toContain('rounded-full');
  });
});
