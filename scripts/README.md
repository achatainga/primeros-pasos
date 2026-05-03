# 🛠️ Scripts de Mantenimiento

Scripts para gestión y mantenimiento de la base de datos Firebase.

## 📋 Scripts Disponibles

### 1. `backup-completo.js`
Crea un backup completo de todas las colecciones de Firestore.

```bash
node backup-completo.js
```

**Salida:** `../backups/backup-completo-[TIMESTAMP].json`

---

### 2. `analisis-completo.js`
Analiza un backup completo y genera estadísticas detalladas.

```bash
node analisis-completo.js
```

**Muestra:**
- Total de documentos por colección
- Análisis de inscripciones por curso
- Detección de duplicados
- Estadísticas de asistencias
- Estudiantes sin inscripciones

---

### 3. `analisis-duplicados.js`
Analiza específicamente las inscripciones duplicadas en un curso.

```bash
node analisis-duplicados.js
```

**Muestra:**
- Estudiantes con inscripciones duplicadas
- Fechas de cada inscripción
- Cuáles mantener y cuáles eliminar

---

### 4. `limpiar-duplicados.js`
Elimina inscripciones duplicadas de Firebase (próximamente).

```bash
node limpiar-duplicados.js
```

⚠️ **IMPORTANTE:** Siempre crea un backup antes de ejecutar este script.

---

## 🔧 Requisitos

Todos los scripts requieren:
- Node.js v18+
- Dependencias instaladas (`npm install`)
- Credenciales de Firebase configuradas

## 📝 Notas

- Los scripts usan ES modules (import/export)
- Requieren acceso a Firebase con permisos de lectura/escritura
- Los backups se guardan automáticamente en `../backups/`

## 🚀 Flujo de Trabajo Recomendado

1. **Crear backup**
   ```bash
   node backup-completo.js
   ```

2. **Analizar datos**
   ```bash
   node analisis-completo.js
   ```

3. **Limpiar duplicados** (si es necesario)
   ```bash
   node limpiar-duplicados.js
   ```

4. **Verificar resultados**
   ```bash
   node analisis-completo.js
   ```
