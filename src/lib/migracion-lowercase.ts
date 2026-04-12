import { collection, getDocs, updateDoc, doc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { toast } from 'react-toastify';

export async function agregarCampoLowercase() {
  try {
    console.log('🔄 Agregando campo nombreApellidoLower...');
    toast.info('Agregando campo de búsqueda...');

    const snapshot = await getDocs(collection(db, 'estudiantes_v2'));
    let actualizados = 0;

    for (const docSnap of snapshot.docs) {
      const data = docSnap.data();
      if (!data.nombreApellidoLower) {
        await updateDoc(doc(db, 'estudiantes_v2', docSnap.id), {
          nombreApellidoLower: data.nombreApellido.toLowerCase()
        });
        actualizados++;
        console.log(`✅ Actualizado: ${data.nombreApellido}`);
      }
    }

    console.log(`🎉 Migración completada: ${actualizados} estudiantes actualizados`);
    toast.success(`${actualizados} estudiantes actualizados`);
    
    return { actualizados, total: snapshot.size };
  } catch (error: any) {
    console.error('Error en migración:', error);
    toast.error('Error en migración: ' + error.message);
    throw error;
  }
}
