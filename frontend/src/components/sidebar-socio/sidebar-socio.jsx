import { useState, useEffect } from "react";
import "../sidebar/sidebar.css";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { 
    FaCalendarCheck, 
    FaDumbbell, 
    FaUser, 
    FaCreditCard, 
    FaSignOutAlt, 
    FaRunning,
    FaTimes
} from "react-icons/fa";
import { FaHouse } from "react-icons/fa6";

function SidebarSocio() {
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

    // Opciones exclusivas para Socio del Gimnasio
    const opciones = [
        { ruta: "/dashboard-socio", nombre: "Inicio", icono: <FaHouse />, alias: ["/socio/dashboard"] },
        { ruta: "/rutinas-socio", nombre: "Rutinas", icono: <FaDumbbell />, alias: ["/socio/rutinas", "/rutinas"] },
        { ruta: "/ejercicios-socio", nombre: "Ejercicios", icono: <FaRunning />, alias: ["/socio/ejercicios", "/ejercicios"] },
        { ruta: "/asistencia-socio", nombre: "Asistencia", icono: <FaCalendarCheck />, alias: ["/asistencias", "/socio/asistencia", "/asistencias-socio"] },
        { 
            ruta: "/membresia-socio", 
            nombre: "Membresía", 
            icono: <FaCreditCard />, 
            alias: ["/socio/membresia", "/membresia", "/mi-membresia"] 
        },
        { ruta: "/perfil-socio", nombre: "Perfil", icono: <FaUser />, alias: ["/perfil"] }
    ];

    const handleLogout = () => {
        localStorage.removeItem('token');
        localStorage.removeItem('usuario');
        localStorage.removeItem('socio');
        localStorage.removeItem('rol');
        navigate('/login-socio');
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

export default SidebarSocio;
