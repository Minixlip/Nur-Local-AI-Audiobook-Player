import { ReactElement, cloneElement, useId } from 'react'

type TooltipSide = 'top' | 'bottom'

type TooltipProps = {
  label: string
  children: ReactElement
  className?: string
  side?: TooltipSide
}

export default function Tooltip({
  label,
  children,
  className,
  side = 'top'
}: TooltipProps): React.JSX.Element {
  const id = useId()

  return (
    <span className={`tooltip-wrapper${className ? ` ${className}` : ''}`}>
      {cloneElement(children as ReactElement<any>, {
        'aria-describedby': id
      })}
      <span id={id} role="tooltip" className={`tooltip-content tooltip-content-${side}`}>
        {label}
      </span>
    </span>
  )
}
