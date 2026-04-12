// Script de migración: estudiantes duplicados → modelo normalizado
// Ejecutar: node migrate-data.js

import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, addDoc, Timestamp } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyDQIAtuQcGAil0pvJUFla30rOkpgOux0fM",
  authDomain: "third-wave-retiro.firebaseapp.com",
  projectId: "third-wave-retiro",
  storageBucket: "third-wave-retiro.firebasestorage.app",
  messagingSenderId: "357130595524",
  appId: "1:357130595524:web:72b991baded99d09dead91"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function migrate() {
  console.log('🔄 Iniciando migración...');

  // 1. Leer estudiantes legacy
  const estudiantesSnap = await getDocs(collection(db, 'estudiantes'));
  const estudiantesLegacy = estudiantesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  
  console.log(`📚 Encontrados ${estudiantesLegacy.length} registros legacy`);

  // 2. Agrupar por estudiante único (nombre + correo)
  const estudiantesUnicos = new Map();
  const inscripciones = [];

  for (const est of estudiantesLegacy) {
    const key = `${est.nombreApellido}_${est.correo}`.toLowerCase();
    
    if (!estudiantesUnicos.has(key)) {
      // Primer registro de este estudiante
      estudiantesUnicos.set(key, {
        nombreApellido: est.nombreApellido,
        telefono: est.telefono,
        correo: est.correo,
        fechaNacimiento: est.fechaNacimiento || '',
        tiempoMinisterio: est.tiempoMinisterio || '',
        fechaRegistro: est.fechaRegistro || Timestamp.now()
      });
    }

    // Crear inscripción
    inscripciones.push({
      estudianteKey: key,
      cursoId: est.cursoId,
      fechaInscripcion: est.fechaRegistro || Timestamp.now(),
      legacyId: est.id
    });
  }

  console.log(`👤 Estudiantes únicos: ${estudiantesUnicos.size}`);
  console.log(`📝 Inscripciones: ${inscripciones.length}`);

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
    console.log(`✅ Creada inscripción: ${estudianteId} → ${insc.cursoId}`);
  }

  console.log('🎉 Migración completada');
  console.log(`📊 Resumen:`);
  console.log(`   - Estudiantes legacy: ${estudiantesLegacy.length}`);
  console.log(`   - Estudiantes únicos: ${estudiantesUnicos.size}`);
  console.log(`   - Inscripciones: ${inscripciones.length}`);
  console.log(`   - Duplicados eliminados: ${estudiantesLegacy.length - estudiantesUnicos.size}`);
}

migrate().catch(console.error);
