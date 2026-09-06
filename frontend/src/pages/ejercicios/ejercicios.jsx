import Indicaciones from "../../components/ejercicios/indicaciones/indicaciones"
import Publicidad from "../../components/ejercicios/publicidad/publicidad"
import Tarjetas from "../../components/ejercicios/tarjetas/tarjetas"
import NavLanding from "../../components/landing/nav/nav"
import "./ejercicios.css"
function Ejercicios() {
 
    return(
        <>
      
        <div className="Caja-ejercicios">
  <NavLanding/>
             <div className="Caja-ejercicios-titulo">
   <p>Ejercicios</p>
   <b>Todo lo que necesitás <span>en un solo lugar</span> </b>
   <p>Gymtrack te brinda una biblioteca completa de ejercicios para que entrenes de manera segura, efectiva y organizada</p>
             </div>
             <div className="Caja-ejercicios-separador">
 
             </div>
             <div className="Caja-ejercicios-titulo-2">
                <b>¿Que podes encontrar?</b>
             </div>
             <Tarjetas/>
      
        <div className="Caja-ejercicios-separador">
 
             </div>

     <div className="Caja-ejercicios-titulo-2">
                <b>¿Como funciona?</b>
             </div>

              <Indicaciones/>
              <Publicidad/>
        </div>
        </>
    )
}
export default Ejercicios
 