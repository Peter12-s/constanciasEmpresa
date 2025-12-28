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
  
  // Helper para dibujar texto (con centrado automático si aplica)
  const drawField = (text: string, coordKey: string, font: any) => {
    const coord = COORDS[coordKey];
    if (!text || !coord) return;
    
    let xPos = coord.x;
    
    // Aplicar centrado si está configurado
    if (coord.centered && coord.xEnd) {
      const textWidth = font.widthOfTextAtSize(text, coord.size);
      const boxWidth = coord.xEnd - coord.x;
      xPos = coord.x + (boxWidth - textWidth) / 2;
    }
    
    firstPage.drawText(text, {
      x: xPos,
      y: height - coord.y,
      size: coord.size,
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
  // Nombre del curso
  if (certData.course_name) {
    drawField(safeText(certData.course_name), 'curso', fontBold);
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
      
      firstPage.drawImage(signImage, {
        x: 60,
        y: height - 500,
        width: 220,
        height: 150
      });
    } catch (e) {
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
      
      
      if (signId && (cursanteTipo === 'DIGITAL' || certTipo === 'DIGITAL' || xlsxTipo === 'DIGITAL')) {
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
          } else {
          }
        }
      } else {
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
    const fileName = `${baseName}_${cursante.curp}.pdf`;
    
    zip.file(fileName, pdfBytes);
  }
  
  const zipContent = await zip.generateAsync({ type: "blob" });
  saveAs(zipContent, zipFileName);
}
