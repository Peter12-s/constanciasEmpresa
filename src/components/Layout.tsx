import { AppShell, Burger, Group, Loader } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { Outlet } from 'react-router-dom';
import { Navbar } from './Navbar';
import { useGlobalLoading } from '../core/loading';

export function AppLayout() {
  const [opened, { toggle, close }] = useDisclosure();
  const loading = useGlobalLoading();

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
            src="/logo.png"
            alt="DoGroup"
            style={{ height: 50, width: 'auto' }}
          />
          <div style={{ marginLeft: 'auto' }}>
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