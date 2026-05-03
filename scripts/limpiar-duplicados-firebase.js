// Script para ELIMINAR inscripciones duplicadas de Firebase
// IMPORTANTE: Solo ejecutar después de tener backup completo
// USO: node limpiar-duplicados-firebase.js

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

  // Verificar backup
  const tieneBackup = await pregunta('¿Ya tienes el backup completo? (si/no): ');
  if (tieneBackup.toLowerCase() !== 'si') {
    console.log('\n⚠️  DETENTE: Primero ejecuta: node backup-completo.js');
    console.log('   NO procedas sin backup\n');
    process.exit(1);
  }

  try {
    // 1. Buscar curso "Disciplina Espiritual"
    console.log('📚 Buscando curso "Disciplina Espiritual"...');
    const cursosSnap = await getDocs(collection(db, 'cursos'));
    const cursoDisciplina = cursosSnap.docs.find(doc => 
      doc.data().nombre.includes('Disciplina')
    );

    if (!cursoDisciplina) {
      console.log('❌ No se encontró el curso');
      process.exit(1);
    }

    const cursoId = cursoDisciplina.id;
    const cursoNombre = cursoDisciplina.data().nombre;
    console.log(`   ✅ Curso: ${cursoNombre}\n`);

    // 2. Obtener inscripciones
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

    // Obtener nombres de estudiantes
    const estudiantesSnap = await getDocs(collection(db, 'estudiantes_v2'));
    const estudiantesNombres = new Map();
    estudiantesSnap.docs.forEach(doc => {
      estudiantesNombres.set(doc.id, doc.data().nombreApellido);
    });

    console.log('🔍 DUPLICADOS DETECTADOS:\n');

    for (const [estudianteId, inscripcionesEst] of estudiantesMap.entries()) {
      if (inscripcionesEst.length > 1) {
        estudiantesConDuplicados++;

        // Ordenar por fecha (más antigua primero)
        inscripcionesEst.sort((a, b) => {
          const fechaA = a.fechaInscripcion?.seconds || 0;
          const fechaB = b.fechaInscripcion?.seconds || 0;
          return fechaA - fechaB;
        });

        const [mantener, ...eliminar] = inscripcionesEst;
        const nombre = estudiantesNombres.get(estudianteId) || 'Desconocido';

        console.log(`👤 ${nombre}`);
        console.log(`   ✅ Mantener: ${new Date(mantener.fechaInscripcion?.seconds * 1000).toLocaleString('es-VE')}`);
        
        eliminar.forEach(insc => {
          console.log(`   ❌ Eliminar: ${new Date(insc.fechaInscripcion?.seconds * 1000).toLocaleString('es-VE')}`);
          aEliminar.push(insc.id);
        });
        console.log('');
      }
    }

    console.log('═══════════════════════════════════════');
    console.log('📊 RESUMEN:');
    console.log('═══════════════════════════════════════');
    console.log(`Estudiantes con duplicados: ${estudiantesConDuplicados}`);
    console.log(`Inscripciones a eliminar: ${aEliminar.length}`);
    console.log(`Inscripciones a mantener: ${inscripciones.length - aEliminar.length}`);
    console.log('═══════════════════════════════════════\n');

    if (aEliminar.length === 0) {
      console.log('✅ No hay duplicados para limpiar\n');
      process.exit(0);
    }

    // 5. Confirmar
    console.log('⚠️  ADVERTENCIA: Esta acción NO se puede deshacer');
    console.log('   (Tienes el backup para restaurar si es necesario)\n');
    
    const confirmar = await pregunta(`Escribe "ELIMINAR" para confirmar: `);

    if (confirmar !== 'ELIMINAR') {
      console.log('\n❌ Operación cancelada\n');
      process.exit(0);
    }

    // 6. Eliminar
    console.log('\n🗑️  Eliminando duplicados...\n');

    let eliminadas = 0;
    for (const inscripcionId of aEliminar) {
      try {
        await deleteDoc(doc(db, 'inscripciones', inscripcionId));
        eliminadas++;
        console.log(`   ✅ ${eliminadas}/${aEliminar.length}`);
      } catch (error) {
        console.error(`   ❌ Error: ${inscripcionId}`);
      }
    }

    console.log('\n═══════════════════════════════════════');
    console.log('🎉 LIMPIEZA COMPLETADA');
    console.log('═══════════════════════════════════════');
    console.log(`✅ Eliminadas: ${eliminadas}`);
    console.log(`✅ Estudiantes afectados: ${estudiantesConDuplicados}`);
    console.log(`✅ Inscripciones restantes: ${inscripciones.length - eliminadas}`);
    console.log('\n💡 Verifica en Profesor que ahora muestre 63 estudiantes\n');

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }

  process.exit(0);
}

limpiarDuplicados();
