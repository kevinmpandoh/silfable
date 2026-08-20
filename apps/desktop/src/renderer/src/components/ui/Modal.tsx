import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import type { HTMLAttributes } from "react";

import { cn } from "../../lib/utils";

export interface ModalProps extends HTMLAttributes<HTMLDivElement> {
  isOpen: boolean;
  onClose?: () => void;
  title?: string;
  subtitle?: string;
  maxWidth?: string;
}

export function Modal({ isOpen, onClose, title, subtitle, children, maxWidth = "560px", className, style, ...props }: ModalProps) {
  return (
    <Dialog.Root open={isOpen} onOpenChange={(open) => { if (!open) onClose?.(); }}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <Dialog.Content
          className={cn("fixed left-1/2 top-1/2 z-50 grid w-[calc(100vw-48px)] max-h-[calc(100vh-48px)] -translate-x-1/2 -translate-y-1/2 gap-4 overflow-y-auto rounded-2xl border border-[rgb(32_33_42_/_0.12)] bg-white p-6 text-[#20212a] shadow-2xl outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95", className)}
          style={{ width: `min(${maxWidth}, calc(100vw - 48px))`, ...style }}
          {...props}
        >
          {(title || subtitle) && <div className="pr-8">
            {title && <Dialog.Title className="m-0 text-lg font-bold text-[#20212a]">{title}</Dialog.Title>}
            {subtitle && <Dialog.Description className="mt-1 text-xs text-[#686970]">{subtitle}</Dialog.Description>}
          </div>}
          {onClose && <Dialog.Close asChild><button type="button" className="absolute right-5 top-5 inline-grid size-8 place-items-center rounded-full border border-[rgb(32_33_42_/_0.12)] text-[#686970] transition hover:border-[rgb(32_33_42_/_0.25)] hover:bg-[#f3f4f6] hover:text-[#20212a]" aria-label="Close"><X className="size-4" /></button></Dialog.Close>}
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
