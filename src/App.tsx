import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import Registro from './pages/Registro';
import Admin from './pages/Admin';
import Profesor from './pages/Profesor';
import './index.css';

function App() {
  return (
    <BrowserRouter>
      <ToastContainer position="top-right" autoClose={3000} />
      <Routes>
        <Route path="/" element={<Registro />} />
        <Route path="/admin" element={<Admin />} />
        <Route path="/profesor" element={<Profesor />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
