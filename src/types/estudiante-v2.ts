// Tipos para modelo normalizado

export interface EstudianteV2 {
  id: string;
  nombreApellido: string;
  telefono: string;
  correo: string;
  fechaNacimiento: string;
  tiempoMinisterio: string;
  fechaRegistro: any;
}

export interface Inscripcion {
  id: string;
  estudianteId: string;
  cursoId: string;
  fechaInscripcion: any;
}

export interface EstudianteConCursos extends EstudianteV2 {
  cursos: string[]; // IDs de cursos
  cursosNombres: string[]; // Nombres de cursos
}
