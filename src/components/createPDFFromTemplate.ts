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
const COORDS = {
  // DATOS DEL TRABAJADOR
  nombre: { x: 63, y: 643, size: 9 },
  curp: { x: 50, y: 655, size: 9, spacing: 14 }, // Para letras individuales
  ocupacion: { x: 350, y: 655, size: 8 },
  puesto: { x: 50, y: 630, size: 9 },
  
  // DATOS DE LA EMPRESA
  empresa: { x: 50, y: 580, size: 9 },
  rfc: { x: 50, y: 555, size: 10, spacing: 18 }, // Para letras individuales
  
  // DATOS DEL PROGRAMA
  curso: { x: 50, y: 505, size: 9 },
  duracion: { x: 50, y: 475, size: 10 },
  fechaInicio: { x: 150, y: 475, size: 9 },
  fechaFin: { x: 350, y: 475, size: 9 },
  area: { x: 50, y: 450, size: 9 },
  capacitador: { x: 50, y: 425, size: 8 },
  regStps: { x: 400, y: 425, size: 8 },
  
  // FIRMAS
  repLegal: { x: 200, y: 150, size: 7 },
  repTrab: { x: 400, y: 150, size: 7 },
  
  // QR
  qr: { x: 500, y: 720, width: 80, height: 80 }
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
  console.log('🔍 Intentando cargar PDF desde:', templateUrl);
  
  const response = await fetch(templateUrl);
  if (!response.ok) {
    throw new Error(`No se pudo cargar el template PDF. Status: ${response.status} - ${response.statusText}`);
  }
  
  const existingPdfBytes = await response.arrayBuffer();
  console.log('✅ Template PDF cargado correctamente');
  
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
  
  // DATOS DEL TRABAJADOR
  // Nombre
  if (cursante.nombre) {
    firstPage.drawText(safeText(cursante.nombre), {
      x: COORDS.nombre.x,
      y: height - COORDS.nombre.y,
      size: COORDS.nombre.size,
      font: fontBold,
      color: rgb(0, 0, 0)
    });
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
    firstPage.drawText(safeText(cursante.ocupacion_especifica), {
      x: COORDS.ocupacion.x,
      y: height - COORDS.ocupacion.y,
      size: COORDS.ocupacion.size,
      font: fontBold,
      color: rgb(0, 0, 0)
    });
  }
  
  // Puesto
  if (cursante.puesto_trabajo) {
    firstPage.drawText(safeText(cursante.puesto_trabajo), {
      x: COORDS.puesto.x,
      y: height - COORDS.puesto.y,
      size: COORDS.puesto.size,
      font: fontBold,
      color: rgb(0, 0, 0)
    });
  }
  
  // DATOS DE LA EMPRESA
  // Razón social
  if (certData.company_name) {
    firstPage.drawText(safeText(certData.company_name), {
      x: COORDS.empresa.x,
      y: height - COORDS.empresa.y,
      size: COORDS.empresa.size,
      font: fontBold,
      color: rgb(0, 0, 0)
    });
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
    firstPage.drawText(safeText(certData.course_name), {
      x: COORDS.curso.x,
      y: height - COORDS.curso.y,
      size: COORDS.curso.size,
      font: fontBold,
      color: rgb(0, 0, 0)
    });
  }
  
  // Duración
  if (certData.course_duration) {
    firstPage.drawText(certData.course_duration.toString(), {
      x: COORDS.duracion.x,
      y: height - COORDS.duracion.y,
      size: COORDS.duracion.size,
      font: fontBold,
      color: rgb(0, 0, 0)
    });
  }
  
  // Fechas
  const [inicioStr, finStr] = (certData.course_period || '').split(/\s*\/\s*/);
  const fInicio = splitDateParts(inicioStr);
  const fFin = splitDateParts(finStr);
  
  const fechaInicioText = `${fInicio.d.join('')}/${fInicio.m.join('')}/${fInicio.a.join('')}`;
  const fechaFinText = `${fFin.d.join('')}/${fFin.m.join('')}/${fFin.a.join('')}`;
  
  if (fechaInicioText && fechaInicioText !== '//') {
    firstPage.drawText(fechaInicioText, {
      x: COORDS.fechaInicio.x,
      y: height - COORDS.fechaInicio.y,
      size: COORDS.fechaInicio.size,
      font: fontBold,
      color: rgb(0, 0, 0)
    });
  }
  
  if (fechaFinText && fechaFinText !== '//') {
    firstPage.drawText(fechaFinText, {
      x: COORDS.fechaFin.x,
      y: height - COORDS.fechaFin.y,
      size: COORDS.fechaFin.size,
      font: fontBold,
      color: rgb(0, 0, 0)
    });
  }
  
  // Área temática
  firstPage.drawText(safeText(certData.area_tematica || '6000 Seguridad'), {
    x: COORDS.area.x,
    y: height - COORDS.area.y,
    size: COORDS.area.size,
    font: fontBold,
    color: rgb(0, 0, 0)
  });
  
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
    firstPage.drawText(safeText(certData.legal_representative), {
      x: COORDS.repLegal.x,
      y: height - COORDS.repLegal.y,
      size: COORDS.repLegal.size,
      font: font,
      color: rgb(0, 0, 0)
    });
  }
  
  if (certData.workers_representative) {
    firstPage.drawText(safeText(certData.workers_representative), {
      x: COORDS.repTrab.x,
      y: height - COORDS.repTrab.y,
      size: COORDS.repTrab.size,
      font: font,
      color: rgb(0, 0, 0)
    });
  }
  
  firstPage.drawText(certData.workers_representative.toUpperCase(), {
    x: COORDS.repTrab.x,
    y: height - COORDS.repTrab.y,
    size: COORDS.repTrab.size,
    font: font,
    color: rgb(0, 0, 0)
  });
  
  // QR Code
  const qrImageBytes = await fetch(qrDataUrl).then(res => res.arrayBuffer());
  const qrImage = await pdfDoc.embedPng(qrImageBytes);
  
  firstPage.drawImage(qrImage, {
    x: COORDS.qr.x,
    y: height - COORDS.qr.y - COORDS.qr.height,
    width: COORDS.qr.width,
    height: COORDS.qr.height
  });
  
  // Firma digital si existe
  if (signatureDataUrl) {
    try {
      const signImageBytes = await fetch(signatureDataUrl).then(res => res.arrayBuffer());
      const signImage = await pdfDoc.embedPng(signImageBytes);
      
      firstPage.drawImage(signImage, {
        x: 50,
        y: height - 200,
        width: 150,
        height: 60
      });
    } catch (e) {
      console.warn('No se pudo insertar la firma:', e);
    }
  }
  
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
    const qrUrl = `${baseUrl}/#/validar/${perCert.id}/${cursante.curp}`;
    const qrDataUrl = await generateQrDataUrl(qrUrl);
    
    // Obtener firma digital si existe
    let signatureDataUrl: string | undefined = undefined;
    try {
      const signId = (perCert as any).sign ?? undefined;
      const cursanteTipo = (cursante as any).tipo_firma as string | undefined;
      const certTipo = (perCert as any).tipo_firma as string | undefined;
      
      if (signId && (cursanteTipo === 'DIGITAL' || certTipo === 'DIGITAL')) {
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
          }
          signatureCache.set(signId, signatureDataUrl);
        }
      }
    } catch (e) {
      console.warn('Error cargando firma:', e);
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
