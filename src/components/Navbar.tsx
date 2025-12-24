import { NavLink } from '@mantine/core';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import {
  FaSignInAlt,
  FaSignOutAlt,
  FaFileAlt,
  FaBookOpen,
  FaUser,
} from 'react-icons/fa';


export function Navbar({ onLinkClick }: { onLinkClick?: () => void }) {
  const location = useLocation();
  const auth = useAuth();
  const navigate = useNavigate();
  const isActive = (path: string) => location.pathname === path;
  return (
    <>
      {/* Mostrar enlaces según el tipo de usuario */}
      {auth.isAuthenticated && auth.userType === 'ADMINISTRADOR' && (
        <>
          <NavLink
            label="Constancias"
            leftSection={<FaFileAlt size={16} />}
            component={Link}
            to="/constancias"
            active={isActive('/constancias')}
            onClick={() => onLinkClick?.()}
          />

          <NavLink
            label="Cursos"
            leftSection={<FaBookOpen size={14} />}
            component={Link}
            to="/cursos"
            active={isActive('/cursos')}
            onClick={() => onLinkClick?.()}
          />

          <NavLink
            label="Usuarios"
            leftSection={<FaUser size={14} />}
            component={Link}
            to="/usuarios"
            active={isActive('/usuarios')}
            onClick={() => onLinkClick?.()}
          />
        </>
      )}

      {auth.isAuthenticated && auth.userType === 'EMPRESA' && (
        <NavLink
          label="ConstanciasEmpresa"
          leftSection={<FaFileAlt size={16} />}
          component={Link}
          to="/constanciasEmpresa"
          active={isActive('/constanciasEmpresa')}
          onClick={() => onLinkClick?.()}
        />
      )}

      {!auth.isAuthenticated ? (
        <NavLink
          label="Login"
          leftSection={<FaSignInAlt size={16} />}
          component={Link}
          to="/login"
          active={isActive('/login')}
          onClick={() => onLinkClick?.()}
        />
      ) : (
        <NavLink
          label="Cerrar Sesión"
          leftSection={<FaSignOutAlt size={16} />}
          color="red"
          onClick={() => {
            auth.logout(() => navigate('/login'));
            onLinkClick?.();
          }}
        />
      )}
    </>
  );
}