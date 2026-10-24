import './faq.css'

function SupportFAQ() {
    return (
        <section className="support-faq">

            <div className="faq-titulo">

                <h2>
                    Preguntas frecuentes
                </h2>

                <p>
                    Algunas respuestas a las consultas más comunes
                    sobre GymTrack.
                </p>

            </div>

            <div className="faq-contenedor">

                <div className="faq-pregunta">

                    <h3>
                        ¿Qué es GymTrack?
                    </h3>

                    <p>
                        GymTrack es una plataforma diseñada para facilitar
                        la gestión de gimnasios y brindar a los socios
                        herramientas para consultar su información,
                        rutinas y progreso.
                    </p>

                </div>

                <div className="faq-pregunta">

                    <h3>
                        ¿Quién puede utilizar GymTrack?
                    </h3>

                    <p>
                        GymTrack cuenta con funcionalidades destinadas tanto
                        a los administradores del gimnasio como a sus socios.
                    </p>

                </div>

                <div className="faq-pregunta">

                    <h3>
                        ¿Cómo puedo registrarme?
                    </h3>

                    <p>
                        Podés crear una cuenta utilizando la opción
                        "Registrarse" disponible en la plataforma.
                    </p>

                </div>

                <div className="faq-pregunta">

                    <h3>
                        ¿Puedo consultar mi progreso?
                    </h3>

                    <p>
                        Sí. Los socios podrán consultar sus registros y
                        visualizar la evolución de su progreso a lo largo
                        del tiempo.
                    </p>

                </div>

                <div className="faq-pregunta">

                    <h3>
                        ¿Cómo puedo recuperar mi contraseña?
                    </h3>

                    <p>
                        Si olvidaste tu contraseña, podés utilizar la opción
                        de recuperación de contraseña para volver a acceder
                        a tu cuenta.
                    </p>

                </div>

            </div>

        </section>
    )
}
export default SupportFAQ