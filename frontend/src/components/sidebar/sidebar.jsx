import "./sidebar.css"
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
    FaCalendarAlt 
} from "react-icons/fa";
import { FaHouse } from "react-icons/fa6";

function Sidebar() {
    const location = useLocation();
    const navigate = useNavigate();

    const rol = localStorage.getItem('rol');
    const esSocio = rol === 'socio' || Boolean(localStorage.getItem('socio'));

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

    // Opciones para Socio del Gimnasio (Fiel a la interfaz y al portal de socios)
    const opcionesSocio = [
        { ruta: "/socio/dashboard", nombre: "Inicio", icono: <FaHouse /> },
        { ruta: "/ejercicios", nombre: "Ejercicios", icono: <FaDumbbell />, alias: ["/socio/ejercicios"] },
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
        <aside className="Caja-sidebar">
            <div className="Caja-sidebar-opciones">
                {opciones.map((opcion, index) => {
                    const esActivo = location.pathname === opcion.ruta || 
                        (opcion.alias && opcion.alias.includes(location.pathname));

                    return (
                        <Link 
                            to={opcion.ruta} 
                            key={index}
                            className={esActivo ? "Caja-sidebar-link-activo" : ""}
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
    );
}

export default Sidebar;