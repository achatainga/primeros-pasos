import { collection, getDocs, query, where, deleteDoc, doc } from 'firebase/firestore';
import { db } from './firebase';
import { toast } from 'react-toastify';

/**
 * Script para limpiar inscripciones duplicadas
 * Mantiene la inscripción MÁS ANTIGUA y elimina las demás
 */
export async function limpiarInscripcionesDuplicadas(cursoId: string) {
  console.log('🧹 Iniciando limpieza de inscripciones duplicadas...');
  console.log(`📚 Curso ID: ${cursoId}\n`);

  try {
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

    // 3. Identificar duplicados y marcar para eliminación
    const inscripcionesAEliminar: string[] = [];
    let estudiantesConDuplicados = 0;

    for (const [estudianteId, inscripcionesEstudiante] of estudiantesMap.entries()) {
      if (inscripcionesEstudiante.length > 1) {
        estudiantesConDuplicados++;
        
        // Ordenar por fecha (más antigua primero)
        inscripcionesEstudiante.sort((a, b) => {
          const fechaA = a.fechaInscripcion?.seconds || 0;
          const fechaB = b.fechaInscripcion?.seconds || 0;
          return fechaA - fechaB;
        });

        // Mantener la primera (más antigua), eliminar las demás
        const [mantener, ...eliminar] = inscripcionesEstudiante;
        
        console.log(`🔄 Estudiante ${estudianteId}:`);
        console.log(`   ✅ Mantener: ${mantener.id} (${mantener.fechaInscripcion?.toDate?.() || 'Sin fecha'})`);
        
        eliminar.forEach(insc => {
          console.log(`   ❌ Eliminar: ${insc.id} (${insc.fechaInscripcion?.toDate?.() || 'Sin fecha'})`);
          inscripcionesAEliminar.push(insc.id);
        });
      }
    }

    console.log('\n═══════════════════════════════════════');
    console.log(`Estudiantes con duplicados: ${estudiantesConDuplicados}`);
    console.log(`Inscripciones a eliminar: ${inscripcionesAEliminar.length}`);
    console.log('═══════════════════════════════════════\n');

    if (inscripcionesAEliminar.length === 0) {
      console.log('✅ No hay inscripciones duplicadas para limpiar');
      toast.success('No hay duplicados para limpiar');
      return {
        eliminadas: 0,
        estudiantesAfectados: 0
      };
    }

    // 4. Eliminar inscripciones duplicadas
    console.log('🗑️ Eliminando inscripciones duplicadas...');
    
    for (const inscripcionId of inscripcionesAEliminar) {
      await deleteDoc(doc(db, 'inscripciones', inscripcionId));
      console.log(`   ✅ Eliminada: ${inscripcionId}`);
    }

    console.log('\n🎉 Limpieza completada exitosamente');
    console.log(`   - Inscripciones eliminadas: ${inscripcionesAEliminar.length}`);
    console.log(`   - Estudiantes afectados: ${estudiantesConDuplicados}`);
    
    toast.success(`Limpieza completada: ${inscripcionesAEliminar.length} inscripciones duplicadas eliminadas`);

    return {
      eliminadas: inscripcionesAEliminar.length,
      estudiantesAfectados: estudiantesConDuplicados
    };

  } catch (error) {
    console.error('❌ Error durante la limpieza:', error);
    toast.error('Error al limpiar inscripciones duplicadas');
    throw error;
  }
}
