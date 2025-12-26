import { Routes, Route, Navigate } from 'react-router-dom';
import { ProtectedRoute } from './components/ProtectedRoutes';
import { AppLayout } from './components/Layout';
import { ConstanciasAdminPage } from './pages/Constancias';
import { CursosPage } from './pages/Cursos';
import { EmpresasPage } from './pages/Empresas';
import { ConstanciasEmpresaPage } from './pages/ConstanciasEmpresa';
import ValidarPage from './pages/Validar';
import { UsuariosPage } from './pages/Usuarios';
import { Login } from './pages/Login';
import { useAuth } from './AuthContext';

function DefaultRedirect() {
  const auth = useAuth();

  if (auth.userType === 'ADMINISTRADOR') {
    return <Navigate to="/constancias" replace />;
  }

  if (auth.userType === 'EMPRESA') {
    return <Navigate to="/constanciasEmpresa" replace />;
  }

  return <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <Routes>
      {/* Públicas */}
      <Route path="/login" element={<Login />} />
      <Route path="/validar/:id/:curp" element={<ValidarPage />} />

      {/* Protegidas */}
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        {/* 👇 RUTA POR DEFECTO */}
        <Route index element={<DefaultRedirect />} />

        {/* 👇 RUTAS REALES */}
        <Route path="constancias" element={<ConstanciasAdminPage />} />
        <Route path="cursos" element={<CursosPage />} />
        <Route path="empresas" element={<EmpresasPage />} />
        <Route path="constanciasEmpresa" element={<ConstanciasEmpresaPage />} />
        <Route path="usuarios" element={<UsuariosPage />} />

        {/* 👇 404 */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
