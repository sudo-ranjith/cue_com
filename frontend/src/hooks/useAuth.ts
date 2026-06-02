import { useAuthStore } from '../store/authStore';
import { authApi } from '../api/auth';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';

export function useAuth() {
  const { user, token, isAuthenticated, login, logout, setUser } = useAuthStore();
  const navigate = useNavigate();

  const handleLogin = async (email: string, password: string) => {
    const response = await authApi.login(email, password);
    login(response.access_token, response.refresh_token, response.user);
    navigate('/admin/dashboard');
  };

  const handleLogout = async () => {
    try {
      await authApi.logout();
    } catch {
      // ignore errors on logout
    } finally {
      logout();
      navigate('/login');
      toast.success('Logged out successfully');
    }
  };

  return {
    user,
    token,
    isAuthenticated,
    login: handleLogin,
    logout: handleLogout,
    setUser,
  };
}
