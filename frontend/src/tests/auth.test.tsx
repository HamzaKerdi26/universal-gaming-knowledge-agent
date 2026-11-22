import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AuthPage } from '../pages/AuthPage';
import { AuthProvider } from '../hooks/AuthProvider';

// Import jest-dom matchers
import '@testing-library/jest-dom';

// Mock useAuth before importing components that use it
vi.mock('../hooks/useAuth', () => ({
  useAuth: vi.fn(),
}));

// Import after mock is set up
import { useAuth } from '../hooks/useAuth';

const mockUseAuth = vi.mocked(useAuth);

const mockAuthContext = {
  user: null,
  isLoading: false,
  restoreError: null,
  login: vi.fn(),
  register: vi.fn(),
  logout: vi.fn(),
};

const renderAuthPage = (mode: 'login' | 'register', initialError?: string | null) => {
  return render(
    <MemoryRouter>
      <AuthProvider>
        <AuthPage mode={mode} initialError={initialError} />
      </AuthProvider>
    </MemoryRouter>
  );
};

describe('AuthPage - Login Form', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseAuth.mockReturnValue(mockAuthContext);
  });

  it('should render email and password fields for login', () => {
    renderAuthPage('login');

    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument();
  });

  it('should not render username field for login', () => {
    renderAuthPage('login');

    expect(screen.queryByLabelText(/username/i)).not.toBeInTheDocument();
  });

  it('should trim whitespace from email on submit', async () => {
    mockAuthContext.login.mockResolvedValue(undefined);
    renderAuthPage('login');

    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: ' test@example.com ' } });
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'password123' } });
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => {
      expect(mockAuthContext.login).toHaveBeenCalledWith({
        email: 'test@example.com',
        password: 'password123',
      });
    });
  });
});

describe('AuthPage - Registration Form', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseAuth.mockReturnValue(mockAuthContext);
  });

    it('should render username, email and password fields for registration', () => {
    renderAuthPage('register');

    expect(screen.getByLabelText(/username/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^Password$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/confirm password/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /create account/i })).toBeInTheDocument();
  });

  it('should show password mismatch error', async () => {
    renderAuthPage('register');

    const passwordInput = screen.getByLabelText(/^Password$/i);
    const confirmPasswordInput = screen.getByLabelText(/confirm password/i);

    fireEvent.change(passwordInput, { target: { value: 'password123' } });
    fireEvent.change(confirmPasswordInput, { target: { value: 'different' } });

    // Submit the form directly
    const form = passwordInput.closest('form') as HTMLFormElement;
    if (form) {
      fireEvent.submit(form);
    }

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
    }, { timeout: 1000 });

    expect(screen.getByRole('alert')).toHaveTextContent('The passwords do not match.');
  });
});

describe('AuthPage - Error Handling', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseAuth.mockReturnValue(mockAuthContext);
  });

  it('should display initial error when provided', () => {
    const testError = 'Test error message';
    renderAuthPage('login', testError);

    expect(screen.getByRole('alert')).toHaveTextContent(testError);
  });
});