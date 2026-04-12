import { useState, useEffect } from 'react';
import { collection, getDocs, query, where, doc, setDoc, addDoc, updateDoc, deleteDoc, Timestamp, orderBy, limit, startAfter, endBefore, limitToLast, QueryDocumentSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { UploadClient } from '@uploadcare/upload-client';
import { toast } from 'react-toastify';
import { Lock, Download, CheckSquare, Square, Plus, Upload, BookOpen } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface Estudiante {
  id: string;
  nombreApellido: string;
  telefono: string;
  correo: string;
  cursoId: string;
}

interface Curso {
  id: string;
  nombre: string;
  fechaInicio: string;
  hora: string;
  estado: string;
  materiales?: Array<{url: string; name: string}>;
  profesorId?: string;
  profesorNombre?: string;
}

interface EditingCurso {
  id: string;
  nombre: string;
  fechaInicio: string;
  hora: string;
}

interface Asistencia {
  estudianteId: string;
  cursoId: string;
  clase1: boolean;
  clase2: boolean;
  clase3: boolean;
  clase4: boolean;
  notaFinal?: number;
  observaciones?: string;
}

export default function Profesor() {
  const [password, setPassword] = useState('');
  const [authenticated, setAuthenticated] = useState(false);
  const [cursos, setCursos] = useState<Curso[]>([]);
  const [cursoSeleccionado, setCursoSeleccionado] = useState('');
  const [estudiantes, setEstudiantes] = useState<Estudiante[]>([]);
  const [asistencias, setAsistencias] = useState<Record<string, Asistencia>>({});
  const [loading, setLoading] = useState(false);
  const [showCursoForm, setShowCursoForm] = useState(false);
  const [cursoForm, setCursoForm] = useState({
    nombre: '',
    fechaInicio: '',
    hora: '',
    estado: 'abierto' as 'abierto' | 'cerrado'
  });
  const [uploadingFile, setUploadingFile] = useState(false);
  const [editingCurso, setEditingCurso] = useState<EditingCurso | null>(null);
  const [showContactForm, setShowContactForm] = useState(false);
  const [contactoProfesor, setContactoProfesor] = useState({
    nombre: '',
    telefono: '',
    email: ''
  });
  const [profesorId, setProfesorId] = useState('');
  const [paginaActual, setPaginaActual] = useState(1);
  const [busqueda, setBusqueda] = useState('');
  const [primerDoc, setPrimerDoc] = useState<QueryDocumentSnapshot | null>(null);
  const [ultimoDoc, setUltimoDoc] = useState<QueryDocumentSnapshot | null>(null);
  const [totalEstudiantes, setTotalEstudiantes] = useState(0);
  const [modoGlobal, setModoGlobal] = useState(false);
  const ITEMS_POR_PAGINA = 25;

  useEffect(() => {
    if (authenticated) {
      cargarCursos();
      cargarContactoProfesor();
    }
  }, [authenticated]);

  useEffect(() => {
    if (cursoSeleccionado) {
      cargarEstudiantes();
    }
  }, [cursoSeleccionado]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const snapshot = await getDocs(collection(db, 'contactoProfesor'));
      const profesor = snapshot.docs.find(doc => doc.data().password === password);
      
      if (profesor) {
        setProfesorId(profesor.id);
        setContactoProfesor(profesor.data() as any);
        setAuthenticated(true);
        toast.success('Acceso concedido');
      } else {
        toast.error('Contraseña incorrecta');
      }
    } catch (error) {
      console.error('Error:', error);
      toast.error('Error al iniciar sesión');
    }
  };

  const cargarCursos = async () => {
    try {
      const snapshot = await getDocs(collection(db, 'cursos'));
      const todosCursos = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Curso[];
      // Filtrar solo cursos del profesor actual
      const cursosFiltrados = todosCursos.filter(c => !c.profesorId || c.profesorId === profesorId);
      setCursos(cursosFiltrados);
      // Seleccionar el último curso por defecto
      if (cursosFiltrados.length > 0 && !cursoSeleccionado) {
        setCursoSeleccionado(cursosFiltrados[cursosFiltrados.length - 1].id);
      }
    } catch (error) {
      console.error('Error:', error);
      toast.error('Error al cargar cursos');
    }
  };

  const cargarContactoProfesor = async () => {
    try {
      const snapshot = await getDocs(collection(db, 'contactoProfesor'));
      if (!snapshot.empty) {
        const data = snapshot.docs[0].data();
        setContactoProfesor({
          nombre: data.nombre || '',
          telefono: data.telefono || '',
          email: data.email || ''
        });
        setProfesorId(snapshot.docs[0].id);
      }
    } catch (error) {
      console.error('Error:', error);
    }
  };

  const guardarContactoProfesor = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const snapshot = await getDocs(collection(db, 'contactoProfesor'));
      if (snapshot.empty) {
        const docRef = await addDoc(collection(db, 'contactoProfesor'), contactoProfesor);
        setProfesorId(docRef.id);
      } else {
        await updateDoc(doc(db, 'contactoProfesor', snapshot.docs[0].id), contactoProfesor);
        setProfesorId(snapshot.docs[0].id);
      }
      toast.success('Contacto guardado');
      setShowContactForm(false);
      cargarCursos(); // Recargar cursos con el nuevo profesorId
    } catch (error) {
      console.error('Error:', error);
      toast.error('Error al guardar contacto');
    }
  };

  const handleCreateCurso = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profesorId) {
      toast.error('Debes guardar tu contacto primero');
      return;
    }
    try {
      await addDoc(collection(db, 'cursos'), {
        ...cursoForm,
        materiales: [],
        profesorId,
        profesorNombre: contactoProfesor.nombre,
        fechaCreacion: Timestamp.now()
      });
      toast.success('Curso creado');
      setShowCursoForm(false);
      setCursoForm({ nombre: '', fechaInicio: '', hora: '', estado: 'abierto' });
      cargarCursos();
    } catch (error) {
      console.error('Error:', error);
      toast.error('Error al crear curso');
    }
  };

  const handleUploadMaterial = async (cursoId: string, file: File) => {
    setUploadingFile(true);
    toast.info('Subiendo material...');
    try {
      const client = new UploadClient({ publicKey: import.meta.env.VITE_UPLOADCARE_PUBLIC_KEY });
      const result = await client.uploadFile(file, { store: 'auto' });
      const url = `https://2wlj9bh4ya.ucarecd.net/${result.uuid}/${result.name}`;
      
      const curso = cursos.find(c => c.id === cursoId);
      if (curso) {
        await updateDoc(doc(db, 'cursos', cursoId), {
          materiales: [...(curso.materiales || []), { url, name: result.originalFilename || result.name }]
        });
        toast.success('Material subido exitosamente');
        cargarCursos();
      }
    } catch (error) {
      console.error('Error:', error);
      toast.error('Error al subir material');
    } finally {
      setUploadingFile(false);
    }
  };

  const toggleEstadoCurso = async (cursoId: string, estadoActual: string) => {
    try {
      await updateDoc(doc(db, 'cursos', cursoId), {
        estado: estadoActual === 'abierto' ? 'cerrado' : 'abierto'
      });
      toast.success('Estado actualizado');
      cargarCursos();
    } catch (error) {
      console.error('Error:', error);
      toast.error('Error al actualizar estado');
    }
  };

  const handleDeleteCurso = async (cursoId: string, nombreCurso: string) => {
    const num1 = Math.floor(Math.random() * 900) + 100;
    const num2 = Math.floor(Math.random() * 900) + 100;
    const resultado = num1 + num2;
    const respuesta = prompt(`Para eliminar "${nombreCurso}", resuelve: ${num1} + ${num2} = ?`);
    
    if (respuesta === resultado.toString()) {
      try {
        await deleteDoc(doc(db, 'cursos', cursoId));
        toast.success('Curso eliminado');
        cargarCursos();
      } catch (error) {
        console.error('Error:', error);
        toast.error('Error al eliminar curso');
      }
    } else if (respuesta !== null) {
      toast.error('Respuesta incorrecta');
    }
  };

  const handleEditCurso = async () => {
    if (!editingCurso) return;
    try {
      await updateDoc(doc(db, 'cursos', editingCurso.id), {
        nombre: editingCurso.nombre,
        fechaInicio: editingCurso.fechaInicio,
        hora: editingCurso.hora
      });
      toast.success('Curso actualizado');
      setEditingCurso(null);
      cargarCursos();
    } catch (error) {
      console.error('Error:', error);
      toast.error('Error al actualizar curso');
    }
  };

  const cargarEstudiantes = async () => {
    setLoading(true);
    try {
      const totalQ = query(collection(db, 'estudiantes'), where('cursoId', '==', cursoSeleccionado));
      const totalSnap = await getDocs(totalQ);
      setTotalEstudiantes(totalSnap.size);

      await cargarEstudiantesPagina('inicial');
    } catch (error) {
      console.error('Error al cargar estudiantes:', error);
      toast.error('Error al cargar estudiantes');
    } finally {
      setLoading(false);
    }
  };

  const cargarEstudiantesPagina = async (direccion: 'inicial' | 'siguiente' | 'anterior') => {
    setLoading(true);
    try {
      let q;
      
      if (direccion === 'inicial') {
        q = query(
          collection(db, 'estudiantes'),
          where('cursoId', '==', cursoSeleccionado),
          orderBy('fechaRegistro', 'desc'),
          limit(ITEMS_POR_PAGINA)
        );
      } else if (direccion === 'siguiente' && ultimoDoc) {
        q = query(
          collection(db, 'estudiantes'),
          where('cursoId', '==', cursoSeleccionado),
          orderBy('fechaRegistro', 'desc'),
          startAfter(ultimoDoc),
          limit(ITEMS_POR_PAGINA)
        );
      } else if (direccion === 'anterior' && primerDoc) {
        q = query(
          collection(db, 'estudiantes'),
          where('cursoId', '==', cursoSeleccionado),
          orderBy('fechaRegistro', 'desc'),
          endBefore(primerDoc),
          limitToLast(ITEMS_POR_PAGINA)
        );
      } else {
        return;
      }

      const snapshot = await getDocs(q);
      
      if (snapshot.empty) {
        setEstudiantes([]);
        setAsistencias({});
        return;
      }

      const estudiantesData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Estudiante[];
      setEstudiantes(estudiantesData);
      setPrimerDoc(snapshot.docs[0]);
      setUltimoDoc(snapshot.docs[snapshot.docs.length - 1]);

      const asistenciasData: Record<string, Asistencia> = {};
      for (const est of estudiantesData) {
        const asistenciaDoc = await getDocs(
          query(collection(db, 'asistencias'), 
            where('estudianteId', '==', est.id),
            where('cursoId', '==', cursoSeleccionado)
          )
        );
        if (!asistenciaDoc.empty) {
          asistenciasData[est.id] = asistenciaDoc.docs[0].data() as Asistencia;
        } else {
          asistenciasData[est.id] = {
            estudianteId: est.id,
            cursoId: cursoSeleccionado,
            clase1: false,
            clase2: false,
            clase3: false,
            clase4: false
          };
        }
      }
      setAsistencias(asistenciasData);
    } catch (error) {
      console.error('Error al cargar estudiantes:', error);
      toast.error('Error al cargar estudiantes');
    } finally {
      setLoading(false);
    }
  };

  const cargarTodosEstudiantes = async () => {
    setLoading(true);
    setModoGlobal(true);
    try {
      const q = query(collection(db, 'estudiantes'), where('cursoId', '==', cursoSeleccionado));
      const snapshot = await getDocs(q);
      const estudiantesData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Estudiante[];
      setEstudiantes(estudiantesData);

      const asistenciasData: Record<string, Asistencia> = {};
      for (const est of estudiantesData) {
        const asistenciaDoc = await getDocs(
          query(collection(db, 'asistencias'), 
            where('estudianteId', '==', est.id),
            where('cursoId', '==', cursoSeleccionado)
          )
        );
        if (!asistenciaDoc.empty) {
          asistenciasData[est.id] = asistenciaDoc.docs[0].data() as Asistencia;
        } else {
          asistenciasData[est.id] = {
            estudianteId: est.id,
            cursoId: cursoSeleccionado,
            clase1: false,
            clase2: false,
            clase3: false,
            clase4: false
          };
        }
      }
      setAsistencias(asistenciasData);
      toast.success(`${snapshot.size} estudiantes cargados`);
    } catch (error) {
      console.error('Error:', error);
      toast.error('Error al cargar todos los estudiantes');
    } finally {
      setLoading(false);
    }
  };

  const toggleAsistencia = async (estudianteId: string, clase: 'clase1' | 'clase2' | 'clase3' | 'clase4') => {
    const asistencia = asistencias[estudianteId];
    const nuevaAsistencia = { ...asistencia, [clase]: !asistencia[clase] };
    
    try {
      await setDoc(doc(db, 'asistencias', `${estudianteId}_${cursoSeleccionado}`), nuevaAsistencia);
      setAsistencias({ ...asistencias, [estudianteId]: nuevaAsistencia });
      toast.success('Asistencia actualizada');
    } catch (error) {
      console.error('Error:', error);
      toast.error('Error al actualizar asistencia');
    }
  };

  const guardarNota = async (estudianteId: string, nota: number, observaciones: string) => {
    const asistencia = asistencias[estudianteId];
    const nuevaAsistencia = { ...asistencia, notaFinal: nota, observaciones };
    
    try {
      await setDoc(doc(db, 'asistencias', `${estudianteId}_${cursoSeleccionado}`), nuevaAsistencia);
      setAsistencias({ ...asistencias, [estudianteId]: nuevaAsistencia });
      toast.success('Nota guardada');
    } catch (error) {
      console.error('Error:', error);
      toast.error('Error al guardar nota');
    }
  };

  const descargarPDFAsistencia = () => {
    const doc = new jsPDF();
    const curso = cursos.find(c => c.id === cursoSeleccionado);
    
    doc.setFontSize(18);
    doc.text('Primeros Pasos - Asistencia', 14, 20);
    doc.setFontSize(12);
    doc.text(`Curso: ${curso?.nombre || ''}`, 14, 28);
    doc.text(`Fecha: ${new Date().toLocaleDateString('es-DO')}`, 14, 35);

    const estudiantesParaPDF = modoGlobal ? estudiantes : estudiantes;
    const tableData = estudiantesParaPDF.map((est, idx) => {
      const asist = asistencias[est.id];
      return [
        idx + 1,
        est.nombreApellido,
        asist?.clase1 ? '[X]' : '[   ]',
        asist?.clase2 ? '[X]' : '[   ]',
        asist?.clase3 ? '[X]' : '[   ]',
        asist?.clase4 ? '[X]' : '[   ]'
      ];
    });

    autoTable(doc, {
      startY: 40,
      head: [['#', 'Nombre', 'Clase 1', 'Clase 2', 'Clase 3', 'Clase 4']],
      body: tableData,
      styles: { fontSize: 10 },
      headStyles: { fillColor: [30, 64, 175] }
    });

    doc.save(`asistencia-${curso?.nombre}-${new Date().toISOString().split('T')[0]}.pdf`);
    toast.success('PDF descargado');
  };

  const descargarPDFNotas = () => {
    const doc = new jsPDF();
    const curso = cursos.find(c => c.id === cursoSeleccionado);
    
    doc.setFontSize(18);
    doc.text('Primeros Pasos - Notas Finales', 14, 20);
    doc.setFontSize(12);
    doc.text(`Curso: ${curso?.nombre || ''}`, 14, 28);
    doc.text(`Fecha: ${new Date().toLocaleDateString('es-DO')}`, 14, 35);

    const estudiantesParaPDF = modoGlobal ? estudiantes : estudiantes;
    const tableData = estudiantesParaPDF.map((est, idx) => {
      const asist = asistencias[est.id];
      return [
        idx + 1,
        est.nombreApellido,
        asist?.notaFinal || '',
        asist?.observaciones || ''
      ];
    });

    autoTable(doc, {
      startY: 40,
      head: [['#', 'Nombre', 'Nota Final', 'Observaciones']],
      body: tableData,
      styles: { fontSize: 10 },
      headStyles: { fillColor: [30, 64, 175] },
      columnStyles: { 3: { cellWidth: 60 } }
    });

    doc.save(`notas-${curso?.nombre}-${new Date().toISOString().split('T')[0]}.pdf`);
    toast.success('PDF descargado');
  };

  const estudiantesFiltrados = modoGlobal ? estudiantes.filter(est => {
    const searchLower = busqueda.toLowerCase();
    return (
      est.nombreApellido.toLowerCase().includes(searchLower) ||
      est.telefono.toLowerCase().includes(searchLower) ||
      est.correo.toLowerCase().includes(searchLower)
    );
  }) : estudiantes;

  const totalPaginas = Math.ceil(totalEstudiantes / ITEMS_POR_PAGINA);
  const estudiantesPaginados = modoGlobal ? estudiantesFiltrados : estudiantes;

  if (!authenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-900 via-green-800 to-green-900 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-2xl p-8">
          <div className="text-center mb-8">
            <Lock className="mx-auto mb-4 text-green-600" size={48} />
            <h1 className="text-2xl font-bold text-gray-900">Panel de Profesor</h1>
            <p className="text-gray-600 mt-2">Ingresa la contraseña</p>
          </div>
          <form onSubmit={handleLogin}>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Contraseña"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent mb-4"
            />
            <button
              type="submit"
              className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-6 rounded-lg transition-colors"
            >
              Ingresar
            </button>
          </form>
          <p className="text-center text-sm text-gray-600 mt-6">
            <a href="/" className="text-green-600 hover:underline">Volver al registro</a>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Panel de Profesor</h1>
              <p className="text-gray-600 mt-1">Primeros Pasos</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setShowContactForm(!showContactForm)}
                className="bg-green-600 hover:bg-green-700 text-white font-semibold py-2 px-4 rounded-lg"
              >
                {contactoProfesor.nombre ? 'Editar Contacto' : 'Agregar Contacto'}
              </button>
              <a href="/" className="bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold py-2 px-4 rounded-lg">
                Volver al Registro
              </a>
            </div>
          </div>

          {showContactForm && (
            <form onSubmit={guardarContactoProfesor} className="mt-4 bg-gray-100 p-4 rounded-lg">
              <h3 className="font-bold text-gray-900 mb-3">Información de Contacto</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <input
                  type="text"
                  required
                  value={contactoProfesor.nombre}
                  onChange={(e) => setContactoProfesor({...contactoProfesor, nombre: e.target.value})}
                  placeholder="Nombre completo"
                  className="px-4 py-2 border border-gray-300 rounded-lg"
                />
                <input
                  type="tel"
                  value={contactoProfesor.telefono}
                  onChange={(e) => setContactoProfesor({...contactoProfesor, telefono: e.target.value})}
                  placeholder="Teléfono (opcional)"
                  className="px-4 py-2 border border-gray-300 rounded-lg"
                />
                <input
                  type="email"
                  value={contactoProfesor.email}
                  onChange={(e) => setContactoProfesor({...contactoProfesor, email: e.target.value})}
                  placeholder="Email (opcional)"
                  className="px-4 py-2 border border-gray-300 rounded-lg"
                />
              </div>
              <div className="flex gap-2 mt-4">
                <button type="submit" className="bg-green-600 hover:bg-green-700 text-white py-2 px-4 rounded-lg">
                  Guardar Contacto
                </button>
                <button
                  type="button"
                  onClick={() => setShowContactForm(false)}
                  className="bg-gray-300 hover:bg-gray-400 text-gray-800 py-2 px-4 rounded-lg"
                >
                  Cancelar
                </button>
              </div>
            </form>
          )}
        </div>

        <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <BookOpen size={24} className="text-green-600" />
              Gestión de Cursos
            </h2>
            <button
              onClick={() => setShowCursoForm(!showCursoForm)}
              className="bg-green-600 hover:bg-green-700 text-white font-semibold py-2 px-4 rounded-lg flex items-center gap-2"
            >
              <Plus size={20} />
              Nuevo Curso
            </button>
          </div>

          {showCursoForm && (
            <form onSubmit={handleCreateCurso} className="bg-gray-100 p-4 rounded-lg mb-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <input
                  type="text"
                  required
                  value={cursoForm.nombre}
                  onChange={(e) => setCursoForm({...cursoForm, nombre: e.target.value})}
                  placeholder="Nombre del curso"
                  className="px-4 py-2 border border-gray-300 rounded-lg"
                />
                <input
                  type="date"
                  required
                  value={cursoForm.fechaInicio}
                  onChange={(e) => setCursoForm({...cursoForm, fechaInicio: e.target.value})}
                  className="px-4 py-2 border border-gray-300 rounded-lg"
                />
                <input
                  type="time"
                  required
                  value={cursoForm.hora}
                  onChange={(e) => setCursoForm({...cursoForm, hora: e.target.value})}
                  className="px-4 py-2 border border-gray-300 rounded-lg"
                />
                <select
                  value={cursoForm.estado}
                  onChange={(e) => setCursoForm({...cursoForm, estado: e.target.value as 'abierto' | 'cerrado'})}
                  className="px-4 py-2 border border-gray-300 rounded-lg"
                >
                  <option value="abierto">Abierto</option>
                  <option value="cerrado">Cerrado</option>
                </select>
              </div>
              <div className="flex gap-2 mt-4">
                <button type="submit" className="bg-green-600 hover:bg-green-700 text-white py-2 px-4 rounded-lg">
                  Crear Curso
                </button>
                <button
                  type="button"
                  onClick={() => setShowCursoForm(false)}
                  className="bg-gray-300 hover:bg-gray-400 text-gray-800 py-2 px-4 rounded-lg"
                >
                  Cancelar
                </button>
              </div>
            </form>
          )}

          <div className="grid gap-4 mb-6">
            {cursos.map(curso => (
              <div key={curso.id} className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                {editingCurso?.id === curso.id ? (
                  <div className="space-y-3">
                    <input
                      type="text"
                      value={editingCurso.nombre}
                      onChange={(e) => setEditingCurso({...editingCurso, nombre: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                      placeholder="Nombre del curso"
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="date"
                        value={editingCurso.fechaInicio}
                        onChange={(e) => setEditingCurso({...editingCurso, fechaInicio: e.target.value})}
                        className="px-3 py-2 border border-gray-300 rounded-lg"
                      />
                      <input
                        type="time"
                        value={editingCurso.hora}
                        onChange={(e) => setEditingCurso({...editingCurso, hora: e.target.value})}
                        className="px-3 py-2 border border-gray-300 rounded-lg"
                      />
                    </div>
                    <div className="flex gap-2">
                      <button onClick={handleEditCurso} className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg">
                        Guardar
                      </button>
                      <button onClick={() => setEditingCurso(null)} className="bg-gray-300 hover:bg-gray-400 text-gray-800 px-4 py-2 rounded-lg">
                        Cancelar
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <h3 className="font-bold text-lg text-gray-900">{curso.nombre}</h3>
                        <p className="text-sm text-gray-600">Inicio: {curso.fechaInicio} - {curso.hora}</p>
                        <span className={`inline-block px-3 py-1 text-xs font-semibold rounded-full mt-2 ${
                          curso.estado === 'abierto' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                        }`}>
                          {curso.estado === 'abierto' ? 'Abierto' : 'Cerrado'}
                        </span>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => setEditingCurso({id: curso.id, nombre: curso.nombre, fechaInicio: curso.fechaInicio, hora: curso.hora})}
                          className="bg-blue-500 hover:bg-blue-600 text-white p-2 rounded-lg"
                          title="Editar curso"
                        >
                          ✏️
                        </button>
                        <button
                          onClick={() => toggleEstadoCurso(curso.id, curso.estado)}
                          className="bg-yellow-500 hover:bg-yellow-600 text-white p-2 rounded-lg text-sm"
                          title="Cambiar estado"
                        >
                          {curso.estado === 'abierto' ? 'Cerrar' : 'Abrir'}
                        </button>
                        <label className="bg-green-600 hover:bg-green-700 text-white p-2 rounded-lg cursor-pointer">
                          <Upload size={18} />
                          <input
                            type="file"
                            className="hidden"
                            accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) {
                                handleUploadMaterial(curso.id, file);
                                e.target.value = '';
                              }
                            }}
                            disabled={uploadingFile}
                          />
                        </label>
                        <button
                          onClick={() => handleDeleteCurso(curso.id, curso.nombre)}
                          className="bg-red-500 hover:bg-red-600 text-white p-2 rounded-lg"
                          title="Eliminar curso"
                        >
                          🗑️
                        </button>
                      </div>
                    </div>
                    {curso.materiales && curso.materiales.length > 0 && (
                      <div className="mt-4 space-y-2">
                        <p className="text-sm font-semibold text-gray-700">Materiales ({curso.materiales.length}):</p>
                        {curso.materiales.map((material, idx) => (
                          <div key={idx} className="flex items-center justify-between bg-white p-2 rounded border border-gray-200">
                            <a href={material.url} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-600 hover:underline truncate flex-1">
                              {material.name}
                            </a>
                            <button
                              onClick={async () => {
                                if (confirm(`¿Eliminar ${material.name}?`)) {
                                  try {
                                    const uuid = material.url?.split('/')[3];
                                    if (uuid) {
                                      try {
                                        await fetch(`https://api.uploadcare.com/files/${uuid}/`, {
                                          method: 'DELETE',
                                          headers: {
                                            'Authorization': `Uploadcare.Simple ${import.meta.env.VITE_UPLOADCARE_PUBLIC_KEY}:${import.meta.env.VITE_UPLOADCARE_SECRET_KEY || ''}`
                                          }
                                        });
                                      } catch (e) {
                                        console.log('Archivo ya no existe en Uploadcare');
                                      }
                                    }
                                    const nuevosMateriales = curso.materiales?.filter((_, i) => i !== idx) || [];
                                    await updateDoc(doc(db, 'cursos', curso.id), { materiales: nuevosMateriales });
                                    toast.success('Material eliminado');
                                    cargarCursos();
                                  } catch (error) {
                                    console.error('Error:', error);
                                    toast.error('Error al eliminar material');
                                  }
                                }
                              }}
                              className="text-red-500 hover:text-red-700 ml-2"
                            >
                              🗑️
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
          <div className="flex gap-4 items-center">
            <select
              value={cursoSeleccionado}
              onChange={(e) => setCursoSeleccionado(e.target.value)}
              className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
            >
              <option value="">Seleccionar Curso para Asistencia</option>
              {cursos.map(curso => (
                <option key={curso.id} value={curso.id}>{curso.nombre}</option>
              ))}
            </select>
            {cursoSeleccionado && (
              <>
                <button
                  onClick={descargarPDFAsistencia}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-lg flex items-center gap-2"
                >
                  <Download size={20} />
                  PDF Asistencia
                </button>
                <button
                  onClick={descargarPDFNotas}
                  className="bg-green-600 hover:bg-green-700 text-white font-semibold py-3 px-6 rounded-lg flex items-center gap-2"
                >
                  <Download size={20} />
                  PDF Notas
                </button>
              </>
            )}
          </div>
        </div>

        {cursoSeleccionado && (
          <div className="bg-white rounded-2xl shadow-lg p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-bold text-gray-900">Estudiantes ({totalEstudiantes})</h2>
              <div className="flex gap-2">
                {!modoGlobal ? (
                  <button
                    onClick={cargarTodosEstudiantes}
                    className="bg-blue-500 hover:bg-blue-600 text-white font-semibold py-2 px-4 rounded-lg"
                  >
                    Cargar Todos para Buscar
                  </button>
                ) : (
                  <button
                    onClick={() => {
                      setModoGlobal(false);
                      setBusqueda('');
                      setPaginaActual(1);
                      cargarEstudiantesPagina('inicial');
                    }}
                    className="bg-gray-500 hover:bg-gray-600 text-white font-semibold py-2 px-4 rounded-lg"
                  >
                    Volver a Paginación
                  </button>
                )}
              </div>
            </div>

            {modoGlobal && (
              <div className="mb-4">
                <input
                  type="text"
                  value={busqueda}
                  onChange={(e) => setBusqueda(e.target.value)}
                  placeholder="Buscar por nombre, teléfono o correo..."
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                />
              </div>
            )}
            
            {loading ? (
              <p className="text-center py-12 text-gray-600">Cargando...</p>
            ) : estudiantesPaginados.length === 0 ? (
              <p className="text-center py-12 text-gray-600">{modoGlobal && busqueda ? 'No se encontraron resultados' : 'No hay estudiantes en este curso'}</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-100">
                    <tr>
                      <th className="px-4 py-3 text-left text-sm font-semibold">#</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold">Nombre</th>
                      <th className="px-4 py-3 text-center text-sm font-semibold">Clase 1</th>
                      <th className="px-4 py-3 text-center text-sm font-semibold">Clase 2</th>
                      <th className="px-4 py-3 text-center text-sm font-semibold">Clase 3</th>
                      <th className="px-4 py-3 text-center text-sm font-semibold">Clase 4</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold">Nota</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold">Observaciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {estudiantesPaginados.map((est, idx) => {
                      const asist = asistencias[est.id];
                      return (
                        <tr key={est.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 text-sm">{idx + 1}</td>
                          <td className="px-4 py-3 text-sm font-medium">{est.nombreApellido}</td>
                          <td className="px-4 py-3 text-center">
                            <button onClick={() => toggleAsistencia(est.id, 'clase1')}>
                              {asist?.clase1 ? <CheckSquare className="text-green-600" size={24} /> : <Square className="text-gray-400" size={24} />}
                            </button>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <button onClick={() => toggleAsistencia(est.id, 'clase2')}>
                              {asist?.clase2 ? <CheckSquare className="text-green-600" size={24} /> : <Square className="text-gray-400" size={24} />}
                            </button>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <button onClick={() => toggleAsistencia(est.id, 'clase3')}>
                              {asist?.clase3 ? <CheckSquare className="text-green-600" size={24} /> : <Square className="text-gray-400" size={24} />}
                            </button>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <button onClick={() => toggleAsistencia(est.id, 'clase4')}>
                              {asist?.clase4 ? <CheckSquare className="text-green-600" size={24} /> : <Square className="text-gray-400" size={24} />}
                            </button>
                          </td>
                          <td className="px-4 py-3">
                            <input
                              type="number"
                              min="0"
                              max="100"
                              value={asist?.notaFinal || ''}
                              onChange={(e) => {
                                const nota = parseInt(e.target.value);
                                if (!isNaN(nota)) {
                                  guardarNota(est.id, nota, asist?.observaciones || '');
                                }
                              }}
                              className="w-20 px-2 py-1 border rounded"
                              placeholder="0-100"
                            />
                          </td>
                          <td className="px-4 py-3">
                            <input
                              type="text"
                              value={asist?.observaciones || ''}
                              onChange={(e) => {
                                guardarNota(est.id, asist?.notaFinal || 0, e.target.value);
                              }}
                              className="w-full px-2 py-1 border rounded"
                              placeholder="Observaciones"
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {!modoGlobal && (
              <div className="flex justify-between items-center mt-4 pt-4 border-t border-gray-200">
                <button
                  onClick={() => {
                    cargarEstudiantesPagina('anterior');
                    setPaginaActual(p => Math.max(1, p - 1));
                  }}
                  disabled={paginaActual === 1 || loading}
                  className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Anterior
                </button>
                <span className="text-gray-700">
                  Página {paginaActual} de {totalPaginas} • Total: {totalEstudiantes} estudiantes
                </span>
                <button
                  onClick={() => {
                    cargarEstudiantesPagina('siguiente');
                    setPaginaActual(p => p + 1);
                  }}
                  disabled={paginaActual >= totalPaginas || loading}
                  className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Siguiente
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
