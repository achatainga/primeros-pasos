import { useState, useEffect } from 'react';
import { collection, getDocs, deleteDoc, doc, addDoc, updateDoc, Timestamp } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../lib/firebase';
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
  materiales: string[];
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
      const [estudiantesSnap, cursosSnap] = await Promise.all([
        getDocs(collection(db, 'estudiantes')),
        getDocs(collection(db, 'cursos'))
      ]);
      
      setEstudiantes(estudiantesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Estudiante[]);
      setCursos(cursosSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Curso[]);
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
    try {
      await addDoc(collection(db, 'cursos'), {
        ...cursoForm,
        materiales: [],
        fechaCreacion: Timestamp.now()
      });
      toast.success('Curso creado');
      setShowCursoForm(false);
      setCursoForm({ nombre: '', fechaInicio: '', hora: '', estado: 'abierto' });
      cargarDatos();
    } catch (error) {
      console.error('Error:', error);
      toast.error('Error al crear curso');
    }
  };

  const handleUploadMaterial = async (cursoId: string, file: File) => {
    setUploadingFile(true);
    try {
      const storageRef = ref(storage, `materiales/${cursoId}/${file.name}`);
      await uploadBytes(storageRef, file);
      const url = await getDownloadURL(storageRef);
      
      const curso = cursos.find(c => c.id === cursoId);
      if (curso) {
        await updateDoc(doc(db, 'cursos', cursoId), {
          materiales: [...(curso.materiales || []), url]
        });
        toast.success('Material subido');
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
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-bold text-lg text-white">{curso.nombre}</h3>
                    <p className="text-sm text-slate-400">Inicio: {curso.fechaInicio} - {curso.hora}</p>
                    <span className={`inline-block px-3 py-1 text-xs font-semibold rounded-full mt-2 ${
                      curso.estado === 'abierto' ? 'bg-green-500/20 text-green-300 border border-green-500/30' : 'bg-red-500/20 text-red-300 border border-red-500/30'
                    }`}>
                      {curso.estado === 'abierto' ? 'Abierto' : 'Cerrado'}
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => toggleEstadoCurso(curso.id, curso.estado)}
                      className="bg-yellow-500 hover:bg-yellow-600 text-slate-900 p-2 rounded-lg"
                      title="Cambiar estado"
                    >
                      <Edit2 size={18} />
                    </button>
                    <label className="bg-amber-500 hover:bg-amber-600 text-slate-900 p-2 rounded-lg cursor-pointer">
                      <Upload size={18} />
                      <input
                        type="file"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handleUploadMaterial(curso.id, file);
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
                  <div className="mt-2">
                    <p className="text-sm font-semibold text-slate-300">Materiales: {curso.materiales.length}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-lg p-6">
          <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-2">
            <Users size={24} className="text-amber-500" />
            Estudiantes ({estudiantes.length})
          </h2>

          {loading ? (
            <p className="text-center py-12 text-slate-400">Cargando...</p>
          ) : estudiantes.length === 0 ? (
            <p className="text-center py-12 text-slate-400">No hay estudiantes registrados</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-800/50 border-b border-slate-700">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-slate-300">#</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-slate-300">Nombre</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-slate-300">Teléfono</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-slate-300">Correo</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-slate-300">Tiempo Ministerio</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-slate-300">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {estudiantes.map((est, idx) => (
                    <tr key={est.id} className="hover:bg-slate-800/30">
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
                      <td className="px-4 py-3">
                        <div className="flex gap-2">
                          {editingId === est.id ? (
                            <>
                              <button onClick={saveEdit} className="text-green-400 hover:text-green-300">
                                <Save size={18} />
                              </button>
                              <button onClick={() => {setEditingId(null); setEditData({});}} className="text-slate-400 hover:text-slate-300">
                                <X size={18} />
                              </button>
                            </>
                          ) : (
                            <>
                              <button onClick={() => startEdit(est)} className="text-amber-400 hover:text-amber-300">
                                <Edit2 size={18} />
                              </button>
                              <button onClick={() => handleDeleteEstudiante(est.id, est.nombreApellido)} className="text-red-400 hover:text-red-300">
                                <Trash2 size={18} />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
