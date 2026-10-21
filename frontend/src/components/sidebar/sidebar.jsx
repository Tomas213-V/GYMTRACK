/**
 * =========================================================================================
 * ARCHIVO: sidebar.jsx
 * RUTA: frontend/src/components/sidebar/sidebar.jsx
 * PROYECTO: GYMTRACK - Frontend
 * DESCRIPCIÓN: Menú lateral de navegación para el rol Dueño / Administrador de Gimnasio.
 * =========================================================================================
 * 
 * GUÍA PASO A PASO PARA EL DESARROLLADOR EXTERNO:
 * 1. PASO 1 (Escucha de Eventos Responsive): Suscribe un listener a `'gymtrack:toggle-sidebar'`
 *    para abrirse o cerrarse en modo modal/drawer cuando el usuario pulsa la hamburguesa en el navbar.
 * 2. PASO 2 (Opciones de Navegación): Define las rutas del dueño (Inicio, Socios, Membresías,
 *    Asistencias, Rutinas, Pagos, Mi Perfil, Soporte) e incluye aliases para retrocompatibilidad.
 * 3. PASO 3 (Cierre de Sesión Seguro): `handleLogout()` elimina todos los tokens y objetos de
 *    `localStorage` y transiciona al login.
 */

import { useState, useEffect } from "react";
import "./sidebar.css";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { 
    FaMoneyBill, 
    FaHeadset, 
    FaUsers, 
    FaCalendarCheck, 
    FaDumbbell, 
    FaUser, 
    FaCreditCard, 
    FaSignOutAlt, 
    FaTimes
} from "react-icons/fa";
import { FaHouse } from "react-icons/fa6";

function Sidebar() {
    const location = useLocation();
    const navigate = useNavigate();
    const [abiertoMovil, setAbiertoMovil] = useState(false);


    // Escuchar evento personalizado disparado desde NavGlobal para alternar el menú en móviles
    useEffect(() => {
        const toggleHandler = () => {
            setAbiertoMovil(prev => !prev);
        };

        window.addEventListener('gymtrack:toggle-sidebar', toggleHandler);
        return () => {
            window.removeEventListener('gymtrack:toggle-sidebar', toggleHandler);
        };
    }, []);

    // Cerrar el drawer en móviles al cambiar de página
    useEffect(() => {
        setAbiertoMovil(prev => (prev ? false : prev));
    }, [location.pathname]);

    // Opciones exclusivas para Dueño / Administrador de Gimnasio
    const opciones = [
        { ruta: "/dashboard-dueño", nombre: "Inicio", icono: <FaHouse />, alias: ["/dashboard", "/dashboard-dueno"] },
        { ruta: "/socios-dueño", nombre: "Socios", icono: <FaUsers />, alias: ["/socios", "/socios-dueno"] },
        { ruta: "/membresia-dueño", nombre: "Membresías", icono: <FaCreditCard />, alias: ["/membresias-dueño", "/membresia-admin", "/membresias", "/membresias-admin", "/membresia-dueno", "/membresias-dueno"] },
        { ruta: "/asistencias-dueño", nombre: "Asistencias", icono: <FaCalendarCheck />, alias: ["/asistencias", "/asistencias-dueno"] },
        { ruta: "/rutinas-dueño", nombre: "Rutinas", icono: <FaDumbbell />, alias: ["/rutinas", "/rutinas-dueno"] },
        { ruta: "/pagos-dueño", nombre: "Pagos", icono: <FaMoneyBill />, alias: ["/pagos", "/pagos-dueno"] },
        { ruta: "/perfil-dueño", nombre: "Mi Perfil", icono: <FaUser />, alias: ["/perfil", "/perfil-dueno"] },
        { ruta: "/support-dueño", nombre: "Soporte", icono: <FaHeadset />, alias: ["/support", "/support-dueno", "/soporte-dueño", "/soporte-dueno"] }
    ];

    const handleLogout = () => {
        localStorage.removeItem('token');
        localStorage.removeItem('usuario');
        localStorage.removeItem('socio');
        localStorage.removeItem('rol');
        navigate('/login-dueño');
    };

    return (
        <>
            {/* Backdrop oscuro cuando el drawer está abierto en tablet/móvil */}
            {abiertoMovil && (
                <div 
                    className="Caja-sidebar-overlay" 
                    onClick={() => setAbiertoMovil(false)}
                    aria-label="Cerrar menú lateral"
                />
            )}

            <aside className={`Caja-sidebar ${abiertoMovil ? "abierto-movil" : ""}`}>
                {/* Header exclusivo para móvil / tablet dentro del sidebar */}
                <div className="Caja-sidebar-mobile-header">
                    <div className="Caja-sidebar-mobile-logo">
                        <b>GYM<span>TRACK</span></b>
                    </div>
                    <button 
                        className="Caja-sidebar-close-btn" 
                        onClick={() => setAbiertoMovil(false)}
                        aria-label="Cerrar navegación"
                    >
                        <FaTimes />
                    </button>
                </div>

                <div className="Caja-sidebar-opciones">
                    {opciones.map((opcion, index) => {
                        const esActivo = location.pathname === opcion.ruta || 
                            (opcion.alias && opcion.alias.includes(location.pathname));

                        return (
                            <Link 
                                to={opcion.ruta} 
                                key={index}
                                className={esActivo ? "Caja-sidebar-link-activo" : ""}
                                onClick={() => setAbiertoMovil(false)}
                            >
                                <i className="Caja-sidebar-icono">{opcion.icono}</i>
                                <span>{opcion.nombre}</span>
                            </Link>
                        );
                    })}
                </div>

                <div className="Caja-sidebar-bottom">
                    <button onClick={handleLogout} className="Caja-sidebar-logout-btn">
                        <FaSignOutAlt className="Caja-sidebar-logout-icon" />
                        <span>Cerrar sesión</span>
                    </button>
                </div>
            </aside>
        </>
    );
}

export default Sidebar;