import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import {
  TextInput,
  PasswordInput,
  Button,
  Paper,
  Title,
  Container,
  LoadingOverlay,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { BasicPetition } from '../core/petition';
import { showNotification } from '@mantine/notifications';

export function Login() {
  const navigate = useNavigate();
  const auth = useAuth();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (auth.isAuthenticated) {
      navigate('/', { replace: true });
    }
  }, [auth.isAuthenticated, navigate]);

  const form = useForm({
    mode: 'uncontrolled',
    initialValues: {
      username: '',
      password: '',
    },
  });

  const handleSubmit = async (values: typeof form.values) => {
    setLoading(true);
    try {
      // Disable automatic notifications here and show a custom welcome message
      const login: any = await BasicPetition({ endpoint: '/certificate-auth/login', method: 'POST', data: values, showNotifications: false });
      if (login.access_token) {
        // Build display name from several possible response shapes
        let displayName = '';
        const fullNameObj = login?.full_name ?? login?.fullName ?? null;
        if (fullNameObj) {
          if (typeof fullNameObj === 'object') {
            const parts = [fullNameObj.name, fullNameObj.f_surname, fullNameObj.s_surname].filter(Boolean).map(String);
            displayName = parts.join(' ');
          } else {
            displayName = String(fullNameObj);
          }
        }
        if (!displayName) displayName = login?.user_fullname ?? login?.user?.fullname ?? login?.user?.name ?? login?.fullname ?? login?.name ?? login?.company_name ?? '';

        auth.login(login.access_token, () => {
          // show personalized welcome notification
          const message = displayName ? `Bienvenido ${displayName}` : 'Bienvenido';
          showNotification({ title: 'Éxito', message, color: 'green' });
          navigate('/', { replace: true });
        }, login.user_type);
      }
    } catch (err: any) {
      setLoading(false);
    }
  };

  if (auth.isAuthenticated) {
    return <LoadingOverlay visible={true} />;
  }

  return (
    <Container size={800} my={40} className="login-container">
      <Title ta="center"></Title>

      <Paper withBorder shadow="md" p={30} mt={30} radius="md" pos="relative" className="login-box">
        <LoadingOverlay visible={loading} />

        <form onSubmit={form.onSubmit(handleSubmit)}>
          <img src="/logo.png" alt="DO-GROUP Logo" className="logo login-form-logo" />
          <TextInput
            label="Email"
            placeholder="correo@email.com"
            required
            {...form.getInputProps('username')}
          />
          <PasswordInput
            label="Contraseña"
            placeholder="Tu contraseña"
            id='password'
            required
            mt="md"
            {...form.getInputProps('password')}
          />

          <Button fullWidth mt="xl" type="submit" >
            Iniciar Sesión
          </Button>
        </form>
      </Paper>
    </Container>
  );
}