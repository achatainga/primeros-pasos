import { useState, useEffect } from 'react';
import { collection, getDocs, deleteDoc, doc, addDoc, updateDoc, Timestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { UploadClient } from '@uploadcare/upload-client';
import { toast } from 'react-toastify';
import { Lock, Users, BookOpen, Trash2, Edit2, Save, X, Plus, Upload, Mail } from 'lucide-react';
import emailjs from '@emailjs/browser';

interface Estudiante {
  id: string;
  nombreApellido: string;
  telefono: string;
  correo: string;
  fechaNacimiento: string;
  tiempoMinisterio: string;
  cursoId: string;
  fechaRegistro: any;
}

interface Curso {
  id: string;
  nombre: string;
  fechaInicio: string;
  hora: string;
  estado: 'abierto' | 'cerrado';
  materiales: Array<{url: string; name: string}>;
  profesorId?: string;
  profesorNombre?: string;
}

interface EditingCurso {
  id: string;
  nombre: string;
  fechaInicio: string;
  hora: string;
  profesorId?: string;
}

interface Profesor {
  id: string;
  nombre: string;
  telefono: string;
  email: string;
  password: string;
}

export default function Admin() {
  const [password, setPassword] = useState('');
  const [authenticated, setAuthenticated] = useState(false);
  const [estudiantes, setEstudiantes] = useState<Estudiante[]>([]);
  const [cursos, setCursos] = useState<Curso[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editData, setEditData] = useState<Partial<Estudiante>>({});
  const [showCursoForm, setShowCursoForm] = useState(false);
  const [cursoForm, setCursoForm] = useState({
    nombre: '',
    fechaInicio: '',
    hora: '',
    estado: 'abierto' as 'abierto' | 'cerrado'
  });
  const [uploadingFile, setUploadingFile] = useState(false);
  const [editingCurso, setEditingCurso] = useState<EditingCurso | null>(null);
  const [profesores, setProfesores] = useState<Profesor[]>([]);
  const [profesorSeleccionado, setProfesorSeleccionado] = useState('');
  const [showProfesorForm, setShowProfesorForm] = useState(false);
  const [profesorForm, setProfesorForm] = useState({ nombre: '', telefono: '', email: '', password: '' });
  const [editingProfesor, setEditingProfesor] = useState<string | null>(null);
  const [cursoDefaultId, setCursoDefaultId] = useState('');
  const [configId, setConfigId] = useState('');
  const [showReasignarModal, setShowReasignarModal] = useState(false);
  const [estudianteReasignar, setEstudianteReasignar] = useState<Estudiante | null>(null);
  const [cursoDestinoId, setCursoDestinoId] = useState('');
  const [seleccionMultiple, setSeleccionMultiple] = useState<string[]>([]);
  const [modoSeleccion, setModoSeleccion] = useState(false);

  const ADMIN_PASSWORD = 'PrimerosPasos2026';

  useEffect(() => {
    if (authenticated) {
      cargarDatos();
    }
  }, [authenticated]);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (password === ADMIN_PASSWORD) {
      setAuthenticated(true);
      toast.success('Acceso concedido');
    } else {
      toast.error('Contraseña incorrecta');
    }
  };

  const cargarDatos = async () => {
    setLoading(true);
    try {
      const [estudiantesSnap, cursosSnap, profesoresSnap, configSnap] = await Promise.all([
        getDocs(collection(db, 'estudiantes')),
        getDocs(collection(db, 'cursos')),
        getDocs(collection(db, 'contactoProfesor')),
        getDocs(collection(db, 'config'))
      ]);
      
      setEstudiantes(estudiantesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Estudiante[]);
      setCursos(cursosSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Curso[]);
      setProfesores(profesoresSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Profesor[]);
      
      if (configSnap.docs.length > 0) {
        const config = configSnap.docs[0];
        setConfigId(config.id);
        setCursoDefaultId(config.data().cursoDefaultId || '');
      }
    } catch (error) {
      console.error('Error al cargar datos:', error);
      toast.error('Error al cargar datos');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteEstudiante = async (id: string, nombre: string) => {
    if (confirm(`¿Eliminar estudiante ${nombre}?`)) {
      try {
        await deleteDoc(doc(db, 'estudiantes', id));
        toast.success('Estudiante eliminado');
        cargarDatos();
      } catch (error) {
        console.error('Error:', error);
        toast.error('Error al eliminar');
      }
    }
  };

  const startEdit = (estudiante: Estudiante) => {
    setEditingId(estudiante.id);
    setEditData(estudiante);
  };

  const saveEdit = async () => {
    if (!editingId) return;
    try {
      await updateDoc(doc(db, 'estudiantes', editingId), editData);
      toast.success('Estudiante actualizado');
      setEditingId(null);
      setEditData({});
      cargarDatos();
    } catch (error) {
      console.error('Error:', error);
      toast.error('Error al actualizar');
    }
  };

  const handleCreateCurso = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profesorSeleccionado) {
      toast.error('Selecciona un profesor');
      return;
    }
    const profesor = profesores.find(p => p.id === profesorSeleccionado);
    try {
      await addDoc(collection(db, 'cursos'), {
        ...cursoForm,
        materiales: [],
        profesorId: profesorSeleccionado,
        profesorNombre: profesor?.nombre || '',
        fechaCreacion: Timestamp.now()
      });
      toast.success('Curso creado');
      setShowCursoForm(false);
      setCursoForm({ nombre: '', fechaInicio: '', hora: '', estado: 'abierto' });
      setProfesorSeleccionado('');
      cargarDatos();
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
        cargarDatos();
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
      cargarDatos();
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
        cargarDatos();
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
    const profesor = profesores.find(p => p.id === editingCurso.profesorId);
    try {
      await updateDoc(doc(db, 'cursos', editingCurso.id), {
        nombre: editingCurso.nombre,
        fechaInicio: editingCurso.fechaInicio,
        hora: editingCurso.hora,
        profesorId: editingCurso.profesorId,
        profesorNombre: profesor?.nombre || ''
      });
      toast.success('Curso actualizado');
      setEditingCurso(null);
      cargarDatos();
    } catch (error) {
      console.error('Error:', error);
      toast.error('Error al actualizar curso');
    }
  };

  const enviarEmailPrueba = async () => {
    try {
      await emailjs.send(
        import.meta.env.VITE_EMAILJS_SERVICE_ID || '',
        import.meta.env.VITE_EMAILJS_TEMPLATE_ID || '',
        {
          to_email: 'admin@test.com',
          student_name: 'Estudiante de Prueba',
          course_name: 'Curso de Prueba',
          course_date: '15/03/2025',
          course_hour: '7:00 PM',
          message: 'Este es un email de prueba desde el panel de administración'
        },
        import.meta.env.VITE_EMAILJS_PUBLIC_KEY || ''
      );
      toast.success('Email de prueba enviado');
    } catch (error) {
      console.error('Error:', error);
      toast.error('Error al enviar email. Verifica la configuración de EmailJS');
    }
  };

  const handleCreateProfesor = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await addDoc(collection(db, 'contactoProfesor'), profesorForm);
      toast.success('Profesor creado');
      setShowProfesorForm(false);
      setProfesorForm({ nombre: '', telefono: '', email: '', password: '' });
      cargarDatos();
    } catch (error) {
      console.error('Error:', error);
      toast.error('Error al crear profesor');
    }
  };

  const handleUpdateProfesor = async () => {
    if (!editingProfesor) return;
    try {
      await updateDoc(doc(db, 'contactoProfesor', editingProfesor), profesorForm);
      toast.success('Profesor actualizado');
      setEditingProfesor(null);
      setProfesorForm({ nombre: '', telefono: '', email: '', password: '' });
      cargarDatos();
    } catch (error) {
      console.error('Error:', error);
      toast.error('Error al actualizar profesor');
    }
  };

  const handleDeleteProfesor = async (id: string, nombre: string) => {
    if (confirm(`¿Eliminar profesor ${nombre}?`)) {
      try {
        await deleteDoc(doc(db, 'contactoProfesor', id));
        toast.success('Profesor eliminado');
        cargarDatos();
      } catch (error) {
        console.error('Error:', error);
        toast.error('Error al eliminar profesor');
      }
    }
  };

  const handleSaveCursoDefault = async () => {
    try {
      if (configId) {
        await updateDoc(doc(db, 'config', configId), { cursoDefaultId });
      } else {
        const docRef = await addDoc(collection(db, 'config'), { cursoDefaultId });
        setConfigId(docRef.id);
      }
      toast.success('Curso por defecto actualizado');
    } catch (error) {
      console.error('Error:', error);
      toast.error('Error al guardar configuración');
    }
  };

  const handleReasignarEstudiante = async () => {
    if (!estudianteReasignar || !cursoDestinoId) {
      toast.error('Selecciona un curso destino');
      return;
    }
    
    try {
      // Crear nuevo registro de estudiante con el nuevo curso
      await addDoc(collection(db, 'estudiantes'), {
        nombreApellido: estudianteReasignar.nombreApellido,
        telefono: estudianteReasignar.telefono,
        correo: estudianteReasignar.correo,
        fechaNacimiento: estudianteReasignar.fechaNacimiento,
        tiempoMinisterio: estudianteReasignar.tiempoMinisterio,
        cursoId: cursoDestinoId,
        fechaRegistro: Timestamp.now()
      });
      
      toast.success(`${estudianteReasignar.nombreApellido} asignado al nuevo curso`);
      setShowReasignarModal(false);
      setEstudianteReasignar(null);
      setCursoDestinoId('');
      cargarDatos();
    } catch (error) {
      console.error('Error:', error);
      toast.error('Error al reasignar estudiante');
    }
  };

  const toggleSeleccion = (estudianteId: string) => {
    setSeleccionMultiple(prev => 
      prev.includes(estudianteId) 
        ? prev.filter(id => id !== estudianteId)
        : [...prev, estudianteId]
    );
  };

  const seleccionarTodos = () => {
    if (seleccionMultiple.length === estudiantes.length) {
      setSeleccionMultiple([]);
    } else {
      setSeleccionMultiple(estudiantes.map(e => e.id));
    }
  };

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
      
      for (const est of estudiantesSeleccionados) {
        await addDoc(collection(db, 'estudiantes'), {
          nombreApellido: est.nombreApellido,
          telefono: est.telefono,
          correo: est.correo,
          fechaNacimiento: est.fechaNacimiento,
          tiempoMinisterio: est.tiempoMinisterio,
          cursoId: cursoDestinoId,
          fechaRegistro: Timestamp.now()
        });
      }
      
      toast.success(`${seleccionMultiple.length} estudiante(s) reasignado(s)`);
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

  const getCursosEstudiante = (estudianteNombre: string, estudianteCorreo: string) => {
    return estudiantes
      .filter(e => e.nombreApellido === estudianteNombre && e.correo === estudianteCorreo)
      .map(e => {
        const curso = cursos.find(c => c.id === e.cursoId);
        return curso ? curso.nombre.substring(0, 15) : 'N/A';
      });
  };

  if (!authenticated) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-8">
          <div className="text-center mb-8">
            <Lock className="mx-auto mb-4 text-amber-500" size={48} />
            <h1 className="text-2xl font-bold text-white">Panel de Administración</h1>
            <p className="text-slate-400 mt-2">Ingresa la contraseña</p>
          </div>
          <form onSubmit={handleLogin}>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Contraseña"
              className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-white focus:ring-2 focus:ring-amber-500 focus:border-transparent mb-4"
            />
            <button
              type="submit"
              className="w-full bg-amber-500 hover:bg-amber-600 text-slate-900 font-bold py-3 px-6 rounded-lg transition-colors"
            >
              Ingresar
            </button>
          </form>
          <p className="text-center text-sm text-slate-500 mt-6">
            <a href="/" className="text-amber-500 hover:underline">Volver al registro</a>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-lg p-6 mb-6">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold text-white">Panel de Administración</h1>
              <p className="text-slate-400 mt-1">Primeros Pasos</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={enviarEmailPrueba}
                className="bg-amber-500 hover:bg-amber-600 text-slate-900 font-semibold py-2 px-4 rounded-lg flex items-center gap-2"
              >
                <Mail size={20} />
                Enviar Email Prueba
              </button>
              <a href="/" className="bg-slate-800 hover:bg-slate-700 text-white font-semibold py-2 px-4 rounded-lg border border-slate-700">
                Volver al Registro
              </a>
            </div>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-lg p-6 mb-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-2xl font-bold text-white flex items-center gap-2">
              <BookOpen size={24} className="text-amber-500" />
              Configuración
            </h2>
          </div>
          <div className="bg-slate-800 p-4 rounded-lg mb-4">
            <label className="block text-sm font-semibold text-slate-300 mb-2">Curso por Defecto (Registro)</label>
            <div className="flex gap-2">
              <select
                value={cursoDefaultId}
                onChange={(e) => setCursoDefaultId(e.target.value)}
                className="flex-1 px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white"
              >
                <option value="">Ninguno (último curso)</option>
                {cursos.map(curso => (
                  <option key={curso.id} value={curso.id}>{curso.nombre}</option>
                ))}
              </select>
              <button
                onClick={handleSaveCursoDefault}
                className="bg-amber-500 hover:bg-amber-600 text-slate-900 font-semibold py-2 px-4 rounded-lg flex items-center gap-2"
              >
                <Save size={20} />
                Guardar
              </button>
            </div>
            <p className="text-xs text-slate-400 mt-2">Este curso se seleccionará automáticamente en el formulario de registro</p>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-lg p-6 mb-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-2xl font-bold text-white flex items-center gap-2">
              <BookOpen size={24} className="text-amber-500" />
              Cursos
            </h2>
            <button
              onClick={() => setShowCursoForm(!showCursoForm)}
              className="bg-amber-500 hover:bg-amber-600 text-slate-900 font-semibold py-2 px-4 rounded-lg flex items-center gap-2"
            >
              <Plus size={20} />
              Nuevo Curso
            </button>
          </div>

          {showCursoForm && (
            <form onSubmit={handleCreateCurso} className="bg-slate-800 p-4 rounded-lg mb-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <input
                  type="text"
                  required
                  value={cursoForm.nombre}
                  onChange={(e) => setCursoForm({...cursoForm, nombre: e.target.value})}
                  placeholder="Nombre del curso"
                  className="px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white"
                />
                <input
                  type="date"
                  required
                  value={cursoForm.fechaInicio}
                  onChange={(e) => setCursoForm({...cursoForm, fechaInicio: e.target.value})}
                  className="px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white"
                />
                <input
                  type="time"
                  required
                  value={cursoForm.hora}
                  onChange={(e) => setCursoForm({...cursoForm, hora: e.target.value})}
                  className="px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white"
                />
                <select
                  value={cursoForm.estado}
                  onChange={(e) => setCursoForm({...cursoForm, estado: e.target.value as 'abierto' | 'cerrado'})}
                  className="px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white"
                >
                  <option value="abierto">Abierto</option>
                  <option value="cerrado">Cerrado</option>
                </select>
                <select
                  required
                  value={profesorSeleccionado}
                  onChange={(e) => setProfesorSeleccionado(e.target.value)}
                  className="px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white md:col-span-2"
                >
                  <option value="">Seleccionar Profesor</option>
                  {profesores.map(prof => (
                    <option key={prof.id} value={prof.id}>{prof.nombre}</option>
                  ))}
                </select>
              </div>
              <div className="flex gap-2 mt-4">
                <button type="submit" className="bg-amber-500 hover:bg-amber-600 text-slate-900 py-2 px-4 rounded-lg">
                  Crear Curso
                </button>
                <button
                  type="button"
                  onClick={() => setShowCursoForm(false)}
                  className="bg-slate-700 hover:bg-slate-600 text-white py-2 px-4 rounded-lg"
                >
                  Cancelar
                </button>
              </div>
            </form>
          )}

          <div className="grid gap-4">
            {cursos.map(curso => (
              <div key={curso.id} className="border border-slate-700 rounded-lg p-4 bg-slate-800">
                {editingCurso?.id === curso.id ? (
                  <div className="space-y-3">
                    <input
                      type="text"
                      value={editingCurso.nombre}
                      onChange={(e) => setEditingCurso({...editingCurso, nombre: e.target.value})}
                      className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white"
                      placeholder="Nombre del curso"
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="date"
                        value={editingCurso.fechaInicio}
                        onChange={(e) => setEditingCurso({...editingCurso, fechaInicio: e.target.value})}
                        className="px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white"
                      />
                      <input
                        type="time"
                        value={editingCurso.hora}
                        onChange={(e) => setEditingCurso({...editingCurso, hora: e.target.value})}
                        className="px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white"
                      />
                    </div>
                    <select
                      value={editingCurso.profesorId || ''}
                      onChange={(e) => setEditingCurso({...editingCurso, profesorId: e.target.value})}
                      className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white"
                    >
                      <option value="">Seleccionar Profesor</option>
                      {profesores.map(prof => (
                        <option key={prof.id} value={prof.id}>{prof.nombre}</option>
                      ))}
                    </select>
                    <div className="flex gap-2">
                      <button onClick={handleEditCurso} className="bg-amber-500 hover:bg-amber-600 text-slate-900 px-4 py-2 rounded-lg">
                        Guardar
                      </button>
                      <button onClick={() => setEditingCurso(null)} className="bg-slate-700 hover:bg-slate-600 text-white px-4 py-2 rounded-lg">
                        Cancelar
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <h3 className="font-bold text-lg text-white">{curso.nombre}</h3>
                        <p className="text-sm text-slate-400">Inicio: {curso.fechaInicio} - {curso.hora}</p>
                        {curso.profesorNombre && (
                          <p className="text-sm text-amber-400 mt-1">Profesor: {curso.profesorNombre}</p>
                        )}
                        <span className={`inline-block px-3 py-1 text-xs font-semibold rounded-full mt-2 ${
                          curso.estado === 'abierto' ? 'bg-green-500/20 text-green-300 border border-green-500/30' : 'bg-red-500/20 text-red-300 border border-red-500/30'
                        }`}>
                          {curso.estado === 'abierto' ? 'Abierto' : 'Cerrado'}
                        </span>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => setEditingCurso({id: curso.id, nombre: curso.nombre, fechaInicio: curso.fechaInicio, hora: curso.hora, profesorId: curso.profesorId})}
                          className="bg-blue-500 hover:bg-blue-600 text-white p-2 rounded-lg"
                          title="Editar curso"
                        >
                          <Edit2 size={18} />
                        </button>
                        <button
                          onClick={() => toggleEstadoCurso(curso.id, curso.estado)}
                          className="bg-yellow-500 hover:bg-yellow-600 text-slate-900 p-2 rounded-lg"
                          title="Cambiar estado"
                        >
                          {curso.estado === 'abierto' ? 'Cerrar' : 'Abrir'}
                        </button>
                        <label className="bg-amber-500 hover:bg-amber-600 text-slate-900 p-2 rounded-lg cursor-pointer">
                          <Upload size={18} />
                          <input
                            type="file"
                            className="hidden"
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
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </div>
                    {curso.materiales?.length > 0 && (
                      <div className="mt-4 space-y-2">
                        <p className="text-sm font-semibold text-slate-300">Materiales ({curso.materiales.length}):</p>
                        {curso.materiales.map((material, idx) => (
                          <div key={idx} className="flex items-center justify-between bg-slate-700 p-2 rounded border border-slate-600">
                            <a href={material.url} target="_blank" rel="noopener noreferrer" className="text-sm text-amber-400 hover:underline truncate flex-1">
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
                                    cargarDatos();
                                  } catch (error) {
                                    console.error('Error:', error);
                                    toast.error('Error al eliminar material');
                                  }
                                }
                              }}
                              className="text-red-400 hover:text-red-300 ml-2"
                            >
                              <Trash2 size={16} />
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

        <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-lg p-6 mb-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-2xl font-bold text-white">Profesores ({profesores.length})</h2>
            <button
              onClick={() => setShowProfesorForm(!showProfesorForm)}
              className="bg-amber-500 hover:bg-amber-600 text-slate-900 font-semibold py-2 px-4 rounded-lg flex items-center gap-2"
            >
              <Plus size={20} />
              Nuevo Profesor
            </button>
          </div>

          {showProfesorForm && (
            <form onSubmit={editingProfesor ? (e) => { e.preventDefault(); handleUpdateProfesor(); } : handleCreateProfesor} className="bg-slate-800 p-4 rounded-lg mb-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <input
                  type="text"
                  required
                  value={profesorForm.nombre}
                  onChange={(e) => setProfesorForm({...profesorForm, nombre: e.target.value})}
                  placeholder="Nombre completo"
                  className="px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white"
                />
                <input
                  type="tel"
                  value={profesorForm.telefono}
                  onChange={(e) => setProfesorForm({...profesorForm, telefono: e.target.value})}
                  placeholder="Teléfono (opcional)"
                  className="px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white"
                />
                <input
                  type="email"
                  value={profesorForm.email}
                  onChange={(e) => setProfesorForm({...profesorForm, email: e.target.value})}
                  placeholder="Email (opcional)"
                  className="px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white"
                />
                <input
                  type="text"
                  required
                  value={profesorForm.password}
                  onChange={(e) => setProfesorForm({...profesorForm, password: e.target.value})}
                  placeholder="Contraseña"
                  className="px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white"
                />
              </div>
              <div className="flex gap-2 mt-4">
                <button type="submit" className="bg-amber-500 hover:bg-amber-600 text-slate-900 py-2 px-4 rounded-lg">
                  {editingProfesor ? 'Actualizar' : 'Crear'} Profesor
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowProfesorForm(false);
                    setEditingProfesor(null);
                    setProfesorForm({ nombre: '', telefono: '', email: '', password: '' });
                  }}
                  className="bg-slate-700 hover:bg-slate-600 text-white py-2 px-4 rounded-lg"
                >
                  Cancelar
                </button>
              </div>
            </form>
          )}

          <div className="grid gap-3">
            {profesores.map(prof => (
              <div key={prof.id} className="border border-slate-700 rounded-lg p-4 bg-slate-800 flex justify-between items-center">
                <div>
                  <h3 className="font-bold text-white">{prof.nombre}</h3>
                  <p className="text-sm text-slate-400">{prof.telefono} • {prof.email}</p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setEditingProfesor(prof.id);
                      setProfesorForm({ nombre: prof.nombre, telefono: prof.telefono, email: prof.email, password: prof.password || '' });
                      setShowProfesorForm(true);
                    }}
                    className="text-amber-400 hover:text-amber-300"
                  >
                    <Edit2 size={18} />
                  </button>
                  <button
                    onClick={() => handleDeleteProfesor(prof.id, prof.nombre)}
                    className="text-red-400 hover:text-red-300"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-lg p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-2xl font-bold text-white flex items-center gap-2">
              <Users size={24} className="text-amber-500" />
              Estudiantes ({estudiantes.length})
            </h2>
            <div className="flex gap-2">
              {modoSeleccion && (
                <>
                  <button
                    onClick={seleccionarTodos}
                    className="bg-blue-500 hover:bg-blue-600 text-white font-semibold py-2 px-4 rounded-lg"
                  >
                    {seleccionMultiple.length === estudiantes.length ? 'Deseleccionar Todos' : 'Seleccionar Todos'}
                  </button>
                  <button
                    onClick={() => {
                      if (seleccionMultiple.length > 0) {
                        setShowReasignarModal(true);
                      } else {
                        toast.error('Selecciona al menos un estudiante');
                      }
                    }}
                    disabled={seleccionMultiple.length === 0}
                    className="bg-amber-500 hover:bg-amber-600 text-slate-900 font-semibold py-2 px-4 rounded-lg disabled:opacity-50 flex items-center gap-2"
                  >
                    <BookOpen size={20} />
                    Reasignar ({seleccionMultiple.length})
                  </button>
                </>
              )}
              <button
                onClick={() => {
                  setModoSeleccion(!modoSeleccion);
                  setSeleccionMultiple([]);
                }}
                className={`font-semibold py-2 px-4 rounded-lg flex items-center gap-2 ${
                  modoSeleccion 
                    ? 'bg-red-500 hover:bg-red-600 text-white' 
                    : 'bg-green-500 hover:bg-green-600 text-white'
                }`}
              >
                {modoSeleccion ? 'Cancelar Selección' : 'Selección Múltiple'}
              </button>
            </div>
          </div>

          {loading ? (
            <p className="text-center py-12 text-slate-400">Cargando...</p>
          ) : estudiantes.length === 0 ? (
            <p className="text-center py-12 text-slate-400">No hay estudiantes registrados</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-800/50 border-b border-slate-700">
                  <tr>
                    {modoSeleccion && (
                      <th className="px-4 py-3 text-center text-sm font-semibold text-slate-300">
                        <input
                          type="checkbox"
                          checked={seleccionMultiple.length === estudiantes.length && estudiantes.length > 0}
                          onChange={seleccionarTodos}
                          className="w-4 h-4 cursor-pointer"
                        />
                      </th>
                    )}
                    <th className="px-4 py-3 text-left text-sm font-semibold text-slate-300">#</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-slate-300">Nombre</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-slate-300">Teléfono</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-slate-300">Correo</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-slate-300">Tiempo Ministerio</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-slate-300">Cursos</th>
                    {!modoSeleccion && (
                      <th className="px-4 py-3 text-left text-sm font-semibold text-slate-300">Acciones</th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {estudiantes.map((est, idx) => {
                    const cursosEst = getCursosEstudiante(est.nombreApellido, est.correo);
                    return (
                      <tr key={est.id} className={`hover:bg-slate-800/30 ${
                        seleccionMultiple.includes(est.id) ? 'bg-blue-500/10' : ''
                      }`}>
                        {modoSeleccion && (
                          <td className="px-4 py-3 text-center">
                            <input
                              type="checkbox"
                              checked={seleccionMultiple.includes(est.id)}
                              onChange={() => toggleSeleccion(est.id)}
                              className="w-4 h-4 cursor-pointer"
                            />
                          </td>
                        )}
                        <td className="px-4 py-3 text-sm text-slate-400">{idx + 1}</td>
                      <td className="px-4 py-3 text-sm text-white">
                        {editingId === est.id ? (
                          <input
                            type="text"
                            value={editData.nombreApellido || ''}
                            onChange={(e) => setEditData({...editData, nombreApellido: e.target.value})}
                            className="px-2 py-1 bg-slate-800 border border-slate-700 rounded w-full text-white"
                          />
                        ) : est.nombreApellido}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-400">
                        {editingId === est.id ? (
                          <input
                            type="tel"
                            value={editData.telefono || ''}
                            onChange={(e) => setEditData({...editData, telefono: e.target.value})}
                            className="px-2 py-1 bg-slate-800 border border-slate-700 rounded w-full text-white"
                          />
                        ) : est.telefono}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-400">
                        {editingId === est.id ? (
                          <input
                            type="email"
                            value={editData.correo || ''}
                            onChange={(e) => setEditData({...editData, correo: e.target.value})}
                            className="px-2 py-1 bg-slate-800 border border-slate-700 rounded w-full text-white"
                          />
                        ) : est.correo}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-400">{est.tiempoMinisterio}</td>
                      <td className="px-4 py-3 text-sm">
                        <div className="flex flex-wrap gap-1">
                          {cursosEst.map((curso, i) => (
                            <span key={i} className="inline-block px-2 py-1 text-xs bg-amber-500/20 text-amber-300 rounded border border-amber-500/30">
                              {curso}
                            </span>
                          ))}
                        </div>
                      </td>
                      {!modoSeleccion && (
                        <td className="px-4 py-3">
                          <div className="flex gap-2">
                            {editingId === est.id ? (
                              <>
                                <button onClick={saveEdit} className="text-green-400 hover:text-green-300" title="Guardar">
                                  <Save size={18} />
                                </button>
                                <button onClick={() => {setEditingId(null); setEditData({});}} className="text-slate-400 hover:text-slate-300" title="Cancelar">
                                  <X size={18} />
                                </button>
                              </>
                            ) : (
                              <>
                                <button onClick={() => startEdit(est)} className="text-amber-400 hover:text-amber-300" title="Editar">
                                  <Edit2 size={18} />
                                </button>
                                <button 
                                  onClick={() => {
                                    setEstudianteReasignar(est);
                                    setShowReasignarModal(true);
                                  }} 
                                  className="text-blue-400 hover:text-blue-300"
                                  title="Reasignar a otro curso"
                                >
                                  <BookOpen size={18} />
                                </button>
                                <button onClick={() => handleDeleteEstudiante(est.id, est.nombreApellido)} className="text-red-400 hover:text-red-300" title="Eliminar">
                                  <Trash2 size={18} />
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      )}
                    </tr>
                  );})}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {showReasignarModal && (estudianteReasignar || seleccionMultiple.length > 0) && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-6 max-w-md w-full">
            <h3 className="text-xl font-bold text-white mb-4">Reasignar Estudiante{seleccionMultiple.length > 1 ? 's' : ''}</h3>
            <div className="mb-4">
              {estudianteReasignar ? (
                <>
                  <p className="text-slate-300 mb-2"><strong>Estudiante:</strong> {estudianteReasignar.nombreApellido}</p>
                  <p className="text-slate-400 text-sm mb-4">Curso actual: {cursos.find(c => c.id === estudianteReasignar.cursoId)?.nombre || 'N/A'}</p>
                </>
              ) : (
                <p className="text-slate-300 mb-4"><strong>{seleccionMultiple.length}</strong> estudiante(s) seleccionado(s)</p>
              )}
              
              <label className="block text-sm font-semibold text-slate-300 mb-2">Seleccionar Curso Destino</label>
              <select
                value={cursoDestinoId}
                onChange={(e) => setCursoDestinoId(e.target.value)}
                className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white"
              >
                <option value="">-- Seleccionar Curso --</option>
                {cursos.filter(c => !estudianteReasignar || c.id !== estudianteReasignar.cursoId).map(curso => (
                  <option key={curso.id} value={curso.id}>{curso.nombre}</option>
                ))}
              </select>
              <p className="text-xs text-slate-400 mt-2">Se creará un nuevo registro con asistencia y notas en blanco</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={estudianteReasignar ? handleReasignarEstudiante : handleReasignarMultiple}
                disabled={!cursoDestinoId}
                className="flex-1 bg-amber-500 hover:bg-amber-600 text-slate-900 font-semibold py-2 px-4 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Reasignar
              </button>
              <button
                onClick={() => {
                  setShowReasignarModal(false);
                  setEstudianteReasignar(null);
                  setCursoDestinoId('');
                }}
                className="flex-1 bg-slate-700 hover:bg-slate-600 text-white font-semibold py-2 px-4 rounded-lg"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
