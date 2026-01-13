import { AppShell, Burger, Group, Loader, Text } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { Outlet } from 'react-router-dom';
import { Navbar } from './Navbar';
import { useGlobalLoading } from '../core/loading';
import { useState, useEffect } from 'react';
import { FaBuilding, FaUserShield } from 'react-icons/fa';

export function AppLayout() {
  const [opened, { toggle, close }] = useDisclosure();
  const loading = useGlobalLoading();
  const [userName, setUserName] = useState<string>('');
  const [userType, setUserType] = useState<string>('');

  useEffect(() => {
    // Obtener nombre de usuario desde localStorage
    const storedName = localStorage.getItem('mi_app_user_name');
    if (storedName) {
      setUserName(storedName);
    }

    // Obtener tipo de usuario desde localStorage
    const storedType = localStorage.getItem('mi_app_user_type');
    if (storedType) {
      setUserType(storedType);
    }

    // Escuchar cambios en el storage (por si se actualiza en otra pestaña o al hacer login)
    const handleStorageChange = () => {
      const updatedName = localStorage.getItem('mi_app_user_name');
      const updatedType = localStorage.getItem('mi_app_user_type');
      setUserName(updatedName || '');
      setUserType(updatedType || '');
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  return (
    <AppShell
      header={{ height: 60 }}
      navbar={{ width: 300, breakpoint: 'sm', collapsed: { mobile: !opened } }}
      padding="md"
    >
      <AppShell.Header>
        <Group h="100%" px="md">
          <Burger
            opened={opened}
            onClick={toggle}
            hiddenFrom="sm"
            size="sm"
          />
          <img
            src="logo.png"
            alt="DoGroup"
            style={{ height: 50, width: 'auto' }}
          />
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 16 }}>
            {userName && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, backgroundColor: '#f1f3f5', padding: '6px 12px', borderRadius: 8 }}>
                {userType === 'ADMINISTRADOR' ? (
                  <FaUserShield size={18} color="#495057" />
                ) : (
                  <FaBuilding size={18} color="#495057" />
                )}
                <Text size="md" weight={600} color="#495057">
                  {userName}
                </Text>
              </div>
            )}
            {loading && <Loader size="sm" />}
          </div>
        </Group>
      </AppShell.Header>

      <AppShell.Navbar p="md" w="250px">
        <Navbar onLinkClick={close} />
      </AppShell.Navbar>
      <AppShell.Main>
        <Outlet />
      </AppShell.Main>
    </AppShell>
  );
}