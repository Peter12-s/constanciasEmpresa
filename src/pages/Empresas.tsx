import { useMemo, useState } from 'react';
import { Container, Title, Modal, TextInput, Button, ScrollArea } from '@mantine/core';
import { useForm } from '@mantine/form';
import { showNotification } from '@mantine/notifications';
import { ResponsiveDataTable, type Column } from '../components/ResponsiveDataTable';

type Empresa = {
  id: number;
  nombre: string;
  rfc?: string;
  contacto?: string;
};

const sampleEmpresas: Empresa[] = Array.from({ length: 18 }).map((_, i) => ({
  id: i + 1,
  nombre: `Empresa ${i + 1}`,
  rfc: `RFC${String(i + 1).padStart(4, '0')}`,
  contacto: `contacto${i + 1}@empresa.com`,
}));

export function EmpresasPage() {
  const [empresas, setEmpresas] = useState<Empresa[]>(sampleEmpresas);
  const [openAdd, setOpenAdd] = useState(false);
  const [openEdit, setOpenEdit] = useState(false);
  const [editing, setEditing] = useState<Empresa | null>(null);

  const form = useForm({ initialValues: { nombre: '', rfc: '', contacto: '' } });

  const columns: Column<Empresa>[] = [
    { accessor: 'id', label: 'ID' },
    { accessor: 'nombre', label: 'Empresa' },
    { accessor: 'rfc', label: 'RFC' },
    { accessor: 'contacto', label: 'Contacto' },
  ];

  const onAdd = (values: typeof form.values) => {
    const next = Math.max(0, ...empresas.map((e) => e.id)) + 1;
    const newE: Empresa = { id: next, nombre: values.nombre, rfc: values.rfc, contacto: values.contacto };
    setEmpresas((s) => [newE, ...s]);
    showNotification({ title: 'Añadida', message: 'Empresa agregada', color: 'green' });
    setOpenAdd(false);
    form.reset();
  };

  const onEdit = (row: Empresa) => {
    setEditing(row);
    form.setValues({ nombre: row.nombre, rfc: row.rfc || '', contacto: row.contacto || '' });
    setOpenEdit(true);
  };

  const onSaveEdit = (values: typeof form.values) => {
    if (!editing) return;
    setEmpresas((s) => s.map((e) => (e.id === editing.id ? { ...e, ...values } : e)));
    showNotification({ title: 'Guardado', message: 'Empresa actualizada', color: 'green' });
    setOpenEdit(false);
    setEditing(null);
    form.reset();
  };

  const onDelete = (row: Empresa) => {
    setEmpresas((s) => s.filter((e) => e.id !== row.id));
    showNotification({ title: 'Eliminada', message: 'Empresa eliminada', color: 'red' });
  };

  // optional: simple search + page controls
  const [search, _setSearch] = useState('');
  const [page, _setPage] = useState(1);
  const [pageSize, _setPageSize] = useState(10);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return empresas;
    return empresas.filter((e) => e.nombre.toLowerCase().includes(q) || (e.rfc || '').toLowerCase().includes(q));
  }, [empresas, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const pageSlice = filtered.slice((page - 1) * pageSize, page * pageSize);

  return (
    <Container size="md" style={{ paddingTop: 12 }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <Title order={2}>Empresas</Title>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <Button onClick={() => setOpenAdd(true)} style={{ background: 'var(--olive-green)', color: 'white' }}>+ Añadir Empresa</Button>
        </div>
      </header>

      <ResponsiveDataTable
        columns={columns}
        data={pageSlice}
        initialPageSize={pageSize}
        actions={(row: any) => (
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => onEdit(row)} style={{ background: 'var(--olive-green)', color: 'white', padding: '6px 10px', borderRadius: 6, border: 'none' }}>Editar</button>
            <button onClick={() => onDelete(row)} style={{ background: '#F44336', color: 'white', padding: '6px 10px', borderRadius: 6, border: 'none' }}>Eliminar</button>
          </div>
        )}
      />



      <Modal
        opened={openAdd}
        onClose={() => setOpenAdd(false)}
        title="Añadir empresa"
        centered
        withinPortal
        zIndex={9999}
        yOffset="5vh"
        scrollAreaComponent={ScrollArea.Autosize} // contenido con scroll
      >        <form onSubmit={(e) => { e.preventDefault(); onAdd(form.values); }}>
          <TextInput label="Nombre" required {...form.getInputProps('nombre' as any)} />
          <TextInput label="RFC" mt="sm" {...form.getInputProps('rfc' as any)} />
          <TextInput label="Contacto" mt="sm" {...form.getInputProps('contacto' as any)} />
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12 }}>
            <Button type="submit" style={{ background: 'var(--olive-green)', color: 'white' }}>Guardar</Button>
          </div>
        </form>
      </Modal>

      <Modal opened={openEdit} onClose={() => setOpenEdit(false)} title="Editar empresa" >
        <form onSubmit={(e) => { e.preventDefault(); onSaveEdit(form.values); }}>
          <TextInput label="Nombre" required {...form.getInputProps('nombre' as any)} />
          <TextInput label="RFC" mt="sm" {...form.getInputProps('rfc' as any)} />
          <TextInput label="Contacto" mt="sm" {...form.getInputProps('contacto' as any)} />
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12 }}>
            <Button type="submit" style={{ background: 'var(--olive-green)', color: 'white' }}>Guardar cambios</Button>
          </div>
        </form>
      </Modal>
    </Container>
  );
}
