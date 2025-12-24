import { useMemo, useState, useEffect } from "react";
import {
  Container,
  Title,
  Modal,
  TextInput,
  FileInput,
  Button,
  Text,
  Select,
  Paper,
  Group,
  Box,
  Divider,
} from "@mantine/core";
import { useForm } from "@mantine/form";
import { BasicPetition } from "../core/petition";
import appConfig from "../core/constants/appConfig";
import { showNotification } from "@mantine/notifications";
import { ResponsiveDataTable, type Column } from "../components/ResponsiveDataTable";
import { FaFileUpload, FaTrash } from "react-icons/fa";
import { ConfirmModal } from '../components/ConfirmModal';

/* =========================================================
   TIPOS Y DATOS INICIALES
   Usamos ids tipo string porque el backend devuelve UUIDs
========================================================= */
type Capacitador = {
  id: string;
  nombre: string;
  correo?: string;
  telefono?: string;
  stps?: string;
};

type Curso = {
  id: string;
  titulo: string;
  duracion: string;
  trainerCourseId?: string;
};

/* =========================================================
   COMPONENTE PRINCIPAL
========================================================= */
export function CursosPage() {
  /* ===================== ELIMINACIÓN ===================== */
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ type: 'cap' | 'curso'; capId?: string; cursoId?: string } | null>(null);
  const [addHover1, setAddHover1] = useState<boolean>(false);
  const [addHover2, setAddHover2] = useState<boolean>(false);
  const [addHover3, setAddHover3] = useState<boolean>(false);

  const handleDeleteClick = (type: 'cap' | 'curso', capId?: string, cursoId?: string) => {
    setDeleteTarget({ type, capId, cursoId });
    setDeleteModalOpen(true);
  };
  const handleConfirmDelete = () => {
    if (!deleteTarget) return;

    // ELIMINAR CAPACITADOR
    if (deleteTarget.type === 'cap' && deleteTarget.capId !== undefined) {
      const capId = String(deleteTarget.capId);
      setCapacitadores(prev => prev.filter(c => c.id !== capId));
      setCoursesMap(prev => {
        const copy = { ...prev };
        delete copy[capId];
        return copy;
      });
      showNotification({ title: "Capacitador eliminado", message: "Se ha eliminado el capacitador", color: "red" });
    }

    // ELIMINAR CURSO
    if (deleteTarget.type === 'curso' && deleteTarget.capId !== undefined && deleteTarget.cursoId !== undefined) {
      const capId = String(deleteTarget.capId);
      const cursoId = String(deleteTarget.cursoId);
      // call backend to delete course
      (async () => {
        try {
          await BasicPetition<any>({ endpoint: `/Course/${cursoId}`, method: 'DELETE', showNotifications: false });
          showNotification({ title: "Curso eliminado", message: "Se ha eliminado el curso (backend)", color: "red" });
        } catch (e) {
          // ignore backend error, still remove locally
          showNotification({ title: "Atención", message: "No fue posible eliminar en backend, se removió localmente", color: "yellow" });
        }
      })();

      setCoursesMap(prev => ({
        ...prev,
        [capId]: (prev[capId] || []).filter(c => c.id !== cursoId),
      }));
    }

    setDeleteModalOpen(false);
    setDeleteTarget(null);
  };


  /* ===================== ESTADOS ===================== */
  // trainers and their courses are loaded from backend
  const [capacitadores, setCapacitadores] = useState<Capacitador[]>([]);
  const [coursesMap, setCoursesMap] = useState<Record<string, Curso[]>>({});
  // keep raw trainer objects returned from backend to access certificate_person fields
  const [trainerRawMap, setTrainerRawMap] = useState<Record<string, any>>({});

  const [openAddCap, setOpenAddCap] = useState(false);
  const [openEditCap, setOpenEditCap] = useState(false);
  const [editCapId, setEditCapId] = useState<string | null>(null);

  const [openAddCourse, setOpenAddCourse] = useState(false);
  const [openEditCourse, setOpenEditCourse] = useState(false);
  const [editCourseInfo, setEditCourseInfo] = useState<{ capId: string; cursoId: string } | null>(null);

  const [courseTargetId, setCourseTargetId] = useState<string | null>(null);
  const [openMap, setOpenMap] = useState<Record<string, boolean>>({});

  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(5);

  const capForm = useForm({ initialValues: { name: "", f_surname: "", s_surname: "", correo: "", telefono: "", stps: "", specialty: "", firma: null as File | null } });
  const editCapForm = useForm({ initialValues: { name: "", f_surname: "", s_surname: "", correo: "", telefono: "", stps: "", firma: null } });
  const [uploadInProgress, setUploadInProgress] = useState(false);
  const [uploadedSign, setUploadedSign] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const courseForm = useForm({ initialValues: { titulo: "", duracion: "" } });
  const editCourseForm = useForm({ initialValues: { titulo: "", duracion: "" } });
  const [coursesCatalog, setCoursesCatalog] = useState<Array<{ id: number | string; name: string; duration: string }>>([]);
  const [openNewCourse, setOpenNewCourse] = useState(false);
  const [openAssignCourse, setOpenAssignCourse] = useState(false);
  const [selectedCatalogCourse, setSelectedCatalogCourse] = useState<number | string | null>(null);

  // require name + apellidos before allowing signature upload
  const nameComplete = Boolean(
    (capForm.values.name || "").toString().trim() &&
    (capForm.values.f_surname || "").toString().trim() &&
    (capForm.values.s_surname || "").toString().trim()
  );

  /* ===================== FILTRADO ===================== */
  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return capacitadores.filter(
      (c) =>
        c.nombre.toLowerCase().includes(q) ||
        (c.correo || "").toLowerCase().includes(q)
    );
  }, [search, capacitadores]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const pageSlice = filtered.slice((page - 1) * pageSize, page * pageSize);

  /* ===================== COLUMNAS CURSOS ===================== */
  // remove ID column as requested
  const courseColumns: Column<Curso>[] = [
    { accessor: "titulo", label: "Curso" },
    { accessor: "duracion", label: "Duración" },
  ];

  // fetch trainers (capacitadores) with their courses from backend
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
  const rawMap: Record<string, any> = {};

      for (const t of list) {
        const tid = String(t._id ?? t.id ?? '');
        const person = t.certificate_person ?? t.certificate_person_id ?? {};
        const nameParts = [person.name, person.f_surname, person.s_surname].filter(Boolean);
        const nombre = nameParts.length ? nameParts.join(' ') : (t.name ?? '');
        const correo = person.email ?? t.email ?? '';
        const telefono = person.phone ?? t.phone ?? '';
        const stps = t.stps ?? '';

  caps.push({ id: tid, nombre, correo, telefono, stps });
  rawMap[tid] = t;

        const trainerCourses = Array.isArray(t.trainer_courses) ? t.trainer_courses : [];
        cmap[tid] = trainerCourses.map((tc: any) => {
          const course = tc.course ?? tc.course_id ?? {};
          const cid = String(course._id ?? course.id ?? tc.course_id ?? '');
          const name = course.name ?? course.titulo ?? '';
          const durationVal = course.duration ?? course.duracion ?? '';
          const durStr = typeof durationVal === 'number' ? `${durationVal}h` : String(durationVal || '');
          const trainerCourseId = String(tc._id ?? tc.id ?? '');
          return { id: cid, titulo: name, duracion: durStr, trainerCourseId } as Curso;
        });
      }

      setCapacitadores(caps);
      setCoursesMap(cmap);
  setTrainerRawMap(rawMap);
    } catch (e) {
      setCapacitadores([]);
      setCoursesMap({});
    }
  };

  // fetch catalog of courses available globally
  const fetchCoursesCatalog = async () => {
    try {
      const list = await BasicPetition<any[]>({ endpoint: '/Course', method: 'GET', showNotifications: false });
      setCoursesCatalog(Array.isArray(list) ? list.map((c: any) => ({ id: c._id ?? c.id, name: c.name ?? c.titulo ?? '', duration: c.duration ?? c.duracion ?? '' })) : []);
    } catch (e) {
      setCoursesCatalog([]);
    }
  };

  // load catalog on component mount
  useEffect(() => {
    void fetchCoursesCatalog();
    void fetchTrainers();
  }, []);

  /* ===================== AÑADIR CAPACITADOR ===================== */
  const uploadSignature = async (file: File | null) => {
    setUploadError(null);
    setUploadedSign(null);
    if (!file) return;

    // build composed name: 2 letters of name + 2 of f_surname + 2 of s_surname
    const name = (capForm.values.name || '').trim();
    const f = (capForm.values.f_surname || '').trim();
    const s = (capForm.values.s_surname || '').trim();
    const part = (str: string) => (str.padEnd(2).slice(0, 2)).replace(/\s+/g, '').toUpperCase();
    const composed = `${part(name)}${part(f)}${part(s)}` || 'XX';
    const path = `FIRMAS/${composed}`;

    setUploadInProgress(true);
    try {
  const fd = new FormData();
  fd.append('file', file);
  fd.append('path', path);

  const token = typeof window !== 'undefined' ? localStorage.getItem('mi_app_token') : null;
  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${appConfig.BACKEND_URL}/google/upload`, { method: 'POST', body: fd, headers });
      if (!res.ok) throw new Error(`Upload failed: ${res.status}`);
      const data = await res.json();      
  // El backend puede devolver { id: '...', name: '...', ... } o { sign: '...' } o { path: '...' }
      const sign = data.id ?? data.sign ?? data.path ?? path;
  setUploadedSign(String(sign));
  showNotification({ title: 'Firma subida', message: `Firma subida`, color: 'green' });
    } catch (e: any) {
      setUploadError(String(e?.message ?? e));
      showNotification({ title: 'Error', message: 'No se pudo subir la firma', color: 'red' });
    } finally {
      setUploadInProgress(false);
    }
  };

  const addCapacitador = async (_values: typeof capForm.values) => {
    // require uploadedSign
    if (!uploadedSign) {
      showNotification({ title: 'Error', message: 'Sube la firma antes de añadir', color: 'red' });
      return;
    }

    const payload = {
      stps: capForm.values.stps || '',
      sign: uploadedSign,
      specialty: capForm.values.specialty || '',
      name: capForm.values.name || '',
      f_surname: capForm.values.f_surname || '',
      s_surname: capForm.values.s_surname || '',
      email: capForm.values.correo || '',
      phone: capForm.values.telefono || '',
    };

    try {
      const created = await BasicPetition<any>({ endpoint: '/trainer', method: 'POST', data: payload, showNotifications: false });
      
      // Validar que el backend devolvió un ID válido
      if (!created || (!created._id && !created.id)) {
        throw new Error('El backend no devolvió un ID válido para el capacitador');
      }
      
      const newId = String(created._id ?? created.id);
      
      // Construir nombre completo usando certificate_person o campos directos
      const person = created.certificate_person ?? created.certificate_person_id ?? created;
      const nameParts = [
        person.f_surname ?? created.f_surname ?? payload.f_surname,
        person.s_surname ?? created.s_surname ?? payload.s_surname,
        person.name ?? created.name ?? payload.name
      ].filter(Boolean);
      const nombreCompleto = nameParts.length ? nameParts.join(' ') : payload.name;
      
      const nuevo: Capacitador = { 
        id: newId, 
        nombre: nombreCompleto, 
        correo: person.email ?? created.email ?? payload.email, 
        telefono: person.phone ?? created.phone ?? payload.phone, 
        stps: created.stps ?? payload.stps 
      };
      
      setCapacitadores(prev => [nuevo, ...prev]);
      setCoursesMap(prev => ({ ...prev, [newId]: [] }));
      setTrainerRawMap(prev => ({ ...prev, [newId]: created }));
      
      showNotification({ title: 'Añadido', message: 'Capacitador creado correctamente', color: 'green' });
    } catch (e: any) {
      const errorMsg = e?.message ?? 'No se pudo crear el capacitador';
      showNotification({ title: 'Error', message: errorMsg, color: 'red' });
    } finally {
      setOpenAddCap(false);
      capForm.reset();
      setUploadedSign(null);
    }
  };

  /* ===================== EDITAR CAPACITADOR ===================== */
  const openEditCapacitador = (id: string) => {
    const cap = capacitadores.find(c => c.id === id);
    if (!cap) return;
    setEditCapId(id);

    // Preferir datos crudos devueltos por el backend (certificate_person) si existen
    const raw = trainerRawMap[id];
    if (raw) {
      const person = raw.certificate_person ?? raw.certificate_person_id ?? raw;
      const nameVal = person.name ?? raw.name ?? '';
      const fVal = person.f_surname ?? raw.f_surname ?? '';
      const sVal = person.s_surname ?? raw.s_surname ?? '';
      editCapForm.setValues({ name: String(nameVal || ''), f_surname: String(fVal || ''), s_surname: String(sVal || ''), correo: cap.correo || "", telefono: cap.telefono || "", stps: cap.stps || "", firma: null });
      setOpenEditCap(true);
      return;
    }

    // Fallback: separar nombre completo en partes (name, f_surname, s_surname)
    const parts = (cap.nombre || '').trim().split(/\s+/);
    const name = parts.slice(-1).join(' ') || '';
    const f_surname = parts[0] || '';
    const s_surname = parts.length > 2 ? parts.slice(1, -1).join(' ') : (parts[1] || '');

    editCapForm.setValues({ name, f_surname, s_surname, correo: cap.correo || "", telefono: cap.telefono || "", stps: cap.stps || "", firma: null });
    setOpenEditCap(true);
  };

  const saveEditCapacitador = () => {
    if (!editCapId) return;

    // Construir payload sólo con campos provistos
    const payload: Record<string, any> = {};
  const maybeName = (editCapForm.values as any).name;
  const maybeF = (editCapForm.values as any).f_surname;
  const maybeS = (editCapForm.values as any).s_surname;
  const maybeCorreo = (editCapForm.values as any).correo;
  const maybeTelefono = (editCapForm.values as any).telefono;
  const maybeStps = (editCapForm.values as any).stps;

  if (maybeName) payload.name = maybeName;
  if (maybeF) payload.f_surname = maybeF;
  if (maybeS) payload.s_surname = maybeS;
  if (maybeCorreo) payload.email = maybeCorreo;
  if (maybeTelefono) payload.phone = maybeTelefono;
  if (maybeStps) payload.stps = maybeStps;

    // Si se subió una nueva firma, usar uploadedSign como sign
    if (uploadedSign) {
      payload.sign = uploadedSign;
    }

    (async () => {
      try {
        // PATCH usando BasicPetition (se anexará id a la URL)
        await BasicPetition<any>({ endpoint: '/trainer', method: 'PATCH', id: editCapId, data: payload, showNotifications: false });

        // Actualizar localmente con los campos que cambiaron (recomponer nombre completo si hay apellidos)
        setCapacitadores(prev => prev.map(c => {
          if (c.id !== editCapId) return c;
          const currentParts = (c.nombre || '').trim().split(/\s+/);
          const namePart = payload.name ?? (editCapForm.values as any).name ?? currentParts.slice(-1).join(' ');
          const fPart = payload.f_surname ?? (editCapForm.values as any).f_surname ?? currentParts[0] ?? '';
          const sPart = payload.s_surname ?? (editCapForm.values as any).s_surname ?? (currentParts.length > 2 ? currentParts.slice(1, -1).join(' ') : (currentParts[1] || ''));
          const newNombre = [fPart, sPart, namePart].map(s => String(s).trim()).filter(Boolean).join(' ');
          return {
            ...c,
            nombre: newNombre || c.nombre,
            correo: payload.email ?? c.correo,
            telefono: payload.phone ?? c.telefono,
            stps: payload.stps ?? c.stps,
          };
        }));

        showNotification({ title: "Actualizado", message: "Capacitador actualizado", color: "blue" });
      } catch (e: any) {
        showNotification({ title: 'Error', message: 'No se pudo actualizar el capacitador', color: 'red' });
      } finally {
        setOpenEditCap(false);
        // limpiar uploadedSign para evitar que se reenvíe accidentalmente en futuras ediciones
        setUploadedSign(null);
      }
    })();
  };

  /* ===================== AÑADIR CURSO ===================== */
  const addCursoTo = async (capId: string, values: typeof courseForm.values) => {
    // payload expected by API; send duration as number
    const durationNum = Number(values.duracion);
    const payload = { name: values.titulo || '', duration: Number.isFinite(durationNum) ? Math.max(0, Math.trunc(durationNum)) : 0 };



    try {
      const created = await BasicPetition<any>({ endpoint: '/Course', method: 'POST', data: payload, showNotifications: false });
      const newIdRaw = created && (created._id ?? created.id) ? (created._id ?? created.id) : Date.now();
      const newId = String(newIdRaw);
      // normalize duracion for display (string with 'h')
      const createdDuration = created?.duration ?? payload.duration;
      const duracionStr = typeof createdDuration === 'number' ? `${createdDuration}h` : String(createdDuration || '');
      const newCurso: Curso = { id: newId, titulo: created.name ?? payload.name, duracion: duracionStr };

      setCoursesMap(prev => ({ ...prev, [capId]: [...(prev[capId] || []), newCurso] }));
      setOpenAddCourse(false);
      courseForm.reset();
      showNotification({ title: "Curso agregado", message: "Curso añadido", color: "green" });
    } catch (e: any) {
      showNotification({ title: 'Error', message: 'No se pudo crear el curso', color: 'red' });
    }
  };

  /* ===================== EDITAR CURSO ===================== */
  const openEditCurso = (capId: string, cursoId: string) => {
    const curso = (coursesMap[capId] || []).find(c => c.id === cursoId);
    if (!curso) return;
    setEditCourseInfo({ capId, cursoId });
    editCourseForm.setValues({ titulo: curso.titulo, duracion: curso.duracion });
    setOpenEditCourse(true);
  };

  const saveEditCurso = () => {
    if (!editCourseInfo) return;
    const { capId, cursoId } = editCourseInfo;

    // parse duration (may come as '8h' or '8')
    const rawDur = (editCourseForm.values.duracion || '').toString();
    const parsed = Number(String(rawDur).replace(/h\s*$/i, ''));
    const durationNum = Number.isFinite(parsed) ? Math.max(0, Math.trunc(parsed)) : 0;

    (async () => {
      try {
        const payload = { name: editCourseForm.values.titulo || '', duration: durationNum };
        const updated = await BasicPetition<any>({ endpoint: `/Course/${cursoId}`, method: 'PATCH', data: payload, showNotifications: false });
        // if backend returns updated course use it, else fallback to form values
        const updatedName = updated?.name ?? payload.name;
        const updatedDurationVal = updated?.duration ?? payload.duration;
        const durStr = typeof updatedDurationVal === 'number' ? `${updatedDurationVal}h` : String(updatedDurationVal || '');

        setCoursesMap(prev => ({
          ...prev,
          [capId]: (prev[capId] || []).map(c => c.id === cursoId ? { ...c, titulo: updatedName, duracion: durStr } : c)
        }));

        showNotification({ title: "Actualizado", message: "Curso actualizado", color: "blue" });
      } catch (e: any) {
        showNotification({ title: 'Error', message: 'No se pudo actualizar el curso', color: 'red' });
      } finally {
        setOpenEditCourse(false);
      }
    })();
  };

  /* ===================== DESASIGNAR (solo quita vínculo) ===================== */
  const desasignarCurso = async (capId: string, cursoId: string) => {
    const curso = (coursesMap[capId] || []).find(c => c.id === cursoId);
    const trainerCourseId = curso?.trainerCourseId;

    if (trainerCourseId) {
      try {
        await BasicPetition<any>({ endpoint: `/trainer-course/${trainerCourseId}`, method: 'DELETE', showNotifications: false });
        showNotification({ title: 'Desasignado', message: 'Se quitó el vínculo del curso con el capacitador (backend)', color: 'green' });
      } catch (e) {
        showNotification({ title: 'Atención', message: 'No se pudo desasignar en backend, se removió localmente', color: 'yellow' });
      }
    } else {
      showNotification({ title: 'Desasignado', message: 'Se removió el curso localmente', color: 'yellow' });
    }

    // always remove locally
    setCoursesMap(prev => ({ ...prev, [capId]: (prev[capId] || []).filter(c => c.id !== cursoId) }));
  };

  /* ===================== BORRAR CURSO GLOBAL ===================== */
  const [openDeleteCourseModal, setOpenDeleteCourseModal] = useState(false);
  const [deletingCourseId, setDeletingCourseId] = useState<string | null>(null);
  const [deletingCourseName, setDeletingCourseName] = useState<string | null>(null);
  const [trainersAffected, setTrainersAffected] = useState<string[]>([]);

  const openDeleteCourseDialog = (courseId: string) => {
    // compute which trainers have this course
    const caps = Object.entries(coursesMap)
      .filter(([, list]) => list.some(c => c.id === courseId))
      .map(([capId]) => capacitadores.find(c => c.id === capId)?.nombre ?? capId);
    setTrainersAffected(caps);
    setDeletingCourseId(courseId);
    // find name from catalog or first occurrence
    const catalog = coursesCatalog.find(c => String(c.id) === String(courseId));
    setDeletingCourseName(catalog?.name ?? ((Object.values(coursesMap).flat().find(c => c.id === courseId) || { titulo: '' }).titulo));
    setOpenDeleteCourseModal(true);
  };

  const confirmDeleteCourseGlobal = async () => {
    if (!deletingCourseId) return;
    try {
      await BasicPetition<any>({ endpoint: `/Course/${deletingCourseId}`, method: 'DELETE', showNotifications: false });
      // remove from all trainers locally
      setCoursesMap(prev => {
        const out: Record<string, Curso[]> = {};
        for (const [k, v] of Object.entries(prev)) {
          out[k] = v.filter(c => c.id !== deletingCourseId);
        }
        return out;
      });
      // refresh catalog
      await fetchCoursesCatalog();
      showNotification({ title: 'Borrado', message: 'Curso borrado globalmente y desvinculado de todos los capacitadores', color: 'red' });
    } catch (e) {
      showNotification({ title: 'Error', message: 'No se pudo borrar el curso en backend', color: 'red' });
    } finally {
      setOpenDeleteCourseModal(false);
      setDeletingCourseId(null);
      setDeletingCourseName(null);
      setTrainersAffected([]);
    }
  };

  /* ===================== RENDER ===================== */
  return (
    <Container size="lg" py="lg">
      {/* HEADER */}
      <Group justify="space-between" mb="md">
        <Box>
          <Title order={2}>Gestión de Capacitadores</Title>
          <Text size="sm" c="dimmed">Expande un capacitador para ver sus cursos</Text>
          {/* hover wrapper removed; hover now attached to the '+ Añadir Usuario' button */}
        </Box>
        <Group>
          <Button
            onClick={() => { setOpenNewCourse(true); }}
            style={{ backgroundColor: 'var(--olive-green)', color: 'white', transition: 'filter 120ms ease, transform 120ms ease', filter: addHover1 ? 'brightness(0.9)' : 'none' }}
            onMouseEnter={() => setAddHover1(true)}
            onMouseLeave={() => setAddHover1(false)}
          >
            + Nuevo Curso
          </Button>
          <Button
            onClick={() => { setOpenAddCap(true); }}
            style={{ backgroundColor: 'var(--olive-green)', color: 'white', transition: 'filter 120ms ease, transform 120ms ease', filter: addHover2 ? 'brightness(0.9)' : 'none' }}
            onMouseEnter={() => setAddHover2(true)}
            onMouseLeave={() => setAddHover2(false)}
          >
            + Añadir Capacitador
          </Button>
        </Group>
      </Group>

      {/* BUSCADOR */}
      <Group mb="sm" grow>
        <TextInput placeholder="Buscar por nombre o correo..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
        <Select value={String(pageSize)} onChange={(v) => { setPageSize(Number(v)); setPage(1); }} data={[
          { value: "5", label: "5 / página" },
          { value: "8", label: "8 / página" },
          { value: "10", label: "10 / página" },
          { value: "20", label: "20 / página" },
        ]} />
      </Group>

      {/* PAGINACIÓN */}
      <Group mb="xs" style={{ justifyContent: "center" }}>
        <Text size="sm">{filtered.length} capacitador(es)</Text>
        <Group>
          <Button disabled={page <= 1} onClick={() => setPage(page - 1)}>Anterior</Button>
          <Text>{page} / {totalPages}</Text>
          <Button disabled={page >= totalPages} onClick={() => setPage(page + 1)}>Siguiente</Button>
        </Group>
      </Group>

      {/* LISTA DE CAPACITADORES */}
      {pageSlice.map(cap => {
        const isOpen = openMap[cap.id];
        const cursos = coursesMap[cap.id] || [];

        return (
          <Paper key={cap.id} p="sm" mb="sm" radius="md" withBorder style={{
            cursor: "pointer",
            border: isOpen ? "2px solid var(--olive-green)" : "1px solid #e0e0e0",
            backgroundColor: isOpen ? "color-mix(in srgb, var(--olive-green) 20%, white)" : "white",
            transition: "0.2s"
          }}>
            <Group onClick={() => setOpenMap(isOpen ? {} : { [cap.id]: true })}>
              <Box>
                <Text fw={600}>{cap.nombre}</Text>
                <Text size="sm" c="dimmed">{cap.correo}</Text>
              </Box>
              <Text size="sm" c="dimmed" style={{ flexGrow: 1, textAlign: "right" }}>
                {cursos.length} cursos
              </Text>
            </Group>

            {isOpen && (
              <Box mt="sm">
                <Divider my="sm" />
                <Group mb="sm" justify="center">
                  <Button onClick={() => openEditCapacitador(cap.id)}>Editar</Button>
                  <Button color="red" onClick={() => handleDeleteClick('cap', cap.id)}>Eliminar</Button>
                  <Button
                    onClick={() => {
                      setCourseTargetId(cap.id);
                      setOpenAssignCourse(true);
                    }}
                    style={{
                      backgroundColor: 'var(--olive-green)',
                      color: 'white',
                      transition: 'filter 120ms ease, transform 120ms ease',
                      filter: addHover3 ? 'brightness(0.9)' : 'none'
                    }}
                    onMouseEnter={() => setAddHover3(true)}
                    onMouseLeave={() => setAddHover3(false)}
                  >
                    + Añadir Curso
                  </Button>
                </Group>

                <ResponsiveDataTable
                  columns={courseColumns}
                  data={cursos}
                  initialPageSize={5}
                  actions={(row) => (
                    <Group gap={8}>
                      <Button size="xs" onClick={() => openEditCurso(cap.id, row.id)}>Editar</Button>
                      <Button size="xs" color="gray" onClick={() => desasignarCurso(cap.id, row.id)}>Desasignar</Button>
                      <Button size="xs" color="red" onClick={() => openDeleteCourseDialog(row.id)} leftSection={<FaTrash />}>Borrar</Button>
                    </Group>
                  )}
                />
              </Box>
            )}
          </Paper>
        );
      })}

      {/* ======================== MODALES ======================== */}

      {/* ADD CAP */}
      <Modal opened={openAddCap} onClose={() => { setOpenAddCap(false); setUploadedSign(null); capForm.reset(); }} title="Añadir capacitador">
        <form onSubmit={(e) => { e.preventDefault(); /* handled by button */ }}>
          <TextInput
            label="Nombre"
            required
            {...capForm.getInputProps("name")}
            onChange={(e) => capForm.setFieldValue('name', String((e.target as HTMLInputElement).value || '').toUpperCase())}
            style={{ textTransform: 'uppercase' }}
          />
          <TextInput
            label="Apellido paterno"
            mt="sm"
            {...capForm.getInputProps("f_surname")}
            onChange={(e) => capForm.setFieldValue('f_surname', String((e.target as HTMLInputElement).value || '').toUpperCase())}
            style={{ textTransform: 'uppercase' }}
          />
          <TextInput
            label="Apellido materno"
            mt="sm"
            {...capForm.getInputProps("s_surname")}
            onChange={(e) => capForm.setFieldValue('s_surname', String((e.target as HTMLInputElement).value || '').toUpperCase())}
            style={{ textTransform: 'uppercase' }}
          />
          <TextInput label="Correo" mt="sm" {...capForm.getInputProps("correo")} />
          <TextInput
            label="Teléfono"
            mt="sm"
            {...capForm.getInputProps("telefono")}
            onChange={(e) => capForm.setFieldValue('telefono', String((e.target as HTMLInputElement).value || '').toUpperCase())}
            style={{ textTransform: 'uppercase' }}
          />
          <TextInput
            label="Registro STPS"
            mt="sm"
            {...capForm.getInputProps("stps")}
            onChange={(e) => capForm.setFieldValue('stps', String((e.target as HTMLInputElement).value || '').toUpperCase())}
            style={{ textTransform: 'uppercase' }}
          />
          <TextInput
            label="Especialidad"
            mt="sm"
            {...capForm.getInputProps("specialty")}
            onChange={(e) => capForm.setFieldValue('specialty', String((e.target as HTMLInputElement).value || '').toUpperCase())}
            style={{ textTransform: 'uppercase' }}
          />

          <FileInput
            label="Firma"
            placeholder={nameComplete ? "Sube la firma del capacitador" : "Rellena nombre y apellidos primero"}
            leftSection={<FaFileUpload />}
            accept="image/png,image/jpeg"
            disabled={!nameComplete}
            {...capForm.getInputProps('firma')}
            onChange={(file) => {
              // prevent upload if name/apellidos incompletos (extra safety)
              if (!nameComplete) {
                capForm.setFieldValue('firma', null);
                showNotification({ title: 'Completa datos', message: 'Escribe nombre y apellidos antes de subir la firma', color: 'yellow' });
                return;
              }
              capForm.setFieldValue('firma', file);
              uploadSignature(file || null);
            }}
          />

          <Text size="sm" color={uploadError ? 'red' : 'dimmed'} mt="xs">
            {uploadInProgress ? 'Subiendo firma...' : uploadedSign ? `Firma subida: ` : (uploadError ?? 'Aún no se ha subido la firma')}
          </Text>

          <Group justify="flex-end" mt="md">
            <Button type="button" disabled={!uploadedSign} onClick={() => addCapacitador(capForm.values)} style={{ background: "#88a04b", color: "white" }}>
              Guardar
            </Button>
          </Group>
        </form>
      </Modal>

      {/* EDIT CAP */}
      <Modal opened={openEditCap} onClose={() => setOpenEditCap(false)} title="Editar capacitador">
        <form onSubmit={(e) => { e.preventDefault(); saveEditCapacitador(); }}>
          <TextInput
            label="Nombre(s)"
            required
            {...editCapForm.getInputProps("name")}
            onChange={(e) => editCapForm.setFieldValue('name', String((e.target as HTMLInputElement).value || '').toUpperCase())}
            style={{ textTransform: 'uppercase' }}
          />
          <TextInput
            label="Apellido paterno"
            required
            mt="sm"
            {...editCapForm.getInputProps("f_surname")}
            onChange={(e) => editCapForm.setFieldValue('f_surname', String((e.target as HTMLInputElement).value || '').toUpperCase())}
            style={{ textTransform: 'uppercase' }}
          />
          <TextInput
            label="Apellido materno"
            mt="sm"
            {...editCapForm.getInputProps("s_surname")}
            onChange={(e) => editCapForm.setFieldValue('s_surname', String((e.target as HTMLInputElement).value || '').toUpperCase())}
            style={{ textTransform: 'uppercase' }}
          />
          <TextInput label="Correo" mt="sm" {...editCapForm.getInputProps("correo")} />
          <TextInput
            label="Teléfono"
            mt="sm"
            {...editCapForm.getInputProps("telefono")}
            onChange={(e) => editCapForm.setFieldValue('telefono', String((e.target as HTMLInputElement).value || '').toUpperCase())}
            style={{ textTransform: 'uppercase' }}
          />
          <TextInput
            label="Registro STPS"
            mt="sm"
            {...editCapForm.getInputProps("stps")}
            onChange={(e) => editCapForm.setFieldValue('stps', String((e.target as HTMLInputElement).value || '').toUpperCase())}
            style={{ textTransform: 'uppercase' }}
          />
          <Group mt="sm">
            <FileInput label="Firma" description="Sube una imagen PNG o JPG" placeholder="Selecciona la firma" leftSection={<FaFileUpload size={18} />} accept="image/png,image/jpeg" clearable radius="md" size="md" {...editCapForm.getInputProps("firma")} />
            <Button disabled={!editCapForm.values.firma || uploadInProgress} onClick={() => uploadSignature(editCapForm.values.firma as File | null)} size="sm">{uploadInProgress ? 'Subiendo...' : 'Subir firma'}</Button>
          </Group>
          <Group justify="flex-end" mt="md">
            <Button type="submit" style={{ background: "#88a04b", color: "white" }}>Guardar cambios</Button>
          </Group>
        </form>
      </Modal>

      {/* ADD COURSE */}
      <Modal opened={openAddCourse} onClose={() => setOpenAddCourse(false)} title="Añadir curso">
        <form onSubmit={(e) => { e.preventDefault(); if (courseTargetId) addCursoTo(courseTargetId, courseForm.values); }}>
          <TextInput
            label="Título"
            required
            {...courseForm.getInputProps("titulo")}
            onChange={(e) => courseForm.setFieldValue('titulo', String((e.target as HTMLInputElement).value || '').toUpperCase())}
            style={{ textTransform: 'uppercase' }}
          />
          <TextInput label="Duración" mt="sm" {...courseForm.getInputProps("duracion")} />
          <Group justify="flex-end" mt="md">
            <Button type="submit" style={{ background: "#88a04b", color: "white" }}>Guardar curso</Button>
          </Group>
        </form>
      </Modal>

      {/* NEW GLOBAL COURSE */}
      <Modal opened={openNewCourse} onClose={() => setOpenNewCourse(false)} title="Crear nuevo curso">
        <form onSubmit={async (e) => {
          e.preventDefault(); await (async () => {
            // reuse addCursoTo but without capId: create in catalog and refresh
            const durationNum = Number(courseForm.values.duracion);
            const payload = { name: courseForm.values.titulo || '', duration: Number.isFinite(durationNum) ? Math.max(0, Math.trunc(durationNum)) : 0 };
            try {
              await BasicPetition<any>({ endpoint: '/Course', method: 'POST', data: payload, showNotifications: false });
              showNotification({ title: 'Creado', message: 'Curso creado en catálogo', color: 'green' });
              courseForm.reset();
              setOpenNewCourse(false);
              await fetchCoursesCatalog();
            } catch (err) {
              showNotification({ title: 'Error', message: 'No se pudo crear el curso', color: 'red' });
            }
          })();
        }}>
          <TextInput
            label="Título"
            required
            {...courseForm.getInputProps("titulo")}
            onChange={(e) => courseForm.setFieldValue('titulo', String((e.target as HTMLInputElement).value || '').toUpperCase())}
            style={{ textTransform: 'uppercase' }}
          />
          <TextInput label="Duración" mt="sm" {...courseForm.getInputProps("duracion")} />
          <Group justify="flex-end" mt="md">
            <Button type="submit" style={{ background: "#3b82f6", color: "white" }}>Crear curso</Button>
          </Group>
        </form>
      </Modal>

      {/* ASSIGN EXISTING COURSE TO CAP */}
      <Modal opened={openAssignCourse} onClose={() => setOpenAssignCourse(false)} title="Asignar curso existente">
        <form onSubmit={async (e) => {
          e.preventDefault();
          if (!courseTargetId || !selectedCatalogCourse) {
            showNotification({ title: 'Aviso', message: 'Selecciona un curso', color: 'yellow' });
            return;
          }

          try {
            // find selected course data
            const selected = coursesCatalog.find(c => String(c.id) === String(selectedCatalogCourse));
            if (!selected) {
              showNotification({ title: 'Error', message: 'Curso no encontrado', color: 'red' });
              return;
            }

            // call backend to create trainer-course relation
            const payload = { trainer_id: String(courseTargetId), course_id: String(selected.id) };
            const created = await BasicPetition<any>({ endpoint: '/trainer-course', method: 'POST', data: payload, showNotifications: false });

            // try to obtain returned trainerCourse id and course data
            const trainerCourseId = String(created?._id ?? created?.id ?? created?.trainer_course?._id ?? created?.trainer_course?.id ?? '');
            const courseObj = created?.course ?? created?.trainer_course?.course ?? selected;
            const cid = String(courseObj?._id ?? courseObj?.id ?? selected.id);
            const name = courseObj?.name ?? courseObj?.titulo ?? selected.name;
            const durationVal = courseObj?.duration ?? courseObj?.duracion ?? selected.duration;
            const dur = typeof durationVal === 'number' ? `${durationVal}h` : String(durationVal || '');

            const newCurso: Curso = { id: cid, titulo: name, duracion: dur, trainerCourseId: trainerCourseId || undefined };

            setCoursesMap(prev => ({ ...prev, [String(courseTargetId)]: [...(prev[String(courseTargetId)] || []), newCurso] }));
            showNotification({ title: 'Asignado', message: 'Curso asignado al capacitador', color: 'green' });
            setOpenAssignCourse(false);
            setSelectedCatalogCourse(null);
          } catch (err) {
            showNotification({ title: 'Error', message: 'No se pudo asignar el curso', color: 'red' });
          }
        }}>
          <Select label="Cursos disponibles" placeholder="Selecciona un curso" data={coursesCatalog.map(c => ({ value: String(c.id), label: `${c.name} (${typeof c.duration === 'number' ? String(c.duration) + 'h' : c.duration})` }))} value={selectedCatalogCourse ? String(selectedCatalogCourse) : null} onChange={(v) => setSelectedCatalogCourse(v ? v : null)} />
          <Group justify="flex-end" mt="md">
            <Button type="submit" style={{ background: "#88a04b", color: "white" }}>Asignar curso</Button>
          </Group>
        </form>
      </Modal>

      {/* EDIT COURSE */}
      <Modal opened={openEditCourse} onClose={() => setOpenEditCourse(false)} title="Editar curso">
        <form onSubmit={(e) => { e.preventDefault(); saveEditCurso(); }}>
          <TextInput
            label="Título"
            required
            {...editCourseForm.getInputProps("titulo")}
            onChange={(e) => editCourseForm.setFieldValue('titulo', String((e.target as HTMLInputElement).value || '').toUpperCase())}
            style={{ textTransform: 'uppercase' }}
          />
          <TextInput label="Duración" mt="sm" {...editCourseForm.getInputProps("duracion")} />
          <Group justify="flex-end" mt="md">
            <Button type="submit" style={{ background: "#88a04b", color: "white" }}>Guardar cambios</Button>
          </Group>
        </form>
      </Modal>

      {/* DELETE GLOBAL COURSE */}
      <Modal opened={openDeleteCourseModal} onClose={() => setOpenDeleteCourseModal(false)} title={`Borrar curso ${deletingCourseName ?? ''}`}>
        <Text>Se quitará este curso de todos los capacitadores listados abajo:</Text>
        <Box mt="sm">
          {trainersAffected.length ? trainersAffected.map((t) => <Text key={t}>• {t}</Text>) : <Text c="dimmed">No hay capacitadores asignados</Text>}
        </Box>
        <Group style={{ justifyContent: 'flex-end' }} mt="md">
          <Button variant="default" onClick={() => setOpenDeleteCourseModal(false)}>Cancelar</Button>
          <Button color="red" onClick={() => confirmDeleteCourseGlobal()}>Borrar curso</Button>
        </Group>
      </Modal>

      {/* CONFIRM DELETE */}
      <ConfirmModal
        opened={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        onConfirm={handleConfirmDelete}
        title="Confirmar eliminación"
        message="¿Estás seguro de eliminar este elemento?"
      />
    </Container>
  );
}
