import { collection, getDocs, doc, setDoc } from 'firebase/firestore';
import { db } from './firebase';
import { toast } from 'react-toastify';

export async function migrarAsistencias() {
  try {
    console.log('🔄 Migrando asistencias...');
    toast.info('Migrando asistencias...');

    // 1. Obtener todas las inscripciones (tienen legacyId)
    const inscripcionesSnap = await getDocs(collection(db, 'inscripciones'));
    const inscripciones = inscripcionesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as any[];
    
    console.log(`📝 Inscripciones encontradas: ${inscripciones.length}`);

    // 2. Obtener todas las asistencias legacy
    const asistenciasSnap = await getDocs(collection(db, 'asistencias'));
    const asistenciasLegacy = asistenciasSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as any[];
    
    console.log(`📚 Asistencias legacy: ${asistenciasLegacy.length}`);

    let migradas = 0;
    let noEncontradas = 0;

    // 3. Para cada asistencia legacy, encontrar el nuevo estudianteId
    for (const asist of asistenciasLegacy) {
      // Buscar inscripción con este legacyId
      const inscripcion = inscripciones.find(i => i.legacyId === asist.estudianteId);
      
      if (inscripcion) {
        const nuevoId = `${inscripcion.estudianteId}_${asist.cursoId}`;
        
        // Crear asistencia con nuevo ID
        await setDoc(doc(db, 'asistencias', nuevoId), {
          estudianteId: inscripcion.estudianteId,
          cursoId: asist.cursoId,
          clase1: asist.clase1 || false,
          clase2: asist.clase2 || false,
          clase3: asist.clase3 || false,
          clase4: asist.clase4 || false,
          notaFinal: asist.notaFinal || null,
          observaciones: asist.observaciones || ''
        });
        
        migradas++;
        console.log(`✅ Migrada asistencia: ${asist.id} → ${nuevoId}`);
      } else {
        noEncontradas++;
        console.log(`⚠️ No se encontró inscripción para legacyId: ${asist.estudianteId}`);
      }
    }

    console.log(`🎉 Migración completada: ${migradas} asistencias migradas, ${noEncontradas} no encontradas`);
    toast.success(`${migradas} asistencias migradas`);
    
    return { migradas, noEncontradas, total: asistenciasLegacy.length };
  } catch (error: any) {
    console.error('Error:', error);
    toast.error('Error al migrar asistencias');
    throw error;
  }
}
