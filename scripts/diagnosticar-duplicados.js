// Script Node.js para diagnosticar y limpiar inscripciones duplicadas
// USO: node diagnosticar-duplicados.js

import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, query, where, deleteDoc, doc } from 'firebase/firestore';
import * as readline from 'readline';

// Configuración de Firebase (desde .env)
const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY || 'AIzaSyCK7eaCn0QIEXluTT17WRXMUq8mnVi_otw',
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN || 'primeros-pasos-av.firebaseapp.com',
  projectId: process.env.VITE_FIREBASE_PROJECT_ID || 'primeros-pasos-av',
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET || 'primeros-pasos-av.firebasestorage.app',
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '720729350384',
  appId: process.env.VITE_FIREBASE_APP_ID || '1:720729350384:web:eb20af58c53eb49cee6235'
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Función para preguntar al usuario
function pregunta(texto) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return new Promise(resolve => {
    rl.question(texto, respuesta => {
      rl.close();
      resolve(respuesta);
    });
  });
}

async function diagnosticar(cursoId) {
  console.log('\n🔍 DIAGNÓSTICO DE INSCRIPCIONES DUPLICADAS');
  console.log('═══════════════════════════════════════\n');
  console.log(`📚 Curso ID: ${cursoId}\n`);

  // 1. Obtener inscripciones
  const inscripcionesSnap = await getDocs(
    query(collection(db, 'inscripciones'), where('cursoId', '==', cursoId))
  );

  const inscripciones = inscripcionesSnap.docs.map(doc => ({
    id: doc.id,
    estudianteId: doc.data().estudianteId,
    fechaInscripcion: doc.data().fechaInscripcion
  }));

  console.log(`📝 Total inscripciones: ${inscripciones.length}`);

  // 2. Agrupar por estudiante
  const estudiantesMap = new Map();
  
  for (const inscripcion of inscripciones) {
    const estudianteId = inscripcion.estudianteId;
    if (!estudiantesMap.has(estudianteId)) {
      estudiantesMap.set(estudianteId, []);
    }
    estudiantesMap.get(estudianteId).push(inscripcion);
  }

  console.log(`👥 Estudiantes únicos: ${estudiantesMap.size}`);

  // 3. Detectar duplicados
  const duplicados = [];
  let totalDuplicadas = 0;

  for (const [estudianteId, inscripcionesEst] of estudiantesMap.entries()) {
    if (inscripcionesEst.length > 1) {
      duplicados.push({
        estudianteId,
        cantidad: inscripcionesEst.length,
        inscripciones: inscripcionesEst
      });
      totalDuplicadas += (inscripcionesEst.length - 1);
    }
  }

  console.log(`\n═══════════════════════════════════════`);
  console.log(`📊 RESULTADOS:`);
  console.log(`═══════════════════════════════════════`);
  console.log(`Total inscripciones: ${inscripciones.length}`);
  console.log(`Estudiantes únicos: ${estudiantesMap.size}`);
  console.log(`Estudiantes con duplicados: ${duplicados.length}`);
  console.log(`Inscripciones duplicadas (sobrantes): ${totalDuplicadas}`);
  console.log(`═══════════════════════════════════════\n`);

  if (duplicados.length > 0) {
    console.log('🚨 ESTUDIANTES CON INSCRIPCIONES DUPLICADAS:\n');
    
    duplicados.slice(0, 10).forEach((dup, idx) => {
      console.log(`${idx + 1}. Estudiante ID: ${dup.estudianteId}`);
      console.log(`   Inscripciones: ${dup.cantidad}`);
      dup.inscripciones.forEach((insc, i) => {
        const fecha = insc.fechaInscripcion?.toDate?.() || 'Sin fecha';
        console.log(`      ${i + 1}. ${insc.id} (${fecha})`);
      });
      console.log('');
    });

    if (duplicados.length > 10) {
      console.log(`... y ${duplicados.length - 10} estudiantes más con duplicados\n`);
    }
  }

  return { duplicados, totalDuplicadas };
}

async function limpiar(cursoId) {
  console.log('\n🧹 LIMPIEZA DE INSCRIPCIONES DUPLICADAS');
  console.log('═══════════════════════════════════════\n');

  // 1. Obtener inscripciones
  const inscripcionesSnap = await getDocs(
    query(collection(db, 'inscripciones'), where('cursoId', '==', cursoId))
  );

  const inscripciones = inscripcionesSnap.docs.map(doc => ({
    id: doc.id,
    estudianteId: doc.data().estudianteId,
    fechaInscripcion: doc.data().fechaInscripcion
  }));

  // 2. Agrupar y detectar duplicados
  const estudiantesMap = new Map();
  
  for (const inscripcion of inscripciones) {
    const estudianteId = inscripcion.estudianteId;
    if (!estudiantesMap.has(estudianteId)) {
      estudiantesMap.set(estudianteId, []);
    }
    estudiantesMap.get(estudianteId).push(inscripcion);
  }

  // 3. Identificar inscripciones a eliminar
  const aEliminar = [];

  for (const [estudianteId, inscripcionesEst] of estudiantesMap.entries()) {
    if (inscripcionesEst.length > 1) {
      // Ordenar por fecha (más antigua primero)
      inscripcionesEst.sort((a, b) => {
        const fechaA = a.fechaInscripcion?.seconds || 0;
        const fechaB = b.fechaInscripcion?.seconds || 0;
        return fechaA - fechaB;
      });

      // Mantener la primera, eliminar las demás
      const [mantener, ...eliminar] = inscripcionesEst;
      
      console.log(`🔄 Estudiante ${estudianteId}:`);
      console.log(`   ✅ Mantener: ${mantener.id}`);
      
      eliminar.forEach(insc => {
        console.log(`   ❌ Eliminar: ${insc.id}`);
        aEliminar.push(insc.id);
      });
    }
  }

  if (aEliminar.length === 0) {
    console.log('\n✅ No hay inscripciones duplicadas para limpiar');
    return { eliminadas: 0 };
  }

  console.log(`\n🗑️ Se eliminarán ${aEliminar.length} inscripciones duplicadas`);
  
  const confirmar = await pregunta('\n¿Continuar con la limpieza? (si/no): ');
  
  if (confirmar.toLowerCase() !== 'si') {
    console.log('\n❌ Limpieza cancelada');
    return { eliminadas: 0 };
  }

  // 4. Eliminar
  console.log('\n🗑️ Eliminando inscripciones...');
  
  for (const inscripcionId of aEliminar) {
    await deleteDoc(doc(db, 'inscripciones', inscripcionId));
    console.log(`   ✅ Eliminada: ${inscripcionId}`);
  }

  console.log(`\n🎉 Limpieza completada: ${aEliminar.length} inscripciones eliminadas`);
  
  return { eliminadas: aEliminar.length };
}

async function main() {
  console.log('\n🔧 HERRAMIENTA DE DIAGNÓSTICO Y LIMPIEZA');
  console.log('═══════════════════════════════════════\n');

  // Obtener todos los cursos
  const cursosSnap = await getDocs(collection(db, 'cursos'));
  const cursos = cursosSnap.docs.map(doc => ({
    id: doc.id,
    nombre: doc.data().nombre
  }));

  console.log('📚 Cursos disponibles:\n');
  cursos.forEach((curso, idx) => {
    console.log(`${idx + 1}. ${curso.nombre} (${curso.id})`);
  });

  const seleccion = await pregunta('\nSelecciona el número del curso: ');
  const cursoIndex = parseInt(seleccion) - 1;

  if (cursoIndex < 0 || cursoIndex >= cursos.length) {
    console.log('❌ Selección inválida');
    process.exit(1);
  }

  const cursoSeleccionado = cursos[cursoIndex];
  console.log(`\n✅ Curso seleccionado: ${cursoSeleccionado.nombre}`);

  // Diagnosticar
  const { duplicados, totalDuplicadas } = await diagnosticar(cursoSeleccionado.id);

  if (totalDuplicadas === 0) {
    console.log('\n✅ No se encontraron duplicados. ¡Todo está bien!');
    process.exit(0);
  }

  // Preguntar si quiere limpiar
  const quiereLimpiar = await pregunta('\n¿Deseas limpiar las inscripciones duplicadas? (si/no): ');
  
  if (quiereLimpiar.toLowerCase() === 'si') {
    await limpiar(cursoSeleccionado.id);
  } else {
    console.log('\n✅ Diagnóstico completado sin limpieza');
  }

  process.exit(0);
}

main().catch(error => {
  console.error('❌ Error:', error);
  process.exit(1);
});
