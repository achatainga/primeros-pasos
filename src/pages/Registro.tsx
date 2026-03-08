import { useState, useEffect } from 'react';
import { collection, addDoc, getDocs, query, where, Timestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { toast } from 'react-toastify';
import { BookOpen, Download, Smartphone } from 'lucide-react';

interface Curso {
  id: string;
  nombre: string;
  fechaInicio: string;
  hora: string;
  estado: 'abierto' | 'cerrado';
  materiales: Array<{url: string; name: string}>;
}

export default function Registro() {
  const [formData, setFormData] = useState({
    nombreApellido: '',
    telefono: '',
    correo: '',
    fechaNacimiento: '',
    tiempoMinisterio: '',
    cursoId: ''
  });
  const [loading, setLoading] = useState(false);
  const [cursos, setCursos] = useState<Curso[]>([]);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

  useEffect(() => {
    const handler = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  useEffect(() => {
    cargarCursos();
  }, []);

  const cargarCursos = async () => {
    try {
      const q = query(collection(db, 'cursos'), where('estado', '==', 'abierto'));
      const snapshot = await getDocs(q);
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Curso[];
      setCursos(data);
    } catch (error) {
      console.error('Error al cargar cursos:', error);
    }
  };

  const handleInstallPWA = async () => {
    if (!deferredPrompt) {
      toast.info('La app ya está instalada o no está disponible para instalar');
      return;
    }
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      toast.success('App instalada exitosamente');
    }
    setDeferredPrompt(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      await addDoc(collection(db, 'estudiantes'), {
        ...formData,
        fechaRegistro: Timestamp.now()
      });

      toast.success('¡Registro exitoso! Te esperamos en el curso 📚');
      setFormData({
        nombreApellido: '',
        telefono: '',
        correo: '',
        fechaNacimiento: '',
        tiempoMinisterio: '',
        cursoId: ''
      });
    } catch (error) {
      console.error('Error al registrar:', error);
      toast.error('Error al registrar. Intenta nuevamente.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <div className="max-w-4xl w-full">
        <div className="bg-slate-900/95 rounded-2xl shadow-2xl p-8 mb-6 border border-slate-800">
          <div className="text-center mb-8">
            <BookOpen className="mx-auto mb-4 text-amber-500" size={48} />
            <h1 className="text-4xl font-bold text-amber-500 mb-2">Primeros Pasos</h1>
            <p className="text-slate-400">Alcance Victoria - Registro de Estudiantes</p>
            {deferredPrompt && (
              <button
                onClick={handleInstallPWA}
                className="mt-4 bg-amber-500 hover:bg-amber-600 text-slate-900 font-semibold py-2 px-4 rounded-lg flex items-center gap-2 mx-auto"
              >
                <Smartphone size={20} />
                Instalar App
              </button>
            )}
          </div>

          {cursos.length > 0 && (
            <div className="mb-8">
              <h2 className="text-xl font-bold text-amber-500 mb-4">Cursos Disponibles</h2>
              <div className="grid gap-4">
                {cursos.map(curso => (
                  <div key={curso.id} className="bg-slate-800 border border-slate-700 rounded-lg p-4">
                    <h3 className="font-bold text-white">{curso.nombre}</h3>
                    <p className="text-sm text-slate-400">Inicio: {curso.fechaInicio} - {curso.hora}</p>
                    {curso.materiales?.length > 0 && (
                      <div className="mt-2">
                        <p className="text-sm font-semibold text-slate-300">Materiales:</p>
                        {curso.materiales.map((material, idx) => (
                          <a
                            key={idx}
                            href={material.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-2 text-sm text-amber-500 hover:text-amber-400 mt-1"
                          >
                            <Download size={16} />
                            {material.name}
                          </a>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <input
                type="text"
                required
                value={formData.nombreApellido}
                onChange={(e) => setFormData({ ...formData, nombreApellido: e.target.value })}
                className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent text-white placeholder-slate-400"
                placeholder="Nombre y Apellido *"
              />
            </div>

            <div>
              <input
                type="tel"
                required
                value={formData.telefono}
                onChange={(e) => setFormData({ ...formData, telefono: e.target.value })}
                className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent text-white placeholder-slate-400"
                placeholder="Teléfono *"
              />
            </div>

            <div>
              <input
                type="email"
                required
                value={formData.correo}
                onChange={(e) => setFormData({ ...formData, correo: e.target.value })}
                className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent text-white placeholder-slate-400"
                placeholder="Correo Electrónico *"
              />
            </div>

            <div className="relative">
              <label className="absolute -top-2 left-3 bg-slate-800 px-2 text-xs text-slate-400 z-10">Fecha de Nacimiento *</label>
              <input
                type="date"
                required
                value={formData.fechaNacimiento}
                onChange={(e) => setFormData({ ...formData, fechaNacimiento: e.target.value })}
                className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent text-white"
              />
            </div>

            <div>
              <select
                required
                value={formData.tiempoMinisterio}
                onChange={(e) => setFormData({ ...formData, tiempoMinisterio: e.target.value })}
                className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent text-white"
              >
                <option value="">Tiempo en el Ministerio *</option>
                <option value="Menos de 6 meses">Menos de 6 meses</option>
                <option value="6 meses - 1 año">6 meses - 1 año</option>
                <option value="1-2 años">1-2 años</option>
                <option value="2-5 años">2-5 años</option>
                <option value="Más de 5 años">Más de 5 años</option>
              </select>
            </div>

            {cursos.length > 0 && (
              <div>
                <select
                  required
                  value={formData.cursoId}
                  onChange={(e) => setFormData({ ...formData, cursoId: e.target.value })}
                  className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent text-white"
                >
                  <option value="">Seleccionar Curso *</option>
                  {cursos.map(curso => (
                    <option key={curso.id} value={curso.id}>{curso.nombre}</option>
                  ))}
                </select>
              </div>
            )}

            <button
              type="submit"
              disabled={loading || cursos.length === 0}
              className="w-full bg-amber-500 hover:bg-amber-600 text-slate-900 font-semibold py-3 px-6 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Registrando...' : cursos.length === 0 ? 'No hay cursos disponibles' : 'Registrarme'}
            </button>
          </form>

          <p className="text-center text-sm text-slate-400 mt-6">
            ¿Eres administrador o profesor?{' '}
            <a href="/admin" className="text-amber-500 hover:underline">
              Panel Admin
            </a>
            {' / '}
            <a href="/profesor" className="text-amber-500 hover:underline">
              Panel Profesor
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
