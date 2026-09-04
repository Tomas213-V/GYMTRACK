import { FaShield } from "react-icons/fa6"
import "./caracteristicas.css"
import { FaFlask, FaUser } from "react-icons/fa"
function Caracteristicas() {
    return(
        <>
        
        <div className="Caja-caracteristicas">
            <p><i><FaShield/></i>Ecosistema amigable</p>
            <p><i><FaFlask/></i> Para todo tipo de deportes</p>
            <p><i><FaUser/></i>Aprobado por atletas</p>
        </div>

        </>
    )
}
export default Caracteristicas