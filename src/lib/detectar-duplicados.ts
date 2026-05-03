import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from './firebase';

/**
 * Script de diagnóstico simple para detectar inscripciones duplicadas
 * USO: Ejecutar desde la consola del navegador o agregar botón en Admin
 */
export async function detectarDuplicados(cursoId: string) {
  console.log('🔍 Detectando inscripciones duplicadas...');
  console.log(`📚 Curso ID: ${cursoId}\n`);

  // 1. Obtener todas las inscripciones del curso
  const inscripcionesSnap = await getDocs(
    query(collection(db, 'inscripciones'), where('cursoId', '==', cursoId))
  );

  const inscripciones = inscripcionesSnap.docs.map(doc => ({
    id: doc.id,
    estudianteId: doc.data().estudianteId,
    cursoId: doc.data().cursoId,
    fechaInscripcion: doc.data().fechaInscripcion
  }));

  console.log(`📝 Total inscripciones: ${inscripciones.length}`);

  // 2. Agrupar por estudianteId
  const estudiantesMap = new Map<string, any[]>();
  
  for (const inscripcion of inscripciones) {
    const estudianteId = inscripcion.estudianteId;
    
    if (!estudiantesMap.has(estudianteId)) {
      estudiantesMap.set(estudianteId, []);
    }
    
    estudiantesMap.get(estudianteId)!.push(inscripcion);
  }

  console.log(`👥 Estudiantes únicos: ${estudiantesMap.size}`);

  // 3. Detectar duplicados
  const duplicados: any[] = [];
  let totalInscripcionesDuplicadas = 0;

  for (const [estudianteId, inscripcionesEstudiante] of estudiantesMap.entries()) {
    if (inscripcionesEstudiante.length > 1) {
      duplicados.push({
        estudianteId,
        cantidadInscripciones: inscripcionesEstudiante.length,
        inscripciones: inscripcionesEstudiante
      });
      
      totalInscripcionesDuplicadas += (inscripcionesEstudiante.length - 1);
    }
  }

  // 4. Mostrar resultados
  console.log('\n═══════════════════════════════════════');
  console.log('📊 RESULTADOS:');
  console.log('═══════════════════════════════════════');
  console.log(`Total inscripciones: ${inscripciones.length}`);
  console.log(`Estudiantes únicos: ${estudiantesMap.size}`);
  console.log(`Estudiantes con duplicados: ${duplicados.length}`);
  console.log(`Inscripciones duplicadas (sobrantes): ${totalInscripcionesDuplicadas}`);
  console.log('═══════════════════════════════════════\n');

  if (duplicados.length > 0) {
    console.log('🚨 ESTUDIANTES CON INSCRIPCIONES DUPLICADAS:\n');
    
    duplicados.forEach((dup, idx) => {
      console.log(`${idx + 1}. Estudiante ID: ${dup.estudianteId}`);
      console.log(`   Inscripciones: ${dup.cantidadInscripciones}`);
      console.log(`   IDs de inscripciones:`);
      
      dup.inscripciones.forEach((insc: any, i: number) => {
        const fecha = insc.fechaInscripcion?.toDate?.() || 'Sin fecha';
        console.log(`      ${i + 1}. ${insc.id} (${fecha})`);
      });
      
      console.log('');
    });
  } else {
    console.log('✅ No se encontraron inscripciones duplicadas');
  }

  return {
    totalInscripciones: inscripciones.length,
    estudiantesUnicos: estudiantesMap.size,
    estudiantesConDuplicados: duplicados.length,
    inscripcionesDuplicadas: totalInscripcionesDuplicadas,
    duplicados
  };
}
