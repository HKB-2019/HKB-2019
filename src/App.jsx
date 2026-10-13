import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Storefront from './pages/Storefront.jsx';
import OrderStatus from './pages/OrderStatus.jsx';
import Admin from './pages/Admin.jsx';
import ProductPage from './pages/ProductPage.jsx';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Storefront />} />
        <Route path="/product/:id" element={<ProductPage />} />
        {/* where Paystack sends the customer back */}
        <Route path="/order" element={<OrderStatus />} />
        <Route path="/admin" element={<Admin />} />
        <Route path="*" element={<Storefront />} />
      </Routes>
    </BrowserRouter>
  );
}
