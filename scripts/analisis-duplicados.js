// Análisis de duplicados en Disciplina Espiritual
import { readFileSync } from 'fs';

const backup = JSON.parse(readFileSync('backup-firestore-2026-05-03T01-23-57-040Z.json', 'utf8'));

const cursoDisciplina = 'DJDJlBiw2QyA9FQOQm84';
const inscripciones = backup.colecciones.inscripciones.filter(i => i.cursoId === cursoDisciplina);

console.log('═══════════════════════════════════════');
console.log('📊 ANÁLISIS DE DUPLICADOS');
console.log('═══════════════════════════════════════\n');

console.log(`Total inscripciones: ${inscripciones.length}`);

// Agrupar por estudianteId
const porEstudiante = {};
inscripciones.forEach(insc => {
  if (!porEstudiante[insc.estudianteId]) {
    porEstudiante[insc.estudianteId] = [];
  }
  porEstudiante[insc.estudianteId].push(insc);
});

const estudiantesUnicos = Object.keys(porEstudiante).length;
console.log(`Estudiantes únicos: ${estudiantesUnicos}`);

// Detectar duplicados
const duplicados = Object.entries(porEstudiante).filter(([id, inscs]) => inscs.length > 1);

console.log(`\n🔄 Estudiantes con duplicados: ${duplicados.length}`);
console.log(`⚠️  Inscripciones duplicadas: ${inscripciones.length - estudiantesUnicos}\n`);

console.log('═══════════════════════════════════════');
console.log('📋 DETALLE DE DUPLICADOS');
console.log('═══════════════════════════════════════\n');

duplicados.forEach(([estudianteId, inscs]) => {
  const estudiante = backup.colecciones.estudiantes_v2.find(e => e.id === estudianteId);
  const nombre = estudiante ? estudiante.nombreApellido : 'DESCONOCIDO';
  
  console.log(`👤 ${nombre} (${estudianteId.substring(0, 8)}...)`);
  console.log(`   Inscripciones: ${inscs.length}`);
  
  inscs.forEach((insc, idx) => {
    const fecha = new Date(insc.fechaInscripcion).toLocaleString('es-VE');
    const simbolo = idx === 0 ? '✅ MANTENER' : '❌ ELIMINAR';
    console.log(`   ${simbolo}: ${fecha}`);
  });
  console.log('');
});

console.log('═══════════════════════════════════════');
console.log('✅ ANÁLISIS COMPLETADO');
console.log('═══════════════════════════════════════');
