import React, { useMemo, useState, useEffect } from 'react';
import {
  Table,
  Select,
  Input,
  Button,
  Paper,
  Text,
  Group,
  Stack,
  SimpleGrid,
  
} from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';

export type Column<T> = {
  accessor: keyof T | string;
  label: string;
  render?: (row: T) => React.ReactNode;
  searchValue?: (row: T) => string;
};

type Props<T> = {
  columns: Column<T>[];
  data: T[];
  initialPageSize?: number;
  actions?: (row: T) => React.ReactNode;
  onAddClick?: () => void;
  addLabel?: string;
  addColor?: string;
};

export function ResponsiveDataTable<T>({
  columns,
  data,
  initialPageSize = 10,
  actions,
  onAddClick,
  addLabel = '+ Añadir',
  addColor = 'var(--olive-green, #88a04b)',
}: Props<T>) {
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(initialPageSize);
  // Convierte cualquier valor (primitivo, array, objeto) en una cadena
  // razonablemente utilizable para búsquedas.
  const valueToSearchable = (v: any): string => {
    if (v == null) return '';
    if (Array.isArray(v)) {
      const base = v.map(valueToSearchable).join(' ');
      return v.length > 1 ? `grupal ${base}` : base;
    }
    if (typeof v === 'object') return Object.values(v).map(valueToSearchable).join(' ');
    return String(v);
  };

  const filtered = useMemo(() => {
    if (!query) return data;
    const tokens = query
      .toLowerCase()
      .split(/\s+/)
      .filter(Boolean);
    return data.filter((row) =>
      columns.some((col) => {
        const key = col.accessor as keyof T;
        const value = col.searchValue ? col.searchValue(row) : (row as any)[key];
        if (value == null) return false;
        const hay = valueToSearchable(value).toLowerCase();
        return tokens.every((t) => hay.includes(t));
      }),
    );
  }, [data, query, columns]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));

  useEffect(() => {
    setPage(1);
  }, [query, pageSize]);

  const pageData = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, page, pageSize]);

  const isMobile = useMediaQuery('(max-width: 700px)');

  return (
    <Stack gap="md">

      {/* =====================================
          BARRA SUPERIOR (idéntica al screenshot)
      ===================================== */}
      <SimpleGrid
        cols={{ base: 1, sm: 2 }}
        spacing="sm"
        verticalSpacing="sm"
        style={{ width: '100%' }}
      >
        {/* 🔍 Buscar */}
        <Input
          placeholder="Buscar..."
          value={query}
          onChange={(e: any) => setQuery(e.currentTarget.value)}
          style={{ width: '100%' }}
        />


        {/* 🔽 Select + botón Añadir */}
        <Group justify="flex-end" gap={8}>
          <Select
            value={String(pageSize)}
            onChange={(v) => setPageSize(Number(v))}
            data={[
              { value: '5', label: '5 / página' },
              { value: '10', label: '10 / página' },
              { value: '20', label: '20 / página' },
              { value: '50', label: '50 / página' },
            ]}
            size="sm"
            style={{ width: 120 }}
          />

          {onAddClick && (
            <Button
              size="sm"
              style={{
                background: addColor,
                color: 'white',
                fontWeight: 600,
              }}
              onClick={onAddClick}
            >
              {addLabel}
            </Button>
          )}
        </Group>
      </SimpleGrid>

      {/* =============================
          PAGINACIÓN CENTRADA
      ============================= */}
      <Group justify="center" mt="xs" gap={16}>
        <Button
          variant="default"
          size="sm"
          onClick={() => setPage((p) => Math.max(1, p - 1))}
          disabled={page <= 1}
        >
          Anterior
        </Button>

        <Text fw={600}>
          {page} / {pageCount}
        </Text>

        <Button
          variant="default"
          size="sm"
          onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
          disabled={page >= pageCount}
        >
          Siguiente
        </Button>
      </Group>

      {/* 🔢 Contador — centrado */}
      <Group justify="left" align="right">
        <Text fw={600}>{filtered.length} Total(es)</Text>
      </Group>

      {/* =============================
          TABLA DESKTOP
      ============================= */}
      {!isMobile ? (
        <Table.ScrollContainer minWidth={700}>
          <Table striped highlightOnHover verticalSpacing="sm">
            <Table.Thead>
              <Table.Tr>
                {columns.map((col) => (
                  <Table.Th key={String(col.accessor)}>{col.label}</Table.Th>
                ))}
                {actions && <Table.Th>Acciones</Table.Th>}
              </Table.Tr>
            </Table.Thead>

            <Table.Tbody>
              {pageData.map((row, idx) => (
                <Table.Tr key={idx}>
                  {columns.map((col) => (
                    <Table.Td key={String(col.accessor)}>
                      {col.render
                        ? col.render(row)
                        : String((row as any)[col.accessor as any] ?? '')}
                    </Table.Td>
                  ))}
                  {actions && (
                    <Table.Td style={{ justifyContent: 'center' }}>
                      {actions(row)}
                    </Table.Td>
                  )}
                </Table.Tr>
              ))}

              {pageData.length === 0 && (
                <Table.Tr>
                  <Table.Td
                    colSpan={columns.length + (actions ? 1 : 0)}
                    style={{ textAlign: 'center', padding: 16 }}
                  >
                    No hay resultados
                  </Table.Td>
                </Table.Tr>
              )}
            </Table.Tbody>
          </Table>
        </Table.ScrollContainer>
      ) : (
        /* =============================
            MOBILE VERSION
        ============================= */
        <SimpleGrid cols={1} spacing="sm">
          {pageData.map((row, idx) => (
              <Paper key={idx} radius="md" shadow="sm" p="sm">
              {/* header: show company_name when user_type is EMPRESA, otherwise show name */}
              <Group justify="space-between" mb={8}>
                {(() => {
                  const headerValue = String((row as any)[columns[0].accessor as any] ?? '');
                  return (
                    <Text fw={700} component="div" style={{ fontSize: 16 }}>
                      {headerValue}
                    </Text>
                  );
                })()}
              </Group>

              <Stack gap={6} >
                {columns.slice(1).map((col) => {
                  const isCourseCol = String(col.accessor) === 'curso';
                  return (
                    <div key={String(col.accessor)} style={{ marginBottom: 8 }}>
                      <Text style={{ color: 'var(--gray-dark)', marginBottom: 4 }}>{col.label}:</Text>
                      <div style={isCourseCol ? { backgroundColor: 'var(--light-gray, #f5f5f5)', padding: 8, borderRadius: 6 } : {}}>
                        {col.render
                          ? col.render(row)
                          : <Text component="div">{String((row as any)[col.accessor as any] ?? '')}</Text>}
                      </div>
                    </div>
                  );
                })}

                {actions && (
                  <Group gap={8} mt={8} justify="center">
                    {actions(row)}
                  </Group>
                )}
              </Stack>
            </Paper>
          ))}

          {pageData.length === 0 && (
            <Text ta="center">No hay resultados</Text>
          )}
        </SimpleGrid>
      )}
    </Stack>
  );
}
