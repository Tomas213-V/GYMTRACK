import "./botones.css"
import { Link } from "react-router-dom"
function Botones() {
    return(
        <>
        
        <div className="Caja-botones">
            <Link to="/register-dueño">Empezar a trabajar</Link>
            <Link to="/precio-landing">Ver precios</Link>
        </div>

         
        </>
    )
}
export default Botones