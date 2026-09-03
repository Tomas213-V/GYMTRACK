// useState permite guardar información que puede cambiar
// mientras el usuario utiliza la pantalla.
import { useState } from 'react'

// Link sirve para navegar entre páginas sin recargar el sitio.
// useNavigate permite cambiar de página desde JavaScript.
import { Link, useNavigate } from 'react-router-dom'

// Importamos la función que se encarga de comunicarse
// con nuestro backend para registrar al usuario.
import { register } from '../../services/authService.js'

import logoImg from '../../assets/logo_verde.jpg'

// Importamos los estilos específicos de esta pantalla.
import './register.css'


// Componente principal de la página de registro.
// En React, los componentes son funciones que devuelven HTML (JSX).
function Register() {

  // navigate nos permite enviar al usuario a otra ruta.
  // Por ejemplo: navigate('/login')
  const navigate = useNavigate()


  // formData contiene TODOS los datos escritos en el formulario.
  //
  // Cada propiedad representa un campo del formulario.
  const [formData, setFormData] = useState({
    nombreGimnasio: '',
    direccion: '',
    telefono: '',
    emailGimnasio: '',
    nombre: '',
    apellido: '',
    email: '',
    contrasena: '',
    confirmarContrasena: '',
  })


  // errors guarda los errores de validación del formulario.
  //
  // Ejemplo:
  // {
  //   email: 'El email no es válido.',
  //   contrasena: 'La contraseña debe tener al menos 8 caracteres.'
  // }
  const [errors, setErrors] = useState({})


  // backendError guarda un error que venga directamente
  // desde nuestro servidor.
  //
  // Por ejemplo, si el email ya existe en la base de datos.
  const [backendError, setBackendError] = useState('')


  // loading indica si estamos esperando una respuesta del backend.
  //
  // Es útil para evitar que el usuario presione varias veces
  // el botón mientras se está procesando el registro.
  const [loading, setLoading] = useState(false)


  // success contiene un mensaje cuando el registro
  // se realizó correctamente.
  const [success, setSuccess] = useState('')


  // Esta función se ejecuta cada vez que el usuario
  // modifica alguno de los inputs.
  const handleChange = (event) => {

    // event.target contiene el input que fue modificado.
    //
    // name = nombre del campo
    // value = contenido escrito por el usuario
    const { name, value } = event.target


    // Actualizamos formData.
    //
    // ...formData significa:
    // "conservá todos los datos que ya teníamos".
    //
    // [name]: value significa:
    // "modificá solamente el campo que acaba de cambiar".
    setFormData({
      ...formData,
      [name]: value,
    })
  }


  // Esta función comprueba que los datos ingresados
  // sean correctos ANTES de enviarlos al backend.
  const validateForm = () => {

    // Acá vamos a guardar los errores encontrados.
    const newErrors = {}


    // Comprobamos que el nombre del gimnasio exista.
    if (!formData.nombreGimnasio.trim()) {
      newErrors.nombreGimnasio = 'El nombre del gimnasio es obligatorio.'
    }


    // Comprobamos el nombre del dueño.
    if (!formData.nombre.trim()) {
      newErrors.nombre = 'El nombre es obligatorio.'
    }


    // Comprobamos el apellido.
    if (!formData.apellido.trim()) {
      newErrors.apellido = 'El apellido es obligatorio.'
    }


    // Comprobamos que haya un email.
    if (!formData.email.trim()) {

      newErrors.email = 'El email es obligatorio.'

    // Si hay email, comprobamos que tenga un formato válido.
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {

      newErrors.email = 'Ingresá un email válido.'
    }


    // La contraseña es obligatoria.
    if (!formData.contrasena) {

      newErrors.contrasena = 'La contraseña es obligatoria.'

    // Y debe tener como mínimo 8 caracteres.
    } else if (formData.contrasena.length < 8) {

      newErrors.contrasena =
        'La contraseña debe tener al menos 8 caracteres.'
    }


    // Comprobamos que el usuario haya repetido la contraseña.
    if (!formData.confirmarContrasena) {

      newErrors.confirmarContrasena =
        'Debés confirmar la contraseña.'

    // Comprobamos que ambas contraseñas coincidan.
    } else if (
      formData.contrasena !== formData.confirmarContrasena
    ) {

      newErrors.confirmarContrasena =
        'Las contraseñas no coinciden.'
    }


    // Guardamos los errores encontrados.
    setErrors(newErrors)


    // Si newErrors está vacío, significa que no encontramos
    // ningún problema.
    //
    // Object.keys({}) devuelve [].
    //
    // Por eso:
    // true = formulario válido
    // false = formulario con errores
    return Object.keys(newErrors).length === 0
  }


  // Esta función se ejecuta cuando el usuario presiona
  // el botón "Crear cuenta".
  const handleSubmit = async (event) => {

    // Evita que el navegador recargue la página
    // al enviar el formulario.
    event.preventDefault()


    // Limpiamos mensajes anteriores.
    setBackendError('')
    setSuccess('')


    // Primero validamos el formulario.
    //
    // Si hay algún error, salimos de la función.
    if (!validateForm()) {
      return
    }


    // Indicamos que estamos procesando el registro.
    setLoading(true)


    try {

      // Enviamos los datos al backend.
      //
      // IMPORTANTE:
      // confirmarContrasena NO se envía.
      //
      // Solamente necesitamos la contraseña real.
      const data = await register({

        nombreGimnasio: formData.nombreGimnasio,
        direccion: formData.direccion,
        telefono: formData.telefono,
        emailGimnasio: formData.emailGimnasio,

        nombre: formData.nombre,
        apellido: formData.apellido,
        email: formData.email,
        contrasena: formData.contrasena,
      })


      // Si llegamos hasta acá significa que el backend
      // respondió correctamente.
      console.log(data)


      // Mostramos un mensaje de éxito.
      setSuccess(
        '¡Cuenta creada correctamente! Ahora podés iniciar sesión.'
      )


      // Después de 2 segundos llevamos al usuario
      // automáticamente a la pantalla de Login.
      setTimeout(() => {
        navigate('/login')
      }, 2000)


    } catch (error) {

      // Si el backend respondió con un error,
      // mostramos el mensaje al usuario.
      setBackendError(error.message)


    } finally {

      // Independientemente de si salió bien o mal,
      // dejamos de mostrar el estado de "cargando".
      setLoading(false)
    }
  }


  // Todo lo que está dentro de return es JSX.
  //
  // JSX parece HTML, pero en realidad forma parte de JavaScript
  // y React lo utiliza para construir la interfaz.
  return (

    <main className="register-page">

      <div className="register-card">
        <img src={logoImg} alt="GymTrack Logo" className="register-logoImg" />
        <h1>Crear cuenta</h1>

        {/* 
          FORMULARIO DEL GIMNASIO
        */}

        <section>

          <h2>Datos del gimnasio</h2>


          <div className="form-group">

            <label htmlFor="nombreGimnasio">
              Nombre del gimnasio
            </label>

            <input
              id="nombreGimnasio"

              // name permite saber qué propiedad de formData
              // debemos modificar.
              name="nombreGimnasio"

              type="text"

              value={formData.nombreGimnasio}

              onChange={handleChange}

              placeholder="Ej: GymTrack Fitness"
            />

            {/* 
              Si existe un error para este campo,
              mostramos el mensaje.
            */}
            {errors.nombreGimnasio && (
              <span className="error">
                {errors.nombreGimnasio}
              </span>
            )}

          </div>


          <div className="form-group">

            <label htmlFor="direccion">
              Dirección
            </label>

            <input
              id="direccion"
              name="direccion"
              type="text"
              value={formData.direccion}
              onChange={handleChange}
              placeholder="Ej: Av. Siempre Viva 123"
            />

          </div>


          <div className="form-group">

            <label htmlFor="telefono">
              Teléfono
            </label>

            <input
              id="telefono"
              name="telefono"
              type="tel"
              value={formData.telefono}
              onChange={handleChange}
              placeholder="Ej: 341 1234567"
            />

          </div>


          <div className="form-group">

            <label htmlFor="emailGimnasio">
              Email del gimnasio
            </label>

            <input
              id="emailGimnasio"
              name="emailGimnasio"
              type="email"
              value={formData.emailGimnasio}
              onChange={handleChange}
              placeholder="contacto@gimnasio.com"
            />

          </div>

        </section>


        {/* 
          DATOS DEL DUEÑO
        */}

        <section>

          <h2>Datos del dueño</h2>


          <div className="form-group">

            <label htmlFor="nombre">
              Nombre
            </label>

            <input
              id="nombre"
              name="nombre"
              type="text"
              value={formData.nombre}
              onChange={handleChange}
              placeholder="Tu nombre"
            />

            {errors.nombre && (
              <span className="error">
                {errors.nombre}
              </span>
            )}

          </div>


          <div className="form-group">

            <label htmlFor="apellido">
              Apellido
            </label>

            <input
              id="apellido"
              name="apellido"
              type="text"
              value={formData.apellido}
              onChange={handleChange}
              placeholder="Tu apellido"
            />

            {errors.apellido && (
              <span className="error">
                {errors.apellido}
              </span>
            )}

          </div>


          <div className="form-group">

            <label htmlFor="email">
              Email
            </label>

            <input
              id="email"
              name="email"
              type="email"
              value={formData.email}
              onChange={handleChange}
              placeholder="tu@email.com"
            />

            {errors.email && (
              <span className="error">
                {errors.email}
              </span>
            )}

          </div>


          <div className="form-group">

            <label htmlFor="contrasena">
              Contraseña
            </label>

            <input
              id="contrasena"
              name="contrasena"
              type="password"
              value={formData.contrasena}
              onChange={handleChange}
              placeholder="Mínimo 8 caracteres"
            />

            {errors.contrasena && (
              <span className="error">
                {errors.contrasena}
              </span>
            )}

          </div>


          <div className="form-group">

            <label htmlFor="confirmarContrasena">
              Confirmar contraseña
            </label>

            <input
              id="confirmarContrasena"
              name="confirmarContrasena"
              type="password"
              value={formData.confirmarContrasena}
              onChange={handleChange}
              placeholder="Repetí tu contraseña"
            />

            {errors.confirmarContrasena && (
              <span className="error">
                {errors.confirmarContrasena}
              </span>
            )}

          </div>

        </section>


        {/* 
          ERROR DEVUELTO POR EL BACKEND
        */}

        {backendError && (
          <div className="backend-error">
            {backendError}
          </div>
        )}


        {/* 
          MENSAJE DE ÉXITO
        */}

        {success && (
          <div className="success-message">
            {success}
          </div>
        )}


        {/* 
          BOTÓN PARA ENVIAR EL FORMULARIO
        */}

        <button
          type="button"
          onClick={handleSubmit}
          disabled={loading}
        >

          {loading ? 'Registrando...' : 'Crear cuenta'}

        </button>


        {/* 
          Link permite ir a Login sin recargar toda la página.
        */}

        <p>

          ¿Ya tenés una cuenta?{' '}

          <Link to="/login">
            Iniciar sesión
          </Link>

        </p>

      </div>

    </main>
  )
}


// Exportamos el componente para poder utilizarlo
// desde App.jsx.
export default Register