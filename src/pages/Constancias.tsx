import { useState, useEffect } from "react";
import { useMediaQuery } from '@mantine/hooks';
import {
  Container,
  Title,
  Badge,
  Button,
  Text,
  Modal,
  Group,
  TextInput,
  Select,
} from "@mantine/core";
import { showNotification } from "@mantine/notifications";
import { BasicPetition } from "../core/petition";
import { ResponsiveDataTable, type Column } from "../components/ResponsiveDataTable";
import { generateAndDownloadZipDC3, type DC3User, type DC3CertificateData } from "../components/createPDF";
import { generateAndDownloadZipDC3FromTemplate } from "../components/createPDFFromTemplate";
import { FaExclamationTriangle } from "react-icons/fa";
import pdfMake from "pdfmake/build/pdfmake";
import appConfig from "../core/constants/appConfig";

// Minimal types used in this file
type Row = {
  id?: string;
  capacitador: string;
  empresa: string;
  curso: string;
  fecha: string;
  estado: "pendiente" | "aprobada";
  courses?: Array<{ course_name: string; start: string; end: string }>;
};

// Cache para firmas digitales
const signatureCache = new Map<string, string | undefined>();

export function ConstanciasAdminPage() {
  const isMobile = useMediaQuery('(max-width: 600px)');
  const isTablet = useMediaQuery('(max-width: 900px)');

  const [rows, setRows] = useState<Row[]>([]);
  const [certificateRawMap, setCertificateRawMap] = useState<Record<string, any>>({});

  // modal / editar
  const [editModalOpened, setEditModalOpened] = useState(false);
  const [selectedCertificate, setSelectedCertificate] = useState<Row | null>(null);
  const [selectedRowUsers, setSelectedRowUsers] = useState<any[]>([]);
  const [repLegalAll, setRepLegalAll] = useState('');
  const [repTrabAll, setRepTrabAll] = useState('');
  const [areaTematicaAll, setAreaTematicaAll] = useState('6000 Seguridad');
  const [capacitadorAll, setCapacitadorAll] = useState('');

  const [fechaInicioAll, setFechaInicioAll] = useState('');
  const [fechaFinAll, setFechaFinAll] = useState('');

  // pagination / search within modal
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(5);

  const [verifySending, setVerifySending] = useState(false);
  const [deleteHover, setDeleteHover] = useState<string | null>(null);

  useEffect(() => {
    void fetchCertificates();
  }, []);

  const handleDelete = async (row: Row) => {
    if (!row.id) return;
    if (!window.confirm('¿Estás seguro de eliminar esta solicitud de constancia(s)?')) return;
    
    try {
      await BasicPetition({ 
        endpoint: '/certificate', 
        method: 'DELETE', 
        id: row.id,
        showNotifications: false 
      });
      showNotification({ 
        title: 'Éxito', 
        message: 'Constancia eliminada correctamente', 
        color: 'green' 
      });
      void fetchCertificates();
    } catch (err) {
      showNotification({ 
        title: 'Error', 
        message: 'No se pudo eliminar la constancia', 
        color: 'red' 
      });
    }
  };

  async function fetchCertificates() {
    try {
      const list = await BasicPetition<any[]>({ endpoint: '/certificate', method: 'GET', showNotifications: false }) || [];
      const rawMap: Record<string, any> = {};
      const rowsWithCourses: Row[] = await Promise.all(list.map(async (it: any) => {
        rawMap[it._id] = it;
        const capacitador = it.trainer_fullname ?? "";
        const empresa = it.company_name ?? it.user_fullname ?? "";

        let associations: any[] = [];
        try {
          if (Array.isArray(it.certificate_courses) && it.certificate_courses.length > 0) associations = it.certificate_courses;
          else associations = await BasicPetition<any[]>({ endpoint: '/certificate_courses', method: 'GET', params: { certificate_id: it._id }, showNotifications: false }) || [];
        } catch (e) { associations = []; }

        const coursesArr = Array.isArray(associations) ? associations.map(a => ({
          course_name: a.course?.name ?? a.course_name ?? '',
          start: String(a.start ?? a.fecha_inicio ?? '').slice(0, 10),
          end: String(a.end ?? a.fecha_fin ?? '').slice(0, 10),
        })) : [];

        const allCourseNames = coursesArr.length > 0 ? coursesArr.map(c => c.course_name).filter(Boolean).join(', ') : '';
        const singlePeriod = coursesArr.length === 1 ? `${coursesArr[0].start} / ${coursesArr[0].end}` : '';
        const courseNameFromCertificate = coursesArr.length > 0 ? coursesArr[0].course_name : (it?.certificate_courses && Array.isArray(it.certificate_courses) && it.certificate_courses.length > 0 ? it.certificate_courses[0]?.course?.name : undefined);
        const curso = courseNameFromCertificate ?? it.course_name ?? it.course?.name ?? allCourseNames ?? '';
        const fecha = it.course_period ?? singlePeriod ?? '';
        const estado: "pendiente" | "aprobada" = String(it.status).toUpperCase() === "PENDIENTE" ? "pendiente" : "aprobada";

        return { id: it._id, capacitador, empresa, curso, fecha, estado, courses: coursesArr } as Row;
      }));

      setCertificateRawMap(rawMap);
      setRows(rowsWithCourses);
    } catch (e) {
      setRows([]);
    }
  }

  const columns: Column<Row>[] = [
    { accessor: "capacitador", label: "Capacitador" },
    { accessor: "empresa", label: "Empresa" },
    {
      accessor: 'curso',
      label: 'Curso',
      render: (r) => {
        const cs = r.courses ?? [];
        if (cs.length === 0) return r.curso || '';
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {cs.map((c, idx) => (
              <div key={String(idx)} style={{ display: 'flex', flexDirection: 'column' }}>
                <div style={{ fontWeight: 600 }}>{c.course_name ?? r.curso ?? ''}</div>
                <div style={{ fontSize: 12, color: '#666' }}>{(c.start || '') + (c.start && c.end ? ' / ' : '') + (c.end || '')}</div>
              </div>
            ))}
          </div>
        );
      }
    },
    {
      accessor: "estado",
      label: "Estado",
      render: (r) => (
        <Badge color={r.estado === "pendiente" ? "yellow" : "dark"} variant="filled">
          {r.estado === "pendiente" ? "Pendiente" : "Aprobada"}
        </Badge>
      ),
    },
  ];

  const handleVerificar = (row: Row) => {
    setSelectedCertificate(row);
    const raw = row.id ? certificateRawMap[row.id] : null;
    const cursantes: any[] = raw?.xlsx_object?.cursantes ?? [];
    const [inicio, fin] = (raw?.course_period ?? "").split(/\s*\/\s*/).map((s: string) => s?.trim());
    const courseNameFromCertificate = raw?.certificate_courses && Array.isArray(raw.certificate_courses) && raw.certificate_courses.length > 0 ? raw.certificate_courses[0]?.course?.name : undefined;
    const effectiveCourseName = courseNameFromCertificate ?? raw?.course_name ?? raw?.course?.name ?? '';

    const users: any[] = [];

    const ocupacionesList = [
      "01 Cultivo, crianza y aprovechamiento",
      "02 Extracción y suministro",
      "03 Construcción",
      "04 Tecnología",
      "05 Procesamiento y fabricación",
      "06 Transporte",
      "07 Provisión de bienes y servicios",
      "08 Gestión y soporte administrativo",
      "09 Salud y protección social",
      "10 Comunicación",
      "11 Desarrollo y extensión del conocimiento",
    ];
    const removeDiacritics = (s: string) => s.normalize('NFD').replace(/[^\w\s-]/g, '');

    cursantes.forEach((c: any) => {
      const rawOcc = (c.ocupacion_especifica ?? c.ocupacionEspecifica ?? c.ocupacion ?? '').toString().trim();
      let ocupacionCanon = rawOcc;
      const codeMatch = rawOcc.match(/^\s*(\d{2})/);
      if (codeMatch) {
        const code = codeMatch[1];
        const found = ocupacionesList.find(o => String(o).startsWith(code));
        if (found) ocupacionCanon = found;
      }
      if (!ocupacionCanon && rawOcc) {
        const rawNorm = removeDiacritics(rawOcc).toLowerCase();
        const found = ocupacionesList.find(o => removeDiacritics(o).toLowerCase() === rawNorm || removeDiacritics(o).toLowerCase().includes(rawNorm));
        if (found) ocupacionCanon = found;
      }

      const baseUser: any = {
        nombreCompleto: c.nombre ?? "",
        curp: c.curp ?? "",
        puestoTrabajo: c.puesto_trabajo ?? c.puestoTrabajo ?? '',
        ocupacion_especifica: ocupacionCanon ?? (rawOcc || ''),
        repLegal: raw?.legal_representative ?? "",
        repTrabajadores: raw?.workers_representative ?? "",
        tipoFirma: raw?.xlsx_object?.tipo_firma ?? c.tipo_firma ?? "DIGITAL",
        capacitador: raw?.trainer_fullname ?? "",
      };

      let coursesArr: any[] = [];
      if (Array.isArray(c.cursos) && c.cursos.length > 0) coursesArr = c.cursos;
      else if (Array.isArray(raw?.certificate_courses) && raw.certificate_courses.length > 0) coursesArr = raw.certificate_courses;
      else coursesArr = [{ course_name: effectiveCourseName ?? '', start: inicio ?? '', end: fin ?? '' }];

      for (const courseItem of coursesArr) {
        const cursoInteresVal = courseItem?.course?.name ?? courseItem?.course_name ?? courseItem?.name ?? effectiveCourseName ?? '';
        const fechaInicioVal = courseItem?.start ?? courseItem?.fecha_inicio ?? courseItem?.fechaInicio ?? c.fecha_inicio ?? c.fechaInicio ?? inicio ?? '';
        const fechaFinVal = courseItem?.end ?? courseItem?.fecha_fin ?? courseItem?.fechaFin ?? c.fecha_fin ?? c.fechaFin ?? fin ?? '';

        users.push({ ...baseUser, cursoInteres: cursoInteresVal, fechaInicio: fechaInicioVal, fechaFin: fechaFinVal });
      }
    });

    setSelectedRowUsers(users);
    setRepLegalAll(raw?.legal_representative ?? "");
    setRepTrabAll(raw?.workers_representative ?? "");
    setAreaTematicaAll(raw?.xlsx_object?.area_tematica ?? raw?.area_tematica ?? '6000 Seguridad');
    setCapacitadorAll(raw?.trainer_fullname ?? '');

    // top course
    let topCurso = '';
    let topInicio = '';
    let topFin = '';
    const firstC = Array.isArray(cursantes) && cursantes.length > 0 ? cursantes[0] : null;
    if (firstC && Array.isArray(firstC.cursos) && firstC.cursos.length > 0) {
      topCurso = firstC.cursos[0].course_name ?? firstC.cursos[0].name ?? firstC.cursos[0].curso ?? '';
      topInicio = firstC.cursos[0].fecha_inicio ?? firstC.cursos[0].start ?? firstC.cursos[0].fechaInicio ?? '';
      topFin = firstC.cursos[0].fecha_fin ?? firstC.cursos[0].end ?? firstC.cursos[0].fechaFin ?? '';
    } else if (Array.isArray(raw?.certificate_courses) && raw.certificate_courses.length > 0) {
      topCurso = raw.certificate_courses[0]?.course?.name ?? raw.certificate_courses[0]?.course_name ?? '';
      topInicio = raw.certificate_courses[0]?.start ?? raw.certificate_courses[0]?.fecha_inicio ?? '';
      topFin = raw.certificate_courses[0]?.end ?? raw.certificate_courses[0]?.fecha_fin ?? '';
    } else {
      topCurso = effectiveCourseName ?? '';
      topInicio = inicio ?? '';
      topFin = fin ?? '';
    }

    setFechaInicioAll(topInicio ?? '');
    setFechaFinAll(topFin ?? '');

    setEditModalOpened(true);
  };

  const toIso = (s?: string) => {
    if (!s) return null;
    const m = String(s).trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (m) {
      const y = Number(m[1]); const mo = Number(m[2]); const d = Number(m[3]);
      return new Date(Date.UTC(y, mo - 1, d)).toISOString();
    }
    const parsed = Date.parse(String(s));
    if (!isNaN(parsed)) return new Date(parsed).toISOString();
    return null;
  };

  const handleUserChange = <K extends keyof any>(index: number, field: K, value: any) => {
    setSelectedRowUsers((prev) => {
      const copy = [...prev];
      copy[index][field as string] = value;
      return copy;
    });
  };

  // groups for modal rendering
  const groupsMap: Record<string, { indices: number[]; sample?: any }> = {};
  selectedRowUsers.forEach((u, i) => {
    const key = (u.curp && String(u.curp).trim()) || `${u.nombreCompleto || 'p_' + i}`;
    if (!groupsMap[key]) groupsMap[key] = { indices: [], sample: u };
    groupsMap[key].indices.push(i);
  });

  const groupKeys = Object.keys(groupsMap);
  const filteredKeys = groupKeys.filter((k) => {
    if (!searchQuery) return true;
    const sample = groupsMap[k].sample as any | undefined;
    const hay = ((sample?.nombreCompleto ?? '') + ' ' + (sample?.curp ?? '')).toLowerCase();
    return hay.includes(searchQuery.trim().toLowerCase());
  });

  const totalPages = Math.max(1, Math.ceil(filteredKeys.length / pageSize));
  const safePage = Math.min(Math.max(1, currentPage), totalPages);
  const pagedKeys = filteredKeys.slice((safePage - 1) * pageSize, safePage * pageSize);

  const handleApplyToAll = (field: string, value: string) => {
    setSelectedRowUsers((prev) => prev.map((u) => ({ ...u, [field]: value })));
  };

  // Ejecutar validación directamente
  const handleValidate = async () => {
    const id = selectedCertificate?.id ?? selectedCertificate?.id ?? undefined;
    if (!id) return;
    const prevRaw = certificateRawMap[id] ?? {};

    const usersMap: Record<string, any> = {};
    const baseCursantes = Array.isArray(prevRaw?.xlsx_object?.cursantes) ? prevRaw.xlsx_object.cursantes : [];
    baseCursantes.forEach((pc: any, idx: number) => {
      const curpKey = String(pc.curp ?? '').trim().toUpperCase() || `no_curp_${idx}`;
      usersMap[curpKey] = {
        curp: String(pc.curp ?? '').trim(),
        nombre: pc.nombre ?? pc.nombre_completo ?? pc.nombreCompleto ?? '',
        puesto_trabajo: pc.puesto_trabajo ?? pc.puestoTrabajo ?? pc.puesto ?? '',
        ocupacion_especifica: pc.ocupacion_especifica ?? pc.ocupacion ?? '',
      };
    });

    selectedRowUsers.forEach((u, idx) => {
      const curpKey = String(u.curp ?? '').trim().toUpperCase() || `no_curp_sel_${idx}`;
      const nombre = (u.nombreCompleto ?? '').toString();
      const puesto = (u.puestoTrabajo ?? '').toString();
      const ocup = (u.ocupacion_especifica ?? '').toString();
      if (!usersMap[curpKey]) usersMap[curpKey] = { curp: String(u.curp ?? '').trim(), nombre, puesto_trabajo: puesto, ocupacion_especifica: ocup };
      else {
        const ex = usersMap[curpKey];
        if (nombre) ex.nombre = nombre;
        if (puesto) ex.puesto_trabajo = puesto;
        if (ocup) ex.ocupacion_especifica = ocup;
      }
    });

    const usersToSave = Object.values(usersMap).map((u) => ({ curp: u.curp, nombre: u.nombre, puesto_trabajo: u.puesto_trabajo, ocupacion_especifica: u.ocupacion_especifica }));

    const tipoFirmaToSave = selectedRowUsers[0]?.tipoFirma ?? "DIGITAL";
    const patchData: any = {
      certificate_user_id: prevRaw.certificate_user_id ?? undefined,
      course_id: prevRaw.course_id ?? prevRaw.course?.id ?? undefined,
      trainer_id: prevRaw.trainer_id ?? prevRaw.trainer?.id ?? undefined,
      legal_representative: repLegalAll || prevRaw.legal_representative || undefined,
      workers_representative: repTrabAll || prevRaw.workers_representative || undefined,
      xlsx_object: { ...(prevRaw.xlsx_object ?? {}), cursantes: (usersToSave || []).map((u: any) => ({ curp: u.curp, nombre: u.nombre, puesto_trabajo: u.puesto_trabajo, ocupacion_especifica: u.ocupacion_especifica })), area_tematica: areaTematicaAll, tipo_firma: tipoFirmaToSave },
      status: 'APROBADO',
    };

    // Ejecutar directamente
    await handleConfirmApply(patchData);
  };

  // Confirm and apply
  const handleConfirmApply = async (patchData: any) => {
    if (!patchData || !selectedCertificate?.id) return;
    setVerifySending(true);
    try {
      const id = selectedCertificate.id;

      // optimistic local update
      setCertificateRawMap((prev) => ({ ...prev, [id]: { ...(prev[id] ?? {}), status: 'APROBADO', xlsx_object: patchData.xlsx_object, legal_representative: patchData.legal_representative, workers_representative: patchData.workers_representative } }));
      setRows((prev) => prev.map((r) => (r.id === id ? { ...r, fecha: String(patchData.course_period) } : r)));
      setEditModalOpened(false);

      const prevRaw = certificateRawMap[id] ?? {};

      // construir entries para enviar
      const entries: any[] = [];
      try {
        const associations = Array.isArray(prevRaw?.certificate_courses) ? prevRaw.certificate_courses : [];
        for (const u of selectedRowUsers) {
          const match = associations.find((a: any) => {
            const aname = (a?.course?.name ?? a?.course_name ?? '').toString().trim();
            const uname = (u.cursoInteres ?? '').toString().trim();
            return aname && uname && aname === uname;
          });
          const prevStart = match?.start ?? match?.fecha_inicio ?? '';
          const prevEnd = match?.end ?? match?.fecha_fin ?? '';
          const prevStartNorm = String(prevStart ?? '').slice(0, 10);
          const prevEndNorm = String(prevEnd ?? '').slice(0, 10);
          const newStartNorm = String(u.fechaInicio ?? '').slice(0, 10);
          const newEndNorm = String(u.fechaFin ?? '').slice(0, 10);
          const courseId = match?.course?._id ?? match?.course_id ?? match?.course?.id ?? match?._id ?? match?.id ?? undefined;
          if ((prevStartNorm !== newStartNorm || prevEndNorm !== newEndNorm) && courseId) {
            const sIso = toIso(u.fechaInicio) ?? undefined;
            const eIso = toIso(u.fechaFin) ?? undefined;
            if (sIso && eIso) entries.push({ certificate_id: id, course_id: courseId, start: sIso, end: eIso });
          }
        }
      } catch (e) { }

      // patch certificate xlsx if needed
      let certificatePatch: any = {};
      try {
        const prevCursantes = Array.isArray(prevRaw?.xlsx_object?.cursantes) ? prevRaw.xlsx_object.cursantes : [];
        const modifiedCurps = new Set<string>();
        for (const u of selectedRowUsers) {
          const curp = String(u.curp ?? '').trim();
          const prevC = prevCursantes.find((pc: any) => String(pc.curp ?? '').trim().toUpperCase() === curp.toUpperCase());
          const prevStart = prevC?.fecha_inicio ?? prevC?.fechaInicio ?? '';
          const prevEnd = prevC?.fecha_fin ?? prevC?.fechaFin ?? '';
          const prevStartNorm = String(prevStart ?? '').slice(0, 10);
          const prevEndNorm = String(prevEnd ?? '').slice(0, 10);
          const newStartNorm = String(u.fechaInicio ?? '').slice(0, 10);
          const newEndNorm = String(u.fechaFin ?? '').slice(0, 10);
          if (prevStartNorm !== newStartNorm || prevEndNorm !== newEndNorm || (prevC && (
            (String(prevC.nombre ?? '').trim() !== String(u.nombreCompleto ?? '').trim()) ||
            (String(prevC.puesto_trabajo ?? prevC.puestoTrabajo ?? '').trim() !== String(u.puestoTrabajo ?? '').trim()) ||
            (String(prevC.ocupacion_especifica ?? '').trim() !== String(u.ocupacion_especifica ?? '').trim())
          ))) {
            modifiedCurps.add(curp);
          }
        }

        // Determine if other certificate-level fields changed (reps, area, tipo_firma)
        const tipoFirmaToSave = selectedRowUsers[0]?.tipoFirma ?? prevRaw?.xlsx_object?.tipo_firma ?? prevRaw?.tipo_firma ?? 'DIGITAL';
        const repLegalToSave = repLegalAll || prevRaw.legal_representative || undefined;
        const repTrabToSave = repTrabAll || prevRaw.workers_representative || undefined;
        const areaToSave = areaTematicaAll || (prevRaw?.xlsx_object?.area_tematica ?? prevRaw?.area_tematica ?? '6000 Seguridad');

        let newCursantes: any[] | null = null;
        if (modifiedCurps.size > 0) {
          newCursantes = (prevCursantes.length > 0 ? prevCursantes.map((pc: any) => {
            const curp = String(pc.curp ?? '').trim();
            if (modifiedCurps.has(curp)) {
              const u = selectedRowUsers.find(su => String(su.curp ?? '').trim().toUpperCase() === curp.toUpperCase());
              if (u) return { curp: u.curp ?? String(pc.curp ?? '').trim(), nombre: u.nombreCompleto ?? (pc.nombre ?? pc.nombre_completo ?? pc.nombreCompleto ?? ''), puesto_trabajo: u.puestoTrabajo ?? (pc.puesto_trabajo ?? pc.puestoTrabajo ?? pc.puesto ?? ''), ocupacion_especifica: u.ocupacion_especifica ?? (pc.ocupacion_especifica ?? pc.ocupacion ?? '') };
            }
            return { curp: String(pc.curp ?? '').trim(), nombre: pc.nombre ?? pc.nombre_completo ?? pc.nombreCompleto ?? '', puesto_trabajo: pc.puesto_trabajo ?? pc.puestoTrabajo ?? pc.puesto ?? '', ocupacion_especifica: pc.ocupacion_especifica ?? pc.ocupacion ?? '' };
          }) : Array.from(modifiedCurps).map((curp) => {
            const u = selectedRowUsers.find(su => String(su.curp ?? '').trim().toUpperCase() === String(curp).toUpperCase());
            return u ? { curp: u.curp ?? '', nombre: u.nombreCompleto ?? '', puesto_trabajo: u.puestoTrabajo ?? '', ocupacion_especifica: u.ocupacion_especifica ?? '' } : null;
          }).filter(Boolean));
        }

        // Build certificatePatch if there are modified cursantes or other changed certificate-level fields
        const shouldPatchCertificate = (newCursantes && newCursantes.length > 0) || (repLegalToSave && repLegalToSave !== prevRaw.legal_representative) || (repTrabToSave && repTrabToSave !== prevRaw.workers_representative) || (areaToSave && areaToSave !== (prevRaw?.xlsx_object?.area_tematica ?? prevRaw?.area_tematica)) || (tipoFirmaToSave && tipoFirmaToSave !== (prevRaw?.xlsx_object?.tipo_firma ?? prevRaw?.tipo_firma));

        if (shouldPatchCertificate) {
          const xlsxObj = { ...(prevRaw.xlsx_object ?? {}) } as any;
          // apply cursantes changes if any
          if (newCursantes && newCursantes.length > 0) xlsxObj.cursantes = newCursantes;
          // always set area and tipo_firma when patching certificate-level fields
          // ensure tipo_firma is taken from selectedRowUsers if present, otherwise fallback to previous values
          xlsxObj.area_tematica = areaToSave;
          xlsxObj.tipo_firma = tipoFirmaToSave;

          certificatePatch = { ...(certificatePatch ?? {}), status: 'APROBADO', xlsx_object: xlsxObj };
          if (repLegalToSave) certificatePatch.legal_representative = repLegalToSave;
          if (repTrabToSave) certificatePatch.workers_representative = repTrabToSave;
        }
      } catch (e) { }

      try {
        if (id) {
          // Enviar solo las entradas que realmente cambiaron (calculadas en `entries` más arriba)
          if (entries && entries.length > 0) {
            try {
              await BasicPetition({ endpoint: '/certificate-course/bulk', method: 'PATCH', data: { data: entries }, showNotifications: false });
            } catch (postErr: any) {
              showNotification({ title: 'Error', message: 'No se pudieron actualizar las asociaciones en bulk', color: 'red' });
            }
          }
        }
      } catch (e) {
        showNotification({ title: 'Error', message: 'No se pudieron actualizar las fechas de cursos', color: 'red' });
      }

      try {
        if (certificatePatch && Object.keys(certificatePatch).length > 0 && id) {
          await BasicPetition({ endpoint: `/certificate/${id}`, method: 'PATCH', data: certificatePatch, showNotifications: false });
        }
      } catch (e) {
        showNotification({ title: 'Error', message: 'No se pudo actualizar la constancia en el servidor', color: 'red' });
      }

      await fetchCertificates();
      showNotification({ title: 'Validación completada', message: 'La constancia ha sido validada exitosamente.', color: 'green' });
    } catch (err: any) {
      showNotification({ title: 'Error', message: 'No se pudo aplicar la validación', color: 'red' });
    } finally {
      setVerifySending(false);
    }
  };

  async function imageUrlToDataUrl(url: string): Promise<string | undefined> {
    try {
      const res = await fetch(url);
      const blob = await res.blob();
      return await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    } catch {
      return undefined;
    }
  }

  // Función para recortar el espacio en blanco de una imagen
  async function trimImageWhitespace(dataUrl: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(dataUrl);
          return;
        }

        // Dibujar imagen en canvas temporal
        canvas.width = img.width;
        canvas.height = img.height;
        ctx.drawImage(img, 0, 0);

        // Obtener datos de píxeles
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const pixels = imageData.data;

        // Encontrar límites del contenido (no blanco/transparente)
        let minX = canvas.width;
        let minY = canvas.height;
        let maxX = 0;
        let maxY = 0;

        for (let y = 0; y < canvas.height; y++) {
          for (let x = 0; x < canvas.width; x++) {
            const i = (y * canvas.width + x) * 4;
            const r = pixels[i];
            const g = pixels[i + 1];
            const b = pixels[i + 2];
            const a = pixels[i + 3];

            // Si no es blanco (rgb > 240) ni transparente (a < 10)
            if (!(r > 240 && g > 240 && b > 240) && a > 10) {
              if (x < minX) minX = x;
              if (x > maxX) maxX = x;
              if (y < minY) minY = y;
              if (y > maxY) maxY = y;
            }
          }
        }

        // Si no encontró contenido, devolver original
        if (minX > maxX || minY > maxY) {
          resolve(dataUrl);
          return;
        }

        // Añadir un pequeño padding
        const padding = 25;
        minX = Math.max(0, minX - padding);
        minY = Math.max(0, minY - padding);
        maxX = Math.min(canvas.width - 1, maxX + padding);
        maxY = Math.min(canvas.height - 1, maxY + padding);

        // Crear canvas recortado
        const trimmedWidth = maxX - minX + 1;
        const trimmedHeight = maxY - minY + 1;
        const trimmedCanvas = document.createElement('canvas');
        trimmedCanvas.width = trimmedWidth;
        trimmedCanvas.height = trimmedHeight;
        const trimmedCtx = trimmedCanvas.getContext('2d');

        if (!trimmedCtx) {
          resolve(dataUrl);
          return;
        }

        // Copiar región recortada
        trimmedCtx.drawImage(
          canvas,
          minX, minY, trimmedWidth, trimmedHeight,
          0, 0, trimmedWidth, trimmedHeight
        );

        // Convertir a dataUrl
        resolve(trimmedCanvas.toDataURL('image/png'));
      };
      img.onerror = () => resolve(dataUrl);
      img.src = dataUrl;
    });
  }

  const generateLista = async (row: Row) => {
    if (!row.id) return;
    const raw = certificateRawMap[row.id];
    if (!raw) {
      showNotification({
        title: "Error",
        message: "No se encontró la información completa de la constancia",
        color: "red",
      });
      return;
    }
    try {
      const cursantes: any[] = raw.xlsx_object?.cursantes ?? [];
      if (!Array.isArray(cursantes) || cursantes.length === 0) {
        showNotification({
          title: "Atención",
          message: "No hay cursantes para esta constancia",
          color: "yellow",
        });
        return;
      }

      // Obtener todos los cursos asociados
      const certificateCourses = Array.isArray(raw?.certificate_courses) ? raw.certificate_courses : [];

      // Si no hay cursos asociados, usar datos del certificado principal
      if (certificateCourses.length === 0) {
        const courseNameFromCertificate = raw?.course_name ?? raw?.course?.name ?? "";
        const xlsxPeriod = raw?.xlsx_object?.course_period;
        let effectivePeriod = xlsxPeriod ?? raw?.course_period ?? "";
        if (!effectivePeriod) {
          const firstC = cursantes[0];
          if (firstC) {
            const a = firstC.fecha_inicio ?? firstC.fechaInicio ?? "";
            const b = firstC.fecha_fin ?? firstC.fechaFin ?? "";
            if (a || b) effectivePeriod = `${a} / ${b}`;
          }
        }
        certificateCourses.push({
          course: { name: courseNameFromCertificate },
          course_name: courseNameFromCertificate,
          start: effectivePeriod.split('/')[0]?.trim() ?? '',
          end: effectivePeriod.split('/')[1]?.trim() ?? '',
        });
      }

      const logoDataUrl = await imageUrlToDataUrl("logo.png");

      // Cargar firma digital si aplica
      let signatureDataUrl: string | undefined = undefined;
      try {
        const signId = raw?.sign ?? raw?.trainer?.sign ?? undefined;

        if (signatureCache.has(signId)) {
          signatureDataUrl = signatureCache.get(signId);
        } else {
          const driveUrl = `${appConfig.BACKEND_URL}/google/proxy-drive?id=${encodeURIComponent(signId)}`;
          const resp = await fetch(driveUrl);
          if (resp.ok) {
            const blob = await resp.blob();
            const rawDataUrl = await new Promise<string>((resolve, reject) => {
              const reader = new FileReader();
              reader.onloadend = () => resolve(String(reader.result));
              reader.onerror = reject;
              reader.readAsDataURL(blob);
            });
            // Recortar espacios en blanco
            signatureDataUrl = await trimImageWhitespace(rawDataUrl);
            signatureCache.set(signId, signatureDataUrl);
          }

        }
      } catch (e) {
        signatureDataUrl = undefined;
      }

      // Generar una página por cada curso
      const pages: any[] = [];

      certificateCourses.forEach((courseItem: any, courseIndex: number) => {
        const courseName = courseItem?.course?.name ?? courseItem?.course_name ?? '';
        const courseStart = courseItem?.start ?? courseItem?.fecha_inicio ?? '';
        const courseEnd = courseItem?.end ?? courseItem?.fecha_fin ?? '';
        const coursePeriod = (courseStart || courseEnd) ? `${courseStart || ''}${courseStart && courseEnd ? ' / ' : ''}${courseEnd || ''}` : '';

        const headerTableBody = [
          [
            { text: "Empresa", bold: true, border: [false, false, false, false] },
            { text: raw.company_name ?? "", border: [false, false, false, false] },
          ],
          [
            { text: "Curso", bold: true, border: [false, false, false, false] },
            {
              border: [true, true, true, true],
              fillColor: '#549afbff',
              stack: [
                { text: courseName || '', bold: true, fontSize: 10, margin: [8, 6, 8, 2] },
                { text: coursePeriod || '', fontSize: 9, margin: [8, 2, 8, 6] },
              ],
            },
          ],
          [
            { text: "Agente Capacitador", bold: true, border: [false, false, false, false] },
            { text: raw.trainer_fullname ?? "", border: [false, false, false, false] },
          ],
          [
            { text: "Registro", bold: true, border: [false, false, false, false] },
            { text: raw.stps ?? raw._id ?? "", border: [false, false, false, false] },
          ],
        ];

        const tableBody: any[] = [];
        tableBody.push([
          { text: "#", bold: true, alignment: "center" },
          { text: "NOMBRE COMPLETO", bold: true },
          { text: "CURP", bold: true },
          { text: "PUESTO DE TRABAJO", bold: true },
          { text: "FIRMA", bold: true },
        ]);

        cursantes.forEach((c, i) => {
          tableBody.push([
            { text: String(i + 1), alignment: "center" },
            { text: (c.nombre ?? "").toString().toUpperCase() },
            { text: (c.curp ?? "").toString().toUpperCase() },
            { text: (c.puesto_trabajo ?? "").toString().toUpperCase() },
            { text: "" },
          ]);
        });

        const pageContent = [
          {
            columns: [
              { width: 120, image: logoDataUrl, margin: [0, 0, 0, 0] },
              {
                width: "*",
                stack: [
                  {
                    text: "Registro de curso DOGROUP",
                    style: "title",
                    margin: [0, 0, 0, 8],
                    alignment: "right",
                  },
                  {
                    table: { widths: ["auto", "*"], body: headerTableBody },
                    layout: "noBorders",
                  },
                ],
                margin: [24, 0, 0, 0],
              },
            ],
            columnGap: 36,
            margin: [0, 0, 0, 12],
          },
          {
            table: {
              headerRows: 1,
              widths: [30, "*", 150, 120, 80],
              body: tableBody,
            },
            layout: {
              fillColor: (rowIndex: number) => (rowIndex === 0 ? "#CCCCCC" : null),
            },
          },
          { text: "\n\n" },
          {
            columns: [
              {
                width: "50%",
                stack: [
                  { text: "Instructor", bold: true, alignment: "center" },
                  { text: (raw.trainer_fullname ?? "").toString().toUpperCase(), alignment: "center" },
                  { text: "\n" },
                  {
                    stack: [
                      // Espacio para la firma
                      { text: "\n", margin: [0, 0, 0, 30] },
                      // Línea de firma
                      {
                        canvas: [
                          { type: "line", x1: 0, y1: 0, x2: 200, y2: 0, lineWidth: 1 },
                        ],
                        margin: [0, 0, 0, 4],
                        alignment: "center",
                      },
                      { text: "Firma", margin: [0, 4, 0, 0], alignment: "center" },
                    ],
                  },
                  // Imagen de firma superpuesta con posición relativa
                  ...(signatureDataUrl ? [
                    {
                      image: signatureDataUrl,
                      width: 120,
                      height: 50,
                      alignment: "center",
                      relativePosition: { x: 0, y: -65 },
                    },
                  ] : []),
                ],
                alignment: "center",
              },
              {
                width: "50%",
                stack: [
                  {
                    text: "Capacitación/ Representante",
                    bold: true,
                    alignment: "center",
                  },
                  { text: (raw.legal_representative ?? "").toString().toUpperCase(), alignment: "center" },
                  { text: "\n" },
                  { text: "\n", margin: [0, 0, 0, 30] },
                  {
                    canvas: [
                      { type: "line", x1: 0, y1: 0, x2: 200, y2: 0, lineWidth: 1 },
                    ],
                    margin: [0, 0, 0, 4],
                    alignment: "center",
                  },
                  { text: "Firma", margin: [0, 4, 0, 0], alignment: "center" },
                ],
                alignment: "center",
              },
            ],
            margin: [0, 28, 0, 0],
            columnGap: 10,
            alignment: "center",
          },
        ];

        // Agregar salto de página si no es el último curso
        if (courseIndex < certificateCourses.length - 1) {
          pages.push(pageContent, { text: '', pageBreak: 'after' });
        } else {
          pages.push(pageContent);
        }
      });

      const docDefinition: any = {
        pageSize: "A4",
        pageMargins: [40, 30, 40, 30],
        content: pages,
        styles: { title: { fontSize: 14, bold: true, alignment: "center" } },
        defaultStyle: { fontSize: 9 },
      };

      pdfMake.createPdf(docDefinition).download(`lista_${raw._id ?? "lista"}.pdf`);
    } catch (err) {
      showNotification({
        title: "Error",
        message: "No se pudo generar el PDF",
        color: "red",
      });
    }
  };

  // Generar PDFs: re-fetch certificate like ConstanciasEmpresa and pass certificate_courses + cursantes with overrides
  const handleGeneratePDFs = async (row: Row) => {
    if (!row.id) return;
    try {
      const res = await BasicPetition<any>({ endpoint: '/certificate', method: 'GET', params: { id: row.id }, showNotifications: false });
      let item = res ?? null;
      if (Array.isArray(res)) {
        if (res.length === 0) item = null;
        else {
          const found = res.find((x: any) => String(x._id ?? x.id) === String(row.id));
          item = found ?? res[0];
        }
      }
      if (!item) { showNotification({ title: 'No encontrado', message: 'No se encontró la constancia solicitada', color: 'yellow' }); return; }

      // Construir datos para generar ZIP con constancias (mismo patrón que ConstanciasEmpresa)
      const certificateData: DC3CertificateData = {
        id: item._id ?? item.id ?? row.id,
        company_name: item.company_name ?? '',
        rfc: item.user_rfc ?? undefined,
        company_rfc: item.company_rfc ?? undefined,
        course_name: item.course_name ?? item.course?.name ?? '',
        course_duration: item.course_duration ?? item.course?.duration ?? '',
        course_period: item.course_period ?? '',
        trainer_fullname: item.trainer_fullname ?? '',
        stps: item.stps ?? item._id ?? '',
        legal_representative: item.legal_representative ?? '',
        workers_representative: item.workers_representative ?? '',
        area_tematica: item.xlsx_object?.area_tematica ?? item.area_tematica ?? '6000 Seguridad',
        course_id: item.course_id ?? item.course?._id ?? item.course?.id ?? undefined,
        // NO incluir tipo_firma en la raíz, solo debe estar en xlsx_object para evitar que el spread lo sobrescriba
        certificate_courses: item.certificate_courses ?? undefined,
        sign: item.sign ?? undefined,
        xlsx_object: item.xlsx_object ?? undefined,
      } as any;

      // Preferir el XLSX almacenado en backend para esta petición
      const sourceXlsx = item.xlsx_object ?? undefined;
      const rawCursantes = Array.isArray(sourceXlsx?.cursantes) ? sourceXlsx.cursantes : [];

      if (!rawCursantes || rawCursantes.length === 0) {
        showNotification({ title: 'Atención', message: 'No se encontraron cursantes en el XLSX para generar las constancias.', color: 'yellow' });
        return;
      }

      const cursantes: Array<DC3User & { certificate_overrides?: Partial<DC3CertificateData> }> = [];

      rawCursantes.forEach((c: any) => {
        // Si hay certificate_courses disponibles y hay más de uno, generar un PDF por cada curso
        if (Array.isArray(item.certificate_courses) && item.certificate_courses.length > 0) {
          const cursoInteres = c.curso_interes ?? c.cursoInteres ?? '';

          // Si el cursante tiene curso_interes específico, solo generar para ese curso
          if (cursoInteres) {
            const matchedCourse = item.certificate_courses.find((cc: any) => {
              const ccName = cc?.course?.name ?? cc?.course_name ?? '';
              return ccName === cursoInteres;
            });

            if (matchedCourse) {
              const courseIdForCursante = matchedCourse?.course?._id ?? matchedCourse?.course_id ?? matchedCourse?.course?.id ?? undefined;
              const courseNameForCursante = matchedCourse?.course?.name ?? matchedCourse?.course_name ?? undefined;
              const courseDurationForCursante = matchedCourse?.course?.duration ?? matchedCourse?.duration ?? undefined;
              const startDate = matchedCourse?.start ?? '';
              const endDate = matchedCourse?.end ?? '';
              const coursePeriodForCursante = (startDate && endDate) ? `${startDate} / ${endDate}` : undefined;

              cursantes.push({
                nombre: c.nombre ?? c.nombre_completo ?? c.nombreCompleto ?? '',
                curp: c.curp ?? '',
                puesto_trabajo: c.puesto_trabajo ?? c.puestoTrabajo ?? c.puesto ?? '',
                ocupacion_especifica: c.ocupacion_especifica ?? c.ocupacionEspecifica ?? c.ocupacion ?? '',
                certificate_overrides: {
                  trainer_fullname: c.capacitador ?? undefined,
                  course_name: courseNameForCursante,
                  course_duration: courseDurationForCursante,
                  course_period: coursePeriodForCursante,
                  legal_representative: c.rep_legal ?? undefined,
                  workers_representative: c.rep_trabajadores ?? undefined,
                  course_id: courseIdForCursante,
                },
              });
            }
          } else {
            // Si no tiene curso_interes, generar un PDF por cada curso disponible
            item.certificate_courses.forEach((matchedCourse: any) => {
              const courseIdForCursante = matchedCourse?.course?._id ?? matchedCourse?.course_id ?? matchedCourse?.course?.id ?? undefined;
              const courseNameForCursante = matchedCourse?.course?.name ?? matchedCourse?.course_name ?? undefined;
              const courseDurationForCursante = matchedCourse?.course?.duration ?? matchedCourse?.duration ?? undefined;
              const startDate = matchedCourse?.start ?? '';
              const endDate = matchedCourse?.end ?? '';
              const coursePeriodForCursante = (startDate && endDate) ? `${startDate} / ${endDate}` : undefined;

              cursantes.push({
                nombre: c.nombre ?? c.nombre_completo ?? c.nombreCompleto ?? '',
                curp: c.curp ?? '',
                puesto_trabajo: c.puesto_trabajo ?? c.puestoTrabajo ?? c.puesto ?? '',
                ocupacion_especifica: c.ocupacion_especifica ?? c.ocupacionEspecifica ?? c.ocupacion ?? '',
                certificate_overrides: {
                  trainer_fullname: c.capacitador ?? undefined,
                  course_name: courseNameForCursante,
                  course_duration: courseDurationForCursante,
                  course_period: coursePeriodForCursante,
                  legal_representative: c.rep_legal ?? undefined,
                  workers_representative: c.rep_trabajadores ?? undefined,
                  course_id: courseIdForCursante,
                },
              });
            });
          }
        } else {
          // Sin certificate_courses, usar datos del certificado principal
          const courseIdForCursante = item.course_id ?? item.course?._id ?? item.course?.id ?? undefined;
          const courseNameForCursante = item.course_name ?? item.course?.name ?? undefined;
          const courseDurationForCursante = item.course_duration ?? item.course?.duration ?? undefined;
          const cursanteStart = c.fecha_inicio ?? '';
          const cursanteEnd = c.fecha_fin ?? '';
          const coursePeriodForCursante = (cursanteStart && cursanteEnd) ? `${cursanteStart} / ${cursanteEnd}` : item.course_period ?? undefined;

          cursantes.push({
            nombre: c.nombre ?? c.nombre_completo ?? c.nombreCompleto ?? '',
            curp: c.curp ?? '',
            puesto_trabajo: c.puesto_trabajo ?? c.puestoTrabajo ?? c.puesto ?? '',
            ocupacion_especifica: c.ocupacion_especifica ?? c.ocupacionEspecifica ?? c.ocupacion ?? '',
            certificate_overrides: {
              trainer_fullname: c.capacitador ?? undefined,
              course_name: courseNameForCursante,
              course_duration: courseDurationForCursante,
              course_period: coursePeriodForCursante,
              legal_representative: c.rep_legal ?? undefined,
              workers_representative: c.rep_trabajadores ?? undefined,
              course_id: courseIdForCursante,
            },
          });
        }
      });

      // Garantizar que los campos de firma y capacitador estén presentes
      try {
        const localRaw = (certificateRawMap[row.id ?? ''] ?? {}) as any;
        certificateData.trainer_fullname = certificateData.trainer_fullname || localRaw.trainer_fullname || localRaw.xlsx_object?.trainer_fullname || capacitadorAll || '';
        certificateData.legal_representative = certificateData.legal_representative || localRaw.legal_representative || localRaw.xlsx_object?.rep_legal || repLegalAll || '';
        certificateData.workers_representative = certificateData.workers_representative || localRaw.workers_representative || localRaw.xlsx_object?.rep_trabajadores || repTrabAll || '';

        for (const c of cursantes) {
          c.certificate_overrides = c.certificate_overrides ?? {};
          if (!c.certificate_overrides.trainer_fullname) c.certificate_overrides.trainer_fullname = certificateData.trainer_fullname || undefined;
          if (!c.certificate_overrides.legal_representative) c.certificate_overrides.legal_representative = certificateData.legal_representative || undefined;
          if (!c.certificate_overrides.workers_representative) c.certificate_overrides.workers_representative = certificateData.workers_representative || undefined;
        }
      } catch (e) { /* ignore */ }

      showNotification({ title: 'Generando...', message: 'Generando ZIP con constancias.', color: 'blue', loading: true });

      // Intentar usar template primero, si falla usar método tradicional
      try {
        await generateAndDownloadZipDC3FromTemplate(certificateData, cursantes, `constancias_${certificateData.id}.zip`);
      } catch (templateError) {
      }
    } catch (err: any) {
      const serverData = err?.data ?? err?.originalError?.response?.data ?? err?.response?.data ?? null;
      const serverMessage = serverData ? (typeof serverData === 'string' ? serverData : JSON.stringify(serverData)) : null;
      const message = serverMessage ?? err?.message ?? 'Error al generar PDFs';
      showNotification({ title: 'Error', message: String(message).slice(0, 200), color: 'red' });
    }
  };

  return (
    <Container size="lg" py="lg">
      <Title order={2}>Constancias</Title>
      <Text color="dimmed" mb="md">En esta sección podrás ver las listas enviadas por las empresas y el estado de sus constancias.</Text>

      <ResponsiveDataTable columns={columns} data={rows} initialPageSize={10} actions={(row) => (
        <Group gap={4} align="center">
          <Button size="xs" className="action-btn small-action-btn" onClick={() => { handleVerificar(row); }} style={{ backgroundColor: "var(--olive-green)", color: "white" }}>Verificar</Button>
          <Button size="xs" className="action-btn small-action-btn" onClick={() => void handleGeneratePDFs(row)} style={{ backgroundColor: "var(--olive-green)", color: "white" }}>Generar PDFs</Button>
          <Button
            size="xs"
            className="action-btn small-action-btn"
            onClick={() => void generateLista(row)}
            style={{ backgroundColor: "var(--olive-green)", color: "white" }}
          >
            Lista
          </Button>
          <Button
            size="xs"
            className="action-btn small-action-btn"
            onClick={() => void handleDelete(row)}
            onMouseEnter={() => setDeleteHover(row.id ?? null)}
            onMouseLeave={() => setDeleteHover(null)}
            style={{ 
              backgroundColor: "#d32f2f", 
              color: "white",
              transition: 'filter 120ms ease',
              filter: deleteHover === row.id ? 'brightness(0.8)' : 'none'
            }}
          >
            Eliminar
          </Button>
        </Group>
      )} />

      <Modal opened={editModalOpened} onClose={() => setEditModalOpened(false)} title={`Validar usuarios`} size={isMobile ? '100%' : isTablet ? 'xl' : 'xxl'} centered fullScreen={isMobile} styles={{ body: { maxHeight: "100vh", overflow: "auto" } }}>
        {isMobile && selectedCertificate && (<div style={{ marginBottom: 8 }}><Text fw={700} size="sm">{selectedCertificate.curso}</Text></div>)}

        <div style={{ display: "flex", gap: 16, marginBottom: 12, alignItems: "center", flexDirection: isMobile ? 'column' : 'row', flexWrap: isTablet ? 'wrap' : 'nowrap' }}>
          <Text>Tipo de firma:</Text>
          <Select value={selectedRowUsers[0]?.tipoFirma || "DIGITAL"} onChange={(v) => v && handleApplyToAll('tipoFirma', v)} data={["DIGITAL", "FISICA"]} style={{ width: 150 }} />

          <div style={{ display: "flex", gap: 8, alignItems: "center", marginLeft: 8, width: isMobile ? '100%' : undefined }}>
            <Text>Rep Legal:</Text>
            <TextInput value={repLegalAll} onChange={(e) => setRepLegalAll(String(e.currentTarget.value).toUpperCase())} style={{ width: isMobile ? '100%' : isTablet ? 180 : 240 }} />
          </div>

          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <Text>Rep Trabajadores:</Text>
            <TextInput value={repTrabAll} onChange={(e) => setRepTrabAll(String(e.currentTarget.value).toUpperCase())} style={{ width: isMobile ? '100%' : isTablet ? 180 : 240 }} />
          </div>

          <div style={{ display: "flex", gap: 8, alignItems: "center", width: isMobile ? '100%' : undefined }}>
            <Text>Área temática:</Text>
            <Select value={areaTematicaAll} onChange={(v) => v && setAreaTematicaAll(v)} data={['6000 Seguridad', '1000 Producción general', '2000 Servicios', '3000 Administración, contabilidad y economía', '4000 Comercialización', '5000 Mantenimiento y reparación', '7000 Desarrollo personal y familiar', '8000 Uso de tecnologías de la información y comunicación', '9000 Participación Social']} style={{ width: isMobile ? '100%' : isTablet ? 200 : 220 }} />
          </div>
        </div>

        <div style={{ overflowX: "auto" }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12 }}>
            <TextInput placeholder="Buscar por nombre o CURP" value={searchQuery} onChange={(e) => setSearchQuery(e.currentTarget.value)} style={{ flex: 1 }} />
            {groupKeys.length > 1 && (
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <Select value={String(pageSize)} onChange={(v) => { if (v) { setPageSize(Number(v)); setCurrentPage(1); } }} data={["5", "10", "20", "50"]} style={{ width: 110 }} placeholder="Reg/pág" />
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <Button size="xs" onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}>Prev</Button>
                  <Text size="sm">{safePage} / {totalPages}</Text>
                  <Button size="xs" onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}>Next</Button>
                </div>
              </div>
            )}
          </div>

          {selectedRowUsers.length > 0 && selectedCertificate && (() => {
            const keys = filteredKeys;
            const uniqueCourseNames = new Set<string>(selectedRowUsers.map(u => (u.cursoInteres || '').toString().trim()).filter(Boolean));
            // Deshabilitar showTopCourse para permitir edición individual de fechas
            const showTopCourse = false;
            const keysToShow = keys.length === 1 ? keys : pagedKeys;

            if (keys.length === 0) return (<div style={{ padding: 20, textAlign: 'center' }}><Text color="dimmed">No hay coincidencias</Text></div>);

            return (
              <div>
                {showTopCourse && (() => {
                  const onlyCourseName = Array.from(uniqueCourseNames)[0] || '';
                  const firstMatch = selectedRowUsers.find(u => (u.cursoInteres || '').toString().trim() === onlyCourseName);
                  const topStart = fechaInicioAll || firstMatch?.fechaInicio || '';
                  const topEnd = fechaFinAll || firstMatch?.fechaFin || '';
                  return (
                    <div style={{ marginBottom: 12, padding: 8, border: '1px solid #e6e6e6', borderRadius: 6 }}>
                      <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 6 }}>
                        <div style={{ flex: 1, fontWeight: 700 }}>{onlyCourseName}</div>
                        <div style={{ width: 200, textAlign: 'center' }}><Text style={{ fontSize: 12, fontWeight: 700 }}>Fecha inicio</Text></div>
                        <div style={{ width: 200, textAlign: 'center' }}><Text style={{ fontSize: 12, fontWeight: 700 }}>Fecha fin</Text></div>
                      </div>
                      <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                        <div style={{ flex: 1 }} />
                        <div style={{ width: 200 }}>
                          <TextInput type="date" value={topStart || ''} onChange={(e) => { const v = e.currentTarget.value; selectedRowUsers.forEach((su, idx) => { if ((su.cursoInteres || '').toString().trim() === onlyCourseName) handleUserChange(idx, 'fechaInicio', v); }); }} />
                        </div>
                        <div style={{ width: 200 }}>
                          <TextInput type="date" value={topEnd || ''} onChange={(e) => { const v = e.currentTarget.value; selectedRowUsers.forEach((su, idx) => { if ((su.cursoInteres || '').toString().trim() === onlyCourseName) handleUserChange(idx, 'fechaFin', v); }); }} />
                        </div>
                      </div>
                    </div>
                  );
                })()}

                {keysToShow.map(k => {
                  const g = groupsMap[k];
                  const sample = g.sample as any;
                  return (
                    <div key={k} style={{ marginBottom: 18, paddingBottom: 8, borderBottom: '1px solid #eee' }}>
                      <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 8 }}>
                        <div style={{ flex: 3 }}>
                          <TextInput value={sample.nombreCompleto} onChange={(e) => { handleApplyToAll('nombreCompleto', String(e.currentTarget.value).toUpperCase()); }} />
                        </div>
                        <div style={{ width: 180 }}>
                          <TextInput value={sample.curp} onChange={(e) => { handleApplyToAll('curp', String(e.currentTarget.value).toUpperCase()); }} />
                        </div>
                        <div style={{ flex: 2 }}>
                          <TextInput value={sample.puestoTrabajo} onChange={(e) => { handleApplyToAll('puestoTrabajo', String(e.currentTarget.value).toUpperCase()); }} />
                        </div>
                        <div style={{ width: 220 }}>
                          <Select
                            value={sample.ocupacion_especifica}
                            onChange={(v) => {
                              if (!v) return;
                              // actualizar solo los usuarios de este grupo (g.indices)
                              setSelectedRowUsers((prev: any[]) => {
                                const copy = [...prev];
                                const indices: number[] = Array.isArray(g.indices) ? g.indices : [];
                                indices.forEach((ix) => {
                                  if (!copy[ix]) return;
                                  copy[ix] = { ...copy[ix], ocupacion_especifica: v };
                                });
                                return copy;
                              });
                            }}
                            data={["01 Cultivo, crianza y aprovechamiento", "02 Extracción y suministro", "03 Construcción", "04 Tecnología", "05 Procesamiento y fabricación", "06 Transporte", "07 Provisión de bienes y servicios", "08 Gestión y soporte administrativo", "09 Salud y protección social", "10 Comunicación", "11 Desarrollo y extensión del conocimiento"]}
                          />
                        </div>
                      </div>

                      {!showTopCourse && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                          <div style={{ display: 'flex', gap: 12, alignItems: 'center', fontWeight: 700 }}>
                            <div style={{ flex: 1 }}>Curso</div>
                            <div style={{ width: 200, textAlign: 'center' }}>Fecha inicio</div>
                            <div style={{ width: 200, textAlign: 'center' }}>Fecha fin</div>
                          </div>
                          {(() => {
                            // Precomputar conteo de fechas de inicio y rangos para detectar conflictos entre cursos del mismo usuario
                            // Solo aplicar si este cursante tiene múltiples cursos (g.indices.length > 1)
                            const hasMultipleCourses = g.indices.length > 1;
                            const startCounts: Record<string, number> = {};
                            const ranges: Array<{ start: string; end: string }> = [];

                            if (hasMultipleCourses) {
                              g.indices.forEach((ix2) => {
                                const it2 = selectedRowUsers[ix2] ?? {};
                                const s = String(it2.fechaInicio ?? '').trim();
                                const e = String(it2.fechaFin ?? '').trim();
                                if (s) startCounts[s] = (startCounts[s] ?? 0) + 1;
                                ranges.push({ start: s, end: e });
                              });
                            }

                            const parseYmd = (s: string) => {
                              if (!s) return null;
                              const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
                              if (!m) return null;
                              return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
                            };

                            const rangesOverlap = (aStart: string, aEnd: string, bStart: string, bEnd: string) => {
                              const as = parseYmd(aStart);
                              const bs = parseYmd(bStart);
                              if (!as || !bs) return false;
                              const ae = parseYmd(aEnd) ?? as;
                              const be = parseYmd(bEnd) ?? bs;
                              // ahora compare usando getTime() y as/bs garantizados
                              return !(ae!.getTime() < bs.getTime() || be!.getTime() < as.getTime());
                            };

                            return g.indices.map((ix, ci) => {
                              const item = selectedRowUsers[ix];
                              const courseLabel = item.cursoInteres || '';
                              const inicio = String(item.fechaInicio ?? '').trim();
                              const fin = String(item.fechaFin ?? '').trim();

                              // Solo detectar conflictos si hay múltiples CURSOS DIFERENTES para este cursante
                              let isConflict = false;
                              if (hasMultipleCourses) {
                                // Verificar que los cursos sean diferentes
                                const coursesInGroup = g.indices.map(idx => String(selectedRowUsers[idx]?.cursoInteres ?? '').trim()).filter(Boolean);
                                const uniqueCoursesInGroup = new Set(coursesInGroup);

                                // Solo marcar conflicto si hay múltiples cursos diferentes
                                if (uniqueCoursesInGroup.size > 1) {
                                  // mismo inicio repetido
                                  const sameStartCount = inicio ? (startCounts[inicio] ?? 0) : 0;
                                  let overlaps = false;
                                  for (let j = 0; j < ranges.length; j++) {
                                    if (j === ci) continue;
                                    const r = ranges[j];
                                    if (rangesOverlap(inicio, fin, r.start, r.end)) { overlaps = true; break; }
                                  }
                                  isConflict = (sameStartCount > 1) || overlaps;
                                }
                              }

                              return (
                                <div key={String(ci) + '_' + String(ix)} style={{ display: 'flex', gap: 12, alignItems: 'center', backgroundColor: isConflict ? '#fff6f6' : undefined, padding: isConflict ? '6px 8px' : undefined, borderRadius: isConflict ? 6 : undefined }} title={isConflict ? 'Conflicto de fechas: este cursante tiene otro curso en la misma fecha o con rangos solapados' : undefined}>
                                  <div style={{ flex: 1, padding: '8px 0' }}>{courseLabel}</div>
                                  <div style={{ width: 200 }}>
                                    <TextInput type="date" value={item.fechaInicio || ''} onChange={(e) => handleUserChange(ix, 'fechaInicio', e.currentTarget.value)} />
                                  </div>
                                  <div style={{ width: 200 }}>
                                    <TextInput type="date" value={item.fechaFin || ''} onChange={(e) => handleUserChange(ix, 'fechaFin', e.currentTarget.value)} />
                                  </div>
                                </div>
                              );
                            });
                          })()}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })()}
        </div>

        {(() => {
          // Detectar si hay algún conflicto de fechas en cursantes con múltiples cursos DIFERENTES
          let hasAnyConflict = false;
          const groupedByName: Record<string, number[]> = {};
          selectedRowUsers.forEach((u, ix) => {
            const name = String(u.nombre ?? '').trim();
            if (!groupedByName[name]) groupedByName[name] = [];
            groupedByName[name].push(ix);
          });

          Object.values(groupedByName).forEach((indices) => {
            // Solo verificar conflictos si este cursante tiene múltiples cursos
            if (indices.length <= 1) return;

            // Verificar si los cursos son diferentes (no solo múltiples registros del mismo curso)
            const uniqueCourses = new Set<string>();
            indices.forEach((ix2) => {
              const it2 = selectedRowUsers[ix2] ?? {};
              const courseName = String(it2.cursoInteres ?? '').trim();
              if (courseName) uniqueCourses.add(courseName);
            });

            // Si todos los registros son del mismo curso, no hay conflicto (múltiples cursantes en un curso)
            if (uniqueCourses.size <= 1) return;

            const startCounts: Record<string, number> = {};
            const ranges: Array<{ start: string; end: string }> = [];
            indices.forEach((ix2) => {
              const it2 = selectedRowUsers[ix2] ?? {};
              const s = String(it2.fechaInicio ?? '').trim();
              const e = String(it2.fechaFin ?? '').trim();
              if (s) startCounts[s] = (startCounts[s] ?? 0) + 1;
              ranges.push({ start: s, end: e });
            });

            const parseYmd = (s: string) => {
              if (!s) return null;
              const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
              if (!m) return null;
              return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
            };

            const rangesOverlap = (aStart: string, aEnd: string, bStart: string, bEnd: string) => {
              const as = parseYmd(aStart);
              const bs = parseYmd(bStart);
              if (!as || !bs) return false;
              const ae = parseYmd(aEnd) ?? as;
              const be = parseYmd(bEnd) ?? bs;
              return !(ae!.getTime() < bs.getTime() || be!.getTime() < as.getTime());
            };

            indices.forEach((ix, ci) => {
              const item = selectedRowUsers[ix];
              const inicio = String(item.fechaInicio ?? '').trim();
              const fin = String(item.fechaFin ?? '').trim();
              const sameStartCount = inicio ? (startCounts[inicio] ?? 0) : 0;
              let overlaps = false;
              for (let j = 0; j < ranges.length; j++) {
                if (j === ci) continue;
                const r = ranges[j];
                if (rangesOverlap(inicio, fin, r.start, r.end)) { overlaps = true; break; }
              }
              if ((sameStartCount > 1) || overlaps) {
                hasAnyConflict = true;
              }
            });
          });

          return hasAnyConflict ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 16px', backgroundColor: '#fff6f6', border: '1px solid #ff6b6b', borderRadius: 6, marginTop: 12, color: '#c92a2a' }}>
              <FaExclamationTriangle size={20} style={{ flexShrink: 0 }} />
              <Text size="sm" style={{ color: '#c92a2a', fontWeight: 500 }}>
                Hay cursantes con múltiples cursos que tienen conflicto de fechas (misma fecha o rangos solapados). Revisa los cursos marcados en rojo.
              </Text>
            </div>
          ) : null;
        })()}

        <div style={{ display: "flex", justifyContent: "center", gap: 12, marginTop: 12 }}>
          <div style={{ display: 'flex', gap: 12 }}>
            <Button onClick={async () => await handleValidate()} loading={verifySending} disabled={verifySending} style={{ background: verifySending ? '#cccccc' : 'var(--olive-green)', color: 'white' }}>Validar</Button>
          </div>
        </div>
      </Modal>
    </Container>
  );
}

export default ConstanciasAdminPage;