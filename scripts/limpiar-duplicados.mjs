// Script para ELIMINAR inscripciones duplicadas
// IMPORTANTE: Ejecutar DESPUÉS de hacer backup
// USO: node limpiar-duplicados.mjs

import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, query, where, deleteDoc, doc } from 'firebase/firestore';
import * as readline from 'readline';

const firebaseConfig = {
  apiKey: 'AIzaSyCK7eaCn0QIEXluTT17WRXMUq8mnVi_otw',
  authDomain: 'primeros-pasos-av.firebaseapp.com',
  projectId: 'primeros-pasos-av',
  storageBucket: 'primeros-pasos-av.firebasestorage.app',
  messagingSenderId: '720729350384',
  appId: '1:720729350384:web:eb20af58c53eb49cee6235'
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

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

async function limpiarDuplicados() {
  console.log('\n🧹 LIMPIEZA DE INSCRIPCIONES DUPLICADAS');
  console.log('═══════════════════════════════════════\n');

  // Verificar que existe backup
  const tieneBackup = await pregunta('¿Ya hiciste el backup? (si/no): ');
  if (tieneBackup.toLowerCase() !== 'si') {
    console.log('\n⚠️  DETENTE: Primero ejecuta: node backup-inscripciones.mjs');
    console.log('   NO procedas sin backup\n');
    process.exit(1);
  }

  try {
    // 1. Obtener curso "Disciplina Espiritual"
    console.log('📚 Buscando curso "Disciplina Espiritual"...');
    const cursosSnap = await getDocs(collection(db, 'cursos'));
    const cursoDisciplina = cursosSnap.docs.find(doc => 
      doc.data().nombre.includes('Disciplina')
    );

    if (!cursoDisciplina) {
      console.log('❌ No se encontró el curso "Disciplina Espiritual"');
      process.exit(1);
    }

    const cursoId = cursoDisciplina.id;
    console.log(`   ✅ Curso encontrado: ${cursoDisciplina.data().nombre} (${cursoId})\n`);

    // 2. Obtener todas las inscripciones del curso
    console.log('📝 Analizando inscripciones...');
    const inscripcionesSnap = await getDocs(
      query(collection(db, 'inscripciones'), where('cursoId', '==', cursoId))
    );

    const inscripciones = inscripcionesSnap.docs.map(doc => ({
      id: doc.id,
      estudianteId: doc.data().estudianteId,
      fechaInscripcion: doc.data().fechaInscripcion
    }));

    console.log(`   Total inscripciones: ${inscripciones.length}`);

    // 3. Agrupar por estudiante
    const estudiantesMap = new Map();
    for (const inscripcion of inscripciones) {
      const estudianteId = inscripcion.estudianteId;
      if (!estudiantesMap.has(estudianteId)) {
        estudiantesMap.set(estudianteId, []);
      }
      estudiantesMap.get(estudianteId).push(inscripcion);
    }

    console.log(`   Estudiantes únicos: ${estudiantesMap.size}\n`);

    // 4. Identificar duplicados
    const aEliminar = [];
    let estudiantesConDuplicados = 0;

    for (const [estudianteId, inscripcionesEst] of estudiantesMap.entries()) {
      if (inscripcionesEst.length > 1) {
        estudiantesConDuplicados++;

        // Ordenar por fecha (más antigua primero)
        inscripcionesEst.sort((a, b) => {
          const fechaA = a.fechaInscripcion?.seconds || 0;
          const fechaB = b.fechaInscripcion?.seconds || 0;
          return fechaA - fechaB;
        });

        // Mantener la primera (más antigua), marcar las demás para eliminar
        const [mantener, ...eliminar] = inscripcionesEst;

        console.log(`🔄 Estudiante ${estudianteId.substring(0, 8)}...`);
        console.log(`   ✅ Mantener: ${mantener.id} (${mantener.fechaInscripcion?.toDate?.() || 'Sin fecha'})`);

        eliminar.forEach(insc => {
          console.log(`   ❌ Eliminar: ${insc.id} (${insc.fechaInscripcion?.toDate?.() || 'Sin fecha'})`);
          aEliminar.push(insc.id);
        });
      }
    }

    console.log('\n═══════════════════════════════════════');
    console.log(`📊 RESUMEN:`);
    console.log(`   Estudiantes con duplicados: ${estudiantesConDuplicados}`);
    console.log(`   Inscripciones a eliminar: ${aEliminar.length}`);
    console.log(`   Inscripciones a mantener: ${inscripciones.length - aEliminar.length}`);
    console.log('═══════════════════════════════════════\n');

    if (aEliminar.length === 0) {
      console.log('✅ No hay duplicados para limpiar\n');
      process.exit(0);
    }

    // 5. Confirmar eliminación
    console.log('⚠️  ADVERTENCIA: Esta acción NO se puede deshacer');
    console.log('   (Pero tienes el backup para restaurar si es necesario)\n');
    
    const confirmar = await pregunta(`¿Eliminar ${aEliminar.length} inscripciones duplicadas? (ESCRIBE "ELIMINAR" para confirmar): `);

    if (confirmar !== 'ELIMINAR') {
      console.log('\n❌ Operación cancelada. No se eliminó nada.\n');
      process.exit(0);
    }

    // 6. Eliminar duplicados
    console.log('\n🗑️  Eliminando inscripciones duplicadas...\n');

    let eliminadas = 0;
    for (const inscripcionId of aEliminar) {
      try {
        await deleteDoc(doc(db, 'inscripciones', inscripcionId));
        eliminadas++;
        console.log(`   ✅ Eliminada: ${inscripcionId} (${eliminadas}/${aEliminar.length})`);
      } catch (error) {
        console.error(`   ❌ Error al eliminar ${inscripcionId}:`, error.message);
      }
    }

    console.log('\n═══════════════════════════════════════');
    console.log('🎉 LIMPIEZA COMPLETADA');
    console.log('═══════════════════════════════════════');
    console.log(`✅ Inscripciones eliminadas: ${eliminadas}`);
    console.log(`✅ Estudiantes afectados: ${estudiantesConDuplicados}`);
    console.log(`✅ Inscripciones restantes: ${inscripciones.length - eliminadas}`);
    console.log('\n💡 Verifica en el panel de Profesor que ahora muestre 63 estudiantes\n');

  } catch (error) {
    console.error('❌ Error durante la limpieza:', error);
    process.exit(1);
  }

  process.exit(0);
}

limpiarDuplicados();
