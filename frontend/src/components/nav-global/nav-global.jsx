import { FaBars, FaBell, FaUser, FaArrowDown } from "react-icons/fa"
import "./nav-global.css"
function NavGlobal() {
    return(
        <>
         <div className="Caja-nav-global">
       
                <div className="Caja-nav-global-logo">
                   <div>
          <i> <FaBars/></i>
                   </div>
          
                    <div>
 <b>GYM<span>TRACK</span></b>
                    </div>
                   
                </div>
                <div className="Caja-nav-global-icono-perfil">
                    <i><FaBell/></i>
                    
                 <div className="Caja-nav-global-icono-usuario">
                    <i><FaUser/></i>
                    <p>Usuario </p>
                 </div>
                </div>
           
         </div>
        </>
    )
}
export default NavGlobal