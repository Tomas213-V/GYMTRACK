import { Link } from "react-router-dom"

import NavLanding from "../../components/landing/nav/nav";
import TituloProgress from "../../components/progress/progress-titulo/titulo";
import Foother from "../../components/Foother/foother";
import PreviewProgress from "../../components/progress/progress-preview/preview";
import BenefitsProgress from "../../components/progress/progress-benefits/benefits";

import './progress.css'

function Progress(){
    return(
        <>
            <NavLanding/>
            <TituloProgress/>
            <PreviewProgress/>
            <BenefitsProgress/>
            <Foother/>
        </>
    );
}
export default Progress;