import "./sidebar.css"
import { Link, useLocation, useNavigate } from "react-router-dom";
import { FaMoneyBill, FaHeadset, FaUsers, FaCalendarCheck, FaDumbbell, FaUser } from "react-icons/fa";
import { FaHouse } from "react-icons/fa6";

function Sidebar() {
    const location = useLocation();
    const navigate = useNavigate();

    const opciones = [
        { ruta: "/dashboard", nombre: "Inicio", icono: <FaHouse /> },
        { ruta: "/socios", nombre: "Socios", icono: <FaUsers /> },
        { ruta: "/asistencias", nombre: "Asistencias", icono: <FaCalendarCheck /> },
        { ruta: "/rutinas", nombre: "Rutinas", icono: <FaDumbbell /> },
        { ruta: "/pagos", nombre: "Pagos", icono: <FaMoneyBill /> },
        { ruta: "/perfil", nombre: "Mi Perfil", icono: <FaUser /> },
        { ruta: "/support", nombre: "Soporte", icono: <FaHeadset /> }
    ];


    const handleLogout = () => {
        localStorage.removeItem('token');
        localStorage.removeItem('usuario');
        navigate('/login');
    };

    return (
        <div className="Caja-sidebar">
            <div className="Caja-sidebar-opciones">
                {opciones.map((opcion, index) => {
                    const esActivo = location.pathname === opcion.ruta;
                    return (
                        <Link 
                            to={opcion.ruta} 
                            key={index}
                            className={esActivo ? "Caja-sidebar-link-activo" : ""}
                        >
                            <i>{opcion.icono}</i>{opcion.nombre}
                        </Link>
                    );
                })}
            </div>

            <div className="Caja-sidebar-bottom">
                <button onClick={handleLogout}>Cerrar sesion</button>
            </div>
        </div>
    );
}

export default Sidebar;