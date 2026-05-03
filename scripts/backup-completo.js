// Backup COMPLETO de TODAS las colecciones de Firestore
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';
import { writeFileSync } from 'fs';

const firebaseConfig = {
  apiKey: "AIzaSyCK7eaCn0QIEXluTT17WRXMUq8mnVi_otw",
  authDomain: "primeros-pasos-av.firebaseapp.com",
  projectId: "primeros-pasos-av",
  storageBucket: "primeros-pasos-av.firebasestorage.app",
  messagingSenderId: "720729350384",
  appId: "1:720729350384:web:eb20af58c53eb49cee6235"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Lista de TODAS las colecciones en Firebase
const TODAS_LAS_COLECCIONES = [
  'inscripciones',
  'estudiantes_v2',
  'cursos',
  'asistencias',
  'config',
  'contactoProfesor',
  'estudiantes',  // legacy
  'profesores',   // si existe
  'usuarios',     // si existe
  'materiales'    // si existe
];

async function backupCompleto() {
  console.log('💾 INICIANDO BACKUP COMPLETO DE FIRESTORE');
  console.log('═══════════════════════════════════════\n');

  const backup = {
    fecha: new Date().toISOString(),
    tipo: 'BACKUP_COMPLETO',
    colecciones: {}
  };

  for (const nombreColeccion of TODAS_LAS_COLECCIONES) {
    try {
      console.log(`📝 Descargando ${nombreColeccion}...`);
      
      const colRef = collection(db, nombreColeccion);
      const snapshot = await getDocs(colRef);
      
      const documentos = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      backup.colecciones[nombreColeccion] = documentos;
      
      if (documentos.length > 0) {
        console.log(`   ✅ ${documentos.length} documentos descargados`);
      } else {
        console.log(`   ⚠️  Colección vacía`);
      }
    } catch (error) {
      console.log(`   ⚠️  Colección no existe o sin permisos (se omite)`);
      backup.colecciones[nombreColeccion] = [];
    }
  }

  // Guardar backup
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `backup-completo-${timestamp}.json`;
  
  writeFileSync(filename, JSON.stringify(backup, null, 2));

  console.log('\n═══════════════════════════════════════');
  console.log('✅ BACKUP COMPLETO EXITOSO');
  console.log('═══════════════════════════════════════');
  console.log(`📁 Archivo: ${filename}`);
  
  // Resumen
  let totalDocs = 0;
  console.log('\n📊 RESUMEN POR COLECCIÓN:');
  Object.entries(backup.colecciones).forEach(([nombre, docs]) => {
    if (docs.length > 0) {
      console.log(`   ${nombre}: ${docs.length} documentos`);
      totalDocs += docs.length;
    }
  });
  console.log(`\n📊 Total documentos: ${totalDocs}`);
  
  console.log('\n💡 Guarda este archivo en un lugar seguro');
  console.log('   Puedes restaurarlo si algo sale mal\n');

  process.exit(0);
}

backupCompleto().catch(error => {
  console.error('❌ Error en backup:', error);
  process.exit(1);
});
