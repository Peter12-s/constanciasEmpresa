import { BasicPetition } from "../core/petition";

type Cursante = { curp: string };

type CertificateCourse = {
  _id: string;
  certificate_id: string;
  course_id: string;
  start: string;
  end: string; 
};

type Certificate = {
  _id: string;
  xlsx_object?: {
    cursantes?: Cursante[];
  };
  certificate_courses?: CertificateCourse[];
};

type CertificateCourseBetween = {
  _id: string;
  course_id: string;
  start: string;
  end: string; 
  certificate?: {
    _id: string;
    xlsx_object?: {
      cursantes?: Cursante[];
    };
  };
};

type ConflictResult = Cursante & {
  conflicts: Array<{
    certificate_course_id: string; 
    certificate_id?: string;
    course_id?: string;
    start: string;
    end: string;
  }>;
};

function daysOverlap(aStart: string, aEnd: string, bStart: string, bEnd: string): boolean {
  const as = aStart <= aEnd ? aStart : aEnd;
  const ae = aStart <= aEnd ? aEnd : aStart;
  const bs = bStart <= bEnd ? bStart : bEnd;
  const be = bStart <= bEnd ? bEnd : bStart;
  return as <= be && bs <= ae;
}

export async function validateCourses(
  certificate: Certificate,
  start_between: string,
  end_between: string
): Promise<ConflictResult[]> {
  const newCursantes = certificate?.xlsx_object?.cursantes;
  const newRanges = certificate?.certificate_courses;

  if (!Array.isArray(newCursantes) || newCursantes.length === 0) return [];
  if (!Array.isArray(newRanges) || newRanges.length === 0) return [];

  const certificatesBetween: CertificateCourseBetween[] = await BasicPetition({
    endpoint: "/certificate-course",
    method: "GET",
    params: { start_between, end_between },
  });

  if (!Array.isArray(certificatesBetween) || certificatesBetween.length === 0) return [];

  const coursesByCurp = new Map<
    string,
    Array<{
      certificate_course_id: string;
      certificate_id?: string;
      course_id?: string;
      start: string;
      end: string;
    }>
  >();

  certificatesBetween.forEach((cc) => {
    const existingCursantes = cc?.certificate?.xlsx_object?.cursantes;

    if (!Array.isArray(existingCursantes) || existingCursantes.length === 0) return;

    existingCursantes.forEach((c) => {
      const curp = c?.curp;
      if (!curp) return;

      const list = coursesByCurp.get(curp) || [];
      list.push({
        certificate_course_id: cc._id,
        certificate_id: cc?.certificate?._id,
        course_id: cc?.course_id,
        start: cc?.start,
        end: cc?.end,
      });
      coursesByCurp.set(curp, list);
    });
  });

  const conflicts: ConflictResult[] = [];
  const seen = new Set<string>();

  newCursantes.forEach((cursante) => {
    const curp = cursante?.curp?.trim();
    if (!curp || seen.has(curp)) return;

    const existing = coursesByCurp.get(curp) || [];
    if (existing.length === 0) return;

    const overlapped: ConflictResult["conflicts"] = [];

    existing.forEach((ex) => {
      let hit = false;

      newRanges.forEach((nr) => {
        if (hit) return;
        if (!nr?.start || !nr?.end) return;

        if (daysOverlap(nr.start, nr.end, ex.start, ex.end)) {
          hit = true;
        }
      });

      if (hit) {
        overlapped.push(ex);
      }

    });
    
    if (overlapped.length > 0) {
      conflicts.push({ ...cursante, conflicts: overlapped });
      seen.add(curp);
    }
  });

  return conflicts;
}
