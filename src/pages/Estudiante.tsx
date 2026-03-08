import { useState, useEffect } from 'react';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { toast } from 'react-toastify';
import { User, BookOpen, CheckCircle, XCircle, Download } from 'lucide-react';

interface Estudiante {
  id: string;
  nombreApellido: string;
  correo: string;
  cursoId: string;
}

interface Curso {
  id: string;
  nombre: string;
  fechaInicio: string;
  hora: string;
  materiales: string[];
  profesorId?: string;
  profesorNombre?: string;
}

interface Asistencia {
  clase1: boolean;
  clase2: boolean;
  clase3: boolean;
  clase4: boolean;
  notaFinal?: number;
  observaciones?: string;
}

export default function Estudiante() {
  const [correo, setCorreo] = useState('');
  const [authenticated, setAuthenticated] = useState(false);
  const [estudiante, setEstudiante] = useState<Estudiante | null>(null);
  const [curso, setCurso] = useState<Curso | null>(null);
  const [asistencia, setAsistencia] = useState<Asistencia | null>(null);
  const [loading, setLoading] = useState(false);
  const [contactoProfesor, setContactoProfesor] = useState<any>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const emailParam = params.get('email');
    if (emailParam) {
      setCorreo(emailParam);
      handleAutoLogin(emailParam);
    }
  }, []);

  const handleAutoLogin = async (email: string) => {
    setLoading(true);
    try {
      const q = query(collection(db, 'estudiantes'), where('correo', '==', email.toLowerCase().trim()));
      const snapshot = await getDocs(q);
      
      if (snapshot.empty) {
        toast.error('Correo no encontrado');
        return;
      }

      const estudianteData = { id: snapshot.docs[0].id, ...snapshot.docs[0].data() } as Estudiante;
      setEstudiante(estudianteData);
      setAuthenticated(true);
      
      const cursoDoc = await getDocs(query(collection(db, 'cursos'), where('__name__', '==', estudianteData.cursoId)));
      if (!cursoDoc.empty) {
        setCurso({ id: cursoDoc.docs[0].id, ...cursoDoc.docs[0].data() } as Curso);
      }

      const asistenciaDoc = await getDocs(
        query(collection(db, 'asistencias'), 
          where('estudianteId', '==', estudianteData.id),
          where('cursoId', '==', estudianteData.cursoId)
        )
      );
      if (!asistenciaDoc.empty) {
        setAsistencia(asistenciaDoc.docs[0].data() as Asistencia);
      }

      // Cargar contacto del profesor asignado al curso
      if (!cursoDoc.empty) {
        const cursoData = cursoDoc.docs[0].data();
        if (cursoData.profesorId) {
          const profesorDoc = await getDocs(
            query(collection(db, 'contactoProfesor'), where('__name__', '==', cursoData.profesorId))
          );
          if (!profesorDoc.empty) {
            setContactoProfesor(profesorDoc.docs[0].data());
          }
        }
      }
    } catch (error) {
      console.error('Error:', error);
      toast.error('Error al buscar estudiante');
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    handleAutoLogin(correo);
  };

  if (!authenticated) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-8">
          <div className="text-center mb-8">
            <User className="mx-auto mb-4 text-amber-500" size={48} />
            <h1 className="text-2xl font-bold text-white">Portal del Estudiante</h1>
            <p className="text-slate-400 mt-2">Ingresa tu correo</p>
          </div>
          <form onSubmit={handleLogin}>
            <input
              type="email"
              value={correo}
              onChange={(e) => setCorreo(e.target.value)}
              placeholder="tu@correo.com"
              required
              className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-white focus:ring-2 focus:ring-amber-500 focus:border-transparent mb-4"
            />
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-amber-500 hover:bg-amber-600 text-slate-900 font-bold py-3 px-6 rounded-lg transition-colors disabled:opacity-50"
            >
              {loading ? 'Buscando...' : 'Ingresar'}
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
      <div className="max-w-4xl mx-auto">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-lg p-6 mb-6">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold text-white">Bienvenido, {estudiante?.nombreApellido}</h1>
              <p className="text-slate-400 mt-1">Portal del Estudiante</p>
            </div>
            <a href="/" className="bg-slate-800 hover:bg-slate-700 text-white font-semibold py-2 px-4 rounded-lg border border-slate-700">
              Salir
            </a>
          </div>
        </div>

        {curso && (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-lg p-6 mb-6">
            <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-2">
              <BookOpen size={24} className="text-amber-500" />
              Mi Curso
            </h2>
            <div className="bg-gradient-to-r from-amber-500 to-amber-600 rounded-lg p-6 text-slate-900">
              <h3 className="text-2xl font-bold mb-3">{curso.nombre}</h3>
              <p className="text-lg"><strong>📅 Fecha:</strong> {curso.fechaInicio}</p>
              <p className="text-lg"><strong>🕐 Hora:</strong> {curso.hora}</p>
              {curso.profesorNombre && (
                <p className="text-lg mt-2"><strong>👨‍🏫 Profesor:</strong> {curso.profesorNombre}</p>
              )}
            </div>
          </div>
        )}

        {asistencia && (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-lg p-6 mb-6">
            <h2 className="text-2xl font-bold text-white mb-4">Mi Asistencia</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[1, 2, 3, 4].map(num => {
                const presente = asistencia[`clase${num}` as keyof Asistencia];
                return (
                  <div key={num} className={`p-4 rounded-lg border-2 ${presente ? 'bg-green-500/20 border-green-500' : 'bg-slate-800 border-slate-700'}`}>
                    <div className="flex items-center justify-between">
                      <span className="text-white font-semibold">Clase {num}</span>
                      {presente ? <CheckCircle className="text-green-400" size={24} /> : <XCircle className="text-slate-600" size={24} />}
                    </div>
                  </div>
                );
              })}
            </div>
            {asistencia.notaFinal !== undefined && (
              <div className="mt-6 p-4 bg-amber-500/20 border border-amber-500/30 rounded-lg">
                <p className="text-white text-lg"><strong>Nota Final:</strong> {asistencia.notaFinal}</p>
                {asistencia.observaciones && (
                  <p className="text-slate-300 mt-2"><strong>Observaciones:</strong> {asistencia.observaciones}</p>
                )}
              </div>
            )}
          </div>
        )}

        {curso?.materiales && curso.materiales.length > 0 && (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-lg p-6 mb-6">
            <h2 className="text-2xl font-bold text-white mb-4">Materiales del Curso</h2>
            <div className="space-y-3">
              {curso.materiales.map((url, idx) => {
                const fileName = url.split('/').pop() || `Material ${idx + 1}`;
                return (
                  <a
                    key={idx}
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 p-4 bg-slate-800 hover:bg-slate-700 rounded-lg border border-slate-700 transition-colors"
                  >
                    <Download className="text-amber-500" size={20} />
                    <span className="text-white">{fileName}</span>
                  </a>
                );
              })}
            </div>
          </div>
        )}

        {contactoProfesor && (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-lg p-6">
            <h2 className="text-2xl font-bold text-white mb-4">Contacto del Profesor</h2>
            <div className="bg-slate-800 p-4 rounded-lg space-y-2">
              <p className="text-white"><strong className="text-amber-500">Nombre:</strong> {contactoProfesor.nombre}</p>
              <p className="text-white"><strong className="text-amber-500">Teléfono:</strong> {contactoProfesor.telefono}</p>
              <p className="text-white"><strong className="text-amber-500">Email:</strong> {contactoProfesor.email}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
