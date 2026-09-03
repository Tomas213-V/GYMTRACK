import { Link } from "react-router-dom"
import "./landing.css"

function Landing(params) {
    return (
        <>
            <div className="Caja-landing">
                <p>Hola que tul </p>
                <p>Hola que tul 1 </p>
                <p>Hola que tul 2 </p>
                <p>Hola que tul 3 </p>
                <p>Hola que tul 4 </p>
                <p>Hola que tul 5 </p>

                <Link to={'/register'}>Register</Link>
                <Link to={'/login'}>Login</Link>
            </div>

        </>
    )
}
export default Landing