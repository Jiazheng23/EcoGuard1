import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Login from './Login'
import Register from './Register'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* 默认打开网页时，自动跳转到登录页 */}
        <Route path="/" element={<Navigate to="/login" />} />
        
        {/* 定义具体的页面路径 */}
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App