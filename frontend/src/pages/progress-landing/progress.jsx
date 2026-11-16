import { Link } from "react-router-dom"

import NavLanding from "../../components/landing/nav/nav";
import TituloProgress from "../../components/progress-landing/progress-titulo/titulo";
import Foother from "../../components/foother-landing/foother";
import PreviewProgress from "../../components/progress-landing/progress-preview/preview";
import BenefitsProgress from "../../components/progress-landing/progress-benefits/benefits";

import './progress.css'

function Progress(){
    return(
        <>
        <div className="Caja-progreso">

            <NavLanding/>
            <TituloProgress/>
            <PreviewProgress/>
            <BenefitsProgress/>
            <Foother/>
               </div>
        </>
    );
}
export default Progress;