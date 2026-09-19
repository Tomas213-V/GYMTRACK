import "./botones.css"
import { Link } from "react-router-dom"
function Botones() {
    return(
        <>
        
        <div className="Caja-botones">
            <Link to="/register">Empezar a trabajar</Link>
            <Link to="/precio">Ver precios</Link>
        </div>

         
        </>
    )
}
export default Botones