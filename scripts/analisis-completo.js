// Análisis COMPLETO del backup de Firestore
import { readFileSync } from 'fs';

const backup = JSON.parse(readFileSync('backup-completo-2026-05-03T01-28-19-357Z.json', 'utf8'));

console.log('═══════════════════════════════════════');
console.log('📊 ANÁLISIS COMPLETO DE BASE DE DATOS');
console.log('═══════════════════════════════════════\n');

console.log('📅 Fecha del backup:', new Date(backup.fecha).toLocaleString('es-VE'));
console.log('📦 Tipo:', backup.tipo);
console.log('📊 Total documentos:', Object.values(backup.colecciones).reduce((sum, col) => sum + col.length, 0));

console.log('\n═══════════════════════════════════════');
console.log('📋 COLECCIONES');
console.log('═══════════════════════════════════════\n');

Object.entries(backup.colecciones).forEach(([nombre, docs]) => {
  console.log(`${docs.length > 0 ? '✅' : '⚠️ '} ${nombre}: ${docs.length} documentos`);
});

// ============================================
// ANÁLISIS DE CURSOS
// ============================================
console.log('\n═══════════════════════════════════════');
console.log('📚 ANÁLISIS DE CURSOS');
console.log('═══════════════════════════════════════\n');

backup.colecciones.cursos.forEach(curso => {
  console.log(`📖 ${curso.nombre}`);
  console.log(`   ID: ${curso.id}`);
  console.log(`   Profesor: ${curso.profesorNombre}`);
  console.log(`   Estado: ${curso.estado}`);
  console.log(`   Fecha inicio: ${curso.fechaInicio}`);
  console.log('');
});

// ============================================
// ANÁLISIS DE INSCRIPCIONES POR CURSO
// ============================================
console.log('═══════════════════════════════════════');
console.log('📝 ANÁLISIS DE INSCRIPCIONES POR CURSO');
console.log('═══════════════════════════════════════\n');

backup.colecciones.cursos.forEach(curso => {
  const inscripciones = backup.colecciones.inscripciones.filter(i => i.cursoId === curso.id);
  
  // Agrupar por estudiante
  const porEstudiante = {};
  inscripciones.forEach(insc => {
    if (!porEstudiante[insc.estudianteId]) {
      porEstudiante[insc.estudianteId] = [];
    }
    porEstudiante[insc.estudianteId].push(insc);
  });
  
  const estudiantesUnicos = Object.keys(porEstudiante).length;
  const duplicados = Object.entries(porEstudiante).filter(([id, inscs]) => inscs.length > 1);
  const inscripcionesDuplicadas = inscripciones.length - estudiantesUnicos;
  
  console.log(`📖 ${curso.nombre}`);
  console.log(`   Total inscripciones: ${inscripciones.length}`);
  console.log(`   Estudiantes únicos: ${estudiantesUnicos}`);
  
  if (duplicados.length > 0) {
    console.log(`   🔄 Estudiantes con duplicados: ${duplicados.length}`);
    console.log(`   ⚠️  Inscripciones duplicadas: ${inscripcionesDuplicadas}`);
  } else {
    console.log(`   ✅ Sin duplicados`);
  }
  console.log('');
});

// ============================================
// ANÁLISIS DETALLADO DE DUPLICADOS
// ============================================
console.log('═══════════════════════════════════════');
console.log('🔍 ANÁLISIS DETALLADO DE DUPLICADOS');
console.log('═══════════════════════════════════════\n');

backup.colecciones.cursos.forEach(curso => {
  const inscripciones = backup.colecciones.inscripciones.filter(i => i.cursoId === curso.id);
  
  // Agrupar por estudiante
  const porEstudiante = {};
  inscripciones.forEach(insc => {
    if (!porEstudiante[insc.estudianteId]) {
      porEstudiante[insc.estudianteId] = [];
    }
    porEstudiante[insc.estudianteId].push(insc);
  });
  
  const duplicados = Object.entries(porEstudiante).filter(([id, inscs]) => inscs.length > 1);
  
  if (duplicados.length > 0) {
    console.log(`📖 CURSO: ${curso.nombre}`);
    console.log('─────────────────────────────────────\n');
    
    duplicados.forEach(([estudianteId, inscs]) => {
      const estudiante = backup.colecciones.estudiantes_v2.find(e => e.id === estudianteId);
      const nombre = estudiante ? estudiante.nombreApellido : 'DESCONOCIDO';
      
      console.log(`👤 ${nombre}`);
      console.log(`   ID: ${estudianteId.substring(0, 12)}...`);
      console.log(`   Inscripciones: ${inscs.length}`);
      
      // Ordenar por fecha
      inscs.sort((a, b) => new Date(a.fechaInscripcion) - new Date(b.fechaInscripcion));
      
      inscs.forEach((insc, idx) => {
        const fecha = new Date(insc.fechaInscripcion).toLocaleString('es-VE');
        const simbolo = idx === 0 ? '✅ MANTENER' : '❌ ELIMINAR ';
        console.log(`   ${simbolo}: ${fecha} (${insc.id.substring(0, 12)}...)`);
      });
      console.log('');
    });
  }
});

// ============================================
// ANÁLISIS DE ESTUDIANTES
// ============================================
console.log('═══════════════════════════════════════');
console.log('👥 ANÁLISIS DE ESTUDIANTES');
console.log('═══════════════════════════════════════\n');

console.log(`Total estudiantes activos (v2): ${backup.colecciones.estudiantes_v2.length}`);
console.log(`Total estudiantes legacy: ${backup.colecciones.estudiantes.length}`);

// Estudiantes sin inscripciones
const estudiantesConInscripciones = new Set(
  backup.colecciones.inscripciones.map(i => i.estudianteId)
);

const estudiantesSinInscripciones = backup.colecciones.estudiantes_v2.filter(
  e => !estudiantesConInscripciones.has(e.id)
);

console.log(`Estudiantes sin inscripciones: ${estudiantesSinInscripciones.length}`);

if (estudiantesSinInscripciones.length > 0) {
  console.log('\n⚠️  Estudiantes registrados pero sin cursos:');
  estudiantesSinInscripciones.forEach(est => {
    console.log(`   - ${est.nombreApellido} (${est.fechaRegistro})`);
  });
}

// ============================================
// ANÁLISIS DE ASISTENCIAS
// ============================================
console.log('\n═══════════════════════════════════════');
console.log('📋 ANÁLISIS DE ASISTENCIAS');
console.log('═══════════════════════════════════════\n');

backup.colecciones.cursos.forEach(curso => {
  const asistencias = backup.colecciones.asistencias.filter(a => a.cursoId === curso.id);
  
  console.log(`📖 ${curso.nombre}`);
  console.log(`   Total registros de asistencia: ${asistencias.length}`);
  
  // Calcular estadísticas
  let totalClase1 = 0, totalClase2 = 0, totalClase3 = 0, totalClase4 = 0;
  
  asistencias.forEach(a => {
    if (a.clase1) totalClase1++;
    if (a.clase2) totalClase2++;
    if (a.clase3) totalClase3++;
    if (a.clase4) totalClase4++;
  });
  
  console.log(`   Asistencia Clase 1: ${totalClase1}`);
  console.log(`   Asistencia Clase 2: ${totalClase2}`);
  console.log(`   Asistencia Clase 3: ${totalClase3}`);
  console.log(`   Asistencia Clase 4: ${totalClase4}`);
  console.log('');
});

// ============================================
// ANÁLISIS DE CONFIG
// ============================================
console.log('═══════════════════════════════════════');
console.log('⚙️  ANÁLISIS DE CONFIGURACIÓN');
console.log('═══════════════════════════════════════\n');

if (backup.colecciones.config.length > 0) {
  backup.colecciones.config.forEach(cfg => {
    console.log(`Documento de configuración: ${cfg.id}`);
    console.log(JSON.stringify(cfg, null, 2));
  });
} else {
  console.log('⚠️  No hay documentos de configuración');
}

// ============================================
// ANÁLISIS DE CONTACTO PROFESOR
// ============================================
console.log('\n═══════════════════════════════════════');
console.log('📧 ANÁLISIS DE CONTACTO PROFESOR');
console.log('═══════════════════════════════════════\n');

if (backup.colecciones.contactoProfesor.length > 0) {
  console.log(`Total mensajes: ${backup.colecciones.contactoProfesor.length}\n`);
  
  backup.colecciones.contactoProfesor.forEach(msg => {
    console.log(`📩 Mensaje ID: ${msg.id}`);
    if (msg.nombre) console.log(`   De: ${msg.nombre}`);
    if (msg.fecha) console.log(`   Fecha: ${new Date(msg.fecha).toLocaleString('es-VE')}`);
    if (msg.asunto) console.log(`   Asunto: ${msg.asunto}`);
    console.log('');
  });
} else {
  console.log('⚠️  No hay mensajes de contacto');
}

// ============================================
// RESUMEN FINAL
// ============================================
console.log('═══════════════════════════════════════');
console.log('📊 RESUMEN FINAL');
console.log('═══════════════════════════════════════\n');

const totalInscripciones = backup.colecciones.inscripciones.length;
const totalEstudiantes = backup.colecciones.estudiantes_v2.length;
const totalCursos = backup.colecciones.cursos.length;
const totalAsistencias = backup.colecciones.asistencias.length;

// Calcular duplicados totales
let totalDuplicados = 0;
backup.colecciones.cursos.forEach(curso => {
  const inscripciones = backup.colecciones.inscripciones.filter(i => i.cursoId === curso.id);
  const porEstudiante = {};
  inscripciones.forEach(insc => {
    if (!porEstudiante[insc.estudianteId]) {
      porEstudiante[insc.estudianteId] = [];
    }
    porEstudiante[insc.estudianteId].push(insc);
  });
  const estudiantesUnicos = Object.keys(porEstudiante).length;
  totalDuplicados += (inscripciones.length - estudiantesUnicos);
});

console.log(`📝 Total inscripciones: ${totalInscripciones}`);
console.log(`👥 Total estudiantes: ${totalEstudiantes}`);
console.log(`📚 Total cursos: ${totalCursos}`);
console.log(`📋 Total asistencias: ${totalAsistencias}`);
console.log(`⚠️  Total inscripciones duplicadas: ${totalDuplicados}`);

console.log('\n═══════════════════════════════════════');
console.log('✅ ANÁLISIS COMPLETADO');
console.log('═══════════════════════════════════════\n');
