import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import Registro from './pages/Registro';
import Admin from './pages/Admin';
import Profesor from './pages/Profesor';
import Estudiante from './pages/Estudiante';
import './index.css';

function App() {
  return (
    <BrowserRouter>
      <ToastContainer position="top-right" autoClose={3000} />
      <Routes>
        <Route path="/" element={<Registro />} />
        <Route path="/admin" element={<Admin />} />
        <Route path="/profesor" element={<Profesor />} />
        <Route path="/estudiante" element={<Estudiante />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
