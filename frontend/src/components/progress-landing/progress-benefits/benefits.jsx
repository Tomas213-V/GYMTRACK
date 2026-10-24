import './benefits.css'

function BenefitsProgress(){
    return(
        <>
            <section className="progress-benefits">

            <div className="benefits-titulo">

                <h2>
                    ¿Por qué hacer seguimiento del progreso?
                </h2>

                <p>
                    Convertí los avances de tus socios en una experiencia
                    más clara, motivadora y organizada.
                </p>

            </div>


            <div className="benefits-contenedor">

                <div className="benefit-card">

                    <h3>
                        📈 Visualizá tus avances
                    </h3>

                    <p>
                        Los socios pueden observar cómo evolucionan sus
                        resultados y comparar sus avances a lo largo del tiempo.
                    </p>

                </div>


                <div className="benefit-card">

                    <h3>
                        🎯 Establecé objetivos
                    </h3>

                    <p>
                        El seguimiento permite tener objetivos claros y
                        mantener la motivación durante el entrenamiento.
                    </p>

                </div>


                <div className="benefit-card">

                    <h3>
                        💪 Mantené la motivación
                    </h3>

                    <p>
                        Ver los resultados obtenidos ayuda a que los socios
                        puedan reconocer su esfuerzo y continuar progresando.
                    </p>

                </div>

            </div>

        </section>
        </>
    )
}
export default BenefitsProgress