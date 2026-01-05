import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import QRCode from 'qrcode';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import appConfig from '../core/constants/appConfig';

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
  certificate_courses?: any[];
  sign?: string;
  course_id?: string;
  xlsx_object?: any;
}

export interface DC3User {
  nombre: string;
  curp: string;
  puesto_trabajo: string;
  ocupacion_especifica: string;
  tipo_firma?: 'DIGITAL' | 'FISICA';
}

// Coordenadas para llenar el formulario DC-3 (ajustar según el PDF real)
const COORDS: Record<string, any> = {
  // DATOS DEL TRABAJADOR
  nombre: { x: 63, y: 153, size: 9 },
  curp: { x: 66, y: 174, size: 9, spacing: 18.3 }, // Para letras individuales
  ocupacion: { x:396, y:174, xEnd:550, size: 7, centered: true },
  puesto: { x:63, y:194, size: 9}, // Centrado automático
  
  // DATOS DE LA EMPRESA
  empresa: { x:68, y:234, xEnd:545, size: 9, centered: true },
  rfc: { x: 66, y: 256, size: 10, spacing: 18.3 }, // Para letras individuales
  
  // DATOS DEL PROGRAMA
  curso: { x:65, y:299, xEnd:545, size: 9, centered: true },
  duracion:{ x:65, y:319, xEnd:183, size: 9, centered: true },
  fechaInicio: { x: 251, y: 319,spacing: 18.3, size: 9 },
  fechaFin: { x: 415, y: 319,spacing: 18.3, size: 9 },
  area: { x:65, y:339, xEnd:545, size: 7, centered: true },
  capacitador: { x: 63, y: 360, size: 7 },
  regStps: { x: 266, y: 360, size: 9 },
  
  // FIRMAS
  capacitadorFirma: { x: 79, y: 420, xEnd: 221, size: 7, centered: true }, // Nombre en la firma
  repLegal: { x:261, y:420, xEnd:387, size: 7, centered: true },
  repTrab:  { x:412, y:420, xEnd:534, size: 7, centered: true },
  
  // QR
  qr: { x: 500, y: 40, width: 60, height: 60 }
};

async function generateQrDataUrl(url: string): Promise<string> {
  return QRCode.toDataURL(url, { margin: 0, width: 200 });
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

async function fillPDFTemplate(
  cursante: DC3User,
  certData: DC3CertificateData,
  qrDataUrl: string,
  signatureDataUrl?: string
): Promise<Uint8Array> {
  
  // Cargar el template del PDF - usar ruta absoluta del dominio
  const templateUrl = `${window.location.protocol}//${window.location.host}/SolicitudDC3.pdf`;
  
  const response = await fetch(templateUrl);
  if (!response.ok) {
    throw new Error(`No se pudo cargar el template PDF. Status: ${response.status} - ${response.statusText}`);
  }
  
  const existingPdfBytes = await response.arrayBuffer();
  
  const pdfDoc = await PDFDocument.load(existingPdfBytes);
  const pages = pdfDoc.getPages();
  const firstPage = pages[0];
  
  // Cargar fuente
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  
  // Obtener dimensiones de la página
  const { height } = firstPage.getSize();
  
  // Helper para texto seguro
  const safeText = (text: any): string => (text || '').toString().toUpperCase();
  
  // Helper para calcular tamaño de fuente óptimo que quepa en el ancho disponible
  const getOptimalFontSize = (text: string, font: any, maxWidth: number, defaultSize: number, minSize: number = 6): number => {
    let size = defaultSize;
    let textWidth = font.widthOfTextAtSize(text, size);
    
    // Si el texto cabe con el tamaño por defecto, usarlo
    if (textWidth <= maxWidth) return size;
    
    // Reducir gradualmente hasta que quepa o llegar al mínimo
    while (size > minSize && textWidth > maxWidth) {
      size -= 0.5;
      textWidth = font.widthOfTextAtSize(text, size);
    }
    
    return Math.max(size, minSize);
  };
  
  // Helper para dibujar texto (con centrado automático si aplica)
  const drawField = (text: string, coordKey: string, font: any, customSize?: number) => {
    const coord = COORDS[coordKey];
    if (!text || !coord) return;
    
    let xPos = coord.x;
    const fontSize = customSize ?? coord.size;
    
    // Aplicar centrado si está configurado
    if (coord.centered && coord.xEnd) {
      const textWidth = font.widthOfTextAtSize(text, fontSize);
      const boxWidth = coord.xEnd - coord.x;
      xPos = coord.x + (boxWidth - textWidth) / 2;
    }
    
    firstPage.drawText(text, {
      x: xPos,
      y: height - coord.y,
      size: fontSize,
      font: font,
      color: rgb(0, 0, 0)
    });
  };
  
  // DATOS DEL TRABAJADOR
  // Nombre
  if (cursante.nombre) {
    drawField(safeText(cursante.nombre), 'nombre', fontBold);
  }
  
  // CURP (letra por letra)
  if (cursante.curp) {
    const curp = safeText(cursante.curp).padEnd(18, ' ').slice(0, 18);
    curp.split('').forEach((char, i) => {
      firstPage.drawText(char, {
        x: COORDS.curp.x + (i * COORDS.curp.spacing),
        y: height - COORDS.curp.y,
        size: COORDS.curp.size,
        font: fontBold,
        color: rgb(0, 0, 0)
      });
    });
  }
  
  // Ocupación
  if (cursante.ocupacion_especifica) {
    drawField(safeText(cursante.ocupacion_especifica), 'ocupacion', fontBold);
  }
  
  // Puesto
  if (cursante.puesto_trabajo) {
    drawField(safeText(cursante.puesto_trabajo), 'puesto', fontBold);
  }
  
  // DATOS DE LA EMPRESA
  // Razón social
  if (certData.company_name) {
    drawField(safeText(certData.company_name), 'empresa', fontBold);
  }
  
  // RFC (letra por letra)
  const rfcRaw = certData.rfc || certData.company_rfc || '';
  if (rfcRaw) {
    const rfc = safeText(rfcRaw).replace(/[^A-Z0-9]/g, '').padEnd(13, ' ').slice(0, 13);
    rfc.split('').forEach((char, i) => {
      firstPage.drawText(char, {
        x: COORDS.rfc.x + (i * COORDS.rfc.spacing),
        y: height - COORDS.rfc.y,
        size: COORDS.rfc.size,
        font: fontBold,
        color: rgb(0, 0, 0)
      });
    });
  }
  
  // DATOS DEL PROGRAMA
  // Nombre del curso (con ajuste automático de tamaño)
  if (certData.course_name) {
    const cursoText = safeText(certData.course_name);
    const coord = COORDS.curso;
    const maxWidth = coord.xEnd - coord.x;
    const optimalSize = getOptimalFontSize(cursoText, fontBold, maxWidth, coord.size, 6);
    drawField(cursoText, 'curso', fontBold, optimalSize);
  }
  
  // Duración
  if (certData.course_duration) {
    drawField(certData.course_duration.toString(), 'duracion', fontBold);
  }
  
  // Fechas - formato YYYYMMDD para espaciado individual
  const [inicioStr, finStr] = (certData.course_period || '').split(/\s*\/\s*/);
  const fInicio = splitDateParts(inicioStr);
  const fFin = splitDateParts(finStr);
  
  // Formato: YYYYMMDD (sin separadores)
  const fechaInicioText = `${fInicio.a.join('')}${fInicio.m.join('')}${fInicio.d.join('')}`;
  const fechaFinText = `${fFin.a.join('')}${fFin.m.join('')}${fFin.d.join('')}`;
  
  // Fecha inicio (8 dígitos con espaciado)
  if (fechaInicioText && fechaInicioText.length === 8 && fechaInicioText !== '00000000') {
    fechaInicioText.split('').forEach((char, i) => {
      firstPage.drawText(char, {
        x: COORDS.fechaInicio.x + (i * COORDS.fechaInicio.spacing),
        y: height - COORDS.fechaInicio.y,
        size: COORDS.fechaInicio.size,
        font: fontBold,
        color: rgb(0, 0, 0)
      });
    });
  }
  
  // Fecha fin (8 dígitos con espaciado)
  if (fechaFinText && fechaFinText.length === 8 && fechaFinText !== '00000000') {
    fechaFinText.split('').forEach((char, i) => {
      firstPage.drawText(char, {
        x: COORDS.fechaFin.x + (i * COORDS.fechaFin.spacing),
        y: height - COORDS.fechaFin.y,
        size: COORDS.fechaFin.size,
        font: fontBold,
        color: rgb(0, 0, 0)
      });
    });
  }
  
  // Área temática
  drawField(safeText(certData.area_tematica || '6000 Seguridad'), 'area', fontBold);
  
  // Capacitador
  if (certData.trainer_fullname) {
    firstPage.drawText(safeText(certData.trainer_fullname), {
      x: COORDS.capacitador.x,
      y: height - COORDS.capacitador.y,
      size: COORDS.capacitador.size,
      font: fontBold,
      color: rgb(0, 0, 0)
    });
  }
  
  // REG STPS
  if (certData.stps) {
    firstPage.drawText(safeText(certData.stps), {
      x: COORDS.regStps.x,
      y: height - COORDS.regStps.y,
      size: COORDS.regStps.size,
      font: fontBold,
      color: rgb(0, 0, 0)
    });
  }
  
  // Representantes
  if (certData.legal_representative) {
    drawField(safeText(certData.legal_representative), 'repLegal', font);
  }
  
  if (certData.workers_representative) {
    drawField(safeText(certData.workers_representative), 'repTrab', font);
  }
  
  // Nombre del capacitador en la firma (siempre)
  if (certData.trainer_fullname) {
    drawField(safeText(certData.trainer_fullname), 'capacitadorFirma', font);
  }
  
  // Firma digital del capacitador (opcional, encima del nombre)
  if (signatureDataUrl) {
    try {
      const signImageBytes = await fetch(signatureDataUrl).then(res => res.arrayBuffer());
      const signImage = await pdfDoc.embedPng(signImageBytes);

      // Evitar escalar hacia arriba (no hacer upscale) para prevenir pixelado.
      // Redimensionar proporcionalmente para caber en un máximo razonable.
      const intrinsicWidth = (signImage as any).width ?? 0;
      const intrinsicHeight = (signImage as any).height ?? 0;
      const maxWidth = 140; // ancho máximo en pts
      const maxHeight = 60; // alto máximo en pts
      const scale = intrinsicWidth && intrinsicHeight ? Math.min(1, Math.min(maxWidth / intrinsicWidth, maxHeight / intrinsicHeight)) : 1;
      const drawWidth = Math.round(intrinsicWidth * scale) || maxWidth;
      const drawHeight = Math.round(intrinsicHeight * scale) || maxHeight;

      const xPos = 85;
      // Mover la firma ligeramente hacia arriba (reducimos la coordenada de referencia)
      const verticalOffset = 35; // puntos que sube la imagen
      const yPos = height - (465 - verticalOffset);

      firstPage.drawImage(signImage, {
        x: xPos,
        y: yPos,
        width: drawWidth,
        height: drawHeight,
      });
    } catch (e) {
      // fallbacks silenciosos
    }
  }
  
  // QR Code
  const qrImageBytes = await fetch(qrDataUrl).then(res => res.arrayBuffer());
  const qrImage = await pdfDoc.embedPng(qrImageBytes);
  
  firstPage.drawImage(qrImage, {
    x: COORDS.qr.x,
    y: height - COORDS.qr.y - COORDS.qr.height,
    width: COORDS.qr.width,
    height: COORDS.qr.height
  });
  
  return await pdfDoc.save();
}

export async function generateAndDownloadZipDC3FromTemplate(
  certificateData: DC3CertificateData,
  users: Array<DC3User & { certificate_overrides?: Partial<DC3CertificateData> }>,
  zipFileName: string = "constancias.zip"
) {
  const zip = new JSZip();
  
  // Cache de firmas
  const signatureCache = new Map<string, string | undefined>();
  
  for (const cursante of users) {
    const merged = { ...(certificateData ?? {}), ...(cursante.certificate_overrides ?? {}) } as any;
    const perCert: DC3CertificateData = merged as DC3CertificateData;
    
    
    // Obtener base URL para QR
    const baseUrl = (() => {
      const envUrl = import.meta.env?.VITE_FRONTEND_URL;
      if (envUrl) return String(envUrl);
      if (typeof window === 'undefined') return '';
      const { hostname, port } = window.location;
      if (hostname === 'localhost' || hostname === '127.0.0.1') {
        return `http://${hostname}${port ? `:${port}` : ''}`;
      }
      return window.location.origin;
    })();
    
    // Generar QR
    const courseId = perCert.course_id ?? '';
    const qrUrl = courseId 
      ? `${baseUrl}/#/validar/${perCert.id}/${cursante.curp}?course_id=${encodeURIComponent(String(courseId))}`
      : `${baseUrl}/#/validar/${perCert.id}/${cursante.curp}`;
    const qrDataUrl = await generateQrDataUrl(qrUrl);
    
    // Obtener firma digital si existe
    let signatureDataUrl: string | undefined = undefined;
    try {
      const signId = (perCert as any).sign ?? undefined;
      const cursanteTipo = (cursante as any).tipo_firma as string | undefined;
      const certTipo = (perCert as any).tipo_firma as string | undefined;
      const xlsxTipo = (perCert as any).xlsx_object?.tipo_firma as string | undefined;
      
      // Solo incluir firma si:
      // 1. Existe signId (hay firma disponible)
      // 2. Y NO es explícitamente 'FISICA' (si no se especifica tipo_firma o es 'DIGITAL', usar firma)
      const tipoFirmaFinal = cursanteTipo ?? certTipo ?? xlsxTipo;
      
      if (signId && tipoFirmaFinal !== 'FISICA') {
        if (signatureCache.has(signId)) {
          signatureDataUrl = signatureCache.get(signId);
        } else {
          const driveUrl = `${appConfig.BACKEND_URL}/google/proxy-drive?id=${encodeURIComponent(signId)}`;
          const resp = await fetch(driveUrl);
          if (resp.ok) {
            const blob = await resp.blob();
            signatureDataUrl = await new Promise<string>((resolve, reject) => {
              const reader = new FileReader();
              reader.onloadend = () => resolve(String(reader.result));
              reader.onerror = reject;
              reader.readAsDataURL(blob);
            });
            signatureCache.set(signId, signatureDataUrl);
          }
        }
      }
    } catch (e) {
      signatureDataUrl = undefined;
    }
    
    // Generar PDF usando template
    const pdfBytes = await fillPDFTemplate(cursante, perCert, qrDataUrl, signatureDataUrl);
    
    // Nombre de archivo
    function sanitizeFileName(name: string) {
      if (!name) return '';
      const normalized = name.normalize('NFD').replace(/\p{Diacritic}/gu, '');
      const cleaned = normalized.replace(/[^a-zA-Z0-9 _-]/g, '');
      const underscored = cleaned.replace(/\s+/g, '_').trim();
      return underscored.substring(0, 100);
    }
    
    const baseName = sanitizeFileName(cursante.nombre || '') || 'constancia';
    const courseName = sanitizeFileName(perCert.course_name || '') || 'curso';
    const fileName = `${baseName}_${courseName}_${cursante.curp}.pdf`;
    
    zip.file(fileName, pdfBytes);
  }
  
  const zipContent = await zip.generateAsync({ type: "blob" });
  saveAs(zipContent, zipFileName);
}

/**
 * Genera un PDF de reporte partiendo de una plantilla y un PDF de tabla (generado por pdfMake).
 * - Inserta encabezados (empresa, curso, duración, fechas, capacitador, registro) y las imágenes (logo, firma)
 * - Adjunta las páginas del PDF de la tabla (reportPdfBytes) al final del documento
 */
export async function generateReportFromTemplate(
  certificateData: DC3CertificateData,
  reportPdfBytes: Uint8Array | ArrayBuffer,
  templateFileName: string = 'Reporte.pdf',
  imageFileIds?: string[] // IDs de archivos (ej. Google Drive) para insertar en la cuadrícula 2x3
): Promise<Uint8Array> {
  // Cargar template

  
  const templateUrl = `${window.location.protocol}//${window.location.host}/${templateFileName}`;
  const resp = await fetch(templateUrl);
  if (!resp.ok) throw new Error(`No se pudo cargar el template ${templateFileName}`);
  const templateBytes = await resp.arrayBuffer();

  const pdfDoc = await PDFDocument.load(templateBytes);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

  const pages = pdfDoc.getPages();
  const firstPage = pages[0];
  const { height } = firstPage.getSize();

  const safeText = (t: any) => (t || '').toString().toUpperCase();
  
  // Helper para calcular tamaño de fuente óptimo que quepa en el ancho disponible
  const getOptimalFontSize = (text: string, font: any, maxWidth: number, defaultSize: number, minSize: number = 8): number => {
    let size = defaultSize;
    let textWidth = font.widthOfTextAtSize(text, size);
    
    // Si el texto cabe con el tamaño por defecto, usarlo
    if (textWidth <= maxWidth) return size;
    
    // Reducir gradualmente hasta que quepa o llegar al mínimo
    while (size > minSize && textWidth > maxWidth) {
      size -= 0.5;
      textWidth = font.widthOfTextAtSize(text, size);
    }
    
    return Math.max(size, minSize);
  };

  // Coordenadas aproximadas para el encabezado del reporte (ajustar si es necesario)
  // Valores Y reducidos para colocar los datos más arriba en la página
  const REPORT_COORDS: Record<string, any> = {
    course: { x: 40, y: 145, size: 15, xEnd: 555, centered: true },
    duration: { x: 450, y: 190, size: 10, centered: false },
    period: { x: 60, y: 190, size: 10, centered: false },
    company: { x: 60, y: 200, size: 10, centered: false },
    trainer: { x: 60, y: 210, size: 10, centered: false },
    stps: { x: 400, y: 210, size: 10, centered: false },
  };

  // Dibujar texto principal
  try {
    // Nombre del curso con ajuste automático de tamaño
    if (certificateData.certificate_courses && certificateData.certificate_courses.length > 0) {
      const txt = safeText(certificateData.certificate_courses[0].course.name);

      const maxW = REPORT_COORDS.course.xEnd - REPORT_COORDS.course.x;
      const optimalSize = getOptimalFontSize(txt, fontBold, maxW, REPORT_COORDS.course.size, 8);
      const textWidth = fontBold.widthOfTextAtSize(txt, optimalSize);
      const xPos = REPORT_COORDS.course.x + Math.max(0, (maxW - textWidth) / 2);

      firstPage.drawText(txt, {
        x: xPos,
        y: height - REPORT_COORDS.course.y,
        size: optimalSize,
        font: fontBold,
        color: rgb(0, 0, 0),
      });
    }

    // Duración
    if (certificateData.certificate_courses && certificateData.certificate_courses.length > 0) {
      firstPage.drawText(String("Duración: " + certificateData.certificate_courses[0].course.duration+"hrs"), { x: REPORT_COORDS.duration.x, y: height - REPORT_COORDS.duration.y, size: REPORT_COORDS.duration.size, font, color: rgb(0,0,0) });
    }

    // Periodo
    if (certificateData.certificate_courses && certificateData.certificate_courses.length > 0) {
      firstPage.drawText(String("Periodo: " + certificateData.certificate_courses[0].start+" / "+certificateData.certificate_courses[0].end), { x: REPORT_COORDS.period.x, y: height - REPORT_COORDS.period.y, size: REPORT_COORDS.period.size, font, color: rgb(0,0,0) });
    }

    // Empresa
    if (certificateData.company_name) {
      firstPage.drawText(safeText("Empresa: " + certificateData.company_name), { x: REPORT_COORDS.company.x, y: height - REPORT_COORDS.company.y, size: REPORT_COORDS.company.size, font, color: rgb(0,0,0) });
    }

    // Capacitador
    if (certificateData.trainer_fullname) {
      firstPage.drawText(safeText("Capacitador: " + certificateData.trainer_fullname), { x: REPORT_COORDS.trainer.x, y: height - REPORT_COORDS.trainer.y, size: REPORT_COORDS.trainer.size, font, color: rgb(0,0,0) });
    }

    // Registro / STPS
    if (certificateData.stps) {
      firstPage.drawText(safeText("STPS: " + certificateData.stps), { x: REPORT_COORDS.stps.x, y: height - REPORT_COORDS.stps.y, size: REPORT_COORDS.stps.size, font, color: rgb(0,0,0) });
    }
  } catch (e) {
    // continuar aun si algún campo falla
  }

  // Insertar galería de imágenes (grid 2x3) si se pasaron IDs (imageFileIds) o si existen en certificateData.xlsx_object.reportes
  try {
  const idsFromArgs = Array.isArray(imageFileIds) ? imageFileIds : [];
  const idsFromCert = Array.isArray((certificateData as any)?.xlsx_object?.reportes) 
  ? (certificateData as any).xlsx_object.reportes.find((r: any) => Array.isArray(r?.archivos))?.archivos ?? []
  : []; 
     const ids = (idsFromArgs && idsFromArgs.length > 0) ? idsFromArgs : (Array.isArray(idsFromCert) ? idsFromCert : []);


    if (Array.isArray(ids) && ids.length > 0) {
      // Dibujar encabezado "EVIDENCIAS FOTOGRÁFICAS"
      const headerText = 'EVIDENCIAS FOTOGRÁFICAS';
      const headerSize = 12;
      const headerY = 270;
      const headerX = 60;
      firstPage.drawText(headerText, {
        x: headerX,
        y: height - headerY,
        size: headerSize,
        font: fontBold,
        color: rgb(0, 0, 0)
      });

      const left = 60;
      const right = 550;
      const gap = 10;
      const contentW = right - left;
      const boxW = Math.round((contentW - gap) / 2);
      const boxH = 140; // altura de cada recuadro
      const topY = 300; // posición Y del borde superior del primer renglón

      for (let i = 0; i < 6; i++) {
        const col = i % 2;
        const row = Math.floor(i / 2);
        const x = left + col * (boxW + gap);
        const yTop = topY + row * (boxH + gap);
        const yBottom = height - yTop - boxH; // convertir a coordenadas de pdf-lib (origen abajo)

        const fileId = ids[i];
        if (!fileId) continue;


        try {
          const driveUrl = `${appConfig.BACKEND_URL}/google/proxy-drive?id=${encodeURIComponent(String(fileId))}`;
          const r = await fetch(driveUrl);
          if (!r.ok) continue;
          const blob = await r.blob();
          const dataUrl = await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onloadend = () => resolve(String(reader.result)); reader.onerror = reject; reader.readAsDataURL(blob); });
          const bytes = await fetch(dataUrl).then(r2 => r2.arrayBuffer());

          // Intentar embebed PNG y fallback a JPG
          let img: any = null;
          try { img = await pdfDoc.embedPng(bytes);  }
          catch (err) { try { img = await pdfDoc.embedJpg(bytes); } catch (err2) {  } }
          if (!img) continue;

          const iw = (img as any).width ?? boxW;
          const ih = (img as any).height ?? boxH;
          const padding = 6; // margen interno
          const scale = Math.min((boxW - padding * 2) / iw, (boxH - padding * 2) / ih, 1);
          const drawW = Math.round(iw * scale);
          const drawH = Math.round(ih * scale);
          const imgX = x + Math.round((boxW - drawW) / 2);
          const imgY = yBottom + Math.round((boxH - drawH) / 2);

          firstPage.drawImage(img, { x: imgX, y: imgY, width: drawW, height: drawH });
        } catch (e) {
          // ignorar fallo en una imagen individual
        }
      }
    } else {
    }
  } catch (e) { 
    /* ignore grid failures */ 
  }

  return await pdfDoc.save();
}

/**
 * Genera un reporte fotográfico simple con imágenes locales (base64 data URLs)
 * No requiere certificado existente, solo datos del formulario
 */
export async function generatePhotoReportFromTemplate(
  courseName: string,
  trainerName: string,
  startDate: string,
  endDate: string,
  imageDataUrls: string[], // Array de data URLs (base64) de imágenes
  stps?: string,
  courseDuration?: string,
  companyName?: string,
  templateFileName: string = 'Reporte.pdf'
): Promise<Uint8Array> {
  // Cargar template
  const templateUrl = `${window.location.protocol}//${window.location.host}/${templateFileName}`;
  const resp = await fetch(templateUrl);
  if (!resp.ok) throw new Error(`No se pudo cargar el template ${templateFileName}`);
  const templateBytes = await resp.arrayBuffer();

  const pdfDoc = await PDFDocument.load(templateBytes);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

  const pages = pdfDoc.getPages();
  const firstPage = pages[0];
  const { height } = firstPage.getSize();

  const safeText = (t: any) => (t || '').toString().toUpperCase();
  
  // Helper para calcular tamaño de fuente óptimo
  const getOptimalFontSize = (text: string, font: any, maxWidth: number, defaultSize: number, minSize: number = 8): number => {
    let size = defaultSize;
    let textWidth = font.widthOfTextAtSize(text, size);
    
    if (textWidth <= maxWidth) return size;
    
    while (size > minSize && textWidth > maxWidth) {
      size -= 0.5;
      textWidth = font.widthOfTextAtSize(text, size);
    }
    
    return Math.max(size, minSize);
  };

  // Coordenadas para el encabezado del reporte
  const REPORT_COORDS: Record<string, any> = {
    course: { x: 40, y: 145, size: 15, xEnd: 555, centered: true },
    duration: { x: 60, y: 170, size: 10, centered: false },
    period: { x: 60, y: 190, size: 10, centered: false },
    company: { x: 60, y: 200, size: 10, centered: false },
    trainer: { x: 60, y: 210, size: 10, centered: false },
    stps: { x: 60, y: 230, size: 10, centered: false },
  };

  // Dibujar encabezado
  try {
    // Nombre del curso
    const courseText = safeText(courseName);
    const maxW = REPORT_COORDS.course.xEnd - REPORT_COORDS.course.x;
    const optimalSize = getOptimalFontSize(courseText, fontBold, maxW, REPORT_COORDS.course.size, 8);
    const textWidth = fontBold.widthOfTextAtSize(courseText, optimalSize);
    const xPos = REPORT_COORDS.course.x + Math.max(0, (maxW - textWidth) / 2);

    firstPage.drawText(courseText, {
      x: xPos,
      y: height - REPORT_COORDS.course.y,
      size: optimalSize,
      font: fontBold,
      color: rgb(0, 0, 0),
    });

    // Duración (si está disponible)
    if (courseDuration) {
      const durationText = `Duración: ${courseDuration}`;
      firstPage.drawText(durationText, {
        x: REPORT_COORDS.duration.x,
        y: height - REPORT_COORDS.duration.y,
        size: REPORT_COORDS.duration.size,
        font,
        color: rgb(0, 0, 0)
      });
    }

    // Periodo
    const periodText = `Periodo: ${startDate} / ${endDate}`;
    firstPage.drawText(periodText, {
      x: REPORT_COORDS.period.x,
      y: height - REPORT_COORDS.period.y,
      size: REPORT_COORDS.period.size,
      font,
      color: rgb(0, 0, 0)
    });

    // Empresa
    if (companyName) {
      const companyText = safeText(`Empresa: ${companyName}`);
      firstPage.drawText(companyText, {
        x: REPORT_COORDS.company.x,
        y: height - REPORT_COORDS.company.y,
        size: REPORT_COORDS.company.size,
        font,
        color: rgb(0, 0, 0)
      });
    }

    // Capacitador
    const trainerText = safeText(`Capacitador: ${trainerName}`);
    firstPage.drawText(trainerText, {
      x: REPORT_COORDS.trainer.x,
      y: height - REPORT_COORDS.trainer.y,
      size: REPORT_COORDS.trainer.size,
      font,
      color: rgb(0, 0, 0)
    });

    // STPS (si está disponible)
    if (stps) {
      const stpsText = `STPS: ${stps}`;
      firstPage.drawText(stpsText, {
        x: REPORT_COORDS.stps.x,
        y: height - REPORT_COORDS.stps.y,
        size: REPORT_COORDS.stps.size,
        font,
        color: rgb(0, 0, 0)
      });
    }
  } catch (e) {
    // continuar si falla algún campo
  }

  // Insertar galería de imágenes (grid 2x3)
  try {
    if (Array.isArray(imageDataUrls) && imageDataUrls.length > 0) {
      // Dibujar encabezado "EVIDENCIAS FOTOGRÁFICAS"
      const headerText = 'EVIDENCIAS FOTOGRÁFICAS';
      const headerSize = 12;
      const headerY = 270;
      const headerX = 60;
      firstPage.drawText(headerText, {
        x: headerX,
        y: height - headerY,
        size: headerSize,
        font: fontBold,
        color: rgb(0, 0, 0)
      });

      const left = 60;
      const right = 550;
      const gap = 10;
      const contentW = right - left;
      const boxW = Math.round((contentW - gap) / 2);
      const boxH = 140;
      const topY = 300;

      for (let i = 0; i < Math.min(6, imageDataUrls.length); i++) {
        const col = i % 2;
        const row = Math.floor(i / 2);
        const x = left + col * (boxW + gap);
        const yTop = topY + row * (boxH + gap);
        const yBottom = height - yTop - boxH;

        const dataUrl = imageDataUrls[i];
        if (!dataUrl) continue;

        try {
          // Convertir data URL a bytes
          const bytes = await fetch(dataUrl).then(r => r.arrayBuffer());

          // Intentar embed PNG y fallback a JPG
          let img: any = null;
          try {
            img = await pdfDoc.embedPng(bytes);
          } catch (err) {
            try {
              img = await pdfDoc.embedJpg(bytes);
            } catch (err2) {
              continue;
            }
          }
          
          if (!img) continue;

          const iw = (img as any).width ?? boxW;
          const ih = (img as any).height ?? boxH;
          const padding = 6;
          const scale = Math.min((boxW - padding * 2) / iw, (boxH - padding * 2) / ih, 1);
          const drawW = Math.round(iw * scale);
          const drawH = Math.round(ih * scale);
          const imgX = x + Math.round((boxW - drawW) / 2);
          const imgY = yBottom + Math.round((boxH - drawH) / 2);

          firstPage.drawImage(img, { x: imgX, y: imgY, width: drawW, height: drawH });
        } catch (e) {
          // ignorar fallo en imagen individual
        }
      }
    }
  } catch (e) {
    // ignorar fallos en galería
  }

  return await pdfDoc.save();
}

// Coordenadas específicas para DiplomaDoGroup
const DOGROUP_TEMPLATE_COORDS: Record<string, any> = {
  "DURACION": { x: 224, y: 540, size: 12 },
  "CURSO": { x: 35, y: 455, size: 15, xEnd: 560, centered: true },
  "FECHA FIN": { x: 325, y: 557, size: 12 },
  "FECHA INICIO": { x: 225, y: 557, size: 12 },
  "CAPACITADOR": { x: 185, y: 665, size: 12, xEnd: 407, centered: true },
  "STPS": { x: 185, y: 675, size: 10, xEnd: 407, centered: true },
  "CURSANTE": { x: 150, y: 347,xEnd: 450, size: 18, centered: true },
  "FIRMA": { x: 150, y: 605, xEnd: 450, maxWidth: 240, maxHeight: 80, centered: true  },
  "QR": { x: 520, y: 120, size: 50, xEnd: 579 }
};

export async function generateDiplomasDoGroupFromTemplate(
  certificateData: DC3CertificateData,
  users: Array<DC3User>,
  templateFileName: string = 'DiplomaDoGroup.pdf'
): Promise<Array<{ name: string; bytes: Uint8Array }>> {
  // Cargar template una sola vez
  const templateUrl = `${window.location.protocol}//${window.location.host}/${templateFileName}`;
  const resp = await fetch(templateUrl);
  if (!resp.ok) throw new Error(`No se pudo cargar el template ${templateFileName}`);
  const templateBytes = await resp.arrayBuffer();

  const results: Array<{ name: string; bytes: Uint8Array }> = [];

  // Pre-fetch signature (si existe) y cachearla para usar en todos los PDFs de este certificado
  const signatureCache = new Map<string, string | undefined>();
  let globalSignatureDataUrl: string | undefined = undefined;
  try {
    const signIdGlobal = (certificateData as any)?.sign ?? undefined;
    if (signIdGlobal) {
      if (signatureCache.has(signIdGlobal)) {
        globalSignatureDataUrl = signatureCache.get(signIdGlobal);
      } else {
        const driveUrl = `${appConfig.BACKEND_URL}/google/proxy-drive?id=${encodeURIComponent(signIdGlobal)}`;
        const respSig = await fetch(driveUrl);
        if (respSig.ok) {
          const blob = await respSig.blob();
          globalSignatureDataUrl = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(String(reader.result));
            reader.onerror = reject;
            reader.readAsDataURL(blob);
          });
          signatureCache.set(signIdGlobal, globalSignatureDataUrl);
        }
      }
    }
  } catch (e) {
    globalSignatureDataUrl = undefined;
  }

  for (const user of users) {
    const pdfDoc = await PDFDocument.load(templateBytes);
    const pages = pdfDoc.getPages();
    const firstPage = pages[0];
    const { height } = firstPage.getSize();

    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

    // Resolver texto para cada clave
    const resolveValue = (key: string) => {
      if (!key) return '';
      if (key === 'QR') return 'QR';
      if (key === 'CURSANTE') return user.nombre ?? '';
      if (key === 'CURSO') return certificateData.course_name ?? '';
      if (key === 'DURACION') return String(certificateData.course_duration ?? '');
      if (key === 'FECHA FIN') {
        const parts = (certificateData.course_period || '').split(/\s*\/\s*/);
        return parts[1]  ?? '';
      }
      if (key === 'FECHA INICIO') {
        const parts = (certificateData.course_period || '').split(/\s*\/\s*/);
        return parts[0] ?? '';
      }
      if (key === 'CAPACITADOR') return certificateData.trainer_fullname ?? '';
      if (key === 'STPS') return certificateData.stps ?? '';
      // course name fallback (for any other large keys)
      if ((certificateData.course_name || '').length > 0 && key.length > 10) return certificateData.course_name;
      return key;
    };

    // Draw elements
    for (const k of Object.keys(DOGROUP_TEMPLATE_COORDS)) {
      const coord = DOGROUP_TEMPLATE_COORDS[k];
      if (k === 'QR') {
        const courseId = certificateData.course_id ?? '';
        const baseUrl = (() => {
          const envUrl = import.meta.env?.VITE_FRONTEND_URL;
          if (envUrl) return String(envUrl);
          if (typeof window === 'undefined') return '';
          const { hostname, port } = window.location;
          if (hostname === 'localhost' || hostname === '127.0.0.1') {
            return `http://${hostname}${port ? `:${port}` : ''}`;
          }
          return window.location.origin;
        })();
        const qrUrl = courseId ? `${baseUrl}/#/validar/${certificateData.id}/${user.curp}?course_id=${encodeURIComponent(String(courseId))}` : `${baseUrl}/#/validar/${certificateData.id}/${user.curp}`;
        const qrDataUrl = await generateQrDataUrl(qrUrl);
        try {
          const qrBytes = await fetch(qrDataUrl).then(r => r.arrayBuffer());
          const qrImage = await pdfDoc.embedPng(qrBytes);
          const size = coord.size || 50;
          firstPage.drawImage(qrImage, { x: coord.x, y: height - coord.y - size, width: size, height: size });
        } catch (e) { /* ignore qr failures */ }
        continue;
      }

      // Inserción obligatoria de la firma si existe (sin respetar tipo_firma)
      if (k === 'FIRMA') {
        const signatureDataUrl = globalSignatureDataUrl;
        if (signatureDataUrl) {
          try {
            const signBytes = await fetch(signatureDataUrl).then(r => r.arrayBuffer());
            const signImage = await pdfDoc.embedPng(signBytes);

            const intrinsicWidth = (signImage as any).width ?? 0;
            const intrinsicHeight = (signImage as any).height ?? 0;
            const maxWidth = coord.maxWidth ?? 240;
            const maxHeight = coord.maxHeight ?? 80;
            const scale = intrinsicWidth && intrinsicHeight ? Math.min(1, Math.min(maxWidth / intrinsicWidth, maxHeight / intrinsicHeight)) : 1;
            const drawWidth = Math.round(intrinsicWidth * scale) || maxWidth;
            const drawHeight = Math.round(intrinsicHeight * scale) || maxHeight;

            // Centrar horizontalmente dentro del área
            let xPos = coord.x;
            if (coord.xEnd) {
              const boxW = coord.xEnd - coord.x;
              xPos = coord.x + Math.max(0, (boxW - drawWidth) / 2);
            }

            const yPos = height - coord.y - drawHeight / 2;
            firstPage.drawImage(signImage, { x: xPos, y: yPos, width: drawWidth, height: drawHeight });
          } catch (e) {
            /* ignore signature failures */
          }
        }
        continue;
      }

      const text = String(resolveValue(k) ?? '');
      if (!text) continue;
      const fontToUse = (coord && coord.size && coord.size > 12) ? fontBold : font;

      // Helper: wrap text by words to fit within maxWidth
      const wrapText = (input: string, fontRef: any, size: number, maxWidth: number): string[] => {
        const words = input.split(/\s+/).filter(Boolean);
        const lines: string[] = [];
        let current = '';
        for (const w of words) {
          const test = current ? `${current} ${w}` : w;
          const width = fontRef.widthOfTextAtSize(test, size);
          if (width <= maxWidth) {
            current = test;
          } else {
            if (current) lines.push(current);
            // word itself may be too long; split it if needed
            const wordWidth = fontRef.widthOfTextAtSize(w, size);
            if (wordWidth <= maxWidth) {
              current = w;
            } else {
              let chunk = '';
              for (const ch of w) {
                const t = chunk + ch;
                if (fontRef.widthOfTextAtSize(t, size) <= maxWidth) {
                  chunk = t;
                } else {
                  if (chunk) lines.push(chunk);
                  chunk = ch;
                }
              }
              current = chunk;
            }
          }
        }
        if (current) lines.push(current);
        return lines;
      };

      const boxWidth = coord.xEnd ? (coord.xEnd - coord.x) : undefined;
      const lineHeight = Math.round(coord.size * 1.2);
      // Solo aplicar wrapping para el nombre del curso (CURSO)
      let lines: string[] = [text];
      if (k === 'CURSO' && boxWidth) {
        lines = wrapText(text, fontToUse, coord.size, boxWidth);
      }
      const startY = height - coord.y;

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        let xPos = coord.x;
        if (coord.centered && coord.xEnd) {
          const tw = fontToUse.widthOfTextAtSize(line, coord.size);
          xPos = coord.x + Math.max(0, (boxWidth! - tw) / 2);
        }
        const yPos = startY - (i * lineHeight);
        firstPage.drawText(line, { x: xPos, y: yPos, size: coord.size, font: fontToUse, color: rgb(0, 0, 0) });
      }
    }

    const pdfBytes = await pdfDoc.save();
    const name = `${(user.nombre || 'diploma').replace(/[^a-zA-Z0-9 _-]/g, '_').substring(0, 80)}_${(certificateData.course_name || '').replace(/[^a-zA-Z0-9 _-]/g, '_').substring(0, 50)}_${(user.curp || '')}.pdf`;
    results.push({ name, bytes: pdfBytes });
  }

  return results;
}

