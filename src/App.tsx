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

  // Si es ADMINISTRADOR -> constancias, si es EMPRESA -> constanciasEmpresa
  if (auth.userType === 'ADMINISTRADOR') return <Navigate to="/constancias" replace />;
  if (auth.userType === 'EMPRESA') return <Navigate to="/constanciasEmpresa" replace />;

  // fallback
  return <Navigate to="/constancias" replace />;
}

export default function App() {
  return (
    <Routes>

      <Route path="/login" element={<Login />} />

      <Route path="/validar/:id/:curp" element={<ValidarPage />} />

      <Route
        path="/"
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        <Route path="*" element={<div>Página no encontrada</div>} />
        <Route index element={<DefaultRedirect />} />
        <Route index path="constancias" element={<ConstanciasAdminPage />} />
        <Route path="cursos" element={<CursosPage />} />
        <Route path="empresas" element={<EmpresasPage />} />
        <Route path="constanciasEmpresa" element={<ConstanciasEmpresaPage />} />
        <Route path="usuarios" element={<UsuariosPage />} />


        {/* <Route path="dashboard" element={<DashboardPage />} /> */}
        {/* <Route path="profile" element={<ProfilePage />} /> */}
      </Route>
    </Routes>
  );
}