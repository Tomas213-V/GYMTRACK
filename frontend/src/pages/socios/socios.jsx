import React from 'react'
import NavGlobal from '../../components/nav-global/nav-global'
import Sidebar from '../../components/sidebar/sidebar'
import SocioContent from '../../components/socios/socio-content/content'
import './socios.css'

function Socios() {
  return (
    <div className="socios-page-layout">
      <NavGlobal />
      <div className="socios-main-wrapper">
        <Sidebar />
        <section className="socios-content-area">
          <SocioContent />
        </section>
      </div>
    </div>
  )
}

export default Socios