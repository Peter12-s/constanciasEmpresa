import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { Container, Title, Text, Card, Loader, Center } from '@mantine/core';
import { FaCheck } from 'react-icons/fa';
import { BasicPetition } from '../core/petition';

export default function ValidarPage() {
  const { id, curp } = useParams();
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cursante, setCursante] = useState<any | null>(null);
  const [certificate, setCertificate] = useState<any | null>(null);
  const [courseIdParam, setCourseIdParam] = useState<string | null>(null);

  useEffect(() => {
    if (!id || !curp) return;
    let mounted = true;
    setLoading(true);

    (async () => {
      try {
        const maxAttempts = 3;
        const delay = (ms: number) => new Promise((res) => setTimeout(res, ms));

        let item: any | null = null;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
          if (!mounted) return;
          try {
            // Intentar endpoint específico de validación
            const res = await BasicPetition<any>({ endpoint: `/certificate/validate/${id}`, method: 'GET', showNotifications: false });
      item = res ?? null;
          } catch (e) {
            item = null;
          }

          if (!item) {
            try {
              const list = await BasicPetition<any[]>({ endpoint: '/certificate', method: 'GET', params: { id }, showNotifications: false });
              if (Array.isArray(list) && list.length > 0) item = list[0];
            } catch (e) {
              item = null;
            }
          }

          if (item) break;

          if (attempt < maxAttempts) {
            await delay(500 * attempt);
          }
        }

        if (!item) {
          if (!mounted) return;
          setError('Constancia no encontrada (revisa consola Network y server responses)');
          setLoading(false);
          return;
        }

        if (!mounted) return;
        setCertificate(item);

        // Leer query param course_id usando useSearchParams (funciona con HashRouter)
        const courseIdFromUrl = searchParams.get('course_id');
        console.log('🔍 course_id desde URL:', courseIdFromUrl);
        if (courseIdFromUrl) {
          setCourseIdParam(courseIdFromUrl);
          console.log('✅ courseIdParam establecido:', courseIdFromUrl);
        } else {
          console.log('⚠️ No se encontró course_id en URL params');
        }

        const cursantes = Array.isArray(item?.xlsx_object?.cursantes) ? item.xlsx_object.cursantes : [];
        const found = cursantes.find((c: any) => String((c.curp ?? c.CURP ?? '').toUpperCase()) === String(curp).toUpperCase());
        if (!found) {
          setError('No se encontró el cursante en la constancia (verifica CURP y contenido de XLSX en el servidor)');
          setLoading(false);
          return;
        }

  setCursante(found);
        setLoading(false);
      } catch (err: any) {
        if (!mounted) return;
        setError(err?.message ?? 'Error al obtener la constancia');
        setLoading(false);
      }
    })();

    return () => { mounted = false; };
  }, [id, curp]);

  if (loading)
    return (
      <Container py="xl">
        <Center style={{ minHeight: 160 }}>
          <Loader size="lg" />
        </Center>
      </Container>
    );
  if (error) return <Container py="xl"><Text color="red">{error}</Text></Container>;

  // Mostrar la tarjeta de validación similar a la imagen enviada
  const nombre = (cursante?.nombre ?? cursante?.nombre_completo ?? '').toString();
  
  // Si el QR incluye course_id, intentar mostrar datos específicos de la asociación
  let curso = (certificate?.course_name ?? certificate?.course?.name ?? '') as string;
  let duracion = certificate?.course_duration ?? certificate?.course?.duration ?? '';
  let fecha = certificate?.course_period ?? `${cursante?.fecha_inicio ?? ''} / ${cursante?.fecha_fin ?? ''}`;
  let instructor = cursante?.capacitador ?? certificate?.trainer_fullname ?? '';
  
  // Buscar el curso específico en certificate_courses usando el course_id del QR
  let matched: any = null;
  try {
    console.log('🔍 Buscando curso específico. courseIdParam:', courseIdParam);
    console.log('📋 certificate_courses disponibles:', certificate?.certificate_courses);
    
    if (courseIdParam && Array.isArray(certificate?.certificate_courses)) {
      console.log('✅ Entrando a búsqueda, total cursos:', certificate.certificate_courses.length);
      
      // Buscar por course._id (MongoDB ID) o course_id (ambos deberían funcionar)
      matched = (certificate.certificate_courses as any[]).find((it: any) => {
        const courseMongoDB = it.course?._id ?? '';
        const courseIdField = it.course_id ?? '';
        const courseIdAlt = it.course?.id ?? '';
        
        console.log('🔎 Comparando:', { 
          courseIdParam, 
          courseMongoDB, 
          courseIdField, 
          courseIdAlt,
          courseName: it.course?.name ?? it.course_name 
        });
        
        return String(courseMongoDB) === String(courseIdParam) || 
               String(courseIdField) === String(courseIdParam) ||
               String(courseIdAlt) === String(courseIdParam);
      });
      
      if (matched) {
        console.log('✅ Curso específico encontrado:', matched);
        curso = matched.course?.name ?? matched.course_name ?? matched.name ?? curso;
        duracion = matched.course?.duration ?? matched.duration ?? duracion;
        
        // Obtener fechas del matched (start/end de certificate_courses)
        const s = matched.start ?? matched.fecha_inicio ?? matched.start_date ?? undefined;
        const e = matched.end ?? matched.fecha_fin ?? matched.end_date ?? undefined;
        const sN = s ? String(s).slice(0, 10) : undefined;
        const eN = e ? String(e).slice(0, 10) : undefined;
        fecha = (sN || eN) ? `${sN || ''}${sN && eN ? ' / ' : ''}${eN || ''}` : fecha;
        
        instructor = matched.trainer_fullname ?? matched.capacitador ?? certificate?.trainer_fullname ?? instructor;
        
        console.log('📝 Datos finales del curso:', { curso, duracion, fecha, instructor });
      } else {
        console.warn('❌ No se encontró curso específico con course_id:', courseIdParam);
      }
    } else {
      console.log('⚠️ No se puede buscar:', { 
        hasCourseIdParam: !!courseIdParam, 
        isCertificateCoursesArray: Array.isArray(certificate?.certificate_courses) 
      });
    }
  } catch (e) {
    console.error('❌ Error buscando curso específico:', e);
  }
  

  // Valores por defecto si no se encontró asociación específica
  curso = curso || 'No especificado';
  duracion = duracion ? `${duracion} horas` : 'No especificado';
  fecha = fecha || 'No especificado';
  instructor = instructor || 'No especificado';
  const folio = certificate?._id ?? certificate?.id ?? '';
  const stps = certificate?.stps ?? certificate?.trainer_stps ?? '';

  return (
    <Container size="md" style={{ paddingTop: 48 }}>
      <div style={{ minHeight: 360 }}>

        <Card shadow="lg" padding="xl" radius="md" style={{ maxWidth: 680, margin: '0 auto', background: 'white', position: 'relative' }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <div style={{ width: 64, height: 64, borderRadius: 12, background: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 6px 20px rgba(0,0,0,0.06)', marginBottom: 8 }}>
              <FaCheck size={36} color="#444" />
            </div>

            <Title order={3} style={{ color: '#0e2b56' }}>Constancia válida</Title>
            <Text size="sm" color="dimmed" style={{ textAlign: 'center', maxWidth: 520, marginTop: 6 }}>Esta constancia es auténtica y coincide con los registros oficiales.</Text>
          </div>

          <Card withBorder padding="md" style={{ marginTop: 20, background: '#fafafa' }}>
            <Text><strong>Nombre:</strong> {nombre}</Text>
            <Text><strong>Curso:</strong> {curso}</Text>
            <Text><strong>Duración:</strong> {String(duracion)}</Text>
            <Text><strong>Fecha:</strong> {fecha}</Text>
            <Text><strong>Capacitador:</strong> {instructor}</Text>
            <Text><strong>STPS del capacitador:</strong> {stps}</Text>      
          </Card>
        </Card>
      </div>
    </Container>
  );
}
