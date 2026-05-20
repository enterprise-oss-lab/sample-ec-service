import { NavLink } from "react-router"
import { ProductList } from "@/features/product/components/ProductList"

export const HomePage = () => {
  return (
    <>
      <h1 className="text-2xl text-red-400">Home Page</h1>
      <NavLink to="/orders" >注文履歴</NavLink>
      <ProductList />
    </>
  )
}
