import { useEffect, useState } from 'react';
import {
  Container,
  Title,
  Button,
  Text,
  Modal,
  TextInput,
  PasswordInput,
  Select,
  Group,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { ResponsiveDataTable, type Column } from '../components/ResponsiveDataTable';
import { ConfirmModal } from '../components/ConfirmModal';
import { BasicPetition } from '../core/petition';
import { showNotification } from '@mantine/notifications';


type User = {
  _id: string;
  name: string;
  f_surname?: string | null;
  s_surname?: string | null;
  company_name?: string | null;
  rfc?: string | null;
  user_type: 'EMPRESA' | 'USUARIO' | string;
  email?: string | null;
  phone?: string | null;
};

export function UsuariosPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [addHover, setAddHover] = useState<boolean>(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState<boolean>(false);
  const [submitHover, setSubmitHover] = useState<boolean>(false);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

  const handleDeleteClick = (_id: string) => {
    setSelectedUserId(_id ?? null);
    setDeleteModalOpen(true);
  };


  async function getData() {
    const data: User[] = await BasicPetition({ endpoint: '/certificate-user', method: 'GET', showNotifications: false });
    setUsers(data);
  }

  useEffect(() => {
    getData();
  }, [])


  const handleConfirmDelete = () => {
    (async () => {
      try {
        const deleted = await BasicPetition({
          endpoint: '/certificate-user',
          method: 'DELETE',
          id: String(selectedUserId),
          showNotifications: false,
        });

        if (deleted) {
          setUsers((prev) => prev.filter((u) => String((u as any)._id) !== String(selectedUserId)));
          showNotification({
            title: 'Éxito',
            message: 'Usuario eliminado correctamente',
            color: 'green',
          });
        }
      } catch (err: any) {
        // Verificar si el error es por foreign key constraint
        const errorMessage = err?.data?.message || err?.message || '';
        const isForeignKeyError = errorMessage.toLowerCase().includes('foreign key') || 
                                   errorMessage.toLowerCase().includes('constraint') ||
                                   errorMessage.toLowerCase().includes('certificates');
        
        if (isForeignKeyError) {
          showNotification({
            title: 'No se puede eliminar',
            message: 'Este usuario tiene certificados pendientes. Revisa los certificados asociados antes de eliminar.',
            color: 'yellow',
          });
        } else {
          showNotification({
            title: 'Error',
            message: errorMessage || 'No se pudo eliminar el usuario',
            color: 'red',
          });
        }
      } finally {
        setDeleteModalOpen(false);
      }
    })();
  };

  const [opened, setOpened] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);

  const form = useForm({
    initialValues: {
      name: '',
      f_surname: '',
      s_surname: '',
      company_name: '',
  rfc: '',
      user_type: '',
      email: '',
      phone: '',
      password: '',
    },
    validate: {
      name: (value, values) => (values.user_type !== 'EMPRESA' && (!value || value.length === 0) ? 'Nombre obligatorio' : null),
      company_name: (value, values) => (values.user_type === 'EMPRESA' && (!value || value.length === 0) ? 'Empresa obligatoria' : null),
  rfc: (value, values) => (values.user_type === 'EMPRESA' && (!value || value.length === 0) ? 'RFC obligatorio para empresa' : null),
      email: (value) => (value ? (/^\S+@\S+\.\S+$/.test(value) ? null : 'Correo inválido') : null),
      password: (value, values) => {
        // Solo validar contraseña si no estamos editando o si se ingresó algo
        if (editingUser && (!value || value.length === 0)) return null;
        if (!editingUser && (!value || value.length === 0)) return 'Contraseña obligatoria';
        if (value.length > 0 && value.length < 6) return 'La contraseña debe tener al menos 6 caracteres';
        return null;
      },
    },
  });

  const columns: Column<User>[] = [
    {
      accessor: 'name',
      label: 'Nombre',
      render: (row) => (row.user_type === 'EMPRESA' ? (row.company_name ?? row.name ?? '') : `${row.name ?? ''} ${row.f_surname ?? ''} ${row.s_surname ?? ''}`.trim()),
    },
    { accessor: 'user_type', label: 'Tipo' },
    { accessor: 'email', label: 'Correo' },
  ];

  const handleSubmit = () => {
    const values = form.values;

    if (editingUser) {
      (async () => {
        const id = editingUser._id;
        // Si estamos editando, solo enviar password si no está vacío
        const dataToSend: any = { ...values };
        if (!dataToSend.password || dataToSend.password.length === 0) {
          delete dataToSend.password;
        }
        const res: any = await BasicPetition({ endpoint: '/certificate-user', method: 'PATCH', id, data: dataToSend });
        // Actualizar solo el usuario con el ID correspondiente
        setUsers((prev) => prev.map((u) => (u._id === id ? { ...u, ...res } : u)));
        // Refrescar datos del servidor para asegurar consistencia
        await getData();
      })();
    } else {
      (async () => {
        const created: any = await BasicPetition({ endpoint: '/certificate-user', method: 'POST', data: values });
        setUsers((prev) => [...prev, created]);
        // Refrescar datos del servidor para asegurar consistencia
        await getData();
      })();
    }

    setOpened(false);
    setEditingUser(null);
    form.reset();
  };

  const handleEdit = (user: User) => {
    setEditingUser(user);
    form.setValues({
      name: user.name ?? '',
      f_surname: (user as any).f_surname ?? '',
      s_surname: (user as any).s_surname ?? '',
      company_name: user.company_name ?? '',
      rfc: (user as any).rfc ?? '',
      user_type: user.user_type,
      email: user.email ?? '',
      phone: user.phone ?? '',
      password: '',
    });
    setOpened(true);
  };

  return (
    <Container size="lg" py="lg">
      <Title order={2}>Usuarios</Title>
      <Text color="dimmed" mb="md">Aquí puedes agregar, editar o eliminar usuarios.</Text>
      <div
        style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}
        onMouseEnter={() => setAddHover(true)}
        onMouseLeave={() => setAddHover(false)}
      >
        <Button
          onClick={() => setOpened(true)}
          style={{
            backgroundColor: 'var(--olive-green)',
            color: 'white',
            transition: 'filter 120ms ease, transform 120ms ease',
            filter: addHover ? 'brightness(0.9)' : 'none'
          }}
        >
          + Añadir Usuario
        </Button>
      </div>

      <ResponsiveDataTable
        columns={columns}
        data={users}
        initialPageSize={10}
        actions={(row) => (
          <Group justify="center">
            <Button size="xs" color="blue" onClick={() => handleEdit(row)}>
              Editar
            </Button>
            <Button
              size="xs"
              color="red"
              onClick={() => handleDeleteClick((row as any)._id ?? (row as any).id)}
            >
              Eliminar
            </Button>
          </Group>
        )}
      />

      <Modal
        opened={opened}
        onClose={() => { setOpened(false); setEditingUser(null); form.reset(); }}
        title={editingUser ? 'Editar Usuario' : 'Nuevo Usuario'}
        centered
        size="lg"
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSubmit();
          }}
        >
          <Select
            label="Tipo de usuario"
            data={[
              { value: 'EMPRESA', label: 'Empresa' },
              { value: 'ADMINISTRADOR', label: 'Administrador' },
            ]}
            {...form.getInputProps('user_type')}
            mb="sm"
          />

          {form.values.user_type === 'EMPRESA' ? (
            <>
              <TextInput
                label="Nombre de la empresa"
                placeholder="Ingrese un nombre"
                value={form.values.company_name}
                onChange={(e) => form.setFieldValue('company_name', String(e.currentTarget.value ?? '').toUpperCase())}
                mb="sm"
              />
              <TextInput
                label="RFC"
                placeholder="Ingrese RFC"
                value={form.values.rfc}
                onChange={(e) => form.setFieldValue('rfc', String(e.currentTarget.value ?? '').toUpperCase())}
                mb="sm"
              />
            </>
          ) : (
            <>
              <TextInput
                label="Nombre"
                placeholder="Nombre"
                value={form.values.name}
                onChange={(e) => form.setFieldValue('name', String(e.currentTarget.value ?? '').toUpperCase())}
                mb="sm"
              />
              <TextInput
                label="Apellido paterno"
                placeholder="Ingrese un appelido paterno"
                value={form.values.f_surname}
                onChange={(e) => form.setFieldValue('f_surname', String(e.currentTarget.value ?? '').toUpperCase())}
                mb="sm"
              />
              <TextInput
                label="Apellido materno"
                placeholder="Ingrese un appelido materno"
                value={form.values.s_surname}
                onChange={(e) => form.setFieldValue('s_surname', String(e.currentTarget.value ?? '').toUpperCase())}
                mb="sm"
              />
            </>
          )}

          <TextInput label="Correo" placeholder="correo@ejemplo.com" {...form.getInputProps('email')} mb="sm" />
          <TextInput
            label="Teléfono"
            placeholder="Ingrese un teléfono"
            value={form.values.phone}
            onChange={(e) => form.setFieldValue('phone', String(e.currentTarget.value ?? '').toUpperCase())}
            mb="sm"
          />
          <PasswordInput 
            label={editingUser ? "Contraseña (dejar vacío para no cambiar)" : "Contraseña"} 
            placeholder={editingUser ? "Dejar vacío para mantener la actual" : "Ingrese una contraseña"} 
            {...form.getInputProps('password')} 
            mb="sm" 
          />

          <Group
            justify="flex-end"
            mt={16}
            onMouseEnter={() => setSubmitHover(true)}
            onMouseLeave={() => setSubmitHover(false)}
          >
            <Button
              type="submit"
              style={{
                backgroundColor: 'var(--olive-green)',
                color: 'white',
                transition: 'filter 120ms ease, transform 120ms ease',
                filter: submitHover ? 'brightness(0.9)' : 'none',
              }}
            >
              {editingUser ? 'Guardar cambios' : 'Agregar Usuario'}
            </Button>
          </Group>
        </form>

      </Modal>
      <ConfirmModal
        opened={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        onConfirm={handleConfirmDelete}
        title="Eliminar usuario"
        message="¿Estás seguro de eliminar este usuario?"
      />

    </Container>


  );
}

export default UsuariosPage;
