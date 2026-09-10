import { Link } from "react-router-dom"
import NavGlobal from "../../components/nav-global/nav-global"
import Sidebar from "../../components/sidebar/sidebar"

function Dashboard(params) {
    return (
        <>
          <div>
            <NavGlobal/>
            <Sidebar/>
          </div>
        </>

    )
}
export default Dashboard