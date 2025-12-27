import pdfMake from "pdfmake/build/pdfmake";
import pdfFonts from "pdfmake/build/vfs_fonts";
import QRCode from "qrcode";
import JSZip from "jszip";
import { saveAs } from "file-saver";
import appConfig from "../core/constants/appConfig";

const SIGNATURE_FIT: [number, number] = [200, 100];
const SIGNATURE_HEIGHT = 105;

const pdfFontsAny = pdfFonts as any;
const pdfMakeAny = pdfMake as any;

if (pdfMakeAny.vfs === undefined && pdfFontsAny && pdfFontsAny.pdfMake && pdfFontsAny.pdfMake.vfs) {
  pdfMakeAny.vfs = pdfFontsAny.pdfMake.vfs;
}

const pdfMakeFonts = {
  Roboto: {
    normal: "https://cdnjs.cloudflare.com/ajax/libs/pdfmake/0.1.66/fonts/Roboto/Roboto-Regular.ttf",
    bold: "https://cdnjs.cloudflare.com/ajax/libs/pdfmake/0.1.66/fonts/Roboto/Roboto-Medium.ttf",
    italics: "https://cdnjs.cloudflare.com/ajax/libs/pdfmake/0.1.66/fonts/Roboto/Roboto-Italic.ttf",
    bolditalics: "https://cdnjs.cloudflare.com/ajax/libs/pdfmake/0.1.66/fonts/Roboto/Roboto-MediumItalic.ttf",
  },
};
pdfMake.fonts = pdfMakeFonts;

export interface DC3CertificateData {
  id: string;
  company_name: string;
  rfc?: string;
  company_rfc?: string;
  course_name: string;
  course_duration: string | number;
  course_period: string;
  trainer_fullname: string;
  stps: string;
  legal_representative: string;
  workers_representative: string;
  area_tematica?: string;
  tipo_firma?: 'DIGITAL' | 'FISICA';
  // asociaciones de cursos (opcional) para generar un PDF por curso
  certificate_courses?: any[];
  // id de archivo en Google Drive con la firma digital del capacitador
  sign?: string;
  // id del curso cuando generamos un PDF por curso
  course_id?: string;
}

export interface DC3User {
  nombre: string;
  curp: string;
  puesto_trabajo: string;
  ocupacion_especifica: string;
  tipo_firma?: 'DIGITAL' | 'FISICA';
}

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

async function generateQrDataUrl(url: string): Promise<string> {
  return QRCode.toDataURL(url, { margin: 0, width: 100 });
}

function splitDateParts(str?: string) {
  if (!str) return { d: ["", ""], m: ["", ""], a: ["", "", "", ""] };
  const d = new Date(str);
  if (isNaN(d.getTime())) return { d: ["", ""], m: ["", ""], a: ["", "", "", ""] };

  const userTimezoneOffset = d.getTimezoneOffset() * 60000;
  const localDate = new Date(d.getTime() + userTimezoneOffset);

  const day = String(localDate.getDate()).padStart(2, "0");
  const month = String(localDate.getMonth() + 1).padStart(2, "0");
  const year = String(localDate.getFullYear());

  return { d: day.split(""), m: month.split(""), a: year.split("") };
}


const sectionHeader = (text: string) => ({
  table: {
    widths: ['*'],
    body: [[
      {
        text,
        fillColor: '#000000',
        color: '#FFFFFF',
        bold: true,
        fontSize: 8,
        alignment: 'center',
        margin: [0, 2, 0, 2],
        border: [true, true, true, true],
      },
    ]],
  },
  layout: 'noBorders',
  margin: [0, 4, 0, 3],
});

const fieldWithLine = (label: string, value: string, fontSizeVal = 9, withBorder = false) => ({
  stack: [
    { text: label, fontSize: 5, margin: [2, 0, 0, 1] },
    {
      table: {
        widths: ['*'],
        body: [[
          {
            text: value || '',
            fontSize: fontSizeVal,
            bold: true,
            alignment: 'left',
            margin: [2, 2, 0, 2],
            border: withBorder ? [true, true, true, true] : [false, false, false, true],
          },
        ]],
      },
      layout: {
        hLineWidth: (i: number, node: any) => {
          // Línea inferior más delgada
          if (i === node.table.body.length) return 0.3;
          return 0;
        },
        vLineWidth: () => withBorder ? 0.5 : 0,
        hLineColor: () => '#888888',
        vLineColor: () => '#000000',
      },
    },
  ],
  margin: [0, 0, 0, 2],
});


const charGrid = (label: string, value: string, length: number) => {
  const cleanVal = (value || '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .padEnd(length, ' ')
    .slice(0, length);

  return {
    stack: [
      { text: label, fontSize: 5, margin: [2, 0, 0, 1] },
      {
        table: {
          widths: Array(length).fill(10),
          heights: [15],
          body: [[
            ...cleanVal.split('').map(c => ({
              text: c,
              fontSize: 7.5,
              bold: true,
              alignment: 'center',
              margin: [0, 1.5, 0, 1.5],
              border: [true, true, true, true],
            })),
          ]],
        },
        layout: {
          hLineWidth: () => 0.5,
          vLineWidth: () => 0.5,
          hLineColor: () => '#000000',
          vLineColor: () => '#000000',
        },
      },
    ],
  };
};


const dateGridSection = (dateObj: { d: string[], m: string[], a: string[] }) => {
  const cell = (txt: string) => ({ 
    text: txt, 
    fontSize: 7.5, 
    bold: true, 
    alignment: 'center', 
    border: [true, true, true, true], 
    margin: [0, 1.5, 0, 1.5] 
  });
  const header = (txt: string, span: number = 1) => ({ 
    text: txt, 
    fontSize: 5, 
    alignment: 'center', 
    border: [false, false, false, false], 
    colSpan: span, 
    margin: [0, 0, 0, 1] 
  });

  return {
    width: 'auto',
    table: {
      widths: [9.5, 9.5, 9.5, 9.5, 3, 9.5, 9.5, 3, 9.5, 9.5],
      body: [
        [header('Año', 4), {}, {}, {}, {}, header('Mes', 2), {}, {}, header('Día', 2), {}],
        [
          cell(dateObj.a[0] || ''), cell(dateObj.a[1] || ''), cell(dateObj.a[2] || ''), cell(dateObj.a[3] || ''),
          { text: '', border: [false, false, false, false] },
          cell(dateObj.m[0] || ''), cell(dateObj.m[1] || ''),
          { text: '', border: [false, false, false, false] },
          cell(dateObj.d[0] || ''), cell(dateObj.d[1] || '')
        ]
      ]
    },
    layout: {
      hLineWidth: () => 0.5,
      vLineWidth: () => 0.5,
      hLineColor: () => '#000000',
      vLineColor: () => '#000000',
    }
  };
};

function buildPageContent(cursante: DC3User, raw: DC3CertificateData, logoDataUrl: string | undefined, qrDataUrl: string, signatureDataUrl?: string) {
  const nombre = (cursante.nombre ?? "").toUpperCase();
  const curp = (cursante.curp ?? "").toUpperCase();
  const puesto = (cursante.puesto_trabajo ?? "").toUpperCase();
  const ocupacion = (cursante.ocupacion_especifica ?? "").toUpperCase();

  const razonSocial = (raw.company_name ?? "").toUpperCase();
  const rfc = (raw.rfc ?? raw.company_rfc ?? "").toUpperCase();
  const curso = (raw.course_name ?? "").toUpperCase();
  const duracion = raw.course_duration ?? "";
  const [inicioStr, finStr] = (raw.course_period ?? "").split(/\s*\/\s*/);

  const fInicio = splitDateParts(inicioStr);
  const fFin = splitDateParts(finStr);

  const instructor = (raw.trainer_fullname ?? "").toUpperCase();
  const regStps = (raw.stps ?? "").toUpperCase();
  const repLegal = (raw.legal_representative ?? "").toUpperCase();
  const repTrab = (raw.workers_representative ?? "").toUpperCase();

  return [
    {
      columns: [
        { width: 180, stack: logoDataUrl ? [{ image: logoDataUrl, fit: [180, 80], margin: [0, 5, 0, 0] }] : [] },
        { width: '*', stack: [{ text: 'FORMATO DC-3\nCONSTANCIA DE COMPETENCIAS O DE HABILIDADES LABORALES', bold: true, fontSize: 10, alignment: 'center', margin: [0, 15, 0, 0] }] },
        { width: 70, stack: [{ image: qrDataUrl, fit: [65, 65], alignment: 'right', margin: [0, 5, 0, 0] }] }
      ], margin: [0, 0, 0, 3]
    },
    sectionHeader('DATOS DEL TRABAJADOR'),
    fieldWithLine('Nombre (Anotar apellido paterno, apellido materno y nombre (s))', nombre, 9, false),
    { 
      margin: [0, 2, 0, 2],
      columns: [
        { width: 'auto', ...charGrid('Clave Única de Registro de Población', curp, 18) },
        { width: 10, text: '' },
        { width: '*', ...fieldWithLine('Ocupación específica (Catálogo Nacional de Ocupaciones) 1/', ocupacion, 7.5, true) }
      ]
    },
    fieldWithLine('Puesto*', puesto, 8, false),
    sectionHeader('DATOS DE LA EMPRESA'),
    fieldWithLine('Nombre o razón social (En caso de persona física, anotar apellido paterno, apellido materno y nombre(s))', razonSocial, 8),
    { margin: [0, 3, 0, 3], ...charGrid('Registro Federal de Contribuyentes con homoclave (SHCP)', rfc, 13) },
    sectionHeader('DATOS DEL PROGRAMA DE CAPACITACIÓN, ADIESTRAMIENTO Y PRODUCTIVIDAD'),
    fieldWithLine('Nombre del curso', curso, 9),
    { margin: [0, 8, 0, 8], columns: [{ width: 75, stack: [{ text: 'Duración en horas', fontSize: 5, margin: [0, 0, 0, 1] }, { text: String(duracion), fontSize: 9, bold: true, alignment: 'center' }] }, { width: 'auto', text: 'Periodo de\nejecución:', fontSize: 7, bold: true, margin: [0, 10, 4, 0] }, { width: 'auto', text: 'De', fontSize: 7.5, margin: [0, 10, 4, 0] }, dateGridSection(fInicio), { width: 'auto', text: 'a', fontSize: 7.5, margin: [4, 10, 4, 0] }, dateGridSection(fFin)] },
    fieldWithLine('Área temática del curso 2/', (raw.area_tematica ?? '6000 Seguridad'), 8),
    {
      stack: [
        { text: 'Nombre del agente capacitador o STPS 3/', fontSize: 5, margin: [2, 0, 0, 1] },
        {
          table: {
            widths: ['*', 130],
            body: [[
              {
                text: instructor,
                fontSize: 8,
                bold: true,
                alignment: 'left',
                margin: [2, 2, 2, 2],
                border: [false, false, true, true],
              },
              {
                stack: [
                  { text: 'REG. STPS', fontSize: 5, alignment: 'left', margin: [2, 0, 0, 0] },
                  { text: regStps, fontSize: 8, bold: true, alignment: 'left', margin: [2, 0, 0, 0] }
                ],
                border: [true, false, false, true],
                margin: [0, 2, 0, 2],
              },
            ]],
          },
          layout: {
            hLineWidth: (i: number, node: any) => {
              if (i === node.table.body.length) return 0.3;
              return 0;
            },
            vLineWidth: (i: number) => {
              if (i === 1) return 0.5;
              return 0;
            },
            hLineColor: () => '#888888',
            vLineColor: () => '#888888',
          },
        },
      ],
      margin: [0, 0, 0, 8],
    },
    { text: 'Los datos se asientan en esta constancia bajo protesta de decir verdad, apercibidos de la responsabilidad en que incurre todo aquel que no se conduce con verdad.', fontSize: 6.5, italics: true, alignment: 'center', margin: [0, 4, 0, 20] },
    {
      columns: [
        {
          width: '*',
          stack: [
            { text: 'Capacitador', fontSize: 7.5, alignment: 'center', bold: true },

            {
              table: {
                widths: ['*'],
                heights: [SIGNATURE_HEIGHT],
                body: [[
                  signatureDataUrl
                    ? {
                      image: signatureDataUrl,
                      fit: SIGNATURE_FIT,
                      alignment: 'center',
                    }
                    : { text: '' },
                ]],
              },
              layout: 'noBorders',
              margin: [0, 2, 0, 2],
            },

            {
              canvas: [
                { type: 'line', x1: 0, y1: 0, x2: 155, y2: 0, lineWidth: 0.5 },
              ],
              alignment: 'center',
              margin: [0, 2, 0, 4],
            },

            { text: instructor, fontSize: 6.5, alignment: 'center', bold: true },
            { text: 'Nombre y firma', fontSize: 5.5, alignment: 'center' },
          ],
        },
        {
          width: '*', stack: [
            { text: 'Patrón o representante legal', fontSize: 7.5, alignment: 'center', bold: true },
            // área reservada con la misma altura que la columna del instructor
            {
              table: {
                widths: ['*'],
                body: [[{ text: '' }]],
                heights: [60]
              },
              layout: { defaultBorder: false },
              margin: [0, 3, 0, 3]
            },
            { canvas: [{ type: 'line', x1: 5, y1: 0, x2: 150, y2: 0, lineWidth: 0.5 }], alignment: 'center', margin: [0, 2, 0, 4] },
            { text: repLegal, fontSize: 6.5, alignment: 'center', margin: [0, 4, 0, 0] },
            { text: 'Nombre y firma', fontSize: 5.5, alignment: 'center' }
          ]
        },
        {
          width: '*', stack: [
            { text: 'Representante de los trabajadores', fontSize: 7.5, alignment: 'center', bold: true },
            {
              table: {
                widths: ['*'],
                body: [[{ text: '' }]],
                heights: [60]
              },
              layout: { defaultBorder: false },
              margin: [0, 3, 0, 3]
            },
            { canvas: [{ type: 'line', x1: 5, y1: 0, x2: 150, y2: 0, lineWidth: 0.5 }], alignment: 'center', margin: [0, 2, 0, 4] },
            { text: repTrab, fontSize: 6.5, alignment: 'center', margin: [0, 4, 0, 0] },
            { text: 'Nombre y firma', fontSize: 5.5, alignment: 'center' }
          ]
        }
      ], columnGap: 15, margin: [0, 0, 0, 15]
    },
    { text: 'INSTRUCCIONES', bold: true, fontSize: 7, margin: [0, 0, 0, 2] },
    { 
      stack: [
        { text: '- Llenar a máquina o con letra de molde', fontSize: 5, margin: [15, 0, 0, 1] },
        { text: '- Deberá entregarse al trabajador dentro de los veinte días hábiles siguientes al término del curso de capacitación aprobado.', fontSize: 5, margin: [15, 0, 0, 1] },
        { text: '1/  Las áreas y subáreas ocupacionales del Catálogo Nacional de Ocupaciones se encuentran disponibles en el reverso de este formato y en la página www.stps.gob.mx', fontSize: 5, margin: [12, 0, 0, 1] },
        { text: '2/  Las áreas temáticas de los cursos se encuentran disponibles en el reverso de este formato y en la página www.stps.gob.mx', fontSize: 5, margin: [12, 0, 0, 1] },
        { text: '3/  Cursos impartidos por el área competente de la Secretaría del Trabajo y Previsión Social.', fontSize: 5, margin: [12, 0, 0, 1] },
        { text: '4/', fontSize: 5, margin: [12, 0, 0, 0] },
        { text: '     Para empresas con menos de 51 trabajadores. Para empresas con más de 50 trabajadores firmará el representante del patrón ante la Comisión mixta de capacitación, ad', fontSize: 5, margin: [12, 0, 0, 1] },
        { text: '5/  Solo para empresas con más de 50 trabajadores.', fontSize: 5, margin: [12, 0, 0, 1] },
        { text: '*   Dato no obligatorio', fontSize: 5, margin: [0, 0, 0, 14] }
      ]
    },
    { 
      columns: [
        { width: '*', text: '' },
        { width: 'auto', text: 'DC-3\nANVERSO', alignment: 'right', fontSize: 6.5, bold: true, margin: [0, 2, 0, 0] }
      ]
    }
  ];
}

const generateSinglePdfBlob = (docDefinition: any): Promise<Blob> => {
  return new Promise((resolve) => {
    const pdfDoc = pdfMake.createPdf(docDefinition);
    pdfDoc.getBlob((blob) => {
      resolve(blob);
    });
  });
};


export async function generateAndDownloadZipDC3(
  certificateData: DC3CertificateData,
  users: Array<DC3User & { certificate_overrides?: Partial<DC3CertificateData> }>,
  logoUrl: string = "logo.png",
  zipFileName: string = "constancias.zip"
) {
  const zip = new JSZip();
  const logoDataUrl = await imageUrlToDataUrl(logoUrl);

  // Cache de firmas por signId para reutilizar la misma imagen cuando corresponda
  const signatureCache = new Map<string, string | undefined>();

  for (const cursante of users) {
    // Permitir overrides específicos por cursante (p. ej. rep_legal, rep_trabajadores, capacitador, curso_interes, fechas)
    const merged = { ...(certificateData ?? {}), ...(cursante.certificate_overrides ?? {}) } as any;

    // Resolver tipo_firma ANTES de asignar area_tematica para que no sea sobrescrito
    // Para tipo_firma, priorizar xlsx_object sobre el nivel raíz del certificateData
    const resolvedTipoFirma = (cursante.certificate_overrides && (cursante.certificate_overrides as any).tipo_firma)
      ?? (certificateData as any).xlsx_object?.tipo_firma
      ?? (certificateData as any).tipo_firma
      ?? 'FISICA';

    // Resolver area_tematica de forma defensiva: override por cursante > certificateData > certificateData.xlsx_object > fallback
    merged.area_tematica = (cursante.certificate_overrides && (cursante.certificate_overrides as any).area_tematica)
      ?? certificateData.area_tematica
      ?? (certificateData as any).xlsx_object?.area_tematica
      ?? '6000 Seguridad';

    // Asignar tipo_firma resuelto AL FINAL para que no sea sobrescrito
    merged.tipo_firma = resolvedTipoFirma;

    const perCert: DC3CertificateData = merged as DC3CertificateData;

    // Determinar lista de cursos asociados al certificado. Buscamos varias claves posibles
    const coursesList: any[] = Array.isArray(merged.certificate_courses) && merged.certificate_courses.length > 0
      ? merged.certificate_courses
      : Array.isArray((merged as any).courses) && (merged as any).courses.length > 0
        ? (merged as any).courses
        : [];

    // Si no hay asociaciones, creamos una entrada única basada en perCert
    const effectiveCourses = coursesList.length > 0 ? coursesList : [{ course_name: perCert.course_name ?? perCert.course_name, start: undefined, end: undefined }];

    // Obtener base URL para el QR, priorizando variable de entorno
    const baseUrl = (() => {
      // Priorizar variable de entorno de Vite
      const envUrl = import.meta.env?.VITE_FRONTEND_URL;
      if (envUrl) {
        return String(envUrl);
      }

      // Fallback a window.location
      if (typeof window === 'undefined') return '';

      // En desarrollo local, usar http para evitar problemas SSL
      const { hostname, port, protocol } = window.location;
      if (hostname === 'localhost' || hostname === '127.0.0.1') {
        const devUrl = `http://${hostname}${port ? `:${port}` : ''}`;
        return devUrl;
      }

      // En producción usar origin (incluye protocolo, host y puerto)
      return window.location.origin;
    })();

    const finalBase = baseUrl || '';

    // Nota: generaremos el QR por curso más abajo (dentro del bucle) para incluir el course_id

    // Si hay firma digital (id en Google Drive) y el cursante solicita firma DIGITAL,
    // intentar obtener la imagen desde Google Drive como data URL.
    let signatureDataUrl: string | undefined = undefined;
    try {
      const signId = (perCert as any).sign ?? undefined;
      // Si la constancia tiene sign y el método de firma es DIGITAL (a nivel de cursante o certificado), descargarla
      const cursanteTipo = (cursante as any).tipo_firma as string | undefined;
      const certTipo = (perCert as any).tipo_firma as string | undefined;

      if (signId && (cursanteTipo === 'DIGITAL' || certTipo === 'DIGITAL')) {
        if (signatureCache.has(signId)) {
          signatureDataUrl = signatureCache.get(signId);
        } else {
          // usar endpoint de descarga directo de Drive
          const driveUrl = `${appConfig.BACKEND_URL}/google/proxy-drive?id=${encodeURIComponent(signId)}`;

          // intentar convertir a data URL
          const resp = await fetch(driveUrl);

          if (resp.ok) {
            const blob = await resp.blob();

            signatureDataUrl = await new Promise<string>((resolve, reject) => {
              const reader = new FileReader();
              reader.onloadend = () => resolve(String(reader.result));
              reader.onerror = reject;
              reader.readAsDataURL(blob);
            });
          } else {
          }
          // almacenar en caché (incluso si es undefined) para evitar reintentos innecesarios
          signatureCache.set(signId, signatureDataUrl);
        }
      } else {
      }
    } catch (e) {
      // almacenar en caché un valor undefined para no reintentar
      try { if ((perCert as any).sign) signatureCache.set((perCert as any).sign, undefined); } catch (_) { }
      signatureDataUrl = undefined;
    }

    // Para cada curso asociado generamos un PDF (por usuario × curso)
    for (let ci = 0; ci < effectiveCourses.length; ci++) {
      const courseItem = effectiveCourses[ci] || {};
      // Resolver nombre, duracion y periodo desde la asociación si está disponible
      const resolvedCourseName = (courseItem?.course?.name ?? courseItem?.course_name ?? courseItem?.name ?? perCert.course_name ?? '').toString();
      const resolvedDuration = courseItem?.duration ?? courseItem?.course?.duration ?? perCert.course_duration ?? '';
      const s = courseItem?.start ?? courseItem?.fecha_inicio ?? courseItem?.start_date ?? undefined;
      const e = courseItem?.end ?? courseItem?.fecha_fin ?? courseItem?.end_date ?? undefined;
      const startNorm = s ? String(s).slice(0, 10) : undefined;
      const endNorm = e ? String(e).slice(0, 10) : undefined;
      const resolvedPeriod = (startNorm || endNorm) ? `${startNorm || ''}${startNorm && endNorm ? ' / ' : ''}${endNorm || ''}` : (perCert.course_period ?? '');

      // Intentar obtener id del curso de la asociación (priorizar _id de MongoDB)
      const courseId = courseItem?.course?._id ?? courseItem?.course?.id ?? courseItem?.course_id ?? courseItem?.id ?? undefined;

      const perCourseCert = {
        ...perCert,
        course_name: resolvedCourseName,
        course_duration: resolvedDuration,
        course_period: resolvedPeriod,
        course_id: courseId,
      } as DC3CertificateData;

      // Construir QR específico para este curso (añadir course_id como query param si existe)
      // Como usamos HashRouter, necesitamos incluir el # en la URL
      const qrUrl = courseId
        ? `${finalBase}/#/validar/${perCert.id}/${cursante.curp}?course_id=${encodeURIComponent(String(courseId))}`
        : `${finalBase}/#/validar/${perCert.id}/${cursante.curp}`;
      const qrDataUrl = await generateQrDataUrl(qrUrl);

      // Contenido para UN solo usuario y UN curso
      const pageContent = [
        ...buildPageContent(cursante, perCourseCert, logoDataUrl, qrDataUrl, signatureDataUrl),
        ...buildReversePage(),
      ];
      const docDefinition: any = {
        pageSize: "LETTER",
        pageMargins: [40, 30, 40, 30],
        content: pageContent,
        defaultStyle: { font: 'Roboto', fontSize: 9 },
      };

      const pdfBlob = await generateSinglePdfBlob(docDefinition);

      // Normalizar nombre para archivo: quitar acentos, caracteres inválidos, convertir espacios a guiones bajos
      function sanitizeFileName(name: string) {
        if (!name) return '';
        // Normalizar y remover diacríticos
        const normalized = name.normalize('NFD').replace(/\p{Diacritic}/gu, '');
        // Mantener letras, números, espacios, guiones y guiones bajos
        const cleaned = normalized.replace(/[^a-zA-Z0-9 _-]/g, '');
        // Colapsar espacios y reemplazarlos por guiones bajos
        const underscored = cleaned.replace(/\s+/g, '_').trim();
        // Limitar longitud para evitar problemas de nombres muy largos
        return underscored.substring(0, 100);
      }

      const baseName = sanitizeFileName(cursante.nombre || '') || 'constancia';
      const courseSafe = sanitizeFileName(resolvedCourseName || `curso_${ci}`) || `curso_${ci}`;
      const fileName = `${baseName}_${courseSafe}_${cursante.curp}.pdf`;
      zip.file(fileName, pdfBlob);
    }
  }

  const zipContent = await zip.generateAsync({ type: "blob" });
  saveAs(zipContent, zipFileName);

  function buildReversePage() {
    const title = (text: string) => ({
      text,
      bold: true,
      fontSize: 7.5,
      alignment: 'center',
      margin: [0, 0, 0, 5],
    });

    const tableHeader = (text: string, bold = true) => ({
      text,
      bold,
      fontSize: 6,
      alignment: 'left',
    });

    const cell = (text: string, bold = false) => ({
      text,
      fontSize: 6,
      bold,
      alignment: 'left',
    });

    return [
      { text: '', pageBreak: 'before' },

      title('CLAVES Y DENOMINACIONES DE ÁREAS Y SUBÁREAS DEL CATÁLOGO NACIONAL DE OCUPACIONES'),

      {
        columns: [
          {
            width: '50%',
            table: {
              widths: [22, '*'],
              body: [
                [tableHeader('/E DEL ÁREA/SUBÁ'), tableHeader('DENOMINACIÓN')],
                [cell('1', true), cell('Cultivo, crianza y aprovechamiento')],
                [cell('1.1'), cell('Agricultura y silvicultura')],
                [cell('1.2'), cell('Ganadería')],
                [cell('1.3'), cell('Pesca y acuacultura')],
                [cell(''), cell('')],
                [cell('2', true), cell('Extracción y suministro')],
                [cell('2.1'), cell('Exploración')],
                [cell('2.2'), cell('Extracción')],
                [cell('2.3'), cell('Refinación y beneficio')],
                [cell('2.4'), cell('Provisión de energía')],
                [cell('2.5'), cell('Provisión de agua')],
                [cell(''), cell('')],
                [cell('3', true), cell('Construcción')],
                [cell('3.1'), cell('Planeación y dirección de obras')],
                [cell('3.2'), cell('Edificación y urbanización')],
                [cell('3.3'), cell('Acabado')],
                [cell('3.4'), cell('Instalación y mantenimiento')],
                [cell(''), cell('')],
                [cell('4', true), cell('Tecnología')],
                [cell('4.1'), cell('Mecánica')],
                [cell('4.2'), cell('Electricidad')],
                [cell('4.3'), cell('Electrónica')],
                [cell('4.4'), cell('Informática')],
                [cell('4.5'), cell('Telecomunicaciones')],
                [cell('4.6'), cell('Procesos industriales')],
                [cell(''), cell('')],
                [cell('5', true), cell('Procesamiento y fabricación')],
                [cell('5.1'), cell('Minerales no metálicos')],
                [cell('5.2'), cell('Metales')],
                [cell('5.3'), cell('Alimentos y bebidas')],
                [cell('5.4'), cell('Textiles y prendas de vestir')],
                [cell('5.5'), cell('Materia orgánica')],
                [cell('5.6'), cell('Productos químicos')],
                [cell('5.7'), cell('Productos metálicos y de hule y plástico')],
                [cell('5.8'), cell('Productos eléctricos y electrónicos')],
                [cell('5.9'), cell('Productos impresos')],
              ],
            },
            layout: 'noBorders',
          },

          {
            width: '50%',
            table: {
              widths: [22, '*'],
              body: [
                [tableHeader('/E DEL ÁREA/SUBÁ'), tableHeader('DENOMINACIÓN')],
                [cell('6', true), cell('Transporte')],
                [cell('6.1'), cell('Ferroviario')],
                [cell('6.2'), cell('Autotransporte')],
                [cell('6.3'), cell('Aéreo')],
                [cell('6.4'), cell('Marítimo y fluvial')],
                [cell('6.5'), cell('Servicios de apoyo')],
                [cell(''), cell('')],
                [cell('7', true), cell('Provisión de bienes y servicios')],
                [cell('7.1'), cell('Comercio')],
                [cell('7.2'), cell('Alimentación y hospedaje')],
                [cell('7.3'), cell('Turismo')],
                [cell('7.4'), cell('Deporte y esparcimiento')],
                [cell('7.5'), cell('Servicios personales')],
                [cell('7.6'), cell('Reparación de artículos de uso doméstico y personal')],
                [cell('7.7'), cell('Limpieza')],
                [cell('7.8'), cell('Servicio postal y mensajería')],
                [cell(''), cell('')],
                [cell('8', true), cell('Gestión y soporte administrativo')],
                [cell('8.1'), cell('Bolsa, banca y seguros')],
                [cell('8.2'), cell('Administración')],
                [cell('8.3'), cell('Servicios legales')],
                [cell(''), cell('')],
                [cell('9', true), cell('Salud y protección social')],
                [cell('9.1'), cell('Servicios médicos')],
                [cell('9.2'), cell('Inspección sanitaria y del medio ambiente')],
                [cell('9.3'), cell('Seguridad social')],
                [cell('9.4'), cell('Protección de bienes y/o personas')],
                [cell(''), cell('')],
                [cell('10', true), cell('Comunicación')],
                [cell('10.1'), cell('Publicación')],
                [cell('10.2'), cell('Radio, cine, televisión y teatro')],
                [cell('10.3'), cell('Interpretación artística')],
                [cell('10.4'), cell('Traducción e interpretación lingüística')],
                [cell('10.5'), cell('Publicidad, propaganda y relaciones públicas')],
                [cell(''), cell('')],
                [cell('11', true), cell('Desarrollo y extensión del conocimiento')],
                [cell('11.1'), cell('Investigación')],
                [cell('11.2'), cell('Enseñanza')],
                [cell('11.3'), cell('Difusión cultural')],
              ],
            },
            layout: 'noBorders',
          },
        ],
        columnGap: 10,
        margin: [0, 0, 0, 10],
      },

      title('CLAVES Y DENOMINACIONES DEL CATÁLOGO DE ÁREAS TEMÁTICAS DE LOS CURSOS'),

      {
        table: {
          widths: [45, '*', 45, '*'],
          body: [
            [tableHeader('CLAVE DEL ÁREA'), tableHeader('DENOMINACIÓN'), tableHeader('CLAVE DEL ÁREA'), tableHeader('DENOMINACIÓN')],
            [cell('1000'), cell('Producción general'), cell('6000'), cell('Seguridad')],
            [cell('2000'), cell('Servicios'), cell('7000'), cell('Desarrollo personal y familiar')],
            [cell('3000'), cell('Administración, contabilidad y economía'), cell('8000'), cell('Uso de tecnologías de la información y comunicación')],
            [cell('4000'), cell('Comercialización'), cell('9000'), cell('Participación Social')],
            [cell('5000'), cell('Mantenimiento y reparación'), cell(''), cell('')],
          ],
        },
        layout: 'noBorders',
        margin: [0, 0, 0, 0],
      },

      {
        text: 'DC-3',
        alignment: 'right',
        fontSize: 6.5,
        bold: true,
        margin: [0, 2, 0, 0],
      },
      {
        text: 'REVERSO',
        alignment: 'right',
        fontSize: 6.5,
        bold: true,
        margin: [0, 0, 0, 0],
      },
    ];
  }

}