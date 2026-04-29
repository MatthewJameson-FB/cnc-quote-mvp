'use client'

type HiddenField = {
  name: string
  value: string
}

export default function ConfirmActionButton({
  action,
  fields,
  label,
  confirmMessage,
  className,
}: {
  action: (formData: FormData) => void | Promise<void>
  fields: HiddenField[]
  label: string
  confirmMessage: string
  className: string
}) {
  return (
    <form
      action={action}
      onSubmit={(event) => {
        if (!window.confirm(confirmMessage)) {
          event.preventDefault()
        }
      }}
    >
      {fields.map((field) => (
        <input key={`${field.name}:${field.value}`} type="hidden" name={field.name} value={field.value} />
      ))}
      <button type="submit" className={className}>
        {label}
      </button>
    </form>
  )
}
