import { Link } from "react-router-dom";
import "./publicidad.css"
import { FaArrowRight,FaDumbbell } from "react-icons/fa";

function Publicidad() {
    return(
        <>
        <div className="Caja-publicidad">
        <div className="Caja-sub-publicidad">

        
         <div className="Caja-publicidad-imagen">
            <img src="/Telefono.png" alt="GymTrack App Móvil" />
         </div>
         <div className="Caja-publicidad-texto">
           <b>Empezá hoy mismo a entrenar mejor</b>
           <p>Unite a miles de personas que ya transformaron su entrenamiento con GymTrack</p>
          <div className="Caja-publicidad-vinculos">
            <Link to="/register-dueño">Crear mi cuenta <i><FaArrowRight/></i></Link>
            <Link to="/precio-landing">Ver precios</Link>
          </div>
          
         </div>
          
   <i className="Caja-publicidad-icono-fondo"><FaDumbbell/></i>

      
       
         </div>
        </div>
        
        </>
    )
}
export default Publicidad;