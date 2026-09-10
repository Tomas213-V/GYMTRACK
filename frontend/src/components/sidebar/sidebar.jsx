import "./sidebar.css"
import { Link } from "react-router-dom";
import { FaBars, FaDumbbell, FaChartLine, FaMoneyBill, FaHeadset } from "react-icons/fa";
import { FaHouse } from "react-icons/fa6";
function Sidebar() {

  const opciones= [
    {ruta:"/", nombre:"Inicio", icono:<FaHouse/>},
    {ruta:"/ejercicios", nombre:"Ejercicios", icono:<FaDumbbell/>},
    {ruta:"/progress", nombre:"Progreso", icono:<FaChartLine/>},
    {ruta:"/precio", nombre:"Precio", icono:<FaMoneyBill/>},
    {ruta:"/support", nombre:"Soporte", icono:<FaHeadset/>}]


    return(
        <>

         <div className="Caja-sidebar">

    <div className="Caja-sidebar-opciones">
       {opciones.map((opcion,index) => (
        <Link to={opcion.ruta} key={index}><i>{opcion.icono}</i>{opcion.nombre}</Link>
        
       ))}
    </div>

    <div className="Caja-sidebar-bottom">
 <button>Cerrar sesion</button>
    </div>

         </div>  

        </>
    )
}
export default Sidebar;