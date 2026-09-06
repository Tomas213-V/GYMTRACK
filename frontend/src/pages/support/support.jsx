import NavLanding from '../../components/landing/nav/nav';
import Foother from '../../components/Foother/foother';
import SupportTitulo from '../../components/support/support-titulo/titulo';
import SupportFAQ from '../../components/support/support-FAQ/faq';
import SupportContacto from '../../components/support/support-contacto/contacto';

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