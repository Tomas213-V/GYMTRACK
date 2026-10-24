
import { FaBusinessTime, FaUser,FaBuilding, FaArrowRight } from "react-icons/fa";
import NavLanding from "../../components/landing/nav/nav";
import { FaRegCircleCheck  } from "react-icons/fa6";
import "./precio.css"
import { Link } from "react-router-dom";
function Precio(params) {
    const tarjetas= [{icono:<FaBuilding/>,
        titulo:"Dueño", 
        descripcion:"Gestiona tu gimnasio de forma simple y segura" ,
        precio:"$ 19.999", 
        caracteristicas:[{descripcion:"Gestion de socios"},
            {descripcion:"Rutinas y planes personalizados"},
            {descripcion:"Seguimiento de progreso"},
            {descripcion:"Estadisticas y reportes"},
            {descripcion:"Soporte prioritario"}]},

        {icono:<FaUser/>
        ,titulo:"Socio", 
        descripcion:"Entrena mejor con rutinas, seguimiento y consejos profesionales" ,
        precio:"Preguntar", 
        caracteristicas:[{descripcion:"Acceso ilimitado a planes y rutinas"},
            {descripcion:"Seguimiento de progreso"},
            {descripcion:"Videos e instrucciones detelladas"},
            {descripcion:"Consejos y recomendaciones"},
              {descripcion:"Perfil personalizable"}]}]

    return(
        <>
         <div className="Caja-precio"> 
         <NavLanding/>
            <div className="Caja-precio-titulo">

              <p>Precio</p>

            </div>
       <div className="Caja-precio-encabezado">
             <b>Planes simples y accesibles <span>para todos</span></b>
             <p>Ya seas dueño de un gimnasio o estes comenzando tu entrenamiento, tenemos el plan ideal para vos</p>
       </div>

       <div className="Caja-precio-tarjetas">
            {tarjetas.map((tarjeta, index) => (
                <div className="Caja-precio-tarjeta" key={index}>
                    <div className="Caja-precio-tarjeta-icono">
                        <i>{tarjeta.icono}</i>
                    </div>
                    <div className="Caja-precio-tarjeta-titulo">
                        <b>{tarjeta.titulo}</b>
                    </div>
                    <div className="Caja-precio-tarjeta-descripcion">
                        <p>{tarjeta.descripcion}</p>
                    </div>
                    <div className="Caja-precio-tarjeta-precio">
                        <p>{tarjeta.precio}</p>
                         <span>/mes</span>
                    </div>
                    <div className="Caja-precio-tarjeta-caracteristicas">
                        {tarjeta.caracteristicas.map((caracteristica, index) => (
                            <div className="Caja-precio-tarjeta-caracteristica" key={index}>
                              
                                <p>  <i><FaRegCircleCheck /></i>{caracteristica.descripcion}</p>
                            </div>
                        ))}
                    </div>
                    <div className="Caja-precio-tarjeta-hipervinculo">
                       <Link to="/login-dueño">Comenzar ahora <i><FaArrowRight/></i></Link>
                    </div>
                </div>
            ))}
       </div>
          <div>

          </div>
        </div>
        </>
    )
}
export default Precio;