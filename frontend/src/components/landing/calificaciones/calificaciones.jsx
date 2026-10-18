import "./calificaciones.css"
import { FaStar } from "react-icons/fa6";
function Calificaciones() {
  
    const array=5
  
    return(
        <>

<div className="Caja-calificaciones">
            {Array.from({ length: array }).map((_, index) => (
                <i key={index}>
                    <FaStar />
                </i>
            ))}
            <div className="Caja-calificaiones-descripcion">
                Calificado por 2000 usuarios
            </div>
        </div>
        </>
    )
}
export default Calificaciones