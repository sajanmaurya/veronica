import React from 'react'
import Header from '../_components/Header';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';




const Dashboardlayout = ({children}) => {
  return (
    <div  >
      
        {children}
       </div>
     
   
  )
}

export default Dashboardlayout;