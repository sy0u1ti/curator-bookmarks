import { createContext, useContext, type ComponentPropsWithRef, type ComponentType, type ReactNode } from 'react'

type SurfaceMaterialProps = ComponentPropsWithRef<'div'>
const MaterialContext = createContext<ComponentType<SurfaceMaterialProps> | null>(null)

/** Skin an existing popup root without adding a wrapper or changing its
 * attributes/ref. React portals retain the page's material provider. */
export function SurfaceMaterialProvider({
  component,
  children
}: {
  component: ComponentType<SurfaceMaterialProps>
  children: ReactNode
}) {
  return <MaterialContext.Provider value={component}>{children}</MaterialContext.Provider>
}

export function SurfaceMaterial(props: SurfaceMaterialProps) {
  const Material = useContext(MaterialContext)
  return Material ? <Material {...props} /> : <div {...props} />
}
