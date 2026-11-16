import progressImage from '../../../assets/Gemini_Generated_Image_3636ky3636ky3636.jpg'
import setProgressImage from '../../../assets/Gemini_Generated_Image_3sm30l3sm30l3sm3.jpg'

import './preview.css'

function PreviewProgress(){
    return(
        <>
            <section className="progress-preview">

                <div className="preview-introduccion">

                    <h2>
                        Visualizá la evolución de tus socios
                    </h2>

                    <p>
                        GymTrack permite que cada socio pueda consultar y
                        registrar diferentes aspectos de su progreso,
                        manteniendo un seguimiento de su evolución a lo largo
                        del tiempo.
                    </p>

                </div>

                <div className="preview-contenido">

                    <div className="preview-imagen">
                        <img src={progressImage} alt="Vista del progreso de un socio" />
                    </div>

                    <div className="preview-descripcion">

                        <h3>
                            Seguimiento personalizado
                        </h3>

                        <p>
                            Los socios podrán consultar sus avances y observar
                            cómo evolucionan sus resultados con el paso del tiempo.
                        </p>

                    </div>

                </div>

                <div className="preview-contenido preview-invertido">

                    <div className="preview-imagen">
                        <img src={setProgressImage} alt="Registro de evolución del socio"
                        />
                    </div>

                    <div className="preview-descripcion">

                        <h3>
                            Tu progreso, siempre disponible
                        </h3>

                        <p>
                            Toda la información relacionada con el progreso
                            puede consultarse de manera clara y organizada
                            desde la aplicación.
                        </p>

                    </div>

                </div>

            </section>
        </>
    )
}
export default PreviewProgress