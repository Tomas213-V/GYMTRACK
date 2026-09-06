import { FaPlay, FaSearch } from "react-icons/fa"
import { FaCirclePlus, FaChartArea } from "react-icons/fa6"
import "./indicaciones.css"
function Indicaciones() {

   const informacion=[{numero:1,icono:<FaSearch/>, titulo:"Explorá", descripcion:"Buscá ejercicios por grupo muscular o nombre para encontrar lo que necesites"},
    {numero:2,icono:<FaPlay/>, titulo:"Aprendé", descripcion:"Mirá videos claros y seguí las instrucciones para asegurar una técnica correcta y evitar lesiones"},
    {numero:3,icono:<FaCirclePlus/>, titulo:"Agregá a tu rutina", descripcion:"Seleccioná los ejercicios que quieras y armá tu rutina personalizada"},
    {numero:4,icono:<FaChartArea/>, titulo:"Registrá tu progreso", descripcion:"Registrá tu progreso y seguí tu evolución día a día"}
]


    return(
        <>

       <div className="Caja-indicaciones">
              
              {informacion.map((info,index) => (
                <div className="Caja-indicacion" key={index}>
                  <div className="Caja-indicacion-numero">
                    <p>{info.numero}</p>  
                  </div>
                  <div className="Caja-indicacion-icono">
                    <i>{info.icono}</i>
                  </div>
                  <div className="Caja-indicacion-titulo-descripcion">
                    <b>{info.titulo}</b>
                     <p>{info.descripcion}</p>
                  </div>
                </div>
              ))}
              
                    </div>

        </>
    )
}
export default Indicaciones