import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from './firebase';

interface ReporteDiagnostico {
  totalInscripciones: number;
  estudiantesUnicos: number;
  inscripcionesValidas: number;
  inscripcionesHuerfanas: number;
  inscripcionesDuplicadas: number;
  estudiantesHuerfanos: Array<{
    inscripcionId: string;
    estudianteId: string;
    cursoId: string;
    existeEnLegacy: boolean;
  }>;
  estudiantesDuplicados: Array<{
    estudianteId: string;
    nombreApellido: string;
    cantidadInscripciones: number;
    inscripcionesIds: string[];
  }>;
}

export async function diagnosticarInscripciones(cursoId: string): Promise<ReporteDiagnostico> {
  console.log('🔍 Iniciando diagnóstico de inscripciones...');
  console.log(`📚 Curso ID: ${cursoId}`);

  // 1. Obtener todas las inscripciones del curso
  const inscripcionesSnap = await getDocs(
    query(collection(db, 'inscripciones'), where('cursoId', '==', cursoId))
  );
  const inscripciones = inscripcionesSnap.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  })) as any[];

  console.log(`📝 Total inscripciones: ${inscripciones.length}`);

  // 2. Obtener todos los estudiantes de estudiantes_v2
  const estudiantesV2Snap = await getDocs(collection(db, 'estudiantes_v2'));
  const estudiantesV2Map = new Map();
  estudiantesV2Snap.docs.forEach(doc => {
    estudiantesV2Map.set(doc.id, { id: doc.id, ...doc.data() });
  });

  console.log(`👥 Total estudiantes en estudiantes_v2: ${estudiantesV2Map.size}`);

  // 3. Obtener estudiantes legacy (para verificar si existen ahí)
  const estudiantesLegacySnap = await getDocs(collection(db, 'estudiantes'));
  const estudiantesLegacyMap = new Map();
  estudiantesLegacySnap.docs.forEach(doc => {
    estudiantesLegacyMap.set(doc.id, { id: doc.id, ...doc.data() });
  });

  console.log(`👥 Total estudiantes en estudiantes (legacy): ${estudiantesLegacyMap.size}`);

  // 4. Analizar cada inscripción
  const estudiantesHuerfanos: any[] = [];
  const estudiantesContador = new Map<string, any[]>();
  let inscripcionesValidas = 0;

  for (const inscripcion of inscripciones) {
    const estudianteId = inscripcion.estudianteId;

    // Verificar si el estudiante existe en estudiantes_v2
    if (estudiantesV2Map.has(estudianteId)) {
      inscripcionesValidas++;
      
      // Contar inscripciones por estudiante (para detectar duplicados)
      if (!estudiantesContador.has(estudianteId)) {
        estudiantesContador.set(estudianteId, []);
      }
      estudiantesContador.get(estudianteId)!.push(inscripcion.id);
    } else {
      // Inscripción huérfana
      const existeEnLegacy = estudiantesLegacyMap.has(estudianteId);
      
      estudiantesHuerfanos.push({
        inscripcionId: inscripcion.id,
        estudianteId: estudianteId,
        cursoId: inscripcion.cursoId,
        existeEnLegacy,
        legacyId: inscripcion.legacyId || 'N/A'
      });

      console.warn(`⚠️ Inscripción huérfana: ${inscripcion.id}`);
      console.warn(`   - estudianteId: ${estudianteId}`);
      console.warn(`   - Existe en legacy: ${existeEnLegacy ? 'SÍ' : 'NO'}`);
      console.warn(`   - legacyId: ${inscripcion.legacyId || 'N/A'}`);
    }
  }

  // 5. Detectar duplicados
  const estudiantesDuplicados: any[] = [];
  for (const [estudianteId, inscripcionesIds] of estudiantesContador.entries()) {
    if (inscripcionesIds.length > 1) {
      const estudiante = estudiantesV2Map.get(estudianteId);
      estudiantesDuplicados.push({
        estudianteId,
        nombreApellido: estudiante?.nombreApellido || 'Desconocido',
        cantidadInscripciones: inscripcionesIds.length,
        inscripcionesIds
      });

      console.warn(`🔄 Estudiante duplicado: ${estudiante?.nombreApellido}`);
      console.warn(`   - ID: ${estudianteId}`);
      console.warn(`   - Inscripciones: ${inscripcionesIds.length}`);
    }
  }

  // 6. Generar reporte
  const reporte: ReporteDiagnostico = {
    totalInscripciones: inscripciones.length,
    estudiantesUnicos: estudiantesContador.size,
    inscripcionesValidas,
    inscripcionesHuerfanas: estudiantesHuerfanos.length,
    inscripcionesDuplicadas: estudiantesDuplicados.reduce((sum, e) => sum + (e.cantidadInscripciones - 1), 0),
    estudiantesHuerfanos,
    estudiantesDuplicados
  };

  // 7. Mostrar resumen
  console.log('\n📊 RESUMEN DEL DIAGNÓSTICO:');
  console.log('═══════════════════════════════════════');
  console.log(`Total inscripciones: ${reporte.totalInscripciones}`);
  console.log(`Estudiantes únicos: ${reporte.estudiantesUnicos}`);
  console.log(`Inscripciones válidas: ${reporte.inscripcionesValidas}`);
  console.log(`Inscripciones huérfanas: ${reporte.inscripcionesHuerfanas}`);
  console.log(`Inscripciones duplicadas: ${reporte.inscripcionesDuplicadas}`);
  console.log('═══════════════════════════════════════\n');

  if (reporte.inscripcionesHuerfanas > 0) {
    console.log('🚨 INSCRIPCIONES HUÉRFANAS DETECTADAS:');
    reporte.estudiantesHuerfanos.forEach((h, idx) => {
      console.log(`${idx + 1}. Inscripción: ${h.inscripcionId}`);
      console.log(`   - estudianteId: ${h.estudianteId}`);
      console.log(`   - Existe en legacy: ${h.existeEnLegacy ? 'SÍ' : 'NO'}`);
      console.log(`   - legacyId: ${h.legacyId}`);
    });
    console.log('');
  }

  if (reporte.estudiantesDuplicados.length > 0) {
    console.log('🔄 ESTUDIANTES CON INSCRIPCIONES DUPLICADAS:');
    reporte.estudiantesDuplicados.forEach((d, idx) => {
      console.log(`${idx + 1}. ${d.nombreApellido} (${d.estudianteId})`);
      console.log(`   - Inscripciones: ${d.cantidadInscripciones}`);
      console.log(`   - IDs: ${d.inscripcionesIds.join(', ')}`);
    });
    console.log('');
  }

  return reporte;
}
