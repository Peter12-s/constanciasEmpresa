import { useState, useEffect } from 'react';
import {
    Container,
    Title,
    Badge,
    Button,
    Text,
    Modal,
    TextInput,
    FileInput,
    Select,
    MultiSelect
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { showNotification } from '@mantine/notifications';
import { BasicPetition } from '../core/petition';
import { ResponsiveDataTable, type Column } from "../components/ResponsiveDataTable";
import { generateAndDownloadZipDC3, type DC3User, type DC3CertificateData } from '../components/createPDF';
import { FaFileUpload, FaPlus } from "react-icons/fa";

type Row = {
    id?: string;
    capacitador: string;
    curso: string;
    fecha: string;
    estado: 'pendiente' | 'aprobada';
    courses?: Array<{ course_name: string; start: string; end: string }>;
};

export function ConstanciasEmpresaPage() {
    const [opened, setOpened] = useState(false);
    const [rows, setRows] = useState<Row[]>([]);

    const form = useForm({
        initialValues: {
            plantillaFile: null as File | null,
            excelFile: null as File | null,
            capacitador: '',
            curso: '',
            fechaInicio: '',
            fechaFin: '',
            repLegal: '',
            repTrabajadores: '',
            correo: '',
            whatsapp: '',
        },
        validate: {
            correo: (value) => (/^\S+@\S+\.\S+$/.test(value) ? null : 'Correo inválido'),
            whatsapp: (value) => (value.length >= 7 ? null : 'Número inválido'),
        },
    });

    const [parsedXlsxObject, setParsedXlsxObject] = useState<any | null>(null);
    const [trainers, setTrainers] = useState<any[]>([]);
    const [capacitadorOptions, setCapacitadorOptions] = useState<{ value: string; label: string }[]>([]);
    const [coursesOptions, setCoursesOptions] = useState<{ value: string; label: string }[]>([]);
    const [coursesDisabled, setCoursesDisabled] = useState<boolean>(false);
    const [courseValueMap, setCourseValueMap] = useState<Record<string, string | number>>({});
    const [selectedTrainerId, setSelectedTrainerId] = useState<string | null>(null);
    // estado y formulario para constancia individual (sin Excel)
    const [openedIndividual, setOpenedIndividual] = useState(false);
    const individualForm = useForm({
        initialValues: {
            trainer: '',
            courses_ids: [] as string[],
            fechaInicio: '',
            fechaFin: '',
            nombre: '',
            curp: '',
            puesto_trabajo: '',
            ocupacion_especifica: '',
            repLegal: '',
            repTrabajadores: '',
        },
        validate: {
            // validaciones simples
            nombre: (v) => (v && v.length > 0 ? null : 'Nombre requerido'),
        },
    });
    // fechas por curso para modal individual: { [courseId]: { start, end } }
    const [individualCourseDates, setIndividualCourseDates] = useState<Record<string, { start: string; end: string }>>({});
    // hover states para botones de acción (mejorar feedback visual)
    const [addHoverGroup, setAddHoverGroup] = useState<boolean>(false);
    const [addHoverIndividual, setAddHoverIndividual] = useState<boolean>(false);

    // Deshabilitar botón Crear en modal individual hasta que se llenen los campos requeridos
    const isIndividualSubmitDisabled = () => {
        const v = individualForm.values;
        // campos mínimos: trainer, nombre, curp, puesto_trabajo
    if (!v.trainer || !v.nombre || !v.curp || !v.puesto_trabajo) return true;
    // representantes también requeridos
    if (!v.repLegal || !v.repTrabajadores) return true;
        const selected = Array.isArray(v.courses_ids) ? v.courses_ids : [];
        if (selected.length === 0) return true;
        // por cada curso seleccionado, debe existir fecha inicio y fin
        for (const cid of selected) {
            const dates = individualCourseDates[cid];
            const start = dates?.start ?? '';
            const end = dates?.end ?? '';
            if (!start || !end) return true;
        }
        return false;
    };
    // preview/debug del payload antes de enviar
    const [previewOpen, setPreviewOpen] = useState(false);
    const [previewPayload, setPreviewPayload] = useState<any>(null);
    const [previewSending, setPreviewSending] = useState(false);
    // Preview y envío para petición grupal
    const [groupPreviewOpen, setGroupPreviewOpen] = useState(false);
    const [groupPreviewPayload, setGroupPreviewPayload] = useState<any>(null);
    const [groupPreviewSending, setGroupPreviewSending] = useState(false);

    // (anterior helper toYmd removed — usamos inputToIso para enviar ISO completo requerido por backend)

    // Normaliza entrada a ISO completo (UTC) o null. Acepta Date o strings YYYY-MM-DD o ISO.
    const inputToIso = (input?: string | Date | null): string | null => {
        if (!input) return null;
        if (input instanceof Date) {
            if (isNaN(input.getTime())) return null;
            return input.toISOString();
        }
        const s = String(input);
        // YYYY-MM-DD (convertir a UTC start of day)
        const m = s.match(/^(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})$/);
        if (m) {
            const y = Number(m[1]);
            const mo = Number(m[2]);
            const d = Number(m[3]);
            return new Date(Date.UTC(y, mo - 1, d)).toISOString();
        }
        // intentar parseo directo (ISO u otros formatos aceptables)
        const parsed = Date.parse(s);
        if (!isNaN(parsed)) return new Date(parsed).toISOString();
        return null;
    };

    const sendPreviewPayload = async () => {
        if (!previewPayload) return;
        setPreviewSending(true);
        try {
            // crear la constancia: primero enviar una copia sanitizada (sin cursos)
            const sanitized = JSON.parse(JSON.stringify(previewPayload));
            const preserved = JSON.parse(JSON.stringify(previewPayload));
  
            const createdAny: any = await BasicPetition({ endpoint: '/certificate', method: 'POST', data: sanitized, showNotifications: false });
            const certId = createdAny?._id ?? createdAny?.id ?? (Array.isArray(createdAny) && createdAny.length > 0 ? (createdAny[0]?._id ?? createdAny[0]?.id) : null);
            showNotification({ title: 'Enviado', message: 'Constancia individual creada (desde preview)', color: 'green' });

            // Construir asociaciones en bulk a partir de los inputs del modal individual
            try {
                const entries: any[] = [];
                // individualForm puede contener varios cursos seleccionados
                const rawSelected = Array.isArray(individualForm.values.courses_ids) ? individualForm.values.courses_ids : [];
                const seen = new Set<string>();
                for (const sel of rawSelected) {
                    const mapped = courseValueMap[String(sel)];
                    const courseId = (mapped !== undefined && mapped !== null) ? String(mapped) : String(sel);
                    if (!courseId) continue;
                    // fechas por curso desde individualCourseDates
                    const dates = individualCourseDates[String(sel)] ?? { start: individualForm.values.fechaInicio ?? '', end: individualForm.values.fechaFin ?? '' };
                    const startIso = inputToIso(dates.start ?? null);
                    const endIso = inputToIso(dates.end ?? null);
                    if (certId && courseId && startIso && endIso && !seen.has(courseId)) {
                        entries.push({ certificate_id: certId, course_id: courseId, start: startIso, end: endIso });
                        seen.add(courseId);
                    }
                }

                if (entries.length > 0 && certId) {
                    await BasicPetition({ endpoint: '/certificate-course/bulk', method: 'POST', data: { data: entries }, showNotifications: false });
                    showNotification({ title: 'Cursos asociados', message: 'Cursos asociados correctamente', color: 'green' });
                }
            } catch (err) {
                showNotification({ title: 'Advertencia', message: 'Constancia creada pero no se pudieron asociar los cursos', color: 'yellow' });
            }

            setPreviewOpen(false);
            setOpenedIndividual(false);
            // limpiar formulario individual y estados relacionados
            individualForm.reset();
            setIndividualCourseDates({});
            setCoursesOptions([]);
            setCourseValueMap({});
            setCoursesDisabled(true);
            setSelectedTrainerId(null);
            setParsedXlsxObject(null);

            const idToUse = previewPayload?.certificate_user_id ?? localStorage.getItem('mi_app_user_id') ?? null;
            if (idToUse) void fetchCertificates(idToUse);
            setPreviewPayload(null);
        } catch (err) {
            showNotification({ title: 'Error', message: 'No se pudo crear la constancia (preview)', color: 'red' });
        } finally {
            setPreviewSending(false);
        }
    };

    const sendGroupPayload = async () => {
        if (!groupPreviewPayload) return;
        setGroupPreviewSending(true);
        try {
            // preparar payload: sanitized (sin cursos) y preserved (con cursos) para bulk
            const preserved = JSON.parse(JSON.stringify(groupPreviewPayload));
            const sanitized = JSON.parse(JSON.stringify(groupPreviewPayload));
            try {
                const cursantes = sanitized.xlsx_object?.cursantes ?? [];
                if (Array.isArray(cursantes)) for (const c of cursantes) { if (c && c.cursos) delete c.cursos; }
            } catch (e) { /* ignore */ }

            // crear la petición grupal
            const createdAny: any = await BasicPetition({ endpoint: '/certificate', method: 'POST', data: sanitized, showNotifications: false });
            const certId = createdAny?._id ?? createdAny?.id ?? (Array.isArray(createdAny) && createdAny.length > 0 ? (createdAny[0]?._id ?? createdAny[0]?.id) : null);
            showNotification({ title: 'Enviado', message: 'Petición grupal creada', color: 'green' });

            // crear asociaciones en bulk desde preserved.certificate_courses (nuevo formato) o fallback a preserved.xlsx_object.cursantes
            try {
                const entries: any[] = [];
                // Construir asociación grupal desde los inputs del formulario: un único curso con fechas
                try {
                    const courseRaw = form.values.curso ?? '';
                    const mapped = courseValueMap[String(courseRaw)];
                    const courseId = (mapped !== undefined && mapped !== null) ? String(mapped) : String(courseRaw);
                    const startIso = inputToIso(form.values.fechaInicio ?? null);
                    const endIso = inputToIso(form.values.fechaFin ?? null);
                    if (certId && courseId && startIso && endIso) {
                        entries.push({ certificate_id: certId, course_id: courseId, start: startIso, end: endIso });
                    }
                } catch (e) {
                    // nothing
                }
                if (entries.length > 0 && certId) {
                    await BasicPetition({ endpoint: '/certificate-course/bulk', method: 'POST', data: { data: entries }, showNotifications: false });
                    showNotification({ title: 'Cursos asociados', message: 'Cursos asociados correctamente', color: 'green' });
                }
            } catch (err) {
                showNotification({ title: 'Advertencia', message: 'Petición creada pero no se pudieron asociar los cursos', color: 'yellow' });
            }

            setGroupPreviewOpen(false);
            setOpened(false);
            // limpiar formulario grupal y estados relacionados
            form.reset();
            setParsedXlsxObject(null);
            setCoursesOptions([]);
            setCourseValueMap({});
            setCoursesDisabled(true);
            setSelectedTrainerId(null);
            const idToUse = groupPreviewPayload?.certificate_user_id ?? localStorage.getItem('mi_app_user_id') ?? null;
            if (idToUse) void fetchCertificates(idToUse);
            setGroupPreviewPayload(null);
        } catch (err) {
            showNotification({ title: 'Error', message: 'No se pudo crear la petición grupal', color: 'red' });
        } finally {
            setGroupPreviewSending(false);
        }
    };

    const handleExcelUpload = async (file: File | null) => {
        setParsedXlsxObject(null);
        if (!file) return;
        try {
            const XLSX = await import('xlsx');
            const arrayBuffer = await file.arrayBuffer();
            const workbook = XLSX.read(arrayBuffer, { type: 'array' });
            const firstSheetName = workbook.SheetNames[0];
            const sheet = workbook.Sheets[firstSheetName];
            const rows: any[] = XLSX.utils.sheet_to_json(sheet, { defval: '' });

            // si no hay filas, limpiar selección y pedir otro archivo
            if (!rows || rows.length === 0) {
                showNotification({ title: 'Archivo vacío', message: 'No se detectaron filas en el Excel. Selecciona otro archivo.', color: 'yellow' });
                setParsedXlsxObject(null);
                // limpiar control del FileInput si está ligado al formulario
                try { form.setFieldValue('excelFile', null); } catch (e) { /* ignore if form no accesible */ }
                return;
            }

            // detectar claves de columnas y mapear
            const cursantes = rows.map((r) => {
                const keys = Object.keys(r);
                const findKey = (pred: (k: string) => boolean) => keys.find(k => pred(k.toLowerCase())) as string | undefined;

                const nombreKey = findKey(k => k.includes('nombre') || k.includes('apellido') || k.includes('apell'));
                const curpKey = findKey(k => k.includes('curp') || k.includes('clave') || k.includes('registro'));
                const puestoKey = findKey(k => k.includes('puesto'));
                const ocupKey = findKey(k => k.includes('ocup') || k.includes('ocupación') || k.includes('ocupacion'));

                return {
                    nombre: String(r[nombreKey ?? keys[0]] ?? '').trim(),
                    curp: String(r[curpKey ?? ''] ?? '').trim(),
                    puesto_trabajo: String(r[puestoKey ?? ''] ?? '').trim(),
                    ocupacion_especifica: String(r[ocupKey ?? ''] ?? '').trim(),
                };
            });

            setParsedXlsxObject({ xlsx_object: { cursantes } });
            const parsed = { xlsx_object: { cursantes } };
            setParsedXlsxObject(parsed);
            showNotification({ title: 'Listo', message: `Se detectaron ${cursantes.length} filas`, color: 'green' });
        } catch (err) {
            showNotification({ title: 'Error', message: 'No se pudo parsear el archivo Excel', color: 'red' });
        }
    };

    const fetchTrainers = async (certificate_user_id?: string | null) => {
        try {
            let idToUse = certificate_user_id ?? localStorage.getItem('mi_app_user_id') ?? null;
            if (!idToUse) {
                const token = localStorage.getItem('mi_app_token') ?? null;
                if (token) {
                    try {
                        const part = token.split('.')[1];
                        const base64 = part.replace(/-/g, '+').replace(/_/g, '/');
                        const jsonPayload = decodeURIComponent(atob(base64).split('').map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)).join(''));
                        const parsed = JSON.parse(jsonPayload);
                        idToUse = parsed?._id ?? parsed?.id ?? parsed?.sub ?? idToUse;
                    } catch (e) {
                        // ignore
                    }
                }
            }

            if (!idToUse) {
                // Nunca llamar sin certificate_user_id: avisar y salir
                showNotification({ title: 'Error', message: 'No se pudo obtener el id del usuario. Inicia sesión para continuar.', color: 'red' });
                return;
            }

            const list = await BasicPetition<any[]>({ endpoint: '/trainer', method: 'GET', params: { certificate_user_id: idToUse }, showNotifications: false });
            if (!Array.isArray(list)) return;
            setTrainers(list);
            const options = list.map((t) => {
                const person = t.certificate_person ?? {};
                const label = `${person.f_surname ?? ''} ${person.s_surname ?? ''} ${person.name ?? ''}`.trim();
                return { value: t._id, label: label || (person.name ?? t._id) };
            });
            setCapacitadorOptions(options);
        } catch (err) {
        }
    };

    const columns: Column<Row>[] = [
        { accessor: 'capacitador', label: 'Capacitador' },
        {
            accessor: 'curso',
            label: 'Curso',
            render: (r) => {
                const cs = r.courses ?? [];
                if (cs.length === 0) return r.curso || '';
                // render each course with its period on the next line
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
            accessor: 'estado',
            label: 'Estado',
            render: (r) => (
                <Badge color={r.estado === 'pendiente' ? 'yellow' : 'dark'} variant="filled">
                    {r.estado === 'pendiente' ? 'Pendiente' : 'Aprobada'}
                </Badge>
            ),
        },
    ];

    async function fetchCertificates(certificate_user_id?: string | null) {
        try {
            // determinar id a usar
            let idToUse = certificate_user_id ?? localStorage.getItem('mi_app_user_id') ?? null;

            if (!idToUse) {
                const token = localStorage.getItem('mi_app_token') ?? null;
                if (token) {
                    try {
                        const part = token.split('.')[1];
                        const base64 = part.replace(/-/g, '+').replace(/_/g, '/');
                        const jsonPayload = decodeURIComponent(atob(base64).split('').map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)).join(''));
                        const parsed = JSON.parse(jsonPayload);
                        idToUse = parsed?._id ?? parsed?.id ?? parsed?.sub ?? idToUse;
                    } catch (e) {
                        // ignore
                    }
                }
            }

            if (!idToUse) {
                // Nunca llamar sin certificate_user_id
                showNotification({ title: 'Error', message: 'No se pudo obtener el id del usuario. Inicia sesión para ver tus peticiones.', color: 'red' });
                setRows([]);
                return;
            }

            const list = await BasicPetition<any[]>({ endpoint: '/certificate', method: 'GET', params: { certificate_user_id: idToUse }, showNotifications: false });
            if (!Array.isArray(list)) return;
            // Por cada certificado, obtener asociaciones y construir courses array
            const rowsWithCourses: Row[] = await Promise.all(list.map(async (it) => {
                const certId = it._id ?? it.id ?? null;
                let associations: any[] = [];
                try {
                    // Si el backend ya devuelve las asociaciones embebidas en el objeto, úsalas
                    if (Array.isArray(it.certificate_courses) && it.certificate_courses.length > 0) {
                        associations = it.certificate_courses;
                    } else {
                        // endpoint real que devuelve las asociaciones: `certificate_courses`
                        associations = await BasicPetition<any[]>({ endpoint: '/certificate_courses', method: 'GET', params: { certificate_id: certId }, showNotifications: false }) || [];
                    }
                } catch (e) {
                    associations = [];
                }

                const coursesArr = Array.isArray(associations) ? associations.map(a => ({
                    course_name: a.course?.name ?? a.course_name ?? '',
                    start: String(a.start ?? a.fecha_inicio ?? '').slice(0, 10),
                    end: String(a.end ?? a.fecha_fin ?? '').slice(0, 10),
                })) : [];

                // Construir valores visibles para las columnas usando las asociaciones como fallback
                const allCourseNames = coursesArr.length > 0 ? coursesArr.map(c => c.course_name).filter(Boolean).join(', ') : '';
                const singlePeriod = coursesArr.length === 1 ? `${coursesArr[0].start} / ${coursesArr[0].end}` : '';

                return {
                    id: it._id,
                    capacitador: it.trainer_fullname ?? '',
                    // preferir valores explícitos del recurso, si no existen usar datos extraídos de las asociaciones
                    curso: it.course_name ?? it.course?.name ?? allCourseNames ?? '',
                    fecha: it.course_period ?? singlePeriod ?? '',
                    estado: (String(it.status).toUpperCase() === 'PENDIENTE') ? 'pendiente' : 'aprobada',
                    courses: coursesArr,
                } as Row;
            }));
            setRows(rowsWithCourses);
        } catch (err) {
            setRows([]);
        }
    }

    useEffect(() => {
        // intentar obtener id del usuario y pasar a fetches para filtrar por usuario
        const idFromStorage = localStorage.getItem('mi_app_user_id');
        if (idFromStorage) {
            void fetchCertificates(idFromStorage);
            void fetchTrainers(idFromStorage);
            return;
        }

        // si no hay id en storage, intentar decodificar token
        const token = localStorage.getItem('mi_app_token') ?? null;
        let idToUse: string | null = null;
        if (token) {
            try {
                const part = token.split('.')[1];
                const base64 = part.replace(/-/g, '+').replace(/_/g, '/');
                const jsonPayload = decodeURIComponent(atob(base64).split('').map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)).join(''));
                const parsed = JSON.parse(jsonPayload);
                idToUse = parsed?._id ?? parsed?.id ?? parsed?.sub ?? null;
            } catch (e) {
                // ignore
            }
        }

        if (idToUse) {
            void fetchCertificates(idToUse);
            void fetchTrainers(idToUse);
            return;
        }

        // si no se pudo obtener id, avisar y no hacer llamadas sin filtrar
        showNotification({ title: 'Error', message: 'No se encontró id de usuario. Inicia sesión para ver o crear peticiones.', color: 'red' });
    }, []);

    const handleGenerar = async (row: Row) => {
        // necesitamos el id para pedir el detalle
        const id = row.id;
        if (!id) return;
        try {
            // pedir detalle de la constancia por su id
            const res = await BasicPetition<any>({ endpoint: '/certificate', method: 'GET', params: { id }, showNotifications: false });
            // la respuesta puede ser un array o un objeto; normalizamos a objeto
            let item = res ?? null;
            if (Array.isArray(res)) {
                if (res.length === 0) {
                    item = null;
                } else {
                    // intentar encontrar el elemento que coincida con el id solicitado
                    const found = res.find((x: any) => String(x._id ?? x.id) === String(id));
                    if (!found) {
                        // no confiar en el primer elemento: tratar como no encontrado para evitar mezclar peticiones
                        item = null;
                    } else {
                        item = found;
                    }
                }
            }
            if (!item) {
                showNotification({ title: 'No encontrado', message: 'No se encontró la constancia solicitada', color: 'yellow' });
                return;
            }

            // intentar obtener asociaciones si no vienen embebidas
            let certificate_courses: any[] = Array.isArray(item.certificate_courses) ? item.certificate_courses : [];
            if (!certificate_courses || certificate_courses.length === 0) {
                try {
                    certificate_courses = await BasicPetition<any[]>({ endpoint: '/certificate_courses', method: 'GET', params: { certificate_id: item._id ?? id }, showNotifications: false }) || [];
                } catch (e) {
                    certificate_courses = [];
                }
            }

            // Construir datos para generar ZIP con constancias (mejorado para garantizar firmas y cursos)
            const certificateData: DC3CertificateData = {
                id: item._id ?? item.id ?? id,
                company_name: item.company_name ?? '',
                rfc: item.user_rfc ?? undefined,
                course_name: item.course_name ?? item.course?.name ?? '',
                course_duration: item.course_duration ?? item.course?.duration ?? '',
                course_period: item.course_period ?? '',
                trainer_fullname: item.trainer_fullname ?? '',
                stps: item.stps ?? item._id ?? '',
                legal_representative: item.legal_representative ?? '',
                workers_representative: item.workers_representative ?? '',
                area_tematica: item.xlsx_object?.area_tematica ?? item.area_tematica ?? parsedXlsxObject?.area_tematica ?? '6000 Seguridad',
                tipo_firma: item.xlsx_object?.tipo_firma ?? item.tipo_firma ?? parsedXlsxObject?.xlsx_object?.tipo_firma ?? 'FISICA',
                certificate_courses: certificate_courses && certificate_courses.length > 0 ? certificate_courses : undefined,
                sign: item.sign ?? undefined,
            };

            // Preferir el XLSX almacenado en backend para esta petición; solo usar el XLSX parseado en memoria
            // si el backend no tiene uno (evita mezclar un XLSX global con otras peticiones)
            const sourceXlsx = item.xlsx_object ?? parsedXlsxObject?.xlsx_object ?? {};
            const rawCursantes = Array.isArray(sourceXlsx?.cursantes) ? sourceXlsx.cursantes : [];

            if (!rawCursantes || rawCursantes.length === 0) {
                showNotification({ title: 'Atención', message: 'No se encontraron cursantes en el XLSX para generar las constancias.', color: 'yellow' });
                return;
            }

            const cursantes = rawCursantes.map((c: any) => ({
                nombre: c.nombre ?? c.nombre_completo ?? c.nombreCompleto ?? '',
                curp: c.curp ?? '',
                puesto_trabajo: c.puesto_trabajo ?? c.puestoTrabajo ?? c.puesto ?? '',
                ocupacion_especifica: c.ocupacion_especifica ?? c.ocupacionEspecifica ?? c.ocupacion ?? '',
                // usar el tipo de firma definido a nivel de constancia si existe; esto aplica el mismo tipo a todos los cursantes
                tipo_firma: (item.xlsx_object?.tipo_firma ?? item.tipo_firma ?? parsedXlsxObject?.xlsx_object?.tipo_firma) ?? c.tipo_firma ?? (sourceXlsx?.tipo_firma ?? undefined),
                certificate_overrides: {
                    trainer_fullname: c.capacitador ?? undefined,
                    course_name: c.curso_interes ?? c.cursoInteres ?? undefined,
                    course_period: `${c.fecha_inicio ?? ''} / ${c.fecha_fin ?? ''}`.trim(),
                    legal_representative: c.rep_legal ?? undefined,
                    workers_representative: c.rep_trabajadores ?? undefined,
                },
            })) as Array<DC3User & { certificate_overrides?: Partial<DC3CertificateData> }>;

            // Garantizar que los campos de firma y capacitador estén presentes
            try {
                certificateData.trainer_fullname = certificateData.trainer_fullname || parsedXlsxObject?.xlsx_object?.trainer_fullname || '';
                certificateData.legal_representative = certificateData.legal_representative || parsedXlsxObject?.xlsx_object?.rep_legal || '';
                certificateData.workers_representative = certificateData.workers_representative || parsedXlsxObject?.xlsx_object?.rep_trabajadores || '';

                for (const c of cursantes) {
                    c.certificate_overrides = c.certificate_overrides ?? {};
                    if (!c.certificate_overrides.trainer_fullname) c.certificate_overrides.trainer_fullname = certificateData.trainer_fullname || undefined;
                    if (!c.certificate_overrides.legal_representative) c.certificate_overrides.legal_representative = certificateData.legal_representative || undefined;
                    if (!c.certificate_overrides.workers_representative) c.certificate_overrides.workers_representative = certificateData.workers_representative || undefined;
                }
            } catch (e) { /* ignore */ }
            showNotification({ title: 'Generando...', message: 'Generando ZIP con constancias.', color: 'blue', loading: true });
            await generateAndDownloadZipDC3(certificateData, cursantes, 'logo.png', `constancias_${certificateData.id}.zip`);
        } catch (err: any) {
            try {
                const serverData = err?.data ?? err?.originalError?.response?.data ?? err?.response?.data ?? null;
                const serverMessage = serverData ? (typeof serverData === 'string' ? serverData : JSON.stringify(serverData, null, 2)) : null;
                const message = serverMessage ?? err?.message ?? 'Error al generar PDFs';
                showNotification({ title: 'Error', message: String(message).slice(0, 300), color: 'red' });
            } catch (loggingErr) {
                showNotification({ title: 'Error', message: 'Error al generar PDFs', color: 'red' });
            }
        }
    };

    // validar si todos los campos requeridos están llenos y hay JSON parseado
    const isSubmitDisabled = () => {
        const values = form.values;
        const requiredFilled = Boolean(values.capacitador && values.curso && values.fechaInicio && values.fechaFin && values.repLegal && values.repTrabajadores);
        const hasXlsx = Boolean(parsedXlsxObject && parsedXlsxObject.xlsx_object && Array.isArray(parsedXlsxObject.xlsx_object.cursantes) && parsedXlsxObject.xlsx_object.cursantes.length > 0);
        return !(requiredFilled && hasXlsx);
    };

    return (
         <Container size="lg" py="lg">

                {/* TÍTULO */}
                <Title order={1} mb="sm">Constancias</Title>

                <Text color="dimmed" mb="md">
                    En esta sección podrás ver las lista de peticiones y estatus para constancias
                </Text>

                {/* BOTÓN DE AÑADIR */}
                <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginBottom: 12, alignItems: 'center' }}>
                    <Button
                        onClick={() => setOpened(true)}
                        aria-label="Crear constancias grupal"
                        style={{ backgroundColor: 'var(--olive-green)', color: 'white', transition: 'filter 120ms ease, transform 120ms ease', filter: addHoverGroup ? 'brightness(0.9)' : 'none', display: 'flex', alignItems: 'center', gap: 8 }}
                        onMouseEnter={() => setAddHoverGroup(true)}
                        onMouseLeave={() => setAddHoverGroup(false)}
                    >
                        <FaPlus />
                        <span>Grupal</span>
                    </Button>
                    <Button
                        onClick={() => setOpenedIndividual(true)}
                        aria-label="Crear constancia individual"
                        style={{ backgroundColor: 'var(--olive-green)', color: 'white', transition: 'filter 120ms ease, transform 120ms ease', filter: addHoverIndividual ? 'brightness(0.9)' : 'none', display: 'flex', alignItems: 'center', gap: 8 }}
                        onMouseEnter={() => setAddHoverIndividual(true)}
                        onMouseLeave={() => setAddHoverIndividual(false)}
                    >
                        <FaPlus />
                        <span>Individual</span>
                    </Button>
                </div>

                {/* TABLA */}
                <ResponsiveDataTable
                    columns={columns}
                    data={rows}
                    initialPageSize={10}
                    actions={(row) => (
                    <div style={{ gap: '8px', alignItems: 'center' , justifyContent: 'center'}}>
                        <Button
                            onClick={() => handleGenerar(row)}
                            disabled={row.estado === 'pendiente'}
                            className={`action-btn small-action-btn`}
                            style={{ background: row.estado === 'pendiente' ? '#cccccc' : 'var(--olive-green)', color: row.estado === 'pendiente' ? '#666666' : 'white' }}
                        >
                            Generar
                        </Button>
                        </div>
                    )}
                />


                {/* MODAL */}
                <Modal
                    opened={opened}
                    onClose={() => setOpened(false)}
                    title="Nueva petición de constancias"
                    centered
                    size="lg"
                    styles={{
                        content: { maxWidth: 720, margin: 16 },
                        body: { maxHeight: "60vh", overflow: "auto" },
                    }}
                >
                    <form
                        onSubmit={async (e) => {
                            e.preventDefault();
                            if (isSubmitDisabled()) {
                                showNotification({ title: 'Error', message: 'Completa los campos requeridos y sube el Excel', color: 'red' });
                                return;
                            }

                            // extraer id del usuario del token JWT (mi_app_token)
                            const token = localStorage.getItem('mi_app_token') ?? null;
                            const parseJwt = (t: string | null) => {
                                if (!t) return null;
                                try {
                                    const part = t.split('.')[1];
                                    const base64 = part.replace(/-/g, '+').replace(/_/g, '/');
                                    const jsonPayload = decodeURIComponent(atob(base64).split('').map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)).join(''));
                                    return JSON.parse(jsonPayload);
                                } catch (e) {
                                    return null;
                                }
                            };

                            const parsedToken = parseJwt(token);
                            const certificate_user_id = parsedToken?.['_id'] ?? parsedToken?.id ?? parsedToken?.sub ?? null;
                            if (!certificate_user_id) {
                                showNotification({ title: 'Error', message: 'No se pudo obtener el id del usuario desde el token', color: 'red' });
                                return;
                            }

                            const trainer_id = form.values.capacitador ?? selectedTrainerId ?? null;
                            if (!trainer_id) {
                                showNotification({ title: 'Error', message: 'Selecciona un capacitador válido', color: 'red' });
                                return;
                            }

                            // validar y construir courses_id como array de GUIDs (o ObjectId 24 hex)
                            const rawCourseVal = form.values.curso ?? '';
                            const mappedCourse = courseValueMap[String(rawCourseVal)];
                            const candidateCourseId = (mappedCourse !== undefined && mappedCourse !== null) ? String(mappedCourse) : String(rawCourseVal);
                            const uuidRegex = /^(?:[0-9a-fA-F]{24}|[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})$/;
                            if (!candidateCourseId || !uuidRegex.test(candidateCourseId)) {
                                showNotification({ title: 'Error', message: 'Selecciona un curso válido (id de curso).', color: 'red' });
                                return;
                            }

                            const payload = {
                                certificate_user_id,
                                trainer_id,
                                legal_representative: form.values.repLegal ?? '',
                                workers_representative: form.values.repTrabajadores ?? '',
                                // NO incluir fechas globales en el xlsx_object: enviar los cursantes tal cual
                                xlsx_object: (() => {
                                    const base = parsedXlsxObject?.xlsx_object ?? { cursantes: [] };
                                    const cursantes = Array.isArray(base.cursantes) ? base.cursantes.map((c: any) => ({ ...c })) : [];
                                    return { ...base, cursantes };
                                })(),
                                status: 'PENDIENTE',
                            };

                            // En lugar de enviar inmediatamente, abrir preview para revisión
                            setGroupPreviewPayload(payload);
                            setGroupPreviewOpen(true);
                        }}
                    >
                        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>

                            {/* DESCARGA + EXCEL */}
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                <a href="/Plantilla_Constancias.xlsx" download="Plantilla_Constancias.xlsx" style={{ fontSize: 14 }}>Descargar plantilla</a>


                                <FileInput
                                    label="Subir archivo Excel"
                                    placeholder="Selecciona archivo"
                                    leftSection={<FaFileUpload />}
                                    accept=".xls,.xlsx"
                                    value={form.values.excelFile}
                                    onChange={(file) => { form.setFieldValue('excelFile', file); void handleExcelUpload(file); }}
                                />
                            </div>

                            <Select
                                label="Capacitador"
                                data={capacitadorOptions}
                                value={form.values.capacitador}
                                onChange={(v) => {
                                    form.setFieldValue('capacitador', v ?? '');
                                    setSelectedTrainerId(v ?? null);
                                    // actualizar cursos disponibles
                                    const trainer = trainers.find(t => t._id === v);
                                    const trainerCourses = (trainer?.trainer_courses ?? []);
                                    // preferir course._id (GUID) -> course.id -> course.course_id
                                    const courseOpts = trainerCourses.map((tc: any) => ({ value: String(tc.course?._id ?? tc.course?.id ?? tc.course?.course_id ?? tc.course_id ?? ''), label: tc.course?.name ?? 'Curso' }));
                                    // construir mapa value -> preferred id (puede ser GUID o otro identificador)
                                    const map: Record<string, string | number> = {};
                                    for (const tc of trainerCourses) {
                                        const preferred = tc.course?._id ?? tc.course?.id ?? tc.course?.course_id ?? tc.course_id ?? '';
                                        const value = String(preferred);
                                        map[value] = preferred;
                                    }
                                    setCourseValueMap(map);
                                    if (!courseOpts || courseOpts.length === 0) {
                                        setCoursesOptions([{ value: '', label: 'Sin cursos disponibles' }]);
                                        setCoursesDisabled(true);
                                        form.setFieldValue('curso', '');
                                    } else {
                                        setCoursesOptions(courseOpts);
                                        setCoursesDisabled(false);
                                        if (courseOpts.length === 1) form.setFieldValue('curso', courseOpts[0].value);
                                    }
                                }}
                            />

                            <Select
                                label="Curso"
                                data={coursesOptions}
                                value={form.values.curso}
                                onChange={(v) => form.setFieldValue('curso', v ?? '')}
                                disabled={coursesDisabled}
                                placeholder={coursesDisabled ? 'Sin cursos disponibles' : 'Selecciona un curso'}
                            />

                            {/* FECHAS */}
                            <div style={{ display: "flex", gap: 8 }}>
                                <TextInput type="date" label="Fecha inicio" {...form.getInputProps("fechaInicio")} />
                                <TextInput type="date" label="Fecha fin" {...form.getInputProps("fechaFin")} />
                            </div>

                            {/* REPRESENTANTES */}
                            <TextInput
                                label="Representante legal"
                                value={form.values.repLegal}
                                onChange={(e) => form.setFieldValue('repLegal', String(e.currentTarget.value).toUpperCase())}
                                onBlur={() => form.setFieldValue('repLegal', String(form.values.repLegal ?? '').toUpperCase())}
                            />
                            <TextInput
                                label="Representante de los trabajadores"
                                value={form.values.repTrabajadores}
                                onChange={(e) => form.setFieldValue('repTrabajadores', String(e.currentTarget.value).toUpperCase())}
                                onBlur={() => form.setFieldValue('repTrabajadores', String(form.values.repTrabajadores ?? '').toUpperCase())}
                            />

                                <div style={{ display: "flex", justifyContent: "flex-end" }}>
                                    <Button type="submit" disabled={isSubmitDisabled()} style={{ background: isSubmitDisabled() ? '#cccccc' : 'var(--olive-green)' }}>
                                        Enviar
                                    </Button>
                                </div>

                        </div>
                    </form>
                </Modal>
                {/* Group preview modal */}
                <Modal opened={groupPreviewOpen} onClose={() => setGroupPreviewOpen(false)} title="Preview petición grupal" size="lg" centered>
                    <div style={{ maxHeight: '60vh', overflow: 'auto' }}>
                        <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontSize: 12 }}>{groupPreviewPayload ? JSON.stringify(groupPreviewPayload, null, 2) : 'No payload'}</pre>
                    </div>
                    <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 12 }}>
                        <Button variant="default" onClick={() => setGroupPreviewOpen(false)} disabled={groupPreviewSending}>Cancelar</Button>
                        <Button style={{ background: 'var(--olive-green)' }} onClick={() => void sendGroupPayload()} loading={groupPreviewSending}>Confirmar y enviar</Button>
                    </div>
                </Modal>

                {/* MODAL INDIVIDUAL */}
                <Modal
                    opened={openedIndividual}
                    onClose={() => setOpenedIndividual(false)}
                    title="Nueva constancia individual"
                    centered
                    size="xl"
                >
                    <form
                        onSubmit={async (e) => {
                            e.preventDefault();

                            const token = localStorage.getItem('mi_app_token') ?? null;
                            const parseJwt = (t: string | null) => {
                                if (!t) return null;
                                try {
                                    const part = t.split('.')[1];
                                    const base64 = part.replace(/-/g, '+').replace(/_/g, '/');
                                    const jsonPayload = decodeURIComponent(atob(base64).split('').map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)).join(''));
                                    return JSON.parse(jsonPayload);
                                } catch (e) {
                                    return null;
                                }
                            };

                            const parsedToken = parseJwt(token);
                            const certificate_user_id = parsedToken?.['_id'] ?? parsedToken?.id ?? parsedToken?.sub ?? null;
                            if (!certificate_user_id) {
                                showNotification({ title: 'Error', message: 'No se pudo obtener el id del usuario desde el token', color: 'red' });
                                return;
                            }

                            const trainer_id = individualForm.values.trainer ?? null;
                            if (!trainer_id) {
                                showNotification({ title: 'Error', message: 'Selecciona un capacitador', color: 'red' });
                                return;
                            }

                            // defensiva: validar representantes antes de construir payload
                            if (!individualForm.values.repLegal || !individualForm.values.repTrabajadores) {
                                showNotification({ title: 'Error', message: 'Debes proporcionar los representantes (legal y de trabajadores)', color: 'red' });
                                return;
                            }

                            // construir xlsx_object con un solo cursante basado en los campos
                            // y añadir por curso las fechas seleccionadas
                            const cursanteBase: any = {
                                nombre: individualForm.values.nombre ?? '',
                                curp: individualForm.values.curp ?? '',
                                puesto_trabajo: individualForm.values.puesto_trabajo ?? '',
                                ocupacion_especifica: individualForm.values.ocupacion_especifica ?? '',
                            };

                            const rawSelected = (individualForm.values.courses_ids || []).filter((c: any) => c !== null && c !== undefined && String(c).trim() !== '');
                            const uuidRegex = /^(?:[0-9a-fA-F]{24}|[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})$/;
                            const selectedCourses = rawSelected.map((v: any) => {
                                const mapped = courseValueMap[String(v)];
                                return (mapped !== undefined && mapped !== null) ? String(mapped) : String(v);
                            }).map((s: any) => String(s).trim()).filter((s: string) => uuidRegex.test(s));

                        
                            const cursante = { ...cursanteBase };

                            if (!selectedCourses || selectedCourses.length === 0) {
                                showNotification({ title: 'Error', message: 'Selecciona al menos un curso válido (id de curso)', color: 'red' });
                                return;
                            }

                            // defensiva: validar fechas por curso
                            for (const cid of selectedCourses) {
                                const dates = individualCourseDates[cid] ?? { start: '', end: '' };
                                if (!dates.start || !dates.end) {
                                    showNotification({ title: 'Error', message: 'Cada curso seleccionado debe tener fecha inicio y fin', color: 'red' });
                                    return;
                                }
                            }

                            // Construir payload SIN courses_id ni fechas top-level. Las asociaciones se harán en la llamada bulk posterior.
                            const payload = {
                                certificate_user_id,
                                trainer_id,
                                legal_representative: individualForm.values.repLegal ?? '',
                                workers_representative: individualForm.values.repTrabajadores ?? '',
                                xlsx_object: { cursantes: [cursante], area_tematica: parsedXlsxObject?.xlsx_object?.area_tematica ?? undefined },
                                status: 'PENDIENTE',
                            } as any;

                            // en lugar de enviar directamente, abrir preview para debug
                            setPreviewPayload(payload);
                            setPreviewOpen(true);
                        }}
                    >
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                            <Select
                                label="Capacitador"
                                data={capacitadorOptions}
                                value={individualForm.values.trainer}
                                onChange={(v) => {
                                    try {
                                        individualForm.setFieldValue('trainer', v ?? '');
                                        // actualizar opciones de cursos según el capacitador seleccionado
                                        const trainer = trainers.find(t => t._id === v);
                                        const trainerCourses = Array.isArray(trainer?.trainer_courses) ? trainer.trainer_courses : [];
                                        
                                        // preferir course._id (GUID) -> course.id -> course.course_id
                                        const courseOpts = trainerCourses
                                            .filter((tc: any) => tc && tc.course) // filtrar cursos inválidos
                                            .map((tc: any) => {
                                                const courseId = tc.course?._id ?? tc.course?.id ?? tc.course?.course_id ?? tc.course_id ?? '';
                                                const courseName = tc.course?.name ?? 'Curso sin nombre';
                                                return { 
                                                    value: String(courseId), 
                                                    label: courseName 
                                                };
                                            })
                                            .filter((opt: any) => opt.value); // eliminar opciones sin ID
                                        
                                        const map: Record<string, string | number> = {};
                                        for (const tc of trainerCourses) {
                                            if (!tc || !tc.course) continue;
                                            const preferred = tc.course?._id ?? tc.course?.id ?? tc.course?.course_id ?? tc.course_id ?? '';
                                            if (!preferred) continue;
                                            const value = String(preferred);
                                            map[value] = preferred;
                                        }
                                        setCourseValueMap(map);
                                        
                                        if (!courseOpts || courseOpts.length === 0) {
                                            setCoursesOptions([{ value: '', label: 'Sin cursos disponibles' }]);
                                            setCoursesDisabled(true);
                                            individualForm.setFieldValue('courses_ids', []);
                                        } else {
                                            setCoursesOptions(courseOpts);
                                            setCoursesDisabled(false);
                                        }
                                    } catch (error) {
                                        setCoursesOptions([{ value: '', label: 'Error cargando cursos' }]);
                                        setCoursesDisabled(true);
                                        individualForm.setFieldValue('courses_ids', []);
                                    }
                                }}
                            />

                            <MultiSelect
                                label="Cursos (selecciona uno o varios)"
                                data={coursesOptions.map(c => ({ value: c.value, label: c.label }))}
                                value={individualForm.values.courses_ids}
                                onChange={(v) => {
                                    individualForm.setFieldValue('courses_ids', v);
                                    // asegurar entradas en individualCourseDates para cada curso seleccionado
                                    setIndividualCourseDates((prev) => {
                                        const copy = { ...(prev ?? {}) };
                                        // agregar defaults para nuevos
                                        (v ?? []).forEach((cid) => {
                                            if (!copy[cid]) copy[cid] = { start: individualForm.values.fechaInicio ?? '', end: individualForm.values.fechaFin ?? '' };
                                        });
                                        // eliminar keys que ya no están seleccionadas
                                        Object.keys(copy).forEach((k) => { if (!(v ?? []).includes(k)) delete copy[k]; });
                                        return copy;
                                    });
                                }}
                                disabled={coursesDisabled}
                            />

                            {/* Fechas por curso dinámicas */}
                            {individualForm.values.courses_ids && individualForm.values.courses_ids.length > 0 && (
                                <div style={{ border: '1px solid #eee', padding: 8, borderRadius: 6 }}>
                                    <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 6 }}>Fechas por curso</div>
                                    {(individualForm.values.courses_ids as string[]).map((cid) => {
                                        const opt = coursesOptions.find(c => String(c.value) === String(cid));
                                        return (
                                            <div key={cid} style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6 }}>
                                                <div style={{ width: '50%' }}>{opt ? opt.label : cid}</div>
                                                <input
                                                    type="date"
                                                    value={individualCourseDates[cid]?.start ?? individualForm.values.fechaInicio ?? ''}
                                                    onChange={(e) => setIndividualCourseDates(prev => ({ ...prev, [cid]: { ...(prev[cid] ?? {}), start: e.target.value } }))}
                                                    style={{ width: 140 }}
                                                />
                                                <input
                                                    type="date"
                                                    value={individualCourseDates[cid]?.end ?? individualForm.values.fechaFin ?? ''}
                                                    onChange={(e) => setIndividualCourseDates(prev => ({ ...prev, [cid]: { ...(prev[cid] ?? {}), end: e.target.value } }))}
                                                    style={{ width: 140 }}
                                                />
                                                <Button size="xs" color="red" onClick={() => {
                                                    // quitar curso de selección
                                                    const newSel = (individualForm.values.courses_ids ?? []).filter((x: any) => String(x) !== String(cid));
                                                    individualForm.setFieldValue('courses_ids', newSel);
                                                    setIndividualCourseDates((prev) => { const copy = { ...prev }; delete copy[cid]; return copy; });
                                                }}>Quitar</Button>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}

                            <TextInput
                                label="Nombre completo"
                                value={individualForm.values.nombre}
                                onChange={(e) => individualForm.setFieldValue('nombre', String(e.currentTarget.value).toUpperCase())}
                                onBlur={() => individualForm.setFieldValue('nombre', String(individualForm.values.nombre ?? '').toUpperCase())}
                            />
                            <TextInput
                                label="CURP"
                                value={individualForm.values.curp}
                                onChange={(e) => individualForm.setFieldValue('curp', String(e.currentTarget.value).toUpperCase())}
                                onBlur={() => individualForm.setFieldValue('curp', String(individualForm.values.curp ?? '').toUpperCase())}
                            />
                            <TextInput
                                label="Puesto"
                                value={individualForm.values.puesto_trabajo}
                                onChange={(e) => individualForm.setFieldValue('puesto_trabajo', String(e.currentTarget.value).toUpperCase())}
                                onBlur={() => individualForm.setFieldValue('puesto_trabajo', String(individualForm.values.puesto_trabajo ?? '').toUpperCase())}
                            />
                            <Select
                                label="Ocupación específica"
                                value={individualForm.values.ocupacion_especifica}
                                onChange={(v) => individualForm.setFieldValue('ocupacion_especifica', String(v ?? '').toUpperCase())}
                                data={[
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
                                ].map(s => ({ value: String(s).toUpperCase(), label: s }))}
                            />

                            <TextInput
                                label="Representante legal"
                                value={individualForm.values.repLegal}
                                onChange={(e) => individualForm.setFieldValue('repLegal', String(e.currentTarget.value).toUpperCase())}
                                onBlur={() => individualForm.setFieldValue('repLegal', String(individualForm.values.repLegal ?? '').toUpperCase())}
                            />
                            <TextInput
                                label="Representante de los trabajadores"
                                value={individualForm.values.repTrabajadores}
                                onChange={(e) => individualForm.setFieldValue('repTrabajadores', String(e.currentTarget.value).toUpperCase())}
                                onBlur={() => individualForm.setFieldValue('repTrabajadores', String(individualForm.values.repTrabajadores ?? '').toUpperCase())}
                            />

                            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                                <Button type="submit" disabled={isIndividualSubmitDisabled()} style={{ background: isIndividualSubmitDisabled() ? '#cccccc' : 'var(--olive-green)' }}>Crear</Button>
                            </div>
                        </div>
                    </form>
                </Modal>
            {/* Preview modal usado para debug del payload individual */}
            <Modal opened={previewOpen} onClose={() => setPreviewOpen(false)} title="Preview payload" size="lg" centered>
                <div style={{ maxHeight: '60vh', overflow: 'auto' }}>
                    <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontSize: 12 }}>{previewPayload ? JSON.stringify(previewPayload, null, 2) : 'No payload'}</pre>
                </div>
                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 12 }}>
                    <Button variant="default" onClick={() => setPreviewOpen(false)} disabled={previewSending}>Cancelar</Button>
                    <Button style={{ background: 'var(--olive-green)' }} onClick={() => void sendPreviewPayload()} loading={previewSending}>Confirmar y enviar</Button>
                </div>
            </Modal>
        </Container>
    );
}

// Nota: los exports y demás se mantienen


export default ConstanciasEmpresaPage;
