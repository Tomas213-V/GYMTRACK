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
    FaRunning,
    FaTimes
} from "react-icons/fa";
import { FaHouse } from "react-icons/fa6";

function Sidebar() {
    const location = useLocation();
    const navigate = useNavigate();
    const [abiertoMovil, setAbiertoMovil] = useState(false);

    const rol = localStorage.getItem('rol');
    const esSocio = rol === 'socio' || Boolean(localStorage.getItem('socio'));

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
        setAbiertoMovil(false);
    }, [location.pathname]);

    // Opciones para Dueño / Administrador de Gimnasio
    const opcionesDueno = [
        { ruta: "/dashboard", nombre: "Inicio", icono: <FaHouse /> },
        { ruta: "/socios", nombre: "Socios", icono: <FaUsers /> },
        { ruta: "/asistencias", nombre: "Asistencias", icono: <FaCalendarCheck /> },
        { ruta: "/rutinas", nombre: "Rutinas", icono: <FaDumbbell /> },
        { ruta: "/pagos", nombre: "Pagos", icono: <FaMoneyBill /> },
        { ruta: "/perfil", nombre: "Mi Perfil", icono: <FaUser /> },
        { ruta: "/support", nombre: "Soporte", icono: <FaHeadset /> }
    ];

    // Opciones para Socio del Gimnasio
    const opcionesSocio = [
        { ruta: "/socio/dashboard", nombre: "Inicio", icono: <FaHouse /> },
        { ruta: "/socio/rutinas", nombre: "Rutinas", icono: <FaDumbbell />, alias: ["/rutinas"] },
        { ruta: "/ejercicios", nombre: "Ejercicios", icono: <FaRunning />, alias: ["/socio/ejercicios"] },
        { ruta: "/socio/asistencia", nombre: "Asistencia", icono: <FaCalendarCheck />, alias: ["/asistencias"] },
        { 
            ruta: "/socio/membresia", 
            nombre: "Membresía", 
            icono: <FaCreditCard />, 
            alias: ["/membresia", "/mi-membresia"] 
        },
        { ruta: "/perfil", nombre: "Perfil", icono: <FaUser /> }
    ];

    const opciones = esSocio ? opcionesSocio : opcionesDueno;

    const handleLogout = () => {
        localStorage.removeItem('token');
        localStorage.removeItem('usuario');
        localStorage.removeItem('socio');
        localStorage.removeItem('rol');
        if (esSocio) {
            navigate('/login-socio');
        } else {
            navigate('/login');
        }
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