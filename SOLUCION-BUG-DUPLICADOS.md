# 🐛 SOLUCIÓN AL BUG DE INSCRIPCIONES DUPLICADAS

## 📊 DIAGNÓSTICO CONFIRMADO (Seguridad: 0.99)

### El Problema
Cada vez que se reasignan estudiantes desde el Admin, se crean **inscripciones duplicadas** porque el código NO verifica si el estudiante ya está inscrito en ese curso.

**Resultado actual:**
- 85 inscripciones totales
- 63 estudiantes únicos
- 22 inscripciones duplicadas (sobrantes)

---

## 🎯 SOLUCIÓN EN 3 PASOS

### PASO 1: Diagnosticar (Confirmar el problema)

#### Opción A: Usando Node.js (RECOMENDADO)

```bash
# Ejecutar desde la raíz del proyecto
node diagnosticar-duplicados.js
```

El script te mostrará:
- Total de inscripciones
- Estudiantes únicos
- Cuántos duplicados hay
- Lista detallada de estudiantes con múltiples inscripciones

#### Opción B: Desde el navegador

1. Abre el panel de Admin
2. Abre DevTools (F12) → Console
3. Pega este código:

```javascript
import { detectarDuplicados } from './lib/detectar-duplicados';

// Reemplaza 'CURSO_ID' con el ID del curso del profesor
detectarDuplicados('CURSO_ID').then(resultado => {
  console.log('Resultado:', resultado);
});
```

---

### PASO 2: Limpiar Duplicados

#### Opción A: Usando Node.js (RECOMENDADO)

El script `diagnosticar-duplicados.js` te preguntará si quieres limpiar después del diagnóstico.

Responde "si" y el script:
- Mantendrá la inscripción MÁS ANTIGUA de cada estudiante
- Eliminará las inscripciones duplicadas más recientes
- Te mostrará un resumen de lo eliminado

#### Opción B: Desde Admin.tsx (agregar botón temporal)

1. Abre `src/pages/Admin.tsx`

2. Agrega el import (línea ~10):
```typescript
import { limpiarInscripcionesDuplicadas } from '../lib/limpiar-duplicados';
```

3. Agrega estado (línea ~90):
```typescript
const [limpiando, setLimpiando] = useState(false);
```

4. Agrega función (línea ~700):
```typescript
const handleLimpiarDuplicados = async () => {
  if (!confirm('¿Limpiar inscripciones duplicadas? Esto mantendrá solo la inscripción más antigua de cada estudiante.')) return;
  
  setLimpiando(true);
  try {
    const cursoId = cursos[0]?.id; // O el curso que quieras limpiar
    if (!cursoId) {
      toast.error('No hay cursos disponibles');
      return;
    }
    
    const resultado = await limpiarInscripcionesDuplicadas(cursoId);
    alert(`Limpieza completada:\n- Inscripciones eliminadas: ${resultado.eliminadas}\n- Estudiantes afectados: ${resultado.estudiantesAfectados}`);
    cargarDatos();
  } catch (error) {
    console.error('Error:', error);
    toast.error('Error al limpiar duplicados');
  } finally {
    setLimpiando(false);
  }
};
```

5. Agrega botón (busca la sección de "Migración de Datos" alrededor de línea 900):
```typescript
<button
  onClick={handleLimpiarDuplicados}
  disabled={limpiando}
  className="bg-red-500 hover:bg-red-600 text-white font-semibold py-2 px-4 rounded-lg flex items-center gap-2 disabled:opacity-50"
>
  <Database size={20} />
  {limpiando ? 'Limpiando...' : 'Limpiar Duplicados'}
</button>
```

---

### PASO 3: Prevenir Futuros Duplicados (FIX DEL CÓDIGO)

Reemplaza las funciones de reasignación en `Admin.tsx`:

#### Fix para `handleReasignarEstudiante` (línea ~680):

```typescript
const handleReasignarEstudiante = async () => {
  if (!estudianteReasignar || !cursoDestinoId) {
    toast.error('Selecciona un curso destino');
    return;
  }
  
  try {
    // ✅ VERIFICAR SI YA EXISTE LA INSCRIPCIÓN
    const inscripcionExistente = await getDocs(
      query(
        collection(db, 'inscripciones'),
        where('estudianteId', '==', estudianteReasignar.id),
        where('cursoId', '==', cursoDestinoId)
      )
    );

    if (!inscripcionExistente.empty) {
      toast.warning(`${estudianteReasignar.nombreApellido} ya está inscrito en este curso`);
      setShowReasignarModal(false);
      setEstudianteReasignar(null);
      setCursoDestinoId('');
      return;
    }

    // Crear inscripción nueva
    await addDoc(collection(db, 'inscripciones'), {
      estudianteId: estudianteReasignar.id,
      cursoId: cursoDestinoId,
      fechaInscripcion: Timestamp.now()
    });
    
    toast.success(`${estudianteReasignar.nombreApellido} inscrito en nuevo curso`);
    setShowReasignarModal(false);
    setEstudianteReasignar(null);
    setCursoDestinoId('');
    cargarDatos();
  } catch (error) {
    console.error('Error:', error);
    toast.error('Error al reasignar estudiante');
  }
};
```

#### Fix para `handleReasignarMultiple` (línea ~720):

```typescript
const handleReasignarMultiple = async () => {
  if (seleccionMultiple.length === 0) {
    toast.error('Selecciona al menos un estudiante');
    return;
  }
  if (!cursoDestinoId) {
    toast.error('Selecciona un curso destino');
    return;
  }

  try {
    const estudiantesSeleccionados = estudiantes.filter(e => seleccionMultiple.includes(e.id));
    
    let inscritos = 0;
    let yaInscritos = 0;

    for (const est of estudiantesSeleccionados) {
      // ✅ VERIFICAR SI YA EXISTE LA INSCRIPCIÓN
      const inscripcionExistente = await getDocs(
        query(
          collection(db, 'inscripciones'),
          where('estudianteId', '==', est.id),
          where('cursoId', '==', cursoDestinoId)
        )
      );

      if (inscripcionExistente.empty) {
        // No existe, crear inscripción
        await addDoc(collection(db, 'inscripciones'), {
          estudianteId: est.id,
          cursoId: cursoDestinoId,
          fechaInscripcion: Timestamp.now()
        });
        inscritos++;
      } else {
        // Ya existe, saltar
        yaInscritos++;
        console.log(`⚠️ ${est.nombreApellido} ya está inscrito en este curso`);
      }
    }
    
    toast.success(`${inscritos} estudiante(s) inscrito(s). ${yaInscritos} ya estaban inscritos.`);
    setShowReasignarModal(false);
    setSeleccionMultiple([]);
    setModoSeleccion(false);
    setCursoDestinoId('');
    cargarDatos();
  } catch (error) {
    console.error('Error:', error);
    toast.error('Error al reasignar estudiantes');
  }
};
```

---

## 🎯 RESUMEN DE CAMBIOS

### Antes (CON BUG):
```typescript
// ❌ Crea inscripción sin verificar
await addDoc(collection(db, 'inscripciones'), {
  estudianteId: est.id,
  cursoId: cursoDestinoId,
  fechaInscripcion: Timestamp.now()
});
```

### Después (SIN BUG):
```typescript
// ✅ Verifica si ya existe antes de crear
const inscripcionExistente = await getDocs(
  query(
    collection(db, 'inscripciones'),
    where('estudianteId', '==', est.id),
    where('cursoId', '==', cursoDestinoId)
  )
);

if (inscripcionExistente.empty) {
  // Solo crear si NO existe
  await addDoc(collection(db, 'inscripciones'), {
    estudianteId: est.id,
    cursoId: cursoDestinoId,
    fechaInscripcion: Timestamp.now()
  });
}
```

---

## ✅ VERIFICACIÓN FINAL

Después de aplicar los cambios:

1. **Limpiar duplicados existentes** (Paso 2)
2. **Aplicar fix del código** (Paso 3)
3. **Probar reasignación**:
   - Selecciona estudiantes ya inscritos
   - Intenta reasignarlos al mismo curso
   - Deberías ver: "X ya está inscrito en este curso"
4. **Verificar conteo**:
   - Total inscripciones = Estudiantes únicos
   - Paginación correcta
   - No más páginas vacías

---

## 📞 SOPORTE

Si tienes algún problema:
1. Revisa la consola del navegador (F12)
2. Verifica que los IDs de curso sean correctos
3. Asegúrate de que Firebase tenga permisos de escritura

---

**Fecha**: 2025
**Versión**: 1.0
**Estado**: Listo para implementar
