import { collection, getDocs, addDoc, Timestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { toast } from 'react-toastify';

export async function migrarDatos() {
  try {
    console.log('🔄 Iniciando migración...');
    toast.info('Iniciando migración de datos...');

    // 1. Leer estudiantes legacy
    const estudiantesSnap = await getDocs(collection(db, 'estudiantes'));
    const estudiantesLegacy = estudiantesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as any[];
    
    console.log(`📚 Encontrados ${estudiantesLegacy.length} registros legacy`);

    // 2. Agrupar por estudiante único (nombre + correo)
    const estudiantesUnicos = new Map();
    const inscripciones = [];

    for (const est of estudiantesLegacy) {
      const key = `${est.nombreApellido}_${est.correo}`.toLowerCase();
      
      if (!estudiantesUnicos.has(key)) {
        estudiantesUnicos.set(key, {
          nombreApellido: est.nombreApellido,
          telefono: est.telefono,
          correo: est.correo,
          fechaNacimiento: est.fechaNacimiento || '',
          tiempoMinisterio: est.tiempoMinisterio || '',
          fechaRegistro: est.fechaRegistro || Timestamp.now()
        });
      }

      inscripciones.push({
        estudianteKey: key,
        cursoId: est.cursoId,
        fechaInscripcion: est.fechaRegistro || Timestamp.now(),
        legacyId: est.id
      });
    }

    console.log(`👤 Estudiantes únicos: ${estudiantesUnicos.size}`);
    console.log(`📝 Inscripciones: ${inscripciones.length}`);
    toast.info(`Encontrados ${estudiantesUnicos.size} estudiantes únicos de ${estudiantesLegacy.length} registros`);

    // 3. Crear estudiantes_v2
    const estudiantesMap = new Map();
    for (const [key, estudiante] of estudiantesUnicos) {
      const docRef = await addDoc(collection(db, 'estudiantes_v2'), estudiante);
      estudiantesMap.set(key, docRef.id);
      console.log(`✅ Creado estudiante: ${estudiante.nombreApellido}`);
    }

    // 4. Crear inscripciones
    for (const insc of inscripciones) {
      const estudianteId = estudiantesMap.get(insc.estudianteKey);
      await addDoc(collection(db, 'inscripciones'), {
        estudianteId,
        cursoId: insc.cursoId,
        fechaInscripcion: insc.fechaInscripcion,
        legacyId: insc.legacyId
      });
    }

    console.log('🎉 Migración completada');
    toast.success(`Migración completada: ${estudiantesUnicos.size} estudiantes, ${inscripciones.length} inscripciones`);
    
    return {
      estudiantesLegacy: estudiantesLegacy.length,
      estudiantesUnicos: estudiantesUnicos.size,
      inscripciones: inscripciones.length,
      duplicadosEliminados: estudiantesLegacy.length - estudiantesUnicos.size
    };
  } catch (error: any) {
    console.error('Error en migración:', error);
    toast.error('Error en migración: ' + error.message);
    throw error;
  }
}
