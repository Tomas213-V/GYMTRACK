import NavLanding from '../../components/landing/nav/nav';
import Foother from '../../components/foother-landing/foother';
import SupportTitulo from '../../components/support-landing/support-titulo/titulo';
import SupportFAQ from '../../components/support-landing/support-FAQ/faq';
import SupportContacto from '../../components/support-landing/support-contacto/contacto';

import './support.css'

function Support(){
    return(
        <>
            <NavLanding/>
            <SupportTitulo/>
            <SupportFAQ/>
            <SupportContacto/>
            <Foother/>
        </>
    );
}
export default Support;