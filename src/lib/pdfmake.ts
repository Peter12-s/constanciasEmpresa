import pdfMake from "pdfmake/build/pdfmake";
// Intentamos varias formas de importar las fuentes empacadas
import * as pdfFontsNamespace from "pdfmake/build/vfs_fonts";

const pdfFonts: any = (pdfFontsNamespace as any) || {};

// Resolver posibles formas del export del VFS
const resolvedVfs = pdfFonts?.default?.pdfMake?.vfs
  || pdfFonts?.pdfMake?.vfs
  || pdfFonts?.vfs
  || (pdfFonts?.default && typeof pdfFonts.default === 'object' && 'vfs' in pdfFonts.default && pdfFonts.default.vfs)
  || (pdfFonts?.default && Object.keys(pdfFonts.default).length > 0 ? pdfFonts.default : undefined)
  || undefined;

if (resolvedVfs && typeof resolvedVfs === 'object') {
  (pdfMake as any).vfs = resolvedVfs;
}

export function ensureVfs() {
  if (!(pdfMake as any).vfs || Object.keys((pdfMake as any).vfs).length === 0) {
    if (resolvedVfs && typeof resolvedVfs === 'object') {
      (pdfMake as any).vfs = resolvedVfs;
    }
  }
  return pdfMake as any;
}

export default pdfMake;
