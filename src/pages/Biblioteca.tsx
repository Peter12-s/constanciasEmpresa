import { useState, useEffect, useMemo } from 'react';
import {
  Title,
  Container,
  TextInput,
  Button,
  Modal,
  FileInput,
  Group,
  Text,
  Table,
  Pagination,
  Card,
  Stack,
  Badge,
} from '@mantine/core';
import { FaUpload, FaSearch, FaDownload, FaExternalLinkAlt } from 'react-icons/fa';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import { showNotification } from '@mantine/notifications';
import { BasicPetition } from '../core/petition';
import appConfig from '../core/constants/appConfig';

interface Capacitador {
  id: string;
  nombre: string;
  correo: string;
  telefono: string;
  stps: string;
}

interface Curso {
  id: string;
  titulo: string;
  duracion: string;
  trainerCourseId: string;
  content_file?: string | null;
  syllabus_file?: string | null;
  assessment_file?: string | null;
  link?: string | null;
}

interface TableRow {
  capacitador: string;
  curso: string;
  duracion: string;
  course: Curso;
}

export function BibliotecaPage() {
  const [capacitadores, setCapacitadores] = useState<Capacitador[]>([]);
  const [coursesMap, setCoursesMap] = useState<Record<string, Curso[]>>({});
  const [search, setSearch] = useState('');
  const [searchCourse, setSearchCourse] = useState('');
  const [loading, setLoading] = useState(true);
  const [modalOpened, setModalOpened] = useState(false);
  const [selectedCourse, setSelectedCourse] = useState<Curso | null>(null);
  const [temarioFile, setTemarioFile] = useState<File | null>(null);
  const [examenFile, setExamenFile] = useState<File | null>(null);
  const [contenidoFile, setContenidoFile] = useState<File | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;

  useEffect(() => {
    const fetchTrainers = async () => {
      try {
        const list = await BasicPetition<any[]>({ endpoint: '/trainer', method: 'GET', showNotifications: false });
        if (!Array.isArray(list)) {
          setCapacitadores([]);
          setCoursesMap({});
          return;
        }

        const caps: Capacitador[] = [];
        const cmap: Record<string, Curso[]> = {};

        for (const t of list) {
          const tid = String(t._id ?? t.id ?? '');
          const person = t.certificate_person ?? t.certificate_person_id ?? {};
          const nameParts = [person.name, person.f_surname, person.s_surname].filter(Boolean);
          const nombre = nameParts.length ? nameParts.join(' ') : (t.name ?? '');
          const correo = person.email ?? t.email ?? '';
          const telefono = person.phone ?? t.phone ?? '';
          const stps = t.stps ?? '';

          caps.push({ id: tid, nombre, correo, telefono, stps });

          const trainerCourses = Array.isArray(t.trainer_courses) ? t.trainer_courses : [];
          cmap[tid] = trainerCourses.map((tc: any) => {
            const course = tc.course ?? tc.course_id ?? {};
            const cid = String(course._id ?? course.id ?? tc.course_id ?? '');
            const name = course.name ?? course.titulo ?? '';
            const durationVal = course.duration ?? course.duracion ?? '';
            const durStr = typeof durationVal === 'number' ? `${durationVal}h` : String(durationVal || '');
            const trainerCourseId = String(tc._id ?? tc.id ?? '');
            return {
              id: cid,
              titulo: name,
              duracion: durStr,
              trainerCourseId,
              content_file: course.content_file ?? course.contentFile ?? null,
              syllabus_file: course.syllabus_file ?? course.syllabusFile ?? null,
              assessment_file: course.assessment_file ?? course.assessmentFile ?? null,
              link: course.link ?? null,
            } as Curso;
          });
        }

        setCapacitadores(caps);
        setCoursesMap(cmap);
      } catch (e) {
        setCapacitadores([]);
        setCoursesMap({});
      } finally {
        setLoading(false);
      }
    };
    fetchTrainers();
  }, []);

  const tableRows = useMemo(() => {
    const rows: TableRow[] = [];
    capacitadores.forEach(cap => {
      coursesMap[cap.id]?.forEach(curso => {
        rows.push({
          capacitador: cap.nombre,
          curso: curso.titulo,
          duracion: curso.duracion,
          course: curso,
        });
      });
    });
    return rows.filter(row =>
      row.capacitador.toLowerCase().includes(search.toLowerCase()) &&
      row.curso.toLowerCase().includes(searchCourse.toLowerCase())
    );
  }, [capacitadores, coursesMap, search, searchCourse]);

  const totalPages = Math.ceil(tableRows.length / itemsPerPage);
  const paginatedRows = tableRows.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const closeModal = () => {
    setModalOpened(false);
    setSelectedCourse(null);
    setTemarioFile(null);
    setExamenFile(null);
    setContenidoFile(null);
  };

  const sanitizeFilename = (value: string) => value.replace(/[<>:"/\\|?*\x00-\x1F]/g, '').trim() || 'curso';

  const parseFilenameFromContentDisposition = (header: string | null) => {
    if (!header) return null;
    const match = /filename\*?=(?:UTF-8''|"?)([^";\n]+)/i.exec(header);
    if (!match) return null;
    let filename = match[1].trim();
    if (filename.startsWith('"') && filename.endsWith('"')) {
      filename = filename.slice(1, -1);
    }
    try {
      return decodeURIComponent(filename);
    } catch {
      return filename;
    }
  };

  const getExtensionFromContentType = (contentType: string | null) => {
    if (!contentType) return 'bin';
    const lower = contentType.toLowerCase();
    if (lower.includes('pdf')) return 'pdf';
    if (lower.includes('word') || lower.includes('msword')) return 'docx';
    if (lower.includes('zip')) return 'zip';
    if (lower.includes('text/plain')) return 'txt';
    if (lower.includes('png')) return 'png';
    if (lower.includes('jpeg') || lower.includes('jpg')) return 'jpg';
    return 'bin';
  };

  const detectExtensionFromBlob = async (blob: Blob) => {
    const header = await blob.slice(0, 8).arrayBuffer();
    const bytes = new Uint8Array(header);
    if (bytes.length >= 4 && bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46) {
      return 'pdf';
    }
    if (bytes.length >= 4 && bytes[0] === 0x50 && bytes[1] === 0x4B && bytes[2] === 0x03 && bytes[3] === 0x04) {
      return 'zip';
    }
    if (bytes.length >= 3 && bytes[0] === 0xFF && bytes[1] === 0xD8 && bytes[2] === 0xFF) {
      return 'jpg';
    }
    if (bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4E && bytes[3] === 0x47) {
      return 'png';
    }
    return 'bin';
  };

  const fetchDriveFileBlob = async (fileId: string) => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('mi_app_token') : null;
    const headers: Record<string, string> = {};
    if (token) headers.Authorization = `Bearer ${token}`;
    const response = await fetch(`${appConfig.BACKEND_URL}/google/proxy-drive?id=${encodeURIComponent(fileId)}`, { headers });
    if (!response.ok) {
      throw new Error(`No se pudo descargar el archivo ${fileId}`);
    }
    const blob = await response.blob();
    return {
      blob,
      contentType: response.headers.get('content-type'),
      filename: parseFilenameFromContentDisposition(response.headers.get('content-disposition')),
    };
  };

  const downloadCourseFilesZip = async (course: Curso) => {
    const zip = new JSZip();
    const rootName = sanitizeFilename(course.titulo || `curso-${course.id}`);
    const rootFolder = zip.folder(rootName) ?? zip;
    const contentFolder = rootFolder.folder('Contenido');
    const evaluationFolder = rootFolder.folder('Evaluacion');
    const syllabusFolder = rootFolder.folder('Temario');

    const fileEntries = [
      { id: course.content_file, folder: contentFolder, name: 'contenido' },
      { id: course.assessment_file, folder: evaluationFolder, name: 'evaluacion' },
      { id: course.syllabus_file, folder: syllabusFolder, name: 'temario' },
    ];

    const downloadPromises = fileEntries.map(async ({ id, folder, name }) => {
      if (!id || !folder) return;
      try {
        const { blob, contentType, filename } = await fetchDriveFileBlob(id);
        let extension = getExtensionFromContentType(contentType);
        if (extension === 'bin') {
          extension = await detectExtensionFromBlob(blob);
        }
        let fileName = filename ? sanitizeFilename(filename) : `${name}.${extension}`;
        if (!fileName.includes('.') && extension) {
          fileName = `${fileName}.${extension}`;
        }
        folder.file(fileName, blob);
      } catch (err: any) {
        console.warn('Error descargando archivo', name, err);
      }
    });

    await Promise.all(downloadPromises);

    try {
      const zipBlob = await zip.generateAsync({ type: 'blob' });
      saveAs(zipBlob, `${rootName}.zip`);
      showNotification({ title: 'Descarga iniciada', message: `Se descargará ${rootName}.zip`, color: 'green' });
    } catch (err: any) {
      showNotification({ title: 'Error', message: 'No se pudo generar el ZIP', color: 'red' });
    }
  };

  const handleUpload = () => {
    // Aquí implementar la lógica para subir los archivos
    // Por ejemplo, POST a una API con FormData
    console.log('Subiendo archivos para curso:', selectedCourse?.titulo);
    console.log('Temario:', temarioFile);
    console.log('Examen:', examenFile);
    console.log('Contenido:', contenidoFile);
    // Cerrar modal después
    closeModal();
  };

  if (loading) {
    return (
      <Container>
        <Title order={2}>Biblioteca</Title>
        <Text>Cargando capacitadores...</Text>
      </Container>
    );
  }

  return (
    <Container size="xl">
      <Title order={2} mb="lg">Biblioteca</Title>
      <Group mb="md">
        <TextInput
          placeholder="Buscar por capacitador..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          leftSection={<FaSearch size={16} />}
          style={{ flex: 1 }}
        />
        <TextInput
          placeholder="Buscar por curso..."
          value={searchCourse}
          onChange={(e) => setSearchCourse(e.target.value)}
          leftSection={<FaSearch size={16} />}
          style={{ flex: 1 }}
        />
      </Group>
      <Table striped highlightOnHover withTableBorder>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Capacitador</Table.Th>
            <Table.Th>Curso</Table.Th>
            <Table.Th>Duración</Table.Th>
            <Table.Th>Descargar archivos</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {paginatedRows.map((row, index) => (
            <Table.Tr key={`${row.capacitador}-${row.curso}-${index}`}>
              <Table.Td>{row.capacitador}</Table.Td>
              <Table.Td>{row.curso}</Table.Td>
              <Table.Td>
                <Badge color="blue" variant="light">
                  {row.duracion}
                </Badge>
              </Table.Td>
              <Table.Td>
                <Group gap="xs">
                  {(() => {
                    const hasFiles = !!(row.course.content_file || row.course.syllabus_file || row.course.assessment_file);
                    return (
                      <Button
                        leftSection={<FaDownload size={14} />}
                        onClick={() => downloadCourseFilesZip(row.course)}
                        size="sm"
                        variant="filled"
                        disabled={!hasFiles}
                        title={!hasFiles ? 'No tiene ningún archivo cargado' : ''}
                      >
                        {hasFiles ? 'Descargar ZIP' : 'Sin archivos'}
                      </Button>
                    );
                  })()}
                  {row.course.link && (
                    <Button
                      leftSection={<FaExternalLinkAlt size={14} />}
                      onClick={() => window.open(row.course.link!, '_blank')}
                      size="sm"
                      variant="outline"
                      title="Abrir link en nueva pestaña"
                    />
                  )}
                </Group>
              </Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
      {totalPages > 1 && (
        <Group justify="center" mt="md">
          <Pagination
            total={totalPages}
            value={currentPage}
            onChange={setCurrentPage}
            size="sm"
          />
        
        </Group>
      )}

      <Modal
        opened={modalOpened}
        onClose={closeModal}
        title={
          <Group>
            <FaUpload size={20} />
            <Text fw={500}>Subir archivos para {selectedCourse?.titulo}</Text>
          </Group>
        }
        size="lg"
        centered
      >
        <Card withBorder shadow="sm" p="md">
          <Stack>
            <FileInput
              label="Temario"
              placeholder="Seleccionar archivo PDF "
              value={temarioFile}
              onChange={setTemarioFile}
              accept=".pdf,.doc,.docx"
              leftSection={<FaUpload size={14} />}
            />
            <FileInput
              label="Examen(Evalución)"
              placeholder="Seleccionar archivo PDF "
              value={examenFile}
              onChange={setExamenFile}
              accept=".pdf,.doc,.docx"
              leftSection={<FaUpload size={14} />}
            />
            <FileInput
              label="Contenido"
              placeholder="Seleccionar archivo PDF "
              value={contenidoFile}
              onChange={setContenidoFile}
              accept=".pdf,.doc,.docx,.zip"
              leftSection={<FaUpload size={14} />}
            />
          </Stack>
        </Card>
        <Group justify="flex-end" mt="md">
          <Button onClick={closeModal} variant="outline">
            Cancelar
          </Button>
          <Button onClick={handleUpload} leftSection={<FaUpload size={14} />}>
            Subir Archivos
          </Button>
        </Group>
      </Modal>
    </Container>
  );
}