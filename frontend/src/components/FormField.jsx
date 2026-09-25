function FormField({ label, htmlFor, children, className }) {
  return (
    <label className={className} htmlFor={htmlFor}>
      {label}
      {children}
    </label>
  )
}

export default FormField
