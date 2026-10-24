import "./tarjetas.css"
import { FaDumbbell, FaRegCirclePlay,FaChartLine,FaShieldHeart   } from "react-icons/fa6";

function Tarjetas() {
   const informacion=[{icono:<FaDumbbell/>,titulo:"Ejercicios para cada músculo",descripcion:"Explorá ejercicios clasificados por grupos musculares para enfocarte en lo que necesitas trabajar"},
    {icono:<FaRegCirclePlay/>,titulo:"Instrucciones paso a paso",descripcion:"Cada ejercicios incluye videos, descripciones detalladas y consejos para una ejecucion correcta"},
    {icono:<FaShieldHeart  />,titulo:"Entrená de forma segura",descripcion:"Aprendé la tecnica correcta y evita lesiones con nuestras guias y recomendaciones profesionales"},
    {icono:<FaChartLine />,titulo:" Seguimiento de tu progreso",descripcion:"Agregá ejercicios a tu rutina y llevá un registro de tus entrenamientos y avances"},]
   
   
    return(
        <>
      
         
        <div className="Caja-tarjetas">
           
            {informacion.map((info, index) => (
                <div key={index} className="Caja-tarjeta">
                    <div className="Caja-tarjeta-icono">
                       <i>{info.icono}</i> 
                    </div>
                    <div className="Caja-tarjeta-titulo">
                        <b>{info.titulo}</b>
                    </div>
                    <div className="Caja-tarjeta-descripcion">
                        <p>{info.descripcion}</p>
                    </div>
                </div>
            ))}
        </div>
        </>
    )
}
export default Tarjetas