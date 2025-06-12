import { useToast } from "@/hooks/use-toast"
import {
  Toast,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
} from "@/components/ui/toast"
import { AlertCircle, CheckCircle2, XCircle, AlertTriangle } from "lucide-react"

export function Toaster() {
  const { toasts } = useToast()

  return (
    <ToastProvider>
      {toasts.map(function ({ id, title, description, action, variant, ...props }) {
        // Icon based on variant
        let Icon = null
        switch (variant) {
          case 'destructive':
            Icon = XCircle
            break
          case 'success':
            Icon = CheckCircle2
            break
          case 'warning':
            Icon = AlertTriangle
            break
          default:
            Icon = AlertCircle
        }

        return (
          <Toast key={id} {...props} variant={variant}>
            <div className="flex gap-3">
              {Icon && <Icon className={`h-5 w-5 ${
                variant === 'destructive' ? 'text-red-600' : 
                variant === 'success' ? 'text-green-600' : 
                variant === 'warning' ? 'text-amber-600' : 
                'text-blue-600'
              }`} />}
              <div className="grid gap-1">
                {title && <ToastTitle>{title}</ToastTitle>}
                {description && (
                  <ToastDescription>{description}</ToastDescription>
                )}
              </div>
            </div>
            {action}
            <ToastClose />
          </Toast>
        )
      })}
      <ToastViewport />
    </ToastProvider>
  )
}
